import type { ReactNode } from "react";

export type ContextPanelProps = {
  title: string;
  /** 面板主体（证据图 / 报告 / 预览，M2+ 填充）。 */
  children?: ReactNode;
  /** 空态文案。 */
  emptyHint?: string;
};

/**
 * 右侧上下文面板。M1 仅骨架（标题 + 内容槽 + 空态）。
 * 窄屏折叠为抽屉的逻辑在 M3 接入 Sheet；M1 先固定列。
 */
export function ContextPanel({ title, children, emptyHint }: ContextPanelProps) {
  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-border bg-card xl:flex">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
        {children ?? (
          <p className="text-muted-foreground">{emptyHint ?? "暂无内容"}</p>
        )}
      </div>
    </aside>
  );
}
