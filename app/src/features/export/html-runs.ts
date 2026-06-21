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

/**
 * 解析内联 HTML，返回 docx TextRun[]。base 为默认正文样式。
 */
export function htmlToRuns(html: string, base: BaseRunOpts): TextRun[] {
  const runs: TextRun[] = [];
  const stack: RunStyle[] = [];
  let i = 0;
  let buffer = "";

  const current = (): RunStyle => {
    return stack.reduce<RunStyle>((acc, s) => ({ ...acc, ...s }), {});
  };

  const flush = (style: RunStyle) => {
    if (buffer.length === 0) return;
    const text = decodeEntities(buffer);
    if (text.length === 0) {
      buffer = "";
      return;
    }
    runs.push(
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
    buffer = "";
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
        // 弹出最近的匹配样式层（简化：弹一层）。
        if (stack.length > 0) stack.pop();
        if (SELF_NL_TAGS.has(tagName)) buffer += " ";
        continue;
      }

      switch (tagName) {
        case "strong":
        case "b":
          stack.push({ bold: true });
          break;
        case "em":
        case "i":
          stack.push({ italic: true });
          break;
        case "u":
          stack.push({ underline: true });
          break;
        case "s":
        case "del":
        case "strike":
          stack.push({ strike: true });
          break;
        case "span": {
          const color = extractColor(attrs);
          stack.push(color ? { color } : {});
          break;
        }
        case "br":
          buffer += " ";
          break;
        case "p":
        case "div":
        case "li":
          // 块级开标签：内容前置软分隔；不入栈样式。
          stack.push({});
          break;
        default:
          stack.push({});
          break;
      }
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flush(current());

  // 全空时回退单一空 run，避免段落无 children 报错由调用方处理；这里返回空数组。
  return runs;
}

/** 把 HTML 简历文本扁平化为纯文本（用于无需富格式的场景）。 */
export function htmlToPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
