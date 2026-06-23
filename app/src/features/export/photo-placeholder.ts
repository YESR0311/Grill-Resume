import "server-only";

import {
  Table,
  TableCell,
  TableRow,
  Paragraph,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

/**
 * 证件照占位符的 docx-native 渲染（template-exporters 的辅助）。
 *
 * preview 端 PhotoPlaceholder 是 132×170 虚线矩形（35×45mm @ 96dpi），
 * 用 1×1 table + 虚线边框 + accent 浅色填充 + 居中文字模拟。
 *
 * 在 TopHeader layout table 里嵌入：与文本 cell 并排成 1×N 表格。
 */

const PX_PER_INCH = 96;
// 132px / 96 = 1.375"  / 1.7" → twips
const PHOTO_WIDTH_TWIPS = Math.round((132 / PX_PER_INCH) * 1440);
const PHOTO_HEIGHT_TWIPS = Math.round((170 / PX_PER_INCH) * 1440);

export const PHOTO_DIMS = {
  widthTwips: PHOTO_WIDTH_TWIPS,
  heightTwips: PHOTO_HEIGHT_TWIPS,
};

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

/** 证件照 cell：虚线 primary 边 + accent 浅色填充 + 「证件照 / 35×45mm」居中文字。 */
export function photoPlaceholderCell(primary: string, accent: string): TableCell {
  return new TableCell({
    width: { size: PHOTO_WIDTH_TWIPS, type: WidthType.DXA },
    verticalAlign: "center",
    shading: { fill: accent, type: "clear" },
    borders: {
      top: { style: BorderStyle.DASHED, size: 6, color: primary },
      bottom: { style: BorderStyle.DASHED, size: 6, color: primary },
      left: { style: BorderStyle.DASHED, size: 6, color: primary },
      right: { style: BorderStyle.DASHED, size: 6, color: primary },
    },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: "证件照", color: primary, size: 18, font: "Microsoft YaHei" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: "35×45mm", color: primary, size: 14, font: "Microsoft YaHei" })],
      }),
    ],
  });
}

/** 单行高度 = 证件照高度的 table 骨架（cell 由调用方提供）。 */
export function photoTable(cells: TableCell[]): Table {
  return new Table({
    width: { size: PHOTO_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [new TableRow({ height: { value: PHOTO_HEIGHT_TWIPS, rule: "atLeast" }, children: cells })],
  });
}

/** 把若干内容单元格并排成 1×N table（用于 TopHeader flex 模拟）。 */
export function rowTable(cells: TableCell[], totalWidthPct = 100): Table {
  return new Table({
    width: { size: totalWidthPct, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [new TableRow({ children: cells })],
  });
}