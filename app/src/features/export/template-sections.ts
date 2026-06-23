import "server-only";

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";

import type { ResumeSectionKey } from "@/features/polish/types";
import type { Theme } from "@/features/polish/themes";

/**
 * 模板 section 标题的 docx-native 渲染（template-exporters 的辅助）。
 *
 * 9 模板的 section 标题样式差异：
 *  - T1/T4/H1: border-b + uppercase + primary 色（"工作经历" 风格）
 *  - T3/H2:    Playfair Display + 2px solid 下边线
 *  - H3:       border-l-4 + primary 色（左侧 4px 实线 + 内容缩进 pl-2）
 *  - A1:       全大写英文 + 1px 黑边 + 小字号
 *  - F1:       居中 + bold
 *  - T2:       normal style（不画线，preview 也是简单样式）
 */

const SECTION_LABELS_CN: Record<ResumeSectionKey, string> = {
  summary: "个人简介",
  workExperience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
  skills: "技能",
};

const SECTION_LABELS_EN_ATS: Record<ResumeSectionKey, string> = {
  summary: "PROFESSIONAL SUMMARY",
  workExperience: "WORK EXPERIENCE",
  projects: "PROJECTS",
  education: "EDUCATION",
  skills: "SKILLS",
};

function hex(s: string): string {
  return s.replace(/^#/, "").toUpperCase();
}

interface SectionStyleOptions {
  alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  borderBottom?: { color: string; size: number; style: typeof BorderStyle[keyof typeof BorderStyle] };
  borderLeft?: { color: string; size: number; style: typeof BorderStyle[keyof typeof BorderStyle]; space: number };
  bold?: boolean;
  uppercase?: boolean;
  font?: string;
  color?: string;
  size?: number; // 半磅（相对 bodyHalfPts 的偏移）
  before?: number;
  after?: number;
}

const STYLE_BY_TEMPLATE: Record<string, SectionStyleOptions> = {
  "t1-classic": {
    borderBottom: { color: "", size: 6, style: "single" },
    bold: true,
    size: 0,
    before: 220,
    after: 80,
  },
  "t2-modern": {
    bold: true,
    size: 0,
    before: 220,
    after: 80,
  },
  "t3-warm": {
    font: "Playfair Display",
    borderBottom: { color: "", size: 16, style: "single" },
    bold: false,
    size: 0,
    before: 220,
    after: 120,
  },
  "t4-compact": {
    borderBottom: { color: "", size: 6, style: "single" },
    bold: true,
    size: -2,
    before: 160,
    after: 60,
  },
  "h1-skills": {
    borderBottom: { color: "", size: 6, style: "single" },
    bold: true,
    size: 0,
    before: 220,
    after: 80,
  },
  "h2-achievement": {
    font: "Playfair Display",
    borderBottom: { color: "", size: 16, style: "single" },
    bold: false,
    size: 0,
    before: 220,
    after: 120,
  },
  "h3-project": {
    borderLeft: { color: "", size: 24, style: "single", space: 4 },
    bold: true,
    size: 0,
    before: 220,
    after: 80,
  },
  "f1-functional": {
    alignment: AlignmentType.CENTER,
    bold: true,
    size: 0,
    before: 220,
    after: 80,
  },
  "a1-ats": {
    borderBottom: { color: "000000", size: 6, style: "single" },
    bold: true,
    size: 0,
    before: 160,
    after: 40,
  },
};

export function renderSectionTitle(
  key: ResumeSectionKey,
  templateId: string,
  theme: Theme,
  bodyHalfPts: number,
  customTitle?: string,
): Paragraph {
  const ats = templateId === "a1-ats";
  const text = ats ? SECTION_LABELS_EN_ATS[key] : (customTitle || SECTION_LABELS_CN[key]);
  const opts = STYLE_BY_TEMPLATE[templateId] ?? STYLE_BY_TEMPLATE["t1-classic"];

  const size = bodyHalfPts + (opts.size ?? 0) + 4;
  const primary = hex(theme.primary);
  const borderBottom = opts.borderBottom
    ? { ...opts.borderBottom, color: opts.borderBottom.color || primary }
    : undefined;
  const borderLeft = opts.borderLeft
    ? { ...opts.borderLeft, color: opts.borderLeft.color || primary }
    : undefined;

  return new Paragraph({
    alignment: opts.alignment ?? AlignmentType.LEFT,
    spacing: {
      before: opts.before ?? 220,
      after: opts.after ?? 80,
      line: Math.round(1.5 * 240),
    },
    border: borderBottom || borderLeft
      ? {
          ...(borderBottom
            ? { bottom: { style: borderBottom.style, size: borderBottom.size, color: borderBottom.color, space: 2 } }
            : {}),
          ...(borderLeft
            ? { left: { style: borderLeft.style, size: borderLeft.size, color: borderLeft.color, space: borderLeft.space } }
            : {}),
        }
      : undefined,
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? true,
        color: ats ? "000000" : primary,
        size,
        font: opts.font ?? theme.fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? theme.fontFamily,
      }),
    ],
  });
}

// ─── H3 pl-2 缩进 wrapper ───────────────────────────────────

/** 把一组段落包成 1×1 table，左侧 4px 缩进模拟 H3 的 `pl-2`。 */
export function wrapWithH3Indent(paragraphs: Paragraph[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: "none" as const, size: 0, color: "FFFFFF" },
      bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
      left: { style: "none" as const, size: 0, color: "FFFFFF" },
      right: { style: "none" as const, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: "none" as const, size: 0, color: "FFFFFF" },
      insideVertical: { style: "none" as const, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: "none" as const, size: 0, color: "FFFFFF" },
              bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
              left: { style: "none" as const, size: 0, color: "FFFFFF" },
              right: { style: "none" as const, size: 0, color: "FFFFFF" },
            },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: paragraphs as Paragraph[],
          }),
        ],
      }),
    ],
  });
}

// ─── 技能 chip 表格（preview 的 rounded badge） ─────────────

interface SkillChipsOptions {
  /** 胶囊背景色（通常 `${primary}1A`）。 */
  backgroundColor: string;
  /** 胶囊文字色。 */
  textColor: string;
  /** 字号（半磅）。 */
  halfPts: number;
  /** 字体。 */
  font: string;
  /** 圆角（仅 css 概念，docx 用 cell shading 模拟无圆角）。 */
  /** 单元格水平对齐。 */
  alignment: typeof AlignmentType[keyof typeof AlignmentType];
  /** 网格列数（H1 是 3 列 grid）；其它用 1 列横向流。 */
  columns?: number;
}

/** 把技能数组渲染为 1×N 或 N×3 胶囊表格（H1 用 3 列）。 */
export function renderSkillChips(
  skills: string[],
  opts: SkillChipsOptions,
): Table {
  if (opts.columns && opts.columns > 1) {
    // H1 grid 3 列布局：多行多列
    const rows: TableRow[] = [];
    for (let i = 0; i < skills.length; i += opts.columns) {
      const slice = skills.slice(i, i + opts.columns);
      while (slice.length < opts.columns) slice.push("");
      rows.push(
        new TableRow({
          children: slice.map((s) => chipCell(s, opts)),
        }),
      );
    }
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: "none" as const, size: 0, color: "FFFFFF" },
        bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
        left: { style: "none" as const, size: 0, color: "FFFFFF" },
        right: { style: "none" as const, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: "none" as const, size: 0, color: "FFFFFF" },
        insideVertical: { style: "none" as const, size: 0, color: "FFFFFF" },
      },
      rows,
    });
  }

  // 单行 1×N 横向流
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: "none" as const, size: 0, color: "FFFFFF" },
      bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
      left: { style: "none" as const, size: 0, color: "FFFFFF" },
      right: { style: "none" as const, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: "none" as const, size: 0, color: "FFFFFF" },
      insideVertical: { style: "none" as const, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: skills.map((s) => chipCell(s, opts)),
      }),
    ],
  });
}

function chipCell(text: string, opts: SkillChipsOptions): TableCell {
  return new TableCell({
    width: { size: 100 / (opts.columns ?? 1), type: WidthType.PERCENTAGE },
    shading: { fill: opts.backgroundColor.replace(/^#/, "").toUpperCase(), type: "clear" },
    borders: {
      top: { style: "none" as const, size: 0, color: "FFFFFF" },
      bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
      left: { style: "none" as const, size: 0, color: "FFFFFF" },
      right: { style: "none" as const, size: 0, color: "FFFFFF" },
    },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: opts.alignment,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: text || " ",
            color: opts.textColor.replace(/^#/, "").toUpperCase(),
            size: opts.halfPts,
            font: opts.font,
          }),
        ],
      }),
    ],
  });
}
