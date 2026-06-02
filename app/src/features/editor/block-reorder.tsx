// UI pattern reference: external/JobPilot/src/components/editor/editor-canvas.tsx (Apache-2.0). Reimplemented over LayoutSchema with native drag/drop; no code copied.

import { useState } from "react";
import type { KeyedLayoutBlock } from "@/features/layout/overrides";
import type { LayoutBlock } from "@/features/layout/schema";

function blockLabel(block: LayoutBlock): string {
  if (block.kind === "header") return "页眉";
  if (block.kind === "section-title") return block.zh;
  if (block.kind === "profile") return "个人优势";
  if (block.kind === "experience") return [block.org, block.role].filter(Boolean).join(" · ");
  if (block.kind === "project") return [block.name, block.role].filter(Boolean).join(" · ");
  if (block.kind === "education") return [block.org, block.degree].filter(Boolean).join(" · ");
  return "技能证书";
}

export function blockDisplayLabel(block: LayoutBlock): string {
  return blockLabel(block);
}

export function BlockReorderPanel({
  blocks,
  onMove,
  onDrop,
  onToggle,
}: {
  blocks: KeyedLayoutBlock[];
  onMove: (key: string, direction: -1 | 1) => void;
  onDrop: (key: string, targetKey: string) => void;
  onToggle: (key: string, hidden: boolean) => void;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">模块顺序</h2>
        <span className="text-xs text-slate-500">{blocks.filter((item) => !item.hidden).length} / {blocks.length}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {blocks.map((item, index) => (
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
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              item.hidden ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 bg-white text-slate-800"
            }`}
          >
            <span className="w-5 cursor-grab text-center text-slate-400" aria-hidden="true">::</span>
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={!item.hidden}
                onChange={(event) => onToggle(item.key, !event.currentTarget.checked)}
                className="size-4 rounded border-slate-300"
              />
              <span className="truncate">{blockLabel(item.block)}</span>
            </label>
            <button
              type="button"
              aria-label={`上移 ${blockLabel(item.block)}`}
              disabled={index === 0}
              onClick={() => onMove(item.key, -1)}
              className="size-8 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`下移 ${blockLabel(item.block)}`}
              disabled={index === blocks.length - 1}
              onClick={() => onMove(item.key, 1)}
              className="size-8 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
