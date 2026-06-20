import Link from "next/link";
import { redirect } from "next/navigation";
import { listProfiles, createProfile } from "@/features/profile/store";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

async function createIntakeAction() {
  "use server";
  const id = nanoid(10);
  createProfile({ id });
  redirect(`/intake/${id}`);
}

/**
 * 首页：三步流入口（问答建档 → 评估 → 润色导出）。
 */
export default function Home() {
  const profiles = listProfiles();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">简历工坊</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          三步生成文档：问答建档 → 逐条评估 → 综合润色导出。本地优先。
        </p>
      </header>

      {/* 问答建档入口 */}
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

      <footer className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/settings" className="transition-colors hover:text-foreground">
          设置（AI 连接 + 搜索渠道）
        </Link>
      </footer>
    </main>
  );
}
