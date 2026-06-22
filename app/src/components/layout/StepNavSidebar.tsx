import Link from "next/link";
import { MessageSquare, FileText, BarChart3, Sparkles } from "lucide-react";

/**
 * 其他页面侧边栏：步骤导航（Server Component）
 *
 * 显示 4 个阶段：问答 → 档案 → 评估 → 润色
 * 当前步骤高亮，已完成步骤可点击
 *
 * 颜色设计：
 * - 暗色模式：背景 #242424，当前步骤用浅色文字确保可读
 * - 浅色模式：背景 #FBF9F5，当前步骤用深色文字
 *
 * reachableSteps 由页面传入（根据当前 profile 状态计算）
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
      <div className="border-b border-warm-hairline px-6 py-4">
        <h2 className="font-display text-lg font-medium text-foreground">简历制作流程</h2>
      </div>

      {/* 步骤列表 */}
      <div className="flex-1 p-4">
        <div className="space-y-2">
          {steps.map((step) => {
            const isCurrent = step.id === currentStep;
            const isReachable = reachableSteps.includes(step.id);
            const Icon = step.icon;

            if (!isReachable && !isCurrent) {
              // 不可达且非当前：灰色禁用态
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
              // 当前步骤：暗色模式用浅色文字，浅色模式用深色文字
              // 使用 dark: 前缀确保对比度
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg bg-terracotta px-4 py-3 shadow-lg dark:bg-terracotta/90 dark:border dark:border-terracotta/50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 dark:bg-white/10">
                    <Icon size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white dark:text-white">{step.label}</p>
                    <p className="text-xs text-white/80 dark:text-white/70">当前步骤</p>
                  </div>
                </div>
              );
            }

            // 可达且非当前：可点击
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
