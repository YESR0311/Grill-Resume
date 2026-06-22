import type { ReactNode } from "react";

/**
 * 通用侧边栏布局容器（Server Component）
 *
 * 架构约束：
 * - 本组件为 Server Component（无 'use client'）
 * - sidebar 由页面级显式传入（ProfileList / IntakeProgress / StepNavSidebar）
 * - 每个页面需显式使用 <AppLayoutWithSidebar sidebar={...}>
 *
 * 不能用 usePathname() 动态渲染 Server Component children
 * （React 规则：Client Component 无法渲染 Server Component children）
 */
export function AppLayoutWithSidebar({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-bg-cream">
      {/* 侧边栏固定宽度 256px */}
      <aside className="w-64 flex-shrink-0 border-r border-warm-hairline bg-surface-light">
        {sidebar}
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
