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
import type { ResumeDocument } from "@/features/resume/types";

const FONT = "Microsoft YaHei";
const NAVY = "16324F";
const TEAL = "2F6F73";
const PALE = "EEF6F6";
const LINE = "B7D7D8";
const MUTED = "64748B";
const DARK = "111827";
const WHITE = "FFFFFF";

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function join(parts: (string | undefined)[], sep = " · "): string {
  return parts.filter(hasText).map((item) => item.trim()).join(sep);
}

function run(text: string, options: { bold?: boolean; size?: number; color?: string } = {}): TextRun {
  return new TextRun({
    text,
    bold: options.bold,
    size: options.size ?? 21,
    color: options.color ?? DARK,
    font: { ascii: "Calibri", eastAsia: FONT },
  });
}

function paragraph(text: string, options: { bold?: boolean; size?: number; color?: string; center?: boolean; after?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: 276, after: options.after ?? 56 },
    children: [run(text, options)],
  });
}

function multi(runs: TextRun[], options: { after?: number; center?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: 276, after: options.after ?? 56 },
    children: runs,
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { line: 276, after: 42 },
    bullet: { level: 0 },
    children: [run(text)],
  });
}

function confirmedBullets(items: { text: string; status: "draft" | "confirmed" | "archived" }[]): string[] {
  return items.filter((item) => item.status === "confirmed" && hasText(item.text)).map((item) => item.text.trim());
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

function cell(children: (Paragraph | Table)[], options: { width: number; fill?: string; vertical?: typeof VerticalAlign.CENTER } ): TableCell {
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

function headerBlock(document: ResumeDocument): Table {
  const name = document.basics.name || document.title || "我的简历";
  const headline = document.basics.targetRole || document.target?.role || "目标岗位";
  const meta = [document.basics.city, document.target?.industry].filter(hasText).join("｜");
  const contact = [document.basics.phone, document.basics.email, ...document.basics.links.map((item) => item.url)].filter(hasText).join("｜");

  return table([
    new TableRow({
      children: [
        cell([
          multi([run(name, { bold: true, size: 42, color: WHITE }), run(`  ${headline}`, { size: 22, color: "D7ECEE" })], { after: 70 }),
          ...(hasText(meta) ? [paragraph(meta, { color: WHITE, after: 44 })] : []),
          ...(hasText(contact) ? [paragraph(contact, { color: WHITE, after: 0 })] : []),
        ], { width: 76, fill: NAVY }),
        cell([
          paragraph("照片", { center: true, bold: true, size: 24, color: TEAL, after: 20 }),
          paragraph("35 × 45mm", { center: true, size: 18, color: MUTED, after: 20 }),
          paragraph("商务证件照", { center: true, size: 18, color: MUTED, after: 0 }),
        ], { width: 24, fill: PALE, vertical: VerticalAlign.CENTER }),
      ],
    }),
  ]);
}

function heading(en: string, cn: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 210, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LINE } },
    children: [run(en, { bold: true, size: 22, color: NAVY }), run(`  ${cn}`, { bold: true, size: 22, color: TEAL })],
  });
}

function entryTitle(left: string, right?: string): Paragraph {
  return multi([
    run(left, { bold: true, size: 22, color: DARK }),
    ...(hasText(right) ? [run(`    ${right}`, { size: 18, color: MUTED })] : []),
  ], { after: 38 });
}

function summary(document: ResumeDocument): Paragraph[] {
  const out: Paragraph[] = [];
  if (document.summary?.headline) out.push(paragraph(document.summary.headline));
  for (const item of document.summary?.bullets ?? []) {
    if (item.status === "confirmed" && hasText(item.text)) out.push(bullet(item.text));
  }
  if (out.length > 0) return [heading("PROFILE", "个人优势"), ...out];
  return [];
}

function experiences(document: ResumeDocument): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of document.experiences) {
    const title = join([item.organization, item.role]);
    if (hasText(title)) out.push(entryTitle(title, join([item.location, join([item.startDate, item.endDate], " - ")])));
    for (const text of confirmedBullets(item.bullets).slice(0, 4)) out.push(bullet(text));
  }
  return out.length > 0 ? [heading("EXPERIENCE", "工作经历"), ...out] : [];
}

function projects(document: ResumeDocument): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of document.projects) {
    const title = join([item.name, item.role]);
    if (hasText(title)) out.push(entryTitle(title, join([item.startDate, item.endDate], " - ")));
    if (item.techStack.length > 0) out.push(paragraph(`技术栈：${item.techStack.filter(hasText).join("，")}`));
    if (hasText(item.goal)) out.push(paragraph(`目标：${item.goal}`));
    for (const text of confirmedBullets(item.bullets).slice(0, 3)) out.push(bullet(text));
  }
  return out.length > 0 ? [heading("PROJECT", "项目经历"), ...out] : [];
}

function education(document: ResumeDocument): Paragraph[] {
  const out = document.education.flatMap((item) => {
    const rows = [entryTitle(join([item.school, item.degree, item.major]), join([item.startDate, item.endDate], " - "))];
    const meta = join([item.gpa ? `GPA ${item.gpa}` : undefined, item.rank]);
    if (hasText(meta)) rows.push(paragraph(meta));
    for (const honor of item.honors ?? []) if (hasText(honor)) rows.push(bullet(honor));
    return rows;
  });
  return out.length > 0 ? [heading("EDUCATION", "教育背景"), ...out] : [];
}

function skills(document: ResumeDocument): Paragraph[] {
  const out = document.skills.flatMap((group) => group.items.length > 0 ? [paragraph(`${group.name}：${group.items.filter(hasText).join("，")}`)] : []);
  const extras = [
    ...document.certificates.map((item) => join([item.name, item.issuer, item.date])),
    ...document.awards.map((item) => join([item.name, item.issuer, item.date, item.description])),
  ].filter(hasText);
  for (const item of extras) out.push(bullet(item));
  return out.length > 0 ? [heading("SKILLS", "技能证书"), ...out] : [];
}

export async function buildZhCleanDocx(document: ResumeDocument, footer?: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [headerBlock(document)];
  children.push(...summary(document), ...experiences(document), ...projects(document), ...education(document), ...skills(document));
  if (hasText(footer)) children.push(paragraph(footer, { color: MUTED }));

  const doc = new Document({
    creator: "Resume Coach",
    title: document.title,
    sections: [{ properties: { page: { margin: { top: 560, right: 560, bottom: 560, left: 560 } } }, children }],
  });
  return await Packer.toBuffer(doc);
}
