import type { EvaluationSummary } from "@/features/pipeline/types";

// tier 配色（本地常量，不依赖 MetricsDashboard 私有函数）：high=emerald / medium=sky / low=amber。
const tierClass: Record<"high" | "medium" | "low", string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-sky-200 bg-sky-50 text-sky-900",
  low: "border-amber-200 bg-amber-50 text-amber-900",
};

const tierLabel: Record<"high" | "medium" | "low", string> = {
  high: "高价值",
  medium: "中等价值",
  low: "待补强",
};

export type EvaluationReportRatingView = {
  experienceId: string;
  title: string;
  resolved: boolean;
  score: number;
  tier: "high" | "medium" | "low";
  rationale: string;
  citations: string[];
};

export type EvaluationReportView = {
  empty: boolean;
  jdMatchScore?: number;
  ratings: EvaluationReportRatingView[];
  tierCounts: { high: number; medium: number; low: number };
  uncoveredKeywords: string[];
  reportId?: string;
  createdAt?: string;
};

function resolveTitle(
  experienceId: string,
  experiences: { id: string; label: string }[],
): { title: string; resolved: boolean } {
  const match = experiences.find((item) => item.id === experienceId);
  if (match) return { title: match.label, resolved: true };
  return { title: `未知经历(${experienceId.slice(0, 8)})`, resolved: false };
}

/**
 * 把 session.evaluationSummary（B5 写入，optional）转成只读视图模型。
 * 纯函数、无 IO，便于闭网验收。降级规则见 design §2。
 */
export function buildEvaluationReportView(input: {
  summary?: EvaluationSummary;
  experiences: { id: string; label: string }[];
}): EvaluationReportView {
  const { summary, experiences } = input;
  const ratings: EvaluationReportRatingView[] = (summary?.experienceRatings ?? []).map((rating) => {
    const { title, resolved } = resolveTitle(rating.experienceId, experiences);
    return {
      experienceId: rating.experienceId,
      title,
      resolved,
      score: rating.score,
      tier: rating.tier,
      rationale: rating.rationale,
      citations: rating.searchCitations,
    };
  });

  const tierCounts = { high: 0, medium: 0, low: 0 };
  for (const rating of ratings) tierCounts[rating.tier] += 1;

  return {
    empty: ratings.length === 0,
    jdMatchScore: summary?.jdMatchScore,
    ratings,
    tierCounts,
    uncoveredKeywords: summary?.uncoveredKeywords ?? [],
    reportId: summary?.reportId,
    createdAt: summary?.createdAt,
  };
}

function jdScoreClass(score: number): string {
  if (score >= 75) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (score >= 50) return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
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

/**
 * 履历价值评估报告（纯只读展示）。
 * evidence-first：不含任何写入/采纳 server action；AI 评估只作决策参考，必经双层确认才进正文。
 */
export function EvaluationReportPanel({ view }: { view: EvaluationReportView }) {
  const jdScore = view.jdMatchScore;
  const showJd = typeof jdScore === "number";
  const showKeywords = view.uncoveredKeywords.length > 0;
  const fullyEmpty = view.empty && !showJd && !showKeywords;

  return (
    <SectionCard title="履历价值评估报告" eyebrow="联网搜索 + AI 客观评估 · 只读参考，不写入正文">
      {fullyEmpty ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-500">
          评估报告尚未生成。运行 Pipeline 的 <span className="font-medium text-slate-700">Evaluate</span> 阶段后，
          AI 对各段经历的客观价值评分、JD 匹配度与未覆盖关键词会在此显示。
        </div>
      ) : (
        <div className="space-y-5">
          {typeof jdScore === "number" ? (
            <div className={`flex items-center justify-between gap-4 rounded-2xl border p-5 ${jdScoreClass(jdScore)}`}>
              <div>
                <p className="text-xs opacity-70">JD 匹配度</p>
                <p className="mt-1 text-xs leading-5 opacity-70">现有经历与目标 JD 的整体契合评分（AI 评估，仅供参考）。</p>
              </div>
              <p className="text-4xl font-semibold tracking-tight">{jdScore}</p>
            </div>
          ) : null}

          {!view.empty ? (
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full border px-3 py-1 ${tierClass.high}`}>高价值 {view.tierCounts.high}</span>
              <span className={`rounded-full border px-3 py-1 ${tierClass.medium}`}>中等 {view.tierCounts.medium}</span>
              <span className={`rounded-full border px-3 py-1 ${tierClass.low}`}>待补强 {view.tierCounts.low}</span>
            </div>
          ) : null}

          {view.empty ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              暂无单段经历评分；当前仅有 JD 匹配度或关键词缺口数据。
            </div>
          ) : (
            <ul className="space-y-3">
              {view.ratings.map((rating, ratingIndex) => (
                <li key={`${rating.experienceId}-${ratingIndex}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">
                        {rating.title}
                        {!rating.resolved ? (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">经历已变更</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tierClass[rating.tier]}`}>{tierLabel[rating.tier]}</span>
                      <span className="text-2xl font-semibold tracking-tight text-slate-950">{rating.score}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{rating.rationale}</p>
                  {rating.citations.length > 0 ? (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-xs font-medium text-slate-500">引用来源</p>
                      <ul className="mt-2 space-y-1">
                        {rating.citations.map((href, index) => (
                          <li key={`${rating.experienceId}-${ratingIndex}-cite-${index}`} className="truncate text-xs">
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-sky-700 underline-offset-2 hover:underline"
                            >
                              {href}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {showKeywords ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-800">JD 未覆盖关键词</p>
              <p className="mt-1 text-xs leading-5 text-amber-700">JD 中尚未被现有经历覆盖的关键词，仅供补充追问参考，不代表你需要编造经历。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {view.uncoveredKeywords.map((keyword, index) => (
                  <span key={`kw-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
