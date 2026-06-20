"use server";

import { runPolish } from "@/features/polish/engine";
import { saveResumeDraft, getResumeDraft } from "@/features/polish/draft-store";
import { buildDraftDocx } from "@/features/export/from-draft";
import type { ResumeDraft } from "@/features/polish/types";
import { toUserMessage } from "@/features/ai/chat";

export async function runPolishAction(profileId: string): Promise<{ ok: boolean; error?: string }> {
  if (!profileId) return { ok: false, error: "档案无效" };
  try {
    const draft = await runPolish(profileId);
    await saveResumeDraft(draft);
    return { ok: true };
  } catch (err) {
    console.error("runPolishAction failed:", err);
    return { ok: false, error: toUserMessage(err) };
  }
}

export async function getDraftAction(profileId: string): Promise<ResumeDraft | null> {
  return getResumeDraft(profileId);
}

export async function saveDraftAction(draft: ResumeDraft): Promise<void> {
  await saveResumeDraft(draft);
}

export async function exportDocxAction(profileId: string): Promise<{ ok: boolean; buffer?: number[]; error?: string }> {
  try {
    const draft = await getResumeDraft(profileId);
    if (!draft) return { ok: false, error: "尚未生成简历草稿" };
    const buffer = await buildDraftDocx(draft);
    return { ok: true, buffer: Array.from(buffer) };
  } catch (err) {
    console.error("exportDocxAction failed:", err);
    return { ok: false, error: toUserMessage(err) };
  }
}