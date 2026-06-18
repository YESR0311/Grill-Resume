import Link from "next/link";
import { notFound } from "next/navigation";
import { applyPolishCandidateAction, discardPolishCandidateAction, generatePolishCandidatesAction } from "@/features/coach/actions";
import { advancePipelineAction, skipPolishAndAdvanceAction } from "@/features/pipeline/actions";
import { getPipelinePolishProgress, isPipelinePolishReadyForExport } from "@/features/pipeline/polish";
import { getSession as getPipelineSession } from "@/features/pipeline/storage";
import { diffText } from "@/features/polish/diff";
import { listPolishRuns, type PolishRun } from "@/features/polish/store";
import { toneLabel } from "@/features/polish/tone";
import { getProject, listResumes, readResume } from "@/features/resume/storage";
import { buildPolishRunsView, type PolishRunTier } from "./polish-runs-view";

export const dynamic = "force-dynamic";

// tier 配色/文案（本地常量，与 F1 同惯例，不依赖其他组件私有常量）：
// high=emerald / medium=sky / low=amber / untiered=slate。
const tierClass: Record<PolishRunTier, string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-sky-200 bg-sky-50 text-sky-900",
  low: "border-amber-200 bg-amber-50 text-amber-900",
  untiered: "border-slate-200 bg-slate-50 text-slate-600",
};

const tierLabel: Record<PolishRunTier, string> = {
  high: "高价值",
  medium: "中等",
  low: "待补强",
  untiered: "未评级",
};

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ polishStatus?: string; polishCode?: string; run?: string; session?: string; pipeline?: string }>;
};

function DiffView({ before, after }: { before: string; after: string }) {
  return (
    <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
      {diffText(before, after).map((part, index) => {
        const className = part.type === "added" ? "bg-emerald-100 text-emerald-900" : part.type === "removed" ? "bg-rose-100 text-rose-800 line-through" : "";
        return <span key={`${part.type}-${index}`} className={className}>{part.value}</span>;
      })}
    </p>
  );
}

export default async function PolishPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const query = (await searchParams) ?? {};
  const project = getProject(projectId);
  if (!project) notFound();

  const master = listResumes(project.id).find((resume) => resume.kind === "master");
  if (!master) notFound();

  let document;
  let runs: PolishRun[] = [];
  let resumeError: string | null = null;
  try {
    document = await readResume(master.filePath);
    runs = await listPolishRuns(project.id, master.id);
  } catch (error) {
    resumeError = error instanceof Error ? error.message : "简历文件读取失败";
  }
  const confirmedBullets = document ? document.experiences.flatMap((experience) =>
    experience.bullets
      .filter((bullet) => bullet.status === "confirmed")
      .map((bullet) => ({ experience, bullet })),
  ) : [];
  const pipelineSession = await getPipelineSession(project.id);
  const polishProgress = await getPipelinePolishProgress(project.id, master.id);
  const readyForExport = isPipelinePolishReadyForExport(polishProgress);
  const pipelinePolishActive = pipelineSession?.currentStage === "polish";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/projects/${project.id}/coach`} className="text-sm font-medium text-slate-500 hover:text-slate-950">← 返回 Coach</Link>
          <Link href="/settings/models" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950">配置 AI 模型</Link>
        </div>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Candidate-only polish</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">候选润色，不改 confirmed 原文</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            每次生成保守 / 平衡 / 激进 3 个候选。候选存在 polish 层，只有你点击应用后才新增一条 confirmed bullet；原 bullet 保留，不做静默 rewrite。
          </p>
          {query.polishStatus === "error" ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{query.polishCode}</p> : null}
          {query.polishStatus === "generated" ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">已生成 3 个润色候选。</p> : null}
          {query.polishStatus === "applied" ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">已新增 confirmed bullet，原文保留。</p> : null}
          {query.polishStatus === "discarded" ? <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">已丢弃候选。</p> : null}
          {query.pipeline === "polish-generated" ? <p className="mt-4 rounded-2xl bg-sky-50 p-3 text-sm text-sky-700">Pipeline 已为可润色 bullet 生成缺失候选。</p> : null}
          {resumeError ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{resumeError}</p> : null}
        </section>

        {pipelinePolishActive ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Pipeline polish stage</p>
                <h2 className="mt-1 text-xl font-semibold">候选处理进度</h2>
                <p className="mt-2 text-sm text-slate-600">
                  已覆盖 {polishProgress.coveredBulletCount}/{polishProgress.eligibleBulletCount} 条 confirmed bullet；
                  待处理候选 {polishProgress.readyCandidateCount} 个；已完成 run {polishProgress.resolvedRunCount} 个。
                </p>
              </div>
              {readyForExport && pipelineSession ? (
                <div className="flex flex-wrap gap-3">
                  <form action={skipPolishAndAdvanceAction.bind(null, project.id)}>
                    <input type="hidden" name="sessionId" value={pipelineSession.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      跳过剩余候选，直接进入 Export
                    </button>
                  </form>
                  <form action={advancePipelineAction.bind(null, project.id, pipelineSession.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      全部处理完成，进入 Export
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  {pipelineSession ? (
                    <form action={skipPolishAndAdvanceAction.bind(null, project.id)}>
                      <input type="hidden" name="sessionId" value={pipelineSession.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        跳过剩余候选，直接进入 Export
                      </button>
                    </form>
                  ) : null}
                  {polishProgress.readyCandidateCount > 0 ? (
                    <p className="max-w-sm text-xs leading-5 text-slate-500">
                      还有 {polishProgress.readyCandidateCount} 个候选待处理；跳过后这些候选不会应用到简历。
                    </p>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      等待候选生成或处理状态更新
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">可润色 confirmed bullets</h2>
          {confirmedBullets.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">暂无 confirmed bullet。先在 Coach 中把证据生成并应用为 bullet。</p>
          ) : (
            <div className="mt-5 space-y-4">
              {confirmedBullets.map(({ experience, bullet }) => (
                <article key={bullet.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500">{experience.organization} · {experience.role}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{bullet.text}</p>
                  <form action={generatePolishCandidatesAction.bind(null, project.id, master.id, experience.id, bullet.id)} className="mt-4 space-y-3">
                    <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
                      <span>我确认把这条 bullet、关联证据片段和可选 JD 发给已配置 AI provider；不会发送联系方式、地址或未确认材料。</span>
                    </label>
                    <button className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800">生成 3 个候选</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">候选对比</h2>
          {runs.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">还没有润色候选。</p>
          ) : (
            (() => {
              const view = buildPolishRunsView({ runs });
              return (
                <>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                    <span className={`rounded-full border px-3 py-1 ${tierClass.high}`}>{tierLabel.high} {view.tierCounts.high}</span>
                    <span className={`rounded-full border px-3 py-1 ${tierClass.medium}`}>{tierLabel.medium} {view.tierCounts.medium}</span>
                    <span className={`rounded-full border px-3 py-1 ${tierClass.low}`}>{tierLabel.low} {view.tierCounts.low}</span>
                    <span className={`rounded-full border px-3 py-1 ${tierClass.untiered}`}>{tierLabel.untiered} {view.tierCounts.untiered}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">按履历价值排序——高价值经历的候选优先处理；价值评级来自 Evaluate 阶段的 AI 评估，仅供参考。</p>
                  <div className="mt-5 space-y-6">
                    {view.runs.map(({ run, tier }) => (
                      <article key={run.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-slate-500">原文</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{run.sourceBulletText}</p>
                            {run.appliedAt ? <p className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 ring-1 ring-amber-200">归档原文 · 已应用候选</p> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tierClass[tier]}`}>{tierLabel[tier]}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{run.createdAt}</span>
                          </div>
                        </div>
                        <div className="mt-5 grid gap-4 lg:grid-cols-3">
                          {run.candidates.map((candidate) => (
                            <div key={candidate.id} className="rounded-2xl border border-slate-200 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">{toneLabel(candidate.tone)}</span>
                                <span className="text-xs text-slate-500">{candidate.status}</span>
                              </div>
                              {candidate.lowConfidence ? <p className="mt-3 rounded-xl bg-amber-50 p-2 text-xs text-amber-800">低置信：请人工核对事实支撑。</p> : null}
                              <DiffView before={run.sourceBulletText} after={candidate.text} />
                              <p className="mt-3 text-xs leading-5 text-slate-500">{candidate.rationale}</p>
                              {candidate.status === "ready" ? (
                                <div className="mt-4 space-y-3">
                                  <form action={applyPolishCandidateAction.bind(null, project.id, master.id, run.id, candidate.id)} className="space-y-2">
                                    <textarea name="finalText" defaultValue={candidate.text} className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                                    <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">应用为 confirmed bullet</button>
                                  </form>
                                  <form action={discardPolishCandidateAction.bind(null, project.id, master.id, run.id, candidate.id)}>
                                    <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950">丢弃</button>
                                  </form>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              );
            })()
          )}
        </section>
      </div>
    </main>
  );
}
