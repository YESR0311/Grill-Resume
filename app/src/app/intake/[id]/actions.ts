"use server";

import { runIntakeRound } from "@/features/intake/engine";
import { getIntakeLog } from "@/features/intake/store";
import { toUserMessage } from "@/features/ai/chat";

export async function sendIntakeMessageAction(
  profileId: string,
  userMessage: string,
): Promise<{ reply: string; phase: string; ready: boolean; error?: string }> {
  if (!profileId) return { reply: "", phase: "error", ready: false, error: "会话无效，请重新开始" };
  try {
    const result = await runIntakeRound(profileId, userMessage);
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
  const log = await getIntakeLog(profileId);
  return log.messages.map((m) => ({ role: m.role, content: m.content }));
}
