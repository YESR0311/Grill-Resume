import Link from "next/link";
import { redirect } from "next/navigation";
import { createProject } from "@/features/resume/storage";

export const dynamic = "force-dynamic";

async function createProjectAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "");
  const { project } = await createProject({ name });
  redirect(`/projects/${project.id}`);
}

export default function NewProjectPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
          ← 返回仪表盘
        </Link>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">分步向导 · 项目入口</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">新建简历工作流</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            创建后先进入项目总览，再选择材料录入或 Grill Coach。这样不会把你丢进空编辑器，也能看清 Tavily、AI 模型、后续 DOCX 的接入位置。
          </p>

          <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">先录入</p>
              <p className="mt-2">粘贴流水账和 JD，生成待确认候选。</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">再追问</p>
              <p className="mt-2">Grill Coach 补证据、指标和结果。</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">再评估</p>
              <p className="mt-2">配置 Tavily 后做带引用的客观检查。</p>
            </div>
          </div>

          <form action={createProjectAction} className="mt-8 rounded-2xl border border-slate-200 p-5">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              项目名称
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="例如：2026 春招后端简历"
              className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
            />
            <button className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800">
              创建并进入项目总览
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
