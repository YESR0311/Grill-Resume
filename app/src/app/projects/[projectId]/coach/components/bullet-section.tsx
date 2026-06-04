import { applyEvidenceBulletDraftAction, generateEvidenceBulletDraftAction } from "@/features/coach/actions";
import type { CoachBulletDraft } from "@/features/coach/bullet-drafts";
import type { ResumeDocument } from "@/features/resume/types";

export type EvidenceBulletDraftItem = {
  experienceId: string;
  experienceLabel: string;
  evidence: ResumeDocument["experiences"][number]["evidence"][number];
  draft?: CoachBulletDraft;
};

function SectionCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function isEligibleEvidence(evidence: ResumeDocument["experiences"][number]["evidence"][number]): boolean {
  return evidence.actions.length > 0 && evidence.results.length > 0 && evidence.results.some((result) => result.confidence === "confirmed");
}

export function EvidenceBulletDraftPanel({ projectId, resumeId, items }: { projectId: string; resumeId?: string; items: EvidenceBulletDraftItem[] }) {
  return (
    <SectionCard title="证据生成候选正文" eyebrow="confirmed evidence → 候选正文 → 用户确认后写入">
      <div className="space-y-4 text-sm text-slate-600">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          这里只展示已具备动作、结果和已确认结果的 STAR 证据。生成只创建候选正文；采纳后才写入 confirmed bullet，并保留 source evidence trace。
        </p>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-slate-500">
            暂无可生成正文的已确认证据。先在经历深挖 Q&A 中确认 STAR 证据。
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const draft = item.draft;
              return (
                <div key={`${item.experienceId}:${item.evidence.id}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">证据来源</p>
                      <p className="mt-1 font-medium text-slate-950">{item.experienceLabel}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${draft ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                      {draft ? "候选正文 / 待确认" : "可生成候选"}
                    </span>
                  </div>
                  {item.evidence.context ? <p className="mt-3 text-slate-700">{item.evidence.context}</p> : null}
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                    <p>动作：{item.evidence.actions.slice(0, 2).join("；")}</p>
                    <p>结果：{item.evidence.results.slice(0, 2).map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text).join("；")}</p>
                  </div>
                  {draft ? (
                    <div className="mt-4 space-y-3">
                      {draft.candidates.map((candidate, candidateIndex) => (
                        <form key={candidateIndex} action={resumeId ? applyEvidenceBulletDraftAction.bind(null, projectId, resumeId, draft.id) : undefined} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <input type="hidden" name="candidateIndex" value={candidateIndex} />
                          <label className="block">
                            <span className="text-xs font-medium text-amber-900">候选正文 / 待确认</span>
                            <textarea
                              name="finalText"
                              defaultValue={candidate.text}
                              className="mt-2 min-h-28 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-900"
                            />
                          </label>
                          {candidate.rationale ? <p className="text-xs text-amber-800">生成依据：{candidate.rationale}</p> : null}
                          <button
                            type="submit"
                            disabled={!resumeId}
                            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            确认采纳，写入 confirmed bullet
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <form action={resumeId ? generateEvidenceBulletDraftAction.bind(null, projectId, resumeId, item.experienceId, item.evidence.id) : undefined} className="mt-4 space-y-3">
                      <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
                        <span>我已确认：将向当前模型 provider 发送这条已确认 STAR 证据、目标岗位/JD 摘要与技能摘要，用于生成候选正文。</span>
                      </label>
                      <button
                        type="submit"
                        disabled={!resumeId}
                        className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        生成候选正文
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
