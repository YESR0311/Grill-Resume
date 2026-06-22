"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft, User, SkipForward, CheckCircle2, LogOut } from "lucide-react";
import type { PersonProfile } from "@/features/profile/types";
import { INTAKE_DIMENSIONS, INTAKE_DIMENSION_LABELS } from "@/features/intake/constants";
import { Button } from "@/components/ui/button";

/**
 * 可收纳左侧栏——问答页除对话框外的唯一元素。
 * 展示基本信息、问答进度，并提供「跳过/结束/退出」控制（design §3.2）。
 * 结束问答 / 跳转时机由用户主动决定，AI 不代劳。
 */
export function IntakeSidebar({
  profile,
  pendingEnd = false,
  endDisabled = false,
  endDisabledHint,
  onSkip,
  onEnd,
  onExit,
}: {
  profile: PersonProfile;
  pendingEnd?: boolean;
  /** 出口（跳过/结束）禁用：首页建档前 profileId 尚不存在时为 true（P1-b）。 */
  endDisabled?: boolean;
  /** 禁用时的提示文案。 */
  endDisabledHint?: string;
  onSkip?: () => void;
  onEnd?: () => void;
  onExit?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex h-full w-10 items-start justify-center border-r border-border pt-4 hover:bg-muted/50"
        title="展开侧栏"
      >
        <PanelLeft size={18} className="text-muted-foreground" />
      </button>
    );
  }

  const covered = new Set(profile.intakeStatus.coveredDimensions);

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-background">
      {/* 头 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User size={16} />
          <span className="truncate">{profile.name || "新档案"}</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded-md p-1 hover:bg-muted"
          title="收起侧栏"
        >
          <PanelLeftClose size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* 进度 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">问答进度</p>
        <div className="space-y-3">
          {INTAKE_DIMENSIONS.map((dim) => {
            const done = covered.has(dim);
            const labels = INTAKE_DIMENSION_LABELS;
            return (
              <div key={dim} className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full shadow-sm ${
                    done
                      ? "bg-status-confirmed shadow-status-confirmed/30"
                      : "bg-muted-foreground/30"
                  } ${done ? "" : "opacity-40"}`}
                  title={done ? "已完成" : "未完成"}
                />
                <span
                  className={`text-sm ${
                    done ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {labels[dim] ?? dim}
                </span>
              </div>
            );
          })}
        </div>

        {pendingEnd ? (
          <p className="mt-4 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            正在输入中，提交后将自动前往档案编辑…
          </p>
        ) : null}

        {endDisabled && endDisabledHint ? (
          <p className="mt-4 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            {endDisabledHint}
          </p>
        ) : null}
      </div>

      {/* 控制区：用户主动决定何时结束 */}
      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start"
          onClick={onSkip}
          disabled={endDisabled}
        >
          <SkipForward size={15} />
          跳过当前问题
        </Button>
        <Button
          size="lg"
          className="w-full justify-start"
          onClick={onEnd}
          disabled={endDisabled}
        >
          <CheckCircle2 size={15} />
          结束问答
        </Button>
        <Button variant="ghost" size="lg" className="w-full justify-start" onClick={onExit}>
          <LogOut size={15} />
          退出
        </Button>
      </div>
    </aside>
  );
}
