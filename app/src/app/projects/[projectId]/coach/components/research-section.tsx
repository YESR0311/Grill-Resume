import Link from "next/link";
import { runCoachResearchAction, runCoachSearchEvaluationAction } from "@/features/coach/actions";
import { type CoachResearchFinding, type CoachResearchQueueItem, type CoachResearchReport } from "@/features/coach/research";
import type { CoachResearchReportRecord } from "@/features/coach/storage";
import type { JdCoverageResult } from "@/features/coach/jd-coverage";
import { ConfirmFindingPanel } from "./confirm-finding-panel";
import { BulletDraftPanel } from "./bullet-draft-panel";

type ResearchQueueItem = CoachResearchQueueItem;

type ExperienceOption = { id: string; label: string };

type BulletPanelState = {
  hasPendingDraft: boolean;
  draftId?: string;
  candidates?: { text: string; rationale?: string }[];
};

function confidenceLabel(value: CoachResearchFinding["confidence"]): string {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  return "低";
}

function statusLabel(value: CoachResearchFinding["confirmationStatus"]): string {
  if (value === "confirmed") return "已确认";
  return "待确认";
}

function kindLabel(value: CoachResearchFinding["kind"]): string {
  const labels: Record<CoachResearchFinding["kind"], string> = {
    research_fact: "调研事实",
    research_inference: "调研推论",
    writing_suggestion: "文案建议",
  };
  return labels[value];
}

function scopeLabel(value: ResearchQueueItem["scope"]): string {
  if (value === "role") return "目标岗位";
  if (value === "experience") return "经历价值";
  return "JD 缺口";
}

function citationHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "外部来源";
  }
}

function findingCitations(finding: CoachResearchFinding): NonNullable<CoachResearchFinding["citations"]> {
  return finding.citations ?? (finding.sourceUrl ? [{ title: finding.sourceLabel, url: finding.sourceUrl }] : []);
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

function ResearchReportView({
  report,
  projectId,
  resumeId,
  experiences,
  bulletPanels,
  appliedBulletText,
}: {
  report: CoachResearchReport;
  projectId: string;
  resumeId: string;
  experiences: { id: string; label: string }[];
  bulletPanels: Record<string, { hasPendingDraft: boolean; draftId?: string; candidates?: { text: string; rationale?: string }[] }>;
  appliedBulletText: Record<string, string>;
}) {
  const isProviderReport = report.mode === "provider";
  const isPersisted = isProviderReport && report.id.startsWith("preview-") === false;
  const experienceMap = new Map(experiences.map((item) => [item.id, item.label]));
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p className={`rounded-2xl border p-4 ${isProviderReport ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
        {isProviderReport
          ? `已生成并持久化真实 provider 调研报告：${report.findings.length} 条结论。刷新页面或服务重启后仍可从本地 workspace 读取。`
          : `已生成本地 deterministic 预览报告：${report.findings.length} 条结论。`}
        v2 报告中可逐项确认进入证据图；已确认的条目可继续生成 bullet 草稿入正文。
      </p>
      {report.findings.map((finding) => {
        const linkedLabel = finding.linkedExperienceId ? experienceMap.get(finding.linkedExperienceId) : undefined;
        const panel = bulletPanels[finding.id];
        const appliedText = finding.linkedBulletId ? appliedBulletText[finding.linkedBulletId] : undefined;
        const citations = findingCitations(finding);
        return (
          <div key={finding.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {kindLabel(finding.kind)}
              </span>
              <span className="text-xs text-slate-500">置信度：{confidenceLabel(finding.confidence)}</span>
            </div>
            <p className="mt-3 leading-6 text-slate-700">{finding.text}</p>
            <p className="mt-2 text-xs text-slate-500">来源：{finding.sourceLabel}</p>
            {citations.length > 0 ? (
              <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-800">引用来源</p>
                {citations.map((citation) => (
                  <a
                    key={citation.url}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300"
                  >
                    <span className="block font-medium text-slate-900">{citation.title}</span>
                    <span className="mt-1 block text-slate-500">{citationHost(citation.url)}</span>
                    {citation.snippet ? <span className="mt-2 block leading-5 text-slate-600">{citation.snippet}</span> : null}
                  </a>
                ))}
              </div>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">状态：{statusLabel(finding.confirmationStatus)}</p>
            {finding.confirmationStatus === "confirmed" && linkedLabel ? (
              <p className="mt-1 text-xs text-emerald-700">已入图：{linkedLabel}</p>
            ) : null}
            {finding.linkedBulletId ? (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-medium">已入正文 bullet</p>
                {appliedText ? <p className="mt-1 whitespace-pre-line text-emerald-900">{appliedText}</p> : null}
              </div>
            ) : null}
            {isPersisted && finding.confirmationStatus === "unconfirmed" ? (
              <ConfirmFindingPanel
                projectId={projectId}
                resumeId={resumeId}
                reportId={report.id}
                findingId={finding.id}
                findingText={finding.text}
                experiences={experiences}
              />
            ) : null}
            {isPersisted && finding.confirmationStatus === "confirmed" && !finding.linkedBulletId ? (
              panel?.draftId && panel.candidates ? (
                <BulletDraftPanel
                  mode="apply"
                  projectId={projectId}
                  resumeId={resumeId}
                  draftId={panel.draftId}
                  candidates={panel.candidates}
                />
              ) : (
                <BulletDraftPanel
                  mode="generate"
                  projectId={projectId}
                  resumeId={resumeId}
                  reportId={report.id}
                  findingId={finding.id}
                  hasPendingDraft={Boolean(panel?.hasPendingDraft)}
                />
              )
            ) : null}
            {!isPersisted ? (
              <p className="mt-2 text-xs text-slate-500">本地预览报告不可入图，请先运行真实 provider 调研。</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ResearchReportList({ reports, activeReportId }: { reports: CoachResearchReportRecord[]; activeReportId?: string }) {
  if (reports.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
      <p className="font-medium text-slate-900">本地报告历史</p>
      <div className="mt-3 space-y-2">
        {reports.slice(0, 5).map((report) => (
          <Link
            key={report.id}
            href={`/projects/${report.projectId}/coach?researchStatus=provider&report=${report.id}`}
            className={`block rounded-xl border px-3 py-2 ${report.id === activeReportId ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span className="block font-medium">{report.id === activeReportId ? "当前报告" : "查看报告"}</span>
            <span className="mt-1 block text-xs">{new Date(report.createdAt).toLocaleString("zh-CN")} · {report.queueItemIds.length} 个调研项</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function JdCoverageView({ projectId, resumeId, coverage }: { projectId: string; resumeId: string; coverage: JdCoverageResult }) {
  if (coverage.status === "no-keywords") {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>当前简历未配置 JD 关键词。</p>
        <p>
          请先到{" "}
          <Link className="font-medium text-slate-900 underline" href={`/projects/${projectId}/resumes/${resumeId}/edit`}>
            简历编辑页
          </Link>{" "}
          填写 target.keywords 或粘贴 JD 文本，再回来复查缺口。
        </p>
      </div>
    );
  }

  const { covered, uncovered, total } = coverage;
  const visibleUncovered = uncovered.slice(0, 10);
  const remaining = uncovered.slice(10);

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        共 {total} 个 JD 关键词；覆盖 {covered.length} / 未覆盖 {uncovered.length}。覆盖判定：经历 STAR、confirmed bullet、技能字段做大小写不敏感 substring 匹配。
      </p>

      <div>
        <p className="font-medium text-emerald-700">已覆盖（{covered.length}）</p>
        {covered.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">暂无；先确认 STAR 与正文 bullet 后再回来复查。</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {covered.map((keyword) => (
              <span key={keyword} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="font-medium text-amber-700">未覆盖（{uncovered.length}）</p>
        {uncovered.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">所有 JD 关键词均已被简历覆盖。</p>
        ) : (
          <>
            <div className="mt-2 space-y-2">
              {visibleUncovered.map((keyword) => (
                <div key={keyword} className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    {keyword}
                  </span>
                  {coverage.webCitations?.[keyword]?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-amber-900">
                      {coverage.webCitations[keyword].map((citation) => (
                        <a key={citation.url} href={citation.url} className="block underline" target="_blank" rel="noreferrer">
                          {citation.host ?? citation.title} · {citation.retrievedAt ?? "retrieved"}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {remaining.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">展开剩余 {remaining.length} 项</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {remaining.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      {keyword}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
            <Link
              href={`/projects/${projectId}/coach?queue=resume-jd-gap&researchStatus=preview`}
              className="mt-3 inline-block rounded-full bg-slate-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              加入调研队列复查
            </Link>
          </>
        )}
      </div>
    </div>
  );
}


export function ResearchSection({
  projectId,
  resumeId,
  researchQueue,
  researchReport,
  reportRecords,
  activeReportId,
  experiences,
  bulletPanels,
  appliedBulletText,
  jdCoverage,
}: {
  projectId: string;
  resumeId?: string;
  researchQueue: ResearchQueueItem[];
  researchReport: CoachResearchReport | null;
  reportRecords: CoachResearchReportRecord[];
  activeReportId?: string;
  experiences: ExperienceOption[];
  bulletPanels: Record<string, BulletPanelState>;
  appliedBulletText: Record<string, string>;
  jdCoverage: JdCoverageResult | null;
}) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <SectionCard title="半自动调研队列" eyebrow="用户勾选后批量跑">
          <form action={runCoachResearchAction.bind(null, projectId)} className="space-y-3">
            {researchQueue.map((item) => (
              <label key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
                <input
                  type="checkbox"
                  name="queueItemId"
                  value={item.id}
                  defaultChecked={item.selected}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-slate-900">{item.title}</span>
                  <span className="mt-1 block text-slate-500">
                    {scopeLabel(item.scope)} · {item.reason}
                  </span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
              <span>我已确认：将向当前模型 provider 发送勾选调研项、目标岗位/JD 摘要、首条经历/项目/技能摘要；不会发送电话、邮箱、本机路径或 API key。</span>
            </label>
            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              运行真实 provider 调研
            </button>
            <p className="text-xs text-slate-500">
              只在提交后校验项目、主简历、勾选项、简历可读性和默认模型配置；通过后才调用 OpenAI-compatible provider。
            </p>
          </form>
          <form action={runCoachSearchEvaluationAction.bind(null, projectId)} className="mt-4 space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-medium text-sky-950">Tavily 三维评估</p>
            <p className="text-xs text-sky-800">用 confirmed 技能、公司与项目名查询公开来源，输出技能稀缺度与公司/项目可验证度。</p>
            <label className="flex items-start gap-2 text-xs text-sky-800">
              <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
              <span>我已确认：将向 Tavily 发送 confirmed 技能、组织名、项目名和目标岗位关键词；不会发送电话、邮箱、本机路径或 API key。</span>
            </label>
            <button type="submit" className="rounded-full bg-sky-950 px-5 py-2 text-sm font-medium text-white hover:bg-sky-800">运行 Tavily cited evaluation</button>
          </form>
        </SectionCard>

        <SectionCard title="可审计调研报告" eyebrow="事实 / 推论 / 建议分离">
          {researchReport ? (
            <div className="space-y-4">
              <ResearchReportView
                report={researchReport}
                projectId={projectId}
                resumeId={resumeId ?? ""}
                experiences={experiences}
                bulletPanels={bulletPanels}
                appliedBulletText={appliedBulletText}
              />
              <ResearchReportList reports={reportRecords} activeReportId={activeReportId} />
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">等待用户触发</p>
                <p className="mt-2">勾选左侧调研项并提交后，页面会展示真实 provider 调研报告；配置或调用失败会 fail closed。</p>
                <p className="mt-2 text-xs text-slate-500">首屏渲染不会调用外部搜索、AI provider、外部上传或写入 resume.json。</p>
              </div>
              <ResearchReportList reports={reportRecords} activeReportId={activeReportId} />
            </div>
          )}
        </SectionCard>
      </div>

      {jdCoverage && resumeId ? (
        <SectionCard title="JD 缺口复查" eyebrow="Step 5b · JDMatcher 式关键词对照，本地只读">
          <JdCoverageView projectId={projectId} resumeId={resumeId} coverage={jdCoverage} />
        </SectionCard>
      ) : null}
    </>
  );
}
