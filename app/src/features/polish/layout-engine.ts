/**
 * Layout Engine - 基于 @chenglou/pretext 的简历文本测量引擎
 *
 * 用途：实时预览中，对 bullet/段落做无 DOM reflow 的高度与换行预测，
 * 解决「调整字号/边距时浏览器 layout reflow 卡顿」问题。
 *
 * 关键点：
 * - prepare() 缓存字体度量，只跑一次
 * - layout() 纯算术，可频繁调用（每次 style 变更）
 * - 必须运行在浏览器端（依赖 Canvas 上下文做 ground-truth 测量）
 *
 * 使用：
 *   const engine = new LayoutEngine("16px 'PingFang SC', sans-serif");
 *   const h = engine.measureHeight("长文本...", 600, 24);
 *   const lines = engine.layoutLines("长文本...", 600, 24);
 */

import {
  prepare,
  prepareWithSegments,
  layout,
  layoutWithLines,
  measureLineStats,
} from "@chenglou/pretext";

/** 单行布局结果 */
export interface LayoutLineResult {
  text: string;
  width: number;
}

/** 行高+总高测量结果 */
export interface MeasureResult {
  lineCount: number;
  height: number;
  maxLineWidth: number;
}

export class LayoutEngine {
  private preparedCache = new Map<string, ReturnType<typeof prepare>>();
  private baseFont: string;

  constructor(baseFont: string) {
    this.baseFont = baseFont;
  }

  /**
   * 准备一段文本（缓存友好）
   * @param text 输入文本
   * @param font 可选，覆盖默认字体
   */
  private prepareText(
    text: string,
    font?: string,
  ): ReturnType<typeof prepareWithSegments> {
    const key = `${font ?? this.baseFont}::${text}`;
    const cached = this.preparedCache.get(key);
    if (cached) return cached as ReturnType<typeof prepareWithSegments>;
    const prepared = prepareWithSegments(text, font ?? this.baseFont, {
      whiteSpace: "pre-wrap",
    });
    this.preparedCache.set(key, prepared as unknown as ReturnType<typeof prepare>);
    return prepared;
  }

  /**
   * 测量一段文本在指定宽度下的总高度
   * @param text 输入文本
   * @param maxWidth 最大宽度（px）
   * @param lineHeight 行高（px）
   * @param font 可选字体
   */
  measureHeight(text: string, maxWidth: number, lineHeight: number, font?: string): number {
    if (!text) return lineHeight;
    const prepared = this.prepareText(text, font);
    const { height } = layout(prepared, maxWidth, lineHeight);
    return height;
  }

  /**
   * 获取行数 + 总高度 + 最宽一行宽度
   */
  measureFull(text: string, maxWidth: number, lineHeight: number, font?: string): MeasureResult {
    if (!text) return { lineCount: 1, height: lineHeight, maxLineWidth: 0 };
    const prepared = this.prepareText(text, font);
    const stats = measureLineStats(prepared, maxWidth);
    return {
      ...stats,
      height: stats.lineCount * lineHeight,
    };
  }

  /**
   * 列出所有行（用于自定义渲染/Canvas）
   */
  layoutLines(
    text: string,
    maxWidth: number,
    lineHeight: number,
    font?: string,
  ): LayoutLineResult[] {
    if (!text) return [];
    const prepared = this.prepareText(text, font);
    const { lines } = layoutWithLines(prepared, maxWidth, lineHeight);
    return lines.map((l) => ({ text: l.text, width: l.width }));
  }

  /**
   * 清空缓存（当字体族全局切换时调用）
   */
  clearCache(): void {
    this.preparedCache.clear();
  }
}

/**
 * 全局 LayoutEngine 实例（按字体族懒创建）
 */
const engineRegistry = new Map<string, LayoutEngine>();

export function getLayoutEngine(font: string): LayoutEngine {
  let engine = engineRegistry.get(font);
  if (!engine) {
    engine = new LayoutEngine(font);
    engineRegistry.set(font, engine);
  }
  return engine;
}

/**
 * 清空所有 LayoutEngine 缓存（样式主题切换时）
 */
export function clearAllLayoutEngines(): void {
  for (const engine of engineRegistry.values()) {
    engine.clearCache();
  }
  engineRegistry.clear();
}