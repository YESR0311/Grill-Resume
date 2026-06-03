"use client";

// UI skeleton reference: external/JobPilot/src/components/editor/editor-toolbar.tsx (Apache-2.0). Reimplemented over LayoutSchema; no code copied.

import Link from "next/link";

export type EditorSaveState = "dirty" | "saving" | "saved" | "error";

export function EditorToolbar({
  title,
  saveState,
  saveMessage,
  canUndo,
  canRedo,
  isSaving,
  showThemeEditor,
  projectHref,
  scoreHref,
  exportHref,
  onUndo,
  onRedo,
  onSave,
  onToggleTheme,
}: {
  title: string;
  saveState: EditorSaveState;
  saveMessage: string;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  showThemeEditor: boolean;
  projectHref: string;
  scoreHref: string;
  exportHref: string;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onToggleTheme: () => void;
}) {
  const statusClass =
    saveState === "error"
      ? "text-rose-600"
      : saveState === "saved"
        ? "text-emerald-700"
        : "text-slate-500";

  return (
    <header className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link href={projectHref} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950" aria-label="返回项目">
          ←
        </Link>
        <div className="min-w-0 border-l border-slate-200 pl-3">
          <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
          <p className={`truncate text-xs ${statusClass}`}>{saveMessage}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-300"
          title="撤销"
          aria-label="撤销"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-300"
          title="重做"
          aria-label="重做"
        >
          ↷
        </button>
        <span className="mx-1 h-6 border-l border-slate-200" aria-hidden="true" />
        <Link href={scoreHref} className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 sm:inline-flex">
          评分
        </Link>
        <Link href={exportHref} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950">
          导出
        </Link>
        <button
          type="button"
          onClick={onToggleTheme}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            showThemeEditor ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          主题
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-lg bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? "保存中" : "保存"}
        </button>
      </div>
    </header>
  );
}
