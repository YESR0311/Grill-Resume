import type { WorkspaceView } from "@/lib/workspace-view";

const VIEW_TITLES: Record<WorkspaceView, string> = {
  start: "开始",
  "grill-chat": "追问对话",
  "grill-gate": "追问完成",
  "evaluate-running": "评估执行中",
  "evaluate-report": "评估报告",
  polish: "润色候选",
  export: "导出预览",
  completed: "已完成",
};

const VIEW_HINTS: Record<WorkspaceView, string> = {
  start: "尚未开始流程。",
  "grill-chat": "对话流 + 单题追问将在 M2 接入。",
  "grill-gate": "追问完成确认门将在 M2 接入。",
  "evaluate-running": "评估执行状态将在 M3 接入。",
  "evaluate-report": "评估报告视图将在 M3 接入。",
  polish: "润色候选对比将在 M3 接入。",
  export: "简历预览 + 导出将在 M3/M4 接入。",
  completed: "完成态视图将在 M3 接入。",
};

/**
 * M1 占位视图。仅证明 stage→视图投影联通；M2/M3 用真实组件替换。
 */
export function PlaceholderStageView({ view }: { view: WorkspaceView }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {view}
      </p>
      <h2 className="text-lg font-semibold">{VIEW_TITLES[view]}</h2>
      <p className="text-sm text-muted-foreground">{VIEW_HINTS[view]}</p>
    </div>
  );
}
