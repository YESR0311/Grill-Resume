/**
 * 简历主题色板（Sprint 9 - 多主题差异化）。
 *
 * 9 个模板共享同一组主题；模板的"差异"主要由 themeId 决定。
 * PhotoPlaceholder / 标题色 / 装饰元素都引用主题色，保证视觉协调。
 *
 * 色板设计原则：
 *  - blackBlue: ATS 友好（高对比黑字 + 蓝点强调）
 *  - whiteBlue: 经典互联网白底蓝字
 *  - paper:     论文/国企/银行（暖米底 + 深棕字 + 衬线感）
 *  - fashion:   暖色 Creative（terracotta + Playfair Display）
 *  - intelligent: 科技暗调（紫罗兰 + 浅紫辅色）
 */

export type ThemeId = "blackBlue" | "whiteBlue" | "paper" | "fashion" | "intelligent";

export interface Theme {
  /** 中文显示名。 */
  name: string;
  /** 主色：标题/强调/装饰边框。 */
  primary: string;
  /** 辅色：次要文字/日期。 */
  accent: string;
  /** 正文色。 */
  text: string;
  /** 页面底色（用于模板 sheetStyle.backgroundColor）。 */
  background: string;
  /** 推荐字体（覆盖 ResumeStyle.fontFamily）。 */
  fontFamily: string;
  /** 是否用衬线字体（Playfair Display）。 */
  serif: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  blackBlue: {
    name: "黑蓝·ATS",
    primary: "#0F172A",
    accent: "#475569",
    text: "#0F172A",
    background: "#FFFFFF",
    fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
    serif: false,
  },
  whiteBlue: {
    name: "白蓝·经典",
    primary: "#1D4ED8",
    accent: "#64748B",
    text: "#1E293B",
    background: "#FFFFFF",
    fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
    serif: false,
  },
  paper: {
    name: "论文·传统",
    primary: "#1C1917",
    accent: "#78716C",
    text: "#1C1917",
    background: "#FFFBEB",
    fontFamily: "'Times New Roman', 'Songti SC', 'PingFang SC', serif",
    serif: true,
  },
  fashion: {
    name: "时尚·创意",
    primary: "#C4612F",
    accent: "#92400E",
    text: "#1F2421",
    background: "#FBF9F5",
    fontFamily: "'Playfair Display', 'PingFang SC', Georgia, serif",
    serif: true,
  },
  intelligent: {
    name: "智能·科技",
    primary: "#7C3AED",
    accent: "#A78BFA",
    text: "#0F172A",
    background: "#F8FAFC",
    fontFamily: "'Inter', 'PingFang SC', ui-sans-serif, sans-serif",
    serif: false,
  },
};

/** 取主题；缺省回落 whiteBlue。 */
export function getTheme(themeId: string | undefined | null): Theme {
  if (themeId && (themeId in THEMES)) return THEMES[themeId as ThemeId];
  return THEMES.whiteBlue;
}
