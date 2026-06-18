import { promises as fs } from "node:fs";
import path from "node:path";
import { buildPolishRunsView } from "@/app/projects/[projectId]/coach/polish/polish-runs-view";
import type { PolishRun } from "@/features/polish/store";

// 运行方式：cd app && pnpm exec tsx scripts/polish-runs-view-check.ts
// （F2 只测纯函数 buildPolishRunsView，不渲染 React、不出网、不读文件；预计无需 --conditions=react-server）

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "polish-runs-view-check-evidence.md");

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };
const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

let seq = 0;
function run(over: Partial<PolishRun>): PolishRun {
  seq += 1;
  return {
    schemaVersion: "polish-run-v1",
    id: `run-${seq}`,
    projectId: "proj-1",
    resumeId: "resume-1",
    experienceId: "exp-1",
    sourceBulletId: `bullet-${seq}`,
    sourceBulletText: "主导核心系统重构，QPS 提升 3 倍。",
    sourceEvidenceIds: ["ev-1"],
    candidates: [
      { id: "c1", tone: "conservative", text: "a", rationale: "r", structure: {}, lowConfidence: false, status: "ready" },
      { id: "c2", tone: "balanced", text: "b", rationale: "r", structure: {}, lowConfidence: false, status: "ready" },
      { id: "c3", tone: "aggressive", text: "c", rationale: "r", structure: {}, lowConfidence: false, status: "ready" },
    ],
    createdAt: "2026-06-18T00:00:00.000Z",
    ...over,
  };
}

// A 组 空态
function groupA(): void {
  const view = buildPolishRunsView({ runs: [] });
  check("A", "空 runs → total=0", view.total === 0);
  check("A", "tierCounts 全 0", view.tierCounts.high === 0 && view.tierCounts.medium === 0 && view.tierCounts.low === 0 && view.tierCounts.untiered === 0);
  check("A", "runs 为空数组", Array.isArray(view.runs) && view.runs.length === 0);
}

// B 组 tier 排序
function groupB(): void {
  const view = buildPolishRunsView({
    runs: [
      run({ valueTier: "low" }),
      run({ valueTier: "high" }),
      run({ valueTier: undefined }),
      run({ valueTier: "medium" }),
    ],
  });
  const seqTiers = view.runs.map((v) => v.tier).join(",");
  check("B", "排序为 high,medium,low,untiered", seqTiers === "high,medium,low,untiered", seqTiers);
}

// C 组 组内 createdAt 倒序
function groupC(): void {
  const older = run({ valueTier: "high", createdAt: "2026-06-18T01:00:00.000Z" });
  const newer = run({ valueTier: "high", createdAt: "2026-06-18T05:00:00.000Z" });
  const view = buildPolishRunsView({ runs: [older, newer] });
  check("C", "同 tier 内新在前", view.runs[0]?.run.createdAt === newer.createdAt && view.runs[1]?.run.createdAt === older.createdAt);
}

// D 组 计数
function groupD(): void {
  const view = buildPolishRunsView({
    runs: [
      run({ valueTier: "high" }),
      run({ valueTier: "high" }),
      run({ valueTier: "high" }),
      run({ valueTier: "medium" }),
      run({ valueTier: "low" }),
      run({ valueTier: "low" }),
      run({ valueTier: undefined }),
    ],
  });
  check("D", "tierCounts high=3", view.tierCounts.high === 3);
  check("D", "tierCounts medium=1", view.tierCounts.medium === 1);
  check("D", "tierCounts low=2", view.tierCounts.low === 2);
  check("D", "tierCounts untiered=1", view.tierCounts.untiered === 1);
  check("D", "total=7", view.total === 7);
}

// E 组 untiered 降级
function groupE(): void {
  const view = buildPolishRunsView({ runs: [run({ valueTier: undefined })] });
  check("E", "valueTier 缺省 → tier=untiered", view.runs[0]?.tier === "untiered");
  check("E", "不丢行", view.runs.length === 1);
  check("E", "计入 untiered", view.tierCounts.untiered === 1);
}

// F 组 不 mutate 入参
function groupF(): void {
  const input = [run({ valueTier: "low", id: "first" }), run({ valueTier: "high", id: "second" })];
  const before = input.map((r) => r.id).join(",");
  buildPolishRunsView({ runs: input });
  const after = input.map((r) => r.id).join(",");
  check("F", "原入参数组顺序未被 mutate", before === after && after === "first,second", after);
}

async function writeEvidence(): Promise<void> {
  const passed = results.filter((r) => r.passed).length;
  const lines = [
    "# F2 polish-runs-view-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 命令：pnpm exec tsx scripts/polish-runs-view-check.ts",
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：F2 只测纯函数 buildPolishRunsView（不渲染 React、不出网、不读文件）；",
    "  覆盖空态/tier 排序/组内时间倒序/计数/untiered 降级/不 mutate 入参。",
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

  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("polish-runs-view-check 运行失败：", error);
  process.exitCode = 1;
});
