/**
 * 证件照占位符组件（Sprint 9 - 多模板重写）。
 *
 * 物理规格：35mm × 45mm（小二寸），@ 96dpi = 132px × 170px。
 *
 * 设计要点（修复 issue「证件照与姓名/联系信息重叠」）：
 *  1. 不用 absolute 定位 —— 改用 flex 兄弟元素，靠 order 决定左右。
 *  2. `shrink-0` —— 文字长时证件照不被挤掉，文字被压窄自然换行。
 *  3. `position` 由调用方传"left"/"right"；无证件照的模板不引入此组件。
 *  4. 边框用主题主色，与整张简历色板协调。
 */

interface PhotoPlaceholderProps {
  position: "left" | "right";
  /** 主题主色（用于边框 / 装饰）。 */
  primary: string;
}

export function PhotoPlaceholder({ position, primary }: PhotoPlaceholderProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center border-2 border-dashed bg-accent-tint ${
        position === "left" ? "order-first mr-2" : "order-last ml-2"
      }`}
      style={{
        width: "132px", // 35mm @ 96 DPI
        height: "170px", // 45mm @ 96 DPI
        borderColor: primary,
      }}
    >
      <div className="text-center text-xs" style={{ color: primary }}>
        <div>证件照</div>
        <div className="mt-1 opacity-70">35×45mm</div>
      </div>
    </div>
  );
}
