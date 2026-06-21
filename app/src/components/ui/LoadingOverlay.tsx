import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 贯穿三步流的加载动效（design §5.5）。
 * 进度文案 + Skeleton 占位布局，替代永久 spinner；尊重 prefers-reduced-motion。
 */
export function LoadingOverlay({
  message,
  detail,
  showSkeleton = true,
  className,
}: {
  message: string;
  detail?: string;
  showSkeleton?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-20 animate-in fade-in duration-300",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 size={36} className="animate-spin text-primary" />
        <p className="text-base font-medium text-foreground">{message}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>

      {showSkeleton && (
        <div className="w-full space-y-4" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <Skeleton className="mb-3 h-4 w-3/4" />
              <div className="mb-3 flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((__, j) => (
                  <Skeleton key={j} className="h-5 w-14 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
