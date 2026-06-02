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
  WidthType,
} from "docx";
import type { ResumeDocument } from "@/features/resume/types";

const ACCENT_HEX = "1F4E79";
const ACCENT_LIGHT_HEX = "D9E2F3";
const SECTION_GAP = 240;
const BODY_FONT_HALF_POINTS = 22;
const TITLE_FONT_HALF_POINTS = 36;
const SUBTITLE_HALF_POINTS = 22;
const SECTION_HEADING_HALF_POINTS = 26;

function nonEmpty(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function joinNonEmpty(parts: (string | undefined)[], sep = " · "): string {
  return parts.filter(nonEmpty).map((item) => item!.trim()).join(sep);
}

function bodyRun(text: string, opts: { bold?: boolean; color?: string } = {}): TextRun {
  return new TextRun({
    text,
    size: BODY_FONT_HALF_POINTS,
    bold: opts.bold,
    color: opts.color,
    font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({ spacing: { line: 288 }, children: [bodyRun(text)] });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { line: 288 },
    bullet: { level: 0 },
    children: [bodyRun(text)],
  });
}

function buildHeader(document: ResumeDocument): Table {
  const name = document.basics.name?.trim() || document.title || "我的简历";
  const subtitle = document.basics.targetRole || document.target?.role || "";
  const contactParts: string[] = [];
  if (nonEmpty(document.basics.phone)) contactParts.push(document.basics.phone!);
  if (nonEmpty(document.basics.email)) contactParts.push(document.basics.email!);
  if (nonEmpty(document.basics.city)) contactParts.push(document.basics.city!);
  for (const link of document.basics.links) {
    if (nonEmpty(link.url)) contactParts.push(`${link.label || "链接"}: ${link.url}`);
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT_HEX },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: name,
                    size: TITLE_FONT_HALF_POINTS,
                    bold: true,
                    color: ACCENT_HEX,
                    font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
                  }),
                ],
              }),
              ...(nonEmpty(subtitle)
                ? [
                    new Paragraph({
                      spacing: { before: 60 },
                      children: [
                        new TextRun({
                          text: subtitle!,
                          size: SUBTITLE_HALF_POINTS,
                          color: ACCENT_HEX,
                          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
                        }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: contactParts.length === 0
              ? [new Paragraph("")]
              : contactParts.map(
                  (line) =>
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [bodyRun(line)],
                    }),
                ),
          }),
        ],
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: SECTION_GAP, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: ACCENT_LIGHT_HEX, color: "auto" },
    children: [
      new TextRun({
        text,
        size: SECTION_HEADING_HALF_POINTS,
        bold: true,
        color: ACCENT_HEX,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      }),
    ],
  });
}

function experienceTable(rows: { left: string; right: Paragraph[] }[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: ACCENT_LIGHT_HEX, color: "auto" },
              children: [
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [bodyRun(row.left, { bold: true, color: ACCENT_HEX })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 76, type: WidthType.PERCENTAGE },
              children: row.right.length > 0 ? row.right : [bodyParagraph("")],
            }),
          ],
        }),
    ),
  });
}

function badgeTable(items: string[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: items.map(
          (item) =>
            new TableCell({
              width: { size: Math.max(20, Math.floor(100 / Math.max(items.length, 1))), type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: ACCENT_LIGHT_HEX, color: "auto" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 60 },
                  children: [bodyRun(item, { color: ACCENT_HEX })],
                }),
              ],
            }),
        ),
      }),
    ],
  });
}

function buildEducation(document: ResumeDocument): (Paragraph | Table)[] {
  if (document.education.length === 0) return [];
  const rows = document.education.map((item) => {
    const left = joinNonEmpty([item.startDate, item.endDate], " - ") || "—";
    const right: Paragraph[] = [];
    const head = joinNonEmpty([item.school, item.degree, item.major]);
    if (nonEmpty(head)) right.push(bodyParagraph(head));
    const meta: string[] = [];
    if (nonEmpty(item.gpa)) meta.push(`GPA: ${item.gpa}`);
    if (nonEmpty(item.rank)) meta.push(`排名: ${item.rank}`);
    if (meta.length > 0) right.push(bodyParagraph(meta.join(" | ")));
    if (item.honors && item.honors.length > 0) {
      for (const honor of item.honors) if (nonEmpty(honor)) right.push(bulletParagraph(honor));
    }
    return { left, right };
  });
  return [sectionHeading("教育经历"), experienceTable(rows)];
}

function buildExperiences(document: ResumeDocument): (Paragraph | Table)[] {
  if (document.experiences.length === 0) return [];
  const rows = document.experiences.map((item) => {
    const left = joinNonEmpty([item.startDate, item.endDate], " - ") || "—";
    const right: Paragraph[] = [];
    const head = joinNonEmpty([item.organization, item.role, item.location]);
    if (nonEmpty(head)) right.push(bodyParagraph(head));
    for (const bullet of item.bullets) {
      if (bullet.status !== "confirmed") continue;
      if (nonEmpty(bullet.text)) right.push(bulletParagraph(bullet.text));
    }
    return { left, right };
  });
  return [sectionHeading("工作 / 实习经历"), experienceTable(rows)];
}

function buildProjects(document: ResumeDocument): (Paragraph | Table)[] {
  if (document.projects.length === 0) return [];
  const rows = document.projects.map((item) => {
    const left = joinNonEmpty([item.startDate, item.endDate], " - ") || "—";
    const right: Paragraph[] = [];
    const head = joinNonEmpty([item.name, item.role]);
    if (nonEmpty(head)) right.push(bodyParagraph(head));
    if (item.techStack.length > 0) right.push(bodyParagraph(`技术栈：${item.techStack.filter(nonEmpty).join("，")}`));
    if (nonEmpty(item.goal)) right.push(bodyParagraph(`目标：${item.goal}`));
    for (const bullet of item.bullets) {
      if (bullet.status !== "confirmed") continue;
      if (nonEmpty(bullet.text)) right.push(bulletParagraph(bullet.text));
    }
    return { left, right };
  });
  return [sectionHeading("项目经历"), experienceTable(rows)];
}

function buildSkills(document: ResumeDocument): (Paragraph | Table)[] {
  if (document.skills.length === 0) return [];
  const items: string[] = [];
  for (const group of document.skills) {
    for (const skill of group.items) if (nonEmpty(skill)) items.push(skill);
  }
  if (items.length === 0) return [];
  return [sectionHeading("技能"), badgeTable(items.slice(0, 24))];
}

function buildCertificates(document: ResumeDocument): (Paragraph | Table)[] {
  if (document.certificates.length === 0) return [];
  const out: (Paragraph | Table)[] = [sectionHeading("证书")];
  for (const item of document.certificates) {
    const head = joinNonEmpty([item.name, item.issuer, item.date]);
    if (nonEmpty(head)) out.push(bulletParagraph(head));
  }
  return out;
}

function buildAwards(document: ResumeDocument): (Paragraph | Table)[] {
  if (document.awards.length === 0) return [];
  const out: (Paragraph | Table)[] = [sectionHeading("奖项")];
  for (const item of document.awards) {
    const head = joinNonEmpty([item.name, item.issuer, item.date]);
    if (nonEmpty(head)) out.push(bulletParagraph(head));
    if (nonEmpty(item.description)) out.push(bodyParagraph(item.description));
  }
  return out;
}

function buildSummary(document: ResumeDocument): (Paragraph | Table)[] {
  if (!document.summary) return [];
  const out: (Paragraph | Table)[] = [sectionHeading("自我评价")];
  if (nonEmpty(document.summary.headline)) out.push(bodyParagraph(document.summary.headline));
  for (const bullet of document.summary.bullets) {
    if (bullet.status !== "confirmed") continue;
    if (nonEmpty(bullet.text)) out.push(bulletParagraph(bullet.text));
  }
  return out;
}

export async function buildVisualDocx(document: ResumeDocument): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [
    buildHeader(document),
    new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }),
    ...buildSummary(document),
    ...buildEducation(document),
    ...buildExperiences(document),
    ...buildProjects(document),
    ...buildSkills(document),
    ...buildCertificates(document),
    ...buildAwards(document),
  ];

  const doc = new Document({
    creator: "Resume Coach",
    title: document.title,
    sections: [
      {
        properties: {},
        children: sections.length > 0 ? sections : [bodyParagraph("（空简历）")],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
