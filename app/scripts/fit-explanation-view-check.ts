import { promises as fs } from "node:fs";
import path from "node:path";
import { buildFitExplanation } from "@/features/coach/fit-explanation-view";
import type { FitDecision } from "@/features/layout/adapter";
import type { LayoutBlock } from "@/features/layout/schema";

// 运行方式：cd app && pnpm exec tsx scripts/fit-explanation-view-check.ts
// （F4 只测纯函数 buildFitExplanation；不调 B4 引擎、不写盘、不出网。B4 适配引擎由其自身验收覆盖。）

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "fit-explanation-view-check-evidence.md");

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };
const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---- 测试夹具 ----
function expBlock(id: string, org: string, role: string): LayoutBlock {
  return { kind: "experience", id, org, role, period: "2020-2023", bullets: [] };
}
function projBlock(id: string, name: string): LayoutBlock {
  return { kind: "project", id, name, details: [], bullets: [] };
}
function eduBlock(id: string, org: string, degree?: string): LayoutBlock {
  return { kind: "education", id, org, degree, period: "2016-2020", notes: [] };
}
function trim(blockId: string, removed: string[], tier: FitDecision["tier"]): FitDecision {
  return { action: "trim-bullets", blockId, removedBulletIds: removed, tier };
}
function hide(blockId: string, tier: FitDecision["tier"]): FitDecision {
  return { action: "hide-block", blockId, removedBulletIds: [], tier };
}

const BLOCKS: LayoutBlock[] = [
  expBlock("exp-1", "字节跳动", "后端工程师"),
  expBlock("exp-2", "腾讯", "前端工程师"),
  projBlock("proj-1", "开源简历生成器"),
  eduBlock("edu-1", "清华大学", "硕士"),
  eduBlock("edu-2", "北京大学"),
];

// A 组 空决策
function groupA(): void {
  const view = buildFitExplanation({ decisions: [], blocks: BLOCKS });
  check("A", "hasAdaptation=false", view.hasAdaptation === false);
  check("A", "items 空", view.items.length === 0);
  check("A", "计数全 0", view.trimmedBulletTotal === 0 && view.hiddenBlockTotal === 0);
}

// B 组 trim-bullets 单条
function groupB(): void {
  const view = buildFitExplanation({ decisions: [trim("exp-1", ["b1", "b2"], "low")], blocks: BLOCKS });
  const it = view.items[0];
  check("B", "removedCount=2", it?.removedCount === 2);
  check("B", "label=字节跳动 · 后端工程师", it?.blockLabel === "字节跳动 · 后端工程师", it?.blockLabel);
  check("B", "kind=experience", it?.blockKind === "experience");
  check("B", "trimmedBulletTotal=2", view.trimmedBulletTotal === 2);
}

// C 组 hide-block 单条
function groupC(): void {
  const view = buildFitExplanation({ decisions: [hide("proj-1", "medium")], blocks: BLOCKS });
  const it = view.items[0];
  check("C", "removedCount=0", it?.removedCount === 0);
  check("C", "hiddenBlockTotal=1", view.hiddenBlockTotal === 1);
  check("C", "label=开源简历生成器", it?.blockLabel === "开源简历生成器", it?.blockLabel);
  check("C", "trimmedBulletTotal=0", view.trimmedBulletTotal === 0);
}

// D 组 trim+hide 混合汇总
function groupD(): void {
  const view = buildFitExplanation({
    decisions: [trim("exp-1", ["b1", "b2", "b3"], "low"), hide("exp-2", "low"), trim("proj-1", ["b4"], "high")],
    blocks: BLOCKS,
  });
  check("D", "trimmedBulletTotal=4", view.trimmedBulletTotal === 4, String(view.trimmedBulletTotal));
  check("D", "hiddenBlockTotal=1", view.hiddenBlockTotal === 1);
  check("D", "items=3", view.items.length === 3);
  check("D", "hasAdaptation=true", view.hasAdaptation === true);
}

// E 组 排序：hide-block 优先 → removedCount 降序 → blockId 兜底
function groupE(): void {
  const view = buildFitExplanation({
    decisions: [trim("exp-1", ["b1"], "low"), trim("proj-1", ["b1", "b2", "b3"], "low"), hide("edu-1", "low")],
    blocks: BLOCKS,
  });
  check("E", "首项为 hide-block", view.items[0]?.action === "hide-block", view.items[0]?.action);
  check("E", "次项 removedCount 多者在前", view.items[1]?.blockId === "proj-1", view.items[1]?.blockId);
  check("E", "末项 removedCount 少者在后", view.items[2]?.blockId === "exp-1", view.items[2]?.blockId);
}

// E2 组 同动作同 removedCount → blockId 字典序
function groupE2(): void {
  const view = buildFitExplanation({
    decisions: [trim("exp-2", ["b1"], "low"), trim("exp-1", ["b1"], "low")],
    blocks: BLOCKS,
  });
  check("E2", "同数量按 blockId 字典序 exp-1 在前", view.items[0]?.blockId === "exp-1", view.items[0]?.blockId);
}

// F 组 block 名映射（experience / project / education 各形态）
function groupF(): void {
  const view = buildFitExplanation({
    decisions: [hide("exp-1", "high"), hide("proj-1", "high"), hide("edu-1", "high"), hide("edu-2", "high")],
    blocks: BLOCKS,
  });
  const byId = new Map(view.items.map((i) => [i.blockId, i]));
  check("F", "experience=org · role", byId.get("exp-1")?.blockLabel === "字节跳动 · 后端工程师");
  check("F", "project=name", byId.get("proj-1")?.blockLabel === "开源简历生成器");
  check("F", "education 带 degree=org · degree", byId.get("edu-1")?.blockLabel === "清华大学 · 硕士", byId.get("edu-1")?.blockLabel);
  check("F", "education 无 degree=org", byId.get("edu-2")?.blockLabel === "北京大学", byId.get("edu-2")?.blockLabel);
}

// G 组 未知 blockId 兜底
function groupG(): void {
  const view = buildFitExplanation({ decisions: [trim("ghost-99", ["b1"], "unrated")], blocks: BLOCKS });
  const it = view.items[0];
  check("G", "label=未知板块", it?.blockLabel === "未知板块", it?.blockLabel);
  check("G", "kind=unknown", it?.blockKind === "unknown");
  check("G", "仍计入裁剪数", view.trimmedBulletTotal === 1);
}

// H 组 不可变（输入 decisions 不被原地排序）
function groupH(): void {
  const decisions = [trim("exp-1", ["b1"], "low"), hide("exp-2", "low")];
  const before = decisions.map((d) => d.action).join(",");
  buildFitExplanation({ decisions, blocks: BLOCKS });
  const after = decisions.map((d) => d.action).join(",");
  check("H", "输入数组顺序未被改动", before === after, `${before} -> ${after}`);
}

async function writeEvidence(): Promise<void> {
  const passed = results.filter((r) => r.passed).length;
  const lines = [
    "# F4 fit-explanation-view-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 命令：pnpm exec tsx scripts/fit-explanation-view-check.ts",
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：F4 只测纯函数 buildFitExplanation（不调 B4 引擎、不写盘、不出网）。",
    "  覆盖空决策/trim/hide/混合汇总/排序/block 名映射/未知 id 兜底/不可变。",
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
  groupE2();
  groupF();
  groupG();
  groupH();

  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("fit-explanation-view-check 运行失败：", error);
  process.exitCode = 1;
});
