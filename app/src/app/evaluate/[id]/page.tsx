import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { getReachableSteps } from "@/features/profile/step-access";
import { AppLayoutWithSidebar } from "@/components/layout/AppLayoutWithSidebar";
import { StepNavSidebar } from "@/components/layout/StepNavSidebar";
import { EvaluateView } from "@/components/evaluate/EvaluateView";
import { StepNav } from "@/components/profile/StepNav";
import { buildEvalUnits } from "@/features/evaluation/engine";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 评估页：侧边栏显示步骤导航 + 顶部导航 + 评估主区
 */
export default async function EvaluatePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  const reachableSteps = await getReachableSteps(id);
  const units = buildEvalUnits(profile);
  const summary = {
    name: profile.name,
    title: profile.title,
    unitCount: units.length,
  };

  return (
    <AppLayoutWithSidebar
      sidebar={
        <StepNavSidebar
          currentStep="evaluate"
          reachableSteps={reachableSteps}
          profileId={id}
        />
      }
    >
      <div className="flex h-full flex-col bg-background">
        <StepNav profileId={id} current="evaluate" reachableSteps={reachableSteps} />
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <EvaluateView profileId={id} summary={summary} />
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}