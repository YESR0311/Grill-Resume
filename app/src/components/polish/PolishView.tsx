"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, FileDown } from "lucide-react";
import { runPolishAction, getDraftAction, exportDocxAction } from "@/app/polish/[id]/actions";
import type { ResumeDraft } from "@/features/polish/types";

type PageState =
  | { status: "loading" }
  | { status: "generating" }
  | { status: "done"; draft: ResumeDraft }
  | { status: "error"; error: string }
  | { status: "exporting"; draft: ResumeDraft };

export function PolishView({ profileId }: { profileId: string }) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [exportError, setExportError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setState({ status: "generating" });
    const result = await runPolishAction(profileId);
    if (!result.ok) {
      setState({ status: "error", error: result.error ?? "润色失败" });
      return;
    }
    const draft = await getDraftAction(profileId);
    if (draft) {
      setState({ status: "done", draft });
    } else {
      setState({ status: "error", error: "草稿未生成" });
    }
  }, [profileId]);

  useEffect(() => {
    getDraftAction(profileId).then((draft) => {
      if (draft) setState({ status: "done", draft });
      else generate();
    });
  }, [generate, profileId]);

  const handleExport = async () => {
    if (state.status !== "done") return;
    setExportError(null);
    setState({ status: "exporting", draft: state.draft });
    const result = await exportDocxAction(profileId);
    if (result.ok && result.buffer) {
      const blob = new Blob([new Uint8Array(result.buffer)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `简历-${profileId.slice(0, 6)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setExportError(result.error ?? "导出失败");
    }
    setState((prev) => (prev.status === "exporting" ? { status: "done", draft: prev.draft } : prev));
  };

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
        <button onClick={generate} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          重试
        </button>
      </div>
    );
  }

  if (state.status === "exporting") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在导出 Word 文档…</p>
      </div>
    );
  }

  const draft = state.draft;
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-semibold">简历草稿</h1>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <FileDown size={15} />
            导出 Word
          </button>
          {exportError && <p className="text-xs text-status-failed">{exportError}</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">{draft.name}</h2>
          <p className="text-sm text-muted-foreground">{draft.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[draft.email, draft.phone].filter(Boolean).join(" · ")}
          </p>
        </div>

        {draft.summary && (
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">个人简介</h3>
            <p className="text-sm leading-6 text-foreground">{draft.summary}</p>
          </section>
        )}

        {draft.workExperience.items.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {draft.workExperience.title}
            </h3>
            {draft.workExperience.items.map((item, i) => (
              <div key={item.id || i} className="mb-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {item.role} @ {item.organization}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.startDate} - {item.endDate}
                  </p>
                </div>
                <ul className="mt-1 list-disc pl-4 text-sm leading-6 text-muted-foreground">
                  {item.bullets.map((b, bi) => (
                    <li key={bi}>{b.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {draft.projects.items.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {draft.projects.title}
            </h3>
            {draft.projects.items.map((item, i) => (
              <div key={item.id || i} className="mb-4">
                <p className="text-sm font-medium text-foreground">
                  {item.organization || item.role}
                </p>
                <ul className="mt-1 list-disc pl-4 text-sm leading-6 text-muted-foreground">
                  {item.bullets.map((b, bi) => (
                    <li key={bi}>{b.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {draft.education.items.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {draft.education.title}
            </h3>
            {draft.education.items.map((item, i) => (
              <p key={i} className="text-sm text-foreground">
                {item.organization} — {item.role}（{item.startDate} - {item.endDate}）
              </p>
            ))}
          </section>
        )}

        {draft.skills.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">技能</h3>
            <div className="flex flex-wrap gap-2">
              {draft.skills.map((sk, i) => (
                <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                  {sk}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}