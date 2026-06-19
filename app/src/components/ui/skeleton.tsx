import { cn } from "@/lib/utils";

/**
 * 骨架占位。匹配最终布局形状，替代永久 spinner（design §核心交互 R3）。
 * 动效用 pulse，尊重 prefers-reduced-motion（Tailwind animate-pulse 自动停用）。
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
