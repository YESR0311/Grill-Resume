import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/** 问答路由加载态（Sprint 6.6）。 */
export default function IntakeLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay message="正在准备问答…" showSkeleton={false} />
    </div>
  );
}
