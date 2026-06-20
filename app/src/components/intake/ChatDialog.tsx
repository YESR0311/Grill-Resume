"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { sendIntakeMessageAction } from "@/app/intake/[id]/actions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChatDialog({
  profileId,
  initialMessages,
}: {
  profileId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // 乐观追加用户消息
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const data = await sendIntakeMessageAction(profileId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.ready) {
        setTimeout(() => router.push(`/profile/${profileId}`), 1500);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "请求失败，请重试。" },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, profileId, router]);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* 对话气泡区 */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <p className="pt-12 text-center text-sm text-muted-foreground">
            正在加载对话…
          </p>
        )}
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
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t border-border px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="输入你的回答…"
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
  );
}