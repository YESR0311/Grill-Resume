import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/** 评估路由加载态（Sprint 6.6）。 */
export default function EvaluateLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay message="正在准备评估…" />
    </div>
  );
}
