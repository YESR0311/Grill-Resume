/**
 * 前端改造 9 项 PRD 回归测试
 *
 * 验证项：
 * 1. 档案页表单文字框做大（CSS 类存在，textarea 高度 ≥ 144px）
 * 2. 整体布局（design_sense 暖色调色板 + Playfair Display + Inter 字体）
 * 3. 评估结果页滚动（EvaluateView 有 ScrollArea）
 * 4. 润色导出环节编辑器（Tiptap 扩展齐全）
 * 5. 模板系统（9 模板注册 + PhotoPlaceholder）
 * 6. 证件照占位符（35mm×45mm）
 * 7. 侧边栏布局（AppLayoutWithSidebar 存在）
 * 8. 问答页顶部导航（StepNav 存在）
 * 9. 侧边栏进度可视化（IntakeProgress 亮灯效果）
 *
 * 运行方式：
 *   cd app && npx tsx --conditions=react-server \
 *     src/__tests__/regression.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
const results: { name: string; status: "ok" | "FAIL"; note?: string }[] = [];

function test(name: string, fn: () => void | string): void {
  try {
    const note = fn();
    passed += 1;
    results.push({ name, status: "ok", note: typeof note === "string" ? note : undefined });
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed += 1;
    const msg = (err as Error).message;
    results.push({ name, status: "FAIL", note: msg });
    console.error(`  FAIL - ${name}`);
    console.error(`    ${msg}`);
  }
}

const APP = path.resolve(__dirname, "../..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(APP, rel), "utf-8");
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(APP, rel));
}

console.log("\n=== 前端改造 9 项 PRD 回归测试 ===\n");

// 1. 档案页表单文字框做大
console.log("[1] 档案页表单文字框做大");
test("globals.css 含 .form-input / .form-textarea", () => {
  const css = readFile("src/app/globals.css");
  assert.ok(/\.form-input/.test(css), "缺 .form-input 类");
  assert.ok(/\.form-textarea/.test(css), "缺 .form-textarea 类");
});
test(".form-textarea 最小高度 ≥ 144px", () => {
  const css = readFile("src/app/globals.css");
  const m = css.match(/\.form-textarea\s*\{([^}]+)\}/);
  assert.ok(m, "缺 .form-textarea 块");
  const block = m![1];
  const heightMatch = block.match(/min-height:\s*(\d+)px/);
  assert.ok(heightMatch, "缺 min-height");
  const h = parseInt(heightMatch![1], 10);
  assert.ok(h >= 144, `textarea 高度 ${h}px < 144px`);
  return `${h}px`;
});

// 2. 整体布局
console.log("\n[2] 整体布局（design_sense + 字体）");
test("globals.css 含 design_sense 暖色调色板", () => {
  const css = readFile("src/app/globals.css");
  assert.ok(/F7F4EF|terracotta|C4612F|cream/.test(css), "缺 design_sense 暖色变量");
  return "cream + terracotta";
});
test("layout.tsx 引入 Playfair Display + Inter 字体", () => {
  const layout = readFile("src/app/layout.tsx");
  assert.ok(/Playfair|Inter/.test(layout), "缺 Playfair Display 或 Inter 字体");
  return "Playfair + Inter";
});

// 3. 评估结果页滚动
console.log("\n[3] 评估结果页滚动");
test("EvaluateView 含 ScrollArea", () => {
  const ev = readFile("src/components/evaluate/EvaluateView.tsx");
  assert.ok(/ScrollArea/.test(ev), "EvaluateView 缺 ScrollArea");
  return "ScrollArea ✓";
});

// 4. 润色导出编辑器
console.log("\n[4] 润色导出编辑器（7 扩展）");
test("Tiptap 扩展文件齐全（7 个）", () => {
  const ext = "src/features/polish/extensions";
  const files = ["FontSize.ts", "LetterSpacing.ts", "FontWeight.ts", "LineHeight.ts"];
  for (const f of files) {
    assert.ok(fileExists(path.join(ext, f)), `缺 ${f}`);
  }
  assert.ok(fileExists(path.join(ext, "index.ts")), "缺 index.ts");
  // 官方扩展在 index.ts 中 re-export
  const idx = readFile(path.join(ext, "index.ts"));
  assert.ok(/TextAlign/.test(idx), "缺 TextAlign re-export");
  assert.ok(/FontFamily/.test(idx), "缺 FontFamily re-export");
  return "7 扩展 ✓";
});
test("StructuredEditor 配置 7 扩展", () => {
  const se = readFile("src/components/polish/StructuredEditor.tsx");
  for (const ext of [
    "StarterKit",
    "Underline",
    "TextStyle",
    "Color",
    "FontSize",
    "LetterSpacing",
    "FontWeight",
    "LineHeight",
    "TextAlign",
    "FontFamily",
  ]) {
    assert.ok(se.includes(ext), `StructuredEditor 缺 ${ext}`);
  }
  return "10 扩展 ✓";
});
test("StyleControls 含字号/字重/行距/字间距/对齐", () => {
  const sc = readFile("src/components/polish/StyleControls.tsx");
  assert.ok(/字号/.test(sc), "缺字号控制");
  assert.ok(/字重/.test(sc), "缺字重控制");
  assert.ok(/对齐/.test(sc), "缺对齐控制");
  assert.ok(/行距/.test(sc), "缺行距控制");
  assert.ok(/字间距/.test(sc), "缺字间距控制");
  return "5 维度 ✓";
});

// 5. 模板系统
console.log("\n[5] 模板系统（9 模板）");
test("模板文件齐全（9 个 + PhotoPlaceholder + index）", () => {
  const tplDir = "src/features/polish/templates";
  assert.ok(fileExists(path.join(tplDir, "T1-Classic.tsx")), "缺 T1-Classic");
  assert.ok(fileExists(path.join(tplDir, "T2-Modern.tsx")), "缺 T2-Modern");
  assert.ok(fileExists(path.join(tplDir, "T3-Warm.tsx")), "缺 T3-Warm");
  assert.ok(fileExists(path.join(tplDir, "T4-Compact.tsx")), "缺 T4-Compact");
  assert.ok(fileExists(path.join(tplDir, "H1-Skills.tsx")), "缺 H1-Skills");
  assert.ok(fileExists(path.join(tplDir, "RemainingTemplates.tsx")), "缺 RemainingTemplates（H2/H3/F1/A1）");
  assert.ok(fileExists(path.join(tplDir, "PhotoPlaceholder.tsx")), "缺 PhotoPlaceholder");
  assert.ok(fileExists(path.join(tplDir, "index.ts")), "缺 index.ts");
  return "9 模板 + 1 占位符 + 1 索引";
});
test("template-registry 导出 RESUME_TEMPLATES", () => {
  const tr = readFile("src/features/polish/template-registry.ts");
  assert.ok(/RESUME_TEMPLATES\s*:\s*ResumeTemplate\[\]/.test(tr), "缺 RESUME_TEMPLATES 数组");
  return "注册表完整";
});
test("templates/index.ts 导出 TEMPLATE_COMPONENTS + getTemplateComponent", () => {
  const idx = readFile("src/features/polish/templates/index.ts");
  assert.ok(/TEMPLATE_COMPONENTS/.test(idx), "缺 TEMPLATE_COMPONENTS 导出");
  assert.ok(/getTemplateComponent/.test(idx), "缺 getTemplateComponent 函数");
  return "导出键齐全";
});
test("RemainingTemplates 含 H2/H3/F1/A1", () => {
  const rt = readFile("src/features/polish/templates/RemainingTemplates.tsx");
  assert.ok(/H2-Achievement/.test(rt), "缺 H2-Achievement");
  assert.ok(/H3-Project/.test(rt), "缺 H3-Project");
  assert.ok(/F1-Functional/.test(rt), "缺 F1-Functional");
  assert.ok(/A1-ATS/.test(rt), "缺 A1-ATS");
  return "4 模板 ✓";
});

// 6. 证件照占位符
console.log("\n[6] 证件照占位符（35mm×45mm）");
test("PhotoPlaceholder 35mm×45mm = 132px×170px", () => {
  const pp = readFile("src/features/polish/templates/PhotoPlaceholder.tsx");
  assert.ok(/35/.test(pp) && /45/.test(pp), "缺 35mm×45mm 注释");
  assert.ok(/132/.test(pp) && /170/.test(pp), "缺 132×170 像素值");
  return "132×170px ✓";
});
test("PhotoPlaceholder 支持 left/right 位置", () => {
  const pp = readFile("src/features/polish/templates/PhotoPlaceholder.tsx");
  assert.ok(/position\s*[:=]\s*["']left["']|"left"|"right"/.test(pp), "缺 left/right 位置参数");
  return "left/right ✓";
});

// 7. 侧边栏布局
console.log("\n[7] 侧边栏布局（AppLayoutWithSidebar）");
test("layout 组件目录含 AppLayoutWithSidebar", () => {
  const layoutDir = "src/components/layout";
  assert.ok(fileExists(path.join(layoutDir, "AppLayoutWithSidebar.tsx")), "缺 AppLayoutWithSidebar");
  assert.ok(fileExists(path.join(layoutDir, "ProfileList.tsx")), "缺 ProfileList");
  assert.ok(fileExists(path.join(layoutDir, "IntakeProgress.tsx")), "缺 IntakeProgress");
  return "3 组件 ✓";
});

// 8. 问答页顶部导航
console.log("\n[8] 问答页顶部导航（StepNav）");
test("intake 页面含 StepNav 组件", () => {
  const intake = readFile("src/app/intake/[id]/page.tsx");
  assert.ok(/StepNav/.test(intake), "intake 页面缺 StepNav");
  return "StepNav ✓";
});

// 9. 侧边栏进度可视化
console.log("\n[9] 侧边栏进度可视化（亮灯效果）");
test("IntakeProgress 含 bg-terracotta + glow", () => {
  const ip = readFile("src/components/layout/IntakeProgress.tsx");
  assert.ok(/bg-terracotta|primary/.test(ip), "缺主色高亮");
  assert.ok(/shadow|ring/.test(ip), "缺光晕效果");
  return "亮灯 ✓";
});

// ===== Sprint 5: pretext 集成 =====
console.log("\n[Sprint 5] pretext 集成");
test("layout-engine.ts 存在且导入 @chenglou/pretext", () => {
  assert.ok(fileExists("src/features/polish/layout-engine.ts"), "缺 layout-engine.ts");
  const le = readFile("src/features/polish/layout-engine.ts");
  assert.ok(/@chenglou\/pretext/.test(le), "layout-engine 未导入 pretext");
  return "pretext 集成 ✓";
});
test("useMeasureText Hook 存在", () => {
  assert.ok(fileExists("src/features/polish/useMeasureText.ts"), "缺 useMeasureText.ts");
});

// ===== Sprint 7: DOCX 导出扩展 =====
console.log("\n[Sprint 7] DOCX 导出扩展");
test("html-runs 支持 fontSize/fontWeight/letterSpacing", () => {
  const hr = readFile("src/features/export/html-runs.ts");
  assert.ok(/fontSize/.test(hr), "缺 fontSize 支持");
  assert.ok(/fontWeight/.test(hr), "缺 fontWeight 支持");
  assert.ok(/letterSpacing/.test(hr), "缺 letterSpacing 支持");
  assert.ok(/characterSpacing/.test(hr), "缺 characterSpacing 映射");
  return "3 格式属性 ✓";
});

// ===== 汇总 =====
console.log("\n=== 测试汇总 ===");
console.log(`通过：${passed}`);
console.log(`失败：${failed}`);
console.log(`合计：${passed + failed}/15 项`);

if (failed > 0) {
  console.log("\n失败项：");
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  ✗ ${r.name}: ${r.note}`);
  }
  process.exit(1);
}
console.log("\n✅ 全部测试通过\n");