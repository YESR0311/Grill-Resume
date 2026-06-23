"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { ChatDialog } from "./ChatDialog";
import { advanceDimensionAction } from "@/app/intake/[id]/actions";
import {
  DIMENSION_OPENING,
  type IntakeDimension,
} from "@/features/intake/dimensions";
import type { PersonProfile } from "@/features/profile/types";

type Message = { role: "user" | "assistant"; content: string };

/**
 * 问答页工作台（intake-v2）：6 阶段自由对话 + 后台静默解析。
 *
 * - 维护 currentDimension：当前对话阶段。
 * - AI 判定（phaseComplete）或用户点「我先到这里」→ 调 advanceDimensionAction 解析+推进。
 * - 解析在后台静默执行（仅禁用输入，不弹 loading/toast）。
 * - 最后阶段完成 → 跳转 /profile/[id]。
 *
 * 侧边栏（StepNavSidebar + IntakeProgress 纯展示）已在 AppLayoutWithSidebar 渲染。
 */
export function IntakeWorkspace({
  profile,
  initialDimension,
  initialMessages,
}: {
  profile: PersonProfile;
  /** 启动阶段（来自 profile.intakeStatus.phase；ready 时回落 basics） */
  initialDimension: IntakeDimension;
  /** 当前阶段的历史消息（为空时用开场白） */
  initialMessages: Message[];
}) {
  const router = useRouter();

  const [dimension, setDimension] = useState<IntakeDimension>(initialDimension);
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0
      ? initialMessages
      : [{ role: "assistant", content: DIMENSION_OPENING[initialDimension] }],
  );
  const [advancing, setAdvancing] = useState(false);

  const navigateToProfile = useCallback(() => {
    router.push(`/profile/${profile.id}`);
  }, [router, profile.id]);

  // 阶段完成：后台解析 + 推进。
  const handlePhaseComplete = useCallback(
    async () => {
      if (advancing) return;
      setAdvancing(true);
      try {
        const { next } = await advanceDimensionAction(profile.id, dimension);
        if (next === "ready") {
          navigateToProfile();
          return;
        }
        // 切到下一阶段，重置对话为新阶段开场白
        setDimension(next);
        setMessages([{ role: "assistant", content: DIMENSION_OPENING[next] }]);
      } finally {
        setAdvancing(false);
      }
    },
    [advancing, profile.id, dimension, navigateToProfile],
  );

  const handleExit = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="flex h-full flex-col">
      <ChatDialog
        key={dimension}
        profileId={profile.id}
        dimension={dimension}
        initialMessages={messages}
        onPhaseComplete={handlePhaseComplete}
        onExit={handleExit}
        advancing={advancing}
      />
    </div>
  );
}
