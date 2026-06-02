import "server-only";

import type { ResumeDocument } from "@/features/resume/types";
import type { SearchResult } from "@/features/search";

export type SkillScarcityLevel = "high-demand" | "moderate-demand" | "niche";

export type SkillScarcityFinding = {
  skill: string;
  level: SkillScarcityLevel;
  citations: SearchResult[];
};

function classify(results: SearchResult[]): SkillScarcityLevel {
  if (results.length >= 3) return "high-demand";
  if (results.length >= 1) return "moderate-demand";
  return "niche";
}

export async function evaluateSkillScarcity(input: {
  document: ResumeDocument;
  search: (query: string) => Promise<SearchResult[]>;
}): Promise<SkillScarcityFinding[]> {
  const skills = input.document.skills.flatMap((group) => group.items).slice(0, 12);
  const findings: SkillScarcityFinding[] = [];
  for (const skill of skills) {
    const citations = await input.search(`${skill} hiring demand resume skill`);
    findings.push({ skill, level: classify(citations), citations: citations.slice(0, 3) });
  }
  return findings;
}
