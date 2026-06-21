import Link from "next/link";
import { listProfiles } from "@/features/profile/store";
import { HomeIntake } from "@/components/intake/HomeIntake";
import { buildOpeningMessage } from "@/features/intake/engine";

export const dynamic = "force-dynamic";

/**
 * 首页：直接进入问答工作台（design §5.1）。
 *
 * 惰性建档（P1-a）：渲染时不再 createProfile，避免每次 GET 落库空 profile
 * 累积孤儿空档案。建档在 HomeIntake 内由用户首条消息触发。
 * 首页问答工作台（P1-b）：HomeIntake 含可收纳侧栏（跳过/结束/退出），
 * 建档前出口禁用，建档后 router.replace 到 /intake/[id] 由 IntakeWorkspace 接管。
 * 底部保留「已有档案」入口（点击进入对应问答页）。
 */
export default async function Home() {
  const profiles = listProfiles();
  const opening = buildOpeningMessage().content;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">简历工坊</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            三步生成文档：问答建档 → 逐条评估 → 综合润色导出。本地优先，数据不上传。
          </p>
        </div>
        <Link
          href="/settings"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          设置
        </Link>
      </header>

      {/* 主区：首页问答工作台（侧栏 + 对话框，惰性建档） */}
      <div className="flex-1 overflow-hidden">
        <HomeIntake openingMessage={opening} />
      </div>

      {/* 已有档案入口 */}
      {profiles.length > 0 && (
        <footer className="border-t border-border px-6 py-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">已有档案</p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/intake/${p.id}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                {p.name || "未命名档案"}
              </Link>
            ))}
          </div>
        </footer>
      )}
    </main>
  );
}
