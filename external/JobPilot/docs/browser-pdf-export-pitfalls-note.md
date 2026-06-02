# 别被 exit code 0 骗了：一次浏览器 PDF 导出踩坑复盘

很多应用都会遇到一个看起来很简单的需求：把一段 HTML 导出成 PDF。最常见的做法之一，是启动 Chrome、Edge 或 Chromium 的 headless 模式，然后使用 `--print-to-pdf` 把页面打印成 PDF。

这条路通常很好用，直到你遇到一种很迷惑的问题：

- 程序没有报错。
- 浏览器进程返回 `exit code 0`。
- 目标 PDF 文件也确实生成了。
- 但打开 PDF 一看，里面不是你的页面，而是浏览器自己的错误页，比如 `ERR_FILE_NOT_FOUND`。

这类问题最容易浪费时间，因为它会制造一种假象：既然退出码是 0，文件也生成了，那问题应该在 HTML 内容、CSS、字体、PDF 渲染能力或者浏览器版本上。实际上，真正的问题可能更基础：浏览器根本没有成功加载到你给它的 HTML。

## 典型现象

假设你的程序做了这些事情：

1. 生成一份临时 HTML 文件。
2. 启动 Chrome headless。
3. 传入 `--print-to-pdf=output.pdf`。
4. 把临时 HTML 文件路径作为最后一个参数。
5. 等 Chrome 进程退出。
6. 删除临时 HTML。
7. 返回“导出成功”。

日志看起来可能很漂亮：

```text
browser=C:\Program Files\Google\Chrome\Application\chrome.exe
html=C:\Users\you\AppData\Local\Temp\export.html
pdf=D:\resume.pdf
status=exit code: 0
stdout=<empty>
stderr=<empty>
```

但生成的 PDF 里只有：

```text
ERR_FILE_NOT_FOUND
```

如果你把同一条 Chrome 命令复制到终端里手动运行，它又可能是成功的。这就更容易把人带偏：难道是程序启动进程的环境变量不同？工作目录不同？权限不同？Chrome profile 被复用？stdout/stderr 管道影响行为？

这些方向都可能有价值，但别急着一头扎进去。先抓住最关键的一点：**退出码和文件存在，不等于业务成功。**

## 核心坑：浏览器返回了，不代表渲染链路真的结束了

Chrome/Edge 这类浏览器不是一个简单的单进程命令行工具。它们可能会启动多个子进程，也可能把工作交给已有实例或独立的渲染进程。

所以，当你的代码里 `command.output()`、`child.wait()` 或类似 API 返回时，只能说明你等待的那个进程结束了，不能天然推出：

- 页面已经完成加载。
- PDF 已经完全写入。
- 浏览器内部所有相关子进程都已经结束。
- 临时 HTML 文件已经不再被需要。

如果你在浏览器进程返回后立刻删除临时 HTML，就可能发生这样的时序：

```text
程序写入 temp.html
程序启动 chrome.exe --print-to-pdf=out.pdf file:///.../temp.html
chrome.exe 启动/转交渲染任务
chrome.exe 返回 exit code 0
程序立刻删除 temp.html
渲染进程稍后尝试加载 temp.html
文件已经没了
浏览器生成 ERR_FILE_NOT_FOUND 错误页 PDF
程序看到 out.pdf 存在，于是返回成功
```

这也解释了为什么“同一条命令在终端里跑成功，在程序里跑失败”：终端测试时，临时 HTML 文件通常不会被你立刻删除；程序调用时，清理逻辑可能抢在浏览器真正读取文件之前发生。

## 第二个坑：不要手工拼 `file:///`

另一个常见问题是手工把路径拼成 file URL：

```text
file:///C:/Users/you/AppData/Local/Temp/export.html
```

这个例子看起来没问题，但现实里的路径可能包含：

- 空格
- 中文
- `#`
- `%`
- `?`
- 反斜杠
- Windows 盘符
- UNC 路径

一旦你用字符串替换或拼接，很容易只在你的机器上能跑，换一台机器就失败。

更稳妥的做法是使用语言或框架提供的 URL API。

Rust 示例：

```rust
let html_url = url::Url::from_file_path(&temp_html_path)
    .map_err(|()| "failed to convert temp html path to file URL")?
    .to_string();
```

Tauri 中也可以使用其重导出的 `Url`：

```rust
let html_url = tauri::Url::from_file_path(&temp_html_path)
    .map_err(|()| "failed to convert temp html path to file URL")?
    .to_string();
```

Node.js 示例：

```js
import { pathToFileURL } from "node:url";

const htmlUrl = pathToFileURL(tempHtmlPath).toString();
```

原则很简单：**本地路径转 URL，不要自己拼。**

## 第三个坑：旧输出文件会制造假阳性

如果目标 PDF 已经存在，而这次浏览器没有成功写出新文件，程序可能会误读旧文件，然后以为这次导出成功。

所以导出前最好先处理旧文件：

```rust
if output_path.exists() {
    std::fs::remove_file(&output_path)?;
}
```

这样如果浏览器没有产生新 PDF，你会立刻得到“没有生成输出文件”的错误，而不是拿上一次的文件糊弄自己。

## 正确姿势：成功前做三层校验

一个更可靠的导出流程应该长这样：

1. 写入临时 HTML。
2. 把临时 HTML 路径转换成标准 `file:` URL。
3. 删除旧的目标 PDF。
4. 启动浏览器 headless 打印 PDF。
5. 等待浏览器进程返回。
6. 等待目标 PDF 文件出现。
7. 等待 PDF 文件大小连续稳定。
8. 校验输出文件确实是 PDF。
9. 尝试提取 PDF 文本，检查是否包含浏览器错误页。
10. 确认无误后，再删除临时 HTML 和临时 profile。
11. 返回成功。

这里的关键不是“等一个固定秒数”，而是等待一个可观察条件：输出文件存在，并且大小稳定。

示例伪代码：

```rust
fn wait_for_stable_file(path: &Path) -> Result<u64, String> {
    let deadline = Instant::now() + Duration::from_secs(8);
    let mut last_size = None;
    let mut stable_count = 0;

    while Instant::now() < deadline {
        if let Ok(metadata) = std::fs::metadata(path) {
            let size = metadata.len();

            if size > 0 && Some(size) == last_size {
                stable_count += 1;
                if stable_count >= 3 {
                    return Ok(size);
                }
            } else {
                last_size = Some(size);
                stable_count = 0;
            }
        }

        std::thread::sleep(Duration::from_millis(150));
    }

    Err("PDF output did not become stable in time".into())
}
```

然后做文件格式校验：

```rust
let bytes = std::fs::read(&output_path)?;

if !bytes.starts_with(b"%PDF-") {
    return Err("output file is not a PDF".into());
}
```

如果你的项目里已经有 PDF 文本提取能力，还可以进一步检查错误页文本：

```rust
let text = extract_text_from_pdf(&bytes)?;

if text.contains("ERR_FILE_NOT_FOUND") {
    return Err("browser rendered a file-not-found error page".into());
}
```

这一层非常重要。因为“错误页 PDF”也是 PDF，文件头也是 `%PDF-`，只看格式仍然会误判成功。

## Chrome/Edge PDF 导出的建议参数

常见参数可以这样组织：

```text
--headless=new
--disable-gpu
--allow-file-access-from-files
--run-all-compositor-stages-before-draw
--virtual-time-budget=12000
--no-first-run
--no-default-browser-check
--no-pdf-header-footer
--user-data-dir=<unique-temp-profile>
--print-to-pdf=<output-pdf-path>
<input-file-url>
```

几个注意点：

- `--user-data-dir` 尽量使用每次导出唯一的临时目录，避免被已有浏览器实例或 profile 锁影响。
- Windows 下如果你从 GUI 应用里启动浏览器，可以考虑 `CREATE_NO_WINDOW`，避免弹出多余窗口。
- `--print-to-pdf` 的输出路径建议使用浏览器可接受的绝对路径。
- 输入 HTML 建议传标准 `file:` URL，而不是裸路径或手工拼接字符串。

## 排查清单

遇到“程序调用失败、终端手动成功”的 PDF 导出问题，可以按这个顺序查：

1. 输出 PDF 里到底是什么？
   - 是真实内容？
   - 是空白页？
   - 是浏览器错误页？
   - 是旧文件？

2. 临时 HTML 在浏览器真正读取前还存在吗？
   - 先临时禁用清理逻辑。
   - 保留 HTML 文件，手动打开确认。
   - 不要在浏览器进程刚返回时立刻删除。

3. 输入路径是不是标准 `file:` URL？
   - 不要手工拼 `file:///`。
   - 用 `Url::from_file_path`、`pathToFileURL` 等 API。

4. 输出文件是不是本次新生成的？
   - 导出前删除旧输出。
   - 检查文件修改时间。
   - 检查文件大小是否变化。

5. 是否等待了 PDF 写入稳定？
   - 不要只等进程退出。
   - 等文件存在。
   - 等文件大小连续稳定。

6. 是否做了业务级成功校验？
   - 文件存在。
   - 文件是 PDF。
   - 文件内容不是错误页。

7. 是否有浏览器实例/profile 干扰？
   - 使用唯一 `--user-data-dir`。
   - 清理临时 profile。
   - 避免复用含有 `SingletonLock` 等锁文件的目录。

8. 是否有权限或安全策略问题？
   - 输出目录是否可写？
   - 临时目录是否可读？
   - 杀毒软件或安全软件是否拦截？
   - 路径中是否有特殊字符？

## 一句话经验

外部程序返回成功，只能说明“它觉得自己完成了”。你的程序要判断的是“业务结果真的正确”。对于 HTML 转 PDF 这种链路，至少要确认：

- 浏览器加载到了正确输入。
- 输出文件是本次生成的。
- 文件写入已经稳定。
- PDF 内容不是浏览器错误页。

不要把 `exit code 0` 当成终点。它只是排查的起点。
