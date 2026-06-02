import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { generateIssueOptimization } from "@/features/ai/optimize-issue";
import {
  acceptIssueOptimizationDraft,
  getProject,
  getProjectResume,
  readIssueOptimizationDraft,
} from "@/features/resume/storage";
import { isSupportedIssueTargetPath, readIssueTargetBullet } from "@/features/resume/issue-targets";
import { scoreResume, type ScoreDimensionKey } from "@/features/score/resume-score";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string; resumeId: string }>;
  searchParams: Promise<{ draft?: string; error?: string }>;
};

const dimensionLabels: Record<ScoreDimensionKey, string> = {
  completeness: "完整度",
  impact: "影响力",
  credibility: "可信度",
  ats: "ATS 友好度",
};

const severityStyles = {
  high: "border-rose-200 bg-rose-50 text-rose-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

const errorMessages: Record<string, string> = {
  missing_model: "尚未配置默认模型，请先到模型设置页保存 OpenAI-compatible 配置。",
  unsupported_target: "该问题暂不支持自动优化，请回到编辑页手动修改。",
  issue_not_found: "问题已变化，请重新评分后再生成优化建议。",
  draft_not_found: "优化草稿不存在或不属于当前简历。",
  stale_draft: "目标内容已变化，请重新生成优化建议。",
  ai_failed: "AI 优化失败，请检查模型配置或稍后重试。",
};

async function optimizeIssueAction(projectId: string, resumeId: string, issueId: string) {
  "use server";

  const current = await getProjectResume(projectId, resumeId);
  if (!current) notFound();

  const score = scoreResume(current.document);
  const issue = score.issues.find((item) => item.id === issueId);
  if (!issue) redirect(`/projects/${projectId}/resumes/${resumeId}/score?error=issue_not_found`);
  if (!isSupportedIssueTargetPath(issue.targetPath)) {
    redirect(`/projects/${projectId}/resumes/${resumeId}/score?error=unsupported_target`);
  }

  const targetBullet = readIssueTargetBullet(current.document, issue.targetPath);
  if (!targetBullet?.text) redirect(`/projects/${projectId}/resumes/${resumeId}/score?error=unsupported_target`);

  let draftId: string;
  try {
    const draft = await generateIssueOptimization({
      projectId,
      resumeId,
      resumeFilePath: current.resume.filePath,
      document: current.document,
      issue,
      targetPath: issue.targetPath,
      targetBulletId: targetBullet.id,
      originalText: targetBullet.text,
    });
    draftId = draft.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("请先在模型设置")) {
      redirect(`/projects/${projectId}/resumes/${resumeId}/score?error=missing_model`);
    }
    redirect(`/projects/${projectId}/resumes/${resumeId}/score?error=ai_failed`);
  }
  redirect(`/projects/${projectId}/resumes/${resumeId}/score?draft=${draftId}`);
}

async function acceptDraftAction(projectId: string, resumeId: string, draftId: string) {
  "use server";

  const accepted = await acceptIssueOptimizationDraft({ projectId, resumeId, draftId })
    .then(() => true)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("已变化")) return "stale";
      return false;
    });

  if (accepted === true) {
    redirect(`/projects/${projectId}/resumes/${resumeId}/score`);
  }
  if (accepted === "stale") {
    redirect(`/projects/${projectId}/resumes/${resumeId}/score?draft=${draftId}&error=stale_draft`);
  }
  redirect(`/projects/${projectId}/resumes/${resumeId}/score?error=draft_not_found`);
}

export default async function ResumeScorePage({ params, searchParams }: Props) {
  const { projectId, resumeId } = await params;
  const query = await searchParams;
  const project = getProject(projectId);
  if (!project) notFound();

  const current = await getProjectResume(project.id, resumeId);
  if (!current) notFound();

  const { resume, document } = current;
  const score = scoreResume(document);
  const draft = query.draft
    ? await readIssueOptimizationDraft({ projectId: project.id, resumeId: resume.id, draftId: query.draft })
    : null;
  const errorMessage = query.error ? errorMessages[query.error] : undefined;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/projects/${project.id}/resumes/${resumeId}/edit`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
            ← 返回编辑页
          </Link>
          <Link href={`/projects/${project.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
            返回项目
          </Link>
        </div>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">评分 / 优化</p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{resume.name}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                默认评分只用本地规则，不调用外部 AI，也不会修改 confirmed 简历；单条 AI 优化需手动生成并确认接受。
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950 px-8 py-6 text-center text-white">
              <p className="text-sm text-slate-300">总分</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight">{score.total}</p>
              <p className="mt-1 text-sm text-slate-300">/ 100</p>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {errorMessage}
          </section>
        ) : null}

        {draft ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">AI 优化草稿</p>
                <h2 className="mt-2 text-xl font-semibold">接受前预览</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  草稿保存在当前简历本机 drafts 目录。接受后只改写目标 bullet，不展示本地路径。
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {draft.createdAt}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-xs font-medium text-rose-700">原文</p>
                <p className="mt-3 text-sm leading-6 text-rose-950">{draft.originalText}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-medium text-emerald-700">建议改写</p>
                <p className="mt-3 text-sm leading-6 text-emerald-950">{draft.proposedText}</p>
              </div>
            </div>
            {draft.rationale ? <p className="mt-4 text-sm leading-6 text-slate-600">理由：{draft.rationale}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <form action={acceptDraftAction.bind(null, project.id, resume.id, draft.id)}>
                <button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                  接受并写入当前简历
                </button>
              </form>
              <Link
                href={`/projects/${project.id}/resumes/${resume.id}/score`}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950"
              >
                放弃草稿
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          {(Object.entries(score.dimensions) as [ScoreDimensionKey, (typeof score.dimensions)[ScoreDimensionKey]][]).map(
            ([key, dimension]) => (
              <div key={key} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-500">{dimensionLabels[key]}</p>
                <p className="mt-3 text-3xl font-semibold">{dimension.score}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{dimension.explanation}</p>
              </div>
            ),
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold">问题列表</h2>
            {score.issues.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {score.issues.map((issue) => {
                  const canOptimize = isSupportedIssueTargetPath(issue.targetPath);
                  return (
                    <li key={issue.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {dimensionLabels[issue.dimension]}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${severityStyles[issue.severity]}`}>
                          {issue.severity}
                        </span>
                        {issue.targetPath ? <span className="text-xs text-slate-400">{issue.targetPath}</span> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{issue.message}</p>
                      {canOptimize ? (
                        <form action={optimizeIssueAction.bind(null, project.id, resume.id, issue.id)}>
                          <button className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                            生成单条 AI 优化
                          </button>
                        </form>
                      ) : (
                        <p className="mt-4 text-xs text-slate-400">该问题暂不支持自动优化，请回编辑页手动处理。</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                暂未发现高优先级问题，可继续针对目标岗位微调关键词。
              </p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold">优化建议</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              {score.suggestions.map((suggestion) => (
                <li key={suggestion} className="rounded-2xl bg-slate-50 p-4">
                  {suggestion}
                </li>
              ))}
            </ul>
            <Link
              href={`/projects/${project.id}/resumes/${resumeId}/edit`}
              className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950"
            >
              回到编辑页修改
            </Link>
            <Link
              href="/settings/models"
              className="mt-3 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950"
            >
              模型设置
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
