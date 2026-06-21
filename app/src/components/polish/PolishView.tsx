"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { runPolishAction, getDraftAction } from "@/app/polish/[id]/actions";
import type { ResumeDraft } from "@/features/polish/types";
import { ResumeStyleSchema } from "@/features/polish/types";
import { getTemplateStyle, DEFAULT_TEMPLATE_ID } from "@/features/polish/templates";
import { DraftProvider } from "./DraftProvider";
import { ActiveEditorContext } from "./active-editor";
import { TemplateSelector } from "./TemplateSelector";
import { StructuredEditor } from "./StructuredEditor";
import { StyleControls } from "./StyleControls";
import { ExportPanel } from "./ExportPanel";
import type { Editor } from "@tiptap/react";

/**
 * PolishView orchestrator（design §5.3）。
 * 加载/生成草稿 → DraftProvider 包裹编辑器组件树（TemplateSelector + StructuredEditor + StyleControls + ExportPanel）。
 */

type PageState =
  | { status: "loading" }
  | { status: "generating" }
  | { status: "done"; draft: ResumeDraft }
  | { status: "error"; error: string };

/** 老草稿可能缺 templateId/style 字段，补全默认值。 */
function ensureStyle(draft: ResumeDraft): ResumeDraft {
  const templateId = draft.templateId || DEFAULT_TEMPLATE_ID;
  const style = draft.style ? ResumeStyleSchema.parse(draft.style) : getTemplateStyle(templateId);
  return { ...draft, templateId, style };
}

export function PolishView({ profileId }: { profileId: string }) {
  const [state, setState] = useState<PageState>({ status: "loading" });

  const generate = useCallback(async () => {
    setState({ status: "generating" });
    const result = await runPolishAction(profileId);
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    const draft = await getDraftAction(profileId);
    if (draft) setState({ status: "done", draft: ensureStyle(draft) });
    else setState({ status: "error", error: "草稿未生成" });
  }, [profileId]);

  useEffect(() => {
    getDraftAction(profileId).then((draft) => {
      if (draft) setState({ status: "done", draft: ensureStyle(draft) });
      else generate();
    });
  }, [generate, profileId]);

  if (state.status === "loading" || state.status === "generating") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {state.status === "generating" ? "正在综合档案与评估报告生成简历草稿…" : "加载中…"}
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24">
        <AlertCircle size={32} className="text-status-failed" />
        <p className="text-sm text-status-failed">{state.error}</p>
        <button
          onClick={generate}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          重试
        </button>
      </div>
    );
  }

  return <Workbench draft={state.draft} />;
}

function Workbench({ draft }: { draft: ResumeDraft }) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  return (
    <ActiveEditorContext.Provider value={{ editor: activeEditor, setEditor: setActiveEditor }}>
      <DraftProvider initialDraft={draft}>
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <h1 className="text-xl font-semibold">简历编辑器</h1>
            <div className="flex items-center gap-2">
              <StyleControls />
              <ExportPanel />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            <aside className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">选择模板</h2>
              <TemplateSelector />
            </aside>
            <div>
              <StructuredEditor />
            </div>
          </div>
        </div>
      </DraftProvider>
    </ActiveEditorContext.Provider>
  );
}
