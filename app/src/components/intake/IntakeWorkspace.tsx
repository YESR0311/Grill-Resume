"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { ChatDialog, type ChatDialogHandle } from "./ChatDialog";
import { IntakeSidebar } from "./IntakeSidebar";
import type { PersonProfile } from "@/features/profile/types";

type Message = { role: "user" | "assistant"; content: string };

/**
 * 问答页工作台：组合侧栏 + 对话框，并在二者间共享发送/结束逻辑（design §3.2）。
 * - 「跳过当前问题」复用 ChatDialog.send 发送跳过提示
 * - 「结束问答」由用户主动触发跳转；打字中则延迟，避免输入丢失（H6）
 */
export function IntakeWorkspace({
  profile,
  initialMessages,
}: {
  profile: PersonProfile;
  initialMessages: Message[];
}) {
  const chatRef = useRef<ChatDialogHandle>(null);
  const [pendingEnd, setPendingEnd] = useState(false);
  const router = useRouter();

  const navigateToProfile = useCallback(() => {
    router.push(`/profile/${profile.id}`);
  }, [router, profile.id]);

  const handleSkip = useCallback(() => {
    chatRef.current?.send("跳过当前问题，请继续追问下一个维度。");
  }, []);

  const handleEnd = useCallback(() => {
    // 打字中保护：若用户正在输入，则标记待跳转，等其提交/失焦后再走
    if (chatRef.current?.isTyping()) {
      setPendingEnd(true);
      return;
    }
    navigateToProfile();
  }, [navigateToProfile]);

  const handleExit = useCallback(() => {
    router.push("/");
  }, [router]);

  // 待跳转：用户提交后若不再处于打字中，则完成结束问答的跳转
  const handleAfterSend = useCallback(() => {
    if (pendingEnd && !chatRef.current?.isTyping()) {
      setPendingEnd(false);
      navigateToProfile();
    }
  }, [pendingEnd, navigateToProfile]);

  return (
    <div className="flex h-screen overflow-hidden">
      <IntakeSidebar
        profile={profile}
        pendingEnd={pendingEnd}
        onSkip={handleSkip}
        onEnd={handleEnd}
        onExit={handleExit}
      />
      <main className="flex flex-1 flex-col">
        <ChatDialog
          ref={chatRef}
          profileId={profile.id}
          initialMessages={initialMessages}
          onAfterSend={handleAfterSend}
        />
      </main>
    </div>
  );
}
