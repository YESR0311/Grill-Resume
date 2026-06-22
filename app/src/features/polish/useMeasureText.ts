"use client";

import { useMemo } from "react";
import { getLayoutEngine, type MeasureResult } from "./layout-engine";

/**
 * useMeasureText - 客户端文本测量 Hook
 *
 * 在浏览器中用 @chenglou/pretext 测量文本在指定宽度下的行数与高度，
 * 避免反复触发 DOM reflow。
 *
 * 适用场景：
 * - StructuredEditor 预览卡片：根据实时样式预测 bullet 的高度
 * - 模板预览：提前知道内容是否会溢出
 * - 自适应容器：根据可用宽度计算字号
 *
 * 失败兜底：pretext 在非浏览器环境会抛错 → 返回默认值，不阻塞渲染。
 *
 * 实现说明：pretext 是同步算术 API，直接用 useMemo 计算即可，
 * 无需 useEffect + setState 异步流程。
 */
export function useMeasureText(
  text: string,
  options: {
    maxWidth: number;
    lineHeight: number;
    font?: string;
  },
): MeasureResult {
  const { maxWidth, lineHeight, font } = options;
  const fontKey = useMemo(() => font ?? "default", [font]);

  return useMemo<MeasureResult>(() => {
    if (typeof window === "undefined") {
      return { lineCount: 1, height: lineHeight, maxLineWidth: 0 };
    }
    try {
      const engine = getLayoutEngine(fontKey);
      return engine.measureFull(text, maxWidth, lineHeight);
    } catch {
      // pretext 失败时保底（不抛、不卡 UI）
      return {
        lineCount: Math.max(1, Math.ceil(text.length / (maxWidth / (lineHeight / 2 || 1)))),
        height: lineHeight,
        maxLineWidth: 0,
      };
    }
  }, [text, maxWidth, lineHeight, fontKey]);
}