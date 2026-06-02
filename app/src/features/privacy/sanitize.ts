import { isOutboundAllowedField } from "./whitelist";

export type OutboundScope =
  | { kind: "tavily-search"; provider: "tavily"; reason: string; endpoint?: string }
  | { kind: "ai-polish"; provider: string; reason: string; endpoint?: string }
  | { kind: "ai-extract"; provider: string; reason: string; endpoint?: string }
  | { kind: "ai-clarify"; provider: string; reason: string; endpoint?: string }
  | { kind: "ai-research"; provider: string; reason: string; endpoint?: string }
  | { kind: "ai-bullet-draft"; provider: string; reason: string; endpoint?: string }
  | { kind: "docx-export"; provider: "local"; reason: string; endpoint?: string };

export type SanitizedPayload = {
  scope: OutboundScope;
  payload: Record<string, unknown>;
  removedFields: string[];
  preview: string;
};

function sanitizeValue(value: unknown, path: string, removedFields: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`, removedFields)).filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") return value;

  const entries: [string, unknown][] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (!isOutboundAllowedField(key)) {
      removedFields.push(nextPath);
      continue;
    }
    const sanitized = sanitizeValue(nested, nextPath, removedFields);
    if (sanitized !== undefined) entries.push([key, sanitized]);
  }
  return Object.fromEntries(entries);
}

export function sanitizeOutboundPayload(payload: Record<string, unknown>, scope: OutboundScope): SanitizedPayload {
  const removedFields: string[] = [];
  const sanitized = sanitizeValue(payload, "", removedFields);
  const safePayload = sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? (sanitized as Record<string, unknown>) : {};
  return {
    scope,
    payload: safePayload,
    removedFields,
    preview: JSON.stringify(safePayload, null, 2),
  };
}
