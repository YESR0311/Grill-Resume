export const OUTBOUND_ALLOWED_FIELDS = {
  common: ["id", "text", "title", "role", "organization", "skills", "techStack", "goal", "scope", "reason", "request", "prompt", "task", "requiredShape", "context", "kind", "source", "sourceLabel", "sourceUrl", "citations", "url", "snippet", "retrievedAt"],
  resume: ["targetRole", "jdText", "keywords", "bulletText", "projectHighlights", "firstExperience", "firstBullet"],
  evidence: ["context", "task", "actions", "results", "metric", "confidence", "sourceText"],
  provider: ["model", "endpoint", "provider"],
} as const;

const allowedFieldSet = new Set<string>(Object.values(OUTBOUND_ALLOWED_FIELDS).flat());

export function isOutboundAllowedField(field: string): boolean {
  return allowedFieldSet.has(field);
}
