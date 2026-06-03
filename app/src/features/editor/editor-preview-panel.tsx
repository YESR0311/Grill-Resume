"use client";

// UI skeleton reference: external/JobPilot/src/components/editor/editor-preview-panel.tsx (Apache-2.0). Reimplemented over HtmlPreviewRenderer; no code copied.

import { useState } from "react";
import { HtmlPreviewRenderer } from "@/features/layout/render-html";
import type { LayoutSchema } from "@/features/layout/schema";

export function EditorPreviewPanel({ schema }: { schema: LayoutSchema }) {
  const [zoom, setZoom] = useState(80);
  const scale = zoom / 100;

  return (
    <section className="flex min-w-0 flex-[6] flex-col border-l border-slate-200 bg-slate-100">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(40, value - 10))}
            disabled={zoom <= 40}
            className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-300"
            aria-label="缩小预览"
          >
            -
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-slate-500">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(130, value + 10))}
            disabled={zoom >= 130}
            className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-300"
            aria-label="放大预览"
          >
            +
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto" style={{ width: "210mm" }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
            <HtmlPreviewRenderer schema={schema} />
          </div>
        </div>
      </div>
    </section>
  );
}
