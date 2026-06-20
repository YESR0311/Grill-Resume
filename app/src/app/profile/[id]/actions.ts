"use server";

import { revalidatePath } from "next/cache";
import { getProfile, saveProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";

export async function saveProfileAction(profileJson: string): Promise<{ ok: boolean }> {
  const profile = JSON.parse(profileJson) as PersonProfile;
  saveProfile(profile);
  revalidatePath(`/profile/${profile.id}`);
  return { ok: true };
}

export async function getProfileAction(id: string): Promise<PersonProfile | null> {
  return getProfile(id) ?? null;
}