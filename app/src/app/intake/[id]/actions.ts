"use server";

import { revalidatePath } from "next/cache";
import { runIntakeRound, runChatTurn } from "@/features/intake/engine";
import { getProfile, saveProfile } from "@/features/profile/store";
import { parseDimension } from "@/features/intake/parser";
import { applyDimensionResult, NEXT_DIMENSION, type IntakeDimension } from "@/features/intake/dimensions";
import { toUserMessage } from "@/features/ai/chat";

// ─── intake-v2 ─────────────────────────────────────────────

/**
 * v2 自由对话：发一条消息，返回 AI 回复 + 是否阶段完成。
 * 不解析结构化（解析交给 advanceDimensionAction）。
 */
export async function sendChatTurnAction(
  profileId: string,
  dimension: IntakeDimension,
  userMessage: string,
): Promise<{ reply: string; phaseComplete: boolean; error?: string }> {
  if (!profileId) return { reply: "", phaseComplete: false, error: "会话无效，请重新开始" };
  try {
    const result = await runChatTurn(profileId, dimension, userMessage);
    return { reply: result.reply, phaseComplete: result.phaseComplete };
  } catch (err) {
    console.error("sendChatTurnAction failed:", err);
    return { reply: "", phaseComplete: false, error: toUserMessage(err) };
  }
}

/**
 * v2 阶段推进：解析当前阶段对话 → 写回 profile → 推进 phase。
 * 后台静默执行；失败不抛（走 empty / partial），保证流程不中断。
 * 返回下一阶段（或 "ready"）。
 */
export async function advanceDimensionAction(
  profileId: string,
  dimension: IntakeDimension,
): Promise<{ next: IntakeDimension | "ready"; partial: boolean; error?: string }> {
  try {
    const profile = getProfile(profileId);
    if (!profile) return { next: "ready", partial: false, error: "档案不存在" };

    // 1. 解析当前阶段（内部按 dimension 拉取对话历史）
    const result = await parseDimension({ profileId, dimension });

    // 2. 合并写回
    const merged = applyDimensionResult(profile, dimension, result);

    // 3. 推进 phase
    const next = NEXT_DIMENSION[dimension];
    merged.intakeStatus = {
      ...merged.intakeStatus,
      phase: next === "ready" ? "ready" : next,
    };
    saveProfile(merged);

    revalidatePath(`/intake/${profileId}`);
    revalidatePath(`/profile/${profileId}`);

    return { next, partial: result.completeness === "partial" };
  } catch (err) {
    console.error("advanceDimensionAction failed:", err);
    // 失败也要让流程能继续：返回下一阶段，partial 标记
    return { next: NEXT_DIMENSION[dimension], partial: true, error: toUserMessage(err) };
  }
}

// ─── v1 legacy ─────────────────────────────────────────────

/** @deprecated v1 单 call 解析路径，保留作回退；v2 用 sendChatTurnAction + advanceDimensionAction。 */
export async function sendIntakeMessageAction(
  profileId: string,
  userMessage: string,
): Promise<{ reply: string; phase: string; ready: boolean; error?: string }> {
  if (!profileId) return { reply: "", phase: "error", ready: false, error: "会话无效，请重新开始" };
  try {
    const result = await runIntakeRound(profileId, userMessage);
    revalidatePath(`/intake/${profileId}`);
    revalidatePath(`/profile/${profileId}`);
    return {
      reply: result.reply,
      phase: result.phase,
      ready: result.phase === "ready",
    };
  } catch (err) {
    console.error("sendIntakeMessageAction failed:", err);
    return { reply: "", phase: "error", ready: false, error: toUserMessage(err) };
  }
}

export async function getIntakeMessagesAction(profileId: string) {
  const { getIntakeLog } = await import("@/features/intake/store");
  const log = await getIntakeLog(profileId);
  return log.messages.map((m) => ({ role: m.role, content: m.content, dimension: m.dimension }));
}
