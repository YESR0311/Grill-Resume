import { promises as fs } from "node:fs";
import path from "node:path";
import { applyPresetToOverrides, summarizeThemePreset } from "@/features/layout/theme-preset-view";
import { getLayoutThemePreset, layoutThemePresets } from "@/features/layout/themes";
import { createDefaultLayoutOverrides, type LayoutOverrides } from "@/features/layout/overrides";
import type { LayoutThemePreset } from "@/features/layout/themes";

// 运行方式：cd app && pnpm exec tsx scripts/theme-preset-view-check.ts
// （F5 只测纯函数 summarizeThemePreset / applyPresetToOverrides；不调写盘 action、不出网。
//  写盘清洗由 saveLayoutOverridesAction + normalizeLayoutOverrides 既有路径覆盖，F5 不重测。）

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "theme-preset-view-check-evidence.md");

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };
const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function preset(id: string): LayoutThemePreset {
  const found = getLayoutThemePreset(id);
  if (!found) throw new Error(`preset 不存在: ${id}`);
  return found;
}

// A 组 clean 空 theme → ["默认排版"]
function groupA(): void {
  const chips = summarizeThemePreset(preset("clean"));
  check("A", "clean → 默认排版", chips.length === 1 && chips[0] === "默认排版", JSON.stringify(chips));
}

// B 组 classic 完整摘要
function groupB(): void {
  const chips = summarizeThemePreset(preset("classic"));
  check("B", "含 正文 SimSun", chips.includes("正文 SimSun"), JSON.stringify(chips));
  check("B", "含 标题 SimHei", chips.includes("标题 SimHei"));
  check("B", "含 西文 Times New Roman", chips.includes("西文 Times New Roman"));
  check("B", "含 11pt", chips.includes("11pt"));
  check("B", "含 行距 1.2", chips.includes("行距 1.2"));
}

// C 组 compact 摘要（无字体字段）
function groupC(): void {
  const chips = summarizeThemePreset(preset("compact"));
  check("C", "含 10pt", chips.includes("10pt"), JSON.stringify(chips));
  check("C", "含 行距 1.12", chips.includes("行距 1.12"));
  check("C", "不含字体 chip", !chips.some((c) => c.startsWith("正文") || c.startsWith("标题") || c.startsWith("西文")));
}

// D 组 applyPresetToOverrides classic → theme 整体为 classic 套装
function groupD(): void {
  const base = createDefaultLayoutOverrides("resume-1");
  const next = applyPresetToOverrides(base, preset("classic"));
  check("D", "theme.fontCJK=SimSun", next.theme?.fontCJK === "SimSun", JSON.stringify(next.theme));
  check("D", "theme.fontCJKHeading=SimHei", next.theme?.fontCJKHeading === "SimHei");
  check("D", "theme.baseFontPt=11", next.theme?.baseFontPt === 11);
}

// E 组 clean（空 theme）→ theme 字段被删除
function groupE(): void {
  const base: LayoutOverrides = { ...createDefaultLayoutOverrides("resume-1"), theme: { accentColor: "#123456" } };
  const next = applyPresetToOverrides(base, preset("clean"));
  check("E", "clean → 无 theme 字段", !("theme" in next), JSON.stringify(next));
}

// F 组 整体替换：先手调 accentColor，套 classic 后不残留
function groupF(): void {
  const base: LayoutOverrides = {
    ...createDefaultLayoutOverrides("resume-1"),
    theme: { accentColor: "#ff0000", fontLatin: "Arial" },
  };
  const next = applyPresetToOverrides(base, preset("classic"));
  check("F", "accentColor 不残留", next.theme?.accentColor === undefined, JSON.stringify(next.theme));
  check("F", "fontLatin 被 classic 覆盖", next.theme?.fontLatin === "Times New Roman");
}

// G 组 保留非 theme 字段
function groupG(): void {
  const base: LayoutOverrides = {
    ...createDefaultLayoutOverrides("resume-1"),
    blockOrder: ["experience:e1", "profile"],
    hiddenBlocks: ["skills"],
    bulletOverrides: { b1: "改写后的要点" },
  };
  const next = applyPresetToOverrides(base, preset("compact"));
  check("G", "blockOrder 保留", JSON.stringify(next.blockOrder) === JSON.stringify(["experience:e1", "profile"]));
  check("G", "hiddenBlocks 保留", JSON.stringify(next.hiddenBlocks) === JSON.stringify(["skills"]));
  check("G", "bulletOverrides 保留", next.bulletOverrides?.b1 === "改写后的要点");
}

// H 组 不可变：不改输入 overrides
function groupH(): void {
  const base: LayoutOverrides = { ...createDefaultLayoutOverrides("resume-1"), theme: { accentColor: "#abcdef" } };
  const snapshot = JSON.stringify(base);
  applyPresetToOverrides(base, preset("classic"));
  check("H", "输入 overrides 未被改动", JSON.stringify(base) === snapshot, JSON.stringify(base));
}

// I 组 SSoT 完整性：themes.ts 恰好三套预设（孤立 ats/formal 已废弃）
function groupI(): void {
  const ids = layoutThemePresets.map((p) => p.id).sort();
  check("I", "预设为 clean/classic/compact", JSON.stringify(ids) === JSON.stringify(["classic", "clean", "compact"]), JSON.stringify(ids));
}

async function writeEvidence(): Promise<void> {
  const passed = results.filter((r) => r.passed).length;
  const lines = [
    "# F5 theme-preset-view-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 命令：pnpm exec tsx scripts/theme-preset-view-check.ts",
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：F5 只测纯函数 summarizeThemePreset / applyPresetToOverrides（不调写盘 action、不出网）。",
    "  写盘清洗（normalizeLayoutOverrides 钳制 + 证据校验）由既有 saveLayoutOverridesAction 路径覆盖，F5 不重测。",
    "  覆盖摘要派生（clean/classic/compact）/整体替换/删 theme 字段/不残留手调/保留非 theme 字段/不可变/SSoT 完整性。",
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
  groupH();
  groupI();

  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("theme-preset-view-check 运行失败：", error);
  process.exitCode = 1;
});
