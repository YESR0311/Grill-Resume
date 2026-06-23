import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { getReachableSteps } from "@/features/profile/step-access";
import { getIntakeLogByDimension } from "@/features/intake/store";
import { DIMENSION_OPENING, INTAKE_DIMENSIONS, type IntakeDimension } from "@/features/intake/dimensions";
import { AppLayoutWithSidebar } from "@/components/layout/AppLayoutWithSidebar";
import { StepNavSidebar } from "@/components/layout/StepNavSidebar";
import { IntakeWorkspace } from "@/components/intake/IntakeWorkspace";
import { StepNav } from "@/components/profile/StepNav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 问答页（intake-v2）：6 阶段自由对话。
 * - currentDimension 来自 profile.intakeStatus.phase（ready 时回落到 basics 让用户补充）。
 * - 只加载当前阶段的对话历史；首次进入该阶段时用开场白。
 * - 侧边栏 StepNavSidebar + IntakeProgress（纯展示）。
 */
export default async function IntakePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  const reachableSteps = await getReachableSteps(id);

  // phase=ready 时回落到 basics（让用户可重新补充任意阶段）
  const phase = profile.intakeStatus.phase;
  const currentDimension: IntakeDimension =
    phase === "ready" || !INTAKE_DIMENSIONS.includes(phase as IntakeDimension)
      ? "basics"
      : (phase as IntakeDimension);

  // 解析/读取对话失败时降级为空历史（让 UI 走开场白），不要让整页 500。
  const log = await getIntakeLogByDimension(id, currentDimension).catch((err) => {
    console.error("[intake page] getIntakeLogByDimension failed:", err);
    return { profileId: id, dimension: currentDimension, messages: [] };
  });
  const messages =
    log.messages.length > 0
      ? log.messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: "assistant" as const, content: DIMENSION_OPENING[currentDimension] }];

  return (
    <AppLayoutWithSidebar
      sidebar={
        <StepNavSidebar
          currentStep="intake"
          reachableSteps={reachableSteps}
          profileId={id}
        />
      }
    >
      <div className="flex h-full flex-col">
        <StepNav profileId={id} current="intake" reachableSteps={reachableSteps} />
        <div className="flex-1 overflow-hidden">
          <IntakeWorkspace
            profile={profile}
            initialDimension={currentDimension}
            initialMessages={messages}
          />
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}
