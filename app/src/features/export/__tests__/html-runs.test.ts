/**
 * html-runs 纯解析单元测试（无测试框架，直接用 node:assert）。
 *
 * 运行方式（项目无 vitest/jest，server-only 在非 server 上下文会抛错，
 * 故用 react-server 条件让 server-only 解析为 empty.js）：
 *
 *   cd app && npx tsx --conditions=react-server \
 *     src/features/export/__tests__/html-runs.test.ts
 *
 * 测试目标 htmlToStyledSegments 为纯函数（不依赖 docx / DOM），
 * 覆盖：良构嵌套、交错嵌套、span color、块级换行、未闭合标签、空输入。
 */

import assert from "node:assert/strict";
import { htmlToStyledSegments, type StyledSegment } from "../html-runs";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

// 把段落简化成 "text|flags" 字符串便于断言。
function dump(segs: StyledSegment[]): string[] {
  return segs.map((s) => {
    const flags: string[] = [];
    if (s.style.bold) flags.push("b");
    if (s.style.italic) flags.push("i");
    if (s.style.underline) flags.push("u");
    if (s.style.strike) flags.push("s");
    if (s.style.color) flags.push(`c:${s.style.color}`);
    return `${s.text}|${flags.join(",")}`;
  });
}

console.log("html-runs htmlToStyledSegments");

test("空输入返回空数组", () => {
  assert.deepEqual(htmlToStyledSegments(""), []);
});

test("纯文本无样式", () => {
  assert.deepEqual(dump(htmlToStyledSegments("hello world")), ["hello world|"]);
});

test("良构嵌套 <b><i>x</i></b> → x 同时 bold+italic", () => {
  assert.deepEqual(dump(htmlToStyledSegments("<b><i>x</i></b>")), ["x|b,i"]);
});

test("良构嵌套：内外样式分段 <b>a<i>b</i>c</b>", () => {
  // a=bold, b=bold+italic, c=bold
  assert.deepEqual(dump(htmlToStyledSegments("<b>a<i>b</i>c</b>")), [
    "a|b",
    "b|b,i",
    "c|b",
  ]);
});

test("交错嵌套 <b><i>x</b>y</i> → x bold+italic，y 仅 italic（不把 bold 漏到 y）", () => {
  // 闭 </b> 只弹 b 帧，i 帧重新入栈继续作用 y。
  const out = dump(htmlToStyledSegments("<b><i>x</b>y</i>"));
  assert.deepEqual(out, ["x|b,i", "y|i"]);
});

test("交错嵌套 <b>a<i>b</b>c</i>d → a:b, b:b+i, c:i, d:无", () => {
  const out = dump(htmlToStyledSegments("<b>a<i>b</b>c</i>d"));
  assert.deepEqual(out, ["a|b", "b|b,i", "c|i", "d|"]);
});

test("span color 解析", () => {
  const out = dump(htmlToStyledSegments('<span style="color:#1a2b3c">x</span>'));
  assert.deepEqual(out, ["x|c:1A2B3C"]);
});

test("span color rgb 解析", () => {
  const out = dump(htmlToStyledSegments('<span style="color: rgb(255, 0, 16)">x</span>'));
  assert.deepEqual(out, ["x|c:FF0010"]);
});

test("color 叠加 bold", () => {
  const out = dump(htmlToStyledSegments('<b><span style="color:#ff0000">x</span></b>'));
  assert.deepEqual(out, ["x|b,c:FF0000"]);
});

test("块级 <p> 闭标签产生软换行（空格）", () => {
  const out = htmlToStyledSegments("<p>a</p><p>b</p>");
  // a 输出后 </p> 注入空格，下一段以空格开头与 b 合并/分段，验证含 a 和 b 且无标签泄漏。
  const joined = out.map((s) => s.text).join("");
  assert.ok(joined.includes("a"), "包含 a");
  assert.ok(joined.includes("b"), "包含 b");
  assert.ok(!joined.includes("<"), "无标签泄漏");
  assert.ok(joined.includes(" "), "有软换行空格");
});

test("<br> 软换行不入栈，后续样式正确", () => {
  const out = dump(htmlToStyledSegments("a<br/><b>b</b>"));
  // a 无样式，空格软换行，b 加粗
  assert.equal(out[out.length - 1], "b|b");
  assert.ok(out.some((x) => x.startsWith("a")), "含 a 段");
});

test("未闭合标签安全：孤立 </b> 被忽略不崩", () => {
  // 标签边界处会 flush，故 x、y 分两段输出，但都无样式且不崩。
  const out = dump(htmlToStyledSegments("x</b>y"));
  assert.deepEqual(out, ["x|", "y|"]);
  assert.equal(out.map((s) => s.split("|")[0]).join(""), "xy");
});

test("未闭合开标签：<b>x 不崩，x 仍 bold", () => {
  const out = dump(htmlToStyledSegments("<b>x"));
  assert.deepEqual(out, ["x|b"]);
});

test("闭标签数量多于开标签不负 pop", () => {
  assert.doesNotThrow(() => htmlToStyledSegments("</b></i></u>plain"));
  const out = dump(htmlToStyledSegments("</b></i></u>plain"));
  assert.deepEqual(out, ["plain|"]);
});

test("strike/underline 标记", () => {
  assert.deepEqual(dump(htmlToStyledSegments("<u><s>x</s></u>")), ["x|u,s"]);
});

console.log(`\nhtml-runs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
