import Link from "next/link";
import { redirect } from "next/navigation";
import { createProject, listProjects } from "@/features/resume/storage";

export const dynamic = "force-dynamic";

const flowSteps = [
  { title: "1. 材料录入", body: "粘贴流水账、项目经历、JD 和已有简历，先落到本地 workspace，不外发。" },
  { title: "2. Grill 追问", body: "按 STARR、弱维度和 ambiguity score 一次只问一个问题，逼近可证事实。" },
  { title: "3. Tavily 评估", body: "经隐私预览确认后，联网验证 JD 覆盖、技能稀缺度、公司/项目可信信号。" },
  { title: "4. 润色与导出", body: "后续 slice 接入 candidate-only polish 与 confirmed-only 中文 DOCX，不伪造事实。" },
];

const sources = [
  "resume-alchemist 的生成流程",
  "resumify 的经历梳理",
  "shushu 的材料审计",
  "wzdnzd 的中文 Web 简历体验",
  "JadeAI / lucidRESUME / starry / deep-interview 的评估与追问方法",
];

async function createProjectAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "");
  const { project } = await createProject({ name });
  redirect(`/projects/${project.id}`);
}

export default function Home() {
  const projects = listProjects();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-stretch">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <p className="text-sm font-medium text-slate-500">简历 rmx · local-first resume workbench</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  从流水账到可验证中文简历的交互式工作台
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
                  这个项目不是模板编辑器，而是把多个简历项目的优点二开成一条闭环：录入材料、逐轮追问、联网求证、AI 候选润色、最终只导出 confirmed-only 内容。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/projects/new" className="inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800">
                  新建简历项目
                </Link>
                <Link href="/settings/models" className="inline-flex rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
                  配置 AI 模型
                </Link>
                <Link href="/settings/search" className="inline-flex rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:border-slate-950 hover:text-slate-950">
                  配置 Tavily 搜索
                </Link>
              </div>
            </div>

            <form action={createProjectAction} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold">快速开始</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">先建项目，再进入材料录入和 Grill Coach。所有内容默认保存在本机 workspace。</p>
              <label htmlFor="name" className="mt-5 block text-sm font-medium text-slate-700">项目名称</label>
              <input id="name" name="name" required placeholder="例如：2026 春招后端简历" className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900" />
              <button className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800">创建并进入项目</button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {flowSteps.map((step) => (
            <article key={step.title} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-base font-semibold text-slate-950">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">rmx 来源吸收</p>
            <h2 className="mt-2 text-2xl font-semibold">不是从零写模板，而是取长避短后二开</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              {sources.map((source) => (
                <li key={source} className="rounded-2xl bg-slate-50 px-4 py-3">{source}</li>
              ))}
            </ul>
          </div>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">已有项目</p>
                <h2 className="mt-2 text-2xl font-semibold">继续一个简历工作流</h2>
              </div>
              <Link href="/projects/new" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:border-slate-950">新建</Link>
            </div>
            {projects.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                还没有项目。创建后可以粘贴材料、跑 Grill 追问、配置 Tavily 做联网评估。
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-slate-100">
                {projects.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="mt-1 text-sm text-slate-500">进入项目页选择材料录入、Coach 或导出。</p>
                    </div>
                    <Link href={`/projects/${project.id}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:border-slate-950">打开</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <p className="text-center text-sm text-slate-500">
          隐私边界：联网搜索和 AI 调用必须经预览确认；未确认材料不会进入 confirmed 简历。
        </p>
      </div>
    </main>
  );
}
