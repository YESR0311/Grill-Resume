"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDefaultModelConfig } from "@/features/ai/model-configs";
import {
  buildCoachResearchRequest,
  buildResearchQueue,
  runCoachResearchWithProvider,
  type CoachResearchFinding,
} from "@/features/coach/research";
import {
  buildBulletDraftRequest,
  CoachBulletProviderError,
  runBulletDraftWithProvider,
} from "@/features/coach/bullets";
import {
  createBulletDraftRecord,
  createEvidenceBulletDraftRecord,
  getActivePendingDraftForEvidence,
  hasPendingDraftForFinding,
  markBulletDraftApplied,
  markBulletDraftPending,
  readBulletDraft,
} from "@/features/coach/bullet-drafts";
import {
  clearCoachFindingBulletLink,
  createCoachResearchReport,
  getCoachQaAnswerForEvidence,
  listCoachQaAnswers,
  readCoachResearchReport,
  updateCoachFindingBulletLink,
  updateCoachFindingConfirmation,
  upsertCoachQaAnswer,
  writeCoachGrillEnhancement,
} from "@/features/coach/storage";
import {
  appendExperienceBullet,
  archiveExperienceBullet,
  appendExperienceEvidence,
  getProject,
  getProjectResume,
  listResumes,
  readResume,
  removeExperienceBullet,
  removeExperienceEvidence,
} from "@/features/resume/storage";
import { getActiveSearchProvider, SearchProviderError } from "@/features/search";
import { analyzeJdCoverage, augmentJdCoverageWithSearch } from "@/features/coach/jd-coverage";
import { evaluateSkillScarcity } from "@/features/coach/skill-scarcity";
import { verifyCompaniesAndProjects } from "@/features/coach/company-verify";
import { buildGrillSession } from "@/features/coach/conversation/engine";
import { buildGrillEnhancement } from "@/features/coach/conversation/llm-enhance";
import { buildExperienceQuestionQueue } from "@/features/coach/questions";
import { nanoid } from "nanoid";
import { generatePolishCandidates } from "@/features/polish/generate";
import { createPolishRun, readPolishRun, writePolishRun } from "@/features/polish/store";
import type { ResumeDocument, ResumeRecord } from "@/features/resume/types";

const COACH_SEARCH_TIMEOUT_MS = 12_000;

function firstResume(resumes: ResumeRecord[], kind: ResumeRecord["kind"]): ResumeRecord | undefined {
  return resumes.find((resume) => resume.kind === kind);
}

const qaAnswerInputSchema = z.object({
  targetId: z.string().trim().min(1),
  targetSource: z.enum(["experience", "project"]),
  questionId: z.string().trim().min(1),
  questionKind: z.enum(["context", "action", "result", "metric", "evidence", "jd-fit"]),
  questionPrompt: z.string().trim().min(1).max(1000),
  answerText: z.string().trim().min(1).max(4000),
  status: z.enum(["draft", "confirmed", "rejected"]),
});

function buildQaRedirect(projectId: string, status: "saved" | "error", questionId?: string, code?: string): string {
  const params = new URLSearchParams({ qaStatus: status });
  if (questionId) params.set("question", questionId);
  if (code) params.set("qaCode", code);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

function buildQaEvidenceRedirect(projectId: string, status: "ok" | "error", questionId?: string, code?: string): string {
  const params = new URLSearchParams({ qaEvidenceStatus: status });
  if (questionId) params.set("question", questionId);
  if (code) params.set("qaEvidenceCode", code);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

function buildEvidenceBulletRedirect(projectId: string, status: "draft" | "applied" | "error", evidenceId?: string, code?: string, draftId?: string, bulletId?: string): string {
  const params = new URLSearchParams({ evidenceBulletStatus: status });
  if (evidenceId) params.set("evidence", evidenceId);
  if (code) params.set("evidenceBulletCode", code);
  if (draftId) params.set("draft", draftId);
  if (bulletId) params.set("bullet", bulletId);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

export async function saveCoachQaAnswerAction(projectId: string, resumeId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildQaRedirect(projectId, "error", undefined, "resume-not-found"));

  const current = await getProjectResume(project.id, resumeId);
  if (!current) redirect(buildQaRedirect(project.id, "error", undefined, "resume-not-found"));

  const parsed = qaAnswerInputSchema.safeParse({
    targetId: formData.get("targetId"),
    targetSource: formData.get("targetSource"),
    questionId: formData.get("questionId"),
    questionKind: formData.get("questionKind"),
    questionPrompt: formData.get("questionPrompt"),
    answerText: formData.get("answerText"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    redirect(buildQaRedirect(project.id, "error", String(formData.get("questionId") ?? "") || undefined, "qa-invalid"));
  }

  try {
    await upsertCoachQaAnswer({
      projectId: project.id,
      resumeId: current.resume.id,
      ...parsed.data,
    });
  } catch {
    redirect(buildQaRedirect(project.id, "error", parsed.data.questionId, "qa-persist-failed"));
  }

  redirect(buildQaRedirect(project.id, "saved", parsed.data.questionId));
}

export async function promoteCoachQaAnswerToEvidenceAction(projectId: string, resumeId: string, answerId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildQaEvidenceRedirect(projectId, "error", undefined, "resume-not-found"));

  const current = await getProjectResume(project.id, resumeId);
  if (!current) redirect(buildQaEvidenceRedirect(project.id, "error", undefined, "resume-not-found"));

  let answer;
  try {
    answer = await getCoachQaAnswerForEvidence({
      projectId: project.id,
      resumeId: current.resume.id,
      answerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("尚未确认")
      ? "qa-answer-not-confirmed"
      : message.includes("目标不是经历")
      ? "qa-target-not-experience"
      : message.includes("经历不存在")
      ? "experience-not-found"
      : "qa-answer-not-found";
    redirect(buildQaEvidenceRedirect(project.id, "error", undefined, code));
  }

  const star = pickStarFromForm(formData);
  if (!star.ok) {
    redirect(buildQaEvidenceRedirect(project.id, "error", answer.questionId, "star-invalid"));
  }

  try {
    await appendExperienceEvidence({
      projectId: project.id,
      resumeId: current.resume.id,
      experienceId: answer.targetId,
      star: {
        ...star.value,
        sourceText: star.value.sourceText ?? answer.answerText,
      },
    });
  } catch {
    redirect(buildQaEvidenceRedirect(project.id, "error", answer.questionId, "evidence-append-failed"));
  }

  redirect(buildQaEvidenceRedirect(project.id, "ok", answer.questionId));
}

function privacyConfirmed(formData: FormData): boolean {
  return String(formData.get("privacyConfirmed") ?? "") === "1";
}

function buildProviderErrorRedirect(projectId: string, code: string, selectedIds: string[]): string {
  const params = new URLSearchParams({ researchError: code });
  if (selectedIds.length > 0) params.set("queue", selectedIds.join(","));
  return `/projects/${projectId}/coach?${params.toString()}`;
}

function buildSearchErrorRedirect(projectId: string, code: string): string {
  return `/projects/${projectId}/coach?researchError=${code}`;
}

function buildGrillEnhancementRedirect(projectId: string, status: "generated" | "error", code?: string): string {
  const params = new URLSearchParams({ grillEnhanceStatus: status });
  if (code) params.set("grillEnhanceCode", code);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

const starInputSchema = z.object({
  context: z.string().trim().max(2000).optional(),
  task: z.string().trim().max(2000).optional(),
  actions: z.array(z.string().trim().min(1).max(2000)).min(1),
  results: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(2000),
        metric: z.string().trim().max(500).optional(),
        confidence: z.enum(["confirmed", "needs_confirmation"]),
      }),
    )
    .min(1),
  skills: z.array(z.string().trim().min(1).max(200)),
  scope: z.string().trim().max(500).optional(),
  reflection: z.string().trim().max(2000).optional(),
  sourceText: z.string().trim().max(4000).optional(),
});

function buildConfirmRedirect(projectId: string, status: "ok" | "error", reportId: string, findingId: string, code?: string): string {
  const params = new URLSearchParams({ researchStatus: "provider", report: reportId, confirmStatus: status, finding: findingId });
  if (code) params.set("confirmCode", code);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

function pickStarFromForm(formData: FormData): { ok: true; value: z.infer<typeof starInputSchema> } | { ok: false } {
  const actions = formData
    .getAll("starAction")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const resultTexts = formData.getAll("starResultText").map((value) => String(value));
  const resultMetrics = formData.getAll("starResultMetric").map((value) => String(value));
  const resultConfidences = formData.getAll("starResultConfidence").map((value) => String(value));
  const results = resultTexts.map((text, index) => ({
    text: text.trim(),
    metric: resultMetrics[index]?.trim() || undefined,
    confidence: (resultConfidences[index]?.trim() || "needs_confirmation") as "confirmed" | "needs_confirmation",
  })).filter((item) => item.text.length > 0);
  const skills = formData
    .getAll("starSkill")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const candidate = {
    context: String(formData.get("starContext") ?? "").trim() || undefined,
    task: String(formData.get("starTask") ?? "").trim() || undefined,
    actions,
    results,
    skills,
    scope: String(formData.get("starScope") ?? "").trim() || undefined,
    reflection: String(formData.get("starReflection") ?? "").trim() || undefined,
    sourceText: String(formData.get("starSourceText") ?? "").trim() || undefined,
  };
  const parsed = starInputSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false };
  return { ok: true, value: parsed.data };
}

export async function confirmCoachFindingAction(projectId: string, resumeId: string, reportId: string, findingId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) {
    redirect(`/projects/${projectId}/coach?confirmStatus=error&confirmCode=resume-not-found&finding=${findingId}`);
  }

  const current = await getProjectResume(project.id, resumeId);
  if (!current) {
    redirect(`/projects/${project.id}/coach?confirmStatus=error&confirmCode=resume-not-found&finding=${findingId}`);
  }

  let report;
  try {
    report = await readCoachResearchReport(project.id, resumeId, reportId);
  } catch {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "report-read-failed"));
  }
  if (!report) {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "report-not-found"));
  }
  if (report.schemaVersion !== "coach-report-v2") {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "report-version-unsupported"));
  }

  const finding = report.findings.find((item) => item.id === findingId);
  if (!finding) {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "finding-not-found"));
  }
  if (finding.confirmationStatus === "confirmed") {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "finding-already-confirmed"));
  }

  const experienceId = String(formData.get("experienceId") ?? "").trim();
  if (!experienceId) {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "experience-not-found"));
  }
  if (!current.document.experiences.some((item) => item.id === experienceId)) {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "experience-not-found"));
  }

  const star = pickStarFromForm(formData);
  if (!star.ok) {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "star-invalid"));
  }

  let evidenceId: string;
  try {
    const result = await appendExperienceEvidence({
      projectId: project.id,
      resumeId,
      experienceId,
      star: star.value,
    });
    evidenceId = result.evidenceId;
  } catch {
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "evidence-append-failed"));
  }

  try {
    await updateCoachFindingConfirmation({
      projectId: project.id,
      resumeId,
      reportId,
      findingId,
      patch: {
        confirmationStatus: "confirmed",
        confirmedAt: new Date().toISOString(),
        linkedExperienceId: experienceId,
        linkedEvidenceId: evidenceId,
      },
    });
  } catch {
    await removeExperienceEvidence({ projectId: project.id, resumeId, experienceId, evidenceId });
    redirect(buildConfirmRedirect(project.id, "error", reportId, findingId, "report-write-failed"));
  }

  redirect(buildConfirmRedirect(project.id, "ok", reportId, findingId));
}

function buildBulletRedirect(projectId: string, status: "draft" | "applied" | "error", reportId: string, findingId: string, code?: string, draftId?: string, bulletId?: string): string {
  const params = new URLSearchParams({ researchStatus: "provider", report: reportId, confirmStatus: status, finding: findingId });
  if (code) params.set("confirmCode", code);
  if (draftId) params.set("draft", draftId);
  if (bulletId) params.set("bullet", bulletId);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

export async function generateBulletDraftAction(projectId: string, resumeId: string, reportId: string, findingId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) {
    redirect(buildBulletRedirect(projectId, "error", reportId, findingId, "resume-not-found"));
  }

  const current = await getProjectResume(project.id, resumeId);
  if (!current) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "resume-not-found"));
  }

  if (!privacyConfirmed(formData)) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "privacy-not-confirmed"));
  }

  let report;
  try {
    report = await readCoachResearchReport(project.id, resumeId, reportId);
  } catch {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "report-read-failed"));
  }
  if (!report) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "report-not-found"));
  }
  if (report.schemaVersion !== "coach-report-v2") {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "report-version-unsupported"));
  }

  const finding = report.findings.find((item) => item.id === findingId);
  if (!finding) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "finding-not-found"));
  }
  if (finding.confirmationStatus !== "confirmed" || !finding.linkedExperienceId || !finding.linkedEvidenceId) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "finding-not-confirmed"));
  }
  if (finding.linkedBulletId) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "bullet-already-applied"));
  }

  const experience = current.document.experiences.find((item) => item.id === finding.linkedExperienceId);
  if (!experience) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "evidence-not-found"));
  }
  const evidence = experience.evidence.find((item) => item.id === finding.linkedEvidenceId);
  if (!evidence) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "evidence-not-found"));
  }

  if (hasPendingDraftForFinding(project.id, resumeId, findingId)) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "draft-pending-exists"));
  }

  let defaultConfig;
  try {
    defaultConfig = await getDefaultModelConfig();
  } catch {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "missing-model-config"));
  }
  if (!defaultConfig?.apiKey) {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "missing-model-config"));
  }

  const targetRole = current.document.basics.targetRole || current.document.target?.role || current.resume.targetRole || "目标岗位";
  const jdSummary = current.document.target?.jdText || current.resume.targetJd;
  const request = buildBulletDraftRequest({
    targetRole,
    jdSummary,
    evidence: {
      context: evidence.context,
      task: evidence.task,
      actions: evidence.actions,
      results: evidence.results.map((item) => ({ text: item.text, metric: item.metric, confidence: item.confidence })),
      skills: evidence.skills,
      scope: evidence.scope,
    },
  });

  let candidates;
  try {
    candidates = await runBulletDraftWithProvider(defaultConfig, request);
  } catch (error) {
    const code = error instanceof CoachBulletProviderError
      ? (error.code === "timeout" ? "provider-timeout" : error.code)
      : "provider-failed";
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, code));
  }

  let draft;
  try {
    draft = await createBulletDraftRecord({
      projectId: project.id,
      resumeId,
      reportId,
      findingId,
      experienceId: finding.linkedExperienceId,
      evidenceId: finding.linkedEvidenceId,
      candidates,
    });
  } catch {
    redirect(buildBulletRedirect(project.id, "error", reportId, findingId, "draft-persist-failed"));
  }

  redirect(buildBulletRedirect(project.id, "draft", reportId, findingId, undefined, draft.id));
}

const applyInputSchema = z.object({
  candidateIndex: z.number().int().min(0),
  finalText: z.string().trim().min(1).max(800),
});

export async function applyBulletDraftAction(projectId: string, resumeId: string, draftId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) {
    redirect(`/projects/${projectId}/coach?confirmStatus=error&confirmCode=resume-not-found`);
  }

  const current = await getProjectResume(project.id, resumeId);
  if (!current) {
    redirect(`/projects/${project.id}/coach?confirmStatus=error&confirmCode=resume-not-found`);
  }

  const draft = await readBulletDraft(project.id, resumeId, draftId);
  if (!draft) {
    redirect(`/projects/${project.id}/coach?confirmStatus=error&confirmCode=draft-not-found`);
  }
  if (draft.status !== "pending") {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "draft-already-applied", draftId));
  }

  const parsedInput = applyInputSchema.safeParse({
    candidateIndex: Number.parseInt(String(formData.get("candidateIndex") ?? "-1"), 10),
    finalText: String(formData.get("finalText") ?? ""),
  });
  if (!parsedInput.success) {
    const code = parsedInput.error.issues.some((issue) => issue.path[0] === "candidateIndex")
      ? "candidate-out-of-range"
      : "final-text-invalid";
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, code, draftId));
  }
  if (parsedInput.data.candidateIndex >= draft.candidates.length) {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "candidate-out-of-range", draftId));
  }

  const experience = current.document.experiences.find((item) => item.id === draft.experienceId);
  if (!experience) {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "evidence-not-found", draftId));
  }
  const evidence = experience.evidence.find((item) => item.id === draft.evidenceId);
  if (!evidence) {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "evidence-not-found", draftId));
  }

  let report;
  try {
    report = await readCoachResearchReport(project.id, resumeId, draft.reportId);
  } catch {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "report-read-failed", draftId));
  }
  if (!report || report.schemaVersion !== "coach-report-v2") {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "report-version-unsupported", draftId));
  }
  const finding = report.findings.find((item) => item.id === draft.findingId);
  if (!finding) {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "finding-not-found", draftId));
  }
  if (finding.confirmationStatus !== "confirmed") {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "finding-not-confirmed", draftId));
  }
  if (finding.linkedBulletId) {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "bullet-already-applied", draftId));
  }

  const bulletId = nanoid();
  const now = new Date().toISOString();

  try {
    await appendExperienceBullet({
      projectId: project.id,
      resumeId,
      experienceId: draft.experienceId,
      bullet: { id: bulletId, text: parsedInput.data.finalText, sourceEvidenceIds: [draft.evidenceId] },
    });
  } catch {
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "evidence-append-failed", draftId));
  }

  try {
    await markBulletDraftApplied({
      projectId: project.id,
      resumeId,
      draftId,
      patch: {
        appliedAt: now,
        appliedCandidateIndex: parsedInput.data.candidateIndex,
        appliedBulletId: bulletId,
        appliedText: parsedInput.data.finalText,
      },
    });
  } catch {
    await removeExperienceBullet({ projectId: project.id, resumeId, experienceId: draft.experienceId, bulletId });
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "draft-write-failed", draftId));
  }

  try {
    await updateCoachFindingBulletLink({
      projectId: project.id,
      resumeId,
      reportId: draft.reportId,
      findingId: draft.findingId,
      linkedBulletId: bulletId,
      appliedAt: now,
    });
  } catch {
    await markBulletDraftPending({ projectId: project.id, resumeId, draftId });
    await removeExperienceBullet({ projectId: project.id, resumeId, experienceId: draft.experienceId, bulletId });
    await clearCoachFindingBulletLink({ projectId: project.id, resumeId, reportId: draft.reportId, findingId: draft.findingId });
    redirect(buildBulletRedirect(project.id, "error", draft.reportId, draft.findingId, "report-write-failed", draftId));
  }

  redirect(buildBulletRedirect(project.id, "applied", draft.reportId, draft.findingId, undefined, draftId, bulletId));
}

export async function generateEvidenceBulletDraftAction(projectId: string, resumeId: string, experienceId: string, evidenceId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildEvidenceBulletRedirect(projectId, "error", evidenceId, "resume-not-found"));

  const current = await getProjectResume(project.id, resumeId);
  if (!current) redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "resume-not-found"));

  if (!privacyConfirmed(formData)) {
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "privacy-not-confirmed"));
  }

  const experience = current.document.experiences.find((item) => item.id === experienceId);
  if (!experience) redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "experience-not-found"));
  const evidence = experience.evidence.find((item) => item.id === evidenceId);
  if (!evidence) redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "evidence-not-found"));

  const hasConfirmedResult = evidence.results.some((item) => item.confidence === "confirmed");
  if (evidence.actions.length === 0 || evidence.results.length === 0 || !hasConfirmedResult) {
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "evidence-not-confirmed"));
  }

  const existingDraft = await getActivePendingDraftForEvidence(project.id, resumeId, evidenceId);
  if (existingDraft) {
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "draft-pending-exists", existingDraft.id));
  }

  let defaultConfig;
  try {
    defaultConfig = await getDefaultModelConfig();
  } catch {
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "missing-model-config"));
  }
  if (!defaultConfig?.apiKey) {
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "missing-model-config"));
  }

  const targetRole = current.document.basics.targetRole || current.document.target?.role || current.resume.targetRole || "目标岗位";
  const jdSummary = current.document.target?.jdText || current.resume.targetJd;
  const request = buildBulletDraftRequest({
    targetRole,
    jdSummary,
    evidence: {
      context: evidence.context,
      task: evidence.task,
      actions: evidence.actions,
      results: evidence.results.map((item) => ({ text: item.text, metric: item.metric, confidence: item.confidence })),
      skills: evidence.skills,
      scope: evidence.scope,
    },
  });

  let candidates;
  try {
    candidates = await runBulletDraftWithProvider(defaultConfig, request);
  } catch (error) {
    const code = error instanceof CoachBulletProviderError
      ? (error.code === "timeout" ? "provider-timeout" : error.code)
      : "provider-failed";
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, code));
  }

  let draft;
  try {
    draft = await createEvidenceBulletDraftRecord({
      projectId: project.id,
      resumeId,
      experienceId,
      evidenceId,
      candidates,
    });
  } catch {
    redirect(buildEvidenceBulletRedirect(project.id, "error", evidenceId, "draft-persist-failed"));
  }

  redirect(buildEvidenceBulletRedirect(project.id, "draft", evidenceId, undefined, draft.id));
}

export async function applyEvidenceBulletDraftAction(projectId: string, resumeId: string, draftId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(`/projects/${projectId}/coach?evidenceBulletStatus=error&evidenceBulletCode=resume-not-found`);

  const current = await getProjectResume(project.id, resumeId);
  if (!current) redirect(`/projects/${project.id}/coach?evidenceBulletStatus=error&evidenceBulletCode=resume-not-found`);

  const draft = await readBulletDraft(project.id, resumeId, draftId);
  if (!draft) redirect(`/projects/${project.id}/coach?evidenceBulletStatus=error&evidenceBulletCode=draft-not-found`);
  if (draft.source !== "experience_evidence") {
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "draft-source-invalid", draftId));
  }
  if (draft.status !== "pending") {
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "draft-already-applied", draftId));
  }

  const parsedInput = applyInputSchema.safeParse({
    candidateIndex: Number.parseInt(String(formData.get("candidateIndex") ?? "-1"), 10),
    finalText: String(formData.get("finalText") ?? ""),
  });
  if (!parsedInput.success) {
    const code = parsedInput.error.issues.some((issue) => issue.path[0] === "candidateIndex")
      ? "candidate-out-of-range"
      : "final-text-invalid";
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, code, draftId));
  }
  if (parsedInput.data.candidateIndex >= draft.candidates.length) {
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "candidate-out-of-range", draftId));
  }

  const experience = current.document.experiences.find((item) => item.id === draft.experienceId);
  if (!experience) redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "experience-not-found", draftId));
  const sourceEvidenceIds = draft.sourceEvidenceIds.length > 0 ? draft.sourceEvidenceIds : [draft.evidenceId];
  if (sourceEvidenceIds.some((id) => !experience.evidence.some((item) => item.id === id))) {
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "evidence-not-found", draftId));
  }

  const bulletId = nanoid();
  const now = new Date().toISOString();

  try {
    await appendExperienceBullet({
      projectId: project.id,
      resumeId,
      experienceId: draft.experienceId,
      bullet: { id: bulletId, text: parsedInput.data.finalText, sourceEvidenceIds },
    });
  } catch {
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "bullet-append-failed", draftId));
  }

  try {
    await markBulletDraftApplied({
      projectId: project.id,
      resumeId,
      draftId,
      patch: {
        appliedAt: now,
        appliedCandidateIndex: parsedInput.data.candidateIndex,
        appliedBulletId: bulletId,
        appliedText: parsedInput.data.finalText,
      },
    });
  } catch {
    await removeExperienceBullet({ projectId: project.id, resumeId, experienceId: draft.experienceId, bulletId });
    redirect(buildEvidenceBulletRedirect(project.id, "error", draft.evidenceId, "draft-write-failed", draftId));
  }

  redirect(buildEvidenceBulletRedirect(project.id, "applied", draft.evidenceId, undefined, draftId, bulletId));
}

function buildPolishRedirect(projectId: string, status: "generated" | "applied" | "discarded" | "error", code?: string, runId?: string): string {
  const params = new URLSearchParams({ polishStatus: status });
  if (code) params.set("polishCode", code);
  if (runId) params.set("run", runId);
  return `/projects/${projectId}/coach/polish?${params.toString()}`;
}

export async function generatePolishCandidatesAction(projectId: string, resumeId: string, experienceId: string, bulletId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildPolishRedirect(projectId, "error", "missing-project"));
  if (!privacyConfirmed(formData)) redirect(buildPolishRedirect(project.id, "error", "privacy-not-confirmed"));

  const current = await getProjectResume(project.id, resumeId);
  if (!current) redirect(buildPolishRedirect(project.id, "error", "missing-resume"));
  const experience = current.document.experiences.find((item) => item.id === experienceId);
  const sourceBullet = experience?.bullets.find((item) => item.id === bulletId && item.status === "confirmed");
  if (!experience || !sourceBullet) redirect(buildPolishRedirect(project.id, "error", "source-bullet-not-found"));

  let defaultConfig;
  try {
    defaultConfig = await getDefaultModelConfig();
  } catch {
    redirect(buildPolishRedirect(project.id, "error", "missing-model-config"));
  }
  if (!defaultConfig?.apiKey) redirect(buildPolishRedirect(project.id, "error", "missing-model-config"));

  const evidenceSnippets = sourceBullet.sourceEvidenceIds
    .map((id) => experience.evidence.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => [item.context, item.task, ...item.actions, ...item.results.map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text)].filter(Boolean).join("；"))
    .filter(Boolean);

  let candidates;
  try {
    candidates = await generatePolishCandidates({
      config: defaultConfig,
      sourceBullet: sourceBullet.text,
      evidenceSnippets,
      jdContext: current.document.target?.jdText || current.resume.targetJd,
    });
  } catch {
    redirect(buildPolishRedirect(project.id, "error", "provider-failed"));
  }

  try {
    const run = await createPolishRun({
      projectId: project.id,
      resumeId,
      experienceId,
      sourceBulletId: sourceBullet.id,
      sourceBulletText: sourceBullet.text,
      sourceEvidenceIds: sourceBullet.sourceEvidenceIds,
      candidates,
    });
    redirect(buildPolishRedirect(project.id, "generated", undefined, run.id));
  } catch {
    redirect(buildPolishRedirect(project.id, "error", "persist-failed"));
  }
}

export async function applyPolishCandidateAction(projectId: string, resumeId: string, runId: string, candidateId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildPolishRedirect(projectId, "error", "missing-project", runId));
  const run = await readPolishRun(project.id, resumeId, runId);
  if (!run) redirect(buildPolishRedirect(project.id, "error", "run-not-found", runId));
  const candidate = run.candidates.find((item) => item.id === candidateId && item.status === "ready");
  if (!candidate) redirect(buildPolishRedirect(project.id, "error", "candidate-not-found", runId));
  const finalText = String(formData.get("finalText") ?? candidate.text).trim();
  if (!finalText) redirect(buildPolishRedirect(project.id, "error", "final-text-invalid", runId));

  const bulletId = nanoid();
  try {
    await appendExperienceBullet({
      projectId: project.id,
      resumeId,
      experienceId: run.experienceId,
      bullet: {
        id: bulletId,
        text: finalText,
        sourceEvidenceIds: run.sourceEvidenceIds,
        polishCandidateId: candidate.id,
        polishAppliedAt: new Date().toISOString(),
      },
    });
    await archiveExperienceBullet({ projectId: project.id, resumeId, experienceId: run.experienceId, bulletId: run.sourceBulletId });
    await writePolishRun({
      ...run,
      candidates: run.candidates.map((item) => item.id === candidateId ? { ...item, status: "applied" } : item),
      appliedAt: new Date().toISOString(),
      appliedCandidateId: candidateId,
      appliedBulletId: bulletId,
    });
  } catch {
    await removeExperienceBullet({ projectId: project.id, resumeId, experienceId: run.experienceId, bulletId });
    redirect(buildPolishRedirect(project.id, "error", "apply-failed", runId));
  }
  redirect(buildPolishRedirect(project.id, "applied", undefined, runId));
}

export async function discardPolishCandidateAction(projectId: string, resumeId: string, runId: string, candidateId: string) {
  const project = getProject(projectId);
  if (!project) redirect(buildPolishRedirect(projectId, "error", "missing-project", runId));
  const run = await readPolishRun(project.id, resumeId, runId);
  if (!run) redirect(buildPolishRedirect(project.id, "error", "run-not-found", runId));
  if (!run.candidates.some((item) => item.id === candidateId)) redirect(buildPolishRedirect(project.id, "error", "candidate-not-found", runId));
  await writePolishRun({
    ...run,
    candidates: run.candidates.map((item) => item.id === candidateId ? { ...item, status: "discarded" } : item),
  });
  redirect(buildPolishRedirect(project.id, "discarded", undefined, runId));
}

export async function runCoachSearchEvaluationAction(projectId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildSearchErrorRedirect(projectId, "missing-project"));
  if (!privacyConfirmed(formData)) redirect(buildSearchErrorRedirect(project.id, "privacy-not-confirmed"));

  const master = firstResume(listResumes(project.id), "master");
  if (!master) redirect(buildSearchErrorRedirect(project.id, "missing-resume"));

  let document: ResumeDocument;
  try {
    document = await readResume(master.filePath);
  } catch {
    redirect(buildSearchErrorRedirect(project.id, "resume-read-failed"));
  }

  let provider;
  try {
    provider = await getActiveSearchProvider();
  } catch (error) {
    const code = error instanceof SearchProviderError && error.code === "missing-config" ? "missing-search-config" : "provider-failed";
    redirect(buildSearchErrorRedirect(project.id, code));
  }

  const search = async (query: string) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new SearchProviderError("request-failed", "search timeout")), COACH_SEARCH_TIMEOUT_MS);
    });
    try {
      return await Promise.race([provider.query({ query, maxResults: 3 }), timedOut]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
  let findings: CoachResearchFinding[];
  try {
    const [scarcity, verification, jdCoverage] = await Promise.all([
      evaluateSkillScarcity({ document, search }),
      verifyCompaniesAndProjects({ document, search }),
      augmentJdCoverageWithSearch(analyzeJdCoverage(document), provider),
    ]);
    const jdFindings: CoachResearchFinding[] = jdCoverage.status === "ok"
      ? Object.entries(jdCoverage.webCitations ?? {}).map(([keyword, citations]) => ({
          id: nanoid(),
          kind: "research_fact",
          text: `${keyword}：JD uncovered keyword has web demand signals`,
          source: "web",
          sourceLabel: "Tavily JD coverage",
          sourceUrl: citations[0]?.url,
          citations,
          confidence: citations.some((citation) => citation.host) ? "medium" : "low",
          canEnterResume: false,
          confirmationStatus: "unconfirmed",
        }))
      : [];
    findings = [
      ...jdFindings,
      ...scarcity.map((item): CoachResearchFinding => ({
        id: nanoid(),
        kind: "research_fact",
        text: `${item.skill}：${item.level}`,
        source: item.citations.length > 0 ? "web" : "resume",
        sourceLabel: "Tavily skill scarcity",
        sourceUrl: item.citations[0]?.url,
        citations: item.citations.map((citation) => ({ title: citation.title, url: citation.url, snippet: citation.snippet, retrievedAt: citation.retrievedAt })),
        confidence: item.level === "high-demand" ? "high" : item.level === "moderate-demand" ? "medium" : "low",
        canEnterResume: false,
        confirmationStatus: "unconfirmed",
      })),
      ...verification.map((item): CoachResearchFinding => ({
        id: nanoid(),
        kind: "research_fact",
        text: `${item.label}：${item.status}`,
        source: item.citations.length > 0 ? "web" : "resume",
        sourceLabel: item.source === "experience" ? "Tavily company verify" : "Tavily project verify",
        sourceUrl: item.citations[0]?.url,
        citations: item.citations.map((citation) => ({ title: citation.title, url: citation.url, snippet: citation.snippet, retrievedAt: citation.retrievedAt })),
        confidence: item.status === "verified" ? "high" : item.status === "partial" ? "medium" : "low",
        canEnterResume: false,
        confirmationStatus: "unconfirmed",
      })),
    ];
  } catch {
    redirect(buildSearchErrorRedirect(project.id, "search-unavailable"));
  }

  if (findings.length === 0) redirect(buildSearchErrorRedirect(project.id, "invalid-provider-response"));

  let report;
  try {
    report = await createCoachResearchReport({
      projectId: project.id,
      resumeId: master.id,
      queueItemIds: ["skill-scarcity", "company-verify"],
      findings,
    });
  } catch {
    redirect(buildSearchErrorRedirect(project.id, "report-persist-failed"));
  }
  redirect(`/projects/${project.id}/coach?researchStatus=provider&report=${report.id}`);
}

export async function runGrillEnhancementAction(projectId: string, resumeId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) redirect(buildGrillEnhancementRedirect(projectId, "error", "missing-project"));
  if (!privacyConfirmed(formData)) redirect(buildGrillEnhancementRedirect(project.id, "error", "privacy-not-confirmed"));

  const current = await getProjectResume(project.id, resumeId);
  if (!current) redirect(buildGrillEnhancementRedirect(project.id, "error", "missing-resume"));

  const answers = await listCoachQaAnswers(project.id, current.resume.id);
  const queue = buildExperienceQuestionQueue(current.document);
  const session = buildGrillSession({ queue, answers, document: current.document });
  if (!session.base.activeTurn) redirect(buildGrillEnhancementRedirect(project.id, "error", "missing-active-turn"));

  let defaultConfig;
  try {
    defaultConfig = await getDefaultModelConfig();
  } catch {
    redirect(buildGrillEnhancementRedirect(project.id, "error", "missing-model-config"));
  }
  if (!defaultConfig?.apiKey) redirect(buildGrillEnhancementRedirect(project.id, "error", "missing-model-config"));

  const enhancement = await buildGrillEnhancement({
    config: defaultConfig,
    activeTurn: session.base.activeTurn,
    answers,
    document: current.document,
    weakestDimension: session.weakestDimension,
  });
  if (!enhancement) redirect(buildGrillEnhancementRedirect(project.id, "error", "unavailable"));

  try {
    await writeCoachGrillEnhancement({
      projectId: project.id,
      resumeId: current.resume.id,
      activeTurn: session.base.activeTurn,
      enhancement,
    });
  } catch {
    redirect(buildGrillEnhancementRedirect(project.id, "error", "persist-failed"));
  }
  redirect(buildGrillEnhancementRedirect(project.id, "generated"));
}

export async function runCoachResearchAction(projectId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project) {
    redirect(`/projects/${projectId}/coach?researchError=missing-project`);
  }

  const resumes = listResumes(project.id);
  const master = firstResume(resumes, "master");
  if (!master) {
    redirect(`/projects/${project.id}/coach?researchError=missing-resume`);
  }

  if (!privacyConfirmed(formData)) {
    redirect(`/projects/${project.id}/coach?researchError=privacy-not-confirmed`);
  }

  const selectedIds = formData
    .getAll("queueItemId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (selectedIds.length === 0) {
    redirect(`/projects/${project.id}/coach?researchError=no-selection`);
  }

  let document: ResumeDocument;
  try {
    document = await readResume(master.filePath);
  } catch {
    redirect(`/projects/${project.id}/coach?researchError=resume-read-failed`);
  }

  const queueItems = buildResearchQueue(document);
  const validIds = new Set(queueItems.map((item) => item.id));
  if (selectedIds.some((id) => !validIds.has(id))) {
    redirect(`/projects/${project.id}/coach?researchError=invalid-selection`);
  }
  const selectedItems = queueItems.filter((item) => selectedIds.includes(item.id));

  let defaultConfig;
  try {
    defaultConfig = await getDefaultModelConfig();
  } catch {
    redirect(buildProviderErrorRedirect(project.id, "missing-model-config", selectedIds));
  }
  if (!defaultConfig?.apiKey) {
    redirect(buildProviderErrorRedirect(project.id, "missing-model-config", selectedIds));
  }

  const firstExperience = document.experiences[0];
  const firstBullet = firstExperience?.bullets[0]?.text;
  const targetRole = document.basics.targetRole || document.target?.role || master.targetRole || "目标岗位";
  const targetJd = document.target?.jdText || master.targetJd;
  const request = buildCoachResearchRequest({
    targetRole,
    targetJd,
    queueItems: selectedItems,
    basicsName: document.basics.name,
    firstExperience: firstExperience ? `${firstExperience.organization} · ${firstExperience.role}` : undefined,
    firstBullet,
    projectHighlights: document.projects.slice(0, 3).map((item) => `${item.name}：${item.bullets[0]?.text ?? "待补充项目要点"}`),
    skills: document.skills.slice(0, 20).map((item) => item.name),
  });

  let findings: CoachResearchFinding[];
  try {
    findings = await runCoachResearchWithProvider(defaultConfig, request);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "provider-failed";
    const safeCode = ["timeout", "provider-failed", "invalid-provider-response"].includes(code) ? code : "provider-failed";
    redirect(buildProviderErrorRedirect(project.id, safeCode === "timeout" ? "provider-timeout" : safeCode, selectedIds));
  }

  let report;
  try {
    report = await createCoachResearchReport({
      projectId: project.id,
      resumeId: master.id,
      queueItemIds: selectedIds,
      findings,
    });
  } catch {
    redirect(buildProviderErrorRedirect(project.id, "report-persist-failed", selectedIds));
  }
  redirect(`/projects/${project.id}/coach?researchStatus=provider&report=${report.id}`);
}
