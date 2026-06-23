import "server-only";

/**
 * docx 颜色工具。
 *
 * docx 的 shading.fill / 边框 color 只接受 6 位 RRGGBB 实色，不支持 alpha。
 * preview 端大量用 `${primary}1a`（10% 透明叠白底）做胶囊背景，
 * 导出时必须把"颜色 + alpha"预混成实色（与白底混合）。
 */

/** 去掉 # 前缀并大写。 */
export function hex6(s: string): string {
  const m = s.trim().replace(/^#/, "").match(/^([0-9a-fA-F]{6})/);
  return m ? m[1].toUpperCase() : "000000";
}

/**
 * 把颜色与白底按 alpha 混合，返回 6 位实色。
 * @param color 6 位 hex（可带 #）
 * @param alpha 0~1，颜色占比（0.1 ≈ preview 的 `1a`）
 */
export function tintOnWhite(color: string, alpha: number): string {
  const h = hex6(color);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
  return [mix(r), mix(g), mix(b)]
    .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
