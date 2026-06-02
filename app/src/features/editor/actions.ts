"use server";

import { revalidatePath } from "next/cache";
import { normalizeLayoutOverrides, type LayoutOverrides } from "@/features/layout/overrides";
import { getProjectResume, writeLayoutOverrides } from "@/features/resume/storage";
import { buildMicroEditEvidenceMap, validateMicroEdit } from "./grounding";

export type SaveLayoutOverridesResult =
  | { ok: true; overrides: LayoutOverrides }
  | { ok: false; message: string };

export async function saveLayoutOverridesAction(
  projectId: string,
  resumeId: string,
  overrides: LayoutOverrides,
): Promise<SaveLayoutOverridesResult> {
  try {
    const current = await getProjectResume(projectId, resumeId);
    if (!current) return { ok: false, message: "简历不存在" };
    const normalized = normalizeLayoutOverrides(overrides, resumeId);
    const evidenceMap = buildMicroEditEvidenceMap(current.document);
    for (const [bulletId, edited] of Object.entries(normalized.bulletOverrides ?? {})) {
      const evidence = evidenceMap[bulletId];
      if (!evidence) return { ok: false, message: "排版微调目标已不存在" };
      const validation = validateMicroEdit({ original: evidence.original, edited, evidence: evidence.evidence });
      if (!validation.ok) return { ok: false, message: `请先回 grill 补证据：${validation.token}` };
    }

    const saved = await writeLayoutOverrides({
      projectId,
      resumeId,
      overrides: normalized,
    });
    revalidatePath(`/projects/${projectId}/resumes/${resumeId}/edit`);
    revalidatePath(`/projects/${projectId}/resumes/${resumeId}/export`);
    return { ok: true, overrides: saved };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存排版设置失败" };
  }
}
