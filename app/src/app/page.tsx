import Link from "next/link";
import { redirect } from "next/navigation";
import { createProject, listProjects, listResumes } from "@/features/resume/storage";

export const dynamic = "force-dynamic";

async function createProjectAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "");
  const { project, resume } = await createProject({ name });
  redirect(`/w/${project.id}/${resume.id}`);
}

/**
 * 极简着陆页（Gemini 式入口）。无营销区块：只有"新建"和"继续已有项目"。
 * 每个项目跳到其 master resume 的工作区。
 */
export default function Home() {
  const projects = listProjects();
  const resumeIdByProject: Record<string, string> = {};
  for (const project of projects) {
    const master = listResumes(project.id).find((r) => r.kind === "master");
    if (master) resumeIdByProject[project.id] = master.id;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">中文简历工坊</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          本地优先。在一个对话页里完成：录入材料 → 逐题追问 → 联网评估 → 候选润色 → 导出中文 DOCX。
          未确认的内容不会进入最终简历。
        </p>
      </header>

      <form action={createProjectAction} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <label htmlFor="name" className="text-sm font-medium">
          新建简历项目
        </label>
        <div className="flex gap-2">
          <input
            id="name"
            name="name"
            required
            placeholder="例如：2026 春招后端简历"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            创建并进入
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">继续已有项目</h2>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            还没有项目。创建后即可开始对话流程。
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {projects.map((project) => {
              const resumeId = resumeIdByProject[project.id];
              const href = resumeId ? `/w/${project.id}/${resumeId}` : `/projects/${project.id}`;
              return (
                <li key={project.id}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground">打开 →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/settings/models" className="transition-colors hover:text-foreground">
          配置 AI 模型
        </Link>
        <Link href="/settings/search" className="transition-colors hover:text-foreground">
          配置 Tavily 搜索
        </Link>
      </footer>
    </main>
  );
}
