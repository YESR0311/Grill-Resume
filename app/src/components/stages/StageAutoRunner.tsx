"use client";

import { useEffect, useRef, useTransition } from "react";
import { runEvaluationInWorkspace, runPolishInWorkspace } from "@/app/w/[projectId]/[resumeId]/actions";

/**
 * 阶段自动执行触发器。进入 evaluate/polish 的 in_progress 态时 mount 即调用对应
 * 执行 action（接线：advanceSessionToNext 只翻状态，AI 执行由此触发）。
 * 渲染 null —— 加载 UI 由父视图的 spinner/skeleton 负责。
 * 幂等由 server action 的 status guard 兜底（执行完 status 变更后再调即 skip）。
 */
export function StageAutoRunner({
  projectId,
  resumeId,
  kind,
}: {
  projectId: string;
  resumeId: string;
  kind: "evaluate" | "polish";
}) {
  const [, startTransition] = useTransition();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const run = kind === "evaluate" ? runEvaluationInWorkspace : runPolishInWorkspace;
    startTransition(() => {
      void run(projectId, resumeId);
    });
  }, [projectId, resumeId, kind, startTransition]);
  return null;
}
