import { User } from "lucide-react";
import { getProfile } from "@/features/profile/store";
import { INTAKE_DIMENSIONS, INTAKE_DIMENSION_LABELS } from "@/features/intake/constants";

/**
 * 问答页侧边栏：问答进度展示（Server Component）
 *
 * 纯展示版本，无交互逻辑（跳过/结束按钮在页面主体）
 * 显示 5 个维度：已完成用"亮灯"样式，未完成用"熄灯"样式
 *
 * 亮灯：实心圆 bg-terracotta + 光晕 shadow + 加粗文字
 * 熄灯：空心圆 bg-warm-hairline + 灰色文字
 */
export function IntakeProgress({ profileId }: { profileId: string }) {
  const profile = getProfile(profileId);

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-text">档案不存在</p>
      </div>
    );
  }
  const covered = new Set(profile.intakeStatus.coveredDimensions);

  return (
    <div className="flex h-full flex-col">
      {/* 档案信息 */}
      <div className="border-b border-warm-hairline px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-tint">
            <User size={20} className="text-terracotta" />
          </div>
          <div>
            <p className="font-medium text-ink">{profile.name || "新档案"}</p>
            <p className="text-xs text-muted-text">问答采集中</p>
          </div>
        </div>
      </div>

      {/* 问答进度 */}
      <div className="flex-1 p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-text">问答进度</h3>
        <div className="space-y-4">
          {INTAKE_DIMENSIONS.map((dim) => {
            const done = covered.has(dim);
            const label = INTAKE_DIMENSION_LABELS[dim] ?? dim;

            return (
              <div key={dim} className="flex items-center gap-4">
                {/* 圆形指示器 */}
                <div
                  className={`h-4 w-4 flex-shrink-0 rounded-full transition-all ${
                    done
                      ? "bg-terracotta shadow-[0_0_8px_rgba(196,97,47,0.6)]" // 亮灯：实心 + 光晕
                      : "border-2 border-warm-hairline bg-transparent" // 熄灯：空心
                  }`}
                  title={done ? "已完成" : "未完成"}
                />

                {/* 维度名称 */}
                <span
                  className={`text-base transition-all ${
                    done
                      ? "font-semibold text-ink" // 亮灯：加粗深色
                      : "font-normal text-muted-text" // 熄灯：灰色
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 提示文字 */}
      <div className="border-t border-warm-hairline p-6">
        <p className="text-xs text-muted-text">
          {covered.size === INTAKE_DIMENSIONS.length
            ? "✓ 所有维度已完成，可结束问答"
            : `已完成 ${covered.size} / ${INTAKE_DIMENSIONS.length} 个维度`}
        </p>
      </div>
    </div>
  );
}
