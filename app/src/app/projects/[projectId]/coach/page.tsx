import Link from "next/link";
import { notFound } from "next/navigation";
import { applyEvidenceBulletDraftAction, generateEvidenceBulletDraftAction, promoteCoachQaAnswerToEvidenceAction, runCoachResearchAction, runCoachSearchEvaluationAction, runGrillEnhancementAction, saveCoachQaAnswerAction } from "@/features/coach/actions";
import { buildExperienceQuestionQueue, type CoachQuestionKind, type CoachQaTurn, type CoachQaTurnStatus, type ExperienceDeepDiveItem } from "@/features/coach/questions";
import { buildGrillSession, type CoachGrillSession } from "@/features/coach/conversation/engine";
import { buildGrillEnhancementRequest, type GrillEnhancement } from "@/features/coach/conversation/llm-enhance";
import { buildResearchQueue, type CoachResearchFinding, type CoachResearchQueueItem, type CoachResearchReport } from "@/features/coach/research";
import { getLatestCoachResearchReport, listCoachQaAnswers, listCoachResearchReports, readCoachGrillEnhancement, readCoachResearchReport, type CoachQaAnswer, type CoachResearchReportRecord } from "@/features/coach/storage";
import { listModelConfigs } from "@/features/ai/model-configs";
import { createPrivacyPreviewToken } from "@/features/privacy/preview";
import { getActivePendingDraft, getActivePendingDraftForEvidence, hasPendingDraftForFinding, type CoachBulletDraft } from "@/features/coach/bullet-drafts";
import { analyzeJdCoverage, type JdCoverageResult } from "@/features/coach/jd-coverage";
import { getProject, listResumes, readResume } from "@/features/resume/storage";
import type { ResumeDocument, ResumeRecord } from "@/features/resume/types";
import { ConfirmFindingPanel } from "./components/confirm-finding-panel";
import { BulletDraftPanel } from "./components/bullet-draft-panel";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<CoachSearchParams>;
};

type CoachEvidenceNode = {
  id: string;
  kind: "user_fact" | "user_evidence" | "research_fact" | "research_inference" | "writing_suggestion";
  text: string;
  source: "user" | "resume" | "jd" | "web" | "ai";
  sourceLabel: string;
  confidence: "high" | "medium" | "low";
  confirmationStatus: "unconfirmed" | "confirmed" | "rejected";
  canEnterResume: boolean;
  linkedBulletIds: string[];
};

type ResearchQueueItem = CoachResearchQueueItem;

type CoachSearchParams = {
  researchStatus?: string;
  researchError?: string;
  queue?: string;
  report?: string;
  confirmStatus?: string;
  confirmCode?: string;
  finding?: string;
  draft?: string;
  bullet?: string;
  qaStatus?: string;
  qaCode?: string;
  qaEvidenceStatus?: string;
  qaEvidenceCode?: string;
  evidenceBulletStatus?: string;
  evidenceBulletCode?: string;
  evidence?: string;
  question?: string;
  grillEnhanceStatus?: string;
  grillEnhanceCode?: string;
};

type CoachFlowStep = {
  key: string;
  title: string;
  description: string;
  status: "ready" | "working" | "locked";
};

type CoachMetric = {
  label: string;
  value: string;
  hint: string;
  tone: "slate" | "emerald" | "amber" | "sky";
};

type BuilderSnapshotModule = {
  id: string;
  title: string;
  rows: string[];
  tags?: string[];
};

type BuilderSnapshot = {
  title: string;
  personalInfo: string[];
  jobIntention: string[];
  modules: BuilderSnapshotModule[];
};

type BuilderWorkbenchSummary = {
  projectName: string;
  resumeCount: number;
  variantCount: number;
  masterResumeId?: string;
  masterResumeName?: string;
  reportCount: number;
  confirmedBulletCount: number;
};

type EvidenceBulletDraftItem = {
  experienceId: string;
  experienceLabel: string;
  evidence: ResumeDocument["experiences"][number]["evidence"][number];
  draft?: CoachBulletDraft;
};

const coachFlowSteps: CoachFlowStep[] = [
  {
    key: "import",
    title: "材料",
    description: "旧简历 / 草稿 / JD",
    status: "ready",
  },
  {
    key: "diagnose",
    title: "诊断",
    description: "岗位匹配与缺口",
    status: "working",
  },
  {
    key: "evidence",
    title: "证据",
    description: "STAR 入图确认",
    status: "working",
  },
  {
    key: "write",
    title: "正文",
    description: "候选 bullet 审改",
    status: "locked",
  },
  {
    key: "export",
    title: "导出",
    description: "ATS / 中文视觉 Word",
    status: "locked",
  },
];

function metricTone(value: CoachMetric["tone"]): string {
  if (value === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (value === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (value === "sky") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-slate-200 bg-white text-slate-900";
}

function questionKindLabel(value: CoachQuestionKind): string {
  if (value === "context") return "背景";
  if (value === "action") return "动作";
  if (value === "result") return "结果";
  if (value === "metric") return "指标";
  if (value === "evidence") return "证据";
  return "JD 匹配";
}

function qaTurnStatusLabel(value: CoachQaTurnStatus): string {
  if (value === "pending") return "待回答";
  if (value === "answered") return "已保存";
  if (value === "needs-evidence") return "需证据";
  if (value === "ready-to-promote") return "可推进";
  if (value === "promoted") return "已入图";
  return "已阻塞";
}

function qaTurnStatusClass(value: CoachQaTurnStatus): string {
  if (value === "promoted") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "ready-to-promote") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (value === "needs-evidence") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value === "answered") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (value === "blocked") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function turnSourceLabel(value: CoachQaTurn["targetSource"]): string {
  return value === "experience" ? "经历" : "项目";
}

function answerExcerpt(value: string): string {
  return value.length > 160 ? `${value.slice(0, 160)}…` : value;
}

function buildCoachMetrics(input: {
  document: ResumeDocument | null;
  resumes: ResumeRecord[];
  reportRecords: CoachResearchReportRecord[];
  jdCoverage: JdCoverageResult | null;
}): CoachMetric[] {
  const evidenceCount = input.document?.experiences.reduce((sum, item) => sum + item.evidence.length, 0) ?? 0;
  const confirmedBullets = input.document?.experiences.reduce((sum, item) => sum + item.bullets.filter((bullet) => bullet.status === "confirmed").length, 0) ?? 0;
  const jdValue = input.jdCoverage?.status === "ok" ? `${input.jdCoverage.covered.length}/${input.jdCoverage.total}` : "未配置";
  return [
    { label: "简历", value: `${input.resumes.length}`, hint: "当前项目版本", tone: "slate" },
    { label: "证据", value: `${evidenceCount}`, hint: "STAR evidence", tone: evidenceCount > 0 ? "emerald" : "amber" },
    { label: "正文", value: `${confirmedBullets}`, hint: "confirmed bullets", tone: confirmedBullets > 0 ? "emerald" : "amber" },
    { label: "JD", value: jdValue, hint: "关键词覆盖", tone: input.jdCoverage?.status === "ok" ? "sky" : "amber" },
    { label: "报告", value: `${input.reportRecords.length}`, hint: "本地审计记录", tone: input.reportRecords.length > 0 ? "emerald" : "slate" },
  ];
}

function buildBuilderSnapshot(document: ResumeDocument | null): BuilderSnapshot {
  if (!document) {
    return {
      title: "未加载简历",
      personalInfo: ["等待创建或读取主简历"],
      jobIntention: ["目标岗位待补充"],
      modules: [],
    };
  }

  const personalInfo = [document.basics.name, document.basics.phone, document.basics.email, document.basics.city]
    .filter((item): item is string => Boolean(item));
  const jobIntention = [document.basics.targetRole, document.target?.role, document.target?.industry]
    .filter((item): item is string => Boolean(item));
  const educationRows = document.education.map((item) => [item.school, item.degree, item.major].filter(Boolean).join(" · "));
  const experienceRows = document.experiences.flatMap((item) => {
    const confirmed = item.bullets.filter((bullet) => bullet.status === "confirmed").map((bullet) => bullet.text);
    if (confirmed.length === 0) return [];
    return [[item.organization, item.role, ...confirmed].filter(Boolean).join("｜")];
  });
  const projectRows = document.projects.flatMap((item) => {
    const confirmed = item.bullets.filter((bullet) => bullet.status === "confirmed").map((bullet) => bullet.text);
    if (confirmed.length === 0) return [];
    return [[item.name, item.role, ...confirmed].filter(Boolean).join("｜")];
  });
  const skillTags = document.skills.flatMap((group) => group.items);

  return {
    title: document.title,
    personalInfo: personalInfo.length > 0 ? personalInfo : ["个人信息待补充"],
    jobIntention: jobIntention.length > 0 ? jobIntention : ["目标岗位待补充"],
    modules: [
      { id: "education", title: "教育背景", rows: educationRows },
      { id: "experiences", title: "实习 / 工作经历", rows: experienceRows },
      { id: "projects", title: "项目经历", rows: projectRows },
      { id: "skills", title: "技能标签", rows: [], tags: skillTags },
    ].filter((module) => module.rows.length > 0 || (module.tags?.length ?? 0) > 0),
  };
}

function buildBuilderWorkbenchSummary(input: {
  projectName: string;
  resumes: ResumeRecord[];
  master?: ResumeRecord;
  document: ResumeDocument | null;
  reportCount: number;
}): BuilderWorkbenchSummary {
  const confirmedExperienceBullets = input.document?.experiences.reduce((sum, item) => sum + item.bullets.filter((bullet) => bullet.status === "confirmed").length, 0) ?? 0;
  const confirmedProjectBullets = input.document?.projects.reduce((sum, item) => sum + item.bullets.filter((bullet) => bullet.status === "confirmed").length, 0) ?? 0;

  return {
    projectName: input.projectName,
    resumeCount: input.resumes.length,
    variantCount: input.resumes.filter((resume) => resume.kind === "variant").length,
    masterResumeId: input.master?.id,
    masterResumeName: input.master?.name,
    reportCount: input.reportCount,
    confirmedBulletCount: confirmedExperienceBullets + confirmedProjectBullets,
  };
}

function flowStatusLabel(value: CoachFlowStep["status"]): string {
  if (value === "ready") return "可用";
  if (value === "working") return "处理中";
  return "待解锁";
}

function flowStatusClass(value: CoachFlowStep["status"]): string {
  if (value === "ready") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "working") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

function readableQaError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "resume-not-found") return "简历不存在或不属于当前项目，未保存 Q&A。";
  if (code === "qa-invalid") return "Q&A 表单内容无效，请补全答案后重试。";
  if (code === "qa-persist-failed") return "Q&A 本地保存失败；未写入简历正文。";
  if (code === "qa-read-failed") return "Q&A 本地记录读取失败；未影响简历正文。";
  return "Q&A 保存失败，请刷新后重试。";
}

function readableQaEvidenceError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "resume-not-found") return "简历不存在或不属于当前项目，未写入证据图。";
  if (code === "qa-answer-not-found") return "Q&A 笔记不存在或已过期，未写入证据图。";
  if (code === "qa-answer-not-confirmed") return "只有已确认事实笔记才能进入证据图。";
  if (code === "qa-target-not-experience") return "项目 Q&A 暂不进入 evidence graph；本轮只支持经历 Q&A。";
  if (code === "experience-not-found") return "Q&A 对应经历不存在，未写入证据图。";
  if (code === "star-invalid") return "STAR 表单未填全：动作和结果至少各 1 条。";
  if (code === "evidence-append-failed") return "STAR 写入证据图失败；未写入 confirmed bullet。";
  return "Q&A 入图失败，请刷新后重试。";
}

function readableGrillEnhanceError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "missing-project") return "项目不存在或已被移动，未运行 AI clarify。";
  if (code === "missing-resume") return "当前项目没有可用于追问的主简历。";
  if (code === "missing-active-turn") return "当前没有可增强的追问 turn。";
  if (code === "missing-model-config") return "需配置默认模型后才能运行 AI clarify；deterministic 追问仍可用。";
  if (code === "privacy-not-confirmed") return "请先确认 AI clarify 隐私预览，再调用 provider。";
  if (code === "unavailable") return "AI clarify 暂不可用，已降级为 deterministic 追问。";
  if (code === "persist-failed") return "AI clarify 已返回但本地保存失败；未写入简历事实。";
  return "AI clarify 未完成，deterministic 追问仍可继续。";
}

function readableEvidenceBulletError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "resume-not-found") return "简历不存在或不属于当前项目，未生成候选正文。";
  if (code === "experience-not-found") return "证据对应经历不存在，未生成候选正文。";
  if (code === "evidence-not-found") return "证据不存在或已被移动，未生成候选正文。";
  if (code === "evidence-not-confirmed") return "证据需要至少一个已确认结果，才能生成候选正文。";
  if (code === "draft-pending-exists") return "该证据已有待审候选正文，请先处理现有候选。";
  if (code === "missing-model-config") return "需配置模型后才能生成候选正文；未调用 provider。";
  if (code === "provider-timeout") return "模型请求超时，未生成候选正文。";
  if (code === "provider-failed") return "模型请求失败，请检查模型配置和网络状态。";
  if (code === "bullet-invalid-response") return "模型返回的候选不符合契约，未落盘。";
  if (code === "draft-persist-failed") return "候选正文落盘失败，未写入 confirmed bullet。";
  if (code === "draft-not-found") return "候选正文不存在或已过期。";
  if (code === "draft-source-invalid") return "该草稿不是证据生成的候选正文。";
  if (code === "draft-already-applied") return "候选正文已采纳；请勿重复提交。";
  if (code === "candidate-out-of-range") return "候选索引越界，请刷新页面后重试。";
  if (code === "final-text-invalid") return "Bullet 文本不能为空，且不超过 800 字。";
  if (code === "bullet-append-failed") return "写入 confirmed bullet 失败；候选状态未改变。";
  if (code === "draft-write-failed") return "候选状态写入失败，已回滚 confirmed bullet。";
  if (code === "privacy-not-confirmed") return "请先确认隐私预览，再调用 provider 生成候选正文。";
  return "候选正文处理失败，请刷新后重试。";
}

function readableConfirmError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "report-version-unsupported") return "当前报告为旧版本（v1），请重跑后再做证据确认。";
  if (code === "report-not-found") return "报告不存在或不属于当前简历。";
  if (code === "report-read-failed") return "报告文件无法读取，未写入简历。";
  if (code === "report-write-failed") return "报告写入失败，已回滚刚加入的 STAR；请重试。";
  if (code === "finding-not-found") return "调研项不存在，可能报告已被改动。";
  if (code === "finding-already-confirmed") return "该调研项已确认进入证据图。";
  if (code === "finding-not-confirmed") return "调研项尚未确认进入证据图，无法生成 bullet 草稿。";
  if (code === "experience-not-found") return "未找到对应的经历段，无法挂入证据图。";
  if (code === "evidence-not-found") return "未找到对应 STAR 证据，可能简历已被改动。";
  if (code === "star-invalid") return "STAR 表单未填全：动作和结果至少各 1 条。";
  if (code === "evidence-append-failed") return "STAR 写入简历失败，未写入报告。";
  if (code === "resume-not-found") return "简历不存在或不属于当前项目。";
  if (code === "draft-pending-exists") return "该调研项已有待审 bullet 草稿，请先处理或等待提交。";
  if (code === "draft-not-found") return "草稿不存在或已过期。";
  if (code === "draft-already-applied") return "草稿已采纳；请生成新草稿。";
  if (code === "draft-persist-failed") return "草稿落盘失败，未生成；请重试。";
  if (code === "draft-write-failed") return "草稿状态写入失败，已回滚 bullet；请重试。";
  if (code === "candidate-out-of-range") return "候选索引越界，请刷新页面后重试。";
  if (code === "final-text-invalid") return "Bullet 文本不能为空，且不超过 800 字。";
  if (code === "bullet-already-applied") return "该调研项已写入正文 bullet；请勿重复提交。";
  if (code === "bullet-invalid-response") return "模型返回的候选不符合契约，未落盘。";
  if (code === "missing-model-config") return "需配置模型后才能生成草稿；未调用 provider。";
  if (code === "provider-failed") return "模型请求失败，请检查模型配置和网络状态。";
  if (code === "provider-timeout") return "模型请求超时，未生成草稿。";
  if (code === "privacy-not-confirmed") return "请先确认隐私预览，再调用 provider 生成 bullet 草稿。";
  return "确认失败，请检查后重试。";
}

function confidenceLabel(value: CoachEvidenceNode["confidence"]): string {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  return "低";
}

function statusLabel(value: CoachEvidenceNode["confirmationStatus"]): string {
  if (value === "confirmed") return "已确认";
  if (value === "rejected") return "已拒绝";
  return "待确认";
}

function kindLabel(value: CoachEvidenceNode["kind"] | CoachResearchFinding["kind"]): string {
  const labels: Record<CoachEvidenceNode["kind"] | CoachResearchFinding["kind"], string> = {
    user_fact: "用户事实",
    user_evidence: "用户证据",
    research_fact: "调研事实",
    research_inference: "调研推论",
    writing_suggestion: "文案建议",
  };
  return labels[value];
}

function scopeLabel(value: ResearchQueueItem["scope"]): string {
  if (value === "role") return "目标岗位";
  if (value === "experience") return "经历价值";
  return "JD 缺口";
}

function citationHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "外部来源";
  }
}

function findingCitations(finding: CoachResearchFinding): NonNullable<CoachResearchFinding["citations"]> {
  return finding.citations ?? (finding.sourceUrl ? [{ title: finding.sourceLabel, url: finding.sourceUrl }] : []);
}

function selectedQueueIds(searchParams: CoachSearchParams | undefined): string[] {
  return String(searchParams?.queue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readableResearchError(value: string | undefined): string | null {
  if (!value) return null;
  if (value === "no-selection") return "请至少勾选一个调研项后再提交。";
  if (value === "missing-project") return "项目不存在或已被移动，未运行调研。";
  if (value === "missing-resume") return "当前项目没有可用于调研的主简历。";
  if (value === "invalid-selection") return "调研项无效，请刷新页面后重试。";
  if (value === "missing-model-config") return "需配置模型后才能运行真实调研；未调用 provider，也未写入简历。";
  if (value === "resume-read-failed") return "简历读取失败，未运行调研。";
  if (value === "provider-timeout") return "模型调研请求超时，未生成报告，也未写入简历。";
  if (value === "provider-failed") return "模型调研失败，请检查模型配置和网络状态；未写入简历。";
  if (value === "search-unavailable") return "搜索服务暂不可用，已降级为本地 deterministic 追问；未生成伪造引用。";
  if (value === "invalid-provider-response") return "模型返回内容无法解析为可审计报告；未写入简历。";
  if (value === "report-persist-failed") return "模型调研成功但报告持久化失败，未写入简历；请重试。";
  if (value === "report-read-failed") return "已找到报告索引，但报告文件读取失败；未写入简历。";
  if (value === "privacy-not-confirmed") return "请先确认隐私预览，再调用 provider 运行调研。";
  return "调研请求未完成，请检查项目和简历状态后重试。";
}

function buildResearchReport(input: {
  projectId: string;
  resume: ResumeRecord;
  document: ResumeDocument;
  queueItemIds: string[];
  queueItems: ResearchQueueItem[];
}): CoachResearchReport | null {
  const selected = input.queueItems.filter((item) => input.queueItemIds.includes(item.id));
  if (selected.length !== input.queueItemIds.length) return null;

  const firstExperience = input.document.experiences[0];
  const firstBullet = firstExperience?.bullets[0]?.text;
  const targetRole = input.document.basics.targetRole || input.document.target?.role || input.resume.targetRole || "目标岗位";
  const jdText = input.document.target?.jdText || input.resume.targetJd;
  const findings = selected.flatMap<CoachResearchFinding>((item, index) => {
    const baseId = `${item.id}-${index + 1}`;
    if (item.scope === "role") {
      return [
        {
          id: `${baseId}-fact`,
          kind: "research_fact",
          text: `待围绕“${targetRole}”核验岗位核心能力；当前 PR2 只生成本地预览，不采信外部网页事实。`,
          source: "resume",
          sourceLabel: "当前简历目标岗位",
          confidence: targetRole === "目标岗位" ? "low" : "medium",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        },
        {
          id: `${baseId}-inference`,
          kind: "research_inference",
          text: "岗位能力关键词需要等待真实调研和用户经历确认后，才能用于判断匹配度。",
          source: "ai",
          sourceLabel: "本地 deterministic 预览",
          confidence: "medium",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        },
        {
          id: `${baseId}-suggestion`,
          kind: "writing_suggestion",
          text: "后续真实调研完成前，只能把能力关键词作为追问清单，不能直接写成用户已具备的履历事实。",
          source: "ai",
          sourceLabel: "本地 deterministic 预览",
          confidence: "medium",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        },
      ];
    }
    if (item.scope === "experience") {
      return [
        {
          id: `${baseId}-fact`,
          kind: "research_fact",
          text: firstExperience
            ? `当前第一段经历为“${firstExperience.organization} · ${firstExperience.role}”。`
            : "当前简历尚未提供第一段经历。",
          source: "resume",
          sourceLabel: "当前 resume.json",
          confidence: firstExperience ? "high" : "low",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        },
        {
          id: `${baseId}-inference`,
          kind: "research_inference",
          text: firstBullet ? "已有 bullet 可用于评估动作、对象和结果密度。" : "第一段经历缺少 bullet，价值密度无法可靠判断。",
          source: "resume",
          sourceLabel: "当前第一段经历",
          confidence: firstBullet ? "medium" : "low",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        },
        {
          id: `${baseId}-suggestion`,
          kind: "writing_suggestion",
          text: firstBullet ? "优先补齐当前 bullet 的动作对象、量化结果和证据来源。" : "先追问第一段经历的 STAR 信息，再生成 bullet 草稿。",
          source: "ai",
          sourceLabel: "本地 deterministic 预览",
          confidence: "medium",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        },
      ];
    }
    return [
      {
        id: `${baseId}-fact`,
        kind: "research_fact",
        text: jdText ? "当前项目已提供 JD 文本，可做本地缺口对照。" : "当前项目尚未提供 JD 文本，只能按目标岗位做粗略追问。",
        source: jdText ? "jd" : "resume",
        sourceLabel: jdText ? "当前项目 JD" : "当前简历目标岗位",
        confidence: jdText ? "high" : "low",
        canEnterResume: false,
        confirmationStatus: "unconfirmed",
      },
      {
        id: `${baseId}-inference`,
        kind: "research_inference",
        text: jdText ? "可把 JD 要求与当前经历逐项对照，但不能把 JD 要求改写成用户已完成的事实。" : "缺少 JD 时，缺口判断置信度较低。",
        source: jdText ? "jd" : "ai",
        sourceLabel: jdText ? "当前项目 JD" : "本地 deterministic 预览",
        confidence: jdText ? "medium" : "low",
        canEnterResume: false,
        confirmationStatus: "unconfirmed",
      },
      {
        id: `${baseId}-suggestion`,
        kind: "writing_suggestion",
        text: "缺口分析只能生成补充问题：请补充与 JD 关键词对应的真实项目、动作、指标和证据。",
        source: "ai",
        sourceLabel: "本地 deterministic 预览",
        confidence: "medium",
        canEnterResume: false,
        confirmationStatus: "unconfirmed",
      },
    ];
  });

  return {
    schemaVersion: "coach-report-v2",
    id: `preview-${input.queueItemIds.join("-")}`,
    projectId: input.projectId,
    resumeId: input.resume.id,
    queueItemIds: input.queueItemIds,
    findings,
    createdAt: new Date(0).toISOString(),
    mode: "deterministic_preview",
  };
}

function firstResume(resumes: ResumeRecord[], kind: ResumeRecord["kind"]): ResumeRecord | undefined {
  return resumes.find((resume) => resume.kind === kind);
}

function buildEvidenceNodes(document: ResumeDocument | null): CoachEvidenceNode[] {
  const experience = document?.experiences[0];
  const bullet = experience?.bullets[0];
  return [
    {
      id: "fact-1",
      kind: "user_fact",
      text: experience ? `${experience.organization} · ${experience.role}` : "待补充第一段实习 / 工作经历",
      source: experience ? "resume" : "user",
      sourceLabel: experience ? "来自当前简历" : "等待用户回答",
      confidence: experience ? "high" : "low",
      confirmationStatus: experience ? "confirmed" : "unconfirmed",
      canEnterResume: true,
      linkedBulletIds: bullet ? [bullet.id] : [],
    },
    {
      id: "evidence-1",
      kind: "user_evidence",
      text: bullet?.text ?? "补充：你做了什么、影响了谁、结果如何、有没有数字证据？",
      source: bullet ? "resume" : "user",
      sourceLabel: bullet ? "来自当前 bullet" : "下一轮追问生成",
      confidence: bullet ? "high" : "low",
      confirmationStatus: bullet?.status === "confirmed" ? "confirmed" : "unconfirmed",
      canEnterResume: true,
      linkedBulletIds: bullet ? [bullet.id] : [],
    },
    {
      id: "research-1",
      kind: "research_inference",
      text: "同岗位常见关键词可作为追问依据，但不能直接写入简历正文。",
      source: "web",
      sourceLabel: "PR1 mock：真实搜索在 PR2 接入",
      confidence: "medium",
      confirmationStatus: "unconfirmed",
      canEnterResume: false,
      linkedBulletIds: [],
    },
  ];
}

function ResearchReportView({
  report,
  projectId,
  resumeId,
  experiences,
  bulletPanels,
  appliedBulletText,
}: {
  report: CoachResearchReport;
  projectId: string;
  resumeId: string;
  experiences: { id: string; label: string }[];
  bulletPanels: Record<string, { hasPendingDraft: boolean; draftId?: string; candidates?: { text: string; rationale?: string }[] }>;
  appliedBulletText: Record<string, string>;
}) {
  const isProviderReport = report.mode === "provider";
  const isPersisted = isProviderReport && report.id.startsWith("preview-") === false;
  const experienceMap = new Map(experiences.map((item) => [item.id, item.label]));
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p className={`rounded-2xl border p-4 ${isProviderReport ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
        {isProviderReport
          ? `已生成并持久化真实 provider 调研报告：${report.findings.length} 条结论。刷新页面或服务重启后仍可从本地 workspace 读取。`
          : `已生成本地 deterministic 预览报告：${report.findings.length} 条结论。`}
        v2 报告中可逐项确认进入证据图；已确认的条目可继续生成 bullet 草稿入正文。
      </p>
      {report.findings.map((finding) => {
        const linkedLabel = finding.linkedExperienceId ? experienceMap.get(finding.linkedExperienceId) : undefined;
        const panel = bulletPanels[finding.id];
        const appliedText = finding.linkedBulletId ? appliedBulletText[finding.linkedBulletId] : undefined;
        const citations = findingCitations(finding);
        return (
          <div key={finding.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {kindLabel(finding.kind)}
              </span>
              <span className="text-xs text-slate-500">置信度：{confidenceLabel(finding.confidence)}</span>
            </div>
            <p className="mt-3 leading-6 text-slate-700">{finding.text}</p>
            <p className="mt-2 text-xs text-slate-500">来源：{finding.sourceLabel}</p>
            {citations.length > 0 ? (
              <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-800">引用来源</p>
                {citations.map((citation) => (
                  <a
                    key={citation.url}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300"
                  >
                    <span className="block font-medium text-slate-900">{citation.title}</span>
                    <span className="mt-1 block text-slate-500">{citationHost(citation.url)}</span>
                    {citation.snippet ? <span className="mt-2 block leading-5 text-slate-600">{citation.snippet}</span> : null}
                  </a>
                ))}
              </div>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">状态：{statusLabel(finding.confirmationStatus)}</p>
            {finding.confirmationStatus === "confirmed" && linkedLabel ? (
              <p className="mt-1 text-xs text-emerald-700">已入图：{linkedLabel}</p>
            ) : null}
            {finding.linkedBulletId ? (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-medium">已入正文 bullet</p>
                {appliedText ? <p className="mt-1 whitespace-pre-line text-emerald-900">{appliedText}</p> : null}
              </div>
            ) : null}
            {isPersisted && finding.confirmationStatus === "unconfirmed" ? (
              <ConfirmFindingPanel
                projectId={projectId}
                resumeId={resumeId}
                reportId={report.id}
                findingId={finding.id}
                findingText={finding.text}
                experiences={experiences}
              />
            ) : null}
            {isPersisted && finding.confirmationStatus === "confirmed" && !finding.linkedBulletId ? (
              panel?.draftId && panel.candidates ? (
                <BulletDraftPanel
                  mode="apply"
                  projectId={projectId}
                  resumeId={resumeId}
                  draftId={panel.draftId}
                  candidates={panel.candidates}
                />
              ) : (
                <BulletDraftPanel
                  mode="generate"
                  projectId={projectId}
                  resumeId={resumeId}
                  reportId={report.id}
                  findingId={finding.id}
                  hasPendingDraft={Boolean(panel?.hasPendingDraft)}
                />
              )
            ) : null}
            {!isPersisted ? (
              <p className="mt-2 text-xs text-slate-500">本地预览报告不可入图，请先运行真实 provider 调研。</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ResearchReportList({ reports, activeReportId }: { reports: CoachResearchReportRecord[]; activeReportId?: string }) {
  if (reports.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
      <p className="font-medium text-slate-900">本地报告历史</p>
      <div className="mt-3 space-y-2">
        {reports.slice(0, 5).map((report) => (
          <Link
            key={report.id}
            href={`/projects/${report.projectId}/coach?researchStatus=provider&report=${report.id}`}
            className={`block rounded-xl border px-3 py-2 ${report.id === activeReportId ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span className="block font-medium">{report.id === activeReportId ? "当前报告" : "查看报告"}</span>
            <span className="mt-1 block text-xs">{new Date(report.createdAt).toLocaleString("zh-CN")} · {report.queueItemIds.length} 个调研项</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function JdCoverageView({ projectId, resumeId, coverage }: { projectId: string; resumeId: string; coverage: JdCoverageResult }) {
  if (coverage.status === "no-keywords") {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>当前简历未配置 JD 关键词。</p>
        <p>
          请先到{" "}
          <Link className="font-medium text-slate-900 underline" href={`/projects/${projectId}/resumes/${resumeId}/edit`}>
            简历编辑页
          </Link>{" "}
          填写 target.keywords 或粘贴 JD 文本，再回来复查缺口。
        </p>
      </div>
    );
  }

  const { covered, uncovered, total } = coverage;
  const visibleUncovered = uncovered.slice(0, 10);
  const remaining = uncovered.slice(10);

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        共 {total} 个 JD 关键词；覆盖 {covered.length} / 未覆盖 {uncovered.length}。覆盖判定：经历 STAR、confirmed bullet、技能字段做大小写不敏感 substring 匹配。
      </p>

      <div>
        <p className="font-medium text-emerald-700">已覆盖（{covered.length}）</p>
        {covered.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">暂无；先确认 STAR 与正文 bullet 后再回来复查。</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {covered.map((keyword) => (
              <span key={keyword} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="font-medium text-amber-700">未覆盖（{uncovered.length}）</p>
        {uncovered.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">所有 JD 关键词均已被简历覆盖。</p>
        ) : (
          <>
            <div className="mt-2 space-y-2">
              {visibleUncovered.map((keyword) => (
                <div key={keyword} className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    {keyword}
                  </span>
                  {coverage.webCitations?.[keyword]?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-amber-900">
                      {coverage.webCitations[keyword].map((citation) => (
                        <a key={citation.url} href={citation.url} className="block underline" target="_blank" rel="noreferrer">
                          {citation.host ?? citation.title} · {citation.retrievedAt ?? "retrieved"}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {remaining.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">展开剩余 {remaining.length} 项</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {remaining.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      {keyword}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
            <Link
              href={`/projects/${projectId}/coach?queue=resume-jd-gap&researchStatus=preview`}
              className="mt-3 inline-block rounded-full bg-slate-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              加入调研队列复查
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function CoachFlowRail({ steps }: { steps: CoachFlowStep[] }) {
  return (
    <nav aria-label="简历教练流程" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="grid gap-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step.key} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${flowStatusClass(step.status)}`}>
                {flowStatusLabel(step.status)}
              </span>
            </div>
            <p className="mt-3 font-medium text-slate-950">{step.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function CoachMetrics({ metrics }: { metrics: CoachMetric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className={`rounded-2xl border p-4 ${metricTone(metric.tone)}`}>
          <p className="text-xs opacity-70">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
          <p className="mt-1 text-xs opacity-70">{metric.hint}</p>
        </div>
      ))}
    </div>
  );
}

function WorkbenchShell({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]">{left}{right}</div>;
}

function SidePanel({ children }: { children: React.ReactNode }) {
  return <aside className="space-y-4">{children}</aside>;
}

function isEligibleEvidence(evidence: ResumeDocument["experiences"][number]["evidence"][number]): boolean {
  return evidence.actions.length > 0 && evidence.results.length > 0 && evidence.results.some((result) => result.confidence === "confirmed");
}

function EvidenceBulletDraftPanel({ projectId, resumeId, items }: { projectId: string; resumeId?: string; items: EvidenceBulletDraftItem[] }) {
  return (
    <SectionCard title="证据生成候选正文" eyebrow="confirmed evidence → 候选正文 → 用户确认后写入">
      <div className="space-y-4 text-sm text-slate-600">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          这里只展示已具备动作、结果和已确认结果的 STAR 证据。生成只创建候选正文；采纳后才写入 confirmed bullet，并保留 source evidence trace。
        </p>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-slate-500">
            暂无可生成正文的已确认证据。先在经历深挖 Q&A 中确认 STAR 证据。
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const draft = item.draft;
              return (
                <div key={`${item.experienceId}:${item.evidence.id}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">证据来源</p>
                      <p className="mt-1 font-medium text-slate-950">{item.experienceLabel}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${draft ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                      {draft ? "候选正文 / 待确认" : "可生成候选"}
                    </span>
                  </div>
                  {item.evidence.context ? <p className="mt-3 text-slate-700">{item.evidence.context}</p> : null}
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                    <p>动作：{item.evidence.actions.slice(0, 2).join("；")}</p>
                    <p>结果：{item.evidence.results.slice(0, 2).map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text).join("；")}</p>
                  </div>
                  {draft ? (
                    <div className="mt-4 space-y-3">
                      {draft.candidates.map((candidate, candidateIndex) => (
                        <form key={candidateIndex} action={resumeId ? applyEvidenceBulletDraftAction.bind(null, projectId, resumeId, draft.id) : undefined} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <input type="hidden" name="candidateIndex" value={candidateIndex} />
                          <label className="block">
                            <span className="text-xs font-medium text-amber-900">候选正文 / 待确认</span>
                            <textarea
                              name="finalText"
                              defaultValue={candidate.text}
                              className="mt-2 min-h-28 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-900"
                            />
                          </label>
                          {candidate.rationale ? <p className="text-xs text-amber-800">生成依据：{candidate.rationale}</p> : null}
                          <button
                            type="submit"
                            disabled={!resumeId}
                            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            确认采纳，写入 confirmed bullet
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <form action={resumeId ? generateEvidenceBulletDraftAction.bind(null, projectId, resumeId, item.experienceId, item.evidence.id) : undefined} className="mt-4 space-y-3">
                      <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
                        <span>我已确认：将向当前模型 provider 发送这条已确认 STAR 证据、目标岗位/JD 摘要与技能摘要，用于生成候选正文。</span>
                      </label>
                      <button
                        type="submit"
                        disabled={!resumeId}
                        className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        生成候选正文
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function GrillEnhancementPanel({
  projectId,
  resumeId,
  current,
  enhancement,
  hasDefaultModel,
  preview,
}: {
  projectId: string;
  resumeId?: string;
  current?: CoachQaTurn;
  enhancement?: GrillEnhancement;
  hasDefaultModel: boolean;
  preview: ReturnType<typeof createPrivacyPreviewToken> | null;
}) {
  const draft = enhancement?.distilledEvidenceDraft;
  const canPromoteDraft = Boolean(resumeId && current?.answer?.status === "confirmed" && current.answer.targetSource === "experience" && draft);

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sky-950">AI clarify</p>
          <p className="mt-1 text-xs leading-5 text-sky-800">显式触发；结果只作为追问辅助和待确认 STAR 草稿，不写入 confirmed bullet。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-200">
          {enhancement ? "已生成" : "deterministic 可用"}
        </span>
      </div>

      {preview ? (
        <details className="rounded-xl border border-sky-200 bg-white/70 p-3 text-xs text-sky-900">
          <summary className="cursor-pointer font-medium">隐私预览 payload</summary>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-slate-100">{preview.sanitized.preview}</pre>
          {preview.sanitized.removedFields.length > 0 ? (
            <p className="mt-2 text-amber-700">Removed fields: {preview.sanitized.removedFields.join(", ")}</p>
          ) : null}
        </details>
      ) : null}

      <form action={resumeId ? runGrillEnhancementAction.bind(null, projectId, resumeId) : undefined} className="space-y-3">
        <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
          <span>我已确认：将向默认模型 provider 发送当前追问、最近 Q&A、confirmed evidence 摘要和已标记 untrusted 的 JD 片段，用于澄清/冲突/追问建议。</span>
        </label>
        <button
          type="submit"
          disabled={!resumeId || !current || !hasDefaultModel}
          className="rounded-full bg-sky-950 px-5 py-2 text-xs font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          生成 AI clarify
        </button>
      </form>
      {!hasDefaultModel ? <p className="text-xs text-sky-800">未配置默认模型时保持 deterministic 追问，不调用 provider。</p> : null}

      {enhancement ? (
        <div className="space-y-3">
          {enhancement.restate ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">一句话复述</p>
              <p className="mt-2 text-slate-700">{enhancement.restate.text}</p>
              {enhancement.restate.lowConfidence ? <p className="mt-2 text-xs text-amber-700">lowConfidence：请用户确认后再入图。</p> : null}
            </div>
          ) : null}
          {enhancement.fuzzyTerms.length > 0 ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">模糊词澄清</p>
              <ul className="mt-2 space-y-2 text-slate-700">
                {enhancement.fuzzyTerms.map((item) => (
                  <li key={`${item.term}:${item.question}`}>
                    <span className="font-medium">{item.term}</span>：{item.question}{item.lowConfidence ? "（低置信）" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {enhancement.conflicts.length > 0 ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-rose-200">
              <p className="font-medium text-rose-900">冲突待裁决</p>
              <ul className="mt-2 space-y-2 text-slate-700">
                {enhancement.conflicts.map((item) => (
                  <li key={`${item.claim}:${item.citation}`} className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <p>主张：{item.claim}</p>
                    <p className="mt-1">证据：{item.evidence}</p>
                    <p className="mt-1 text-xs text-rose-800">{item.reason} · citation: {item.citation}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {enhancement.probe ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">动态追问</p>
              <p className="mt-2 text-slate-700">{enhancement.probe.question}</p>
              <p className="mt-1 text-xs text-slate-500">{enhancement.probe.kind} · {enhancement.probe.reason}</p>
            </div>
          ) : null}

          {draft ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">待确认 STAR 草稿</p>
              {draft.lowConfidence ? <p className="mt-2 text-xs text-amber-700">lowConfidence：含被丢弃或弱 grounding 字段，需人工确认。</p> : null}
              <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                <p>背景：{draft.context ?? "待补"}</p>
                <p>任务：{draft.task ?? "待补"}</p>
                <p>动作：{draft.actions.join("；") || "待补"}</p>
                <p>结果：{draft.results.map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text).join("；") || "待补"}</p>
              </div>
              {canPromoteDraft && current?.answer ? (
                <form action={promoteCoachQaAnswerToEvidenceAction.bind(null, projectId, resumeId!, current.answer.id)} className="mt-3 space-y-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
                  <input type="hidden" name="starResultConfidence" value="confirmed" />
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">背景</span>
                    <textarea name="starContext" defaultValue={draft.context ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">任务</span>
                    <textarea name="starTask" defaultValue={draft.task ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">动作（至少 1 条）</span>
                    <textarea name="starAction" required defaultValue={draft.actions[0] ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <div className="grid gap-2 md:grid-cols-[1fr_0.45fr]">
                    <label className="block">
                      <span className="text-xs font-medium text-sky-950">结果（至少 1 条）</span>
                      <textarea name="starResultText" required defaultValue={draft.results[0]?.text ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-sky-950">指标</span>
                      <input name="starResultMetric" defaultValue={draft.results[0]?.metric ?? ""} maxLength={500} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">技能</span>
                    <input name="starSkill" defaultValue={draft.skills[0] ?? ""} maxLength={200} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">来源文本</span>
                    <textarea name="starSourceText" defaultValue={draft.sourceText} maxLength={4000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800">
                    人工确认后写入 evidence graph
                  </button>
                </form>
              ) : (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">先把当前 Q&A 标记为事实笔记，才可用此草稿预填 STAR 入图。</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExperienceQuestionWorkbench({
  projectId,
  resumeId,
  session,
  items,
  hasDefaultModel,
  preview,
}: {
  projectId: string;
  resumeId?: string;
  session: CoachGrillSession;
  items: ExperienceDeepDiveItem[];
  hasDefaultModel: boolean;
  preview: ReturnType<typeof createPrivacyPreviewToken> | null;
}) {
  const current = session.base.activeTurn;
  const activeItem = current ? items.find((item) => item.id === current.targetId && item.source === current.targetSource) : undefined;
  const upcomingTurns = session.base.turns.filter((turn) => turn !== current).slice(0, 4);
  return (
    <SectionCard title="经历深挖 Q&A" eyebrow="resumify 式逐段追问 · 本地保存 · 不入 confirmed preview">
      <WorkbenchShell
        left={
          <SidePanel>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">会话进度</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">待回答 {session.base.counts.pending}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">已保存 {session.base.counts.answered}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">需证据 {session.base.counts["needs-evidence"]}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">可推进 {session.base.counts["ready-to-promote"]}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">已入图 {session.base.counts.promoted}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">已阻塞 {session.base.counts.blocked}</span>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                暂无经历或项目可追问。请先在简历编辑页补充实习、工作或项目经历。
              </div>
            ) : (
              <ol className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className={`rounded-2xl border p-4 text-sm ${current?.targetId === item.id ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{turnSourceLabel(item.source)}</span>
                      <span className="text-xs text-slate-500">{item.questions.length} 问</span>
                    </div>
                    <p className="mt-3 font-medium text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">confirmed bullet：{item.confirmedBulletCount}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.gapLabels.length > 0 ? item.gapLabels.map((gap) => (
                        <span key={gap} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                          {gap}
                        </span>
                      )) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">待复核</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-medium text-slate-900">下一步队列</p>
              {upcomingTurns.length === 0 ? (
                <p className="mt-2 text-slate-500">暂无后续 turn。</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {upcomingTurns.map((turn) => (
                    <li key={`${turn.targetId}:${turn.questionId}`} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <p className="font-medium text-slate-950">{turn.targetLabel}</p>
                      <p className="mt-1 text-slate-500">{turn.questionPrompt}</p>
                      <p className="mt-2 text-slate-500">{qaTurnStatusLabel(turn.status)} · {turn.reason}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </SidePanel>
        }
        right={
          current && activeItem ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">当前深挖对象</p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{current.targetLabel}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {turnSourceLabel(current.targetSource)} · {qaTurnStatusLabel(current.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{current.reason}</p>
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                  <p className="font-medium text-sky-950">Grill 目标维度：{questionKindLabel(session.weakestDimension)} · {session.dimensionScores[session.weakestDimension].toFixed(2)}</p>
                  <p className="mt-1">{session.weakestReason}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{questionKindLabel(current.questionKind)}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${qaTurnStatusClass(current.status)}`}>{qaTurnStatusLabel(current.status)}</span>
                </div>
                <p className="mt-3 font-medium leading-6 text-slate-950">{current.questionPrompt}</p>
                <p className="mt-2 leading-6 text-slate-600">{activeItem.questions.find((question) => question.id === current.questionId)?.why ?? ""}</p>
                {session.recommendedAnswers.length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {session.recommendedAnswers.map((answer) => (
                      <div key={answer.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-900">推荐脚手架 · {answer.label}</p>
                        <p className="mt-2 whitespace-pre-line leading-5">{answer.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {current.answer ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-700">本地 Q&A 笔记</p>
                    <p className="mt-1 whitespace-pre-line text-slate-700">{answerExcerpt(current.answer.answerText)}</p>
                    <p className="mt-2 text-slate-500">
                      更新时间：{new Date(current.answer.updatedAt).toLocaleString("zh-CN")} · 不进入 confirmed preview 或导出
                    </p>
                    {resumeId && current.answer.status === "confirmed" && current.answer.targetSource === "experience" ? (
                      <form action={promoteCoachQaAnswerToEvidenceAction.bind(null, projectId, resumeId, current.answer.id)} className="mt-3 space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="font-medium text-slate-800">入 evidence graph</p>
                        <p className="text-slate-500">需手填 STAR；不会生成 confirmed bullet 或导出内容。</p>
                        <label className="block">
                          <span className="text-slate-600">背景</span>
                          <textarea name="starContext" maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">任务</span>
                          <textarea name="starTask" maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">动作（至少 1 条）</span>
                          <textarea name="starAction" required maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <div className="grid gap-2 md:grid-cols-[1fr_0.45fr]">
                          <label className="block">
                            <span className="text-slate-600">结果（至少 1 条）</span>
                            <textarea name="starResultText" required maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                          </label>
                          <label className="block">
                            <span className="text-slate-600">指标</span>
                            <input name="starResultMetric" maxLength={500} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                          </label>
                        </div>
                        <input type="hidden" name="starResultConfidence" value="confirmed" />
                        <label className="block">
                          <span className="text-slate-600">技能</span>
                          <input name="starSkill" maxLength={200} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">来源文本</span>
                          <textarea name="starSourceText" maxLength={4000} defaultValue={current.answer.answerText} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800">
                          确认写入 evidence graph
                        </button>
                      </form>
                    ) : current.answer.targetSource === "project" ? (
                      <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-500 ring-1 ring-slate-200">项目 Q&A 暂不入 evidence graph；本轮只支持经历 Q&A。</p>
                    ) : current.answer.status !== "confirmed" ? (
                      <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-500 ring-1 ring-slate-200">先标记为事实笔记，才可手填 STAR 入 evidence graph。</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <GrillEnhancementPanel
                projectId={projectId}
                resumeId={resumeId}
                current={current}
                enhancement={session.enhancement}
                hasDefaultModel={hasDefaultModel}
                preview={preview}
              />

              <ol className="space-y-3">
                {activeItem.questions.map((question) => {
                  const isActive = question.id === current.questionId;
                  return (
                    <li key={question.id} className={`rounded-2xl border p-4 text-sm ${isActive ? "border-slate-300 bg-white shadow-sm" : "border-slate-200"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{questionKindLabel(question.kind)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${question.status === "needs-evidence" ? "bg-amber-50 text-amber-700 ring-amber-200" : question.status === "answered" ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>{question.status === "needs-evidence" ? "需证据" : question.status === "answered" ? "已有线索" : "待回答"}</span>
                        {current.answer ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${qaTurnStatusClass(current.status)}`}>{qaTurnStatusLabel(current.status)}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 font-medium leading-6 text-slate-950">{question.prompt}</p>
                      <p className="mt-2 leading-6 text-slate-600">{question.why}</p>
                    </li>
                  );
                })}
              </ol>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                {resumeId && current ? (
                  <form
                    action={saveCoachQaAnswerAction.bind(null, projectId, resumeId)}
                    className="space-y-3 rounded-2xl border border-slate-200 p-4 text-sm"
                  >
                    <input type="hidden" name="targetId" value={current.targetId} />
                    <input type="hidden" name="targetSource" value={current.targetSource} />
                    <input type="hidden" name="questionId" value={current.questionId} />
                    <input type="hidden" name="questionKind" value={current.questionKind} />
                    <input type="hidden" name="questionPrompt" value={current.questionPrompt} />
                    <label className="block">
                      <span className="font-medium text-slate-950">回答 “{current.questionPrompt}”</span>
                      <textarea
                        name="answerText"
                        required
                        maxLength={4000}
                        defaultValue={current.answer?.answerText ?? ""}
                        placeholder="只用本地 workspace 保存；不会进入 confirmed bullet 或导出。"
                        className="mt-3 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                      />
                    </label>
                    <p className="text-xs text-slate-500">即使标记为“事实笔记”，也只是 Q&A 状态；写入 confirmed bullet 仍需要走证据图与文案确认。</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="status"
                        value="draft"
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        保存为草稿
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="confirmed"
                        className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        标记为事实笔记
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="rejected"
                        className="rounded-full border border-rose-200 px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        标记不用
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    {resumeId ? "当前对象暂无可回答问题。" : "尚未创建主简历，请先到项目中心创建主简历后再使用 Q&A。"}
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-950">确认阶梯</p>
                  <ol className="space-y-2">
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">1. 用户事实：背景、动作、结果由用户确认</li>
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">2. 用户证据：截图、报告、反馈等先入 evidence graph</li>
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">3. 文案建议：只生成候选，不等于真实事实</li>
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">4. confirmed bullet：二次确认后才进入预览</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              没有可展示的当前问题。补充经历或项目后会自动生成 Q&A 队列。
            </div>
          )
        }
      />
    </SectionCard>
  );
}

function BuilderSnapshotWorkbench({
  projectId,
  snapshot,
  summary,
}: {
  projectId: string;
  snapshot: BuilderSnapshot;
  summary: BuilderWorkbenchSummary;
}) {
  const viewModes = ["编辑 + 预览", "仅编辑", "仅预览"];
  return (
    <SectionCard title="确认内容排版入口" eyebrow="本地管理 + 编辑 + 预览底座">
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">项目</p>
            <p className="mt-2 truncate font-medium text-slate-950">{summary.projectName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">简历库</p>
            <p className="mt-2 font-medium text-slate-950">{summary.resumeCount} 份 · 变体 {summary.variantCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">confirmed bullet</p>
            <p className="mt-2 font-medium text-slate-950">{summary.confirmedBulletCount} 条</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">审计报告</p>
            <p className="mt-2 font-medium text-slate-950">{summary.reportCount} 份</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-2">
            {viewModes.map((mode, index) => (
              <span
                key={mode}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${index === 0 ? "bg-white text-slate-950 ring-slate-300" : "bg-slate-100 text-slate-500 ring-slate-200"}`}
              >
                {mode}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <Link href={`/projects/${projectId}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-white">
              项目中心
            </Link>
            {summary.masterResumeId ? (
              <>
                <Link href={`/projects/${projectId}/resumes/${summary.masterResumeId}/edit`} className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-white">
                  编辑主简历
                </Link>
                <Link href={`/projects/${projectId}/resumes/${summary.masterResumeId}/export`} className="rounded-full bg-slate-950 px-3 py-1.5 text-white hover:bg-slate-800">
                  导出本地成品
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">主简历</p>
              <p className="mt-2 font-medium text-slate-950">{summary.masterResumeName ?? "尚未创建主简历"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">这里复用当前项目的 storage/index，不显示本地文件路径。</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">个人信息模块</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {snapshot.personalInfo.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">求职意向模块</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {snapshot.jobIntention.map((item) => (
                  <span key={item} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-xs leading-5 text-slate-500">
              确认边界：这里只做 `ResumeDocument` → builder snapshot 的本地映射；不导入 localStorage、Tauri、Supabase 或真实 provider 运行时。未确认事实留在 evidence graph，不进入预览或导出入口。
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-center text-2xl font-semibold tracking-tight">{snapshot.title}</h3>
              <div className="mt-5 space-y-4">
                {snapshot.modules.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">暂无 confirmed 内容；先通过问答、证据确认和文案确认补齐。</p>
                ) : (
                  snapshot.modules.map((module) => (
                    <section key={module.id} className="border-t border-slate-200 pt-3">
                      <h4 className="text-sm font-semibold text-slate-950">{module.title}</h4>
                      {module.rows.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                          {module.rows.map((row) => (
                            <li key={row}>• {row}</li>
                          ))}
                        </ul>
                      ) : null}
                      {module.tags && module.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {module.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function SectionCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function CoachPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const query = await searchParams;
  const project = getProject(projectId);
  if (!project) notFound();

  const resumes = listResumes(project.id);
  const master = firstResume(resumes, "master");
  let document: ResumeDocument | null = null;
  let resumeError: string | null = null;

  if (master) {
    try {
      document = await readResume(master.filePath);
    } catch {
      resumeError = "简历读取失败：请检查当前项目的本地简历文件是否仍存在且格式有效。";
    }
  }

  const evidenceNodes = buildEvidenceNodes(document);
  const researchQueue = buildResearchQueue(document);
  const queueIds = selectedQueueIds(query);
  let researchError = readableResearchError(query?.researchError);
  let persistedReport: CoachResearchReport | null = null;
  const reportRecords = master ? listCoachResearchReports(project.id, master.id) : [];
  if (master && query?.researchStatus === "provider") {
    try {
      persistedReport = query.report
        ? await readCoachResearchReport(project.id, master.id, query.report)
        : await getLatestCoachResearchReport(project.id, master.id);
    } catch {
      researchError = researchError ?? readableResearchError("report-read-failed");
    }
    if (!persistedReport && !researchError) {
      researchError = readableResearchError("report-read-failed");
    }
  } else if (master && !query?.researchStatus && reportRecords.length > 0) {
    try {
      persistedReport = await getLatestCoachResearchReport(project.id, master.id);
    } catch {
      researchError = researchError ?? readableResearchError("report-read-failed");
    }
  }
  const previewReport =
    document &&
    master &&
    query?.researchStatus === "preview" &&
    queueIds.length > 0
      ? buildResearchReport({
          projectId: project.id,
          resume: master,
          document,
          queueItemIds: queueIds,
          queueItems: researchQueue,
        })
      : null;
  const researchReport = persistedReport ?? previewReport;
  const activeReportId = persistedReport?.id;
  const targetRole = document?.basics.targetRole || document?.target?.role || "未设置目标岗位";
  const experienceOptions = document?.experiences.map((item) => ({
    id: item.id,
    label: `${item.role || "未填角色"} @ ${item.organization || "未填组织"}`,
  })) ?? [];
  const confirmError = readableConfirmError(query?.confirmCode);
  const confirmOk =
    query?.confirmStatus === "ok"
      ? "已确认进入证据图，可继续生成 bullet 草稿入正文。"
      : query?.confirmStatus === "draft"
      ? "已生成 bullet 草稿，请审改后入正文。"
      : query?.confirmStatus === "applied"
      ? "已入正文，可在简历编辑页查看新增 bullet。"
      : null;

  const jdCoverage: JdCoverageResult | null = document ? analyzeJdCoverage(document) : null;
  const coachMetrics = buildCoachMetrics({ document, resumes, reportRecords, jdCoverage });
  const builderSnapshot = buildBuilderSnapshot(document);

  let qaAnswers: CoachQaAnswer[] = [];
  let qaError: string | null = null;
  if (master) {
    try {
      qaAnswers = await listCoachQaAnswers(project.id, master.id);
    } catch {
      qaError = readableQaError("qa-read-failed");
    }
  }
  const qaQueue = buildExperienceQuestionQueue(document);
  const baseQaSession = buildGrillSession({ queue: qaQueue, answers: qaAnswers, document });
  const grillEnhancementRecord = master
    ? await readCoachGrillEnhancement({ projectId: project.id, resumeId: master.id, activeTurn: baseQaSession.base.activeTurn })
    : null;
  const qaSession = buildGrillSession({
    queue: qaQueue,
    answers: qaAnswers,
    document,
    enhancement: grillEnhancementRecord?.enhancement,
  });
  const modelConfigs = await listModelConfigs();
  const defaultModel = modelConfigs.find((config) => config.isDefault && config.hasApiKey);
  const hasDefaultModel = Boolean(defaultModel);
  const grillEnhancePreview = master && defaultModel && baseQaSession.base.activeTurn
    ? createPrivacyPreviewToken({
        actionLabel: "AI clarify",
        payload: {
          model: defaultModel.model,
          request: buildGrillEnhancementRequest({
            activeTurn: baseQaSession.base.activeTurn,
            answers: qaAnswers,
            document,
            weakestDimension: baseQaSession.weakestDimension,
          }),
        },
        scope: {
          kind: "ai-clarify",
          provider: defaultModel.provider,
          reason: "grill fuzzy clarify/conflict/probe/distil",
          endpoint: `${defaultModel.baseUrl.replace(/\/+$/, "")}/chat/completions`,
        },
      })
    : null;
  const qaSubmitError = readableQaError(query?.qaCode);
  const qaEvidenceError = readableQaEvidenceError(query?.qaEvidenceCode);
  const grillEnhanceError = readableGrillEnhanceError(query?.grillEnhanceCode);
  const qaOk = query?.qaStatus === "saved" ? "已保存本地 Q&A 笔记；不进入 confirmed bullet 或导出。" : null;
  const qaEvidenceOk = query?.qaEvidenceStatus === "ok" ? "已写入 evidence graph；仍未生成 confirmed bullet 或导出内容。" : null;
  const grillEnhanceOk = query?.grillEnhanceStatus === "generated" ? "AI clarify 已生成并保存到本地 QA 目录；未写入简历事实。" : null;
  const evidenceBulletError = readableEvidenceBulletError(query?.evidenceBulletCode);
  const evidenceBulletOk =
    query?.evidenceBulletStatus === "draft"
      ? "已生成候选正文；尚未写入 confirmed bullet 或导出内容。"
      : query?.evidenceBulletStatus === "applied"
      ? "已采纳候选正文并写入 confirmed bullet。"
      : null;
  const evidenceDraftItems: EvidenceBulletDraftItem[] = [];
  if (master && document) {
    for (const experience of document.experiences) {
      const experienceLabel = `${experience.role || "未填角色"} @ ${experience.organization || "未填组织"}`;
      for (const evidence of experience.evidence) {
        if (!isEligibleEvidence(evidence)) continue;
        evidenceDraftItems.push({
          experienceId: experience.id,
          experienceLabel,
          evidence,
          draft: await getActivePendingDraftForEvidence(project.id, master.id, evidence.id) ?? undefined,
        });
      }
    }
  }
  const builderSummary = buildBuilderWorkbenchSummary({
    projectName: project.name,
    resumes,
    master,
    document,
    reportCount: reportRecords.length,
  });

  const bulletPanels: Record<string, { hasPendingDraft: boolean; draftId?: string; candidates?: { text: string; rationale?: string }[] }> = {};
  const appliedBulletText: Record<string, string> = {};
  if (master && persistedReport && persistedReport.schemaVersion === "coach-report-v2" && !persistedReport.id.startsWith("preview-")) {
    for (const finding of persistedReport.findings) {
      if (finding.confirmationStatus !== "confirmed") continue;
      if (finding.linkedBulletId) {
        const exp = document?.experiences.find((item) => item.id === finding.linkedExperienceId);
        const bullet = exp?.bullets.find((b) => b.id === finding.linkedBulletId);
        if (bullet) appliedBulletText[finding.linkedBulletId] = bullet.text;
        continue;
      }
      const pending = await getActivePendingDraft(project.id, master.id, finding.id);
      if (pending) {
        bulletPanels[finding.id] = {
          hasPendingDraft: true,
          draftId: pending.id,
          candidates: pending.candidates,
        };
      } else {
        bulletPanels[finding.id] = {
          hasPendingDraft: hasPendingDraftForFinding(project.id, master.id, finding.id),
        };
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/projects/${project.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
            ← 返回项目
          </Link>
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
            本页 GET 仅读本地 workspace
          </span>
        </div>

        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="p-8">
              <p className="text-sm text-slate-300">Grill Coach · 证据驱动简历工作台</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">追问事实、评估可信度，再把确认内容推进简历</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                当前页把 rmx 来源里的诊断、追问、证据图和联网评估合成一个工作台：先用本地材料生成问题，再用 Tavily cited evaluation 查 JD 覆盖、技能稀缺度和公司/项目可信信号。AI 润色与中文 DOCX 仍是后续 slice，不在这里伪装完成。
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium">
                <Link href={`/projects/${project.id}/intake`} className="rounded-full bg-white px-4 py-2 text-slate-950 hover:bg-slate-100">补充材料</Link>
                <Link href={`/projects/${project.id}/coach/polish`} className="rounded-full bg-white px-4 py-2 text-slate-950 hover:bg-slate-100">候选润色</Link>
                <Link href="/settings/search" className="rounded-full bg-white/10 px-4 py-2 text-slate-200 hover:bg-white/15">配置 Tavily</Link>
                <span className="rounded-full bg-white/10 px-4 py-2 text-slate-200">provider 只由表单显式触发</span>
                <span className="rounded-full bg-white/10 px-4 py-2 text-slate-200">正文只写 confirmed evidence</span>
              </div>
            </div>
            <div className="border-t border-white/10 bg-white/5 p-6 lg:border-l lg:border-t-0">
              <div className="grid gap-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-slate-300">项目</p>
                  <p className="mt-1 font-medium">{project.name}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-slate-300">目标岗位</p>
                  <p className="mt-1 font-medium">{targetRole}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-slate-300">当前简历数</p>
                  <p className="mt-1 font-medium">{resumes.length} 份</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CoachFlowRail steps={coachFlowSteps} />
        <CoachMetrics metrics={coachMetrics} />
        <BuilderSnapshotWorkbench projectId={project.id} snapshot={builderSnapshot} summary={builderSummary} />
        <ExperienceQuestionWorkbench
          projectId={project.id}
          resumeId={master?.id}
          session={qaSession}
          items={qaQueue}
          hasDefaultModel={hasDefaultModel}
          preview={grillEnhancePreview}
        />

        {resumeError ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{resumeError}</p>
        ) : null}

        {researchError ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{researchError}</p>
        ) : null}

        {confirmError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{confirmError}</p>
        ) : null}

        {confirmOk ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{confirmOk}</p>
        ) : null}

        {qaError ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{qaError}</p>
        ) : null}

        {qaSubmitError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{qaSubmitError}</p>
        ) : null}

        {qaEvidenceError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{qaEvidenceError}</p>
        ) : null}

        {grillEnhanceError ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{grillEnhanceError}</p>
        ) : null}

        {qaOk ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{qaOk}</p>
        ) : null}

        {qaEvidenceOk ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{qaEvidenceOk}</p>
        ) : null}

        {grillEnhanceOk ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{grillEnhanceOk}</p>
        ) : null}

        {evidenceBulletError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{evidenceBulletError}</p>
        ) : null}

        {evidenceBulletOk ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{evidenceBulletOk}</p>
        ) : null}

        <EvidenceBulletDraftPanel projectId={project.id} resumeId={master?.id} items={evidenceDraftItems} />

        <WorkbenchShell
          left={
            <SidePanel>
              <SectionCard title="材料工作台" eyebrow="resumify 式导入入口">
                <div className="space-y-4 text-sm text-slate-600">
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">旧简历</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">拆出现有经历和 bullet，不自动采信夸张表述。</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">经历草稿</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">转成 STAR 追问素材，等待用户确认事实。</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">目标 JD</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">只作匹配和缺口复查，不写成用户经历。</p>
                    </div>
                  </div>
                  <label className="block">
                    <span className="font-medium text-slate-900">材料暂存区</span>
                    <textarea
                      disabled
                      placeholder="后续接入：粘贴旧简历 / 经历草稿 / JD。"
                      className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                    />
                  </label>
                </div>
              </SectionCard>

              <SectionCard title="追问面板" eyebrow="grill-with-docs 魔改">
                <div className="space-y-4 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">当前追问块</p>
                    <p className="mt-1 font-medium text-slate-950">{document?.experiences[0]?.organization || "第一段经历待补充"}</p>
                  </div>
                  <div className="space-y-2">
                    {["任务是什么", "动作是什么", "结果如何", `如何匹配 ${targetRole}`].map((question) => (
                      <div key={question} className="rounded-2xl border border-slate-200 p-3">
                        <p className="font-medium text-slate-900">{question}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">答案只进 evidence 候选。</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </SidePanel>
          }
          right={
            <div className="space-y-6">
              <SectionCard title="Evidence graph 简历底稿" eyebrow="结构化分区 · 事实与文案分离">
                <div className="grid gap-3 lg:grid-cols-3">
                  {evidenceNodes.map((node) => (
                    <div key={node.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{kindLabel(node.kind)}</span>
                        <span className="text-xs text-slate-500">置信度：{confidenceLabel(node.confidence)}</span>
                      </div>
                      <p className="mt-3 leading-6 text-slate-700">{node.text}</p>
                      <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <p>来源：{node.sourceLabel}</p>
                        <p>状态：{statusLabel(node.confirmationStatus)}</p>
                        <p>正文资格：{node.canEnterResume ? "可进入，但需确认" : "不可直接进入"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
                <SectionCard title="半自动调研队列" eyebrow="用户勾选后批量跑">
                  <form action={runCoachResearchAction.bind(null, project.id)} className="space-y-3">
                    {researchQueue.map((item) => (
                      <label key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
                        <input
                          type="checkbox"
                          name="queueItemId"
                          value={item.id}
                          defaultChecked={item.selected}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium text-slate-900">{item.title}</span>
                          <span className="mt-1 block text-slate-500">
                            {scopeLabel(item.scope)} · {item.reason}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
                      <span>我已确认：将向当前模型 provider 发送勾选调研项、目标岗位/JD 摘要、首条经历/项目/技能摘要；不会发送电话、邮箱、本机路径或 API key。</span>
                    </label>
                    <button
                      type="submit"
                      className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      运行真实 provider 调研
                    </button>
                    <p className="text-xs text-slate-500">
                      只在提交后校验项目、主简历、勾选项、简历可读性和默认模型配置；通过后才调用 OpenAI-compatible provider。
                    </p>
                  </form>
                  <form action={runCoachSearchEvaluationAction.bind(null, project.id)} className="mt-4 space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm font-medium text-sky-950">Tavily 三维评估</p>
                    <p className="text-xs text-sky-800">用 confirmed 技能、公司与项目名查询公开来源，输出技能稀缺度与公司/项目可验证度。</p>
                    <label className="flex items-start gap-2 text-xs text-sky-800">
                      <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
                      <span>我已确认：将向 Tavily 发送 confirmed 技能、组织名、项目名和目标岗位关键词；不会发送电话、邮箱、本机路径或 API key。</span>
                    </label>
                    <button type="submit" className="rounded-full bg-sky-950 px-5 py-2 text-sm font-medium text-white hover:bg-sky-800">运行 Tavily cited evaluation</button>
                  </form>
                </SectionCard>

                <SectionCard title="可审计调研报告" eyebrow="事实 / 推论 / 建议分离">
                  {researchReport ? (
                    <div className="space-y-4">
                      <ResearchReportView
                        report={researchReport}
                        projectId={project.id}
                        resumeId={master?.id ?? ""}
                        experiences={experienceOptions}
                        bulletPanels={bulletPanels}
                        appliedBulletText={appliedBulletText}
                      />
                      <ResearchReportList reports={reportRecords} activeReportId={activeReportId} />
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-slate-600">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="font-medium text-slate-900">等待用户触发</p>
                        <p className="mt-2">勾选左侧调研项并提交后，页面会展示真实 provider 调研报告；配置或调用失败会 fail closed。</p>
                        <p className="mt-2 text-xs text-slate-500">首屏渲染不会调用外部搜索、AI provider、外部上传或写入 resume.json。</p>
                      </div>
                      <ResearchReportList reports={reportRecords} activeReportId={activeReportId} />
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          }
        />

        {jdCoverage && master ? (
          <SectionCard title="JD 缺口复查" eyebrow="Step 5b · JDMatcher 式关键词对照，本地只读">
            <JdCoverageView projectId={project.id} resumeId={master.id} coverage={jdCoverage} />
          </SectionCard>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <SectionCard title="双层确认写入闸门" eyebrow="Step 6 · AI polish 只到候选，用户确认才入正文">
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="rounded-2xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">1. 事实 / 证据确认</p>
                <p className="mt-1">确认这件事真实、属于你、可公开；通过后只写入 evidence graph。</p>
              </li>
              <li className="rounded-2xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">2. 文案确认</p>
                <p className="mt-1">确认 AI bullet 准确、不过度夸大、适合目标岗位；通过后才写入 confirmed bullet。</p>
              </li>
            </ol>
          </SectionCard>

          <SectionCard title="双 Word 输出目标" eyebrow="Step 7 · 模板项目式输出，但只消费 confirmed content">
            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">ATS / 网申安全版</p>
                <p className="mt-2">扁平段落、关键词清晰、机器可读。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">中文视觉精修版</p>
                <p className="mt-2">结构分区更强，适合内推和 HR 阅读。</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
