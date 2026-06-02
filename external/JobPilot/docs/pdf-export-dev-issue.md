# PDF Export Dev/Build Disparity Investigation

## Problem

PDF export works in the **built/packaged application** but fails in **dev environment** (`pnpm dev:tauri`). The failure produces a PDF file with the content "ERR_FILE_NOT_FOUND" instead of the actual resume.

## Architecture Overview

The PDF export pipeline in desktop mode:

1. Frontend calls `generateHtml(resume, true)` to produce HTML string
2. Frontend calls `invoke("write_pdf_export", { outputPath, html })` (Tauri IPC)
3. Rust `write_pdf_export()` writes HTML to a temp file, then launches Chrome/Edge headless with `--print-to-pdf`
4. Chrome generates PDF at the user-specified output path

```
Frontend (TS)                Rust (storage.rs)                Chrome/Edge
─────────────                ────────────────                ────────────
generateHtml()  ──IPC──►  write_pdf_export()
                               │
                               ├─ fs::write(temp_html_path, html)
                               ├─ Command::new(browser_path)
                               │   .arg("--headless")
                               │   .arg("--print-to-pdf=...")
                               │   .arg(temp_html_path)
                               ├─ command.output()
                               └─ fs::metadata(resolved_output_path)
```

## Debug Logs (from eprintln)

```
[PDF EXPORT] browser=C:\Program Files\Google\Chrome\Application\chrome.exe
              html=C:/Users/lifeng/AppData/Local/com.jobpilot.desktop/exports/pdf-export-{ts}.html
              pdf=D:\Untitled Resume-20260526-110559.pdf
              user_data_dir=C:/Users/lifeng/AppData/Local/com.jobpilot.desktop/exports/pdf-render-profile
[PDF EXPORT] cmd="C:\Program Files\Google\Chrome\Application\chrome.exe"
              "--headless" "--disable-gpu" "--allow-file-access-from-files"
              "--run-all-compositor-stages-before-draw" "--virtual-time-budget=12000"
              "--no-first-run" "--no-default-browser-check" "--no-pdf-header-footer"
              "--user-data-dir=..." "--print-to-pdf=D:\..." "C:/..."
[PDF EXPORT] status=exit code: 0 stdout=<empty> stderr=<empty>
```

Key observations:
- Chrome returns **exit code 0** with empty stdout/stderr
- The temp HTML file exists and contains valid content (~43KB)
- A PDF file IS generated, but its content is the Chrome error page "ERR_FILE_NOT_FOUND"

## Manual Verification

Running the same Chrome headless command **directly in the terminal** succeeds and produces a valid 20KB PDF. Running it via Rust `Command::new` fails. This narrows the issue to how Rust spawns the process vs direct terminal execution.

## Attempted Fixes (all unsuccessful so far)

### 1. `--print-to-pdf` path format

**Hypothesis**: `resolved_output_path.to_string_lossy()` returns Windows backslash paths (e.g. `D:\Untitled Resume.pdf`) which Chrome may misparse.

**Change**: Use `path_to_string()` to convert to forward slashes.

**Result**: No improvement. Chrome exit 0, still ERR_FILE_NOT_FOUND.

### 2. `--user-data-dir` (independent Chrome profile)

**Hypothesis**: When Chrome is already running (user's browser), the headless command gets absorbed by the existing instance. The existing instance doesn't execute `--print-to-pdf`.

**Change**: Added `--user-data-dir=<cache_dir>/pdf-render-profile` to use an isolated profile directory.

**Result**: No improvement. Manual terminal test showed that `--user-data-dir` with a **fresh** directory works (20KB valid PDF), but a **pre-existing** directory with `SingletonLock` files from prior failed runs still gets intercepted by the running Chrome instance.

### 3. Timestamp-based user-data-dir

**Hypothesis**: A reused profile directory accumulates `SingletonLock`, `SingletonCookie`, `SingletonSocket` files from prior Chrome sessions. On subsequent runs, Chrome detects these lock files and connects to the existing instance instead of starting a new headless process.

**Change**: Use `format!("pdf-render-profile-{timestamp}")` for a unique profile each time, then delete after export.

**Result**: Still fails via Rust `Command::new`, despite manual terminal test succeeding with the same approach.

### 4. `--headless=new` (new headless mode)

**Hypothesis**: Chrome `--headless` (old mode) may be deprecated or buggy in newer Chrome versions.

**Change**: Switch from `--headless` to `--headless=new`.

**Result**: No improvement.

### 5. `CREATE_NO_WINDOW` process flag

**Hypothesis**: On Windows, a console process spawning a GUI subprocess (Chrome) may need `CREATE_NO_WINDOW` to prevent window/console issues.

**Change**: Added `command.creation_flags(0x08000000)` on Windows.

**Result**: No improvement.

### 6. `file:///` URL format for HTML input

**Hypothesis**: Passing a bare file path as the last argument might not work; Chrome may need a proper `file:///` URL.

**Change**: Changed `.arg(&html_path_str)` to `.arg(format!("file:///{}", html_path_str))`.

**Result**: No improvement.

## Resolved Cause

The observed gap was not caused by the command line arguments alone. The more likely cause was a Windows/Chrome process timing race:

1. Rust launched `chrome.exe` and waited for that process to exit.
2. Chrome could still hand rendering work to another process after the launcher process returned.
3. The Rust code immediately deleted the temporary HTML file after `command.output()` returned.
4. The renderer process then attempted to load a file that no longer existed and printed Chrome's `ERR_FILE_NOT_FOUND` error page into the PDF.

This explains why the same command could succeed when run manually from a terminal: the temporary HTML file was not being deleted immediately by the caller.

There was also a second weakness in the attempted `file:///` fix: it hand-built the file URL from a path string. The final implementation now uses `tauri::Url::from_file_path(...)`, so Windows drive letters, spaces, backslashes, and URL escaping are handled by the URL implementation rather than string concatenation.

## Final Fix

Implemented in `desktop/src-tauri/src/storage.rs`:

1. Remove any existing output PDF before starting a new export, so validation cannot accidentally inspect a stale file.
2. Convert the temporary HTML path with `tauri::Url::from_file_path(...)` and pass the resulting `file:` URL to Chrome.
3. Keep the unique `--user-data-dir` profile and `--headless=new` flags.
4. After Chrome exits, wait until the target PDF exists and its size is stable across multiple polls.
5. Validate the output before returning success:
   - The file must start with `%PDF-`.
   - If text extraction succeeds, the extracted text must not contain `ERR_FILE_NOT_FOUND`.
6. Delete the temporary HTML file and temporary browser profile only after the PDF has been produced and validated.

Key helpers added:

- `file_url_from_path(path: &Path) -> Result<String, String>`
- `wait_for_pdf_export_output(path: &Path) -> Result<usize, String>`
- `validate_pdf_export_output(path: &Path) -> Result<(), String>`

## Validation

Commands run after the fix:

```bash
cargo check --manifest-path "K:/myproject/RoleRover/desktop/src-tauri/Cargo.toml" --target-dir "K:/myproject/RoleRover/.codex-cargo-target/desktop-tauri"
cargo check --manifest-path "K:/myproject/RoleRover/desktop/src-tauri/Cargo.toml" --target-dir "K:/myproject/RoleRover/.codex-cargo-target/desktop-tauri"
cargo check --manifest-path "K:/myproject/RoleRover/desktop/src-tauri/Cargo.toml" --target-dir "K:/myproject/RoleRover/.codex-cargo-target/desktop-tauri"
cargo test --manifest-path "K:/myproject/RoleRover/desktop/src-tauri/Cargo.toml" --target-dir "K:/myproject/RoleRover/.codex-cargo-target/desktop-tauri" --lib
```

Results:

- All three `cargo check` runs passed.
- `cargo test --lib` passed: 13 tests passed.
- `cargo fmt --check` was not used as a completion gate because existing unrelated Rust files already have rustfmt diffs; the fix was kept scoped to `storage.rs`.

## Current Code State

The current `write_pdf_export` function in `storage.rs` now includes the final fix:

```rust
pub fn write_pdf_export(
    app: &AppHandle,
    output_path: String,
    html: String,
) -> Result<TemplateValidationExportWriteResult, String> {
    // ... resolve paths, write temp HTML ...

    if resolved_output_path.exists() {
        fs::remove_file(&resolved_output_path)?;
    }

    let user_data_dir = cache_dir.join(format!("pdf-render-profile-{timestamp}"));
    ensure_storage_directory(&user_data_dir)?;
    let html_url = file_url_from_path(&temp_html_path)?;

    let mut command = Command::new(&browser_path);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    command
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--allow-file-access-from-files")
        .arg("--run-all-compositor-stages-before-draw")
        .arg("--virtual-time-budget=12000")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--no-pdf-header-footer")
        .arg(format!("--user-data-dir={}", user_data_dir_str))
        .arg(print_argument)
        .arg(html_url);

    let output = command.output()?;
    // ... validate command status ...

    let bytes_written = wait_for_pdf_export_output(&resolved_output_path)?;
    validate_pdf_export_output(&resolved_output_path)?;

    let _ = fs::remove_file(&temp_html_path);
    let _ = fs::remove_dir_all(&user_data_dir);
}
```

## Follow-Up If This Regresses

If the issue appears again, first inspect the new error message:

- `pdf export did not produce a stable output file...` means Chrome did not finish writing the PDF within the wait window.
- `pdf export produced a non-PDF file...` means the output path exists but is not a PDF.
- `pdf export rendered Chrome's file-not-found error page...` means Chrome still loaded an error page; check whether another cleanup path removed the temporary HTML before validation completed.

Only after those checks should we investigate browser selection, environment diffs, or replacing external `--print-to-pdf` with another rendering pipeline.

## 中文笔记：以后遇到同类问题怎么排查

这类问题最容易误判的地方是：外部程序返回 `exit code 0`，并不代表业务结果正确。像 Chrome `--print-to-pdf` 这种命令，失败时也可能成功写出一个 PDF，只是里面打印的是浏览器错误页，例如 `ERR_FILE_NOT_FOUND`。所以第一步不要盯着退出码，要先确认输出文件的真实内容。

推荐排查顺序：

1. 先确认“失败产物”是什么
   - 检查 PDF 是否真的以 `%PDF-` 开头。
   - 尝试提取 PDF 文本，搜索 `ERR_FILE_NOT_FOUND`、`This site can't be reached`、`404` 等浏览器错误页文本。
   - 如果输出是错误页，说明浏览器启动成功了，但页面加载失败，不是 PDF 写入本身失败。

2. 复现时保留中间文件
   - 不要在失败路径上立刻删除临时 HTML、临时 profile、日志文件。
   - 手动用同一份 HTML 文件跑一次浏览器命令，确认 HTML 本身是否可打开。
   - 如果手动命令成功、程序内调用失败，重点看调用方是否更早清理了输入文件，或是否传了不同格式的路径。

3. 所有本地文件路径都不要手工拼 `file:///`
   - Windows 路径有盘符、空格、中文、反斜杠和特殊字符，手工拼接很容易只在部分机器上成功。
   - 在 Rust/Tauri 中优先用 `tauri::Url::from_file_path(...)`。
   - 在 JS/TS 中优先用 `new URL(...)` 或平台 API，而不是字符串替换。

4. 处理外部 GUI/浏览器进程时，要假设存在“父进程先返回，子进程还在工作”
   - `command.output()` 返回，只能说明这个进程结束了，不一定说明它启动的所有渲染/写文件工作都完成了。
   - 不要在进程返回后立刻删除输入文件。
   - 应该等目标文件出现，并等待文件大小连续稳定几次，再做读取和清理。

5. 导出前清理旧输出，避免读到上一次结果
   - 如果目标 PDF 已存在，先删除旧文件。
   - 否则浏览器没写出新文件时，程序可能误把旧文件当成本次成功结果。

6. 成功前必须做业务级校验
   - 文件存在只是第一层。
   - 文件格式正确是第二层。
   - 内容不是错误页才是第三层。
   - 只有三层都通过，才能返回“导出成功”。

7. 错误信息要让下次排查有方向
   - “未生成稳定输出文件”：优先查浏览器写文件、权限、超时。
   - “生成了非 PDF 文件”：优先查输出路径、浏览器参数、文件被其他程序覆盖。
   - “PDF 中包含 `ERR_FILE_NOT_FOUND`”：优先查输入 HTML 是否被提前删除、`file:` URL 是否正确、临时目录是否可访问。

这次的关键经验是：不要被“同一条命令在终端可行、在程序里不可行”带偏。程序调用和终端调用的差别不只有参数，还包括临时文件生命周期、当前进程退出时机、清理逻辑、工作目录、环境变量、已有输出文件等。先把这些差别逐个收窄，通常比一开始就换浏览器、换库、换架构更快。
