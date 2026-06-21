"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** 档案路由错误边界（Sprint 6.6）。 */
export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("profile route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">档案页加载失败</h2>
      <p className="text-sm text-muted-foreground">请稍后重试，或返回上一步。</p>
      <Button size="lg" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
