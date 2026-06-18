import type { ExperienceValueRating } from "@/features/pipeline/types";
import { layoutBlockKey } from "./overrides";
import type { LayoutBlock, LayoutBullet, LayoutSchema } from "./schema";

/**
 * 单页适配器（B4，design §4）。纯函数、无 IO、确定性：
 * 禁 Date.now / Math.random / Map 迭代序依赖；同输入同输出。
 * 估算不追求渲染级精确，目标是"确定性 + 单调 + 明显溢出可检"。
 */

const A4_HEIGHT_MM = 297;
const A4_WIDTH_MM = 210;
const PT_TO_MM = 0.3528;

/** block 固定开销查表（标题行 + before/after 间距折算行数）。 */
const FIXED_LINES = {
  header: 4,
  sectionTitle: 2,
  entryTitle: 1,
} as const;

/** trim-bullets 裁剪下限：每个 block 至少保留的 bullet 条数。 */
const MIN_BULLETS_PER_BLOCK = 2;

/** CJK 全宽字符（含 CJK 统一表意、扩展 A、兼容表意、全宽标点/符号）。 */
const CJK_CHAR = /[\u2E80-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

export type LineEstimate = {
  totalLines: number;
  pageCapacityLines: number;
  /** blockKey 为 layoutBlockKey() 格式（如 "experience:exp-1"），与 FitDecision.blockId（裸 block.id）不同。 */
  blockLines: Array<{ blockKey: string; lines: number }>;
};

export type FitDecision = {
  action: "trim-bullets" | "hide-block";
  blockId: string;
  /** hide-block 时为空数组。 */
  removedBulletIds: string[];
  tier: "high" | "medium" | "low" | "unrated";
};

export type FitResult = {
  schema: LayoutSchema;
  decisions: FitDecision[];
  overflow: boolean;
  estimate: LineEstimate;
};

function textWidthUnits(text: string): number {
  let width = 0;
  for (const char of text) width += CJK_CHAR.test(char) ? 1 : 0.5;
  return width;
}

function textLines(text: string | undefined, capacity: number): number {
  const trimmed = text?.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(textWidthUnits(trimmed) / capacity));
}

function bulletLines(bullets: LayoutBullet[], capacity: number): number {
  return bullets.reduce(
    (sum, item) => sum + Math.max(1, textLines(item.displayTextOverride?.trim() || item.text, capacity)),
    0,
  );
}

function estimateBlockLines(block: LayoutBlock, capacity: number): number {
  if (block.kind === "header") return FIXED_LINES.header;
  if (block.kind === "section-title") return FIXED_LINES.sectionTitle;
  if (block.kind === "profile") {
    return textLines(block.headline, capacity) + bulletLines(block.bullets, capacity);
  }
  if (block.kind === "experience") {
    return FIXED_LINES.entryTitle + bulletLines(block.bullets, capacity);
  }
  if (block.kind === "project") {
    return (
      FIXED_LINES.entryTitle +
      block.details.reduce((sum, item) => sum + textLines(item.text, capacity), 0) +
      bulletLines(block.bullets, capacity)
    );
  }
  if (block.kind === "education") {
    return (
      FIXED_LINES.entryTitle +
      textLines(block.meta, capacity) +
      block.notes.reduce((sum, item) => sum + textLines(item.text, capacity), 0)
    );
  }
  // skills 无 entry-title 固定开销（有意为之）：其标题由独立的 section-title block 承担，
  // groups 直接按 "label：items" 文本行渲染，无额外标题行。
  return (
    block.groups.reduce((sum, group) => sum + textLines(`${group.label}：${group.items.join("，")}`, capacity), 0) +
    block.extras.reduce((sum, item) => sum + textLines(item.text, capacity), 0)
  );
}

export function estimateSchemaLines(schema: LayoutSchema): LineEstimate {
  const { top, right, bottom, left } = schema.page.marginsMm;
  const lineHeightMm = Math.max(0.1, schema.theme.baseFontPt * schema.theme.lineSpacing * PT_TO_MM);
  const pageCapacityLines = Math.max(1, Math.floor((A4_HEIGHT_MM - top - bottom) / lineHeightMm));
  const fullWidthCharMm = Math.max(0.1, schema.theme.baseFontPt * PT_TO_MM);
  const capacity = Math.max(1, Math.floor((A4_WIDTH_MM - left - right) / fullWidthCharMm));
  const blockLines = schema.blocks.map((block, index) => ({
    blockKey: layoutBlockKey(block, index),
    lines: estimateBlockLines(block, capacity),
  }));
  return {
    totalLines: blockLines.reduce((sum, item) => sum + item.lines, 0),
    pageCapacityLines,
    blockLines,
  };
}

type RatedTier = ExperienceValueRating["tier"];

export function fitToSinglePage(schema: LayoutSchema, ratings?: ExperienceValueRating[]): FitResult {
  const initial = estimateSchemaLines(schema);
  if (initial.totalLines <= initial.pageCapacityLines) {
    return { schema, decisions: [], overflow: false, estimate: initial };
  }

  const tiers = new Map<string, RatedTier>();
  for (const rating of ratings ?? []) tiers.set(rating.experienceId, rating.tier);

  const blocks: LayoutBlock[] = [...schema.blocks];
  const decisions: FitDecision[] = [];
  const estimate = () => estimateSchemaLines({ ...schema, blocks });
  const fits = () => {
    const current = estimate();
    return current.totalLines <= current.pageCapacityLines;
  };

  // 阶梯 1/2：bullet 逐条从尾部删、每删一条重估、fits 即停——只裁必要数量，
  // 不一步裁到下限（removedBulletIds 反映真实压缩量，按删除顺序即尾部先）。
  // 逆序处理 block（尾部先收紧），同 tier 内确定性。
  const trimPass = (allowed: Array<FitDecision["tier"]>): boolean => {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      if (block.kind !== "experience" && block.kind !== "project") continue;
      const tier: FitDecision["tier"] = tiers.get(block.id) ?? "unrated";
      if (!allowed.includes(tier)) continue;
      if (block.bullets.length <= MIN_BULLETS_PER_BLOCK) continue;
      const removedBulletIds: string[] = [];
      let bullets = block.bullets;
      let fitted = false;
      while (bullets.length > MIN_BULLETS_PER_BLOCK) {
        removedBulletIds.push(bullets[bullets.length - 1]!.bulletId);
        bullets = bullets.slice(0, -1);
        blocks[index] = { ...block, bullets };
        if (fits()) {
          fitted = true;
          break;
        }
      }
      decisions.push({ action: "trim-bullets", blockId: block.id, removedBulletIds, tier });
      if (fitted) return true;
    }
    return false;
  };

  // 阶梯 3：tier=low 的 experience/project block 整块隐藏；high tier 与
  // header/section-title/profile/education/skills 永不删除。
  const hideLowPass = (): boolean => {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      if (block.kind !== "experience" && block.kind !== "project") continue;
      const tier = tiers.get(block.id) ?? "unrated";
      if (tier !== "low") continue;
      blocks.splice(index, 1);
      decisions.push({ action: "hide-block", blockId: block.id, removedBulletIds: [], tier });
      if (fits()) return true;
    }
    return false;
  };

  // unrated 视同 medium（对齐 B3 orderEligibleBulletsByValue 语义）。
  void (trimPass(["low"]) || trimPass(["unrated", "medium"]) || hideLowPass());

  const finalEstimate = estimate();
  return {
    schema: { ...schema, blocks },
    decisions,
    overflow: finalEstimate.totalLines > finalEstimate.pageCapacityLines,
    estimate: finalEstimate,
  };
}
