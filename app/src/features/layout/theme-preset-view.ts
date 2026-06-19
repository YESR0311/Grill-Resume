// 主题预设的纯视图/应用逻辑（F5）。无副作用、无 server-only、无 "use client"，闭网可测。
// 消费 B4 themes.ts 的 layoutThemePresets（SSoT），供 theme-editor / layout-editor 展示与套用。
//
// 设计约束（已与用户确认）：
// - F6：套用预设记录 themePresetId（轻量 enum 载体），由 applyLayoutOverrides 注入 page.marginsMm；
//   不往 overrides 加完整 margins 对象。
// - 套用预设 = 整体替换 overrides.theme（空 theme → 删字段，回投影默认），不残留先前手调字段。

import type { LayoutOverrides } from "@/features/layout/overrides";
import type { LayoutTheme } from "@/features/layout/schema";
import type { LayoutThemePreset } from "@/features/layout/themes";

/**
 * 把 preset.theme 派生为中文排版摘要 chips（顺序固定，确定性）。
 * 无值的维度跳过；全空（如 clean 的 theme={}）→ ["默认排版"]。
 * 不派生 accentColor（B4 preset 均无）、不展示 marginsMm（F5 不接，避免假承诺）。
 */
export function summarizeThemePreset(preset: LayoutThemePreset): string[] {
  const theme = preset.theme;
  const chips: string[] = [];
  if (theme.fontCJK) chips.push(`正文 ${theme.fontCJK}`);
  if (theme.fontCJKHeading) chips.push(`标题 ${theme.fontCJKHeading}`);
  if (theme.fontLatin) chips.push(`西文 ${theme.fontLatin}`);
  if (typeof theme.baseFontPt === "number") chips.push(`${theme.baseFontPt}pt`);
  if (typeof theme.lineSpacing === "number") chips.push(`行距 ${theme.lineSpacing}`);
  return chips.length > 0 ? chips : ["默认排版"];
}

/**
 * 整体替换 overrides.theme = preset.theme，并记录 themePresetId（F6 注入 margins 的载体）。
 * 浅拷贝产新对象，不改输入。空 theme（clean）→ 删除 theme 字段回投影默认，但 themePresetId
 * 仍记 "clean"（clean preset 无 marginsMm 字段 → 注入时 getLayoutThemePreset 返回 undefined，
 * page 不变回默认边距，行为自洽）。
 * 仅动 theme + themePresetId：blockOrder / hiddenBlocks / bulletOverrides / version / resumeId 原样保留。
 */
export function applyPresetToOverrides(overrides: LayoutOverrides, preset: LayoutThemePreset): LayoutOverrides {
  const theme: Partial<LayoutTheme> = { ...preset.theme };
  const next: LayoutOverrides = { ...overrides, themePresetId: preset.id };
  if (Object.keys(theme).length > 0) next.theme = theme;
  else delete next.theme;
  return next;
}
