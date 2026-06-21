import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

/** 润色路由加载态（Sprint 6.6）。 */
export default function PolishLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay message="正在打开简历编辑器…" />
    </div>
  );
}
