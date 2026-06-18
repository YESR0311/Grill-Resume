// 单页适配解释的纯 ViewModel（F4）。无副作用、无 server-only、闭网可测。
// 把 B4 fitToSinglePage 产出的 FitDecision[] 翻译成人类可读条目，供 export page 展示
// 「为适配单页裁剪/隐藏了哪些内容、为什么」，落实 evidence-first 的知情原则。
//
// 数据约束（已探查）：
// - FitDecision.blockId === document item id，只针对 experience / project / education 块。
// - snapshot.layoutSchema 是裁剪后的（hide-block 块已移除），所以 blocks 入参必须是
//   export page 重新 projectLayout(document) 得到的未裁剪全集，hide-block 块名才能还原。

import type { FitDecision } from "@/features/layout/adapter";
import type { LayoutBlock } from "@/features/layout/schema";

export type FitExplanationItem = {
  action: FitDecision["action"];
  blockId: string;
  blockLabel: string; // 人类可读块名；未知 id 兜底 "未知板块"
  blockKind: string; // experience | project | education | unknown
  removedCount: number; // removedBulletIds.length（hide-block 恒 0）
  tier: FitDecision["tier"]; // high | medium | low | unrated
};

export type FitExplanationView = {
  hasAdaptation: boolean; // decisions 非空（仅独立调用方有意义；export page 已在调用前守卫 length>0）
  trimmedBulletTotal: number; // 所有 trim-bullets 裁掉的要点总数
  hiddenBlockTotal: number; // 被整块隐藏的板块数
  items: FitExplanationItem[];
};

// 动作排序权重：hide-block 影响最大，排在前。
const actionRank: Record<FitDecision["action"], number> = {
  "hide-block": 0,
  "trim-bullets": 1,
};

/** 按 block 类型提取人类可读名称；非 experience/project/education 不会成为 decision 目标。 */
function blockLabelOf(block: LayoutBlock): { label: string; kind: string } {
  if (block.kind === "experience") {
    const org = block.org.trim();
    const role = block.role.trim();
    const label = [org, role].filter(Boolean).join(" · ") || "未命名经历";
    return { label, kind: "experience" };
  }
  if (block.kind === "project") {
    return { label: block.name.trim() || "未命名项目", kind: "project" };
  }
  // 前向兼容：当前 B4 fitToSinglePage 只对 experience/project 产生决策，education 分支暂不可达；
  // 保留以防后续适配器扩展到教育块时块名仍可还原。
  if (block.kind === "education") {
    const org = block.org.trim();
    const degree = block.degree?.trim();
    const label = degree ? `${org || "未命名教育经历"} · ${degree}` : org || "未命名教育经历";
    return { label, kind: "education" };
  }
  // 防御：header/section-title/profile/skills 无 id，理论上不会被 fit 决策命中。
  return { label: "未知板块", kind: "unknown" };
}

export function buildFitExplanation(input: {
  decisions: FitDecision[];
  blocks: LayoutBlock[];
}): FitExplanationView {
  const { decisions, blocks } = input;

  // 仅带 id 的块（experience/project/education）建索引；其余块无 id，不参与映射。
  const blockById = new Map<string, LayoutBlock>();
  for (const block of blocks) {
    if ("id" in block && typeof block.id === "string") {
      blockById.set(block.id, block);
    }
  }

  const items: FitExplanationItem[] = decisions.map((decision) => {
    const block = blockById.get(decision.blockId);
    const { label, kind } = block ? blockLabelOf(block) : { label: "未知板块", kind: "unknown" };
    return {
      action: decision.action,
      blockId: decision.blockId,
      blockLabel: label,
      blockKind: kind,
      removedCount: decision.removedBulletIds.length,
      tier: decision.tier,
    };
  });

  // 不可变排序（ES2019 起稳定排序，Node 20 / V8 保证）：
  // hide-block 优先 → 同动作内 removedCount 降序 → blockId 字典序兜底。
  items.sort(
    (a, b) =>
      actionRank[a.action] - actionRank[b.action] ||
      b.removedCount - a.removedCount ||
      a.blockId.localeCompare(b.blockId),
  );

  let trimmedBulletTotal = 0;
  let hiddenBlockTotal = 0;
  for (const item of items) {
    if (item.action === "hide-block") hiddenBlockTotal += 1;
    else trimmedBulletTotal += item.removedCount;
  }

  return {
    hasAdaptation: decisions.length > 0,
    trimmedBulletTotal,
    hiddenBlockTotal,
    items,
  };
}
