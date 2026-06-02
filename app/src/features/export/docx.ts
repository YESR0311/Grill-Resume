import "server-only";

import type { ResumeDocument } from "@/features/resume/types";
import { buildZhCleanDocx } from "./templates/zh-clean";

export type DocxGapReport = {
  confirmedExperienceBullets: number;
  excludedExperienceBullets: number;
  confirmedProjectBullets: number;
  excludedProjectBullets: number;
  missingBasics: string[];
};

export type ResumeDocxResult = {
  buffer: Buffer;
  report: DocxGapReport;
};

export type ResumeDocxOptions = {
  partialMode?: boolean;
};

function countBullets(items: { bullets: { status: "draft" | "confirmed" | "archived" }[] }[]): { confirmed: number; excluded: number } {
  let confirmed = 0;
  let excluded = 0;
  for (const item of items) {
    for (const bullet of item.bullets) {
      if (bullet.status === "confirmed") confirmed += 1;
      else excluded += 1;
    }
  }
  return { confirmed, excluded };
}

export function buildDocxGapReport(document: ResumeDocument): DocxGapReport {
  const experience = countBullets(document.experiences);
  const project = countBullets(document.projects);
  const missingBasics: string[] = [];
  if (!document.basics.name?.trim()) missingBasics.push("姓名");
  if (!document.basics.phone?.trim()) missingBasics.push("电话");
  if (!document.basics.email?.trim()) missingBasics.push("邮箱");
  return {
    confirmedExperienceBullets: experience.confirmed,
    excludedExperienceBullets: experience.excluded,
    confirmedProjectBullets: project.confirmed,
    excludedProjectBullets: project.excluded,
    missingBasics,
  };
}

function footer(report: DocxGapReport, options: ResumeDocxOptions): string | undefined {
  if (!options.partialMode) return undefined;
  const excluded = report.excludedExperienceBullets + report.excludedProjectBullets;
  const confirmed = report.confirmedExperienceBullets + report.confirmedProjectBullets;
  const gaps = [
    `${confirmed} 条 confirmed bullets 已导出`,
    excluded > 0 ? `${excluded} 条 candidate/draft/archived bullets 未导出` : undefined,
    report.missingBasics.length > 0 ? `缺少：${report.missingBasics.join("、")}` : undefined,
  ].filter(Boolean);
  return `导出缺口：${gaps.join("；")}`;
}

export async function renderResumeDocx(document: ResumeDocument, options: ResumeDocxOptions = {}): Promise<ResumeDocxResult> {
  const report = buildDocxGapReport(document);
  return {
    buffer: await buildZhCleanDocx(document, footer(report, options)),
    report,
  };
}
