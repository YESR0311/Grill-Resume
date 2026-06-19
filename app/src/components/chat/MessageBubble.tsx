"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { measureBlockHeight } from "@/lib/pretext/measure";
import { questionKindLabel } from "@/lib/chat-projection";
import type { ChatMessage } from "@/lib/chat-projection";
import { Badge } from "@/components/ui/badge";

/**
 * 对话气泡。pretext 真实绑定点（design §4.1 #2）：长文本气泡挂载时用
 * measureBlockHeight 预算高度，设 min-height 防止后续内容/流式追加引发 layout shift。
 *
 * font 单一来源：用 getComputedStyle 读气泡自身渲染的 font（避免 geist CSS 变量
 * 哈希化导致的 font 字符串漂移——pretext 头号坑）。非浏览器 / 短文本跳过测量。
 */

const MEASURE_THRESHOLD = 64; // 短文本不值得测；只对可能折行的长文预算

export function MessageBubble({ message }: { message: ChatMessage }) {
  const ref = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);
  const isUser = message.role === "user";
  const text = message.kind === "answer" ? message.text : message.prompt;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || text.length < MEASURE_THRESHOLD) return;
    const cs = getComputedStyle(el);
    const lineHeight = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.5;
    const width = el.clientWidth - (Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight));
    if (!(width > 0)) return;
    const result = measureBlockHeight(text, width, {
      font: cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
      lineHeight,
      letterSpacing: Number.parseFloat(cs.letterSpacing) || undefined,
    });
    if (result) {
      const vGap = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
      setMinHeight(Math.ceil(result.height + vGap));
    }
  }, [text]);

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground",
        )}
      >
        {message.kind === "question" ? (
          <div className="mb-1.5 flex items-center gap-2">
            <Badge variant="secondary">{questionKindLabel(message.questionKind)}</Badge>
            <span className="text-xs text-muted-foreground">{message.targetLabel}</span>
          </div>
        ) : null}
        <div ref={ref} style={minHeight ? { minHeight } : undefined} className="whitespace-pre-line">
          {text}
        </div>
        {message.kind === "answer" && message.status !== "confirmed" ? (
          <p className={cn("mt-1.5 text-xs", isUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {message.status === "draft" ? "草稿" : "已标记不用"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
