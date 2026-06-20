import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { PolishView } from "@/components/polish/PolishView";
import { StepNav } from "@/components/profile/StepNav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 第三步·润色页——综合档案和评估报告，润色生成简历草稿，支持导出。
 */
export default async function PolishPage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StepNav profileId={id} current="polish" />
      <div className="px-6 py-8">
        <PolishView profileId={id} />
      </div>
    </div>
  );
}