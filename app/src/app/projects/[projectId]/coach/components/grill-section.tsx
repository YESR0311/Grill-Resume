import { promoteCoachQaAnswerToEvidenceAction, runGrillEnhancementAction, saveCoachQaAnswerAction } from "@/features/coach/actions";
import { type GrillEnhancement } from "@/features/coach/conversation/llm-enhance";
import type { CoachGrillSession } from "@/features/coach/conversation/engine";
import { type CoachQaTurn, type CoachQaTurnStatus, type ExperienceDeepDiveItem, type CoachQuestionKind } from "@/features/coach/questions";
import type { PreviewToken } from "@/features/privacy/preview";

function questionKindLabel(value: CoachQuestionKind): string {
  if (value === "context") return "背景";
  if (value === "action") return "动作";
  if (value === "result") return "结果";
  if (value === "metric") return "指标";
  if (value === "evidence") return "证据";
  return "JD 匹配";
}

function qaTurnStatusLabel(value: CoachQaTurnStatus): string {
  if (value === "pending") return "待回答";
  if (value === "answered") return "已保存";
  if (value === "needs-evidence") return "需证据";
  if (value === "ready-to-promote") return "可推进";
  if (value === "promoted") return "已入图";
  return "已阻塞";
}

function qaTurnStatusClass(value: CoachQaTurnStatus): string {
  if (value === "promoted") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "ready-to-promote") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (value === "needs-evidence") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value === "answered") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (value === "blocked") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function turnSourceLabel(value: CoachQaTurn["targetSource"]): string {
  return value === "experience" ? "经历" : "项目";
}

function answerExcerpt(value: string): string {
  return value.length > 160 ? `${value.slice(0, 160)}…` : value;
}

function WorkbenchShell({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]">{left}{right}</div>;
}

function SidePanel({ children }: { children: React.ReactNode }) {
  return <aside className="space-y-4">{children}</aside>;
}

function SectionCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function GrillEnhancementPanel({
  projectId,
  resumeId,
  current,
  enhancement,
  hasDefaultModel,
  preview,
}: {
  projectId: string;
  resumeId?: string;
  current?: CoachQaTurn;
  enhancement?: GrillEnhancement;
  hasDefaultModel: boolean;
  preview: PreviewToken | null;
}) {
  const draft = enhancement?.distilledEvidenceDraft;
  const canPromoteDraft = Boolean(resumeId && current?.answer?.status === "confirmed" && current.answer.targetSource === "experience" && draft);

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sky-950">AI clarify</p>
          <p className="mt-1 text-xs leading-5 text-sky-800">显式触发；结果只作为追问辅助和待确认 STAR 草稿，不写入 confirmed bullet。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-200">
          {enhancement ? "已生成" : "deterministic 可用"}
        </span>
      </div>

      {preview ? (
        <details className="rounded-xl border border-sky-200 bg-white/70 p-3 text-xs text-sky-900">
          <summary className="cursor-pointer font-medium">隐私预览 payload</summary>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-slate-100">{preview.sanitized.preview}</pre>
          {preview.sanitized.removedFields.length > 0 ? (
            <p className="mt-2 text-amber-700">Removed fields: {preview.sanitized.removedFields.join(", ")}</p>
          ) : null}
        </details>
      ) : null}

      <form action={resumeId ? runGrillEnhancementAction.bind(null, projectId, resumeId) : undefined} className="space-y-3">
        <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
          <span>我已确认：将向默认模型 provider 发送当前追问、最近 Q&A、confirmed evidence 摘要和已标记 untrusted 的 JD 片段，用于澄清/冲突/追问建议。</span>
        </label>
        <button
          type="submit"
          disabled={!resumeId || !current || !hasDefaultModel}
          className="rounded-full bg-sky-950 px-5 py-2 text-xs font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          生成 AI clarify
        </button>
      </form>
      {!hasDefaultModel ? <p className="text-xs text-sky-800">未配置默认模型时保持 deterministic 追问，不调用 provider。</p> : null}

      {enhancement ? (
        <div className="space-y-3">
          {enhancement.restate ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">一句话复述</p>
              <p className="mt-2 text-slate-700">{enhancement.restate.text}</p>
              {enhancement.restate.lowConfidence ? <p className="mt-2 text-xs text-amber-700">lowConfidence：请用户确认后再入图。</p> : null}
            </div>
          ) : null}
          {enhancement.fuzzyTerms.length > 0 ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">模糊词澄清</p>
              <ul className="mt-2 space-y-2 text-slate-700">
                {enhancement.fuzzyTerms.map((item) => (
                  <li key={`${item.term}:${item.question}`}>
                    <span className="font-medium">{item.term}</span>：{item.question}{item.lowConfidence ? "（低置信）" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {enhancement.conflicts.length > 0 ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-rose-200">
              <p className="font-medium text-rose-900">冲突待裁决</p>
              <ul className="mt-2 space-y-2 text-slate-700">
                {enhancement.conflicts.map((item) => (
                  <li key={`${item.claim}:${item.citation}`} className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <p>主张：{item.claim}</p>
                    <p className="mt-1">证据：{item.evidence}</p>
                    <p className="mt-1 text-xs text-rose-800">{item.reason} · citation: {item.citation}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {enhancement.probe ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">动态追问</p>
              <p className="mt-2 text-slate-700">{enhancement.probe.question}</p>
              <p className="mt-1 text-xs text-slate-500">{enhancement.probe.kind} · {enhancement.probe.reason}</p>
            </div>
          ) : null}

          {draft ? (
            <div className="rounded-xl bg-white p-3 ring-1 ring-sky-200">
              <p className="font-medium text-slate-950">待确认 STAR 草稿</p>
              {draft.lowConfidence ? <p className="mt-2 text-xs text-amber-700">lowConfidence：含被丢弃或弱 grounding 字段，需人工确认。</p> : null}
              <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                <p>背景：{draft.context ?? "待补"}</p>
                <p>任务：{draft.task ?? "待补"}</p>
                <p>动作：{draft.actions.join("；") || "待补"}</p>
                <p>结果：{draft.results.map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text).join("；") || "待补"}</p>
              </div>
              {canPromoteDraft && current?.answer ? (
                <form action={promoteCoachQaAnswerToEvidenceAction.bind(null, projectId, resumeId!, current.answer.id)} className="mt-3 space-y-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
                  <input type="hidden" name="starResultConfidence" value="confirmed" />
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">背景</span>
                    <textarea name="starContext" defaultValue={draft.context ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">任务</span>
                    <textarea name="starTask" defaultValue={draft.task ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">动作（至少 1 条）</span>
                    <textarea name="starAction" required defaultValue={draft.actions[0] ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <div className="grid gap-2 md:grid-cols-[1fr_0.45fr]">
                    <label className="block">
                      <span className="text-xs font-medium text-sky-950">结果（至少 1 条）</span>
                      <textarea name="starResultText" required defaultValue={draft.results[0]?.text ?? ""} maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-sky-950">指标</span>
                      <input name="starResultMetric" defaultValue={draft.results[0]?.metric ?? ""} maxLength={500} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">技能</span>
                    <input name="starSkill" defaultValue={draft.skills[0] ?? ""} maxLength={200} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-sky-950">来源文本</span>
                    <textarea name="starSourceText" defaultValue={draft.sourceText} maxLength={4000} className="mt-1 min-h-16 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                  </label>
                  <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800">
                    人工确认后写入 evidence graph
                  </button>
                </form>
              ) : (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">先把当前 Q&A 标记为事实笔记，才可用此草稿预填 STAR 入图。</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function GrillSection({
  projectId,
  resumeId,
  session,
  items,
  hasDefaultModel,
  preview,
}: {
  projectId: string;
  resumeId?: string;
  session: CoachGrillSession;
  items: ExperienceDeepDiveItem[];
  hasDefaultModel: boolean;
  preview: PreviewToken | null;
}) {
  const current = session.base.activeTurn;
  const activeItem = current ? items.find((item) => item.id === current.targetId && item.source === current.targetSource) : undefined;
  const upcomingTurns = session.base.turns.filter((turn) => turn !== current).slice(0, 4);
  return (
    <SectionCard title="经历深挖 Q&A" eyebrow="resumify 式逐段追问 · 本地保存 · 不入 confirmed preview">
      <WorkbenchShell
        left={
          <SidePanel>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">会话进度</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">待回答 {session.base.counts.pending}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">已保存 {session.base.counts.answered}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">需证据 {session.base.counts["needs-evidence"]}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">可推进 {session.base.counts["ready-to-promote"]}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">已入图 {session.base.counts.promoted}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">已阻塞 {session.base.counts.blocked}</span>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                暂无经历或项目可追问。请先在简历编辑页补充实习、工作或项目经历。
              </div>
            ) : (
              <ol className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className={`rounded-2xl border p-4 text-sm ${current?.targetId === item.id ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{turnSourceLabel(item.source)}</span>
                      <span className="text-xs text-slate-500">{item.questions.length} 问</span>
                    </div>
                    <p className="mt-3 font-medium text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">confirmed bullet：{item.confirmedBulletCount}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.gapLabels.length > 0 ? item.gapLabels.map((gap) => (
                        <span key={gap} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                          {gap}
                        </span>
                      )) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">待复核</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-medium text-slate-900">下一步队列</p>
              {upcomingTurns.length === 0 ? (
                <p className="mt-2 text-slate-500">暂无后续 turn。</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {upcomingTurns.map((turn) => (
                    <li key={`${turn.targetId}:${turn.questionId}`} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <p className="font-medium text-slate-950">{turn.targetLabel}</p>
                      <p className="mt-1 text-slate-500">{turn.questionPrompt}</p>
                      <p className="mt-2 text-slate-500">{qaTurnStatusLabel(turn.status)} · {turn.reason}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </SidePanel>
        }
        right={
          current && activeItem ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">当前深挖对象</p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{current.targetLabel}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {turnSourceLabel(current.targetSource)} · {qaTurnStatusLabel(current.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{current.reason}</p>
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                  <p className="font-medium text-sky-950">Grill 目标维度：{questionKindLabel(session.weakestDimension)} · {session.dimensionScores[session.weakestDimension].toFixed(2)}</p>
                  <p className="mt-1">{session.weakestReason}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{questionKindLabel(current.questionKind)}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${qaTurnStatusClass(current.status)}`}>{qaTurnStatusLabel(current.status)}</span>
                </div>
                <p className="mt-3 font-medium leading-6 text-slate-950">{current.questionPrompt}</p>
                <p className="mt-2 leading-6 text-slate-600">{activeItem.questions.find((question) => question.id === current.questionId)?.why ?? ""}</p>
                {session.recommendedAnswers.length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {session.recommendedAnswers.map((answer) => (
                      <div key={answer.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-900">推荐脚手架 · {answer.label}</p>
                        <p className="mt-2 whitespace-pre-line leading-5">{answer.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {current.answer ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-700">本地 Q&A 笔记</p>
                    <p className="mt-1 whitespace-pre-line text-slate-700">{answerExcerpt(current.answer.answerText)}</p>
                    <p className="mt-2 text-slate-500">
                      更新时间：{new Date(current.answer.updatedAt).toLocaleString("zh-CN")} · 不进入 confirmed preview 或导出
                    </p>
                    {resumeId && current.answer.status === "confirmed" && current.answer.targetSource === "experience" ? (
                      <form action={promoteCoachQaAnswerToEvidenceAction.bind(null, projectId, resumeId, current.answer.id)} className="mt-3 space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="font-medium text-slate-800">入 evidence graph</p>
                        <p className="text-slate-500">需手填 STAR；不会生成 confirmed bullet 或导出内容。</p>
                        <label className="block">
                          <span className="text-slate-600">背景</span>
                          <textarea name="starContext" maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">任务</span>
                          <textarea name="starTask" maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">动作（至少 1 条）</span>
                          <textarea name="starAction" required maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <div className="grid gap-2 md:grid-cols-[1fr_0.45fr]">
                          <label className="block">
                            <span className="text-slate-600">结果（至少 1 条）</span>
                            <textarea name="starResultText" required maxLength={2000} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                          </label>
                          <label className="block">
                            <span className="text-slate-600">指标</span>
                            <input name="starResultMetric" maxLength={500} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                          </label>
                        </div>
                        <input type="hidden" name="starResultConfidence" value="confirmed" />
                        <label className="block">
                          <span className="text-slate-600">技能</span>
                          <input name="starSkill" maxLength={200} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <label className="block">
                          <span className="text-slate-600">来源文本</span>
                          <textarea name="starSourceText" maxLength={4000} defaultValue={current.answer.answerText} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
                        </label>
                        <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800">
                          确认写入 evidence graph
                        </button>
                      </form>
                    ) : current.answer.targetSource === "project" ? (
                      <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-500 ring-1 ring-slate-200">项目 Q&A 暂不入 evidence graph；本轮只支持经历 Q&A。</p>
                    ) : current.answer.status !== "confirmed" ? (
                      <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-500 ring-1 ring-slate-200">先标记为事实笔记，才可手填 STAR 入 evidence graph。</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <GrillEnhancementPanel
                projectId={projectId}
                resumeId={resumeId}
                current={current}
                enhancement={session.enhancement}
                hasDefaultModel={hasDefaultModel}
                preview={preview}
              />

              <ol className="space-y-3">
                {activeItem.questions.map((question) => {
                  const isActive = question.id === current.questionId;
                  return (
                    <li key={question.id} className={`rounded-2xl border p-4 text-sm ${isActive ? "border-slate-300 bg-white shadow-sm" : "border-slate-200"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{questionKindLabel(question.kind)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${question.status === "needs-evidence" ? "bg-amber-50 text-amber-700 ring-amber-200" : question.status === "answered" ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>{question.status === "needs-evidence" ? "需证据" : question.status === "answered" ? "已有线索" : "待回答"}</span>
                        {current.answer ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${qaTurnStatusClass(current.status)}`}>{qaTurnStatusLabel(current.status)}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 font-medium leading-6 text-slate-950">{question.prompt}</p>
                      <p className="mt-2 leading-6 text-slate-600">{question.why}</p>
                    </li>
                  );
                })}
              </ol>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                {resumeId && current ? (
                  <form
                    action={saveCoachQaAnswerAction.bind(null, projectId, resumeId)}
                    className="space-y-3 rounded-2xl border border-slate-200 p-4 text-sm"
                  >
                    <input type="hidden" name="targetId" value={current.targetId} />
                    <input type="hidden" name="targetSource" value={current.targetSource} />
                    <input type="hidden" name="questionId" value={current.questionId} />
                    <input type="hidden" name="questionKind" value={current.questionKind} />
                    <input type="hidden" name="questionPrompt" value={current.questionPrompt} />
                    <label className="block">
                      <span className="font-medium text-slate-950">回答 “{current.questionPrompt}”</span>
                      <textarea
                        name="answerText"
                        required
                        maxLength={4000}
                        defaultValue={current.answer?.answerText ?? ""}
                        placeholder="只用本地 workspace 保存；不会进入 confirmed bullet 或导出。"
                        className="mt-3 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                      />
                    </label>
                    <p className="text-xs text-slate-500">即使标记为“事实笔记”，也只是 Q&A 状态；写入 confirmed bullet 仍需要走证据图与文案确认。</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="status"
                        value="draft"
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        保存为草稿
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="confirmed"
                        className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        标记为事实笔记
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="rejected"
                        className="rounded-full border border-rose-200 px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        标记不用
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    {resumeId ? "当前对象暂无可回答问题。" : "尚未创建主简历，请先到项目中心创建主简历后再使用 Q&A。"}
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-950">确认阶梯</p>
                  <ol className="space-y-2">
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">1. 用户事实：背景、动作、结果由用户确认</li>
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">2. 用户证据：截图、报告、反馈等先入 evidence graph</li>
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">3. 文案建议：只生成候选，不等于真实事实</li>
                    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">4. confirmed bullet：二次确认后才进入预览</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              没有可展示的当前问题。补充经历或项目后会自动生成 Q&A 队列。
            </div>
          )
        }
      />
    </SectionCard>
  );
}

