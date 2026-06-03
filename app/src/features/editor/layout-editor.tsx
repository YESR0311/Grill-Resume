"use client";

// UI skeleton reference: external/JobPilot/src/components/editor/{editor-toolbar,editor-sidebar,editor-canvas,editor-preview-panel,theme-editor}.tsx (Apache-2.0). Reimplemented for Grill-Resume LayoutSchema; no code copied.

import { useMemo, useState, useTransition } from "react";
import {
  applyLayoutOverrides,
  createDefaultLayoutOverrides,
  orderedLayoutBlocks,
  type LayoutOverrides,
} from "@/features/layout/overrides";
import type { LayoutBlock, LayoutSchema, LayoutTheme } from "@/features/layout/schema";
import { saveLayoutOverridesAction } from "./actions";
import { BlockReorderPanel, blockDisplayLabel } from "./block-reorder";
import { EditorPreviewPanel } from "./editor-preview-panel";
import { EditorSidebar } from "./editor-sidebar";
import { EditorToolbar, type EditorSaveState } from "./editor-toolbar";
import type { MicroEditEvidence } from "./grounding";
import { MicroEditPanel } from "./micro-edit";
import { ThemeEditor } from "./theme-editor";

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

function cleanThemeValue<K extends keyof LayoutTheme>(key: K, value: LayoutTheme[K]): LayoutTheme[K] {
  if (key === "baseFontPt" && typeof value === "number") return Math.min(14, Math.max(8, value)) as LayoutTheme[K];
  if (key === "lineSpacing" && typeof value === "number") return Math.min(1.6, Math.max(1, value)) as LayoutTheme[K];
  return value;
}

export function LayoutEditor({
  projectId,
  resumeId,
  title,
  baseSchema,
  initialOverrides,
  evidenceMap,
}: {
  projectId: string;
  resumeId: string;
  title: string;
  baseSchema: LayoutSchema;
  initialOverrides: LayoutOverrides;
  evidenceMap: Record<string, MicroEditEvidence>;
}) {
  const [overrides, setOverrides] = useState<LayoutOverrides>(() => initialOverrides ?? createDefaultLayoutOverrides(resumeId));
  const [history, setHistory] = useState<LayoutOverrides[]>([]);
  const [redoStack, setRedoStack] = useState<LayoutOverrides[]>([]);
  const [saveState, setSaveState] = useState<EditorSaveState>("dirty");
  const [saveMessage, setSaveMessage] = useState("未保存");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [isPending, startTransition] = useTransition();
  const effectiveSchema = useMemo(() => applyLayoutOverrides(baseSchema, overrides), [baseSchema, overrides]);
  const blocks = useMemo(() => orderedLayoutBlocks(baseSchema, overrides), [baseSchema, overrides]);
  const editableBullets = useMemo(() => bulletBlocks(effectiveSchema), [effectiveSchema]);
  const theme = effectiveSchema.theme;

  function updateOverrides(updater: (current: LayoutOverrides) => LayoutOverrides): void {
    setHistory((current) => [...current.slice(-19), overrides]);
    setRedoStack([]);
    setSaveState("dirty");
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

  function resetTheme(): void {
    updateOverrides((current) => {
      const next: LayoutOverrides = { ...current };
      delete next.theme;
      return next;
    });
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
      setSaveState("saving");
      setSaveMessage("保存中");
      const result = await saveLayoutOverridesAction(projectId, resumeId, overrides);
      if (result.ok) {
        setOverrides(result.overrides);
        setSaveState("saved");
        setSaveMessage(`已保存 ${new Date(result.overrides.updatedAt ?? Date.now()).toLocaleString("zh-CN")}`);
      } else {
        setSaveState("error");
        setSaveMessage(result.message);
      }
    });
  }

  function undo(): void {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, overrides]);
    setOverrides(previous);
    setSaveState("dirty");
    setSaveMessage("未保存");
  }

  function redo(): void {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((current) => current.slice(0, -1));
    setHistory((current) => [...current.slice(-19), overrides]);
    setOverrides(next);
    setSaveState("dirty");
    setSaveMessage("未保存");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <EditorToolbar
        title={title}
        saveState={saveState}
        saveMessage={saveMessage}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
        isSaving={isPending}
        showThemeEditor={showThemeEditor}
        projectHref={`/projects/${projectId}`}
        scoreHref={`/projects/${projectId}/resumes/${resumeId}/score`}
        exportHref={`/projects/${projectId}/resumes/${resumeId}/export`}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        onToggleTheme={() => setShowThemeEditor((current) => !current)}
      />

      <div className="flex min-h-[760px]">
        <EditorSidebar
          blocks={blocks}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onToggle={toggleBlock}
          onDrop={(key, targetKey) => updateOverrides((current) => ({ ...current, blockOrder: dropKey(orderedKeys(baseSchema, current), key, targetKey) }))}
        />

        <section className="flex min-w-0 flex-[4] flex-col bg-slate-50">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Canvas</p>
            <p className="text-xs text-slate-500">只改排版和措辞微调；新增事实回 grill 补证据</p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <BlockReorderPanel
              blocks={blocks}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onMove={(key, direction) => updateOverrides((current) => ({ ...current, blockOrder: moveKey(orderedKeys(baseSchema, current), key, direction) }))}
              onDrop={(key, targetKey) => updateOverrides((current) => ({ ...current, blockOrder: dropKey(orderedKeys(baseSchema, current), key, targetKey) }))}
              onToggle={toggleBlock}
            />

            <MicroEditPanel
              bullets={editableBullets}
              evidenceMap={evidenceMap}
              grillHref={`/projects/${projectId}/coach`}
              onChange={updateBulletOverride}
            />
          </div>
        </section>

        <EditorPreviewPanel schema={effectiveSchema} />

        {showThemeEditor ? (
          <ThemeEditor
            theme={theme}
            onThemeChange={(key, value) => updateTheme(key, cleanThemeValue(key, value))}
            onReset={resetTheme}
          />
        ) : null}
      </div>
    </section>
  );
}
