import type { EvaluationItem, EvaluationReport } from "./types";

/**
 * 将评估报告转为 Markdown 文本，供评估报告页只读 MD 阅读器渲染（design §5.4）。
 * 不含联网佐证/来源/图片（issue 7 已删）。
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
    lines.push("_暂无条目可评估，请返回档案页补充。_");
    lines.push("");
  } else {
    report.items.forEach((item, i) => {
      lines.push(itemToMarkdown(item, i));
    });
  }

  return lines.join("\n");
}