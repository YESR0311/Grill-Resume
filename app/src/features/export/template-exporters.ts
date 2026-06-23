import "server-only";

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  TabStopType,
} from "docx";

import type {
  ResumeDraft,
  ResumeSectionKey,
} from "@/features/polish/types";
import type { Theme } from "@/features/polish/themes";
import { getTheme } from "@/features/polish/themes";
import { getTemplate } from "@/features/polish/template-registry";
import { getTemplateDesign } from "@/features/polish/template-style";
import { htmlToRuns } from "./html-runs";
import { renderTopHeader, VARIANT_BY_TEMPLATE_ID } from "./top-header";
import { renderSectionTitle, renderSkillChips } from "./template-sections";
import { tintOnWhite } from "./color-util";
import type { TopHeaderVariant } from "@/features/polish/templates/TopHeader";

/**
 * 9 模板的 docx-native 渲染器（template-exporter registry）。
 *
 * 与 from-draft.ts 主流程协作：
 *   buildExportCtx(draft) → 拿到 templateId/theme/fontSize/... → selectExporter
 *   exporter 返回 (Paragraph | Table)[] → 拼到 Document children
 *
 * 每个模板有独立 exporter，逐字段对齐 preview（templates/*.tsx）的 layout：
 *  - 工作/项目经历的「role | 日期 / organization / bullets」三段结构
 *  - 教育的双栏对齐 / ATS 两行结构
 *  - 技能胶囊（带主题背景色的 chip 表格）
 *  - section 标题样式（border-b / Playfair / border-left / 居中 / ATS 英文）
 *  - section 顺序（draft.style.sectionOrder，registry 已定义每模板顺序）
 */

// ─── ctx ───────────────────────────────────────────────────

export interface ExportCtx {
  draft: ResumeDraft;
  templateId: string;
  theme: Theme;
  bodyHalfPts: number;        // 正文字号（半磅）
  font: string;               // 主字体（已 pickFont）
  serifFont: string;          // 衬线字体（Playfair）
  lineSpacingTwips: number;
  variant: TopHeaderVariant;
  photo: "left" | "right" | "none";
  contentWidthTwips: number;  // 内容区宽度（右对齐 tab stop 用）
}

const FALLBACK_FONT = "Microsoft YaHei";

function pickFont(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first && first.length > 0 ? first : FALLBACK_FONT;
}

function pxToHalfPts(px: number): number {
  return Math.max(8, Math.round(px * 1.5));
}

function mmToTwips(mm: number): number {
  return Math.round(mm * 56.6929);
}

function hex(s: string): string {
  return s.replace(/^#/, "").toUpperCase();
}

export function buildExportCtx(draft: ResumeDraft): ExportCtx {
  const templateId = draft.templateId;
  const themeId = getTemplateDesign(templateId).theme;
  const theme = getTheme(themeId);
  const template = getTemplate(templateId) ?? getTemplate("t1-classic")!;
  const m = template.style.margins;
  return {
    draft,
    templateId,
    theme,
    bodyHalfPts: pxToHalfPts(template.style.fontSize),
    font: pickFont(theme.fontFamily),
    serifFont: "Playfair Display",
    lineSpacingTwips: Math.round(template.style.lineSpacing * 240),
    variant: VARIANT_BY_TEMPLATE_ID[templateId] ?? "default",
    photo: getTemplateDesign(templateId).photo,
    contentWidthTwips: mmToTwips(210 - m.left - m.right),
  };
}

// ─── 基础 run helper ───────────────────────────────────────

function run(text: string, ctx: ExportCtx, opts?: {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  size?: number;
  font?: string;
}): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    italics: opts?.italics ?? false,
    color: opts?.color ?? hex(ctx.theme.text),
    size: opts?.size ?? ctx.bodyHalfPts,
    font: opts?.font ?? ctx.font,
  });
}

function bulletPara(html: string, ctx: ExportCtx, opts?: { indentLeft?: number }): Paragraph {
  const runs = htmlToRuns(html, { color: hex(ctx.theme.text), size: ctx.bodyHalfPts, font: ctx.font });
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20, line: ctx.lineSpacingTwips },
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    children: runs.length > 0 ? runs : [run("", ctx)],
  });
}

/** role 在左 + 日期右对齐（同一行，用 RIGHT tab stop）。 */
function roleDatesPara(
  role: string,
  startDate: string,
  endDate: string,
  ctx: ExportCtx,
  opts?: { roleColor?: string; bold?: boolean; indentLeft?: number },
): Paragraph {
  const dates = [startDate, endDate].filter(Boolean).join(" - ");
  const tabPos = ctx.contentWidthTwips - (opts?.indentLeft ?? 0);
  return new Paragraph({
    spacing: { before: 80, after: 20, line: ctx.lineSpacingTwips },
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    tabStops: dates ? [{ type: TabStopType.RIGHT, position: tabPos }] : undefined,
    children: [
      run(role, ctx, { bold: opts?.bold ?? true, color: opts?.roleColor }),
      ...(dates ? [run(`\t${dates}`, ctx, { color: hex(ctx.theme.accent), size: ctx.bodyHalfPts - 3 })] : []),
    ],
  });
}

/** organization 单独一行（accent，可斜体）。 */
function orgPara(org: string, ctx: ExportCtx, opts?: { italic?: boolean; indentLeft?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: 40, line: ctx.lineSpacingTwips },
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    children: [run(org, ctx, { color: hex(ctx.theme.accent), italics: opts?.italic ?? false, size: ctx.bodyHalfPts - 1 })],
  });
}

// ─── 工作/项目经历：三段结构 ────────────────────────────────

interface ExpLayoutOpts {
  roleColorPrimary?: boolean; // role 用 primary 色（T2/T3/H2）
  orgItalic?: boolean;        // organization 斜体（T2/T3/H2）
  indentLeft?: number;        // H3 缩进
}

function renderExpItems(
  items: ResumeDraft["workExperience"]["items"],
  ctx: ExportCtx,
  opts: ExpLayoutOpts = {},
): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    out.push(
      roleDatesPara(item.role, item.startDate, item.endDate, ctx, {
        bold: true,
        roleColor: opts.roleColorPrimary ? hex(ctx.theme.primary) : undefined,
        indentLeft: opts.indentLeft,
      }),
    );
    if (item.organization) {
      out.push(orgPara(item.organization, ctx, { italic: opts.orgItalic, indentLeft: opts.indentLeft }));
    }
    for (const b of item.bullets) {
      out.push(bulletPara(b.text, ctx, { indentLeft: opts.indentLeft }));
    }
  }
  return out;
}

// 紧凑型（T4）：`role · org` 一行 + 日期右对齐
function renderExpCompact(
  items: ResumeDraft["workExperience"]["items"],
  ctx: ExportCtx,
): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    const head = [item.role, item.organization].filter(Boolean).join(" · ");
    const dates = [item.startDate, item.endDate].filter(Boolean).join(" - ");
    out.push(
      new Paragraph({
        spacing: { before: 40, after: 10, line: ctx.lineSpacingTwips },
        tabStops: dates ? [{ type: TabStopType.RIGHT, position: ctx.contentWidthTwips }] : undefined,
        children: [
          run(head, ctx, { bold: true }),
          ...(dates ? [run(`\t${dates}`, ctx, { color: hex(ctx.theme.accent) })] : []),
        ],
      }),
    );
    for (const b of item.bullets) out.push(bulletPara(b.text, ctx));
  }
  return out;
}

// 功能型（F1）：work 用 `org · role`，project 用 `role · org`，无日期行，居中标题但内容左对齐
function renderExpFunctional(
  items: ResumeDraft["workExperience"]["items"],
  ctx: ExportCtx,
  headOrder: "org-role" | "role-org",
): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    const head =
      headOrder === "org-role"
        ? [item.organization, item.role].filter(Boolean).join(" · ")
        : [item.role, item.organization].filter(Boolean).join(" · ");
    out.push(
      new Paragraph({
        spacing: { before: 40, after: 10, line: ctx.lineSpacingTwips },
        children: [run(head, ctx, { bold: true })],
      }),
    );
    for (const b of item.bullets) out.push(bulletPara(b.text, ctx));
  }
  return out;
}

// ATS（A1）：`role | org` 一行 + 日期独立一行 + bullets
function renderExpATS(
  items: ResumeDraft["workExperience"]["items"],
  ctx: ExportCtx,
): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    out.push(
      new Paragraph({
        spacing: { before: 60, after: 0, line: ctx.lineSpacingTwips },
        children: [
          run(item.role, ctx, { bold: true }),
          ...(item.organization ? [run(` | ${item.organization}`, ctx)] : []),
        ],
      }),
    );
    const dates = [item.startDate, item.endDate].filter(Boolean).join(" - ");
    if (dates) {
      out.push(
        new Paragraph({
          spacing: { after: 10, line: ctx.lineSpacingTwips },
          children: [run(dates, ctx)],
        }),
      );
    }
    for (const b of item.bullets) out.push(bulletPara(b.text, ctx));
  }
  return out;
}

// ─── 教育 ──────────────────────────────────────────────────

// 默认：`org(bold) + role(accent)` 左 + endDate 右对齐
function renderEduDefault(ctx: ExportCtx, opts?: { indentLeft?: number }): Paragraph[] {
  const items = ctx.draft.education.items;
  if (items.length === 0) return [];
  return items.map((item) => {
    const tabPos = ctx.contentWidthTwips - (opts?.indentLeft ?? 0);
    return new Paragraph({
      spacing: { after: 20, line: ctx.lineSpacingTwips },
      indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
      tabStops: item.endDate ? [{ type: TabStopType.RIGHT, position: tabPos }] : undefined,
      children: [
        run(item.organization, ctx, { bold: true }),
        ...(item.role ? [run(`  ${item.role}`, ctx, { color: hex(ctx.theme.accent) })] : []),
        ...(item.endDate ? [run(`\t${item.endDate}`, ctx, { color: hex(ctx.theme.accent), size: ctx.bodyHalfPts - 3 })] : []),
      ],
    });
  });
}

// T2：org / role / endDate 三行
function renderEduStacked(ctx: ExportCtx): Paragraph[] {
  const items = ctx.draft.education.items;
  if (items.length === 0) return [];
  const out: Paragraph[] = [];
  for (const item of items) {
    out.push(new Paragraph({ spacing: { after: 0, line: ctx.lineSpacingTwips }, children: [run(item.organization, ctx, { bold: true })] }));
    if (item.role) out.push(new Paragraph({ spacing: { after: 0, line: ctx.lineSpacingTwips }, children: [run(item.role, ctx, { color: hex(ctx.theme.accent), size: ctx.bodyHalfPts - 2 })] }));
    if (item.endDate) out.push(new Paragraph({ spacing: { after: 40, line: ctx.lineSpacingTwips }, children: [run(item.endDate, ctx, { color: hex(ctx.theme.accent), size: ctx.bodyHalfPts - 2 })] }));
  }
  return out;
}

// F1：`org · role · endDate` 居中一行
function renderEduFunctional(ctx: ExportCtx): Paragraph[] {
  const items = ctx.draft.education.items;
  if (items.length === 0) return [];
  return items.map((item) => {
    const parts = [item.organization, item.role, item.endDate].filter(Boolean).join(" · ");
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20, line: ctx.lineSpacingTwips },
      children: [run(parts, ctx)],
    });
  });
}

// A1：`org(bold)` 一行 + `role | endDate` 一行
function renderEduATS(ctx: ExportCtx): Paragraph[] {
  const items = ctx.draft.education.items;
  if (items.length === 0) return [];
  const out: Paragraph[] = [];
  for (const item of items) {
    out.push(new Paragraph({ spacing: { after: 0, line: ctx.lineSpacingTwips }, children: [run(item.organization, ctx, { bold: true })] }));
    const line2 = [item.role, item.endDate].filter(Boolean).join(" | ");
    if (line2) out.push(new Paragraph({ spacing: { after: 20, line: ctx.lineSpacingTwips }, children: [run(line2, ctx)] }));
  }
  return out;
}

// ─── 简介 ──────────────────────────────────────────────────

function renderSummary(ctx: ExportCtx, opts?: { center?: boolean; indentLeft?: number }): Paragraph[] {
  if (!ctx.draft.summary) return [];
  return [
    new Paragraph({
      alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 80, line: ctx.lineSpacingTwips },
      indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
      children: htmlToRuns(ctx.draft.summary, { color: hex(ctx.theme.text), size: ctx.bodyHalfPts, font: ctx.font }),
    }),
  ];
}

// ─── 技能 ──────────────────────────────────────────────────

function chipOpts(ctx: ExportCtx, bg: string, fg: string, columns?: number, center = false) {
  return {
    backgroundColor: bg,
    textColor: fg,
    halfPts: ctx.bodyHalfPts - 2,
    font: ctx.font,
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    columns,
  };
}

// T4/A1：纯文本技能
function renderSkillsPlain(ctx: ExportCtx, sep: string): Paragraph[] {
  if (ctx.draft.skills.length === 0) return [];
  return [
    new Paragraph({
      spacing: { after: 80, line: ctx.lineSpacingTwips },
      children: [run(ctx.draft.skills.join(sep), ctx)],
    }),
  ];
}

// ─── 通用 section dispatch ─────────────────────────────────

function sectionTitle(ctx: ExportCtx, key: ResumeSectionKey, customTitle?: string): Paragraph {
  return renderSectionTitle(key, ctx.templateId, ctx.theme, ctx.bodyHalfPts, customTitle);
}

// ─── 9 个独立 exporter ─────────────────────────────────────

type TemplateExporter = (ctx: ExportCtx) => (Paragraph | Table)[];

/** 顺序取自 registry（draft.style.sectionOrder）。 */
function order(ctx: ExportCtx): ResumeSectionKey[] {
  return ctx.draft.style.sectionOrder;
}

// ── T1-Classic：default header / 三段 exp / 默认教育 / primary1A chips ──
function exportT1(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpItems(ctx.draft.workExperience.items, ctx));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpItems(ctx.draft.projects.items, ctx));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduDefault(ctx));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key), renderSkillChips(ctx.draft.skills, chipOpts(ctx, tintOnWhite(ctx.theme.primary, 0.1), hex(ctx.theme.text), 4)));
    }
  }
  return out;
}

// ── T2-Modern：顶部色条 + 四象限双栏（经历左 / 简介·技能·教育右） ──
function exportT2(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  // 顶部色条
  out.push(decorBar(ctx));
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  // 分隔线
  out.push(dividerLine(ctx));

  // 渲染单个 section 为 (Paragraph|Table)[]（标题 + 内容）
  const renderT2Section = (key: ResumeSectionKey): (Paragraph | Table)[] => {
    if (key === "summary" && ctx.draft.summary) {
      return [sectionTitle(ctx, key), ...renderSummary(ctx)];
    }
    if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      return [sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpItems(ctx.draft.workExperience.items, ctx, { roleColorPrimary: true, orgItalic: true })];
    }
    if (key === "projects" && ctx.draft.projects.items.length > 0) {
      return [sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpItems(ctx.draft.projects.items, ctx, { roleColorPrimary: true, orgItalic: true })];
    }
    if (key === "education" && ctx.draft.education.items.length > 0) {
      return [sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduStacked(ctx)];
    }
    if (key === "skills" && ctx.draft.skills.length > 0) {
      // 右栏窄，2 列避免技能名断词
      return [sectionTitle(ctx, key), renderSkillChips(ctx.draft.skills, chipOpts(ctx, tintOnWhite(ctx.theme.primary, 0.08), hex(ctx.theme.primary), 2))];
    }
    return [];
  };

  // 左栏：经历类（work + projects）；右栏：其他（summary + skills + education）
  const LEFT_KEYS: ResumeSectionKey[] = ["workExperience", "projects"];
  const leftContent: (Paragraph | Table)[] = [];
  const rightContent: (Paragraph | Table)[] = [];
  for (const key of order(ctx)) {
    const blocks = renderT2Section(key);
    if (blocks.length === 0) continue;
    if (LEFT_KEYS.includes(key)) leftContent.push(...blocks);
    else rightContent.push(...blocks);
  }

  // 1×2 表格做双栏（左 60% / 右 40%），top 对齐
  out.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [Math.round(ctx.contentWidthTwips * 0.58), Math.round(ctx.contentWidthTwips * 0.42)],
      borders: noTableBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 58, type: WidthType.PERCENTAGE },
              verticalAlign: "top",
              borders: noCellBorders(),
              margins: { top: 0, bottom: 0, left: 0, right: 160 },
              children: leftContent.length > 0 ? (leftContent as (Paragraph | Table)[]) : [new Paragraph({ children: [run("", ctx)] })],
            }),
            new TableCell({
              width: { size: 42, type: WidthType.PERCENTAGE },
              verticalAlign: "top",
              borders: noCellBorders(),
              margins: { top: 0, bottom: 0, left: 160, right: 0 },
              children: rightContent.length > 0 ? (rightContent as (Paragraph | Table)[]) : [new Paragraph({ children: [run("", ctx)] })],
            }),
          ],
        }),
      ],
    }),
  );
  return out;
}

// ── T3-Warm：serif header + 三段 exp(role primary, org italic) + 默认教育 + 暖色 chips ──
function exportT3(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpItems(ctx.draft.workExperience.items, ctx, { roleColorPrimary: true, orgItalic: true }));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpItems(ctx.draft.projects.items, ctx, { roleColorPrimary: true, orgItalic: true }));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduDefault(ctx));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      // T3 用 #F2E3D6 accent-tint chips（实色，无 alpha）
      out.push(sectionTitle(ctx, key), renderSkillChips(ctx.draft.skills, chipOpts(ctx, "F2E3D6", hex(ctx.theme.primary), 4)));
    }
  }
  return out;
}

// ── T4-Compact：compact header + 紧凑 exp + 默认教育 + 纯文本技能 ──
function exportT4(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpCompact(ctx.draft.workExperience.items, ctx));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpCompact(ctx.draft.projects.items, ctx));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduDefault(ctx));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key), ...renderSkillsPlain(ctx, " · "));
    }
  }
  return out;
}

// ── H1-Skills：default header + 三段 exp + 默认教育 + 3 列网格技能 ──
function exportH1(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpItems(ctx.draft.workExperience.items, ctx));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpItems(ctx.draft.projects.items, ctx));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduDefault(ctx));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key), renderSkillChips(ctx.draft.skills, chipOpts(ctx, tintOnWhite(ctx.theme.primary, 0.1), hex(ctx.theme.text), 3, true)));
    }
  }
  return out;
}

// ── H2-Achievement：serif header + 三段 exp(role primary, org italic) + 默认教育 + chips ──
function exportH2(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpItems(ctx.draft.workExperience.items, ctx, { roleColorPrimary: true, orgItalic: true }));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpItems(ctx.draft.projects.items, ctx, { roleColorPrimary: true, orgItalic: true }));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduDefault(ctx));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key), renderSkillChips(ctx.draft.skills, chipOpts(ctx, tintOnWhite(ctx.theme.primary, 0.1), hex(ctx.theme.text), 4)));
    }
  }
  return out;
}

// ── H3-Project：default header + 内容缩进 + border-left 标题 ──
function exportH3(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const indent = 160; // pl-2 ≈ 8px ≈ 115twips；用 160 稍宽
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx, { indentLeft: indent }));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title), ...renderExpItems(ctx.draft.workExperience.items, ctx, { indentLeft: indent }));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpItems(ctx.draft.projects.items, ctx, { indentLeft: indent }));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduDefault(ctx, { indentLeft: indent }));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key), renderSkillChips(ctx.draft.skills, chipOpts(ctx, tintOnWhite(ctx.theme.primary, 0.1), hex(ctx.theme.text), 4)));
    }
  }
  return out;
}

// ── F1-Functional：无照片 + 居中标题 + `org·role` exp + 居中教育/技能 ──
function exportF1(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx, { center: true }));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key, "核心技能"), renderSkillChips(ctx.draft.skills, chipOpts(ctx, tintOnWhite(ctx.theme.primary, 0.125), hex(ctx.theme.primary), 4, true)));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.workExperience.title || "相关经历"), ...renderExpFunctional(ctx.draft.workExperience.items, ctx, "org-role"));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.projects.title), ...renderExpFunctional(ctx.draft.projects.items, ctx, "role-org"));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key, ctx.draft.education.title), ...renderEduFunctional(ctx));
    }
  }
  return out;
}

// ── A1-ATS：无照片 + 全大写英文标题 + `role|org` exp + 两行教育 + 逗号技能 ──
function exportA1(ctx: ExportCtx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(...renderTopHeader(ctx.draft, ctx.theme, ctx.photo, ctx.variant, ctx.contentWidthTwips));
  for (const key of order(ctx)) {
    if (key === "summary" && ctx.draft.summary) {
      out.push(sectionTitle(ctx, key), ...renderSummary(ctx));
    } else if (key === "education" && ctx.draft.education.items.length > 0) {
      out.push(sectionTitle(ctx, key), ...renderEduATS(ctx));
    } else if (key === "workExperience" && ctx.draft.workExperience.items.length > 0) {
      out.push(sectionTitle(ctx, key), ...renderExpATS(ctx.draft.workExperience.items, ctx));
    } else if (key === "projects" && ctx.draft.projects.items.length > 0) {
      out.push(sectionTitle(ctx, key), ...renderExpATS(ctx.draft.projects.items, ctx));
    } else if (key === "skills" && ctx.draft.skills.length > 0) {
      out.push(sectionTitle(ctx, key), ...renderSkillsPlain(ctx, ", "));
    }
  }
  return out;
}

// ─── 装饰元素 ───────────────────────────────────────────────

/** T2 顶部强调色条（preview 的 absolute h-2 顶条）。 */
function decorBar(ctx: ExportCtx): Table {
  const primary = hex(ctx.theme.primary);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noTableBorders(),
    rows: [
      new TableRow({
        height: { value: 80, rule: "atLeast" },
        children: [
          new TableCell({
            shading: { fill: primary, type: "clear" },
            borders: noCellBorders(),
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [run(" ", ctx, { size: 4 })] })],
          }),
        ],
      }),
    ],
  });
}

/** T2 姓名/证件照下的分隔线。 */
function dividerLine(ctx: ExportCtx): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 120 },
    border: { bottom: { style: "single", size: 6, color: hex(ctx.theme.primary), space: 1 } },
    children: [run("", ctx, { size: 2 })],
  });
}

function noTableBorders() {
  return {
    top: { style: "none" as const, size: 0, color: "FFFFFF" },
    bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
    left: { style: "none" as const, size: 0, color: "FFFFFF" },
    right: { style: "none" as const, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: "none" as const, size: 0, color: "FFFFFF" },
    insideVertical: { style: "none" as const, size: 0, color: "FFFFFF" },
  };
}

function noCellBorders() {
  return {
    top: { style: "none" as const, size: 0, color: "FFFFFF" },
    bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
    left: { style: "none" as const, size: 0, color: "FFFFFF" },
    right: { style: "none" as const, size: 0, color: "FFFFFF" },
  };
}

// ─── registry ──────────────────────────────────────────────

export const TEMPLATE_EXPORTERS: Record<string, TemplateExporter> = {
  "t1-classic": exportT1,
  "t2-modern": exportT2,
  "t3-warm": exportT3,
  "t4-compact": exportT4,
  "h1-skills": exportH1,
  "h2-achievement": exportH2,
  "h3-project": exportH3,
  "f1-functional": exportF1,
  "a1-ats": exportA1,
};

/** 兜底：未知 templateId 回落 t1-classic。 */
export function selectExporter(templateId: string): TemplateExporter {
  return TEMPLATE_EXPORTERS[templateId] ?? exportT1;
}
