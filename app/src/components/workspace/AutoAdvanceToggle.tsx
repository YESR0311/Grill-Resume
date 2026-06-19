"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleAutoAdvanceInWorkspace } from "@/app/w/[projectId]/[resumeId]/actions";

/**
 * 「自动联网与推进」开关 = 项目级一次同意（阶段②自动化边界）。
 * 开启：计算阶段（问答→评估→润色）自动外发并推进，无需每步点击。
 * 关闭：回退逐步手动确认（每次点击即单次同意）。
 * 文案明确标记「可随时关」，已发出的外发不可撤销但关闭可阻止后续阶段。
 */
export function AutoAdvanceToggle({
  projectId,
  resumeId,
  enabled,
}: {
  projectId: string;
  resumeId: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onToggle() {
    startTransition(() => {
      void toggleAutoAdvanceInWorkspace(projectId, resumeId, !enabled);
    });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={enabled}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-colors active:scale-[0.99] disabled:opacity-60",
        enabled
          ? "border-primary/40 bg-primary/5 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-background transition-transform",
            enabled ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="leading-4">
        <span className="font-medium text-foreground">自动联网与推进</span>
        <span className="ml-1.5">
          {enabled ? "已开 · 计算阶段自动推进，可随时关" : "已关 · 逐步手动确认"}
        </span>
      </span>
    </button>
  );
}
