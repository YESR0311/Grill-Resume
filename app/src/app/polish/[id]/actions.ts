"use server";

import { revalidatePath } from "next/cache";
import { runPolish } from "@/features/polish/engine";
import { saveResumeDraft, getResumeDraft } from "@/features/polish/draft-store";
import type { ResumeDraft } from "@/features/polish/types";
import { actionError, actionSuccess, type ActionResult } from "@/lib/server-action";

export async function runPolishAction(profileId: string): Promise<ActionResult> {
  if (!profileId) return { ok: false, error: "档案无效" };
  try {
    const draft = await runPolish(profileId);
    await saveResumeDraft(draft);
    revalidatePath(`/polish/${profileId}`);
    return actionSuccess(undefined);
  } catch (err) {
    console.error("runPolishAction failed:", err);
    return actionError(err);
  }
}

export async function getDraftAction(profileId: string): Promise<ResumeDraft | null> {
  return getResumeDraft(profileId);
}

export async function saveDraftAction(draft: ResumeDraft): Promise<ActionResult> {
  try {
    await saveResumeDraft(draft);
    revalidatePath(`/polish/${draft.profileId}`);
    return actionSuccess(undefined);
  } catch (err) {
    console.error("saveDraftAction failed:", err);
    return actionError(err);
  }
}
