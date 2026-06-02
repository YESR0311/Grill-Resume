import "server-only";

import type { SearchProvider, SearchResult } from "@/features/search";
import type { ResumeDocument, Experience, Project } from "@/features/resume/types";
import type { CoachResearchCitation } from "./research";

export type JdCoverageCitation = CoachResearchCitation & { host?: string };

export type JdCoverageResult =
  | { status: "no-keywords" }
  | { status: "ok"; covered: string[]; uncovered: string[]; total: number; webCitations?: Record<string, JdCoverageCitation[]> };

function normalizeKeyword(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeKeywords(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const norm = normalizeKeyword(raw);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

function appendNonEmpty(target: string[], value: string | undefined | null): void {
  if (typeof value === "string" && value.trim().length > 0) target.push(value);
}

function collectFromEvidence(target: string[], evidence: Experience["evidence"] | Project["evidence"]): void {
  for (const item of evidence) {
    appendNonEmpty(target, item.context);
    appendNonEmpty(target, item.task);
    appendNonEmpty(target, item.scope);
    appendNonEmpty(target, item.reflection);
    appendNonEmpty(target, item.sourceText);
    for (const action of item.actions) appendNonEmpty(target, action);
    for (const result of item.results) {
      appendNonEmpty(target, result.text);
      appendNonEmpty(target, result.metric);
    }
    for (const skill of item.skills) appendNonEmpty(target, skill);
  }
}

function collectFromBullets(target: string[], bullets: { text: string; status: "draft" | "confirmed" | "archived" }[]): void {
  for (const bullet of bullets) {
    if (bullet.status !== "confirmed") continue;
    appendNonEmpty(target, bullet.text);
  }
}

export function buildScanCorpus(document: ResumeDocument): string {
  const parts: string[] = [];
  for (const experience of document.experiences) {
    collectFromEvidence(parts, experience.evidence);
    collectFromBullets(parts, experience.bullets);
  }
  for (const project of document.projects) {
    collectFromEvidence(parts, project.evidence);
    collectFromBullets(parts, project.bullets);
    appendNonEmpty(parts, project.goal);
    for (const tech of project.techStack) appendNonEmpty(parts, tech);
  }
  for (const skillGroup of document.skills) {
    appendNonEmpty(parts, skillGroup.name);
    for (const skill of skillGroup.items) appendNonEmpty(parts, skill);
  }
  if (document.summary) {
    appendNonEmpty(parts, document.summary.headline);
    collectFromBullets(parts, document.summary.bullets);
  }
  return parts.join("\n").toLowerCase();
}

export function analyzeJdCoverage(document: ResumeDocument): JdCoverageResult {
  const rawKeywords = document.target?.keywords ?? [];
  const keywords = dedupeKeywords(rawKeywords);
  if (keywords.length === 0) return { status: "no-keywords" };

  const corpus = buildScanCorpus(document);
  const covered: string[] = [];
  const uncovered: string[] = [];
  for (const keyword of keywords) {
    if (corpus.includes(keyword.toLowerCase())) covered.push(keyword);
    else uncovered.push(keyword);
  }
  return { status: "ok", covered, uncovered, total: keywords.length };
}

function toJdCitation(result: SearchResult): JdCoverageCitation {
  return {
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    retrievedAt: result.retrievedAt ?? new Date().toISOString(),
    host: result.host,
  };
}

export async function augmentJdCoverageWithSearch(
  coverage: JdCoverageResult,
  provider: SearchProvider,
): Promise<JdCoverageResult> {
  if (coverage.status !== "ok" || coverage.uncovered.length === 0) return coverage;

  const entries = await Promise.all(
    coverage.uncovered.slice(0, 10).map(async (keyword) => {
      const results = await provider.query({ query: `${keyword} hiring demand resume keyword`, maxResults: 3 });
      return [keyword, results.map(toJdCitation)] as const;
    }),
  );
  return {
    ...coverage,
    webCitations: Object.fromEntries(entries.filter(([, citations]) => citations.length > 0)),
  };
}
