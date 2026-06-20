import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { ResumeDraftSchema, type ResumeDraft } from "./types";

/**
 * ResumeDraft 存储（独立文件，不和旧 PolishRun 共用）。
 */
const DIR = path.join(process.cwd(), "data", "polish");

function fileFor(profileId: string): string {
  return path.join(DIR, `${profileId}.json`);
}

export async function getResumeDraft(profileId: string): Promise<ResumeDraft | null> {
  try {
    const raw = await fs.readFile(fileFor(profileId), "utf8");
    const parsed = ResumeDraftSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return null;
}

export async function saveResumeDraft(draft: ResumeDraft): Promise<ResumeDraft> {
  const validated = ResumeDraftSchema.parse(draft);
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(fileFor(validated.profileId), JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

export async function deleteResumeDraft(profileId: string): Promise<void> {
  try {
    await fs.unlink(fileFor(profileId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
