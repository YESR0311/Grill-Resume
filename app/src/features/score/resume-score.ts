import type { ResumeDocument, ResumeBullet, StarEvidence } from "@/features/resume/types";

export type ScoreDimensionKey = "completeness" | "impact" | "credibility" | "ats";

export type ScoreIssue = {
  id: string;
  dimension: ScoreDimensionKey;
  severity: "low" | "medium" | "high";
  message: string;
  targetPath?: string;
};

export type ScoreDimension = {
  score: number;
  explanation: string;
};

export type ResumeScore = {
  total: number;
  dimensions: Record<ScoreDimensionKey, ScoreDimension>;
  issues: ScoreIssue[];
  suggestions: string[];
};

type BulletWithPath = {
  text: string;
  sourceEvidenceIds: string[];
  status: ResumeBullet["status"];
  qualityFlags: ResumeBullet["qualityFlags"];
  evidence: StarEvidence[];
  path: string;
};

type IssueInput = Omit<ScoreIssue, "id">;

const METRIC_PATTERN = /\d|%|％|倍|万|千|百|人|次|小时|天|周|月|年|元|排名|top/i;
const ATS_UNFRIENDLY_PATTERN = /[★◆◇■□●○▶→]/;
const GENERIC_WORDS = ["负责", "参与", "协助", "熟悉", "了解", "相关", "一些", "等"];
const ACTION_WORDS = ["搭建", "设计", "优化", "推进", "落地", "分析", "实现", "提升", "降低", "增长", "交付"];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sectionScore(filled: number, total: number): number {
  return clampScore((filled / total) * 100);
}

function issue(input: IssueInput): IssueInput {
  return input;
}

function bulletText(document: ResumeDocument): BulletWithPath[] {
  const experienceBullets = document.experiences.flatMap((item, index) =>
    item.bullets.map((bullet, bulletIndex) => ({
      text: bullet.text.trim(),
      sourceEvidenceIds: bullet.sourceEvidenceIds,
      status: bullet.status,
      qualityFlags: bullet.qualityFlags,
      evidence: item.evidence,
      path: `experiences.${index}.bullets.${bulletIndex}`,
    })),
  );
  const projectBullets = document.projects.flatMap((item, index) =>
    item.bullets.map((bullet, bulletIndex) => ({
      text: bullet.text.trim(),
      sourceEvidenceIds: bullet.sourceEvidenceIds,
      status: bullet.status,
      qualityFlags: bullet.qualityFlags,
      evidence: item.evidence,
      path: `projects.${index}.bullets.${bulletIndex}`,
    })),
  );
  const summaryBullets =
    document.summary?.bullets.map((bullet, bulletIndex) => ({
      text: bullet.text.trim(),
      sourceEvidenceIds: bullet.sourceEvidenceIds,
      status: bullet.status,
      qualityFlags: bullet.qualityFlags,
      evidence: [],
      path: `summary.bullets.${bulletIndex}`,
    })) ?? [];
  return [...summaryBullets, ...experienceBullets, ...projectBullets].filter((bullet) => bullet.text.length > 0);
}

function hasEvidenceReference(bullet: BulletWithPath): boolean {
  if (bullet.sourceEvidenceIds.length === 0) return false;
  const evidenceIds = new Set(bullet.evidence.map((item) => item.id));
  return bullet.sourceEvidenceIds.some((id) => evidenceIds.has(id));
}

function scoreCompleteness(document: ResumeDocument, bullets: BulletWithPath[]): {
  dimension: ScoreDimension;
  issues: IssueInput[];
} {
  const issues: IssueInput[] = [];
  const basicsFields = [document.basics.name, document.basics.phone, document.basics.email, document.basics.city, document.basics.targetRole];
  const basicsScore = sectionScore(basicsFields.filter(Boolean).length, basicsFields.length);
  const sections = [
    document.education.length > 0,
    document.experiences.length > 0,
    document.projects.length > 0,
    document.skills.some((group) => group.items.length > 0),
    document.certificates.length > 0 || document.awards.length > 0,
  ];
  const sectionCoverage = sectionScore(sections.filter(Boolean).length, sections.length);
  const bulletCoverage = clampScore((Math.min(bullets.length, 8) / 8) * 100);
  const score = clampScore(basicsScore * 0.35 + sectionCoverage * 0.45 + bulletCoverage * 0.2);

  if (!document.basics.name) {
    issues.push(issue({ dimension: "completeness", severity: "high", message: "缺少姓名，简历基础识别信息不完整。", targetPath: "basics.name" }));
  }
  if (!document.basics.phone && !document.basics.email) {
    issues.push(issue({ dimension: "completeness", severity: "high", message: "缺少手机或邮箱，投递后无法被直接联系。", targetPath: "basics" }));
  }
  if (document.education.length === 0) {
    issues.push(issue({ dimension: "completeness", severity: "medium", message: "缺少教育经历，中文求职简历通常需要保留学校、学历和专业。", targetPath: "education" }));
  }
  if (document.experiences.length === 0 && document.projects.length === 0) {
    issues.push(issue({ dimension: "completeness", severity: "high", message: "缺少经历或项目模块，难以证明岗位能力。", targetPath: "experiences" }));
  }
  if (document.skills.every((group) => group.items.length === 0)) {
    issues.push(issue({ dimension: "completeness", severity: "medium", message: "缺少技能关键词，ATS 和招聘方难以快速匹配能力。", targetPath: "skills" }));
  }

  return {
    dimension: {
      score,
      explanation: `基础信息 ${basicsScore} 分，核心模块覆盖 ${sectionCoverage} 分，bullet 数量支撑 ${bulletCoverage} 分。`,
    },
    issues,
  };
}

function scoreImpact(bullets: BulletWithPath[]): { dimension: ScoreDimension; issues: IssueInput[] } {
  const issues: IssueInput[] = [];
  if (bullets.length === 0) {
    return {
      dimension: { score: 20, explanation: "尚无经历、项目或摘要 bullet，无法评估行动和结果表达。" },
      issues: [issue({ dimension: "impact", severity: "high", message: "需要至少补充 3-5 条具体 bullet，说明动作、方法和结果。" })],
    };
  }

  const withMetric = bullets.filter((bullet) => METRIC_PATTERN.test(bullet.text)).length;
  const withAction = bullets.filter((bullet) => ACTION_WORDS.some((word) => bullet.text.includes(word))).length;
  const tooGeneric = bullets.filter((bullet) => GENERIC_WORDS.some((word) => bullet.text.includes(word)) && !METRIC_PATTERN.test(bullet.text)).length;
  const metricScore = sectionScore(withMetric, bullets.length);
  const actionScore = sectionScore(withAction, bullets.length);
  const genericPenalty = sectionScore(tooGeneric, bullets.length) * 0.35;
  const score = clampScore(metricScore * 0.45 + actionScore * 0.4 + 45 - genericPenalty);

  bullets.forEach((bullet) => {
    if (!METRIC_PATTERN.test(bullet.text)) {
      issues.push(issue({ dimension: "impact", severity: "medium", message: "这条 bullet 缺少可量化结果或范围，建议补充数字、排名、规模或效率变化。", targetPath: bullet.path }));
    }
    if (GENERIC_WORDS.some((word) => bullet.text.includes(word)) && bullet.text.length < 28) {
      issues.push(issue({ dimension: "impact", severity: "low", message: "这条 bullet 偏空泛，建议改成“动作 + 方法 + 结果”的表达。", targetPath: bullet.path }));
    }
  });

  return {
    dimension: {
      score,
      explanation: `${withMetric}/${bullets.length} 条含量化信息，${withAction}/${bullets.length} 条含明确动作词，空泛表达扣分。`,
    },
    issues,
  };
}

function scoreCredibility(document: ResumeDocument, bullets: BulletWithPath[]): { dimension: ScoreDimension; issues: IssueInput[] } {
  const issues: IssueInput[] = [];
  const evidenceResults = [...document.experiences, ...document.projects].flatMap((item) => item.evidence.flatMap((evidence) => evidence.results));
  const unconfirmedResults = evidenceResults.filter((result) => result.confidence === "needs_confirmation").length;
  const referencedBullets = bullets.filter(hasEvidenceReference).length;
  const confirmedBullets = bullets.filter((bullet) => bullet.status === "confirmed").length;
  const referenceScore = bullets.length > 0 ? sectionScore(referencedBullets, bullets.length) : 70;
  const statusScore = bullets.length > 0 ? sectionScore(confirmedBullets, bullets.length) : 70;
  const confirmationPenalty = Math.min(unconfirmedResults * 8, 40);
  const score = clampScore(referenceScore * 0.45 + statusScore * 0.45 + 20 - confirmationPenalty);

  bullets.forEach((bullet) => {
    if (bullet.status !== "confirmed") {
      issues.push(issue({ dimension: "credibility", severity: "high", message: "存在 draft bullet，正式投递前需要确认事实和措辞。", targetPath: bullet.path }));
    }
    if (bullet.sourceEvidenceIds.length > 0 && !hasEvidenceReference(bullet)) {
      issues.push(issue({ dimension: "credibility", severity: "medium", message: "bullet 引用的 evidence ID 未在当前经历或项目中找到。", targetPath: bullet.path }));
    }
    if (bullet.sourceEvidenceIds.length === 0 && METRIC_PATTERN.test(bullet.text)) {
      issues.push(issue({ dimension: "credibility", severity: "medium", message: "含量化成果但没有 evidence 引用，建议补充 STAR 证据来源。", targetPath: bullet.path }));
    }
    if (bullet.qualityFlags.includes("unsupported_claim")) {
      issues.push(issue({ dimension: "credibility", severity: "high", message: "该 bullet 被标记为 unsupported_claim，需删改或补证据。", targetPath: bullet.path }));
    }
  });

  if (unconfirmedResults > 0) {
    issues.push(issue({ dimension: "credibility", severity: "high", message: `有 ${unconfirmedResults} 条 evidence result 仍为 needs_confirmation，不能直接进入正式投递版。`, targetPath: "experiences" }));
  }

  return {
    dimension: {
      score,
      explanation: `${referencedBullets}/${bullets.length || 0} 条 bullet 有有效 evidence 引用，${confirmedBullets}/${bullets.length || 0} 条为 confirmed。`,
    },
    issues,
  };
}

function scoreAts(document: ResumeDocument, bullets: BulletWithPath[]): { dimension: ScoreDimension; issues: IssueInput[] } {
  const issues: IssueInput[] = [];
  const allText = [
    document.basics.name,
    document.basics.email,
    document.basics.phone,
    document.basics.targetRole,
    ...document.education.flatMap((item) => [item.school, item.degree, item.major]),
    ...document.skills.flatMap((group) => group.items),
    ...bullets.map((bullet) => bullet.text),
  ]
    .filter(Boolean)
    .join("\n");
  const longBullets = bullets.filter((bullet) => bullet.text.length > 90).length;
  const unfriendlySymbols = ATS_UNFRIENDLY_PATTERN.test(allText);
  const keywordCount = new Set(document.skills.flatMap((group) => group.items.map((item) => item.trim()).filter(Boolean))).size;
  const keywordScore = clampScore((Math.min(keywordCount, 12) / 12) * 100);
  const lengthScore = bullets.length > 0 ? clampScore(100 - sectionScore(longBullets, bullets.length) * 0.7) : 60;
  const symbolScore = unfriendlySymbols ? 70 : 100;
  const templateScore = document.template.id === "ats" ? 100 : 85;
  const score = clampScore(keywordScore * 0.35 + lengthScore * 0.3 + symbolScore * 0.2 + templateScore * 0.15);

  if (keywordCount < 5) {
    issues.push(issue({ dimension: "ats", severity: "medium", message: "技能关键词少于 5 个，建议补充岗位相关工具、方法或专业词。", targetPath: "skills" }));
  }
  if (longBullets > 0) {
    issues.push(issue({ dimension: "ats", severity: "medium", message: `有 ${longBullets} 条 bullet 超过 90 个字符，建议拆短以提高可读性。` }));
  }
  if (unfriendlySymbols) {
    issues.push(issue({ dimension: "ats", severity: "low", message: "检测到装饰性符号，ATS 解析可能不稳定，建议使用普通文本项目符号。" }));
  }

  return {
    dimension: {
      score,
      explanation: `识别到 ${keywordCount} 个技能关键词，${longBullets} 条过长 bullet，模板 ATS 友好度按 ${document.template.id} 计算。`,
    },
    issues,
  };
}

function buildSuggestions(issues: ScoreIssue[]): string[] {
  const suggestions = new Set<string>();
  if (issues.some((item) => item.dimension === "completeness")) {
    suggestions.add("先补齐姓名、联系方式、教育、经历/项目和技能，保证招聘方能快速判断基本匹配。 ");
  }
  if (issues.some((item) => item.dimension === "impact")) {
    suggestions.add("把空泛 bullet 改成“做了什么 + 怎么做 + 产生什么结果”，优先补数字、规模、排名或效率变化。 ");
  }
  if (issues.some((item) => item.dimension === "credibility")) {
    suggestions.add("正式投递前只保留 confirmed 内容；量化成果要能追溯到 STAR evidence 或用户已确认事实。 ");
  }
  if (issues.some((item) => item.dimension === "ats")) {
    suggestions.add("保持单栏、标准标题和普通文本符号，并补充 5-12 个与目标岗位相关的技能关键词。 ");
  }
  if (suggestions.size === 0) {
    suggestions.add("当前简历结构较完整，可继续围绕目标岗位 JD 微调关键词和 bullet 顺序。 ");
  }
  return [...suggestions].map((item) => item.trim());
}

export function scoreResume(document: ResumeDocument): ResumeScore {
  const bullets = bulletText(document);
  const completeness = scoreCompleteness(document, bullets);
  const impact = scoreImpact(bullets);
  const credibility = scoreCredibility(document, bullets);
  const ats = scoreAts(document, bullets);
  const rawIssues = [...completeness.issues, ...impact.issues, ...credibility.issues, ...ats.issues];
  const issues = rawIssues.slice(0, 12).map((item, index) => ({ ...item, id: `issue-${index + 1}` }));
  const total = clampScore(
    completeness.dimension.score * 0.28 +
      impact.dimension.score * 0.28 +
      credibility.dimension.score * 0.24 +
      ats.dimension.score * 0.2,
  );

  return {
    total,
    dimensions: {
      completeness: completeness.dimension,
      impact: impact.dimension,
      credibility: credibility.dimension,
      ats: ats.dimension,
    },
    issues,
    suggestions: buildSuggestions(issues),
  };
}
