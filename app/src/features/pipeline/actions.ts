"use server";

import { redirect } from "next/navigation";
import { CoachActionRedirect, executeGrillEnhancement, executeSearchEvaluation } from "@/features/coach/action-helpers";
import { generateMissingPipelinePolishRuns } from "./polish";
import { buildPipelineExportSnapshot } from "./pipeline-exporter";
import { advanceStage, canAdvance, confirmEgress, setAutoAdvance } from "./orchestrator";
import { getProjectResume } from "@/features/resume/storage";
import { readSession, saveSession } from "./storage";
import type { PipelineExportSnapshot, PipelineSession, PipelineStage } from "./types";

const PIPELINE_STAGE_TIMEOUT_MS = 30_000;

type StageExecutionResult =
  | { ok: true; redirect: string; resultRef?: string; exportSnapshot?: PipelineExportSnapshot }
  | { ok: false; redirect: string; code: string };

function buildPipelineRedirect(projectId: string, status: "started" | "blocked" | "failed" | "error", code?: string, sessionId?: string): string {
  const params = new URLSearchParams({ pipeline: status });
  if (code) params.set("pipelineCode", code);
  if (sessionId) params.set("session", sessionId);
  return `/projects/${projectId}/coach?${params.toString()}`;
}

function buildPrivacyFormData(): FormData {
  const formData = new FormData();
  formData.set("privacyConfirmed", "1");
  return formData;
}

function readRedirectParams(redirectUrl: string): URLSearchParams {
  return new URL(redirectUrl, "http://localhost").searchParams;
}

function parseStageRedirect(stage: PipelineStage, redirectUrl: string): StageExecutionResult {
  const params = readRedirectParams(redirectUrl);
  if (stage === "grill" && params.get("grillEnhanceStatus") === "generated") {
    return { ok: true, redirect: redirectUrl, resultRef: "grill-enhancement" };
  }
  if (stage === "evaluate" && params.get("researchStatus") === "provider") {
    return { ok: true, redirect: redirectUrl, resultRef: params.get("report") ?? undefined };
  }
  const code =
    params.get("grillEnhanceCode") ??
    params.get("researchError") ??
    params.get("pipelineCode") ??
    "stage-failed";
  return { ok: false, redirect: redirectUrl, code };
}

async function withStageTimeout<T>(work: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("pipeline-stage-timeout")), PIPELINE_STAGE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function executePipelineStage(projectId: string, session: PipelineSession): Promise<StageExecutionResult> {
  const stage = session.currentStage;
  if (stage === "grill") {
    try {
      await withStageTimeout(executeGrillEnhancement(projectId, session.resumeId, buildPrivacyFormData()));
      return { ok: false, redirect: buildPipelineRedirect(projectId, "failed", "stage-returned-without-redirect", session.id), code: "stage-returned-without-redirect" };
    } catch (error) {
      if (error instanceof CoachActionRedirect) return parseStageRedirect(stage, error.result.redirect);
      const code = error instanceof Error && error.message === "pipeline-stage-timeout" ? "stage-timeout" : "stage-failed";
      return { ok: false, redirect: buildPipelineRedirect(projectId, "failed", code, session.id), code };
    }
  }

  if (stage === "evaluate") {
    try {
      await withStageTimeout(executeSearchEvaluation(projectId, buildPrivacyFormData()));
      return { ok: false, redirect: buildPipelineRedirect(projectId, "failed", "stage-returned-without-redirect", session.id), code: "stage-returned-without-redirect" };
    } catch (error) {
      if (error instanceof CoachActionRedirect) return parseStageRedirect(stage, error.result.redirect);
      const code = error instanceof Error && error.message === "pipeline-stage-timeout" ? "stage-timeout" : "stage-failed";
      return { ok: false, redirect: buildPipelineRedirect(projectId, "failed", code, session.id), code };
    }
  }

  if (stage === "polish") {
    try {
      const progress = await withStageTimeout(generateMissingPipelinePolishRuns(projectId, session.resumeId));
      return {
        ok: true,
        redirect: `/projects/${projectId}/coach/polish?pipeline=polish-generated&session=${session.id}`,
        resultRef: `polish:${progress.generatedRunCount}/${progress.eligibleBulletCount}`,
      };
    } catch (error) {
      const code = error instanceof Error && error.message === "pipeline-stage-timeout" ? "stage-timeout" : error instanceof Error ? error.message : "stage-failed";
      return { ok: false, redirect: buildPipelineRedirect(projectId, "failed", code, session.id), code };
    }
  }

  const current = await getProjectResume(projectId, session.resumeId);
  if (!current) {
    return { ok: false, redirect: buildPipelineRedirect(projectId, "failed", "missing-resume", session.id), code: "missing-resume" };
  }
  const exportSnapshot = await buildPipelineExportSnapshot({
    projectId,
    resumeId: session.resumeId,
    document: current.document,
  });
  return {
    ok: true,
    redirect: `/projects/${projectId}/resumes/${session.resumeId}/edit?pipeline=export-ready&session=${session.id}`,
    resultRef: `export:${exportSnapshot.readyForExport ? "ready" : "missing-basics"}`,
    exportSnapshot,
  };
}

async function persistStageResult(session: PipelineSession, result: StageExecutionResult): Promise<PipelineSession> {
  const now = new Date().toISOString();
  const stage = session.currentStage;
  const next: PipelineSession = {
    ...session,
    updatedAt: now,
    checkpoints: [
      ...session.checkpoints,
      {
        stageFrom: stage,
        stageTo: stage,
        timestamp: now,
        summary: result.ok ? `${stage} execution completed` : `${stage} execution failed: ${result.code}`,
      },
    ],
    stages: {
      ...session.stages,
      [stage]: {
        ...session.stages[stage],
        status: result.ok ? "awaiting_user" : "failed",
        completedAt: result.ok ? now : session.stages[stage].completedAt,
        failedAt: result.ok ? session.stages[stage].failedAt : now,
        errorCode: result.ok ? undefined : result.code,
        resultRef: result.ok ? result.resultRef : session.stages[stage].resultRef,
      },
    },
    exportSnapshot: result.ok && result.exportSnapshot ? result.exportSnapshot : session.exportSnapshot,
  };
  return saveSession(next);
}

async function drivePipeline(projectId: string, session: PipelineSession): Promise<string> {
  const readiness = canAdvance(session);
  if (!readiness.ready) {
    return buildPipelineRedirect(projectId, "blocked", readiness.blockers.join(","), session.id);
  }

  const advanced = await saveSession(advanceStage(session, "user-confirmed"));
  const currentState = advanced.stages[advanced.currentStage];
  if (currentState.status === "awaiting_user") {
    return buildPipelineRedirect(projectId, "blocked", currentState.errorCode ?? "awaiting-user", advanced.id);
  }
  if (currentState.status !== "in_progress") {
    return buildPipelineRedirect(projectId, "blocked", "stage-not-ready", advanced.id);
  }

  const result = await executePipelineStage(projectId, advanced);
  await persistStageResult(advanced, result);
  return result.redirect;
}

export async function confirmEgressAction(projectId: string, sessionId: string, formData: FormData) {
  const session = await readSession(projectId, sessionId);
  if (!session) redirect(buildPipelineRedirect(projectId, "error", "session-not-found", sessionId));

  const selectedItemIds = formData
    .getAll("egressItemId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const requiredIds = session.egressPlan.items.map((item) => item.id);
  const selected = new Set(selectedItemIds);
  if (requiredIds.some((id) => !selected.has(id))) {
    redirect(buildPipelineRedirect(projectId, "error", "egress-items-incomplete", sessionId));
  }

  const autoAdvance = String(formData.get("autoAdvance") ?? "") === "1";
  const confirmed = requiredIds.length > 0
    ? await confirmEgress(session.id, requiredIds)
    : session;
  const configured = confirmed.autoAdvance === autoAdvance
    ? confirmed
    : await setAutoAdvance(confirmed.id, autoAdvance);
  redirect(autoAdvance ? await drivePipeline(projectId, configured) : buildPipelineRedirect(projectId, "started", undefined, configured.id));
}

export async function advancePipelineAction(projectId: string, sessionId: string) {
  const session = await readSession(projectId, sessionId);
  if (!session) redirect(buildPipelineRedirect(projectId, "error", "session-not-found", sessionId));
  redirect(await drivePipeline(projectId, session));
}
