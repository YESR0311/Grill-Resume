export type PolishTone = "conservative" | "balanced" | "aggressive";

export const polishTones: { tone: PolishTone; label: string; instruction: string }[] = [
  {
    tone: "conservative",
    label: "保守",
    instruction: "只压缩冗余、修正语序，尽量保留原句信息顺序。",
  },
  {
    tone: "balanced",
    label: "平衡",
    instruction: "强化 STAR/3W 结构，让行动、方法、结果更清楚。",
  },
  {
    tone: "aggressive",
    label: "激进",
    instruction: "在不新增事实、数字、动作的前提下，更突出影响力和岗位匹配度。",
  },
];

export function toneLabel(tone: PolishTone): string {
  return polishTones.find((item) => item.tone === tone)?.label ?? tone;
}
