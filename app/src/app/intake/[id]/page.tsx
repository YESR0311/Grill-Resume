import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { getReachableSteps } from "@/features/profile/step-access";
import { getIntakeLog } from "@/features/intake/store";
import { buildOpeningMessage } from "@/features/intake/engine";
import { AppLayoutWithSidebar } from "@/components/layout/AppLayoutWithSidebar";
import { IntakeProgress } from "@/components/layout/IntakeProgress";
import { IntakeWorkspace } from "@/components/intake/IntakeWorkspace";
import { StepNav } from "@/components/profile/StepNav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 问答页：侧边栏显示问答进度 + 顶部导航 + 对话主区
 */
export default async function IntakePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  const reachableSteps = await getReachableSteps(id);
  const log = await getIntakeLog(id);
  const messages =
    log.messages.length > 0
      ? log.messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: "assistant" as const, content: buildOpeningMessage().content }];

  return (
    <AppLayoutWithSidebar sidebar={<IntakeProgress profileId={id} />}>
      <div className="flex h-full flex-col">
        <StepNav profileId={id} current="intake" reachableSteps={reachableSteps} />
        <div className="flex-1 overflow-hidden">
          <IntakeWorkspace profile={profile} initialMessages={messages} />
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}