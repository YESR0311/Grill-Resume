"use server";

import { revalidatePath } from "next/cache";
import { createProfile } from "@/features/profile/store";
import { runIntakeRound } from "@/features/intake/engine";
import { toUserMessage } from "@/features/ai/chat";

/**
 * 首页惰性建档（P1-a）。
 *
 * 首页渲染时不再 createProfile（避免每次 GET 落库空 profile 产生孤儿档案）。
 * 改为：用户在首页发出第一条消息时才建档，并把该轮问答跑完后返回新 profileId
 * 与 AI 回复。客户端拿到 id 后 router.replace 到正规问答页 /intake/[id]，
 * 后续轮次由 IntakeWorkspace 接管（design §5.1「首页即对话入口」）。
 */
export async function startIntakeAction(
  userMessage: string,
): Promise<{ profileId: string; reply: string; phase: string; error?: string }> {
  const text = userMessage.trim();
  if (!text) {
    return { profileId: "", reply: "", phase: "error", error: "请输入内容后再发送" };
  }
  try {
    const profile = createProfile();
    const result = await runIntakeRound(profile.id, text);
    revalidatePath("/");
    revalidatePath(`/intake/${profile.id}`);
    revalidatePath(`/profile/${profile.id}`);
    return { profileId: profile.id, reply: result.reply, phase: result.phase };
  } catch (err) {
    console.error("startIntakeAction failed:", err);
    return { profileId: "", reply: "", phase: "error", error: toUserMessage(err) };
  }
}
