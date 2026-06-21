import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/** 档案路由加载态（Sprint 6.6）。 */
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay message="正在汇总您的档案信息…" />
    </div>
  );
}
