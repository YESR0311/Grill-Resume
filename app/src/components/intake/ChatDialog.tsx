"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { LogOut, Send, CheckCircle2 } from "lucide-react";

import { sendChatTurnAction } from "@/app/intake/[id]/actions";
import type { IntakeDimension } from "@/features/intake/dimensions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ChatDialogHandle = {
  /** 输入框是否处于「打字中」（有内容或已聚焦），用于跳转前保护。 */
  isTyping: () => boolean;
};

interface ChatDialogProps {
  profileId: string;
  /** 当前对话阶段 */
  dimension: IntakeDimension;
  initialMessages: Message[];
  /** 阶段完成（AI 判定 or 用户主动）：外层负责解析 + 切下一阶段。 */
  onPhaseComplete?: () => void;
  /** 退出问答 */
  onExit?: () => void;
  /** 是否正在后台推进（解析中）：禁用输入 */
  advancing?: boolean;
}

export const ChatDialog = forwardRef<ChatDialogHandle, ChatDialogProps>(
  function ChatDialog(
    { profileId, dimension, initialMessages, onPhaseComplete, onExit, advancing },
    ref,
  ) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const focusedRef = useRef(false);

    // 阶段切换时重置对话区为新阶段的开场白
    useEffect(() => {
      setMessages(initialMessages);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dimension]);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = useCallback(
      async (raw: string) => {
        const text = raw.trim();
        if (!text || sending || advancing) return;
        setInput("");
        setSending(true);

        // 乐观追加用户消息
        setMessages((prev) => [...prev, { role: "user", content: text }]);

        try {
          const data = await sendChatTurnAction(profileId, dimension, text);
          if (data.error) {
            setMessages((prev) => [...prev, { role: "assistant", content: data.error! }]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
            // AI 判定阶段完成 → 静默触发推进
            if (data.phaseComplete) {
              onPhaseComplete?.();
            }
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "请求失败，请重试。" },
          ]);
        } finally {
          setSending(false);
        }
      },
      [sending, advancing, profileId, dimension, onPhaseComplete],
    );

    useImperativeHandle(
      ref,
      () => ({
        isTyping: () => input.trim().length > 0 || focusedRef.current,
      }),
      [input],
    );

    const busy = sending || advancing;

    return (
      <div className="flex h-full flex-col">
        {/* 控制按钮 */}
        <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-2">
          <button
            onClick={() => onPhaseComplete?.()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="结束当前阶段，进入下一步"
          >
            <CheckCircle2 size={14} />
            我先到这里
          </button>
          {onExit && (
            <button
              onClick={onExit}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <LogOut size={14} />
              退出
            </button>
          )}
        </div>

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
              placeholder={advancing ? "正在整理本阶段信息…" : "输入你的回答…"}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  },
);
