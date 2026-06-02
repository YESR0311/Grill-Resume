import type { ResumeDocument } from "@/features/resume/types";

export type DocxGapReport = {
  confirmedExperienceBullets: number;
  excludedExperienceBullets: number;
  confirmedProjectBullets: number;
  excludedProjectBullets: number;
  missingBasics: string[];
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
