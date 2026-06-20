import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { EvaluateView } from "@/components/evaluate/EvaluateView";
import { StepNav } from "@/components/profile/StepNav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 第二步·评估页——根据档案信息，尤其是经历部分逐条联网评估。
 * 从档案编辑页跳转过来，评估完成后进入润色。
 */
export default async function EvaluatePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StepNav profileId={id} current="evaluate" />
      <div className="px-6 py-8">
        <EvaluateView profileId={id} />
      </div>
    </div>
  );
}