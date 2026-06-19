"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  CoachActionRedirect,
  executeGrillEnhancement,
  executePromoteToEvidence,
  executeSaveQaAnswer,
  executeApplyPolish,
  executeDiscardPolish,
  executePipelineEvaluation,
} from "@/features/coach/action-helpers";
import { generateMissingPipelinePolishRuns } from "@/features/pipeline/polish";
import { applyIntakeCandidates, parseRawTextIntake, writeIntakeCandidate, type ResumeIntakeCandidate } from "@/features/intake";
import { getProjectResume, createExportRecord, readLayoutOverrides } from "@/features/resume/storage";
import { createSession, readSession, saveSession, getNextPipelineStage, confirmEgressItems, toggleAutoAdvance } from "@/features/pipeline/storage";
import type { PipelineSession } from "@/features/pipeline/types";
import { renderExport } from "@/features/export/render";
import type { WorkspaceActionState } from "@/lib/workspace-action-state";

/**
 * 工作区 action 包装层（design §3.2 useActionState 模式）。
 *
 * 现有 coach `execute*` 是 server-only 纯函数，成功/失败都抛 `CoachActionRedirect`，
 * 真实状态码编码在 redirect URL 的 query（旧路由 `/projects/[id]/coach`）。
 * 本层捕获该异常 → 解析 query 状态 → revalidatePath 同页 → 返回 plain state 给
 * useActionState，**不**跳旧路由。零后端逻辑改动：只调用既有 execute*，不改其实现。
 *
 * 注意：`"use server"` 文件只能导出 async 函数，故 IDLE_WORKSPACE_STATE / WorkspaceActionState
 * 在 lib/workspace-action-state.ts，组件直接从那里 import（不在此再导出）。
 */

function workspacePath(projectId: string, resumeId: string): string {
  return `/w/${projectId}/${resumeId}`;
}

function redirectQuery(redirectUrl: string): URLSearchParams {
  return new URL(redirectUrl, "http://localhost").searchParams;
}

/**
 * 执行 coach execute*（必抛 CoachActionRedirect），取出 redirect URL。
 * 非 CoachActionRedirect 的异常向上抛（真实故障，不吞）。
 */
async function captureCoachRedirect(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof CoachActionRedirect) return error.result.redirect;
    throw error;
  }
  // execute* 契约保证抛出；走到这里说明契约被破坏。
  throw new Error("coach-execute-no-redirect");
}

export async function saveQaAnswerInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const redirectUrl = await captureCoachRedirect(executeSaveQaAnswer(projectId, resumeId, formData));
  const query = redirectQuery(redirectUrl);
  const ok = query.get("qaStatus") === "saved";
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok, code: ok ? "saved" : query.get("qaCode") ?? "qa-failed" };
}

export async function promoteToEvidenceInWorkspace(
  projectId: string,
  resumeId: string,
  answerId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const redirectUrl = await captureCoachRedirect(executePromoteToEvidence(projectId, resumeId, answerId, formData));
  const query = redirectQuery(redirectUrl);
  const ok = query.get("qaEvidenceStatus") === "ok";
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok, code: ok ? "promoted" : query.get("qaEvidenceCode") ?? "evidence-failed" };
}

export async function runGrillEnhancementInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  // 用户显式勾选 privacyConfirmed → 同意向 provider 发送追问上下文。
  const redirectUrl = await captureCoachRedirect(executeGrillEnhancement(projectId, resumeId, formData));
  const query = redirectQuery(redirectUrl);
  const ok = query.get("grillEnhanceStatus") === "generated";
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok, code: ok ? "generated" : query.get("grillEnhanceCode") ?? "enhance-failed" };
}

/**
 * 启动 pipeline session（不跳旧路由）。已有同简历 session 则复用，否则新建。
 * autoAdvance 默认 false：联网外发与自动推进需用户「一次同意」后开启（见 toggleAutoAdvanceInWorkspace）。
 * 启动后 session.currentStage=grill，工作区投影从 start → grill-chat。
 */
export async function startPipelineInWorkspace(
  projectId: string,
  resumeId: string,
): Promise<WorkspaceActionState> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) return { ts: Date.now(), ok: false, code: "missing-resume" };
  const existing = await readSession(projectId);
  if (!existing || existing.resumeId !== resumeId) {
    createSession(projectId, resumeId, false);
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "started" };
}

/** intake 候选文件路径（复刻旧 intake 页逻辑；纯 fs，不碰后端逻辑）。 */
function intakeCandidatePath(resumeFilePath: string, candidateId: string): string {
  if (!/^[A-Za-z0-9_:-]+$/.test(candidateId)) throw new Error("invalid-candidate");
  return path.join(path.dirname(resumeFilePath), "intake", `${candidateId}.json`);
}

async function readIntakeCandidate(projectId: string, resumeId: string, candidateId: string): Promise<ResumeIntakeCandidate | null> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) return null;
  try {
    const json = JSON.parse(await fs.readFile(intakeCandidatePath(current.resume.filePath, candidateId), "utf-8"));
    return json && typeof json === "object" && json.id === candidateId ? (json as ResumeIntakeCandidate) : null;
  } catch {
    return null;
  }
}

/**
 * 解析粘贴材料 → 写候选 → 把候选回填进 state（client 据此渲染勾选确认）。
 * 候选只是待确认草稿，勾选 applyIntakeInWorkspace 后才写入简历。
 */
export async function parseIntakeInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) return { ts: Date.now(), ok: false, code: "empty-input" };

  const candidate = parseRawTextIntake({
    rawText,
    jdText: String(formData.get("jdText") ?? "").trim() || undefined,
    targetRole: String(formData.get("targetRole") ?? "").trim() || undefined,
  });

  try {
    await writeIntakeCandidate({ projectId, resumeId, candidate });
  } catch {
    return { ts: Date.now(), ok: false, code: "candidate-write-failed" };
  }
  return { ts: Date.now(), ok: true, code: "parsed", candidate };
}

export async function applyIntakeInWorkspace(
  projectId: string,
  resumeId: string,
  candidateId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const candidate = await readIntakeCandidate(projectId, resumeId, candidateId);
  if (!candidate) return { ts: Date.now(), ok: false, code: "candidate-not-found" };

  try {
    await applyIntakeCandidates({
      projectId,
      resumeId,
      candidate,
      selection: {
        educationIds: formData.getAll("educationId").map(String),
        experienceIds: formData.getAll("experienceId").map(String),
        projectIds: formData.getAll("projectId").map(String),
        skillIds: formData.getAll("skillId").map(String),
      },
    });
  } catch {
    return { ts: Date.now(), ok: false, code: "apply-failed" };
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "applied" };
}

// ── M3 阶段门 action ─────────────────────────────────────

/**
 * 从一个 awaiting_user 阶段推进到下一阶段。
 * 简单模式：直接设当前 stage complete + advance 到下一阶段。
 * 不走 orchestrator.advance 是因为它做了 stage-failed/retry/not_started
 * 等多种 guard，与 workspace 单向推进需求不匹配。
 */
function advanceSessionToNext(session: PipelineSession): PipelineSession {
  const now = new Date().toISOString();
  const fromStage = session.currentStage;
  const nextStage = getNextPipelineStage(fromStage);
  const stages = { ...session.stages };

  // 标记当前阶段完成
  stages[fromStage] = {
    ...stages[fromStage],
    status: "completed",
    completedAt: now,
    errorCode: undefined,
  };

  if (!nextStage) {
    // 已经是导出阶段 → 完成
    return {
      ...session,
      stages,
      completedAt: now,
      updatedAt: now,
    };
  }

  // 初始化下一阶段
  stages[nextStage] = {
    ...stages[nextStage],
    status: "in_progress",
    enteredAt: stages[nextStage].enteredAt ?? now,
    errorCode: undefined,
  };

  return {
    ...session,
    stages,
    currentStage: nextStage,
    updatedAt: now,
    checkpoints: [
      ...session.checkpoints,
      {
        stageFrom: fromStage,
        stageTo: nextStage,
        summary: `${fromStage} completed; advancing to ${nextStage}`,
        timestamp: now,
      },
    ],
  };
}

/**
 * 确认 egress 隐私项 + 推进 pipeline。
 * 取 formData 中的勾选 items，调 confirmEgressItems → advance。
 * 无 egress items 时直接 advance。
 */
export async function confirmEgressInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }

  const selectedIds = formData.getAll("egressItemId").map(String).filter(Boolean);
  try {
    if (selectedIds.length > 0) {
      await confirmEgressItems(session.id, selectedIds);
    }
    const updated = advanceSessionToNext(session);
    await saveSession(updated);
  } catch {
    return { ts: Date.now(), ok: false, code: "egress-failed" };
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "confirmed" };
}

/**
 * 用户确认当前阶段完成，推进到下一阶段。
 * 不含 egress 确认（那在 confirmEgressInWorkspace 处理）。
 */
export async function advanceStageInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  _formData: FormData,
): Promise<WorkspaceActionState> {
  void _prev; void _formData; // required by useActionState signature
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }

  const stageState = session.stages[session.currentStage];
  if (stageState?.status !== "awaiting_user" && stageState?.status !== "completed") {
    return { ts: Date.now(), ok: false, code: "stage-not-awaiting" };
  }

  try {
    const updated = advanceSessionToNext(session);
    await saveSession(updated);
  } catch {
    return { ts: Date.now(), ok: false, code: "advance-failed" };
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "advanced" };
}

/**
 * 重试当前失败阶段：标记为 in_progress 重跑。
 * 注意这只能重试"用户确认后重跑"；AI 执行自动超时由旧 pipeline actions 管。
 */
export async function retryStageInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  _formData: FormData,
): Promise<WorkspaceActionState> {
  void _prev; void _formData; // required by useActionState signature
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }

  if (session.stages[session.currentStage]?.status !== "failed") {
    return { ts: Date.now(), ok: false, code: "stage-not-failed" };
  }

  try {
    const now = new Date().toISOString();
    const stages = {
      ...session.stages,
      [session.currentStage]: {
        ...session.stages[session.currentStage],
        status: "in_progress" as const,
        enteredAt: now,
        errorCode: undefined,
        failedAt: undefined,
      },
    };
    await saveSession({ ...session, stages, updatedAt: now });
  } catch {
    return { ts: Date.now(), ok: false, code: "retry-failed" };
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "retrying" };
}

// ── 阶段 AI 自动执行（接线：advance 翻 in_progress 后由前端触发器触发对应阶段 AI）──

/**
 * 评估阶段自动执行。进入 evaluate(in_progress) 后由前端触发器调用一次。
 * 调 executePipelineEvaluation 执行联网评估并写 session.evaluationSummary，
 * 成功后把 evaluate 设 awaiting_user（→ 报告视图），失败设 failed（→ 可重试），
 * 消除「评估中…」永久 spinner。
 * 幂等：非 evaluate/in_progress 直接 skip，防触发器重复执行。
 */
export async function runEvaluationInWorkspace(
  projectId: string,
  resumeId: string,
): Promise<WorkspaceActionState> {
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }
  if (session.currentStage !== "evaluate" || session.stages.evaluate.status !== "in_progress") {
    return { ts: Date.now(), ok: true, code: "skip" };
  }

  // egress 已在前置 gate 确认；自动构造 privacy=1 触发执行。
  const formData = new FormData();
  formData.set("privacyConfirmed", "1");

  let researchError: string | null = null;
  try {
    const redirectUrl = await captureCoachRedirect(
      executePipelineEvaluation(projectId, session.id, formData),
    );
    researchError = redirectQuery(redirectUrl).get("researchError");
  } catch {
    researchError = "evaluate-failed";
  }

  const after = await readSession(projectId);
  if (!after) return { ts: Date.now(), ok: false, code: "session-not-found" };
  const now = new Date().toISOString();

  // 以 evaluationSummary 写入为成功判据。
  if (!researchError && after.evaluationSummary) {
    await saveSession({
      ...after,
      stages: {
        ...after.stages,
        evaluate: { ...after.stages.evaluate, status: "awaiting_user", errorCode: undefined },
      },
      updatedAt: now,
    });
    revalidatePath(workspacePath(projectId, resumeId));
    return { ts: Date.now(), ok: true, code: "evaluated" };
  }

  const code = researchError ?? "evaluate-failed";
  await saveSession({
    ...after,
    stages: {
      ...after.stages,
      evaluate: { ...after.stages.evaluate, status: "failed", errorCode: code, failedAt: now },
    },
    updatedAt: now,
  });
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: false, code };
}

/**
 * 润色阶段自动执行。进入 polish(in_progress) 后由前端触发器调用一次。
 * 调 generateMissingPipelinePolishRuns 生成候选，成功设 awaiting_user，失败设 failed。
 * 幂等：非 polish/in_progress 直接 skip。
 */
export async function runPolishInWorkspace(
  projectId: string,
  resumeId: string,
): Promise<WorkspaceActionState> {
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }
  if (session.currentStage !== "polish" || session.stages.polish.status !== "in_progress") {
    return { ts: Date.now(), ok: true, code: "skip" };
  }

  const now = new Date().toISOString();
  try {
    await generateMissingPipelinePolishRuns(projectId, resumeId, {
      evaluationSummary: session.evaluationSummary,
    });
  } catch {
    const after = await readSession(projectId);
    if (after) {
      await saveSession({
        ...after,
        stages: {
          ...after.stages,
          polish: { ...after.stages.polish, status: "failed", errorCode: "polish-failed", failedAt: now },
        },
        updatedAt: now,
      });
    }
    revalidatePath(workspacePath(projectId, resumeId));
    return { ts: Date.now(), ok: false, code: "polish-failed" };
  }

  const after = await readSession(projectId);
  if (after) {
    await saveSession({
      ...after,
      stages: {
        ...after.stages,
        polish: { ...after.stages.polish, status: "awaiting_user", errorCode: undefined },
      },
      updatedAt: now,
    });
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "polished" };
}

// ── M3 polish apply/discard — 包装旧 redirect action ──

/**
 * 应用 polish 候选。captureCoachRedirect 模式。
 */
export async function applyPolishInWorkspace(
  projectId: string,
  resumeId: string,
  runId: string,
  candidateId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const redirectUrl = await captureCoachRedirect(
    executeApplyPolish(projectId, resumeId, runId, candidateId, formData),
  );
  const query = redirectQuery(redirectUrl);
  const ok = query.get("polishStatus") === "applied";
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok, code: ok ? "applied" : query.get("polishCode") ?? "apply-failed" };
}

/**
 * 丢弃 polish 候选（不应用，标记 discarded）。
 */
export async function discardPolishInWorkspace(
  projectId: string,
  resumeId: string,
  runId: string,
  candidateId: string,
): Promise<WorkspaceActionState> {
  const redirectUrl = await captureCoachRedirect(
    executeDiscardPolish(projectId, resumeId, runId, candidateId),
  );
  const query = redirectQuery(redirectUrl);
  const ok = query.get("polishStatus") === "discarded";
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok, code: ok ? "discarded" : query.get("polishCode") ?? "discard-failed" };
}

// ── 自动推进（项目级一次同意 + 计算阶段自动串接）──────────

/**
 * 切换「自动联网与推进」开关 = 项目级一次同意。
 * 开启后计算阶段（问答→评估→润色）自动外发并推进，无需每步点击；
 * 关闭后回退逐步手动确认（每次点击即单次同意）。已发出的外发不可撤销，
 * 但关闭可阻止后续阶段外发。
 */
export async function toggleAutoAdvanceInWorkspace(
  projectId: string,
  resumeId: string,
  enabled: boolean,
): Promise<WorkspaceActionState> {
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }
  try {
    await toggleAutoAdvance(session.id, enabled);
  } catch {
    return { ts: Date.now(), ok: false, code: "toggle-failed" };
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: enabled ? "auto-on" : "auto-off" };
}

/**
 * 自动推进一步：在计算阶段（grill / evaluate）的 awaiting_user 态，
 * 自动确认该阶段 egress 项并推进到下一阶段（下一阶段 in_progress 由 StageAutoRunner 触发 AI）。
 * 由 AutoAdvanceRunner 在倒计时结束后调用。
 *
 * 守卫：
 *  - autoAdvance 关闭 → skip（用户已暂停/转手动）
 *  - 非 awaiting_user → skip（结果未就绪）
 *  - polish / export → skip（保留用户判断点：选候选 / 下载）
 */
export async function autoAdvanceStepInWorkspace(
  projectId: string,
  resumeId: string,
): Promise<WorkspaceActionState> {
  const session = await readSession(projectId);
  if (!session || session.resumeId !== resumeId) {
    return { ts: Date.now(), ok: false, code: "session-not-found" };
  }
  if (!session.autoAdvance) return { ts: Date.now(), ok: true, code: "skip" };

  const stage = session.currentStage;
  if (stage !== "grill" && stage !== "evaluate") {
    return { ts: Date.now(), ok: true, code: "skip" };
  }
  if (session.stages[stage]?.status !== "awaiting_user") {
    return { ts: Date.now(), ok: true, code: "skip" };
  }

  try {
    // 项目级已同意：自动确认该阶段全部外发项（一致沿用 confirmEgress→advance 模式）。
    const stageItemIds = session.egressPlan.items
      .filter((item) => item.stage === stage)
      .map((item) => item.id);
    if (stageItemIds.length > 0) {
      await confirmEgressItems(session.id, stageItemIds);
    }
    const updated = advanceSessionToNext(session);
    await saveSession(updated);
  } catch {
    return { ts: Date.now(), ok: false, code: "advance-failed" };
  }
  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "advanced" };
}

// ── M3 导出 action ──────────────────────────────────────

/**
 * 执行 docx-zh-clean 导出。直接调 renderExport + createExportRecord，
 * 不走 redirect 模式（export action 是纯写盘操作，无 redirect）。
 */
export async function exportDocxInWorkspace(
  projectId: string,
  resumeId: string,
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) return { ts: Date.now(), ok: false, code: "missing-resume" };

  const privacyConfirmed = String(formData.get("privacyConfirmed") ?? "") === "1";
  if (!privacyConfirmed) return { ts: Date.now(), ok: false, code: "privacy-not-confirmed" };

  try {
    const pipelineSession = await readSession(projectId);
    const pipelineSnapshot =
      pipelineSession?.resumeId === resumeId ? pipelineSession.exportSnapshot : undefined;
    const layoutOverrides = await readLayoutOverrides(projectId, resumeId);
    await createExportRecord({
      resumeId,
      format: "docx-zh-clean",
      content: await renderExport(current.document, "docx-zh-clean", {
        partialMode: String(formData.get("partialMode") ?? "") === "1",
        layoutOverrides: pipelineSnapshot ? undefined : (layoutOverrides ?? undefined),
        layoutSchema: pipelineSnapshot?.layoutSchema,
        gapReport: pipelineSnapshot?.gapReport,
      }),
    });
  } catch {
    return { ts: Date.now(), ok: false, code: "export-failed" };
  }

  revalidatePath(workspacePath(projectId, resumeId));
  return { ts: Date.now(), ok: true, code: "exported" };
}
