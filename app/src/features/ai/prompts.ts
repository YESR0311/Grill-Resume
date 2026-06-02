import type { ResumeDocument } from "@/features/resume/types";
import type { ScoreIssue } from "@/features/score/resume-score";

export function buildDraftPrompt(document: ResumeDocument, freeText: string): string {
  return JSON.stringify(
    {
      task: "generate_resume_draft",
      language: "zh-CN",
      rules: [
        "只使用输入中已有事实",
        "没有证据的成果用 needs_confirmation",
        "不要覆盖 confirmed 内容",
        "每条 bullet 保留 sourceEvidenceIds",
      ],
      resume: document,
      freeText,
      outputShape: {
        experiences: "Experience[]",
        projects: "Project[]",
        suggestions: "string[]",
        risks: "string[]",
      },
    },
    null,
    2,
  );
}

export function buildIssueOptimizationPrompt(input: {
  document: ResumeDocument;
  issue: ScoreIssue;
  targetPath: string;
  originalText: string;
}): string {
  return JSON.stringify(
    {
      task: "optimize_single_resume_issue",
      language: "zh-CN",
      rules: [
        "只改写 selectedText，不改其它简历内容",
        "只使用 resume 中已有事实，不新增公司、奖项、指标或证书",
        "如原文没有数字，不要凭空补数字",
        "保持中文求职简历 bullet 风格，避免夸张和无法证明的表达",
        "输出必须是 JSON，不要 Markdown",
      ],
      issue: input.issue,
      targetPath: input.targetPath,
      selectedText: input.originalText,
      resume: input.document,
      outputShape: {
        proposedText: "string",
        rationale: "string",
      },
    },
    null,
    2,
  );
}
