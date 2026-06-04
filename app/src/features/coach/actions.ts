"use server";

import { redirect } from "next/navigation";
import {
  CoachActionRedirect,
  executeApplyBulletDraft,
  executeApplyEvidenceBulletDraft,
  executeApplyPolish,
  executeCoachResearch,
  executeConfirmFinding,
  executeDiscardPolish,
  executeGenEvidenceBulletDraft,
  executeGenerateBulletDraft,
  executeGeneratePolish,
  executeGrillEnhancement,
  executePromoteToEvidence,
  executeSaveQaAnswer,
  executeSearchEvaluation,
  type ActionResult,
} from "./action-helpers";
import { getPipelinePolishProgress, isPipelinePolishReadyForExport } from "@/features/pipeline/polish";
import { getSession, saveSession } from "@/features/pipeline/storage";
import type { PipelineSession, PipelineStage } from "@/features/pipeline";

function formPrivacyConfirmed(formData: FormData): boolean {
  return String(formData.get("privacyConfirmed") ?? "") === "1";
}

function sessionEgressApproved(session: PipelineSession, stage: PipelineStage): boolean {
  if (session.egressPlan.userConfirmedAt || session.egressPlan.allConfirmedAt) return true;
  const items = session.egressPlan.items.filter((item) => item.stage === stage);
  return items.length === 0 || items.every((item) => item.userConfirmedAt);
}

async function withPipelinePrivacy(projectId: string, stage: PipelineStage, formData: FormData): Promise<FormData> {
  if (formPrivacyConfirmed(formData)) return formData;
  const session = await getSession(projectId);
  if (!session || !sessionEgressApproved(session, stage)) return formData;
  formData.set("privacyConfirmed", "1");
  return formData;
}

async function resolveActionResult(result: Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await result;
  } catch (error) {
    if (error instanceof CoachActionRedirect) {
      return error.result;
    }
    throw error;
  }
}

async function redirectFrom(result: Promise<ActionResult>): Promise<never> {
  const resolved = await resolveActionResult(result);
  redirect(resolved.redirect);
}

function redirectStatus(redirectUrl: string, key: string): string | null {
  return new URL(redirectUrl, "http://localhost").searchParams.get(key);
}

async function syncPipelinePolish(projectId: string, resumeId: string, redirectUrl: string): Promise<void> {
  const session = await getSession(projectId);
  if (!session || session.resumeId !== resumeId || session.currentStage !== "polish") return;
  const status = redirectStatus(redirectUrl, "polishStatus");
  if (!status || status === "error") return;

  const progress = await getPipelinePolishProgress(projectId, resumeId);
  const now = new Date().toISOString();
  const readyForExport = isPipelinePolishReadyForExport(progress);
  await saveSession({
    ...session,
    updatedAt: now,
    checkpoints: [
      ...session.checkpoints,
      {
        stageFrom: "polish",
        stageTo: "polish",
        timestamp: now,
        summary: `polish ${status}: ${progress.readyCandidateCount} ready candidates`,
      },
    ],
    stages: {
      ...session.stages,
      polish: {
        ...session.stages.polish,
        status: readyForExport ? "awaiting_user" : session.stages.polish.status,
        completedAt: readyForExport ? now : session.stages.polish.completedAt,
        resultRef: `polish:${progress.coveredBulletCount}/${progress.eligibleBulletCount}:${progress.readyCandidateCount}`,
      },
    },
  });
}

export async function saveCoachQaAnswerAction(projectId: string, resumeId: string, formData: FormData) {
  return redirectFrom(executeSaveQaAnswer(projectId, resumeId, formData));
}

export async function promoteCoachQaAnswerToEvidenceAction(projectId: string, resumeId: string, answerId: string, formData: FormData) {
  return redirectFrom(executePromoteToEvidence(projectId, resumeId, answerId, formData));
}

export async function confirmCoachFindingAction(projectId: string, resumeId: string, reportId: string, findingId: string, formData: FormData) {
  return redirectFrom(executeConfirmFinding(projectId, resumeId, reportId, findingId, formData));
}

export async function generateBulletDraftAction(projectId: string, resumeId: string, reportId: string, findingId: string, formData: FormData) {
  return redirectFrom(executeGenerateBulletDraft(projectId, resumeId, reportId, findingId, await withPipelinePrivacy(projectId, "polish", formData)));
}

export async function applyBulletDraftAction(projectId: string, resumeId: string, draftId: string, formData: FormData) {
  return redirectFrom(executeApplyBulletDraft(projectId, resumeId, draftId, formData));
}

export async function generateEvidenceBulletDraftAction(projectId: string, resumeId: string, experienceId: string, evidenceId: string, formData: FormData) {
  return redirectFrom(executeGenEvidenceBulletDraft(projectId, resumeId, experienceId, evidenceId, await withPipelinePrivacy(projectId, "polish", formData)));
}

export async function applyEvidenceBulletDraftAction(projectId: string, resumeId: string, draftId: string, formData: FormData) {
  return redirectFrom(executeApplyEvidenceBulletDraft(projectId, resumeId, draftId, formData));
}

export async function generatePolishCandidatesAction(projectId: string, resumeId: string, experienceId: string, bulletId: string, formData: FormData) {
  const result = await resolveActionResult(executeGeneratePolish(projectId, resumeId, experienceId, bulletId, await withPipelinePrivacy(projectId, "polish", formData)));
  await syncPipelinePolish(projectId, resumeId, result.redirect);
  redirect(result.redirect);
}

export async function applyPolishCandidateAction(projectId: string, resumeId: string, runId: string, candidateId: string, formData: FormData) {
  const result = await resolveActionResult(executeApplyPolish(projectId, resumeId, runId, candidateId, formData));
  await syncPipelinePolish(projectId, resumeId, result.redirect);
  redirect(result.redirect);
}

export async function discardPolishCandidateAction(projectId: string, resumeId: string, runId: string, candidateId: string) {
  const result = await resolveActionResult(executeDiscardPolish(projectId, resumeId, runId, candidateId));
  await syncPipelinePolish(projectId, resumeId, result.redirect);
  redirect(result.redirect);
}

export async function runCoachSearchEvaluationAction(projectId: string, formData: FormData) {
  return redirectFrom(executeSearchEvaluation(projectId, await withPipelinePrivacy(projectId, "evaluate", formData)));
}

export async function runGrillEnhancementAction(projectId: string, resumeId: string, formData: FormData) {
  return redirectFrom(executeGrillEnhancement(projectId, resumeId, await withPipelinePrivacy(projectId, "grill", formData)));
}

export async function runCoachResearchAction(projectId: string, formData: FormData) {
  return redirectFrom(executeCoachResearch(projectId, await withPipelinePrivacy(projectId, "evaluate", formData)));
}
