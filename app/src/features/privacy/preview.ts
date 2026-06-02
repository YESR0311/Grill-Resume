import { sanitizeOutboundPayload, type OutboundScope, type SanitizedPayload } from "./sanitize";

export type PreviewToken = {
  id: string;
  createdAt: string;
  actionLabel: string;
  sanitized: SanitizedPayload;
};

export function createPrivacyPreviewToken(input: {
  actionLabel: string;
  payload: Record<string, unknown>;
  scope: OutboundScope;
}): PreviewToken {
  return {
    id: `${input.scope.kind}:${Date.now()}`,
    createdAt: new Date().toISOString(),
    actionLabel: input.actionLabel,
    sanitized: sanitizeOutboundPayload(input.payload, input.scope),
  };
}
