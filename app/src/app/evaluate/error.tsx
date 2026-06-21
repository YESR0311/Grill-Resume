"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** 评估路由错误边界（Sprint 6.6）。 */
export default function EvaluateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("evaluate route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">评估页加载失败</h2>
      <p className="text-sm text-muted-foreground">请稍后重试，或返回档案页。</p>
      <Button size="lg" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
