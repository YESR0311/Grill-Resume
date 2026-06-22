import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { getReachableSteps } from "@/features/profile/step-access";
import { AppLayoutWithSidebar } from "@/components/layout/AppLayoutWithSidebar";
import { StepNavSidebar } from "@/components/layout/StepNavSidebar";
import { PolishView } from "@/components/polish/PolishView";
import { StepNav } from "@/components/profile/StepNav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 润色页：侧边栏显示步骤导航 + 顶部导航 + 编辑器主区
 */
export default async function PolishPage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  const reachableSteps = await getReachableSteps(id);

  return (
    <AppLayoutWithSidebar
      sidebar={
        <StepNavSidebar
          currentStep="polish"
          reachableSteps={reachableSteps}
          profileId={id}
        />
      }
    >
      <div className="flex h-full flex-col bg-background">
        <StepNav profileId={id} current="polish" reachableSteps={reachableSteps} />
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <PolishView profileId={id} />
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}