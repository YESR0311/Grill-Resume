"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  autoAdvanceStepInWorkspace,
  toggleAutoAdvanceInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { Button } from "@/components/ui/button";

/**
 * 自动推进倒计时器（阶段②「自动应用 + 可撤销」的真义）。
 * autoAdvance 开启且当前计算阶段 awaiting_user 时挂载：给用户一个可见窗口
 * 看一眼结果（问答门 / 评估报告），倒计时结束后自动 advance 到下一阶段；
 * 「暂停」= 关闭 autoAdvance，停在当前阶段转为逐步手动确认。
 *
 * 已发出的外发不可撤销，但暂停可阻止下一阶段外发——文案如实说明。
 */
export function AutoAdvanceRunner({
  projectId,
  resumeId,
  nextLabel,
  delayMs = 4000,
}: {
  projectId: string;
  resumeId: string;
  /** 下一步去向短文案，如「润色」。 */
  nextLabel: string;
  delayMs?: number;
}) {
  const [, startTransition] = useTransition();
  const [remaining, setRemaining] = useState(Math.ceil(delayMs / 1000));
  const fired = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    const timer = setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      startTransition(() => {
        void autoAdvanceStepInWorkspace(projectId, resumeId);
      });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [projectId, resumeId, delayMs, startTransition]);

  function pause() {
    fired.current = true; // 阻止已排队的自动触发
    startTransition(() => {
      void toggleAutoAdvanceInWorkspace(projectId, resumeId, false);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-xs">
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{remaining} 秒</span>
        后自动进入{nextLabel}…
      </span>
      <Button type="button" variant="outline" size="sm" onClick={pause}>
        暂停（转逐步确认）
      </Button>
    </div>
  );
}
