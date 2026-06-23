import Link from "next/link";
import { MessageSquare, FileText, BarChart3, Sparkles, Flame } from "lucide-react";
import { IntakeProgress } from "./IntakeProgress";

/**
 * 侧边栏：步骤导航（Server Component）
 *
 * - 仅在「问答采集」页时，步骤按钮下方展示 IntakeProgress
 * - 标题：花体 Grill-Resume + logo icon
 * - 当前步骤高亮，已完成步骤可点击
 *
 * 颜色设计：
 * - 当前步骤：terracotta 背景 + 白色文字
 * - 可达步骤：terracotta-tint 背景 + terracotta 文字
 * - 不可达：灰禁用
 */
export function StepNavSidebar({
  currentStep,
  reachableSteps,
  profileId,
}: {
  currentStep: "intake" | "profile" | "evaluate" | "polish";
  reachableSteps: string[];
  profileId?: string;
}) {
  const steps = [
    { id: "intake", label: "问答采集", icon: MessageSquare, href: `/intake${profileId ? `/${profileId}` : ""}` },
    { id: "profile", label: "档案编辑", icon: FileText, href: profileId ? `/profile/${profileId}` : "/profile" },
    { id: "evaluate", label: "简历评估", icon: BarChart3, href: profileId ? `/evaluate/${profileId}` : "/evaluate" },
    { id: "polish", label: "润色编辑", icon: Sparkles, href: profileId ? `/polish/${profileId}` : "/polish" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* 标题 */}
      <div className="border-b border-warm-hairline px-6 py-4 dark:border-border">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-terracotta text-white shadow-sm transition-transform group-hover:rotate-[-6deg]">
            <Flame size={16} strokeWidth={2.25} />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-terracotta">
            Grill-Resume
          </span>
        </Link>
      </div>

      {/* 步骤列表 + 问答进度（仅 intake 页） */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {steps.map((step) => {
            const isCurrent = step.id === currentStep;
            const isReachable = reachableSteps.includes(step.id);
            const Icon = step.icon;

            if (!isReachable && !isCurrent) {
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 opacity-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Icon size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">未开放</p>
                  </div>
                </div>
              );
            }

            if (isCurrent) {
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg bg-primary px-4 py-3 shadow-md"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                    <Icon size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="text-xs text-white/80">当前步骤</p>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={step.id}
                href={step.href}
                className="flex items-center gap-3 rounded-lg border border-warm-hairline bg-card px-4 py-3 transition-all hover:border-terracotta hover:shadow-sm dark:border-border dark:bg-card"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta-tint dark:bg-terracotta/20">
                  <Icon size={16} className="text-terracotta dark:text-terracotta" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground">已完成</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 问答进度：仅在 intake 页（当前步骤为 intake 且有 profileId）显示 */}
        {currentStep === "intake" && profileId && (
          <div className="mt-6 border-t border-warm-hairline pt-6 dark:border-border">
            <IntakeProgress profileId={profileId} />
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="border-t border-warm-hairline p-4 dark:border-border">
        <p className="text-xs text-muted-foreground">
          完成当前步骤后，下一阶段将自动开放
        </p>
      </div>
    </div>
  );
}
