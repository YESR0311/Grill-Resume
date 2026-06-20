"use server";

import { revalidatePath } from "next/cache";
import { getProfile, saveProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";

export async function saveProfileAction(profileJson: string): Promise<{ ok: boolean }> {
  let profile: PersonProfile;
  try {
    profile = JSON.parse(profileJson) as PersonProfile;
  } catch {
    console.error("saveProfileAction: 非法 JSON");
    return { ok: false };
  }
  if (!profile?.id) return { ok: false };
  saveProfile(profile);
  revalidatePath(`/profile/${profile.id}`);
  return { ok: true };
}

export async function getProfileAction(id: string): Promise<PersonProfile | null> {
  return getProfile(id) ?? null;
}