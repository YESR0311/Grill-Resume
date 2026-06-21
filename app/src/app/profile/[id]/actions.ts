"use server";

import { revalidatePath } from "next/cache";
import { getProfile, saveProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";
import { actionError, actionSuccess, type ActionResult } from "@/lib/server-action";

export async function saveProfileAction(profileJson: string): Promise<ActionResult> {
  let profile: PersonProfile;
  try {
    profile = JSON.parse(profileJson) as PersonProfile;
  } catch {
    console.error("saveProfileAction: 非法 JSON");
    return { ok: false, error: "档案数据格式错误" };
  }
  if (!profile?.id) return { ok: false, error: "档案 ID 缺失" };
  try {
    saveProfile(profile);
    revalidatePath(`/profile/${profile.id}`);
    return actionSuccess(undefined);
  } catch (err) {
    console.error("saveProfileAction failed:", err);
    return actionError(err);
  }
}

export async function getProfileAction(id: string): Promise<PersonProfile | null> {
  return getProfile(id) ?? null;
}
