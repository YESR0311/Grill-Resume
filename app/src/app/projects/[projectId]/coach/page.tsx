import Link from "next/link";
import { notFound } from "next/navigation";
import { buildExperienceQuestionQueue } from "@/features/coach/questions";
import { buildGrillSession } from "@/features/coach/conversation/engine";
import { buildGrillEnhancementRequest } from "@/features/coach/conversation/llm-enhance";
import { buildResearchQueue, type CoachResearchFinding, type CoachResearchQueueItem, type CoachResearchReport } from "@/features/coach/research";
import { getLatestCoachResearchReport, listCoachQaAnswers, listCoachResearchReports, readCoachGrillEnhancement, readCoachResearchReport, type CoachQaAnswer } from "@/features/coach/storage";
import { listModelConfigs } from "@/features/ai/model-configs";
import { createPrivacyPreviewToken } from "@/features/privacy/preview";
import { getActivePendingDraft, getActivePendingDraftForEvidence, hasPendingDraftForFinding } from "@/features/coach/bullet-drafts";
import { analyzeJdCoverage, type JdCoverageResult } from "@/features/coach/jd-coverage";
import { getProject, listResumes, readResume } from "@/features/resume/storage";
import type { ResumeDocument, ResumeRecord } from "@/features/resume/types";
import { EvidenceBulletDraftPanel, isEligibleEvidence, type EvidenceBulletDraftItem } from "./components/bullet-section"; import { EgressPlanPanel } from "./components/egress-plan-panel"; import { GrillSection } from "./components/grill-section";
import { MetricsDashboard, buildBuilderSnapshot, buildBuilderWorkbenchSummary, buildCoachMetrics } from "./components/metrics-dashboard";
import { PipelineStatusBar } from "./components/pipeline-status-bar"; import { ResearchSection } from "./components/research-section";
import { getSession as getPipelineSession } from "@/features/pipeline/storage";

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

function WorkbenchShell({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]">{left}{right}</div>;
}

function SidePanel({ children }: { children: React.ReactNode }) {
  return <aside className="space-y-4">{children}</aside>;
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
  const pipelineSession = await getPipelineSession(project.id);
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

        <PipelineStatusBar session={pipelineSession} projectId={project.id} resumeId={master?.id} />{pipelineSession && !pipelineSession.egressPlan.userConfirmedAt && !pipelineSession.egressPlan.allConfirmedAt ? <EgressPlanPanel session={pipelineSession} /> : null}
        <MetricsDashboard projectId={project.id} metrics={coachMetrics} snapshot={builderSnapshot} summary={builderSummary} />
        <GrillSection
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

              <ResearchSection
                projectId={project.id}
                resumeId={master?.id}
                researchQueue={researchQueue}
                researchReport={researchReport}
                reportRecords={reportRecords}
                activeReportId={activeReportId}
                experiences={experienceOptions}
                bulletPanels={bulletPanels}
                appliedBulletText={appliedBulletText}
                jdCoverage={jdCoverage}
              />
            </div>
          }
        />

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
