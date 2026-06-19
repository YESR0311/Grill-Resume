/**
 * PolishRun 排序视图构建器（F2 旧页面迁出）。纯函数、不 mutate 入参。
 *
 * 按价值 tier 排序（high→medium→low→untiered），组内 createdAt 倒序。
 * 新工作区的 PolishCandidatesView 直接消费 PolishRun[]，不经过此排序层。
 */
import type { PolishRun } from "./store";

export type PolishRunTier = "high" | "medium" | "low" | "untiered";

export type PolishRunView = {
  run: PolishRun;
  tier: PolishRunTier;
};

export type PolishRunsView = {
  total: number;
  tierCounts: { high: number; medium: number; low: number; untiered: number };
  runs: PolishRunView[];
};

const tierRank: Record<PolishRunTier, number> = {
  high: 0,
  medium: 1,
  low: 2,
  untiered: 3,
};

export function buildPolishRunsView(input: { runs: PolishRun[] }): PolishRunsView {
  const tierCounts = { high: 0, medium: 0, low: 0, untiered: 0 };

  const views: PolishRunView[] = input.runs.map((run) => {
    const tier: PolishRunTier = run.valueTier ?? "untiered";
    tierCounts[tier] += 1;
    return { run, tier };
  });

  views.sort((a, b) => {
    const rankDelta = tierRank[a.tier] - tierRank[b.tier];
    if (rankDelta !== 0) return rankDelta;
    return b.run.createdAt.localeCompare(a.run.createdAt);
  });

  return { total: views.length, tierCounts, runs: views };
}