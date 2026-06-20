import "server-only";

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ResumeDraft } from "@/features/polish/types";

/**
 * ResumeDraft → DOCX Buffer（独立轻量生成器，不耦合旧 layout schema）。
 * 中文简洁风：姓名居中标题，分节标题，要点列表。
 */

const ACCENT = "2F6F73"; // teal
const MUTED = "64748B";
const DARK = "111827";
const FONT_CJK = "Microsoft YaHei";

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: "single", size: 6, color: ACCENT, space: 2 } },
    children: [
      new TextRun({ text, bold: true, size: 24, color: ACCENT, font: FONT_CJK }),
    ],
  });
}

function bodyRun(text: string, opts?: { bold?: boolean; color?: string; size?: number }): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    color: opts?.color ?? DARK,
    size: opts?.size ?? 21,
    font: FONT_CJK,
  });
}

export async function buildDraftDocx(draft: ResumeDraft): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ─── 头部 ───
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: draft.name || "未命名", bold: true, size: 40, color: DARK, font: FONT_CJK })],
    }),
  );
  if (draft.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [bodyRun(draft.title, { color: MUTED, size: 22 })],
      }),
    );
  }
  const contact = [draft.email, draft.phone].filter(Boolean).join("  ·  ");
  if (contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [bodyRun(contact, { color: MUTED, size: 18 })],
      }),
    );
  }

  // ─── 个人简介 ───
  if (draft.summary) {
    children.push(heading("个人简介"));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [bodyRun(draft.summary)] }));
  }

  // ─── 工作经历 ───
  if (draft.workExperience.items.length > 0) {
    children.push(heading(draft.workExperience.title || "工作经历"));
    for (const item of draft.workExperience.items) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [
            bodyRun(`${item.role}`, { bold: true }),
            bodyRun(`  ${item.organization}`, { color: MUTED }),
            bodyRun(`    ${item.startDate} - ${item.endDate}`, { color: MUTED, size: 18 }),
          ],
        }),
      );
      for (const b of item.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20 },
            children: [bodyRun(b.text)],
          }),
        );
      }
    }
  }

  // ─── 项目经历 ───
  if (draft.projects.items.length > 0) {
    children.push(heading(draft.projects.title || "项目经历"));
    for (const item of draft.projects.items) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [
            bodyRun(`${item.organization || item.role}`, { bold: true }),
          ],
        }),
      );
      for (const b of item.bullets) {
        children.push(
          new Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [bodyRun(b.text)] }),
        );
      }
    }
  }

  // ─── 教育背景 ───
  if (draft.education.items.length > 0) {
    children.push(heading(draft.education.title || "教育背景"));
    for (const item of draft.education.items) {
      children.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [
            bodyRun(`${item.organization}`, { bold: true }),
            bodyRun(`  ${item.role}`, { color: MUTED }),
            bodyRun(`    ${item.startDate} - ${item.endDate}`, { color: MUTED, size: 18 }),
          ],
        }),
      );
    }
  }

  // ─── 技能 ───
  if (draft.skills.length > 0) {
    children.push(heading("技能"));
    children.push(
      new Paragraph({ spacing: { after: 80 }, children: [bodyRun(draft.skills.join("  ·  "))] }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}