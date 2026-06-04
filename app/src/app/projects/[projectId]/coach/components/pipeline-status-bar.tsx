import { PIPELINE_STAGES, type PipelineSession, type PipelineStage, type PipelineStageStatus } from "@/features/pipeline";

const stageLabels: Record<PipelineStage, string> = {
  grill: "Grill",
  evaluate: "Evaluate",
  polish: "Polish",
  export: "Export",
};

const statusLabels: Record<PipelineStageStatus, string> = {
  not_started: "未开始",
  in_progress: "执行中",
  awaiting_user: "待确认",
  completed: "已完成",
  failed: "失败",
};

function statusClass(status: PipelineStageStatus): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "awaiting_user") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-white text-slate-600";
}

export function PipelineStatusBar({ session }: { session: PipelineSession | null }) {
  if (!session) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-900">Pipeline session</p>
        <p className="mt-1 text-sm text-slate-500">暂无 pipeline session；进入批量隐私确认后会显示真实阶段状态。</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Pipeline session</p>
          <p className="mt-1 text-xs text-slate-500">{session.id} · 当前阶段 {stageLabels[session.currentStage]} · auto {session.autoAdvance ? "on" : "off"}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {session.completedAt ? "已完成" : "运行中"}
        </span>
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-4">
        {PIPELINE_STAGES.map((stage, index) => {
          const state = session.stages[stage];
          return (
            <li key={stage} className={`rounded-2xl border p-3 ${statusClass(state.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-xs font-semibold ring-1 ring-current">{index + 1}</span>
                <span className="text-xs font-medium">{statusLabels[state.status]}</span>
              </div>
              <p className="mt-3 font-medium">{stageLabels[stage]}</p>
              {state.errorCode ? <p className="mt-1 text-xs">{state.errorCode}</p> : null}
              {state.completedAt ? <p className="mt-1 text-xs opacity-70">{state.completedAt}</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
