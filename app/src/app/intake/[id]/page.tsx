import { notFound } from "next/navigation";
import { getProfile } from "@/features/profile/store";
import { getIntakeLog } from "@/features/intake/store";
import { buildOpeningMessage } from "@/features/intake/engine";
import { IntakeWorkspace } from "@/components/intake/IntakeWorkspace";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * 第一步：问答页（极简）。
 * 设计：可收纳左侧栏 + 主区仅保留对话框。主体不放任何多余内容。
 * AI 引导式提问，辅导用户梳理经历，后台自动汇总到档案。
 */
export default async function IntakePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();

  const log = await getIntakeLog(id);
  const messages =
    log.messages.length > 0
      ? log.messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: "assistant" as const, content: buildOpeningMessage().content }];

  return <IntakeWorkspace profile={profile} initialMessages={messages} />;
}