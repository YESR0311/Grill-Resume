import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { getReachableSteps } from "@/features/profile/step-access";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { StepNav } from "@/components/profile/StepNav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 第二步·档案编辑页——工作台编辑器样式。
 * 打开即展示档案各字段，用户可自主自定义修改。
 * 此页在问答汇总完成后跳转来，或用户直接从侧栏进入已有档案。
 */
export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  const reachableSteps = await getReachableSteps(id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StepNav profileId={id} current="profile" reachableSteps={reachableSteps} />
      <div className="px-6 py-8">
        <ProfileEditor profile={profile} />
      </div>
    </div>
  );
}