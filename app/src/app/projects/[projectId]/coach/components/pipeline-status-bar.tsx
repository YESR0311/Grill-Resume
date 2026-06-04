import { advancePipelineAction, retryPipelineStageAction, startPipelineAction } from "@/features/pipeline/actions";
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

function errorLabel(code: string): string {
  if (code === "egress_pending") return "等待隐私与外发数据确认";
  if (code === "missing-model-config") return "请先配置默认模型";
  if (code === "missing-search-config") return "请先配置 Tavily 搜索";
  if (code === "missing-resume") return "当前简历不可用，请回到材料页检查";
  if (code === "stage-timeout") return "阶段执行超时，可稍后重试";
  if (code === "missing-basics") return "导出前需要补齐基础信息";
  return code;
}

function advanceButtonLabel(stage: PipelineStage): string {
  if (stage === "grill") return "确认 Grill 结果，进入 Evaluate";
  if (stage === "evaluate") return "确认评估结果，进入 Polish";
  if (stage === "polish") return "确认润色结果，进入 Export";
  return "查看导出结果";
}

export function PipelineStatusBar({ session, projectId, resumeId }: { session: PipelineSession | null; projectId: string; resumeId?: string }) {
  if (!session) {
    const action = resumeId ? startPipelineAction.bind(null, projectId, resumeId) : undefined;
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-900">Pipeline session</p>
        <p className="mt-1 text-sm text-slate-500">暂无 pipeline session；先创建 session，再进行批量隐私确认。</p>
        <form action={action} className="mt-3">
          <button
            type="submit"
            disabled={!resumeId}
            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            创建 pipeline session
          </button>
        </form>
        {!resumeId ? <p className="mt-2 text-xs text-amber-700">当前项目没有 master resume，请先补充材料。</p> : null}
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
            <li key={stage} aria-current={stage === session.currentStage ? "step" : undefined} className={`rounded-2xl border p-3 ${statusClass(state.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-xs font-semibold ring-1 ring-current">{index + 1}</span>
                <span className="text-xs font-medium">{statusLabels[state.status]}</span>
              </div>
              <p className="mt-3 font-medium">{stageLabels[stage]}</p>
              {state.errorCode ? <p className="mt-1 text-xs">{errorLabel(state.errorCode)}</p> : null}
              {state.completedAt ? <p className="mt-1 text-xs opacity-70">{state.completedAt}</p> : null}
              {state.status === "awaiting_user" && state.errorCode !== "egress_pending" ? (
                <form action={advancePipelineAction.bind(null, projectId, session.id)} className="mt-3">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-white/80 px-3 py-2 text-xs font-medium ring-1 ring-current hover:bg-white"
                  >
                    {advanceButtonLabel(stage)}
                  </button>
                </form>
              ) : null}
              {state.status === "failed" ? (
                <form action={retryPipelineStageAction.bind(null, projectId)} className="mt-3">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-rose-100 px-3 py-2 text-xs font-medium text-rose-900 hover:bg-rose-200"
                  >
                    重试
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
