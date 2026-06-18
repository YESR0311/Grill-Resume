"use client";

// UI skeleton reference: external/JobPilot/src/components/editor/theme-editor.tsx (Apache-2.0). Reimplemented over LayoutTheme; no code copied.

import type { LayoutTheme } from "@/features/layout/schema";
import { layoutThemePresets, type LayoutThemePreset } from "@/features/layout/themes";
import { summarizeThemePreset } from "./theme-preset-view";

export function ThemeEditor({
  theme,
  onThemeChange,
  onApplyPreset,
  onReset,
}: {
  theme: LayoutTheme;
  onThemeChange: <K extends keyof LayoutTheme>(key: K, value: LayoutTheme[K]) => void;
  onApplyPreset: (preset: LayoutThemePreset) => void;
  onReset: () => void;
}) {
  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Theme</p>
      </div>
      <div className="max-h-[calc(100vh-10rem)] space-y-5 overflow-y-auto p-4">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">预设</h3>
            <button type="button" onClick={onReset} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              重置
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {layoutThemePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="flex flex-col gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-slate-400"
              >
                <span className="font-medium text-slate-700">{preset.label}</span>
                <span className="flex flex-wrap gap-1">
                  {summarizeThemePreset(preset).map((chip, index) => (
                    <span key={`${chip}-${index}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      {chip}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-400">预设仅套用字体/字号/行距；页边距暂未接入导出。</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">颜色</h3>
          <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
            主题色
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={theme.accentColor}
                onChange={(event) => onThemeChange("accentColor", event.currentTarget.value)}
                className="size-8 rounded-lg border border-slate-200 bg-white p-1"
              />
              <input
                value={theme.accentColor}
                onChange={(event) => onThemeChange("accentColor", event.currentTarget.value)}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs"
              />
            </span>
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">字体</h3>
          <label className="block text-xs font-medium text-slate-600">
            中文字体
            <input
              value={theme.fontCJK}
              onChange={(event) => onThemeChange("fontCJK", event.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            拉丁字体
            <input
              value={theme.fontLatin}
              onChange={(event) => onThemeChange("fontLatin", event.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            字号 pt
            <input
              type="number"
              min="8"
              max="14"
              step="0.5"
              value={theme.baseFontPt}
              onChange={(event) => onThemeChange("baseFontPt", Number(event.currentTarget.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            行距
            <input
              type="range"
              min="1"
              max="1.6"
              step="0.05"
              value={theme.lineSpacing}
              onChange={(event) => onThemeChange("lineSpacing", Number(event.currentTarget.value))}
              className="mt-2 w-full"
            />
            <span className="mt-1 block text-right text-xs tabular-nums text-slate-400">{theme.lineSpacing.toFixed(2)}</span>
          </label>
        </section>
      </div>
    </aside>
  );
}
