"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { IntakeSidebar } from "./IntakeSidebar";
import { startIntakeAction } from "@/app/actions";
import { createEmptyProfile } from "@/features/profile/types";

type Message = { role: "user" | "assistant"; content: string };

/**
 * 首页问答工作台（P1-a + P1-b）。
 *
 * - 惰性建档：首页渲染时不建档。用户发出第一条消息时，startIntakeAction
 *   才 createProfile + 跑首轮问答，返回新 profileId。
 * - 首页即对话入口：与 /intake/[id] 一样有可收纳侧栏（跳过/结束/退出）。
 *   建档前 profileId 为空，侧栏「跳过/结束」禁用并提示「请先开始对话」；
 *   「退出」始终可用。
 * - 平滑过渡：拿到 id 后 router.replace('/intake/[id]')，把多轮问答交给
 *   IntakeWorkspace，避免在首页重复整套问答逻辑。
 */
export function HomeIntake({ openingMessage }: { openingMessage: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: openingMessage },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 首页期间的占位档案，仅供侧栏渲染（进度全空、姓名空）。
  const placeholderProfile = createEmptyProfile({ id: "" });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const data = await startIntakeAction(text);
      if (data.error || !data.profileId) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "请求失败，请重试。" },
        ]);
        setSending(false);
        return;
      }
      // 建档成功：跳到正规问答页，后续多轮由 IntakeWorkspace 接管。
      // 保持 sending=true，避免跳转前用户重复提交。
      router.replace(`/intake/${data.profileId}`);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "请求失败，请重试。" },
      ]);
      setSending(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <IntakeSidebar
        profile={placeholderProfile}
        endDisabled
        endDisabledHint="请先开始对话——发送第一条消息后即可跳过或结束问答。"
        onExit={() => router.push("/")}
      />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex h-full max-w-3xl flex-col">
          {/* 对话气泡区 */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  正在汇总您的档案信息…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 输入区 */}
          <div className="border-t border-border px-4 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="先把你能想起来的经历、项目、技能、教育背景写出来…"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
