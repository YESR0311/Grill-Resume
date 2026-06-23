import { getProfile } from "@/features/profile/store";
import { INTAKE_DIMENSIONS, DIMENSION_LABEL } from "@/features/intake/dimensions";

/**
 * 问答页侧边栏：问答进度展示（Server Component，纯展示，无交互）。
 *
 * 三态灯：
 * - 亮灯（covered）：实心 terracotta + 光晕 + 加粗深色文字
 * - 半亮（partial）：半透明 terracotta，无光晕 + 普通文字 + 提示「可在档案页补充」
 * - 熄灯（未覆盖）：空心圆 + 灰色文字
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
  const partial = new Set(profile.intakeStatus.partialDimensions);
  const total = INTAKE_DIMENSIONS.length;
  const doneCount = covered.size;

  return (
    <div className="flex h-full flex-col">
      {/* 问答进度 */}
      <div className="flex-1 p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-text">问答进度</h3>
        <div className="space-y-4">
          {INTAKE_DIMENSIONS.map((dim) => {
            const isCovered = covered.has(dim);
            const isPartial = !isCovered && partial.has(dim);
            const label = DIMENSION_LABEL[dim] ?? dim;

            return (
              <div key={dim} className="flex items-center gap-4">
                {/* 圆形指示器 */}
                <div
                  className={`h-4 w-4 flex-shrink-0 rounded-full transition-all ${
                    isCovered
                      ? "bg-terracotta shadow-[0_0_8px_rgba(196,97,47,0.6)]" // 亮灯
                      : isPartial
                        ? "bg-terracotta/40" // 半亮
                        : "border-2 border-warm-hairline bg-transparent" // 熄灯
                  }`}
                  title={isCovered ? "已完成" : isPartial ? "已写入部分信息，可在档案页补充" : "未完成"}
                />

                {/* 维度名称 */}
                <span
                  className={`text-base transition-all ${
                    isCovered
                      ? "font-semibold text-ink" // 亮灯
                      : isPartial
                        ? "font-normal text-ink/70" // 半亮
                        : "font-normal text-muted-text" // 熄灯
                  }`}
                >
                  {label}
                  {isPartial && (
                    <span className="ml-1 text-xs text-muted-text">（部分）</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 提示文字 */}
      <div className="border-t border-warm-hairline p-6">
        <p className="text-xs text-muted-text">
          {doneCount === total
            ? "✓ 所有维度已完成"
            : `已完成 ${doneCount} / ${total} 个维度`}
        </p>
      </div>
    </div>
  );
}
