import Link from "next/link";
import { redirect } from "next/navigation";
import { createProject, listProjects, listResumes } from "@/features/resume/storage";
import { listProfiles } from "@/features/profile/store";
import { DeleteProjectButton } from "@/components/workspace/DeleteProjectButton";
import { nanoid } from "nanoid";
import { createProfile } from "@/features/profile/store";

export const dynamic = "force-dynamic";

async function createProjectAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "");
  const { project, resume } = await createProject({ name });
  redirect(`/w/${project.id}/${resume.id}`);
}

async function createIntakeAction() {
  "use server";
  const id = nanoid(10);
  createProfile({ id });
  redirect(`/intake/${id}`);
}

/**
 * 首页：新旧双入口。新档案（三步流）和旧项目（单页工作区）。
 */
export default function Home() {
  const projects = listProjects();
  const profiles = listProfiles();
  const resumeIdByProject: Record<string, string> = {};
  for (const project of projects) {
    const master = listResumes(project.id).find((r) => r.kind === "master");
    if (master) resumeIdByProject[project.id] = master.id;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">简历工坊</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          三步生成文档：问答建档 → 逐条评估 → 综合润色导出。本地优先。
        </p>
      </header>

      {/* 新：问答建档入口 */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium">开始三步流程（问答建档）</h2>
        <form action={createIntakeAction}>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            新建档案
          </button>
        </form>
        {profiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">已有档案</p>
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/profile/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="truncate font-medium">{p.name || "未命名档案"}</span>
                <span className="text-xs text-muted-foreground">
                  {p.intakeStatus.phase === "ready" ? "已就绪" : p.intakeStatus.phase}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 旧：项目入口 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">旧项目（单页工作区）</h2>
        <form action={createProjectAction} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <label htmlFor="name" className="text-sm font-medium">新建项目</label>
          <div className="flex gap-2">
            <input
              id="name"
              name="name"
              required
              placeholder="例如：2026 春招后端"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              创建
            </button>
          </div>
        </form>
        {projects.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {projects.map((project) => {
              const resumeId = resumeIdByProject[project.id];
              const href = resumeId ? `/w/${project.id}/${resumeId}` : `/projects/${project.id}`;
              return (
                <li key={project.id} className="group flex items-center gap-1 pr-2 transition-colors hover:bg-secondary">
                  <Link href={href} className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3.5 text-sm">
                    <span className="truncate font-medium">{project.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">打开 →</span>
                  </Link>
                  <DeleteProjectButton projectId={project.id} projectName={project.name} className="px-2 py-1 text-base opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100" />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            暂无项目。
          </p>
        )}
      </section>

      <footer className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/settings" className="transition-colors hover:text-foreground">
          设置（AI 连接 + 搜索渠道）
        </Link>
      </footer>
    </main>
  );
}