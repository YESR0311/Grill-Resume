import { polishTones } from "./tone";

export function buildPolishPrompt(input: {
  sourceBullet: string;
  evidenceSnippets: string[];
  jdContext?: string;
}): string {
  const evidence = input.evidenceSnippets.length > 0 ? input.evidenceSnippets.join("\n- ") : "无额外证据，只能使用原 bullet。";
  const tones = polishTones.map((item) => `${item.tone}: ${item.instruction}`).join("\n");
  return `你是中文简历润色助手。只基于给定事实改写，不得新增数字、动作、日期、职位、公司、技术栈或结果。\n\n原 bullet:\n${input.sourceBullet}\n\n可用证据:\n- ${evidence}\n\nJD 上下文:\n${input.jdContext || "无"}\n\n请输出 JSON，形状如下：\n{"candidates":[{"tone":"conservative","text":"...","rationale":"...","structure":{"s":"...","t":"...","a":"...","r":"..."},"lowConfidence":false}]}\n\n必须返回 3 个候选，tone 分别是 conservative / balanced / aggressive。语气定义：\n${tones}\n\n如果某个候选无法从原文或证据支撑，lowConfidence 必须为 true，并在 rationale 说明缺口。`;
}
