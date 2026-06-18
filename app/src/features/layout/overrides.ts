import type { LayoutBlock, LayoutSchema, LayoutTheme } from "./schema";
import { getLayoutThemePreset, type LayoutThemePreset } from "./themes";

export const LAYOUT_OVERRIDES_VERSION = "layout-overrides-v1" as const;

export type LayoutOverrides = {
  version: typeof LAYOUT_OVERRIDES_VERSION;
  resumeId: string;
  blockOrder?: string[];
  hiddenBlocks?: string[];
  theme?: Partial<LayoutTheme>;
  // F6：主题预设 id，跨路径（编辑器预览 / 手动导出 / pipeline 导出）注入 page.marginsMm 的
  // 唯一持久化载体。仅 enum，远轻于完整 margins 对象。
  // 语义边界：此字段是「边距锚点」，不是「theme 完全等于该预设」的断言——套预设后手调字体/颜色
  // （updateTheme）会改 theme 但保留 themePresetId，使边距仍锁定所选布局密度（直觉一致）。
  // 消费方勿据此推断 theme 仍等于预设；若要「当前激活预设」高亮，需另行比对 theme 内容。
  themePresetId?: LayoutThemePreset["id"];
  bulletOverrides?: Record<string, string>;
  updatedAt?: string;
};

export type KeyedLayoutBlock = {
  key: string;
  block: LayoutBlock;
  hidden: boolean;
};

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (!hasText(typeof item === "string" ? item : undefined)) continue;
    const trimmed = item.trim();
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out.length > 0 ? out : undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!hasText(key) || typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0 && trimmed.length <= 800) out[key.trim()] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function themeOverride(value: unknown): Partial<LayoutTheme> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Partial<Record<keyof LayoutTheme, unknown>>;
  const out: Partial<LayoutTheme> = {};
  const fontCJK = typeof input.fontCJK === "string" ? input.fontCJK.trim() : undefined;
  if (hasText(fontCJK) && fontCJK.length <= 120) out.fontCJK = fontCJK;
  const fontLatin = typeof input.fontLatin === "string" ? input.fontLatin.trim() : undefined;
  if (hasText(fontLatin) && fontLatin.length <= 120) out.fontLatin = fontLatin;
  if (typeof input.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accentColor.trim())) {
    out.accentColor = input.accentColor.trim();
  }
  const baseFontPt = clampNumber(input.baseFontPt, 8, 14);
  if (typeof baseFontPt === "number") out.baseFontPt = baseFontPt;
  const lineSpacing = clampNumber(input.lineSpacing, 1, 1.6);
  if (typeof lineSpacing === "number") out.lineSpacing = lineSpacing;
  const fontCJKHeading = typeof input.fontCJKHeading === "string" ? input.fontCJKHeading.trim() : undefined;
  if (hasText(fontCJKHeading) && fontCJKHeading.length <= 120) out.fontCJKHeading = fontCJKHeading;
  const headingFontPt = clampNumber(input.headingFontPt, 8, 22);
  if (typeof headingFontPt === "number") out.headingFontPt = headingFontPt;
  const sectionSpacingPt = clampNumber(input.sectionSpacingPt, 0, 30);
  if (typeof sectionSpacingPt === "number") out.sectionSpacingPt = sectionSpacingPt;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * F6：主题预设 id 白名单校验（纯函数，闭网可测；export 供验收脚本直接断言，src 内仅经
 * normalizeLayoutOverrides 间接使用）。白名单 = SSoT layoutThemePresets，新增预设自动纳入，
 * 无需同步维护字面量（避免类型扩展后硬编码漏判）。非字符串 / 未命中 → undefined，投影回默认边距。
 */
export function normalizeThemePresetId(value: unknown): LayoutThemePreset["id"] | undefined {
  if (typeof value !== "string") return undefined;
  return getLayoutThemePreset(value)?.id;
}

export function createDefaultLayoutOverrides(resumeId: string): LayoutOverrides {
  return {
    version: LAYOUT_OVERRIDES_VERSION,
    resumeId,
  };
}

export function normalizeLayoutOverrides(value: unknown, resumeId: string): LayoutOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createDefaultLayoutOverrides(resumeId);
  const input = value as Partial<LayoutOverrides>;
  if (input.version !== LAYOUT_OVERRIDES_VERSION) return createDefaultLayoutOverrides(resumeId);
  const normalized: LayoutOverrides = {
    version: LAYOUT_OVERRIDES_VERSION,
    resumeId,
  };
  const blockOrder = uniqueStrings(input.blockOrder);
  if (blockOrder) normalized.blockOrder = blockOrder;
  const hiddenBlocks = uniqueStrings(input.hiddenBlocks);
  if (hiddenBlocks) normalized.hiddenBlocks = hiddenBlocks;
  const theme = themeOverride(input.theme);
  if (theme) normalized.theme = theme;
  const themePresetId = normalizeThemePresetId(input.themePresetId);
  if (themePresetId) normalized.themePresetId = themePresetId;
  const bulletOverrides = stringRecord(input.bulletOverrides);
  if (bulletOverrides) normalized.bulletOverrides = bulletOverrides;
  if (hasText(input.updatedAt)) normalized.updatedAt = input.updatedAt.trim();
  return normalized;
}

export function layoutBlockKey(block: LayoutBlock, index = 0): string {
  if (block.kind === "header") return "header";
  if (block.kind === "section-title") return `section:${(block.en ?? block.zh).toLowerCase()}`;
  if (block.kind === "profile") return "profile";
  if (block.kind === "experience") return `experience:${block.id}`;
  if (block.kind === "project") return `project:${block.id}`;
  if (block.kind === "education") return `education:${block.id}`;
  if (block.kind === "skills") return "skills";
  return `block:${index}`;
}

function applyBulletOverrides(block: LayoutBlock, bulletOverrides: Record<string, string> | undefined): LayoutBlock {
  if (!bulletOverrides || Object.keys(bulletOverrides).length === 0) return block;
  if (block.kind !== "profile" && block.kind !== "experience" && block.kind !== "project") return block;
  return {
    ...block,
    bullets: block.bullets.map((bullet) => ({
      ...bullet,
      displayTextOverride: bulletOverrides[bullet.bulletId],
    })),
  };
}

export function orderedLayoutBlocks(schema: LayoutSchema, overrides?: LayoutOverrides): KeyedLayoutBlock[] {
  const keyed = schema.blocks.map((block, index) => ({
    key: layoutBlockKey(block, index),
    block,
    hidden: false,
  }));
  const byKey = new Map(keyed.map((item) => [item.key, item]));
  const seen = new Set<string>();
  const ordered: KeyedLayoutBlock[] = [];

  for (const key of overrides?.blockOrder ?? []) {
    const item = byKey.get(key);
    if (!item || seen.has(key)) continue;
    ordered.push(item);
    seen.add(key);
  }
  for (const item of keyed) {
    if (!seen.has(item.key)) ordered.push(item);
  }

  const hidden = new Set(overrides?.hiddenBlocks ?? []);
  return ordered.map((item) => ({ ...item, hidden: hidden.has(item.key) }));
}

export function applyLayoutOverrides(schema: LayoutSchema, overrides?: LayoutOverrides): LayoutSchema {
  if (!overrides) return schema;
  const blocks = orderedLayoutBlocks(schema, overrides)
    .filter((item) => !item.hidden)
    .map((item) => applyBulletOverrides(item.block, overrides.bulletOverrides));
  // F6：所选预设若带 marginsMm（classic/compact）则覆盖页边距；clean 无 marginsMm、
  // 无 themePresetId、非法值均回默认边距。浅拷贝产新 page，不改输入 schema。
  const presetMargins = overrides.themePresetId
    ? getLayoutThemePreset(overrides.themePresetId)?.marginsMm
    : undefined;
  return {
    ...schema,
    page: presetMargins ? { ...schema.page, marginsMm: presetMargins } : schema.page,
    theme: {
      ...schema.theme,
      ...overrides.theme,
    },
    blocks,
  };
}
