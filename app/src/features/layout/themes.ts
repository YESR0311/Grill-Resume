import type { LayoutTheme } from "./schema";

/**
 * 主题 preset 纯数据表（B4，design §2）。
 *
 * preset 不是新 ExportFormat：调用方把 `preset.theme` 并入
 * `LayoutOverrides.theme`、`preset.marginsMm` 注入投影/适配；
 * 不扩 LayoutOverrides 持久化 schema。
 *
 * classic 排版参数借鉴 external/billryan-resume（MIT，resume.cls:3,33-40 +
 * zh_CN sty:10-16 的"宋体正文 + 黑体标题"模式）；字体落地用系统字体名
 * （SimSun/SimHei），不用 Adobe 商业字体。
 */
export type LayoutThemePreset = {
  id: "clean" | "classic" | "compact";
  label: string;
  theme: Partial<LayoutTheme>;
  marginsMm?: { top: number; right: number; bottom: number; left: number };
};

export const layoutThemePresets: LayoutThemePreset[] = [
  {
    id: "clean",
    label: "清爽（默认）",
    theme: {},
  },
  {
    id: "classic",
    label: "经典（宋体正文·黑体标题）",
    theme: {
      fontCJK: "SimSun",
      fontCJKHeading: "SimHei",
      fontLatin: "Times New Roman",
      baseFontPt: 11,
      lineSpacing: 1.2,
    },
    marginsMm: { top: 17.8, right: 20.3, bottom: 14, left: 20.3 },
  },
  {
    id: "compact",
    label: "紧凑（内容偏多）",
    theme: {
      baseFontPt: 10,
      lineSpacing: 1.12,
    },
    marginsMm: { top: 14, right: 14, bottom: 14, left: 14 },
  },
];

export function getLayoutThemePreset(id: string): LayoutThemePreset | null {
  return layoutThemePresets.find((preset) => preset.id === id) ?? null;
}
