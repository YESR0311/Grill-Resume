"use client";

// UI pattern reference: external/JobPilot/src/components/editor/editor-canvas.tsx and preview/editor controls (Apache-2.0). Reimplemented for Grill-Resume LayoutSchema; no code copied.

import { useMemo, useState, useTransition } from "react";
import { HtmlPreviewRenderer } from "@/features/layout/render-html";
import {
  applyLayoutOverrides,
  createDefaultLayoutOverrides,
  orderedLayoutBlocks,
  type LayoutOverrides,
} from "@/features/layout/overrides";
import type { LayoutBlock, LayoutSchema, LayoutTheme } from "@/features/layout/schema";
import { saveLayoutOverridesAction } from "./actions";
import { BlockReorderPanel, blockDisplayLabel } from "./block-reorder";
import type { MicroEditEvidence } from "./grounding";
import { MicroEditPanel } from "./micro-edit";

type EditableBullet = {
  bulletId: string;
  original: string;
  value: string;
  label: string;
};

function withDefined<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

function orderedKeys(schema: LayoutSchema, overrides: LayoutOverrides): string[] {
  return orderedLayoutBlocks(schema, overrides).map((item) => item.key);
}

function moveKey(keys: string[], key: string, direction: -1 | 1): string[] {
  const index = keys.indexOf(key);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= keys.length) return keys;
  const next = [...keys];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function dropKey(keys: string[], key: string, targetKey: string): string[] {
  const from = keys.indexOf(key);
  const to = keys.indexOf(targetKey);
  if (from < 0 || to < 0 || from === to) return keys;
  const next = [...keys];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function bulletBlocks(schema: LayoutSchema): EditableBullet[] {
  const bullets: EditableBullet[] = [];
  for (const block of schema.blocks) {
    if (block.kind !== "profile" && block.kind !== "experience" && block.kind !== "project") continue;
    block.bullets.forEach((bullet, index) => {
      bullets.push({
        bulletId: bullet.bulletId,
        original: bullet.text,
        value: bullet.displayTextOverride ?? bullet.text,
        label: `${blockDisplayLabel(block as LayoutBlock)} #${index + 1}`,
      });
    });
  }
  return bullets;
}

export function LayoutEditor({
  projectId,
  resumeId,
  baseSchema,
  initialOverrides,
  evidenceMap,
}: {
  projectId: string;
  resumeId: string;
  baseSchema: LayoutSchema;
  initialOverrides: LayoutOverrides;
  evidenceMap: Record<string, MicroEditEvidence>;
}) {
  const [overrides, setOverrides] = useState<LayoutOverrides>(() => initialOverrides ?? createDefaultLayoutOverrides(resumeId));
  const [saveMessage, setSaveMessage] = useState("未保存");
  const [isPending, startTransition] = useTransition();
  const effectiveSchema = useMemo(() => applyLayoutOverrides(baseSchema, overrides), [baseSchema, overrides]);
  const blocks = useMemo(() => orderedLayoutBlocks(baseSchema, overrides), [baseSchema, overrides]);
  const editableBullets = useMemo(() => bulletBlocks(effectiveSchema), [effectiveSchema]);

  function updateOverrides(updater: (current: LayoutOverrides) => LayoutOverrides): void {
    setSaveMessage("未保存");
    setOverrides((current) => updater(current));
  }

  function updateTheme<K extends keyof LayoutTheme>(key: K, value: LayoutTheme[K]): void {
    updateOverrides((current) => ({
      ...current,
      theme: {
        ...current.theme,
        [key]: value,
      },
    }));
  }

  function toggleBlock(key: string, hidden: boolean): void {
    updateOverrides((current) => {
      const hiddenBlocks = new Set(current.hiddenBlocks ?? []);
      if (hidden) hiddenBlocks.add(key);
      else hiddenBlocks.delete(key);
      return {
        ...current,
        hiddenBlocks: hiddenBlocks.size > 0 ? [...hiddenBlocks] : undefined,
      };
    });
  }

  function updateBulletOverride(bulletId: string, value: string | undefined): void {
    updateOverrides((current) => {
      const bulletOverrides = { ...(current.bulletOverrides ?? {}) };
      if (typeof value === "string" && value.trim().length > 0) bulletOverrides[bulletId] = value.trim();
      else delete bulletOverrides[bulletId];
      return {
        ...current,
        bulletOverrides: withDefined(bulletOverrides),
      };
    });
  }

  function save(): void {
    startTransition(async () => {
      setSaveMessage("保存中");
      const result = await saveLayoutOverridesAction(projectId, resumeId, overrides);
      if (result.ok) {
        setOverrides(result.overrides);
        setSaveMessage(`已保存 ${new Date(result.overrides.updatedAt ?? Date.now()).toLocaleString("zh-CN")}`);
      } else {
        setSaveMessage(result.message);
      }
    });
  }

  const theme = effectiveSchema.theme;

  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">排版编辑</h2>
              <p className="mt-1 text-xs text-slate-500">{saveMessage}</p>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              保存排版
            </button>
          </div>
        </div>

        <BlockReorderPanel
          blocks={blocks}
          onMove={(key, direction) => updateOverrides((current) => ({ ...current, blockOrder: moveKey(orderedKeys(baseSchema, current), key, direction) }))}
          onDrop={(key, targetKey) => updateOverrides((current) => ({ ...current, blockOrder: dropKey(orderedKeys(baseSchema, current), key, targetKey) }))}
          onToggle={toggleBlock}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-950">主题</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-xs font-medium text-slate-600">
              主题色
              <input
                type="color"
                value={theme.accentColor}
                onChange={(event) => updateTheme("accentColor", event.currentTarget.value)}
                className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-2"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              中文字体
              <input
                value={theme.fontCJK}
                onChange={(event) => updateTheme("fontCJK", event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              字号 pt
              <input
                type="number"
                min="8"
                max="14"
                step="0.5"
                value={theme.baseFontPt}
                onChange={(event) => updateTheme("baseFontPt", Number(event.currentTarget.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              行距
              <input
                type="number"
                min="1"
                max="1.6"
                step="0.05"
                value={theme.lineSpacing}
                onChange={(event) => updateTheme("lineSpacing", Number(event.currentTarget.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <MicroEditPanel
          bullets={editableBullets}
          evidenceMap={evidenceMap}
          grillHref={`/projects/${projectId}/coach`}
          onChange={updateBulletOverride}
        />
      </div>

      <div className="min-w-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
        <div className="origin-top-left scale-[0.62] sm:scale-[0.72] lg:scale-[0.82] xl:scale-[0.72] 2xl:scale-[0.86]">
          <HtmlPreviewRenderer schema={effectiveSchema} />
        </div>
      </div>
    </section>
  );
}
