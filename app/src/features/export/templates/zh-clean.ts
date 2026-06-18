import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { LayoutBlock, LayoutBullet, LayoutSchema } from "@/features/layout/schema";

const NAVY = "16324F";
const TEAL = "2F6F73";
const PALE = "EEF6F6";
const LINE = "B7D7D8";
const MUTED = "64748B";
const DARK = "111827";
const WHITE = "FFFFFF";

type DocxRenderContext = {
  fontCJK: string;
  fontCJKHeading: string;
  fontLatin: string;
  accentColor: string;
  baseSize: number;
  headingSize: number;
  headingBefore: number;
  line: number;
};

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function join(parts: (string | undefined)[], sep = " · "): string {
  return parts.filter(hasText).map((item) => item.trim()).join(sep);
}

function docxColor(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().replace(/^#/, "");
  return normalized && /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

function context(schema: LayoutSchema): DocxRenderContext {
  return {
    fontCJK: schema.theme.fontCJK,
    fontCJKHeading: schema.theme.fontCJKHeading ?? schema.theme.fontCJK,
    fontLatin: schema.theme.fontLatin,
    accentColor: docxColor(schema.theme.accentColor, TEAL),
    baseSize: Math.round(schema.theme.baseFontPt * 2),
    headingSize: typeof schema.theme.headingFontPt === "number" ? Math.round(schema.theme.headingFontPt * 2) : 22,
    headingBefore: typeof schema.theme.sectionSpacingPt === "number" ? Math.round(schema.theme.sectionSpacingPt * 20) : 210,
    line: Math.round(schema.theme.lineSpacing * 240),
  };
}

function mmToTwips(mm: number): number {
  return Math.round((mm / 25.4) * 1440);
}

function run(ctx: DocxRenderContext, text: string, options: { bold?: boolean; size?: number; color?: string; eastAsia?: string } = {}): TextRun {
  return new TextRun({
    text,
    bold: options.bold,
    size: options.size ?? ctx.baseSize,
    color: options.color ?? DARK,
    font: { ascii: ctx.fontLatin, eastAsia: options.eastAsia ?? ctx.fontCJK },
  });
}

function paragraph(ctx: DocxRenderContext, text: string, options: { bold?: boolean; size?: number; color?: string; center?: boolean; after?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: ctx.line, after: options.after ?? 56 },
    children: [run(ctx, text, options)],
  });
}

function multi(ctx: DocxRenderContext, runs: TextRun[], options: { after?: number; center?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: ctx.line, after: options.after ?? 56 },
    children: runs,
  });
}

function bullet(ctx: DocxRenderContext, text: string): Paragraph {
  return new Paragraph({
    spacing: { line: ctx.line, after: 42 },
    bullet: { level: 0 },
    children: [run(ctx, text)],
  });
}

function bulletText(item: LayoutBullet): string {
  return item.displayTextOverride?.trim() || item.text;
}

function noBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: WHITE },
    bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
    left: { style: BorderStyle.NONE, size: 0, color: WHITE },
    right: { style: BorderStyle.NONE, size: 0, color: WHITE },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: WHITE },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: WHITE },
  };
}

function cell(children: (Paragraph | Table)[], options: { width: number; fill?: string; vertical?: typeof VerticalAlign.CENTER }): TableCell {
  return new TableCell({
    width: { size: options.width, type: WidthType.PERCENTAGE },
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill, color: "auto" } : undefined,
    verticalAlign: options.vertical,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children,
  });
}

function table(rows: TableRow[]): Table {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders(), rows });
}

function headerBlock(ctx: DocxRenderContext, block: Extract<LayoutBlock, { kind: "header" }>): Table {
  return table([
    new TableRow({
      children: [
        cell([
          multi(ctx, [run(ctx, block.name, { bold: true, size: 42, color: WHITE, eastAsia: ctx.fontCJKHeading }), run(ctx, `  ${block.targetRole ?? "目标岗位"}`, { size: 22, color: "D7ECEE" })], { after: 70 }),
          ...(block.metaLines.length > 0 ? [paragraph(ctx, block.metaLines.join("｜"), { color: WHITE, after: 44 })] : []),
          ...(block.contacts.length > 0 ? [paragraph(ctx, block.contacts.join("｜"), { color: WHITE, after: 0 })] : []),
        ], { width: 76, fill: NAVY }),
        cell([
          paragraph(ctx, "照片", { center: true, bold: true, size: 24, color: ctx.accentColor, after: 20 }),
          paragraph(ctx, `${block.photo?.widthMm ?? 35} × ${block.photo?.heightMm ?? 45}mm`, { center: true, size: 18, color: MUTED, after: 20 }),
          paragraph(ctx, "商务证件照", { center: true, size: 18, color: MUTED, after: 0 }),
        ], { width: 24, fill: PALE, vertical: VerticalAlign.CENTER }),
      ],
    }),
  ]);
}

function heading(ctx: DocxRenderContext, en: string | undefined, cn: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: ctx.headingBefore, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LINE } },
    children: [
      ...(en ? [run(ctx, en, { bold: true, size: ctx.headingSize, color: NAVY, eastAsia: ctx.fontCJKHeading })] : []),
      run(ctx, en ? `  ${cn}` : cn, { bold: true, size: ctx.headingSize, color: ctx.accentColor, eastAsia: ctx.fontCJKHeading }),
    ],
  });
}

function entryTitle(ctx: DocxRenderContext, left: string, right?: string): Paragraph {
  return multi(ctx, [
    run(ctx, left, { bold: true, size: 22, color: DARK }),
    ...(hasText(right) ? [run(ctx, `    ${right}`, { size: 18, color: MUTED })] : []),
  ], { after: 38 });
}

function renderProfile(ctx: DocxRenderContext, block: Extract<LayoutBlock, { kind: "profile" }>): Paragraph[] {
  const out: Paragraph[] = [];
  if (block.headline) out.push(paragraph(ctx, block.headline));
  for (const item of block.bullets) out.push(bullet(ctx, bulletText(item)));
  return out;
}

function renderExperience(ctx: DocxRenderContext, block: Extract<LayoutBlock, { kind: "experience" }>): Paragraph[] {
  return [
    entryTitle(ctx, join([block.org, block.role]), join([block.location, block.period])),
    ...block.bullets.map((item) => bullet(ctx, bulletText(item))),
  ];
}

function renderProject(ctx: DocxRenderContext, block: Extract<LayoutBlock, { kind: "project" }>): Paragraph[] {
  return [
    entryTitle(ctx, join([block.name, block.role]), block.period),
    ...block.details.map((item) => paragraph(ctx, item.text)),
    ...block.bullets.map((item) => bullet(ctx, bulletText(item))),
  ];
}

function renderEducation(ctx: DocxRenderContext, block: Extract<LayoutBlock, { kind: "education" }>): Paragraph[] {
  return [
    entryTitle(ctx, join([block.org, block.degree]), block.period),
    ...(block.meta ? [paragraph(ctx, block.meta)] : []),
    ...block.notes.map((note) => bullet(ctx, note.text)),
  ];
}

function renderSkills(ctx: DocxRenderContext, block: Extract<LayoutBlock, { kind: "skills" }>): Paragraph[] {
  return [
    ...block.groups.map((group) => paragraph(ctx, `${group.label}：${group.items.join("，")}`)),
    ...block.extras.map((item) => bullet(ctx, item.text)),
  ];
}

function renderBlock(ctx: DocxRenderContext, block: LayoutBlock): (Paragraph | Table)[] {
  if (block.kind === "header") return [headerBlock(ctx, block)];
  if (block.kind === "section-title") return [heading(ctx, block.en, block.zh)];
  if (block.kind === "profile") return renderProfile(ctx, block);
  if (block.kind === "experience") return renderExperience(ctx, block);
  if (block.kind === "project") return renderProject(ctx, block);
  if (block.kind === "education") return renderEducation(ctx, block);
  return renderSkills(ctx, block);
}

function documentTitle(schema: LayoutSchema): string {
  const header = schema.blocks.find((block): block is Extract<LayoutBlock, { kind: "header" }> => block.kind === "header");
  return header?.name ?? "Grill-Resume";
}

export async function buildZhCleanDocx(schema: LayoutSchema, footer?: string): Promise<Buffer> {
  const ctx = context(schema);
  const children = schema.blocks.flatMap((block) => renderBlock(ctx, block));
  if (hasText(footer)) children.push(paragraph(ctx, footer, { color: MUTED }));

  const doc = new Document({
    creator: "Resume Coach",
    title: documentTitle(schema),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: mmToTwips(schema.page.marginsMm.top),
              right: mmToTwips(schema.page.marginsMm.right),
              bottom: mmToTwips(schema.page.marginsMm.bottom),
              left: mmToTwips(schema.page.marginsMm.left),
            },
          },
        },
        children,
      },
    ],
  });
  return await Packer.toBuffer(doc);
}
