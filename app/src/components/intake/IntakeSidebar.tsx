"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft, User } from "lucide-react";
import type { PersonProfile } from "@/features/profile/types";
import { INTAKE_DIMENSIONS, INTAKE_DIMENSION_LABELS } from "@/features/intake/constants";

/**
 * 可收纳左侧栏——问答页唯一除对话框外的元素。
 * 展示基本信息与问答进度，可折叠以腾出更多空间。
 */
export function IntakeSidebar({ profile }: { profile: PersonProfile }) {
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
        <div className="space-y-2">
          {INTAKE_DIMENSIONS.map((dim) => {
            const done = covered.has(dim);
            const labels = INTAKE_DIMENSION_LABELS;
            return (
              <div key={dim} className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    done ? "bg-status-confirmed" : "bg-muted-foreground/30"
                  }`}
                />
                <span
                  className={`text-xs ${
                    done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {labels[dim] ?? dim}
                </span>
              </div>
            );
          })}
        </div>

        {profile.intakeStatus.phase === "ready" ? (
          <p className="mt-4 rounded-lg bg-status-confirmed/10 px-2.5 py-1.5 text-xs text-status-confirmed">
            所有维度已覆盖，即将跳转档案编辑页…
          </p>
        ) : null}
      </div>
    </aside>
  );
}