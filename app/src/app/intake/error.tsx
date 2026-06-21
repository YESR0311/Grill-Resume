"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * 问答路由错误边界（Sprint 6.6）。
 * 渲染中文可读错误，不暴露堆栈/绝对路径（spec error-handling）。
 */
export default function IntakeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("intake route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">问答页加载失败</h2>
      <p className="text-sm text-muted-foreground">请稍后重试，或返回首页重新开始。</p>
      <Button size="lg" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
