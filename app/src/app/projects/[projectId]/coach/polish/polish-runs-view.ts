import type { PolishRun } from "@/features/polish/store";

// type-only import：PolishRun 来自 server-only store，但类型在 erase 后无运行时依赖，
// 故本模块为纯函数、闭网可测（不渲染 React、不出网、不读文件）。

export type PolishRunTier = "high" | "medium" | "low" | "untiered";

export type PolishRunView = {
  run: PolishRun;
  tier: PolishRunTier;
};

export type PolishRunsView = {
  total: number;
  tierCounts: { high: number; medium: number; low: number; untiered: number };
  // 重排：high → medium → low → untiered；组内 createdAt 倒序（沿用 store 现状，避免组内漂移）。
  runs: PolishRunView[];
};

const tierRank: Record<PolishRunTier, number> = {
  high: 0,
  medium: 1,
  low: 2,
  untiered: 3,
};

/**
 * 把 listPolishRuns 的 PolishRun[] 转成按价值 tier 分组排序的只读视图。
 * 纯函数、不 mutate 入参（用副本排序）。降级规则见 design §2：valueTier 缺省 → "untiered"，不丢行。
 */
export function buildPolishRunsView(input: { runs: PolishRun[] }): PolishRunsView {
  const tierCounts = { high: 0, medium: 0, low: 0, untiered: 0 };

  const views: PolishRunView[] = input.runs.map((run) => {
    const tier: PolishRunTier = run.valueTier ?? "untiered";
    tierCounts[tier] += 1;
    return { run, tier };
  });

  // Array.prototype.sort 自 ES2019 起规范保证稳定排序（Node 20 / V8 保证）；
  // tier 相等时按 createdAt 降序，组内顺序确定、不漂移。
  views.sort((a, b) => {
    const rankDelta = tierRank[a.tier] - tierRank[b.tier];
    if (rankDelta !== 0) return rankDelta;
    return b.run.createdAt.localeCompare(a.run.createdAt);
  });

  return {
    total: views.length,
    tierCounts,
    runs: views,
  };
}
