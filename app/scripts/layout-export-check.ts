import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { estimateSchemaLines, fitToSinglePage } from "@/features/layout/adapter";
import { normalizeLayoutOverrides } from "@/features/layout/overrides";
import { project as projectLayout } from "@/features/layout/project";
import type { LayoutBlock, LayoutBullet, LayoutSchema, LayoutTheme } from "@/features/layout/schema";
import { getLayoutThemePreset, layoutThemePresets } from "@/features/layout/themes";
import { buildZhCleanDocx } from "@/features/export/templates/zh-clean";
import { renderExport } from "@/features/export/render";
import { pipelineToExport, buildPipelineExportSnapshot } from "@/features/pipeline/pipeline-exporter";
import { pipelineExportSnapshotSchema, type EvaluationSummary } from "@/features/pipeline/types";
import { createProject, getProjectResume, updateResumeSections } from "@/features/resume/storage";
import type { Experience, ExportFormat } from "@/features/resume/types";

// 运行方式：cd app && pnpm exec tsx --conditions=react-server scripts/layout-export-check.ts
// （与 polish-batch-check.ts 同惯例；依赖 cwd = app/）
// docx 机检经 python3 zipfile 解包 word/document.xml（环境已有 python3，不引 npm 依赖）；
// docx 产物写入本地 .workspace（gitignored），证据只记录路径。

const execFileAsync = promisify(execFile);
const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "layout-export-check-evidence.md");
const ARTIFACT_DIR = path.resolve(APP_ROOT, ".workspace", "layout-export-check");
const FIXED_NOW = "2026-06-12T08:00:00.000Z";

type CheckResult = {
  group: string;
  name: string;
  passed: boolean;
  detail?: string;
};

const results: CheckResult[] = [];
const evidenceNotes: string[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// 与 zh-clean.ts 同公式；design 原文写 19.8mm → 1122 为笔误，Math.round(1122.52) = 1123。
function mmToTwips(mm: number): number {
  return Math.round((mm / 25.4) * 1440);
}

// ---------- docx 机检 ----------

async function docxXml(buffer: Buffer, name: string): Promise<string> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, name);
  await fs.writeFile(file, buffer);
  const { stdout } = await execFileAsync("python3", [
    "-c",
    "import zipfile,sys; sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode('utf-8'))",
    file,
  ]);
  return stdout;
}

function runSegmentWith(xml: string, text: string): string | undefined {
  return xml.split("<w:r>").find((segment) => segment.includes(text));
}

function eastAsiaOf(segment: string | undefined): string | undefined {
  return segment ? /w:eastAsia="([^"]+)"/.exec(segment)?.[1] : undefined;
}

function sizeOf(segment: string | undefined): string | undefined {
  return segment ? /<w:sz w:val="([0-9]+)"/.exec(segment)?.[1] : undefined;
}

function allEastAsia(xml: string): Set<string> {
  return new Set([...xml.matchAll(/w:eastAsia="([^"]+)"/g)].map((match) => match[1]!));
}

function pageMargins(xml: string): { top?: string; right?: string; bottom?: string; left?: string } {
  const tag = /<w:pgMar[^>]*>/.exec(xml)?.[0] ?? "";
  return {
    top: /w:top="(-?\d+)"/.exec(tag)?.[1],
    right: /w:right="(-?\d+)"/.exec(tag)?.[1],
    bottom: /w:bottom="(-?\d+)"/.exec(tag)?.[1],
    left: /w:left="(-?\d+)"/.exec(tag)?.[1],
  };
}

// ---------- fixtures ----------

function makeBullets(prefix: string, texts: string[]): LayoutBullet[] {
  return texts.map((text, index) => ({
    bulletId: `${prefix}-b${index + 1}`,
    text,
    sourceEvidenceIds: [],
  }));
}

function expBlock(id: string, bulletCount: number): Extract<LayoutBlock, { kind: "experience" }> {
  return {
    kind: "experience",
    id,
    org: `${id} 公司`,
    role: "前端工程师",
    period: "2022.07 - 至今",
    bullets: makeBullets(
      id,
      Array.from({ length: bulletCount }, (_, index) => `负责核心模块第${index + 1}项交付`),
    ),
  };
}

function makeSchema(input: {
  theme?: Partial<LayoutTheme>;
  marginsMm?: { top: number; right: number; bottom: number; left: number };
  blocks?: LayoutBlock[];
}): LayoutSchema {
  return {
    version: "layout-v1",
    page: {
      size: "A4",
      columns: 1,
      marginsMm: input.marginsMm ?? { top: 19.8, right: 19.8, bottom: 19.8, left: 19.8 },
    },
    theme: {
      fontCJK: "Microsoft YaHei",
      fontLatin: "Calibri",
      accentColor: "#2F6F73",
      baseFontPt: 10.5,
      lineSpacing: 1.15,
      ...input.theme,
    },
    blocks: input.blocks ?? [
      { kind: "header", name: "张三", targetRole: "前端工程师", metaLines: [], contacts: ["zhangsan@example.com"] },
      { kind: "section-title", en: "EXPERIENCE", zh: "工作经历" },
      expBlock("exp-fixture", 2),
    ],
    meta: { confirmedOnly: true, partialMode: false },
  };
}

function makeExperience(id: string, organization: string, bulletTexts: string[]): Experience {
  return {
    id,
    organization,
    role: "前端工程师",
    location: "上海",
    startDate: "2022.07",
    endDate: "至今",
    evidence: [
      {
        id: `${id}-ev-1`,
        context: `${organization} 的业务背景`,
        task: "负责核心页面交付",
        actions: ["维护组件库"],
        results: [{ text: "页面交付效率提升", confidence: "confirmed" as const }],
        skills: ["React", "TypeScript"],
        sourceText: `${organization} 经历原始材料。`,
      },
    ],
    bullets: bulletTexts.map((text, index) => ({
      id: `${id}-b${index + 1}`,
      text,
      sourceEvidenceIds: [`${id}-ev-1`],
      qualityFlags: [],
      status: "confirmed" as const,
    })),
  } as Experience;
}

function makeSummary(ratings: Array<{ experienceId: string; tier: "high" | "medium" | "low" }>): EvaluationSummary {
  return {
    schemaVersion: "eval-summary-v1",
    reportId: "report-layout-export-check",
    createdAt: FIXED_NOW,
    experienceRatings: ratings.map((rating) => ({
      experienceId: rating.experienceId,
      score: rating.tier === "high" ? 80 : rating.tier === "medium" ? 55 : 30,
      tier: rating.tier,
      rationale: "layout-export-check fixture",
      searchCitations: [],
    })),
    uncoveredKeywords: [],
  };
}

// ---------- A 组：theme 兼容 ----------

async function groupA(): Promise<void> {
  const group = "A-theme兼容";

  const legacy = normalizeLayoutOverrides(
    { version: "layout-overrides-v1", resumeId: "r1", theme: { fontCJK: "SimSun", baseFontPt: 11 } },
    "r1",
  );
  check(
    group,
    "旧 overrides（无新字段）解析通过且不凭空出现新字段",
    legacy.theme?.fontCJK === "SimSun" &&
      legacy.theme.baseFontPt === 11 &&
      legacy.theme.fontCJKHeading === undefined &&
      legacy.theme.headingFontPt === undefined &&
      legacy.theme.sectionSpacingPt === undefined,
  );

  const clamped = normalizeLayoutOverrides(
    {
      version: "layout-overrides-v1",
      resumeId: "r1",
      theme: { fontCJKHeading: "   ", headingFontPt: 99, sectionSpacingPt: -5 },
    },
    "r1",
  );
  check(
    group,
    "新字段白名单：空白字体名丢弃、headingFontPt clamp 22、sectionSpacingPt clamp 0",
    clamped.theme?.fontCJKHeading === undefined &&
      clamped.theme?.headingFontPt === 22 &&
      clamped.theme?.sectionSpacingPt === 0,
    JSON.stringify(clamped.theme),
  );

  const defaultXml = await docxXml(await buildZhCleanDocx(makeSchema({})), "a-default.docx");
  const defaultFonts = allEastAsia(defaultXml);
  check(
    group,
    "fontCJKHeading 缺省时全文 eastAsia 单一值（Microsoft YaHei）",
    defaultFonts.size === 1 && defaultFonts.has("Microsoft YaHei"),
    [...defaultFonts].join(","),
  );
  check(group, "缺省渲染 section 标题前距维持 210 twips", defaultXml.includes('w:before="210"'));

  const headingXml = await docxXml(
    await buildZhCleanDocx(makeSchema({ theme: { fontCJKHeading: "SimHei" } })),
    "a-heading.docx",
  );
  const titleFont = eastAsiaOf(runSegmentWith(headingXml, "工作经历"));
  const nameFont = eastAsiaOf(runSegmentWith(headingXml, "张三"));
  const bodyFont = eastAsiaOf(runSegmentWith(headingXml, "负责核心模块第1项交付"));
  check(
    group,
    "设 fontCJKHeading=SimHei：标题与姓名 run 为 SimHei、正文 run 仍 fontCJK",
    titleFont === "SimHei" && nameFont === "SimHei" && bodyFont === "Microsoft YaHei",
    `title=${titleFont} name=${nameFont} body=${bodyFont}`,
  );

  const sizedXml = await docxXml(
    await buildZhCleanDocx(makeSchema({ theme: { headingFontPt: 12, sectionSpacingPt: 12 } })),
    "a-sized.docx",
  );
  const titleSize = sizeOf(runSegmentWith(sizedXml, "工作经历"));
  check(
    group,
    "headingFontPt=12 → 标题 sz 24 半点；sectionSpacingPt=12 → before 240",
    titleSize === "24" && sizedXml.includes('w:before="240"') && !sizedXml.includes('w:before="210"'),
    `sz=${titleSize}`,
  );
}

// ---------- B 组：preset 表 ----------

async function groupB(): Promise<void> {
  const group = "B-preset";

  check(group, "preset 表为 clean/classic/compact 三套", deepEqual(layoutThemePresets.map((preset) => preset.id), ["clean", "classic", "compact"]));
  check(
    group,
    "getLayoutThemePreset 命中与未知 id 返回 null",
    getLayoutThemePreset("classic")?.label.includes("经典") === true && getLayoutThemePreset("unknown") === null,
  );

  for (const preset of layoutThemePresets) {
    const normalized = normalizeLayoutOverrides(
      { version: "layout-overrides-v1", resumeId: "r1", theme: preset.theme },
      "r1",
    );
    // themeOverride 输出键序与 preset 声明序不同（值一致即无损）；逐键比较，键序无关。
    const presetKeys = Object.keys(preset.theme) as Array<keyof LayoutTheme>;
    const roundTrip =
      presetKeys.length === 0
        ? normalized.theme === undefined
        : Object.keys(normalized.theme ?? {}).length === presetKeys.length &&
          presetKeys.every((key) => normalized.theme?.[key] === preset.theme[key]);
    check(group, `preset ${preset.id} 过 themeOverride 白名单解析无损往返`, roundTrip, JSON.stringify(normalized.theme));
  }

  const classic = getLayoutThemePreset("classic")!;
  const classicXml = await docxXml(
    await buildZhCleanDocx(makeSchema({ theme: classic.theme, marginsMm: classic.marginsMm })),
    "b-classic.docx",
  );
  const titleFont = eastAsiaOf(runSegmentWith(classicXml, "工作经历"));
  const bodyFont = eastAsiaOf(runSegmentWith(classicXml, "负责核心模块第1项交付"));
  const titleSize = sizeOf(runSegmentWith(classicXml, "工作经历"));
  check(
    group,
    "classic 渲染：标题 SimHei / 正文 SimSun / 标题 22 半点（11pt）",
    titleFont === "SimHei" && bodyFont === "SimSun" && titleSize === "22",
    `title=${titleFont} body=${bodyFont} sz=${titleSize}`,
  );
  check(group, "classic 拉丁字体 Times New Roman 进入 ascii", classicXml.includes('w:ascii="Times New Roman"'));
}

// ---------- C 组：marginsMm 修复 ----------

async function groupC(): Promise<void> {
  const group = "C-marginsMm";

  const defaultXml = await docxXml(await buildZhCleanDocx(makeSchema({})), "c-default.docx");
  const margins = pageMargins(defaultXml);
  const expected = String(mmToTwips(19.8));
  check(
    group,
    "默认 19.8mm → pgMar 四边 = mmToTwips(19.8) = 1123（修正 design 笔误 1122）",
    expected === "1123" &&
      margins.top === expected &&
      margins.right === expected &&
      margins.bottom === expected &&
      margins.left === expected,
    JSON.stringify(margins),
  );

  const classic = getLayoutThemePreset("classic")!;
  const classicXml = await docxXml(
    await buildZhCleanDocx(makeSchema({ theme: classic.theme, marginsMm: classic.marginsMm })),
    "c-classic.docx",
  );
  const classicMargins = pageMargins(classicXml);
  check(
    group,
    "classic margins {17.8,20.3,14,20.3} → {1009,1151,794,1151}",
    classicMargins.top === String(mmToTwips(17.8)) &&
      classicMargins.right === String(mmToTwips(20.3)) &&
      classicMargins.bottom === String(mmToTwips(14)) &&
      classicMargins.left === String(mmToTwips(20.3)) &&
      classicMargins.top === "1009" &&
      classicMargins.bottom === "794",
    JSON.stringify(classicMargins),
  );
}

// ---------- D 组：估算器 ----------

function groupD(): void {
  const group = "D-估算器";

  const schema = makeSchema({});
  const first = estimateSchemaLines(schema);
  const second = estimateSchemaLines(schema);
  check(group, "同输入两次深相等", deepEqual(first, second));

  const moreBullets = makeSchema({
    blocks: [
      { kind: "header", name: "张三", metaLines: [], contacts: [] },
      { kind: "section-title", en: "EXPERIENCE", zh: "工作经历" },
      expBlock("exp-fixture", 3),
    ],
  });
  const grown = estimateSchemaLines(moreBullets);
  check(group, "追加 bullet 后 totalLines 严格增加", grown.totalLines > first.totalLines, `${first.totalLines} -> ${grown.totalLines}`);

  const longCJK = "这".repeat(120);
  const longLatin = "a".repeat(120);
  const cjkLines = estimateSchemaLines(
    makeSchema({ blocks: [expBlock("exp-cjk", 0)].map((block) => ({ ...block, bullets: makeBullets("exp-cjk", [longCJK]) })) }),
  ).totalLines;
  const latinLines = estimateSchemaLines(
    makeSchema({ blocks: [expBlock("exp-latin", 0)].map((block) => ({ ...block, bullets: makeBullets("exp-latin", [longLatin]) })) }),
  ).totalLines;
  check(group, "等长文本：CJK 行数 ≥ Latin（全宽 1 / 半宽 0.5 折算）", cjkLines > latinLines, `cjk=${cjkLines} latin=${latinLines}`);
}

// ---------- E 组：适配器 ----------

function groupE(): void {
  const group = "E-适配器";

  // 容量推导：行高 = 10.5 × 1.15 × 0.3528 ≈ 4.26mm。
  // top=bottom=100 → 可用 97mm → 22 行；blocks = header 4 + section 2 + high 7 + med 5 + low 5 = 23（溢出 1 行）。
  const ladderSchema = makeSchema({
    marginsMm: { top: 100, right: 19.8, bottom: 100, left: 19.8 },
    blocks: [
      { kind: "header", name: "张三", metaLines: [], contacts: [] },
      { kind: "section-title", en: "EXPERIENCE", zh: "工作经历" },
      expBlock("exp-high", 6),
      expBlock("exp-med", 4),
      expBlock("exp-low", 4),
    ],
  });
  const ratings = makeSummary([
    { experienceId: "exp-high", tier: "high" },
    { experienceId: "exp-med", tier: "medium" },
    { experienceId: "exp-low", tier: "low" },
  ]).experienceRatings;

  const fitted = fitToSinglePage(ladderSchema, ratings);
  const fittedBlocks = new Map(
    fitted.schema.blocks
      .filter((block): block is Extract<LayoutBlock, { kind: "experience" }> => block.kind === "experience")
      .map((block) => [block.id, block]),
  );
  check(
    group,
    "溢出 + 评级：low 先被裁且只裁必要数量（溢出 1 行 → 只删尾部 1 条）",
    fitted.decisions.length === 1 &&
      fitted.decisions[0]!.action === "trim-bullets" &&
      fitted.decisions[0]!.blockId === "exp-low" &&
      fitted.decisions[0]!.tier === "low" &&
      deepEqual(fitted.decisions[0]!.removedBulletIds, ["exp-low-b4"]),
    JSON.stringify(fitted.decisions),
  );
  check(
    group,
    "high/medium block 原样、low 裁后 3 条（≥ 下限 2）、不再溢出",
    fittedBlocks.get("exp-high")?.bullets.length === 6 &&
      fittedBlocks.get("exp-med")?.bullets.length === 4 &&
      fittedBlocks.get("exp-low")?.bullets.length === 3 &&
      fitted.overflow === false,
  );
  check(group, "适配器确定性：同输入两次深相等", deepEqual(fitted, fitToSinglePage(ladderSchema, ratings)));

  // 极端溢出：容量 8 行；header 4 + high 7 + low 5 = 16；阶梯走完仍溢出，high 永不动。
  const extremeSchema = makeSchema({
    marginsMm: { top: 130, right: 19.8, bottom: 130, left: 19.8 },
    blocks: [
      { kind: "header", name: "张三", metaLines: [], contacts: [] },
      expBlock("exp-high", 6),
      expBlock("exp-low", 4),
    ],
  });
  const extreme = fitToSinglePage(
    extremeSchema,
    makeSummary([
      { experienceId: "exp-high", tier: "high" },
      { experienceId: "exp-low", tier: "low" },
    ]).experienceRatings,
  );
  const extremeHigh = extreme.schema.blocks.find(
    (block): block is Extract<LayoutBlock, { kind: "experience" }> => block.kind === "experience" && block.id === "exp-high",
  );
  check(
    group,
    "极端溢出：overflow=true、high 仍 6 条原样、low 裁至下限（尾部先删）后整块隐藏",
    extreme.overflow === true &&
      extremeHigh?.bullets.length === 6 &&
      deepEqual(extreme.decisions.map((decision) => `${decision.action}:${decision.blockId}`), [
        "trim-bullets:exp-low",
        "hide-block:exp-low",
      ]) &&
      deepEqual(extreme.decisions[0]!.removedBulletIds, ["exp-low-b4", "exp-low-b3"]),
    JSON.stringify(extreme.decisions),
  );

  // 无评级：容量 12 行；header 4 + expA 5 + expB 5 = 14；逆序（尾部 expB 先）收紧。
  const unratedSchema = makeSchema({
    marginsMm: { top: 122, right: 19.8, bottom: 122, left: 19.8 },
    blocks: [
      { kind: "header", name: "张三", metaLines: [], contacts: [] },
      expBlock("exp-a", 4),
      expBlock("exp-b", 4),
    ],
  });
  const unrated = fitToSinglePage(unratedSchema);
  const unratedA = unrated.schema.blocks.find(
    (block): block is Extract<LayoutBlock, { kind: "experience" }> => block.kind === "experience" && block.id === "exp-a",
  );
  check(
    group,
    "无评级：全按 unrated（=medium 档）从尾部收紧，前部 block 原样",
    unrated.decisions.length === 1 &&
      unrated.decisions[0]!.blockId === "exp-b" &&
      unrated.decisions[0]!.tier === "unrated" &&
      unratedA?.bullets.length === 4 &&
      unrated.overflow === false,
    JSON.stringify(unrated.decisions),
  );

  const small = makeSchema({});
  const noFit = fitToSinglePage(small, ratings);
  check(
    group,
    "不溢出：schema 原样返回（同引用）+ decisions 空 + overflow=false",
    noFit.schema === small && noFit.decisions.length === 0 && noFit.overflow === false,
  );
}

// ---------- F 组：pipelineToExport ----------

async function groupF(): Promise<{ projectId: string; resumeId: string }> {
  const group = "F-pipelineToExport";

  const experiences = Array.from({ length: 14 }, (_, index) =>
    makeExperience(`exp-of-${index + 1}`, `公司${index + 1}`, [
      "负责核心模块交付与迭代",
      "推动性能优化落地",
      "建设组件库与规范",
      "支撑跨端业务扩展",
    ]),
  );
  const { project, resume } = await createProject({ name: "layout-export-check-f" });
  await updateResumeSections(resume.id, { experiences });
  const current = await getProjectResume(project.id, resume.id);
  if (!current) throw new Error("temp project setup failed");
  const document = current.document;
  evidenceNotes.push("F 组临时项目以 layout-export-check-f 前缀创建于本地 .workspace（gitignored），仅记录前缀不记录 ID");

  const direct = projectLayout(document, undefined);
  const plain = pipelineToExport(document);
  check(
    group,
    "不带 options：layoutSchema/gapReport 与直投影深相等、无 fitDecisions 键",
    deepEqual(plain.layoutSchema, direct.schema) && deepEqual(plain.gapReport, direct.gap) && !("fitDecisions" in plain),
  );
  check(
    group,
    "不带 options：readyForExport 与现状口径一致",
    plain.readyForExport === (direct.gap.missingBasics.length === 0 && direct.schema.blocks.length > 1),
  );

  const smallDoc = { ...document, experiences: document.experiences.slice(0, 2) };
  const noOverflow = pipelineToExport(smallDoc, undefined, { singlePage: true });
  check(
    group,
    "singlePage 不溢出：fitDecisions 在场且为空数组（表示适配已运行）",
    Array.isArray(noOverflow.fitDecisions) && noOverflow.fitDecisions.length === 0,
  );

  const summary = makeSummary([
    { experienceId: "exp-of-1", tier: "low" },
    { experienceId: "exp-of-2", tier: "low" },
    { experienceId: "exp-of-3", tier: "low" },
    { experienceId: "exp-of-4", tier: "low" },
    { experienceId: "exp-of-5", tier: "low" },
    { experienceId: "exp-of-14", tier: "high" },
  ]);
  const single = pipelineToExport(document, undefined, { singlePage: true, evaluationSummary: summary });
  const singleHigh = single.layoutSchema.blocks.find(
    (block): block is Extract<LayoutBlock, { kind: "experience" }> => block.kind === "experience" && block.id === "exp-of-14",
  );
  check(
    group,
    "singlePage + summary：fitDecisions 非空、low 进入决策、high 原样",
    (single.fitDecisions?.length ?? 0) > 0 &&
      single.fitDecisions!.some((decision) => decision.tier === "low") &&
      singleHigh?.bullets.length === 4,
    `decisions=${single.fitDecisions?.length}`,
  );

  const snapshot = await buildPipelineExportSnapshot({
    projectId: project.id,
    resumeId: resume.id,
    document,
    options: { singlePage: true, evaluationSummary: summary },
  });
  const reparsed = pipelineExportSnapshotSchema.safeParse(JSON.parse(JSON.stringify(snapshot)));
  check(
    group,
    "snapshot 写入/读回 parse 通过且 fitDecisions 保留",
    reparsed.success && Array.isArray(reparsed.data?.fitDecisions) && reparsed.data.fitDecisions.length > 0,
  );

  const legacySnapshot = pipelineExportSnapshotSchema.safeParse({
    createdAt: FIXED_NOW,
    layoutSchema: direct.schema,
    gapReport: direct.gap,
    readyForExport: true,
  });
  check(
    group,
    "旧 snapshot（无 fitDecisions）parse 通过（z.custom 兼容，零迁移）",
    legacySnapshot.success && legacySnapshot.data?.fitDecisions === undefined,
  );

  return { projectId: project.id, resumeId: resume.id };
}

// ---------- G 组：旧模板零回归 ----------

async function groupG(context: { projectId: string; resumeId: string }): Promise<void> {
  const group = "G-旧模板零回归";
  const current = await getProjectResume(context.projectId, context.resumeId);
  if (!current) throw new Error("resume missing");
  const document = current.document;

  const formats: ExportFormat[] = ["json-resume", "docx-ats", "docx-visual", "docx-zh-clean", "pdf"];
  for (const format of formats) {
    let passed = false;
    let detail: string | undefined;
    try {
      const output = await renderExport(document, format);
      passed = typeof output === "string" ? output.length > 0 : output.length > 0;
      detail = `${typeof output === "string" ? "string" : "buffer"}:${output.length}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    check(group, `renderExport ${format} 不抛错且产物非空`, passed, detail);
  }
}

// ---------- evidence ----------

async function writeEvidence(): Promise<void> {
  const passed = results.filter((result) => result.passed).length;
  const lines = [
    "# B4 layout-export-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    `- 命令：pnpm exec tsx --conditions=react-server scripts/layout-export-check.ts`,
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：docx 产物与临时项目均在本地 .workspace（gitignored），证据只记录路径；",
    "  docx 机检经 python3 zipfile 解包 word/document.xml；",
    "  页边距换算 mmToTwips(19.8)=1123（design 原文 1122 为笔误，公式为准）。",
    ...evidenceNotes.map((note) => `- ${note}`),
    "",
    "| 组 | 断言 | 结果 |",
    "|---|---|---|",
    ...results.map((result) => `| ${result.group} | ${result.name} | ${result.passed ? "PASS" : "FAIL"} |`),
    "",
  ];
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  await groupA();
  await groupB();
  await groupC();
  groupD();
  groupE();
  const context = await groupF();
  await groupG(context);

  await writeEvidence();
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("layout-export-check 运行失败：", error);
  process.exitCode = 1;
});
