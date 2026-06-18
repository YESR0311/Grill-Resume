import "server-only";

import { nanoid } from "nanoid";
import { analyzeJdCoverage, augmentJdCoverageWithSearch, type JdCoverageResult } from "@/features/coach/jd-coverage";
import { evaluateSkillScarcity, type SkillScarcityFinding } from "@/features/coach/skill-scarcity";
import { verifyCompaniesAndProjects, type CompanyVerifyFinding } from "@/features/coach/company-verify";
import type { CoachResearchFinding } from "@/features/coach/research";
import { SearchProviderError, type SearchProvider } from "@/features/search";
import type { ResumeDocument } from "@/features/resume/types";

const COACH_SEARCH_TIMEOUT_MS = 12_000;

export type EvaluationResearchRaw = {
  scarcity: SkillScarcityFinding[];
  verification: CompanyVerifyFinding[];
  jdCoverage: JdCoverageResult;
};

// 三路 Promise.all（含 per-query 超时包装与 COACH_SEARCH_TIMEOUT_MS）；provider 由调用方注入。
// 与原 action-helpers.ts:869-886 内联逻辑逐字节等价。
export async function runEvaluationResearch(input: {
  document: ResumeDocument;
  provider: SearchProvider;
}): Promise<EvaluationResearchRaw> {
  const { document, provider } = input;
  const search = async (query: string) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new SearchProviderError("request-failed", "search timeout")), COACH_SEARCH_TIMEOUT_MS);
    });
    try {
      return await Promise.race([provider.query({ query, maxResults: 3 }), timedOut]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
  const [scarcity, verification, jdCoverage] = await Promise.all([
    evaluateSkillScarcity({ document, search }),
    verifyCompaniesAndProjects({ document, search }),
    augmentJdCoverageWithSearch(analyzeJdCoverage(document), provider),
  ]);
  return { scarcity, verification, jdCoverage };
}

// 三路结果 → CoachResearchFinding[]（与原 action-helpers.ts:887-927 映射逐字节等价）。
// nanoid 在此调用 → findings.id 随机；行为零回归断言比对 kind/text/source/confidence 结构与计数，不比 id。
export function buildResearchFindings(raw: EvaluationResearchRaw): CoachResearchFinding[] {
  const { scarcity, verification, jdCoverage } = raw;
  const jdFindings: CoachResearchFinding[] = jdCoverage.status === "ok"
    ? Object.entries(jdCoverage.webCitations ?? {}).map(([keyword, citations]) => ({
        id: nanoid(),
        kind: "research_fact",
        text: `${keyword}：JD uncovered keyword has web demand signals`,
        source: "web",
        sourceLabel: "Tavily JD coverage",
        sourceUrl: citations[0]?.url,
        citations,
        confidence: citations.some((citation) => citation.host) ? "medium" : "low",
        canEnterResume: false,
        confirmationStatus: "unconfirmed",
      }))
    : [];
  return [
    ...jdFindings,
    ...scarcity.map((item): CoachResearchFinding => ({
      id: nanoid(),
      kind: "research_fact",
      text: `${item.skill}：${item.level}`,
      source: item.citations.length > 0 ? "web" : "resume",
      sourceLabel: "Tavily skill scarcity",
      sourceUrl: item.citations[0]?.url,
      citations: item.citations.map((citation) => ({ title: citation.title, url: citation.url, snippet: citation.snippet, retrievedAt: citation.retrievedAt })),
      confidence: item.level === "high-demand" ? "high" : item.level === "moderate-demand" ? "medium" : "low",
      canEnterResume: false,
      confirmationStatus: "unconfirmed",
    })),
    ...verification.map((item): CoachResearchFinding => ({
      id: nanoid(),
      kind: "research_fact",
      text: `${item.label}：${item.status}`,
      source: item.citations.length > 0 ? "web" : "resume",
      sourceLabel: item.source === "experience" ? "Tavily company verify" : "Tavily project verify",
      sourceUrl: item.citations[0]?.url,
      citations: item.citations.map((citation) => ({ title: citation.title, url: citation.url, snippet: citation.snippet, retrievedAt: citation.retrievedAt })),
      confidence: item.status === "verified" ? "high" : item.status === "partial" ? "medium" : "low",
      canEnterResume: false,
      confirmationStatus: "unconfirmed",
    })),
  ];
}
