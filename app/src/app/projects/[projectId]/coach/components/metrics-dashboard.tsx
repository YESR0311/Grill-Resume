import Link from "next/link";
import type { JdCoverageResult } from "@/features/coach/jd-coverage";
import type { ResumeDocument, ResumeRecord } from "@/features/resume/types";
import type { CoachResearchReportRecord } from "@/features/coach/storage";

export type CoachMetric = {
  label: string;
  value: string;
  hint: string;
  tone: "slate" | "emerald" | "amber" | "sky";
};

export type BuilderSnapshotModule = {
  id: string;
  title: string;
  rows: string[];
  tags?: string[];
};

export type BuilderSnapshot = {
  title: string;
  personalInfo: string[];
  jobIntention: string[];
  modules: BuilderSnapshotModule[];
};

export type BuilderWorkbenchSummary = {
  projectName: string;
  resumeCount: number;
  variantCount: number;
  masterResumeId?: string;
  masterResumeName?: string;
  reportCount: number;
  confirmedBulletCount: number;
};

type CoachFlowStep = {
  key: string;
  title: string;
  description: string;
  status: "ready" | "working" | "locked";
};

const coachFlowSteps: CoachFlowStep[] = [
  { key: "import", title: "材料", description: "旧简历 / 草稿 / JD", status: "ready" },
  { key: "diagnose", title: "诊断", description: "岗位匹配与缺口", status: "working" },
  { key: "evidence", title: "证据", description: "STAR 入图确认", status: "working" },
  { key: "write", title: "正文", description: "候选 bullet 审改", status: "locked" },
  { key: "export", title: "导出", description: "ATS / 中文视觉 Word", status: "locked" },
];

function metricTone(value: CoachMetric["tone"]): string {
  if (value === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (value === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (value === "sky") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-slate-200 bg-white text-slate-900";
}

export function buildCoachMetrics(input: {
  document: ResumeDocument | null;
  resumes: ResumeRecord[];
  reportRecords: CoachResearchReportRecord[];
  jdCoverage: JdCoverageResult | null;
}): CoachMetric[] {
  const evidenceCount = input.document?.experiences.reduce((sum, item) => sum + item.evidence.length, 0) ?? 0;
  const confirmedBullets = input.document?.experiences.reduce((sum, item) => sum + item.bullets.filter((bullet) => bullet.status === "confirmed").length, 0) ?? 0;
  const jdValue = input.jdCoverage?.status === "ok" ? `${input.jdCoverage.covered.length}/${input.jdCoverage.total}` : "未配置";
  return [
    { label: "简历", value: `${input.resumes.length}`, hint: "当前项目版本", tone: "slate" },
    { label: "证据", value: `${evidenceCount}`, hint: "STAR evidence", tone: evidenceCount > 0 ? "emerald" : "amber" },
    { label: "正文", value: `${confirmedBullets}`, hint: "confirmed bullets", tone: confirmedBullets > 0 ? "emerald" : "amber" },
    { label: "JD", value: jdValue, hint: "关键词覆盖", tone: input.jdCoverage?.status === "ok" ? "sky" : "amber" },
    { label: "报告", value: `${input.reportRecords.length}`, hint: "本地审计记录", tone: input.reportRecords.length > 0 ? "emerald" : "slate" },
  ];
}

export function buildBuilderSnapshot(document: ResumeDocument | null): BuilderSnapshot {
  if (!document) {
    return {
      title: "未加载简历",
      personalInfo: ["等待创建或读取主简历"],
      jobIntention: ["目标岗位待补充"],
      modules: [],
    };
  }

  const personalInfo = [document.basics.name, document.basics.phone, document.basics.email, document.basics.city]
    .filter((item): item is string => Boolean(item));
  const jobIntention = [document.basics.targetRole, document.target?.role, document.target?.industry]
    .filter((item): item is string => Boolean(item));
  const educationRows = document.education.map((item) => [item.school, item.degree, item.major].filter(Boolean).join(" · "));
  const experienceRows = document.experiences.flatMap((item) => {
    const confirmed = item.bullets.filter((bullet) => bullet.status === "confirmed").map((bullet) => bullet.text);
    if (confirmed.length === 0) return [];
    return [[item.organization, item.role, ...confirmed].filter(Boolean).join("｜")];
  });
  const projectRows = document.projects.flatMap((item) => {
    const confirmed = item.bullets.filter((bullet) => bullet.status === "confirmed").map((bullet) => bullet.text);
    if (confirmed.length === 0) return [];
    return [[item.name, item.role, ...confirmed].filter(Boolean).join("｜")];
  });
  const skillTags = document.skills.flatMap((group) => group.items);

  return {
    title: document.title,
    personalInfo: personalInfo.length > 0 ? personalInfo : ["个人信息待补充"],
    jobIntention: jobIntention.length > 0 ? jobIntention : ["目标岗位待补充"],
    modules: [
      { id: "education", title: "教育背景", rows: educationRows },
      { id: "experiences", title: "实习 / 工作经历", rows: experienceRows },
      { id: "projects", title: "项目经历", rows: projectRows },
      { id: "skills", title: "技能标签", rows: [], tags: skillTags },
    ].filter((module) => module.rows.length > 0 || (module.tags?.length ?? 0) > 0),
  };
}

export function buildBuilderWorkbenchSummary(input: {
  projectName: string;
  resumes: ResumeRecord[];
  master?: ResumeRecord;
  document: ResumeDocument | null;
  reportCount: number;
}): BuilderWorkbenchSummary {
  const confirmedExperienceBullets = input.document?.experiences.reduce((sum, item) => sum + item.bullets.filter((bullet) => bullet.status === "confirmed").length, 0) ?? 0;
  const confirmedProjectBullets = input.document?.projects.reduce((sum, item) => sum + item.bullets.filter((bullet) => bullet.status === "confirmed").length, 0) ?? 0;

  return {
    projectName: input.projectName,
    resumeCount: input.resumes.length,
    variantCount: input.resumes.filter((resume) => resume.kind === "variant").length,
    masterResumeId: input.master?.id,
    masterResumeName: input.master?.name,
    reportCount: input.reportCount,
    confirmedBulletCount: confirmedExperienceBullets + confirmedProjectBullets,
  };
}

function flowStatusLabel(value: CoachFlowStep["status"]): string {
  if (value === "ready") return "可用";
  if (value === "working") return "处理中";
  return "待解锁";
}

function flowStatusClass(value: CoachFlowStep["status"]): string {
  if (value === "ready") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "working") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

function CoachFlowRail({ steps }: { steps: CoachFlowStep[] }) {
  return (
    <nav aria-label="简历教练流程" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="grid gap-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step.key} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${flowStatusClass(step.status)}`}>
                {flowStatusLabel(step.status)}
              </span>
            </div>
            <p className="mt-3 font-medium text-slate-950">{step.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function CoachMetrics({ metrics }: { metrics: CoachMetric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className={`rounded-2xl border p-4 ${metricTone(metric.tone)}`}>
          <p className="text-xs opacity-70">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
          <p className="mt-1 text-xs opacity-70">{metric.hint}</p>
        </div>
      ))}
    </div>
  );
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

function BuilderSnapshotWorkbench({
  projectId,
  snapshot,
  summary,
}: {
  projectId: string;
  snapshot: BuilderSnapshot;
  summary: BuilderWorkbenchSummary;
}) {
  const viewModes = ["编辑 + 预览", "仅编辑", "仅预览"];
  return (
    <SectionCard title="确认内容排版入口" eyebrow="本地管理 + 编辑 + 预览底座">
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">项目</p>
            <p className="mt-2 truncate font-medium text-slate-950">{summary.projectName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">简历库</p>
            <p className="mt-2 font-medium text-slate-950">{summary.resumeCount} 份 · 变体 {summary.variantCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">confirmed bullet</p>
            <p className="mt-2 font-medium text-slate-950">{summary.confirmedBulletCount} 条</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">审计报告</p>
            <p className="mt-2 font-medium text-slate-950">{summary.reportCount} 份</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-2">
            {viewModes.map((mode, index) => (
              <span
                key={mode}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${index === 0 ? "bg-white text-slate-950 ring-slate-300" : "bg-slate-100 text-slate-500 ring-slate-200"}`}
              >
                {mode}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <Link href={`/projects/${projectId}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-white">
              项目中心
            </Link>
            {summary.masterResumeId ? (
              <>
                <Link href={`/projects/${projectId}/resumes/${summary.masterResumeId}/edit`} className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-white">
                  编辑主简历
                </Link>
                <Link href={`/projects/${projectId}/resumes/${summary.masterResumeId}/export`} className="rounded-full bg-slate-950 px-3 py-1.5 text-white hover:bg-slate-800">
                  导出本地成品
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">主简历</p>
              <p className="mt-2 font-medium text-slate-950">{summary.masterResumeName ?? "尚未创建主简历"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">这里复用当前项目的 storage/index，不显示本地文件路径。</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">个人信息模块</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {snapshot.personalInfo.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">求职意向模块</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {snapshot.jobIntention.map((item) => (
                  <span key={item} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-xs leading-5 text-slate-500">
              确认边界：这里只做 `ResumeDocument` → builder snapshot 的本地映射；不导入 localStorage、Tauri、Supabase 或真实 provider 运行时。未确认事实留在 evidence graph，不进入预览或导出入口。
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-center text-2xl font-semibold tracking-tight">{snapshot.title}</h3>
              <div className="mt-5 space-y-4">
                {snapshot.modules.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">暂无 confirmed 内容；先通过问答、证据确认和文案确认补齐。</p>
                ) : (
                  snapshot.modules.map((module) => (
                    <section key={module.id} className="border-t border-slate-200 pt-3">
                      <h4 className="text-sm font-semibold text-slate-950">{module.title}</h4>
                      {module.rows.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                          {module.rows.map((row) => (
                            <li key={row}>• {row}</li>
                          ))}
                        </ul>
                      ) : null}
                      {module.tags && module.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {module.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export function MetricsDashboard({
  projectId,
  metrics,
  snapshot,
  summary,
}: {
  projectId: string;
  metrics: CoachMetric[];
  snapshot: BuilderSnapshot;
  summary: BuilderWorkbenchSummary;
}) {
  return (
    <>
      <CoachFlowRail steps={coachFlowSteps} />
      <CoachMetrics metrics={metrics} />
      <BuilderSnapshotWorkbench projectId={projectId} snapshot={snapshot} summary={summary} />
    </>
  );
}
