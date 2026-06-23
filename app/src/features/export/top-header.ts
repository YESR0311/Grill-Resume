import "server-only";

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

import type { ResumeDraft } from "@/features/polish/types";
import type { Theme } from "@/features/polish/themes";
import type { TopHeaderVariant } from "@/features/polish/templates/TopHeader";
import { photoPlaceholderCell, PHOTO_DIMS } from "./photo-placeholder";
import { tintOnWhite } from "./color-util";

/**
 * TopHeader 的 docx-native 渲染（template-exporters 的辅助）。
 *
 * preview 端 TopHeader（templates/TopHeader.tsx）用 `flex items-start` 排版：
 *  - 左侧 flex-1 文字（name + title + email/phone flex-wrap）
 *  - 右侧（photo=right）/ 左侧（photo=left）132×170 证件照
 *
 * docx 端用 1×2 表格模拟 flex 兄弟，靠 cell 顺序决定左右。
 *
 * variant 决定：
 *  - "default" (T1): name 28pt bold + title 14pt + contact 14pt, gap 6/24
 *  - "serif"   (T3/H2): name 32pt Playfair italic weight 600 + title 14pt + contact 14pt
 *  - "compact" (T4): name 28pt bold + title 12pt + contact 12pt, gap 6/16
 *  - "ats"     (A1): name 28pt bold + title 12pt + contact 12pt, gap 4, email|phone 用 " | " 分隔
 */

export const VARIANT_BY_TEMPLATE_ID: Record<string, TopHeaderVariant> = {
  "t1-classic":     "default",
  "t2-modern":      "default",
  "t3-warm":        "serif",
  "t4-compact":     "compact",
  "h1-skills":      "default",
  "h2-achievement": "serif",
  "h3-project":     "default",
  "f1-functional":  "default",
  "a1-ats":         "ats",
};

function hex(s: string): string {
  return s.replace(/^#/, "").toUpperCase();
}

export function renderTopHeader(
  draft: ResumeDraft,
  theme: Theme,
  photo: "left" | "right" | "none",
  variant: TopHeaderVariant,
  contentWidthTwips = 9000,
): (Paragraph | import("docx").Table)[] {
  const serif = variant === "serif";
  const compact = variant === "compact";
  const ats = variant === "ats";
  const accent = hex(theme.accent);
  const primary = hex(theme.primary);
  const serifFont = "Playfair Display";

  // 字号（半磅）
  const nameHalfPts = ats || compact ? 56 /* 28pt */ : serif ? 64 /* 32pt */ : 56 /* 28pt */;
  const titleHalfPts = ats || compact ? 24 /* 12pt */ : 28 /* 14pt */;
  const contactHalfPts = ats || compact ? 22 /* 11pt */ : 28 /* 14pt */;

  const nameFont = serif ? serifFont : theme.fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? theme.fontFamily;

  // 文字内容段落（name / title / contact 各自独立 paragraph）
  const textParagraphs: Paragraph[] = [];

  // 1. Name
  textParagraphs.push(
    new Paragraph({
      spacing: { before: 0, after: 80, line: Math.round(1.2 * 240) },
      children: [
        new TextRun({
          text: draft.name,
          bold: !serif,
          italics: serif,
          color: primary,
          size: nameHalfPts,
          font: nameFont,
        }),
      ],
    }),
  );

  // 2. Title
  if (draft.title) {
    textParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: compact ? 20 : 40, line: 240 },
        children: [
          new TextRun({
            text: draft.title,
            color: accent,
            size: titleHalfPts,
            font: nameFont,
          }),
        ],
      }),
    );
  }

  // 3. Contact (email + phone)
  if (draft.email || draft.phone) {
    if (ats) {
      // ATS 风格：email | phone 同行，用 " | " 分隔
      const text = [draft.email, draft.phone].filter(Boolean).join(" | ");
      textParagraphs.push(
        new Paragraph({
          spacing: { before: 0, after: 0, line: 240 },
          children: [
            new TextRun({ text, color: accent, size: contactHalfPts, font: nameFont }),
          ],
        }),
      );
    } else {
      // 默认：email / phone 各一行（preview 用 flex-wrap，但 rowTable cell 宽度有限时换行；这里两段最稳）
      if (draft.email) {
        textParagraphs.push(
          new Paragraph({
            spacing: { before: 0, after: 20, line: 240 },
            children: [
              new TextRun({ text: draft.email, color: accent, size: contactHalfPts, font: nameFont }),
            ],
          }),
        );
      }
      if (draft.phone) {
        textParagraphs.push(
          new Paragraph({
            spacing: { before: 0, after: 60, line: 240 },
            children: [
              new TextRun({ text: draft.phone, color: accent, size: contactHalfPts, font: nameFont }),
            ],
          }),
        );
      }
    }
  }

  // 无证件照模板 → 直接输出文字段落
  if (photo === "none") {
    return textParagraphs;
  }

  // 有证件照 → 1×2 表格模拟 flex；列宽固定（证件照锁 132px 宽，文字占剩余）。
  const photoW = PHOTO_DIMS.widthTwips;
  const gap = 200;
  const textW = Math.max(2000, contentWidthTwips - photoW - gap);
  const noBorder = {
    top: { style: "none" as const, size: 0, color: "FFFFFF" },
    bottom: { style: "none" as const, size: 0, color: "FFFFFF" },
    left: { style: "none" as const, size: 0, color: "FFFFFF" },
    right: { style: "none" as const, size: 0, color: "FFFFFF" },
  };
  const photoCell = photoPlaceholderCell(primary, tintOnWhite(theme.accent, 0.12)); // accent 浅色填充
  const textCell = new TableCell({
    width: { size: textW, type: WidthType.DXA },
    borders: noBorder,
    verticalAlign: "top",
    margins: { top: 0, bottom: 0, left: photo === "left" ? gap : 0, right: photo === "right" ? gap : 0 },
    children: textParagraphs,
  });

  // docx 表行 cell 顺序决定左右；行高 = 证件照高度，固定列宽防止文字撑变形。
  const cells = photo === "left" ? [photoCell, textCell] : [textCell, photoCell];
  const colWidths = photo === "left" ? [photoW, textW] : [textW, photoW];
  return [
    new Table({
      width: { size: contentWidthTwips, type: WidthType.DXA },
      columnWidths: colWidths,
      borders: {
        ...noBorder,
        insideHorizontal: { style: "none" as const, size: 0, color: "FFFFFF" },
        insideVertical: { style: "none" as const, size: 0, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          // 行高锁 = 证件照高度，避免文字短时证件照被压成横条
          height: { value: PHOTO_DIMS.heightTwips, rule: "atLeast" },
          children: cells,
        }),
      ],
    }),
    // 顶部块与正文留间距
    new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun({ text: "", size: 2 })] }),
  ];
}
