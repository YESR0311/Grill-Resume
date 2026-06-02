import "server-only";

import { project } from "@/features/layout/project";
import type { LayoutBlock, LayoutSchema } from "@/features/layout/schema";
import type { ResumeDocument } from "@/features/resume/types";
import { buildDocxGapReport, type DocxGapReport } from "./gap-report";
import { buildZhCleanDocx } from "./templates/zh-clean";

export { buildDocxGapReport };
export type { DocxGapReport };

export type ResumeDocxResult = {
  buffer: Buffer;
  report: DocxGapReport;
};

export type ResumeDocxOptions = {
  partialMode?: boolean;
  gapReport?: DocxGapReport;
};

function isLayoutSchema(input: ResumeDocument | LayoutSchema): input is LayoutSchema {
  return "version" in input && input.version === "layout-v1";
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

function schemaReport(schema: LayoutSchema): DocxGapReport {
  const report: DocxGapReport = {
    confirmedExperienceBullets: 0,
    excludedExperienceBullets: 0,
    confirmedProjectBullets: 0,
    excludedProjectBullets: 0,
    missingBasics: [],
  };
  for (const block of schema.blocks) {
    if (block.kind === "experience") report.confirmedExperienceBullets += block.bullets.length;
    if (block.kind === "project") report.confirmedProjectBullets += block.bullets.length;
  }
  const header = schema.blocks.find((block): block is Extract<LayoutBlock, { kind: "header" }> => block.kind === "header");
  if (!header?.name.trim()) report.missingBasics.push("姓名");
  return report;
}

function projectInput(input: ResumeDocument | LayoutSchema, options: ResumeDocxOptions): { schema: LayoutSchema; report: DocxGapReport } {
  if (isLayoutSchema(input)) {
    return { schema: input, report: options.gapReport ?? schemaReport(input) };
  }
  const projected = project(input);
  return { schema: projected.schema, report: projected.gap };
}

export async function renderResumeDocx(input: ResumeDocument | LayoutSchema, options: ResumeDocxOptions = {}): Promise<ResumeDocxResult> {
  const { schema, report } = projectInput(input, options);
  return {
    buffer: await buildZhCleanDocx(schema, footer(report, options)),
    report,
  };
}
