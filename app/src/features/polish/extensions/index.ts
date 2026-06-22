/**
 * Tiptap 自定义扩展与官方扩展汇总
 *
 * 新增格式（Sprint 4）：
 * 1. FontSize - 字号调整（10pt - 24pt）
 * 2. LetterSpacing - 字间距调整（0 - 5px）
 * 3. FontWeight - 字重调整（300 - 700）
 * 4. LineHeight - 行距调整（1.0 - 2.0）
 * 5. TextAlign - 对齐方式（左/中/右/两端）- 官方扩展
 * 6. FontFamily - 字体切换（serif/sans）- 官方扩展
 *
 * 所有格式在导出 DOCX 时保留（html-runs.ts 映射）
 */

export { FontSize } from "./FontSize";
export { LetterSpacing } from "./LetterSpacing";
export { FontWeight } from "./FontWeight";
export { LineHeight } from "./LineHeight";

// 官方扩展直接导出
export { default as TextAlign } from "@tiptap/extension-text-align";
export { default as FontFamily } from "@tiptap/extension-font-family";
