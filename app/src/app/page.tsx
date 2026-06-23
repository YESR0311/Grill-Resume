import { HomeHero } from "@/components/landing/HomeHero";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { HistoryProjects, NewProjectButton } from "@/components/landing/HistoryProjects";
import { listProfiles } from "@/features/profile/store";

export const dynamic = "force-dynamic";

/**
 * 首页：引导页（Hero + Feature + 历史项目）
 *
 * 与问答页面分离：
 * - 首页 = 价值引导入口
 * - /intake/[id] = 深度问答采集
 */
export default function Home() {
  const profiles = listProfiles();

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <HomeHero />
        <FeatureCards />

        {profiles.length > 0 && (
          <>
            <HistoryProjects profiles={profiles} />
            <NewProjectButton />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>问答式简历生成器</span>
          <div className="flex items-center gap-4">
            <a
              href="/settings"
              className="hover:text-foreground hover:underline"
            >
              设置
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
