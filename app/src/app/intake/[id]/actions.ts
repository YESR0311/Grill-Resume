"use server";

import { runIntakeRound } from "@/features/intake/engine";
import { getIntakeLog } from "@/features/intake/store";

export async function sendIntakeMessageAction(
  profileId: string,
  userMessage: string,
): Promise<{ reply: string; phase: string; ready: boolean }> {
  const result = await runIntakeRound(profileId, userMessage);
  return {
    reply: result.reply,
    phase: result.phase,
    ready: result.phase === "ready",
  };
}

export async function getIntakeMessagesAction(profileId: string) {
  const log = await getIntakeLog(profileId);
  return log.messages.map((m) => ({ role: m.role, content: m.content }));
}