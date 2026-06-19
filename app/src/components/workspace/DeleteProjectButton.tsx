"use client";

import { useTransition } from "react";
import { deleteProjectAction } from "@/features/resume/actions";
import { cn } from "@/lib/utils";

export type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
  /** 是否为当前工作区正在打开的项目；删除后决定是否跳回首页。 */
  isCurrent?: boolean;
  className?: string;
};

/**
 * 项目删除按钮：原生 confirm 二次确认后调用 server action。
 * 不可逆操作，文案明确告知。
 */
export function DeleteProjectButton({
  projectId,
  projectName,
  isCurrent = false,
  className,
}: DeleteProjectButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`删除项目 ${projectName}`}
      title="删除项目"
      onClick={() => {
        if (pending) return;
        const ok = window.confirm(
          `删除项目「${projectName}」？\n该项目的全部简历、会话记录与导出文件将被永久删除，无法恢复。`,
        );
        if (!ok) return;
        startTransition(() => {
          void deleteProjectAction(projectId, isCurrent);
        });
      }}
      className={cn(
        "shrink-0 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50",
        className,
      )}
    >
      {pending ? "…" : "×"}
    </button>
  );
}
