import type { ResumeDocument } from "@/features/resume/types";
import type { CoachQaAnswer } from "./storage";

export type CoachQuestionKind = "context" | "action" | "result" | "metric" | "evidence" | "jd-fit";

export type ExperienceQuestion = {
  id: string;
  kind: CoachQuestionKind;
  prompt: string;
  why: string;
  status: "ready" | "answered" | "needs-evidence";
};

export type ExperienceDeepDiveItem = {
  id: string;
  label: string;
  source: "experience" | "project";
  confirmedBulletCount: number;
  gapLabels: string[];
  questions: ExperienceQuestion[];
};

export type CoachQaTurnStatus =
  | "pending"
  | "answered"
  | "needs-evidence"
  | "ready-to-promote"
  | "promoted"
  | "blocked";

export type CoachQaTurn = {
  targetId: string;
  targetSource: CoachQaAnswer["targetSource"];
  targetLabel: string;
  questionId: string;
  questionKind: CoachQuestionKind;
  questionPrompt: string;
  status: CoachQaTurnStatus;
  reason: string;
  answer?: CoachQaAnswer;
};

export type CoachQaSession = {
  activeTurn?: CoachQaTurn;
  turns: CoachQaTurn[];
  counts: Record<CoachQaTurnStatus, number>;
};

export function hasMetricLikeContent(value: string): boolean {
  return /\d|%|倍|人|次|天|周|月|年|小时|万元|元|kpi|KPI/.test(value);
}

function sourceLabel(value: ExperienceDeepDiveItem["source"]): string {
  return value === "experience" ? "经历" : "项目";
}

function normalizeText(value: string | undefined | null): string {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function buildAnswerKey(input: {
  targetId: string;
  targetSource: CoachQaAnswer["targetSource"];
  questionId: string;
  questionKind: CoachQuestionKind;
  questionPrompt: string;
}): string {
  return [input.targetSource, input.targetId, input.questionId, input.questionKind, input.questionPrompt].join("");
}

function buildEvidenceText(evidence: ResumeDocument["experiences"][number]["evidence"]): string[] {
  return evidence
    .flatMap((item) => [
      item.context,
      item.task,
      item.scope,
      item.reflection,
      item.sourceText,
      ...item.actions,
      ...item.results.flatMap((result) => [result.text, result.metric]),
      ...item.skills,
    ])
    .filter((item): item is string => Boolean(item && item.trim()));
}

function hasPromotedEvidenceMatch(document: ResumeDocument | null, answer: CoachQaAnswer): boolean {
  if (!document || answer.targetSource !== "experience") return false;
  const experience = document.experiences.find((item) => item.id === answer.targetId);
  if (!experience) return false;

  const needle = normalizeText(answer.answerText);
  if (!needle) return false;

  return buildEvidenceText(experience.evidence).some((field) => {
    const haystack = normalizeText(field);
    if (!haystack) return false;
    if (haystack === needle) return true;
    const shortLength = Math.min(haystack.length, needle.length);
    if (shortLength < 16) return false;
    return haystack.includes(needle) || needle.includes(haystack);
  });
}

function emptyCounts(): Record<CoachQaTurnStatus, number> {
  return {
    pending: 0,
    answered: 0,
    "needs-evidence": 0,
    "ready-to-promote": 0,
    promoted: 0,
    blocked: 0,
  };
}

function countStatus(status: CoachQaTurnStatus, counts: Record<CoachQaTurnStatus, number>): void {
  counts[status] += 1;
}

function statusFromQuestion(question: ExperienceQuestion): CoachQaTurnStatus {
  if (question.status === "answered") return "answered";
  if (question.status === "needs-evidence") return "needs-evidence";
  return "pending";
}

function statusReason(status: CoachQaTurnStatus): string {
  if (status === "answered") return "已有草稿线索";
  if (status === "needs-evidence") return "当前 resume 还缺证据";
  return "等待回答";
}

function deriveTurnForQuestion(input: {
  item: ExperienceDeepDiveItem;
  question: ExperienceQuestion;
  answer?: CoachQaAnswer;
  document: ResumeDocument | null;
}): CoachQaTurn {
  const baseStatus = statusFromQuestion(input.question);
  const baseReason = statusReason(baseStatus);

  if (!input.answer) {
    return {
      targetId: input.item.id,
      targetSource: input.item.source,
      targetLabel: input.item.label,
      questionId: input.question.id,
      questionKind: input.question.kind,
      questionPrompt: input.question.prompt,
      status: baseStatus,
      reason: baseReason,
    };
  }

  if (input.answer.status === "rejected") {
    return {
      targetId: input.item.id,
      targetSource: input.item.source,
      targetLabel: input.item.label,
      questionId: input.question.id,
      questionKind: input.question.kind,
      questionPrompt: input.question.prompt,
      status: "blocked",
      reason: "已拒绝，暂不进入证据图",
      answer: input.answer,
    };
  }

  if (input.answer.targetSource === "project") {
    return {
      targetId: input.item.id,
      targetSource: input.item.source,
      targetLabel: input.item.label,
      questionId: input.question.id,
      questionKind: input.question.kind,
      questionPrompt: input.question.prompt,
      status: "blocked",
      reason: "项目答案不能进入经验证据",
      answer: input.answer,
    };
  }

  if (input.answer.status === "draft") {
    return {
      targetId: input.item.id,
      targetSource: input.item.source,
      targetLabel: input.item.label,
      questionId: input.question.id,
      questionKind: input.question.kind,
      questionPrompt: input.question.prompt,
      status: "answered",
      reason: "草稿已保存",
      answer: input.answer,
    };
  }

  if (hasPromotedEvidenceMatch(input.document, input.answer)) {
    return {
      targetId: input.item.id,
      targetSource: input.item.source,
      targetLabel: input.item.label,
      questionId: input.question.id,
      questionKind: input.question.kind,
      questionPrompt: input.question.prompt,
      status: "promoted",
      reason: "已进入 evidence graph",
      answer: input.answer,
    };
  }

  if (baseStatus === "needs-evidence") {
    return {
      targetId: input.item.id,
      targetSource: input.item.source,
      targetLabel: input.item.label,
      questionId: input.question.id,
      questionKind: input.question.kind,
      questionPrompt: input.question.prompt,
      status: "needs-evidence",
      reason: "已确认，但还缺证据",
      answer: input.answer,
    };
  }

  return {
    targetId: input.item.id,
    targetSource: input.item.source,
    targetLabel: input.item.label,
    questionId: input.question.id,
    questionKind: input.question.kind,
    questionPrompt: input.question.prompt,
    status: "ready-to-promote",
    reason: "已确认，可推进到 evidence",
    answer: input.answer,
  };
}

function selectActiveTurn(turns: CoachQaTurn[]): CoachQaTurn | undefined {
  const priority: CoachQaTurnStatus[] = ["pending", "needs-evidence", "ready-to-promote", "answered", "blocked", "promoted"];
  for (const status of priority) {
    const turn = turns.find((item) => item.status === status);
    if (turn) return turn;
  }
  return turns[0];
}

export function buildAdaptiveQaSession(
  queue: ExperienceDeepDiveItem[],
  answers: CoachQaAnswer[],
  document: ResumeDocument | null,
): CoachQaSession {
  if (!document) {
    return {
      activeTurn: undefined,
      turns: [],
      counts: emptyCounts(),
    };
  }

  const counts = emptyCounts();
  const turns: CoachQaTurn[] = [];
  const answerLookup = new Map<string, CoachQaAnswer>();

  for (const answer of answers) {
    const key = buildAnswerKey(answer);
    const existing = answerLookup.get(key);
    if (!existing || answer.updatedAt >= existing.updatedAt) {
      answerLookup.set(key, answer);
    }
  }

  const matchedAnswerKeys = new Set<string>();

  for (const item of queue) {
    for (const question of item.questions) {
      const key = buildAnswerKey({
        targetId: item.id,
        targetSource: item.source,
        questionId: question.id,
        questionKind: question.kind,
        questionPrompt: question.prompt,
      });
      const answer = answerLookup.get(key);
      if (answer) matchedAnswerKeys.add(key);
      const turn = deriveTurnForQuestion({ item, question, answer, document });
      turns.push(turn);
      countStatus(turn.status, counts);
    }
  }

  for (const answer of answers) {
    const key = buildAnswerKey(answer);
    if (matchedAnswerKeys.has(key)) continue;
    const turn: CoachQaTurn = {
      targetId: answer.targetId,
      targetSource: answer.targetSource,
      targetLabel: answer.questionPrompt || answer.targetId,
      questionId: answer.questionId,
      questionKind: answer.questionKind,
      questionPrompt: answer.questionPrompt,
      status: "blocked",
      reason: "当前 queue 已变，旧答案不再匹配",
      answer,
    };
    turns.push(turn);
    countStatus(turn.status, counts);
  }

  return {
    activeTurn: selectActiveTurn(turns),
    turns,
    counts,
  };
}

export function buildExperienceQuestionQueue(document: ResumeDocument | null): ExperienceDeepDiveItem[] {
  if (!document) return [];
  const keywords = document.target?.keywords?.map((item) => item.trim()).filter(Boolean) ?? [];

  const buildItem = (input: {
    id: string;
    label: string;
    source: ExperienceDeepDiveItem["source"];
    bullets: ResumeDocument["experiences"][number]["bullets"];
    evidence: ResumeDocument["experiences"][number]["evidence"];
    localText: string[];
  }): ExperienceDeepDiveItem => {
    const confirmedBullets = input.bullets.filter((bullet) => bullet.status === "confirmed");
    const draftBullets = input.bullets.filter((bullet) => bullet.status === "draft");
    const confirmedText = [
      ...confirmedBullets.map((bullet) => bullet.text),
      ...input.evidence.flatMap((item) => [
        item.context,
        item.task,
        item.scope,
        item.reflection,
        item.sourceText,
        ...item.actions,
        ...item.results.flatMap((result) => [result.text, result.metric]),
        ...item.skills,
      ]),
      ...input.localText,
    ]
      .filter((item): item is string => Boolean(item && item.trim()))
      .join("\n")
      .toLowerCase();
    const questions: ExperienceQuestion[] = [];

    if (confirmedBullets.length === 0) {
      questions.push(
        {
          id: `${input.id}-context`,
          kind: "context",
          prompt: `这段${sourceLabel(input.source)}当时的业务背景、目标对象和你的职责边界是什么？`,
          why: draftBullets.length > 0 ? "已有 draft 只能当追问素材，尚不能进入 confirmed preview。" : "缺少 confirmed bullet，需要先还原事实背景。",
          status: draftBullets.length > 0 ? "answered" : "ready",
        },
        {
          id: `${input.id}-action`,
          kind: "action",
          prompt: "你亲自做了哪些动作？请按动作对象、工具方法、协作对象拆开。",
          why: "动作必须由用户确认，不能由 AI 或 JD 反推。",
          status: "ready",
        },
        {
          id: `${input.id}-result`,
          kind: "result",
          prompt: "这些动作带来了什么结果？影响范围、效率、转化、质量或交付物分别是什么？",
          why: "先确认结果事实，再进入 bullet 文案确认。",
          status: "ready",
        },
        {
          id: `${input.id}-evidence`,
          kind: "evidence",
          prompt: "有没有截图、报告、课程作业、数据表、导师/主管反馈等可公开证据？",
          why: "证据先入 evidence graph；未确认内容不进入最终简历。",
          status: "needs-evidence",
        },
      );
    }

    confirmedBullets.forEach((bullet, index) => {
      if (!hasMetricLikeContent(bullet.text)) {
        questions.push({
          id: `${input.id}-metric-${index}`,
          kind: "metric",
          prompt: `这条已确认 bullet 可否补充数字或强结果：${bullet.text}`,
          why: "当前表述缺少 metric-like 内容，优先追问结果强度而不是直接润色。",
          status: input.evidence.length > 0 ? "answered" : "needs-evidence",
        });
      }
      if (bullet.sourceEvidenceIds.length === 0) {
        questions.push({
          id: `${input.id}-evidence-${index}`,
          kind: "evidence",
          prompt: "这条 confirmed bullet 对应哪条 STAR 证据？请先补证据再考虑改写。",
          why: "confirmed 文案也需要可审计来源，避免只剩结论。",
          status: "needs-evidence",
        });
      }
    });

    const uncoveredKeywords = keywords.filter((keyword) => !confirmedText.includes(keyword.toLowerCase()));
    if (uncoveredKeywords.length > 0) {
      questions.push({
        id: `${input.id}-jd-fit`,
        kind: "jd-fit",
        prompt: `这段${sourceLabel(input.source)}是否真实覆盖这些 JD 关键词：${uncoveredKeywords.slice(0, 4).join("、")}？如果没有，请明确说没有。`,
        why: "JD 只能生成缺口追问，不能改写成用户已具备事实。",
        status: "ready",
      });
    }

    const gapLabels = [
      confirmedBullets.length === 0 ? "缺 confirmed bullet" : null,
      confirmedBullets.some((bullet) => !hasMetricLikeContent(bullet.text)) ? "指标弱" : null,
      input.evidence.length === 0 || confirmedBullets.some((bullet) => bullet.sourceEvidenceIds.length === 0) ? "证据待补" : null,
      uncoveredKeywords.length > 0 ? "JD 关键词待核" : null,
    ].filter((item): item is string => Boolean(item));

    return {
      id: input.id,
      label: input.label,
      source: input.source,
      confirmedBulletCount: confirmedBullets.length,
      gapLabels,
      questions: questions.length > 0
        ? questions
        : [
            {
              id: `${input.id}-review`,
              kind: "evidence",
              prompt: "这段材料目前已有 confirmed bullet 和证据线索；请复核是否仍真实、可公开、不过度夸大。",
              why: "定期复核可以防止旧材料在新 JD 下失真。",
              status: "answered",
            },
          ],
    };
  };

  return [
    ...document.experiences.map((item) => buildItem({
      id: item.id,
      label: `${item.role || "未填角色"} @ ${item.organization || "未填组织"}`,
      source: "experience",
      bullets: item.bullets,
      evidence: item.evidence,
      localText: [item.organization, item.role, item.location].filter((value): value is string => Boolean(value)),
    })),
    ...document.projects.map((item) => buildItem({
      id: item.id,
      label: `${item.name || "未命名项目"}${item.role ? ` · ${item.role}` : ""}`,
      source: "project",
      bullets: item.bullets,
      evidence: item.evidence,
      localText: [item.name, item.role, item.goal, ...item.techStack].filter((value): value is string => Boolean(value)),
    })),
  ];
}
