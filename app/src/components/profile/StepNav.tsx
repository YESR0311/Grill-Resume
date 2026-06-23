import Link from "next/link";
import { Settings, Check, Home } from "lucide-react";

/**
 * 四步流程统一顶栏。展示步骤名 + 当前高亮 + 已完成可跳转。
 * 三步：问答 → 档案/评估 → 润色导出。
 * 右上角：返回首页 + 设置
 */

export type StepKey = "intake" | "profile" | "evaluate" | "polish";

const STEPS: { key: StepKey; label: string; href: (id: string) => string }[] = [
  { key: "intake", label: "问答", href: (id) => `/intake/${id}` },
  { key: "profile", label: "档案", href: (id) => `/profile/${id}` },
  { key: "evaluate", label: "评估", href: (id) => `/evaluate/${id}` },
  { key: "polish", label: "润色导出", href: (id) => `/polish/${id}` },
];

const ORDER: StepKey[] = ["intake", "profile", "evaluate", "polish"];

export function StepNav({
  profileId,
  current,
  reachableSteps,
}: {
  profileId: string;
  current: StepKey;
  reachableSteps: StepKey[];
}) {
  const currentIdx = ORDER.indexOf(current);
  const reachable = new Set<StepKey>(reachableSteps);

  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isCurrent = step.key === current;
          const isDone = i < currentIdx;
          // design §6.1：仅可达步骤允许跳转，未完成前序步骤的目标锁定
          const isReachable = isCurrent || reachable.has(step.key);
          const content = (
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground font-medium"
                  : isDone
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground"
              }`}
            >
              {isDone && <Check size={13} />}
              {step.label}
            </span>
          );
          return (
            <div key={step.key} className="flex items-center">
              {i > 0 && <span className="px-1 text-xs text-muted-foreground">→</span>}
              {isReachable ? (
                <Link href={step.href(profileId)}>{content}</Link>
              ) : (
                <span title="完成前序步骤后解锁">{content}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          title="返回首页"
        >
          <Home size={15} />
          返回首页
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          title="设置"
        >
          <Settings size={15} />
          设置
        </Link>
      </div>
    </nav>
  );
}