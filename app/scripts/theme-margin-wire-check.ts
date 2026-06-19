import { promises as fs } from "node:fs";
import path from "node:path";
import {
  applyLayoutOverrides,
  createDefaultLayoutOverrides,
  normalizeLayoutOverrides,
  normalizeThemePresetId,
  type LayoutOverrides,
} from "@/features/layout/overrides";
import { applyPresetToOverrides } from "@/features/layout/theme-preset-view";
import { getLayoutThemePreset } from "@/features/layout/themes";
import { project as projectLayout } from "@/features/layout/project";
import type { LayoutSchema } from "@/features/layout/schema";
import type { ResumeDocument } from "@/features/resume/types";

// 运行方式：cd app && pnpm exec tsx scripts/theme-margin-wire-check.ts
// F6 全闭网纯函数验收：normalizeThemePresetId / applyLayoutOverrides 注入 page.marginsMm /
// applyPresetToOverrides 记录 themePresetId / project() 端到端注入。无写盘、无出网、无真实 API key。

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "theme-margin-wire-check-evidence.md");
const DEFAULT_MM = 19.8;

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };
const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

type Margins = { top: number; right: number; bottom: number; left: number };

function marginsEq(m: Margins, top: number, right: number, bottom: number, left: number): boolean {
  return m.top === top && m.right === right && m.bottom === bottom && m.left === left;
}

function uniformEq(m: Margins, v: number): boolean {
  return marginsEq(m, v, v, v, v);
}

// 手构最小 LayoutSchema（默认 19.8 ×4 边距），仅供 applyLayoutOverrides 注入测试。
function baseSchema(): LayoutSchema {
  return {
    version: "layout-v1",
    page: { size: "A4", columns: 1, marginsMm: { top: DEFAULT_MM, right: DEFAULT_MM, bottom: DEFAULT_MM, left: DEFAULT_MM } },
    theme: { fontCJK: "Noto Sans CJK SC", fontLatin: "Inter", accentColor: "#1f2937", baseFontPt: 11, lineSpacing: 1.3 },
    blocks: [],
    meta: { confirmedOnly: true, partialMode: false },
  };
}

function overridesWith(presetId?: LayoutOverrides["themePresetId"]): LayoutOverrides {
  const base = createDefaultLayoutOverrides("resume-1");
  return presetId ? { ...base, themePresetId: presetId } : base;
}

// 手构最小合法 ResumeDocument（照 storage.emptyMasterResume 范本，固定时间戳，无 IO）。
function minimalDocument(): ResumeDocument {
  return {
    schemaVersion: "resume-local-v1",
    id: "doc-f6",
    kind: "master",
    title: "F6 边距验收简历",
    basics: { name: "测试用户", links: [] },
    education: [],
    experiences: [],
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    template: { id: "ats" },
    metadata: { createdAt: "2026-06-18T00:00:00.000Z", updatedAt: "2026-06-18T00:00:00.000Z" },
  };
}

// A applyLayoutOverrides + classic → 17.8/20.3/14/20.3
function groupA(): void {
  const out = applyLayoutOverrides(baseSchema(), overridesWith("classic"));
  const m = out.page.marginsMm;
  check("A", "classic → 17.8/20.3/14/20.3", marginsEq(m, 17.8, 20.3, 14, 20.3), JSON.stringify(m));
  // 与 SSoT 一致性双锁
  const ssot = getLayoutThemePreset("classic")?.marginsMm;
  check("A", "注入值 = SSoT classic.marginsMm", JSON.stringify(m) === JSON.stringify(ssot), JSON.stringify(ssot));
}

// B compact → 14 ×4
function groupB(): void {
  const out = applyLayoutOverrides(baseSchema(), overridesWith("compact"));
  check("B", "compact → 14 ×4", uniformEq(out.page.marginsMm, 14), JSON.stringify(out.page.marginsMm));
}

// C clean（无 marginsMm）→ 默认 19.8
function groupC(): void {
  const out = applyLayoutOverrides(baseSchema(), overridesWith("clean"));
  check("C", "clean → 默认 19.8", uniformEq(out.page.marginsMm, DEFAULT_MM), JSON.stringify(out.page.marginsMm));
}

// D 无 themePresetId → 默认 19.8
function groupD(): void {
  const out = applyLayoutOverrides(baseSchema(), overridesWith(undefined));
  check("D", "无 presetId → 默认 19.8", uniformEq(out.page.marginsMm, DEFAULT_MM), JSON.stringify(out.page.marginsMm));
}

// E normalize 白名单
function groupE(): void {
  check("E", "classic 保留", normalizeThemePresetId("classic") === "classic");
  check("E", "compact 保留", normalizeThemePresetId("compact") === "compact");
  check("E", "clean 保留", normalizeThemePresetId("clean") === "clean");
  check("E", "空串 → undefined", normalizeThemePresetId("") === undefined);
  check("E", '"foo" → undefined', normalizeThemePresetId("foo") === undefined);
  check("E", "数字 → undefined", normalizeThemePresetId(3) === undefined);
  check("E", "undefined → undefined", normalizeThemePresetId(undefined) === undefined);
  check("E", "对象 → undefined", normalizeThemePresetId({ id: "classic" }) === undefined);
  // normalizeLayoutOverrides 端到端白名单
  const ok = normalizeLayoutOverrides({ version: "layout-overrides-v1", resumeId: "r", themePresetId: "classic" }, "r");
  check("E", "normalize 保留合法 presetId", ok.themePresetId === "classic", JSON.stringify(ok.themePresetId));
  const bad = normalizeLayoutOverrides({ version: "layout-overrides-v1", resumeId: "r", themePresetId: "evil" }, "r");
  check("E", "normalize 丢弃非法 presetId", bad.themePresetId === undefined, JSON.stringify(bad.themePresetId));
}

// F applyPresetToOverrides 记录 presetId
function groupF(): void {
  const classic = applyPresetToOverrides(createDefaultLayoutOverrides("r"), getLayoutThemePreset("classic")!);
  check("F", "套 classic → themePresetId=classic", classic.themePresetId === "classic", JSON.stringify(classic.themePresetId));
  check("F", "套 classic → theme.fontCJK=SimSun", classic.theme?.fontCJK === "SimSun");
  const clean = applyPresetToOverrides(createDefaultLayoutOverrides("r"), getLayoutThemePreset("clean")!);
  check("F", "套 clean → themePresetId=clean", clean.themePresetId === "clean", JSON.stringify(clean.themePresetId));
  check("F", "套 clean → theme 字段被删", !("theme" in clean), JSON.stringify(clean));
}

// G project() 端到端注入
function groupG(): void {
  const doc = minimalDocument();
  const compact = projectLayout(doc, overridesWith("compact"));
  check("G", "project(compact).page.marginsMm = 14 ×4", uniformEq(compact.schema.page.marginsMm, 14), JSON.stringify(compact.schema.page.marginsMm));
  const none = projectLayout(doc, overridesWith(undefined));
  check("G", "project(无 presetId) → 默认 19.8", uniformEq(none.schema.page.marginsMm, DEFAULT_MM), JSON.stringify(none.schema.page.marginsMm));
  const bare = projectLayout(doc, undefined);
  check("G", "project(无 overrides) → 默认 19.8", uniformEq(bare.schema.page.marginsMm, DEFAULT_MM), JSON.stringify(bare.schema.page.marginsMm));
}

// H 不可变
function groupH(): void {
  const schema = baseSchema();
  const schemaSnap = JSON.stringify(schema);
  const ov = overridesWith("compact");
  const ovSnap = JSON.stringify(ov);
  applyLayoutOverrides(schema, ov);
  check("H", "applyLayoutOverrides 不改输入 schema", JSON.stringify(schema) === schemaSnap);
  check("H", "applyLayoutOverrides 不改输入 overrides", JSON.stringify(ov) === ovSnap);

  const base = createDefaultLayoutOverrides("r");
  const baseSnap = JSON.stringify(base);
  applyPresetToOverrides(base, getLayoutThemePreset("classic")!);
  check("H", "applyPresetToOverrides 不改输入 overrides", JSON.stringify(base) === baseSnap);
}

async function writeEvidence(): Promise<void> {
  const passed = results.filter((r) => r.passed).length;
  const lines = [
    "# F6 theme-margin-wire-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 命令：pnpm exec tsx scripts/theme-margin-wire-check.ts",
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：F6 全闭网纯函数验收（无写盘、无出网、无真实 API key）。",
    "  覆盖：applyLayoutOverrides 按 themePresetId 注入 page.marginsMm（classic/compact 覆盖、clean/缺省/非法回默认）；",
    "  normalizeThemePresetId + normalizeLayoutOverrides 白名单清洗；applyPresetToOverrides 记录 themePresetId；",
    "  project() 端到端注入（手构最小 ResumeDocument）；applyLayoutOverrides / applyPresetToOverrides 不可变。",
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

  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("theme-margin-wire-check 运行失败：", error);
  process.exitCode = 1;
});
