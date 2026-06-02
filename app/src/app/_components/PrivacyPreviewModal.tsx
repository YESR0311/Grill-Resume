"use client";

import type { PreviewToken } from "@/features/privacy/preview";

export function PrivacyPreviewModal(props: {
  token: PreviewToken;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Privacy preview</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{props.token.actionLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">{props.token.sanitized.scope.kind} · {props.token.createdAt}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {props.token.sanitized.scope.provider}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <section>
            <p className="text-sm font-medium text-slate-800">Endpoint</p>
            <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{props.token.sanitized.scope.endpoint ?? "local preview"}</p>
          </section>

          <section>
            <p className="text-sm font-medium text-slate-800">Sanitized payload</p>
            <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{props.token.sanitized.preview}</pre>
            {props.token.sanitized.removedFields.length > 0 ? (
              <p className="mt-2 text-xs text-amber-700">Removed fields: {props.token.sanitized.removedFields.join(", ")}</p>
            ) : null}
          </section>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            confirm
          </button>
        </div>
      </div>
    </div>
  );
}
