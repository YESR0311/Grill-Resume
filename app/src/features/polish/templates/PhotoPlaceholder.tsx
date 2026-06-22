/**
 * 证件照占位符组件
 *
 * 规格：35mm × 45mm（小二寸）
 * 换算：96 DPI 下约 132px × 170px
 * 位置：left-top 或 right-top（由模板控制）
 */

interface PhotoPlaceholderProps {
  position?: "left" | "right";
}

export function PhotoPlaceholder({ position = "right" }: PhotoPlaceholderProps) {
  return (
    <div
      className={`absolute top-0 ${position === "left" ? "left-0" : "right-0"} flex items-center justify-center border-2 border-dashed border-warm-hairline bg-accent-tint`}
      style={{
        width: "132px", // 35mm @ 96 DPI
        height: "170px", // 45mm @ 96 DPI
      }}
    >
      <div className="text-center text-xs text-text-muted">
        <div>证件照</div>
        <div className="mt-1">35×45mm</div>
      </div>
    </div>
  );
}
