import { confirmEgressAction } from "@/features/pipeline/actions";
import { PIPELINE_STAGES, type EgressItem, type PipelineSession, type PipelineStage } from "@/features/pipeline";

const stageLabels: Record<PipelineStage, string> = {
  grill: "Grill 问答增强",
  evaluate: "搜索与 AI 评估",
  polish: "AI 润色",
  export: "导出",
};

function groupedItems(items: EgressItem[]): Array<{ stage: PipelineStage; items: EgressItem[] }> {
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    items: items.filter((item) => item.stage === stage),
  })).filter((group) => group.items.length > 0);
}

function providerClass(provider: string): string {
  if (provider.toLowerCase().includes("tavily")) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (provider.toLowerCase().includes("llm")) return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function EgressPlanPanel(props: { session: PipelineSession }) {
  const confirmedAt = props.session.egressPlan.userConfirmedAt ?? props.session.egressPlan.allConfirmedAt;
  const groups = groupedItems(props.session.egressPlan.items);
  const action = confirmEgressAction.bind(null, props.session.projectId, props.session.id);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Privacy preview</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">隐私与数据使用确认</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Pipeline 会按下列计划外发已确认事实、JD 摘要和必要上下文。确认前不会执行搜索或 LLM 调用。
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {confirmedAt ? `已确认 ${confirmedAt}` : "待确认"}
        </span>
      </div>

      <form action={action} className="mt-5 space-y-5">
        <input type="hidden" name="resumeId" value={props.session.resumeId} />
        <div className="space-y-4">
          {groups.length > 0 ? groups.map((group) => (
            <section key={group.stage} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{stageLabels[group.stage]}</h3>
                <span className="text-xs text-slate-500">{group.items.length} 个外发点</span>
              </div>
              <ul className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <li key={item.id} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.description}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.action ?? item.id}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${providerClass(item.provider)}`}>
                        {item.provider}
                      </span>
                    </div>
                    <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                      {item.dataPreview ?? "仅发送当前阶段必要的已确认简历事实。"}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>
          )) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              当前 session 没有需要外发的搜索或 LLM 请求。
            </p>
          )}
        </div>

        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-900">逐项审批</summary>
          <div className="mt-3 space-y-2">
            {props.session.egressPlan.items.map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" name="egressItemId" value={item.id} defaultChecked className="mt-1" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{item.description}</span>
                  <span className="block text-xs text-slate-500">{stageLabels[item.stage]} · {item.provider}</span>
                </span>
              </label>
            ))}
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" name="autoAdvance" value="1" defaultChecked />
              <span className="text-sm font-medium text-slate-900">确认后自动推进 pipeline</span>
            </label>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={Boolean(confirmedAt)}
          >
            确认全部外发请求
          </button>
        </div>
      </form>
    </section>
  );
}
