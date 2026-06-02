import type { ResumeDocument, StarEvidence } from "@/features/resume/types";

export type MicroEditEvidence = {
  bulletId: string;
  original: string;
  evidence: StarEvidence[];
};

export type MicroEditValidation =
  | { ok: true }
  | {
      ok: false;
      reason: "introduces-unsourced-number" | "introduces-unsourced-entity";
      routeToGrill: true;
      token: string;
    };

const NUMBER_PATTERN = /(?<![A-Za-z0-9])(?:\d+(?:\.\d+)?%?|[一二三四五六七八九十百千万亿]+(?:个|名|人|次|项|天|周|月|年|小时|分钟|%|百分点)?)(?![A-Za-z0-9])/gu;
const LATIN_ENTITY_PATTERN = /\b(?:[A-Z][A-Za-z0-9+#.-]{1,}|[A-Z]{2,})\b/g;
const CJK_ENTITY_PATTERN = /[\p{Script=Han}A-Za-z0-9+#.-]{2,18}(?:公司|大学|学院|银行|集团|实验室|研究院|部门|团队|平台|产品|证书|奖项|赛事|系统)/gu;

function evidenceText(evidence: StarEvidence): string {
  return [
    evidence.context,
    evidence.task,
    ...evidence.actions,
    ...evidence.results.flatMap((result) => [result.text, result.metric]),
    ...evidence.skills,
    evidence.scope,
    evidence.reflection,
    evidence.sourceText,
  ]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join("\n");
}

function tokens(value: string, pattern: RegExp): string[] {
  return Array.from(value.matchAll(pattern)).map((match) => match[0].trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function additions(original: string, edited: string, pattern: RegExp): string[] {
  const allowed = new Set(tokens(original, pattern));
  return unique(tokens(edited, pattern).filter((token) => !allowed.has(token)));
}

function containsToken(haystack: string, token: string): boolean {
  return haystack.includes(token);
}

function hasUnsupportedAddition(original: string, edited: string, evidenceTextValue: string, pattern: RegExp): string | undefined {
  for (const token of additions(original, edited, pattern)) {
    if (!containsToken(evidenceTextValue, token)) return token;
  }
  return undefined;
}

export function validateMicroEdit(args: {
  original: string;
  edited: string;
  evidence: StarEvidence[];
}): MicroEditValidation {
  const original = args.original.trim();
  const edited = args.edited.trim();
  if (edited.length === 0 || edited === original) return { ok: true };

  const evidenceValue = [original, ...args.evidence.map(evidenceText)].join("\n");
  const number = hasUnsupportedAddition(original, edited, evidenceValue, NUMBER_PATTERN);
  if (number) return { ok: false, reason: "introduces-unsourced-number", routeToGrill: true, token: number };

  const latinEntity = hasUnsupportedAddition(original, edited, evidenceValue, LATIN_ENTITY_PATTERN);
  if (latinEntity) return { ok: false, reason: "introduces-unsourced-entity", routeToGrill: true, token: latinEntity };

  const cjkEntity = hasUnsupportedAddition(original, edited, evidenceValue, CJK_ENTITY_PATTERN);
  if (cjkEntity) return { ok: false, reason: "introduces-unsourced-entity", routeToGrill: true, token: cjkEntity };

  return { ok: true };
}

export function buildMicroEditEvidenceMap(document: ResumeDocument): Record<string, MicroEditEvidence> {
  const map: Record<string, MicroEditEvidence> = {};
  for (const source of [...document.experiences, ...document.projects]) {
    for (const bullet of source.bullets) {
      map[bullet.id] = {
        bulletId: bullet.id,
        original: bullet.text,
        evidence: source.evidence.filter((item) => bullet.sourceEvidenceIds.includes(item.id)),
      };
    }
  }
  for (const bullet of document.summary?.bullets ?? []) {
    map[bullet.id] = { bulletId: bullet.id, original: bullet.text, evidence: [] };
  }
  return map;
}
