import "server-only";

import { TextRun } from "docx";

/**
 * 把 Tiptap getHTML() 产出的内联 HTML 转成 docx TextRun 数组（Sprint 6.1 关键修复）。
 *
 * 简历 bullet 文本以 HTML 存储，导出时必须解析内联格式标签，
 * 不能把 `<strong>`/`<p>` 等标签原样写进 docx。
 *
 * 支持的内联标记 → docx run 属性：
 *   <strong>/<b>          → bold
 *   <em>/<i>              → italic
 *   <u>                   → underline
 *   <s>/<del>/<strike>    → strike
 *   <span style="color:…">→ color（来自 Tiptap color extension）
 * 块级标签（<p>/<div>/<br>）作为软换行/空格处理，标签本身被剥离。
 *
 * 不依赖浏览器 DOM：纯字符串扫描，运行在 Node 服务端。
 */

type RunStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
};

type BaseRunOpts = { color: string; size: number; font: string };

const SELF_NL_TAGS = new Set(["br", "p", "div", "li"]);

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeHex(color: string): string | undefined {
  const m = color.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (m) return m[1].toUpperCase();
  // rgb(r, g, b)
  const rgb = color.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0"))
      .join("");
    return hex.toUpperCase();
  }
  return undefined;
}

function extractColor(attrs: string): string | undefined {
  const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/i);
  if (!styleMatch) return undefined;
  const colorMatch = styleMatch[1].match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  if (!colorMatch) return undefined;
  return normalizeHex(colorMatch[1]);
}

type StackFrame = { tag: string; style: RunStyle };

export type StyledSegment = { text: string; style: RunStyle };

/**
 * 纯解析：内联 HTML → 带样式的文本段数组（不依赖 docx，可单元测试）。
 *
 * 闭标签策略（交错嵌套修复）：从栈顶向下找最近的同名 tag 弹出。
 * - 良构嵌套（栈顶即匹配）→ 行为与旧版单纯 pop() 完全一致，不回归。
 * - 交错嵌套（<b><i></b>）→ 只弹出匹配项 b，其上未闭合的 i 重新入栈，i 样式继续作用于后续文本。
 * - 无匹配开标签 → 安全忽略（不 pop、不负 pop、不崩）。
 * 块级标签（p/div/li/br）作软换行，标签本身被剥离。
 */
export function htmlToStyledSegments(html: string): StyledSegment[] {
  const segments: StyledSegment[] = [];
  const stack: StackFrame[] = [];
  let i = 0;
  let buffer = "";

  const current = (): RunStyle => {
    return stack.reduce<RunStyle>((acc, f) => ({ ...acc, ...f.style }), {});
  };

  const popMatching = (tag: string): void => {
    let matchIdx = -1;
    for (let k = stack.length - 1; k >= 0; k -= 1) {
      if (stack[k].tag === tag) {
        matchIdx = k;
        break;
      }
    }
    if (matchIdx === -1) return; // 无匹配开标签，忽略。
    const reopened = stack.splice(matchIdx + 1); // 匹配项之上的未闭合层
    stack.pop(); // 匹配项本身
    for (const f of reopened) stack.push(f); // 未闭合层按原顺序重新入栈
  };

  const flush = (style: RunStyle) => {
    if (buffer.length === 0) return;
    const text = decodeEntities(buffer);
    buffer = "";
    if (text.length === 0) return;
    segments.push({ text, style });
  };

  while (i < html.length) {
    const ch = html[i];
    if (ch === "<") {
      const close = html.indexOf(">", i);
      if (close === -1) {
        buffer += html.slice(i);
        break;
      }
      const tagContent = html.slice(i + 1, close).trim();
      i = close + 1;

      const isClosing = tagContent.startsWith("/");
      const tagBody = isClosing ? tagContent.slice(1) : tagContent;
      const spaceIdx = tagBody.search(/\s/);
      const tagName = (spaceIdx === -1 ? tagBody : tagBody.slice(0, spaceIdx)).toLowerCase().replace(/\/$/, "");
      const attrs = spaceIdx === -1 ? "" : tagBody.slice(spaceIdx + 1);

      // 任何标签边界先把已积累文本按当前样式输出。
      flush(current());

      if (isClosing) {
        popMatching(tagName);
        if (SELF_NL_TAGS.has(tagName)) buffer += " ";
        continue;
      }

      // 自闭合标签（如 <br/>）不入栈，避免遗留未配对帧。
      const selfClosing = tagContent.endsWith("/") || tagName === "br";

      switch (tagName) {
        case "strong":
        case "b":
          stack.push({ tag: tagName, style: { bold: true } });
          break;
        case "em":
        case "i":
          stack.push({ tag: tagName, style: { italic: true } });
          break;
        case "u":
          stack.push({ tag: tagName, style: { underline: true } });
          break;
        case "s":
        case "del":
        case "strike":
          stack.push({ tag: tagName, style: { strike: true } });
          break;
        case "span": {
          const color = extractColor(attrs);
          stack.push({ tag: tagName, style: color ? { color } : {} });
          break;
        }
        case "br":
          buffer += " ";
          break;
        case "p":
        case "div":
        case "li":
          // 块级开标签：闭标签触发软换行。不带样式。
          if (!selfClosing) stack.push({ tag: tagName, style: {} });
          break;
        default:
          if (!selfClosing) stack.push({ tag: tagName, style: {} });
          break;
      }
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flush(current());

  return segments;
}

/**
 * 解析内联 HTML，返回 docx TextRun[]。base 为默认正文样式。
 * 全空时返回空数组，由调用方处理段落无 children 的兜底。
 */
export function htmlToRuns(html: string, base: BaseRunOpts): TextRun[] {
  return htmlToStyledSegments(html).map(
    ({ text, style }) =>
      new TextRun({
        text,
        bold: style.bold ?? false,
        italics: style.italic ?? false,
        underline: style.underline ? {} : undefined,
        strike: style.strike ?? false,
        color: style.color ?? base.color,
        size: base.size,
        font: base.font,
      }),
  );
}

/** 把 HTML 简历文本扁平化为纯文本（用于无需富格式的场景）。 */
export function htmlToPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
