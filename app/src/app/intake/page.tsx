"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/**
 * 问答新建页：客户端生成 id 后 push 到 /intake/[id]。
 *
 * 为什么是 client component：
 * - server component 调 redirect() 会抛 NEXT_REDIRECT 特殊异常；Next 16
 *   (Turbopack) dev runtime 用 Performance.measure 标记 server component
 *   渲染时偶发报 'cannot have a negative time stamp'（mark 顺序错乱）。
 * - 改 client 后用 router.push，避开 redirect throw，性能 API 不再触发。
 * - id 在客户端 nanoid 生成，URL 唯一性由 nanoid(10) 自身保证。
 */
export default function IntakeNewPage() {
  const router = useRouter();

  useEffect(() => {
    const id = nanoid(10);
    router.replace(`/intake/${id}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay message="正在准备问答…" showSkeleton={false} />
    </div>
  );
}
