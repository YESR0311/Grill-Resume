import { AppLayoutWithSidebar } from "@/components/layout/AppLayoutWithSidebar";
import { ProfileList } from "@/components/layout/ProfileList";
import { HomeIntake } from "@/components/intake/HomeIntake";
import { buildOpeningMessage } from "@/features/intake/engine";

export const dynamic = "force-dynamic";

/**
 * 首页：侧边栏显示档案列表 + 主区问答工作台
 * 惰性建档（P1-a）：建档在 HomeIntake 内由用户首条消息触发
 */
export default async function Home() {
  const opening = buildOpeningMessage().content;

  return (
    <AppLayoutWithSidebar sidebar={<ProfileList />}>
      <div className="flex h-full flex-col">
        <HomeIntake openingMessage={opening} />
      </div>
    </AppLayoutWithSidebar>
  );
}
