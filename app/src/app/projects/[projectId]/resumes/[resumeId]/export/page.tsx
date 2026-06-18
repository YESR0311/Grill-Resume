import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buildFitExplanation } from "@/features/coach/fit-explanation-view";
import { renderExport } from "@/features/export/render";
import { project as projectLayout } from "@/features/layout/project";
import { readSession as readPipelineSession } from "@/features/pipeline/storage";
import { createExportRecord, getProject, getProjectResume, listExports, readLayoutOverrides } from "@/features/resume/storage";
import type { ExportFormat } from "@/features/resume/types";

export const dynamic = "force-dynamic";

// 单页适配档位展示（F4）：沿用 tier 颜色约定（high=emerald / medium=sky / low=amber / unrated=slate）。
// 注意此处用 FitDecision 的 "unrated"（非 F2 polish-runs-view 的 "untiered"），不强行统一 B4 类型命名。
const fitTierClass: Record<"high" | "medium" | "low" | "unrated", string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  unrated: "border-slate-200 bg-slate-50 text-slate-600",
};
const fitTierLabel: Record<"high" | "medium" | "low" | "unrated", string> = {
  high: "高价值",
  medium: "中等",
  low: "待补强",
  unrated: "未评级",
};

type Props = {
  params: Promise<{ projectId: string; resumeId: string }>;
  searchParams?: Promise<{ pipeline?: string; session?: string }>;
};

function formatLabel(value: string): string {
  if (value === "json-resume") return "JSON Resume";
  if (value === "docx-ats") return "ATS 网申 Word";
  if (value === "docx-zh-clean") return "中文 Word";
  if (value === "docx-visual") return "中文视觉 Word";
  if (value === "pdf") return "PDF";
  return "未知格式";
}

function formatHint(value: ExportFormat): string {
  if (value === "json-resume") return "导出结构化 JSON Resume，便于二次解析。";
  if (value === "docx-ats") return "扁平段落、无表格、无主题色，适合 LinkedIn / Greenhouse / 大厂 ATS 解析。";
  if (value === "docx-zh-clean") return "单栏中文 Word，只消费 confirmed 内容；未确认 bullet 不会进入文件。";
  if (value === "docx-visual") return "表格分组、主题色块、徽章，适合内推和发 HR 阅读。";
  return "导出本地生成 PDF，中文内容以当前运行环境字体能力为准。";
}

async function exportAction(projectId: string, resumeId: string, format: ExportFormat, formData: FormData) {
  "use server";

  if (String(formData.get("privacyConfirmed") ?? "") !== "1") redirect(`/projects/${projectId}/resumes/${resumeId}/export`);

  const current = await getProjectResume(projectId, resumeId);
  if (!current) notFound();
  const sessionId = String(formData.get("pipelineSessionId") ?? "").trim();
  const pipelineSession = sessionId ? await readPipelineSession(projectId, sessionId) : null;
  const pipelineSnapshot = pipelineSession?.resumeId === resumeId ? pipelineSession.exportSnapshot : undefined;
  const layoutOverrides = await readLayoutOverrides(projectId, resumeId);
  await createExportRecord({
    resumeId,
    format,
    content: await renderExport(current.document, format, {
      partialMode: String(formData.get("partialMode") ?? "") === "1",
      layoutOverrides: format === "docx-zh-clean" && !pipelineSnapshot ? layoutOverrides ?? undefined : undefined,
      layoutSchema: format === "docx-zh-clean" ? pipelineSnapshot?.layoutSchema : undefined,
      gapReport: format === "docx-zh-clean" ? pipelineSnapshot?.gapReport : undefined,
    }),
  });
  redirect(`/projects/${projectId}/resumes/${resumeId}/export`);
}

export default async function ResumeExportPage({ params, searchParams }: Props) {
  const { projectId, resumeId } = await params;
  const query = (await searchParams) ?? {};
  const project = getProject(projectId);
  if (!project) notFound();

  const current = await getProjectResume(project.id, resumeId);
  if (!current) notFound();

  const { resume, document } = current;
  const pipelineSession = query.session ? await readPipelineSession(project.id, query.session) : null;
  const pipelineSnapshot = pipelineSession?.resumeId === resume.id ? pipelineSession.exportSnapshot : undefined;

  // 单页适配说明（F4）：仅当 snapshot 带非空 fitDecisions 时计算。
  // 重新 projectLayout 拿未裁剪全集 blocks，使 hide-block 的块名也能还原（snapshot.layoutSchema 是裁剪后的）。
  const fitDecisions = pipelineSnapshot?.fitDecisions;
  const fitExplanation =
    fitDecisions && fitDecisions.length > 0
      ? buildFitExplanation({
          decisions: fitDecisions,
          // 拿未裁剪全集 blocks 还原块名（含被 hide-block 隐藏的）。overrides 只改 blockOrder/hiddenBlocks/theme/bullet 覆盖，
          // 不影响 block 的 id/org/role/name，且全集 ⊇ 任何带 overrides 的子集 ⊇ fitDecision 的 blockId，故无需读 overrides，省一次 IO。
          blocks: projectLayout(document).schema.blocks,
        })
      : null;

  const exports = listExports(resume.id);
  const formats: ExportFormat[] = ["docx-zh-clean", "json-resume", "docx-ats", "docx-visual", "pdf"];

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
          <p className="text-sm text-slate-500">导出简历</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{resume.name}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            导出文件保存在当前简历的本机 workspace exports 目录，并写入 SQLite 索引；不调用 AI，不上传云端。
          </p>
          {pipelineSnapshot ? (
            <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              来自 Pipeline — 中文 Word 导出将使用 session 中保存的同一个 LayoutSchema。
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {formats.map((format) => (
            <form key={format} action={exportAction.bind(null, project.id, resumeId, format)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold">{formatLabel(format)}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">{formatHint(format)}</p>
              <label className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
                {format === "docx-zh-clean" ? <input type="hidden" name="partialMode" value="1" /> : null}
                {pipelineSnapshot ? <input type="hidden" name="pipelineSessionId" value={pipelineSession?.id} /> : null}
                <span>我确认导出文件只应包含 confirmed 内容，并将写入本机 exports 目录。</span>
              </label>
              <button className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                生成 {formatLabel(format)}
              </button>
            </form>
          ))}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">导出记录</h2>
          {exports.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {exports.map((item) => (
                <li key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">{formatLabel(item.format)}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.createdAt}</p>
                  <Link href={`/projects/${project.id}/resumes/${resumeId}/export/${item.id}/download`} className="mt-3 inline-flex rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-950">
                    下载文件
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-slate-500">暂无导出记录。</p>
          )}
        </section>

        {fitExplanation ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold">单页适配说明</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              为把简历压进单页，本次导出裁剪了 {fitExplanation.trimmedBulletTotal} 条要点、隐藏了 {fitExplanation.hiddenBlockTotal} 个板块。
              被压缩的内容仍保留在简历数据中，只是不进入本次单页导出文件。
            </p>
            <ul className="mt-5 space-y-3">
              {fitExplanation.items.map((item) => (
                <li
                  key={`${item.action}:${item.blockId}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"
                >
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {item.action === "hide-block" ? "隐藏板块" : `裁剪要点 ×${item.removedCount}`}
                  </span>
                  <span className="font-medium text-slate-900">{item.blockLabel}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${fitTierClass[item.tier]}`}>
                    {fitTierLabel[item.tier]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">导出摘要</h2>
          <ul className="mt-5 space-y-2 text-sm text-slate-600">
            <li>姓名：{document.basics.name || "待填写"}</li>
            <li>经历：{document.experiences.length} 条</li>
            <li>项目：{document.projects.length} 条</li>
            <li>技能组：{document.skills.length} 组</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
