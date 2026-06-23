import "server-only";

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ResumeDraft, ResumeSectionKey, ResumeStyle } from "@/features/polish/types";
import { ResumeStyleSchema } from "@/features/polish/types";
import { htmlToRuns } from "./html-runs";

/**
 * ResumeDraft → DOCX Buffer（Sprint 6.1）。
 *
 * 关键修复：
 * 1. bullet 文本为 Tiptap HTML，导出前经 htmlToRuns 解析为带格式的 docx run
 *    （<strong>/<em>/<u>/<s>/color → bold/italic/underline/strike/color），剥离 <p> 等标签。
 * 2. 注入 draft.style（字体/字号/颜色/边距/section 顺序），做到所见即所得。
 *
 * 不外发任何网络请求；纯本地生成。docx 内不含绝对路径/密钥（spec database-guidelines 隐私契约）。
 */

const FALLBACK_FONT = "Microsoft YaHei";

type RenderCtx = {
  style: ResumeStyle;
  font: string;
  primary: string; // 标题/强调色（去 #）
  accent: string; // 次要文字色（去 #）
  text: string; // 正文色（去 #）
  bodyHalfPts: number; // 正文字号（半磅）
};

function stripHash(hex: string, fallback: string): string {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? m[1].toUpperCase() : fallback;
}

/** 从 CSS font-family 栈取第一个可用字体名；含中文字体优先保留。 */
function pickFont(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first && first.length > 0 ? first : FALLBACK_FONT;
}

/** px 字号 → docx 半磅（px*0.75pt*2 = px*1.5）。 */
function pxToHalfPts(px: number): number {
  return Math.max(8, Math.round(px * 1.5));
}

/** mm → twips（1mm ≈ 56.6929 twips）。 */
function mmToTwips(mm: number): number {
  return Math.round(mm * 56.6929);
}

function buildCtx(draft: ResumeDraft): RenderCtx {
  const style = ResumeStyleSchema.safeParse(draft.style).success
    ? draft.style
    : ResumeStyleSchema.parse({});
  return {
    style,
    font: pickFont(style.fontFamily),
    primary: stripHash(style.colorScheme.primary, "2F6F73"),
    accent: stripHash(style.colorScheme.accent, "64748B"),
    text: stripHash(style.colorScheme.text, "111827"),
    bodyHalfPts: pxToHalfPts(style.fontSize),
  };
}

function heading(text: string, ctx: RenderCtx): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80, line: Math.round(ctx.style.lineSpacing * 240) },
    border: { bottom: { style: "single", size: 6, color: ctx.primary, space: 2 } },
    children: [
      new TextRun({
        text,
        bold: true,
        size: ctx.bodyHalfPts + 4,
        color: ctx.primary,
        font: ctx.font,
      }),
    ],
  });
}

function bodyRun(
  text: string,
  ctx: RenderCtx,
  opts?: { bold?: boolean; color?: string; size?: number },
): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    color: opts?.color ?? ctx.text,
    size: opts?.size ?? ctx.bodyHalfPts,
    font: ctx.font,
  });
}

/** 把一条 HTML bullet 渲染成 docx 段落（带项目符号），格式标签转 run。 */
function bulletParagraph(html: string, ctx: RenderCtx): Paragraph {
  const runs = htmlToRuns(html, { color: ctx.text, size: ctx.bodyHalfPts, font: ctx.font });
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20, line: Math.round(ctx.style.lineSpacing * 240) },
    children: runs.length > 0 ? runs : [bodyRun("", ctx)],
  });
}

// ─── 各 section 渲染器 ─────────────────────────────────────

function renderSummary(draft: ResumeDraft, ctx: RenderCtx): Paragraph[] {
  if (!draft.summary) return [];
  return [
    heading("个人简介", ctx),
    new Paragraph({
      spacing: { after: 80, line: Math.round(ctx.style.lineSpacing * 240) },
      children: htmlToRuns(draft.summary, { color: ctx.text, size: ctx.bodyHalfPts, font: ctx.font }),
    }),
  ];
}

function renderWorkExperience(draft: ResumeDraft, ctx: RenderCtx): Paragraph[] {
  if (draft.workExperience.items.length === 0) return [];
  const out: Paragraph[] = [heading(draft.workExperience.title || "工作经历", ctx)];
  for (const item of draft.workExperience.items) {
    out.push(
      new Paragraph({
        spacing: { before: 80, after: 20 },
        children: [
          bodyRun(`${item.role}`, ctx, { bold: true }),
          bodyRun(`  ${item.organization}`, ctx, { color: ctx.accent }),
          bodyRun(`    ${item.startDate} - ${item.endDate}`, ctx, { color: ctx.accent, size: ctx.bodyHalfPts - 3 }),
        ],
      }),
    );
    for (const b of item.bullets) out.push(bulletParagraph(b.text, ctx));
  }
  return out;
}

function renderProjects(draft: ResumeDraft, ctx: RenderCtx): Paragraph[] {
  if (draft.projects.items.length === 0) return [];
  const out: Paragraph[] = [heading(draft.projects.title || "项目经历", ctx)];
  for (const item of draft.projects.items) {
    out.push(
      new Paragraph({
        spacing: { before: 80, after: 20 },
        children: [bodyRun(`${item.organization || item.role}`, ctx, { bold: true })],
      }),
    );
    for (const b of item.bullets) out.push(bulletParagraph(b.text, ctx));
  }
  return out;
}

function renderEducation(draft: ResumeDraft, ctx: RenderCtx): Paragraph[] {
  if (draft.education.items.length === 0) return [];
  const out: Paragraph[] = [heading(draft.education.title || "教育背景", ctx)];
  for (const item of draft.education.items) {
    out.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [
          bodyRun(`${item.organization}`, ctx, { bold: true }),
          bodyRun(`  ${item.role}`, ctx, { color: ctx.accent }),
          bodyRun(`    ${item.startDate} - ${item.endDate}`, ctx, { color: ctx.accent, size: ctx.bodyHalfPts - 3 }),
        ],
      }),
    );
  }
  return out;
}

function renderSkills(draft: ResumeDraft, ctx: RenderCtx): Paragraph[] {
  if (draft.skills.length === 0) return [];
  return [
    heading("技能", ctx),
    new Paragraph({ spacing: { after: 80 }, children: [bodyRun(draft.skills.join("  ·  "), ctx)] }),
  ];
}

const SECTION_RENDERERS: Record<ResumeSectionKey, (d: ResumeDraft, c: RenderCtx) => Paragraph[]> = {
  summary: renderSummary,
  workExperience: renderWorkExperience,
  projects: renderProjects,
  education: renderEducation,
  skills: renderSkills,
};

export async function buildDraftDocx(draft: ResumeDraft): Promise<Buffer> {
  const ctx = buildCtx(draft);
  const children: Paragraph[] = [];

  // ─── 头部 ───
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: draft.name || "未命名", bold: true, size: ctx.bodyHalfPts + 18, color: ctx.text, font: ctx.font }),
      ],
    }),
  );
  if (draft.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [bodyRun(draft.title, ctx, { color: ctx.accent, size: ctx.bodyHalfPts + 1 })],
      }),
    );
  }
  const contact = [draft.email, draft.phone].filter(Boolean).join("  ·  ");
  if (contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [bodyRun(contact, ctx, { color: ctx.accent, size: ctx.bodyHalfPts - 3 })],
      }),
    );
  }

  // ─── 按模板 sectionOrder 渲染正文 ───
  for (const key of ctx.style.sectionOrder) {
    const renderer = SECTION_RENDERERS[key];
    if (renderer) children.push(...renderer(draft, ctx));
  }

  const m = ctx.style.margins;
  const doc = new Document({
    sections: [
      {
        properties: {
          // 强制 A4 竖版（210mm × 297mm）。
          // 此前未显式设 size，docx 默认 Letter portrait，HR 国内/欧洲导出排版错位。
          page: {
            size: {
              orientation: "portrait",
              width: mmToTwips(210),
              height: mmToTwips(297),
            },
            margin: {
              top: mmToTwips(m.top),
              bottom: mmToTwips(m.bottom),
              left: mmToTwips(m.left),
              right: mmToTwips(m.right),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
