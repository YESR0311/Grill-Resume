import type { LayoutBlock, LayoutSchema, LayoutTheme } from "./schema";

export const LAYOUT_OVERRIDES_VERSION = "layout-overrides-v1" as const;

export type LayoutOverrides = {
  version: typeof LAYOUT_OVERRIDES_VERSION;
  resumeId: string;
  blockOrder?: string[];
  hiddenBlocks?: string[];
  theme?: Partial<LayoutTheme>;
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
  if (hasText(fontCJK)) out.fontCJK = fontCJK;
  const fontLatin = typeof input.fontLatin === "string" ? input.fontLatin.trim() : undefined;
  if (hasText(fontLatin)) out.fontLatin = fontLatin;
  if (typeof input.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accentColor.trim())) {
    out.accentColor = input.accentColor.trim();
  }
  const baseFontPt = clampNumber(input.baseFontPt, 8, 14);
  if (typeof baseFontPt === "number") out.baseFontPt = baseFontPt;
  const lineSpacing = clampNumber(input.lineSpacing, 1, 1.6);
  if (typeof lineSpacing === "number") out.lineSpacing = lineSpacing;
  return Object.keys(out).length > 0 ? out : undefined;
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
  return {
    ...schema,
    theme: {
      ...schema.theme,
      ...overrides.theme,
    },
    blocks,
  };
}
