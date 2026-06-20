import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { EvaluationReportSchema, type EvaluationReport } from "./types";

/**
 * 评估报告存储。JSON 文件存入 data/evaluate/<profileId>.json。
 */

const DIR = path.join(process.cwd(), "data", "evaluate");

function fileFor(profileId: string): string {
  return path.join(DIR, `${profileId}.json`);
}

export async function getEvaluationReport(profileId: string): Promise<EvaluationReport | null> {
  try {
    const raw = await fs.readFile(fileFor(profileId), "utf8");
    const parsed = EvaluationReportSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return null;
}

export async function saveEvaluationReport(report: EvaluationReport): Promise<EvaluationReport> {
  const validated = EvaluationReportSchema.parse(report);
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(fileFor(validated.profileId), JSON.stringify(validated, null, 2), "utf8");
  return validated;
}
