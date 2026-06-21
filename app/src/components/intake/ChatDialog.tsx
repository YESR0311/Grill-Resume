"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { sendIntakeMessageAction } from "@/app/intake/[id]/actions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ChatDialogHandle = {
  /** 输入框是否处于「打字中」（有内容或已聚焦），用于跳转前保护。 */
  isTyping: () => boolean;
  /** 发送一条消息（供侧栏「跳过」按钮复用）。 */
  send: (text: string) => void;
};

export const ChatDialog = forwardRef<
  ChatDialogHandle,
  {
    profileId: string;
    initialMessages: Message[];
    /** 每轮发送完成后触发（无论成功/失败），用于待跳转的延迟处理。 */
    onAfterSend?: () => void;
  }
>(function ChatDialog({ profileId, initialMessages, onAfterSend }, ref) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      setInput("");
      setSending(true);

      // 乐观追加用户消息
      setMessages((prev) => [...prev, { role: "user", content: text }]);

      try {
        const data = await sendIntakeMessageAction(profileId, text);
        if (data.error) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.error! }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
          // 注意：不再因 data.ready 自动跳转。
          // 结束问答完全由用户通过侧栏「结束问答」按钮主动触发（design §3.2）。
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "请求失败，请重试。" },
        ]);
      } finally {
        setSending(false);
        onAfterSend?.();
      }
    },
    [sending, profileId, onAfterSend],
  );

  useImperativeHandle(
    ref,
    () => ({
      isTyping: () => input.trim().length > 0 || focusedRef.current,
      send: (text: string) => void send(text),
    }),
    [input, send],
  );

  // 避免未使用变量告警（router 保留以备将来跳转复用）
  void router;

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
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={() => {
              focusedRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
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
});
