import Link from "next/link";
import type { ProjectRecord } from "@/features/resume/types";
import type { PipelineSession } from "@/features/pipeline";
import { StageProgress } from "./StageProgress";
import { cn } from "@/lib/utils";

export type SidebarProps = {
  projects: ProjectRecord[];
  /** 当前打开的 project / resume，用于高亮与进度。 */
  currentProjectId: string;
  currentResumeId: string;
  session: PipelineSession | null;
  /** projectId → 该项目 master resumeId，用于列表项跳转。 */
  resumeIdByProject: Record<string, string>;
};

/**
 * 左侧栏（Gemini 式）：上半项目列表，下半当前流程进度。
 * RSC 友好——只收 plain props，链接走 Link。
 */
export function Sidebar({
  projects,
  currentProjectId,
  currentResumeId,
  session,
  resumeIdByProject,
}: SidebarProps) {
  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          简历工坊
        </Link>
        <Link
          href="/projects/new"
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          新建
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <p className="px-2.5 py-2 text-xs font-medium text-muted-foreground">项目</p>
        <ul className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const resumeId = resumeIdByProject[project.id];
            const isActive = project.id === currentProjectId;
            const href = resumeId ? `/w/${project.id}/${resumeId}` : `/projects/${project.id}`;
            return (
              <li key={project.id}>
                <Link
                  href={href}
                  className={cn(
                    "block truncate rounded-md px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {project.name}
                </Link>
              </li>
            );
          })}
          {projects.length === 0 && (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">还没有项目</li>
          )}
        </ul>
      </div>

      <div className="border-t border-border px-3 py-4">
        <p className="px-2.5 pb-2 text-xs font-medium text-muted-foreground">当前流程</p>
        <StageProgress session={session} />
      </div>

      <div className="border-t border-border px-4 py-3">
        <Link
          href="/settings/models"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          设置
        </Link>
        {/* currentResumeId 预留给后续会话切换 */}
        <span className="sr-only">{currentResumeId}</span>
      </div>
    </nav>
  );
}
