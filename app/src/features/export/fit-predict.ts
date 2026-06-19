/**
 * 客户端单页 fit 预测（M4），基于 @chenglou/pretext 的 OffscreenCanvas 真实测高。
 *
 * 服务端 fitToSinglePage() 用字符宽度粗估（CJK=1, latin=0.5 unit），
 * 这里用 pretext 测量实际渲染高度，作为"第二意见"校验。
 *
 * 仅在浏览器运行（SSR 返回 null），调用方降级展示占位。
 *
 * 与 ui/adapter.ts 的差异：
 *  - adapter：服务端、确定性、无 DOM、基于字符宽度估算
 *  - fit-predict：客户端、实际 Canvas 测高、考虑字体真实 metrics
 */

"use client";

import { measureStackedHeight, type FontSpec } from "@/lib/pretext/measure";
import type { LayoutBlock, LayoutSchema } from "@/features/layout/schema";

const A4_MM = { width: 210, height: 297 };
const MM_TO_PX = 96 / 25.4;
const PT_TO_PX = 96 / 72;

/** 段间距（mm），在相邻 block 之间加入。 */
const BLOCK_GAP_MM = 1;
/** bullet 相对内容宽度的缩进比例。 */
const BULLET_INDENT_RATIO = 0.92;

export type FitPredictionResult = {
  /** 内容总高度（px），含段间距。 */
  contentHeightPx: number;
  /** 单页容量（px），由 margins 和纸张尺寸计算。 */
  pageCapacityPx: number;
  /** 内容高度百分比（0-200+），≥100 即溢出。 */
  usedPercent: number;
  /** 是否在一页内放得下。 */
  fitsOnOnePage: boolean;
  /** 估算页数。 */
  estimatedPageCount: number;
  /** 是否已完成真实测量（非 SSR 降级）。 */
  measured: true;
};

function themeToFontSpec(theme: LayoutSchema["theme"]): FontSpec {
  const fontSizePx = theme.baseFontPt * PT_TO_PX;
  return {
    font: `${fontSizePx}px "${theme.fontCJK}", ${theme.fontLatin}, sans-serif`,
    lineHeight: fontSizePx * theme.lineSpacing,
  };
}

/** 标题字号 = 基础字号 + 1pt */
function titleFontSpec(theme: LayoutSchema["theme"]): FontSpec {
  const base = themeToFontSpec(theme);
  const fontSizePx = (theme.baseFontPt + 1) * PT_TO_PX;
  return { ...base, font: `${fontSizePx}px "${theme.fontCJK}", ${theme.fontLatin}, sans-serif` };
}

/**
 * 用 pretext 实测 LayoutSchema 的内容高度，判断是否能在单页 A4 内排布。
 *
 * @returns 非浏览器环境返回 null（SSR 降级）。
 */
export function predictFitWithPretext(schema: LayoutSchema): FitPredictionResult | null {
  if (typeof window === "undefined" && typeof OffscreenCanvas === "undefined") return null;

  const { page, theme, blocks } = schema;
  const contentWidthMm = page.size === "A4"
    ? A4_MM.width - page.marginsMm.left - page.marginsMm.right
    : A4_MM.width - 40;
  const contentHeightMm = page.size === "A4"
    ? A4_MM.height - page.marginsMm.top - page.marginsMm.bottom
    : A4_MM.height - 40;
  const contentWidthPx = contentWidthMm * MM_TO_PX;
  const pageCapacityPx = contentHeightMm * MM_TO_PX;
  const blockGapPx = BLOCK_GAP_MM * MM_TO_PX;

  const bodySpec = themeToFontSpec(theme);
  const titleSpec = titleFontSpec(theme);

  // 收集所有文本段供 pretext 测量
  const segments: Array<{ text: string; maxWidth: number; spec: FontSpec }> = [];

  for (const block of blocks) {
    collectSegments(block, segments, contentWidthPx, bodySpec, titleSpec);
  }

  const totalHeightPx = measureStackedHeight(segments, blockGapPx);
  if (totalHeightPx === null) return null;

  const usedPercent = (totalHeightPx / pageCapacityPx) * 100;

  return {
    contentHeightPx: totalHeightPx,
    pageCapacityPx,
    usedPercent,
    fitsOnOnePage: totalHeightPx <= pageCapacityPx,
    estimatedPageCount: Math.ceil(totalHeightPx / pageCapacityPx),
    measured: true,
  };
}

// ─── 内部：各 block kind 的文本提取 ────────────────────────────

function collectSegments(
  block: LayoutBlock,
  out: Array<{ text: string; maxWidth: number; spec: FontSpec }>,
  contentWidthPx: number,
  bodySpec: FontSpec,
  titleSpec: FontSpec,
): void {
  const bulletWidth = contentWidthPx * BULLET_INDENT_RATIO;

  switch (block.kind) {
    case "header":
      out.push({ text: block.name, maxWidth: contentWidthPx, spec: titleSpec });
      for (const line of block.metaLines) {
        out.push({ text: line, maxWidth: contentWidthPx, spec: bodySpec });
      }
      break;

    case "section-title":
      out.push({ text: block.zh, maxWidth: contentWidthPx, spec: bodySpec });
      break;

    case "profile":
      if (block.headline) {
        out.push({ text: block.headline, maxWidth: contentWidthPx, spec: bodySpec });
      }
      for (const bullet of block.bullets) {
        out.push({ text: bullet.displayTextOverride ?? bullet.text, maxWidth: bulletWidth, spec: bodySpec });
      }
      break;

    case "experience":
      out.push({ text: `${block.role} @ ${block.org}`, maxWidth: contentWidthPx, spec: titleSpec });
      for (const bullet of block.bullets) {
        out.push({ text: bullet.displayTextOverride ?? bullet.text, maxWidth: bulletWidth, spec: bodySpec });
      }
      break;

    case "project":
      out.push({ text: block.name, maxWidth: contentWidthPx, spec: titleSpec });
      for (const detail of block.details) {
        out.push({ text: detail.text, maxWidth: contentWidthPx, spec: bodySpec });
      }
      for (const bullet of block.bullets) {
        out.push({ text: bullet.displayTextOverride ?? bullet.text, maxWidth: bulletWidth, spec: bodySpec });
      }
      break;

    case "education":
      out.push({
        text: block.org + (block.degree ? ` · ${block.degree}` : ""),
        maxWidth: contentWidthPx,
        spec: titleSpec,
      });
      if (block.meta) {
        out.push({ text: block.meta, maxWidth: contentWidthPx, spec: bodySpec });
      }
      for (const note of block.notes) {
        out.push({ text: note.text, maxWidth: contentWidthPx, spec: bodySpec });
      }
      break;

    case "skills":
      for (const group of block.groups) {
        out.push({
          text: `${group.label}：${group.items.join("，")}`,
          maxWidth: contentWidthPx,
          spec: bodySpec,
        });
      }
      for (const extra of block.extras) {
        out.push({ text: extra.text, maxWidth: contentWidthPx, spec: bodySpec });
      }
      break;
  }
}