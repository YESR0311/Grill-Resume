import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";
import type { PhotoPosition } from "../template-style";

/**
 * 顶部"姓名 + 联系信息 + 证件照" 共享组件（Sprint 9 - 多模板重写）。
 *
 * 解决原 issue：之前每个模板的"证件照 + 姓名"用 `relative flex` + 绝对定位 PhotoPlaceholder，
 * 文字撑开时会盖在照片上。这个版本：
 *  - PhotoPlaceholder 是 flex 兄弟（非 absolute），靠 order 决定左右
 *  - 文字侧 `min-w-0` 让长姓名/邮箱能自然换行，不撑爆
 *  - `items-start` 顶部对齐，证件照始终保持 132×170
 *
 * variant 控制字体与排版风格：
 *  - "default" — 时序类（T1/T2/T4），sans 标题
 *  - "serif"   — 衬线类（T3/H2），Playfair 标题
 *  - "compact" — 紧凑类（T4），小一号
 *  - "ats"     — ATS 类（无证件照时不引入），sans 小字号
 */
export type TopHeaderVariant = "default" | "serif" | "compact" | "ats";

interface TopHeaderProps {
  draft: ResumeDraft;
  style: ResumeStyle;
  photo: PhotoPosition;
  variant?: TopHeaderVariant;
}

export function TopHeader({ draft, style, photo, variant = "default" }: TopHeaderProps) {
  const serif = variant === "serif";
  const compact = variant === "compact";
  const ats = variant === "ats";

  // 标题字号（variant 决定）
  const nameClass = ats
    ? "text-2xl font-bold"
    : compact
      ? "text-2xl font-bold"
      : serif
        ? "text-4xl"
        : "text-3xl font-bold";
  const titleClass = ats ? "text-sm" : compact ? "text-sm" : "text-base";
  const contactClass = ats ? "text-xs" : compact ? "text-xs" : "text-sm";
  const gapClass = ats ? "gap-4" : "gap-6";

  return (
    <div className={`mb-6 flex items-start ${gapClass}`}>
      {/* 左侧姓名信息 —— flex-1 + min-w-0 关键：允许长内容换行而不撑爆 */}
      <div className="min-w-0 flex-1 pt-1">
        <h1
          className={`mb-2 ${nameClass}`}
          style={{
            color: style.colorScheme.primary,
            fontFamily: serif ? "'Playfair Display', serif" : style.fontFamily,
            fontStyle: serif ? "italic" : undefined,
            fontWeight: serif ? 600 : undefined,
          }}
        >
          {draft.name}
        </h1>
        {draft.title && (
          <div className={`mb-1 ${titleClass}`} style={{ color: style.colorScheme.accent }}>
            {draft.title}
          </div>
        )}
        <div
          className={`flex flex-wrap ${contactClass}`}
          style={{ color: style.colorScheme.accent, gap: ats ? "0.25rem" : "1rem" }}
        >
          {draft.email && <span>{draft.email}</span>}
          {ats && draft.email && draft.phone && <span>|</span>}
          {draft.phone && <span>{draft.phone}</span>}
        </div>
      </div>

      {/* 证件照（仅 photo != "none"）—— flex 兄弟非 absolute，靠 order 决定左右 */}
      {photo !== "none" && (
        <PhotoPlaceholder position={photo} primary={style.colorScheme.primary} />
      )}
    </div>
  );
}
