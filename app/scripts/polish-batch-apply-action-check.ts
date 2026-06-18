import { promises as fs } from "node:fs";
import path from "node:path";
import { buildBatchPolishRedirect, parseBatchApplySelections } from "@/features/coach/batch-apply-selection";

// 运行方式：cd app && pnpm exec tsx scripts/polish-batch-apply-action-check.ts
// （F3 只测纯函数 parseBatchApplySelections / buildBatchPolishRedirect；不调引擎、不写盘、不出网）

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "polish-batch-apply-action-check-evidence.md");

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };
const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function statusOf(url: string): string | null {
  return new URL(url, "http://localhost").searchParams.get("polishStatus");
}
function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://localhost").searchParams.get(key);
}

// A 组 合法解析
function groupA(): void {
  const items = parseBatchApplySelections(["r1:c1", "r2:c2"]);
  check("A", "解析出 2 项", items.length === 2);
  check("A", "r1:c1 正确", items[0]?.runId === "r1" && items[0]?.candidateId === "c1");
  check("A", "r2:c2 正确", items[1]?.runId === "r2" && items[1]?.candidateId === "c2");
}

// B 组 畸形丢弃
function groupB(): void {
  const items = parseBatchApplySelections(["", "r1:", ":c1", "noColon", "r2:c2"]);
  check("B", "仅保留合法项 r2:c2", items.length === 1 && items[0]?.runId === "r2" && items[0]?.candidateId === "c2", JSON.stringify(items));
}

// C 组 精确对去重
function groupC(): void {
  const items = parseBatchApplySelections(["r1:c1", "r1:c1", "r1:c2"]);
  check("C", "去重后 2 项", items.length === 2);
  check("C", "保留 r1:c1 + r1:c2", items.map((i) => i.candidateId).join(",") === "c1,c2", JSON.stringify(items));
}

// D 组 首冒号切分（防御性）
function groupD(): void {
  const items = parseBatchApplySelections(["r1:c1:extra"]);
  check("D", "按首个冒号切分", items[0]?.runId === "r1" && items[0]?.candidateId === "c1:extra", JSON.stringify(items[0]));
}

// E 组 redirect 计数编码
function groupE(): void {
  const url = buildBatchPolishRedirect("proj-1", { applied: 3, failed: 1, selected: 4 });
  check("E", "polishStatus=batch-applied", statusOf(url) === "batch-applied", url);
  check("E", "batchApplied=3", paramOf(url, "batchApplied") === "3");
  check("E", "batchFailed=1", paramOf(url, "batchFailed") === "1");
}

// F 组 空选择
function groupF(): void {
  const url = buildBatchPolishRedirect("proj-1", { applied: 0, failed: 0, selected: 0 });
  check("F", "空选择 → batch-empty", statusOf(url) === "batch-empty", url);
  check("F", "无 batchApplied 参数", paramOf(url, "batchApplied") === null);
}

// G 组 路由前缀（syncPipelinePolish 需能识别）
function groupG(): void {
  const url = buildBatchPolishRedirect("proj-1", { applied: 1, failed: 0, selected: 1 });
  check("G", "前缀 /projects/proj-1/coach/polish?", url.startsWith("/projects/proj-1/coach/polish?"), url);
}

async function writeEvidence(): Promise<void> {
  const passed = results.filter((r) => r.passed).length;
  const lines = [
    "# F3 polish-batch-apply-action-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 命令：pnpm exec tsx scripts/polish-batch-apply-action-check.ts",
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：F3 只测纯函数 parseBatchApplySelections / buildBatchPolishRedirect（不调引擎、不写盘、不出网）；",
    "  引擎 executeBatchApplyPolish 已由 B3 polish-batch-check.ts 覆盖，F3 不重测。",
    "  覆盖合法解析/畸形丢弃/精确对去重/首冒号切分/计数编码/空选择/路由前缀。",
    "",
    "| 组 | 断言 | 结果 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.group} | ${r.name} | ${r.passed ? "PASS" : "FAIL"} |`),
    "",
  ];
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  groupA();
  groupB();
  groupC();
  groupD();
  groupE();
  groupF();
  groupG();

  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("polish-batch-apply-action-check 运行失败：", error);
  process.exitCode = 1;
});
