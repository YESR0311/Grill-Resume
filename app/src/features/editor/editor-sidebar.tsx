"use client";

// UI skeleton reference: external/JobPilot/src/components/editor/editor-sidebar.tsx (Apache-2.0). Reimplemented over LayoutSchema with native drag/drop; no code copied.

import { useState } from "react";
import type { KeyedLayoutBlock } from "@/features/layout/overrides";
import { blockDisplayLabel } from "./block-reorder";

function blockIcon(kind: KeyedLayoutBlock["block"]["kind"]): string {
  if (kind === "header") return "◎";
  if (kind === "section-title") return "§";
  if (kind === "profile") return "¶";
  if (kind === "experience") return "▣";
  if (kind === "project") return "◇";
  if (kind === "education") return "△";
  return "□";
}

export function EditorSidebar({
  blocks,
  selectedKey,
  onSelect,
  onToggle,
  onDrop,
}: {
  blocks: KeyedLayoutBlock[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onToggle: (key: string, hidden: boolean) => void;
  onDrop: (key: string, targetKey: string) => void;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sections</p>
      </div>
      <nav className="max-h-[calc(100vh-10rem)] overflow-y-auto px-2 py-2">
        <ul className="space-y-1">
          {blocks.map((item) => {
            const label = blockDisplayLabel(item.block) || item.key;
            const selected = selectedKey === item.key;
            return (
              <li
                key={item.key}
                draggable
                onDragStart={() => setDraggedKey(item.key)}
                onDragEnd={() => setDraggedKey(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedKey && draggedKey !== item.key) onDrop(draggedKey, item.key);
                  setDraggedKey(null);
                }}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  selected ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                } ${item.hidden ? "opacity-50" : ""}`}
              >
                <span className="cursor-grab text-xs text-slate-300 group-active:cursor-grabbing" aria-hidden="true">☰</span>
                <button type="button" onClick={() => onSelect(item.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="w-4 shrink-0 text-center text-xs text-slate-400" aria-hidden="true">{blockIcon(item.block.kind)}</span>
                  <span className="truncate">{label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(item.key, !item.hidden)}
                  className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-white hover:text-slate-700 group-hover:inline-flex"
                  aria-label={item.hidden ? `显示 ${label}` : `隐藏 ${label}`}
                  title={item.hidden ? "显示" : "隐藏"}
                >
                  {item.hidden ? "□" : "■"}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
