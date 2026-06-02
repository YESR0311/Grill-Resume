import "server-only";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ResumeDocument } from "@/features/resume/types";

const BODY_FONT_HALF_POINTS = 22;
const TITLE_FONT_HALF_POINTS = 32;
const SECTION_HEADING_HALF_POINTS = 26;

function nonEmpty(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function plain(text: string): Paragraph {
  return new Paragraph({
    spacing: { line: 276 },
    children: [new TextRun({ text, size: BODY_FONT_HALF_POINTS })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { line: 276 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: BODY_FONT_HALF_POINTS })],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, size: SECTION_HEADING_HALF_POINTS, bold: true })],
  });
}

function joinNonEmpty(parts: (string | undefined)[], sep = " · "): string {
  return parts.filter(nonEmpty).map((item) => item.trim()).join(sep);
}

function buildHeader(document: ResumeDocument): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const name = document.basics.name?.trim() || document.title || "我的简历";
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: name, size: TITLE_FONT_HALF_POINTS, bold: true })],
    }),
  );

  const contactParts: string[] = [];
  if (nonEmpty(document.basics.phone)) contactParts.push(document.basics.phone!);
  if (nonEmpty(document.basics.email)) contactParts.push(document.basics.email!);
  if (nonEmpty(document.basics.city)) contactParts.push(document.basics.city!);
  for (const link of document.basics.links) {
    if (nonEmpty(link.url)) contactParts.push(`${link.label || "链接"}: ${link.url}`);
  }
  if (contactParts.length > 0) paragraphs.push(plain(contactParts.join(" | ")));

  const targetRole = document.basics.targetRole || document.target?.role;
  if (nonEmpty(targetRole)) paragraphs.push(plain(`目标岗位：${targetRole}`));

  return paragraphs;
}

function buildEducation(document: ResumeDocument): Paragraph[] {
  if (document.education.length === 0) return [];
  const out: Paragraph[] = [sectionHeading("教育经历")];
  for (const item of document.education) {
    const head = joinNonEmpty([
      item.school,
      item.degree,
      item.major,
      joinNonEmpty([item.startDate, item.endDate], " - "),
    ]);
    if (nonEmpty(head)) out.push(plain(head));
    const meta: string[] = [];
    if (nonEmpty(item.gpa)) meta.push(`GPA: ${item.gpa}`);
    if (nonEmpty(item.rank)) meta.push(`排名: ${item.rank}`);
    if (meta.length > 0) out.push(plain(meta.join(" | ")));
    if (item.honors && item.honors.length > 0) {
      for (const honor of item.honors) if (nonEmpty(honor)) out.push(bullet(honor));
    }
    if (item.courses && item.courses.length > 0) {
      out.push(plain(`相关课程：${item.courses.filter(nonEmpty).join("，")}`));
    }
  }
  return out;
}

function buildExperiences(document: ResumeDocument): Paragraph[] {
  if (document.experiences.length === 0) return [];
  const out: Paragraph[] = [sectionHeading("工作 / 实习经历")];
  for (const item of document.experiences) {
    const head = joinNonEmpty([
      item.organization,
      item.role,
      item.location,
      joinNonEmpty([item.startDate, item.endDate], " - "),
    ]);
    if (nonEmpty(head)) out.push(plain(head));
    for (const bulletItem of item.bullets) {
      if (bulletItem.status !== "confirmed") continue;
      if (nonEmpty(bulletItem.text)) out.push(bullet(bulletItem.text));
    }
  }
  return out;
}

function buildProjects(document: ResumeDocument): Paragraph[] {
  if (document.projects.length === 0) return [];
  const out: Paragraph[] = [sectionHeading("项目经历")];
  for (const item of document.projects) {
    const head = joinNonEmpty([
      item.name,
      item.role,
      joinNonEmpty([item.startDate, item.endDate], " - "),
    ]);
    if (nonEmpty(head)) out.push(plain(head));
    if (item.techStack.length > 0) {
      out.push(plain(`技术栈：${item.techStack.filter(nonEmpty).join("，")}`));
    }
    if (nonEmpty(item.goal)) out.push(plain(`目标：${item.goal}`));
    for (const bulletItem of item.bullets) {
      if (bulletItem.status !== "confirmed") continue;
      if (nonEmpty(bulletItem.text)) out.push(bullet(bulletItem.text));
    }
  }
  return out;
}

function buildSkills(document: ResumeDocument): Paragraph[] {
  if (document.skills.length === 0) return [];
  const out: Paragraph[] = [sectionHeading("技能")];
  for (const group of document.skills) {
    const items = group.items.filter(nonEmpty);
    if (items.length === 0) continue;
    out.push(plain(`${group.name}：${items.join("，")}`));
  }
  return out;
}

function buildCertificates(document: ResumeDocument): Paragraph[] {
  if (document.certificates.length === 0) return [];
  const out: Paragraph[] = [sectionHeading("证书")];
  for (const item of document.certificates) {
    const head = joinNonEmpty([item.name, item.issuer, item.date]);
    if (nonEmpty(head)) out.push(bullet(head));
  }
  return out;
}

function buildAwards(document: ResumeDocument): Paragraph[] {
  if (document.awards.length === 0) return [];
  const out: Paragraph[] = [sectionHeading("奖项")];
  for (const item of document.awards) {
    const head = joinNonEmpty([item.name, item.issuer, item.date]);
    if (nonEmpty(head)) out.push(bullet(head));
    if (nonEmpty(item.description)) out.push(plain(item.description));
  }
  return out;
}

function buildSummary(document: ResumeDocument): Paragraph[] {
  if (!document.summary) return [];
  const out: Paragraph[] = [sectionHeading("自我评价")];
  if (nonEmpty(document.summary.headline)) out.push(plain(document.summary.headline));
  for (const bulletItem of document.summary.bullets) {
    if (bulletItem.status !== "confirmed") continue;
    if (nonEmpty(bulletItem.text)) out.push(bullet(bulletItem.text));
  }
  return out;
}

export async function buildAtsDocx(document: ResumeDocument): Promise<Buffer> {
  const children: Paragraph[] = [
    ...buildHeader(document),
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
        children: children.length > 0 ? children : [plain("（空简历）")],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
