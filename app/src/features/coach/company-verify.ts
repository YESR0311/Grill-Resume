import "server-only";

import type { ResumeDocument } from "@/features/resume/types";
import type { SearchResult } from "@/features/search";

export type VerificationStatus = "verified" | "partial" | "unverified";

export type CompanyVerifyFinding = {
  id: string;
  label: string;
  source: "experience" | "project";
  status: VerificationStatus;
  citations: SearchResult[];
};

function status(results: SearchResult[]): VerificationStatus {
  if (results.length >= 2) return "verified";
  if (results.length === 1) return "partial";
  return "unverified";
}

export async function verifyCompaniesAndProjects(input: {
  document: ResumeDocument;
  search: (query: string) => Promise<SearchResult[]>;
}): Promise<CompanyVerifyFinding[]> {
  const items = [
    ...input.document.experiences.map((experience) => ({ id: experience.id, label: experience.organization, source: "experience" as const })),
    ...input.document.projects.map((project) => ({ id: project.id, label: project.name, source: "project" as const })),
  ].filter((item) => item.label.trim().length > 0).slice(0, 12);

  const findings: CompanyVerifyFinding[] = [];
  for (const item of items) {
    const citations = await input.search(`${item.label} official website news blog`);
    findings.push({ ...item, status: status(citations), citations: citations.slice(0, 3) });
  }
  return findings;
}
