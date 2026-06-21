import type { EvaluationItem, EvaluationReport } from "./types";

/**
 * 将评估报告转为 Markdown 文本，供评估报告页只读 MD 阅读器渲染（design §5.4）。
 * 含 6 维分数 + 建议 + 佐证来源；来源为空时做兜底，不渲染空链接区段。
 */

function scoreLine(item: EvaluationItem): string {
  return [
    `综合 ${item.overallScore}`,
    `相关 ${item.relevance}`,
    `具体 ${item.specificity}`,
    `可信 ${item.credibility}`,
    `时效 ${item.recency}`,
    `表达 ${item.expression}`,
    `稀缺 ${item.scarcity}`,
  ].join(" · ");
}

function itemToMarkdown(item: EvaluationItem, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. ${item.originalText || "（无原文）"}`);
  lines.push("");
  lines.push(`**评分**：${scoreLine(item)}`);
  lines.push("");

  if (item.suggestion) {
    lines.push(`**建议**：${item.suggestion}`);
    lines.push("");
  }

  if (item.suggestedRewrite) {
    lines.push("**建议改写**：");
    lines.push("");
    lines.push(`> ${item.suggestedRewrite}`);
    lines.push("");
  }

  if (item.searchEvidence) {
    lines.push(`**联网佐证**：${item.searchEvidence}`);
    lines.push("");
  }

  // searchSources 可能为空数组（Sprint 2 风险），仅在非空时渲染来源区段
  const sources = (item.searchSources ?? []).filter((s) => s && s.trim().length > 0);
  if (sources.length > 0) {
    lines.push("**来源**：");
    for (const url of sources) {
      lines.push(`- [${url}](${url})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function reportToMarkdown(report: EvaluationReport): string {
  const lines: string[] = [];
  lines.push("# 评估报告");
  lines.push("");

  if (report.overallSummary) {
    lines.push("## 总体评价");
    lines.push("");
    lines.push(report.overallSummary);
    lines.push("");
  }

  lines.push(`## 逐条评估（${report.items.length} 条）`);
  lines.push("");

  if (report.items.length === 0) {
    lines.push("_暂无可评估的经历要点，请返回档案页补充。_");
    lines.push("");
  } else {
    report.items.forEach((item, i) => {
      lines.push(itemToMarkdown(item, i));
    });
  }

  return lines.join("\n");
}
