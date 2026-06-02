import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createVariantFromMaster, getProject, listProjectExports, listResumes, readResume } from "@/features/resume/storage";
import type { ResumeDocument, ResumeRecord } from "@/features/resume/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string }>;
};

const nextActions = [
  { title: "材料录入", body: "粘贴原始经历、流水账或旧简历，先生成本地候选材料。", href: "intake", primary: false },
  { title: "Grill Coach", body: "按弱维度追问、证据图、JD coverage 和 Tavily cited evaluation 推进。", href: "coach", primary: true },
  { title: "AI 模型", body: "保存 OpenAI-compatible provider，供后续润色与提取使用。", href: "/settings/models", primary: false },
  { title: "Tavily 搜索", body: "保存 Tavily key，联网评估前仍会显示隐私预览门。", href: "/settings/search", primary: false },
  { title: "候选润色", body: "对 confirmed bullets 生成保守 / 平衡 / 激进三版候选。", href: "coach/polish", primary: false },
];

async function createVariantAction(projectId: string, formData: FormData) {
  "use server";

  const variant = await createVariantFromMaster({
    projectId,
    title: String(formData.get("title") ?? "").trim(),
    targetRole: String(formData.get("targetRole") ?? "").trim() || undefined,
    targetJd: String(formData.get("targetJd") ?? "").trim() || undefined,
  });
  redirect(`/projects/${projectId}/resumes/${variant.id}/edit`);
}

function ResumeLinks({ projectId, resume }: { projectId: string; resume: ResumeRecord }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={`/projects/${projectId}/resumes/${resume.id}/edit`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
        编辑简历
      </Link>
      <Link href={`/projects/${projectId}/resumes/${resume.id}/score`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
        评分/优化
      </Link>
      <Link href={`/projects/${projectId}/resumes/${resume.id}/export`} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
        导出
      </Link>
    </div>
  );
}

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const resumes = listResumes(project.id);
  const recentExports = listProjectExports(project.id);
  const master = resumes.find((resume) => resume.kind === "master");
  const variants = resumes.filter((resume) => resume.kind === "variant");
  let document: ResumeDocument | null = null;
  let resumeError: string | null = null;

  if (master) {
    try {
      document = await readResume(master.filePath);
    } catch (error) {
      resumeError = error instanceof Error ? error.message : "简历文件读取失败";
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
          ← 返回仪表盘
        </Link>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">项目总览 · rmx resume workflow</p>
          <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                推荐路径：先补材料，再进入 Grill Coach 追问事实；配置 Tavily 后可做带引用的市场评估。润色和中文 DOCX 是后续 slice，不在当前页面伪装完成。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/projects/${project.id}/coach`} className="inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                进入 Grill Coach
              </Link>
              <Link href={`/projects/${project.id}/intake`} className="inline-flex rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
                粘贴材料
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          {nextActions.map((action) => {
            const href = action.href.startsWith("/") ? action.href : `/projects/${project.id}/${action.href}`;
            return (
              <Link key={action.title} href={href} className={`rounded-3xl p-5 shadow-sm ring-1 ${action.primary ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-950 ring-slate-200 hover:ring-slate-300"}`}>
                <h2 className="text-base font-semibold">{action.title}</h2>
                <p className={`mt-3 text-sm leading-6 ${action.primary ? "text-slate-200" : "text-slate-600"}`}>{action.body}</p>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">confirmed-only 基线</p>
                <h2 className="mt-2 text-xl font-semibold">主简历</h2>
              </div>
              {master ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">已初始化</span> : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">待初始化</span>}
            </div>
            {resumeError ? (
              <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{resumeError}</p>
            ) : master && document ? (
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p>姓名：{document.basics.name || "待填写"}</p>
                <p>模板：{document.template.id}</p>
                <p>经历：{document.experiences.length} 条 · 项目：{document.projects.length} 条 · 技能组：{document.skills.length} 组</p>
                <p>目标关键词：{document.target?.keywords?.length ?? 0} 个</p>
                <ResumeLinks projectId={project.id} resume={master} />
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">主简历尚未初始化。先用材料录入创建候选内容，再逐项确认。</p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">JD 定制</p>
            <h2 className="mt-2 text-xl font-semibold">岗位版简历</h2>
            <form action={createVariantAction.bind(null, project.id)} className="mt-5 space-y-3">
              <input name="title" placeholder="岗位版名称" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input name="targetRole" placeholder="目标岗位" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <textarea name="targetJd" placeholder="粘贴 JD（可选，会驱动 coverage 与 Tavily 评估）" className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <button disabled={!master} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                从主简历创建岗位版
              </button>
            </form>
            {variants.length > 0 ? (
              <div className="mt-6 space-y-4">
                {variants.map((resume) => (
                  <div key={resume.id} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{resume.name}</p>
                    {resume.targetRole ? <p className="mt-1">目标岗位：{resume.targetRole}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">更新于：{resume.updatedAt}</p>
                    <div className="mt-3"><ResumeLinks projectId={project.id} resume={resume} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">暂无岗位版。粘贴 JD 后创建，Coach 会按目标岗位重排追问和 coverage。</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">交付状态</p>
              <h2 className="mt-2 text-xl font-semibold">最近导出</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">DOCX 子任务待接入</span>
          </div>
          {recentExports.length > 0 ? (
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {recentExports.map((item) => (
                <li key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{item.format}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.createdAt}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-slate-500">暂无导出记录。当前重点是材料确认、Grill 追问和 Tavily 评估。</p>
          )}
        </section>
      </div>
    </main>
  );
}
