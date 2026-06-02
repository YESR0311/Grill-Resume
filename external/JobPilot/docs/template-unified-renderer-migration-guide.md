# 简历模板统一渲染迁移指南

## 背景

当前简历模板存在两套实现：

- 预览：`src/components/preview/templates/*.tsx`
- 导出：`src/app/api/resume/[id]/export/templates/*.ts`

这两套代码分别维护同一个模板的结构和样式，容易出现漂移。例如“专业”模板曾经出现过：

- 预览中“技能特长”按分类展示，每个技能是独立列表项；
- 导出中同一批技能被拼接成一行文本。

项目已经有统一渲染体系：

- 统一模板目录：`src/lib/template-renderer/templates/*.tsx`
- 统一注册入口：`src/lib/template-renderer/index.ts`
- 统一类型和工具：`src/lib/template-renderer/types.ts`
- 统一数据转换：`toCanonicalResume(...)`
- 统一渲染优先级：先走 unified template，找不到再回退 legacy template。

迁移目标是让每个模板的预览和导出都从同一个 `UnifiedTemplate` 定义出发，减少双轨实现导致的样式和结构不一致。

## 当前状态

Legacy 模板共有 50 个同名预览/导出配对。

已迁移到统一渲染体系的同名模板：

- `classic`
- `modern`
- `consultant`
- `professional`

另有 `modern-minimal` 已在统一渲染体系中，但它不是当前 legacy 50 个模板里的同名项。

剩余未迁移模板按风险分层：

低风险，建议优先迁移：

- `academic`
- `architect`
- `ats`
- `blocks`
- `card`
- `clean`
- `elegant`
- `euro`
- `formal`
- `japanese`
- `legal`
- `luxe`
- `medical`
- `metro`
- `minimal`
- `mosaic`
- `nordic`
- `retro`
- `rose`
- `scientist`
- `teacher`
- `timeline`
- `watercolor`
- `zigzag`

中等风险，视觉样式较重，需要额外做 PDF 对比：

- `artistic`
- `berlin`
- `bold`
- `corporate`
- `designer`
- `developer`
- `engineer`
- `executive`
- `finance`
- `gradient`
- `infographic`
- `material`
- `ribbon`
- `startup`

高风险，存在左右栏、grid 或 section 分流：

- `coder`
- `compact`
- `creative`
- `magazine`
- `sidebar`
- `swiss`
- `two-column`

建议最后单独迁移：

- `neon`

`neon` 是全暗色页面，PDF 导出有专门的 body 背景处理，容易出现分页白边、背景断层和文字颜色不一致。

## 推荐迁移顺序

不要一次性迁完所有模板。推荐每批 2 到 4 个模板，每批完成后运行测试和人工对比。

第一批：

- `minimal`
- `formal`
- `euro`

第二批：

- `nordic`
- `timeline`
- `elegant`

第三批：

- `legal`
- `scientist`
- `academic`

后续按“低风险 → 中等风险 → 高风险 → neon”的顺序推进。

如果某个模板线上反馈了预览/导出不一致，可以插队优先迁移该模板。

## 单个模板迁移步骤

以下用 `<template>` 表示模板名，例如 `minimal`。

### 1. 阅读三份源文件

先读 legacy 预览：

```bash
src/components/preview/templates/<template>.tsx
```

再读 legacy 导出：

```bash
src/app/api/resume/[id]/export/templates/<template>.ts
```

再参考已有 unified 模板：

```bash
src/lib/template-renderer/templates/professional.tsx
src/lib/template-renderer/templates/classic.tsx
src/lib/template-renderer/templates/modern.tsx
src/lib/template-renderer/templates/consultant.tsx
```

阅读时重点标记：

- header 结构；
- avatar 渲染方式；
- contact info 对齐方式和颜色；
- section 标题结构；
- 每种 section type 的结构；
- skills 是标签、列表、逗号文本还是分组；
- projects、work experience 的日期和技术栈样式；
- 是否有 `qr_codes`；
- 是否有 sidebar、grid、背景色、暗色页面。

### 2. 新建 unified 模板文件

创建：

```bash
src/lib/template-renderer/templates/<template>.tsx
```

文件结构建议保持一致：

```tsx
import React from 'react';
import type {
  PersonalInfoContent,
  SummaryContent,
  WorkExperienceContent,
  EducationContent,
  SkillsContent,
  ProjectsContent,
  CertificationsContent,
  LanguagesContent,
  CustomContent,
  GitHubContent,
  QrCodeItem,
} from '@/types/resume';
import type { CanonicalResume, TemplateProps, UnifiedTemplate } from '../types';
import {
  md,
  esc,
  degreeField,
  getPersonalInfo,
  visibleSections,
  buildHighlights,
} from '../template-contract';
import { ContactInfo, buildContactEntries } from '../contact-info';
import { AvatarImage } from '@/components/preview/avatar-image';

export function TemplatePreview({ resume }: TemplateProps): React.ReactElement {
  // React preview
}

function TemplateSectionContent({
  section,
  lang,
}: {
  section: CanonicalResume['sections'][number];
  lang: string;
}): React.ReactElement | null {
  // section preview
}

function buildTemplateSectionHtml(
  section: CanonicalResume['sections'][number],
  lang: string,
): string {
  // section export
}

export function buildTemplateHtml(resume: CanonicalResume): string {
  // full export HTML
}

export const templateTemplate: UnifiedTemplate = {
  id: '<template>',
  name: '<Display Name>',
  PreviewComponent: TemplatePreview,
  buildHtml: buildTemplateHtml,
};
```

命名示例：

- `minimal` → `MinimalPreview`、`buildMinimalHtml`、`minimalTemplate`
- `two-column` → `TwoColumnPreview`、`buildTwoColumnHtml`、`twoColumnTemplate`

### 3. 使用 canonical 数据

Unified 模板必须接收 `CanonicalResume`，不要直接依赖 legacy `Resume`。

React 预览：

```tsx
export function MinimalPreview({ resume }: TemplateProps): React.ReactElement {
  const pi = getPersonalInfo(resume);
  const sections = visibleSections(resume.sections);
}
```

HTML 导出：

```ts
export function buildMinimalHtml(resume: CanonicalResume): string {
  const pi = getPersonalInfo(resume);
  const sections = visibleSections(resume.sections);
  const lang = resume.language || 'en';
}
```

不要自己重新排序 section。`toCanonicalResume(...)` 已经按 `sortOrder` 规范化。

### 4. 复用统一工具

必须优先使用统一工具：

- `md(...)`：渲染 summary、description、highlight 等 Markdown 文本；
- `esc(...)`：导出 HTML 字符串中的用户输入必须转义；
- `degreeField(...)`：学历和专业拼接；
- `visibleSections(...)`：过滤隐藏和空 section；
- `getPersonalInfo(...)`：读取个人信息；
- `buildHighlights(...)`：导出 bullet 列表；
- `ContactInfo`：React 预览联系方式；
- `buildContactEntries`：HTML 导出联系方式；
- `AvatarImage`：React 预览头像。

不要在新模板里复制一份新的 `esc`、`md`、`isSectionEmpty`。

### 5. 保持预览和导出结构一致

迁移时以预览效果为准，但导出 HTML 必须尽量复刻同样的 DOM 结构和 class。

例如 skills 如果预览是列表：

```tsx
<ul className="mt-0.5 list-disc pl-4">
  {cat.skills.map((skill) => (
    <li className="text-sm text-zinc-600">{skill}</li>
  ))}
</ul>
```

导出也应是列表：

```ts
`<ul class="mt-0.5 list-disc pl-4">${cat.skills
  .map((skill) => `<li class="text-sm text-zinc-600">${esc(skill)}</li>`)
  .join('')}</ul>`
```

不要把它改成：

```ts
esc(cat.skills.join(', '))
```

除非预览本身也是逗号拼接。

### 6. 注册模板

修改：

```bash
src/lib/template-renderer/index.ts
```

增加 import：

```ts
import { minimalTemplate } from './templates/minimal';
```

增加注册：

```ts
registerTemplate(minimalTemplate);
```

注册后预览和导出会自动优先走 unified 模板：

- 预览入口：`src/components/preview/resume-preview.tsx`
- 导出入口：`src/app/api/resume/[id]/export/builders.ts`

不要删除 legacy 文件。legacy 先保留作为 fallback 和对照材料。

### 7. 添加 parity 测试

修改：

```bash
src/lib/template-renderer/__tests__/template-renderer.test.ts
```

至少添加：

```ts
testTemplateParity('<template>');
```

如果本次迁移修复了某类结构漂移，要增加专门断言。

例如 skills 必须是列表项：

```ts
function testTemplateSkillsRenderAsListItems(): void {
  const unifiedTemplate = getUnifiedTemplate('<template>');
  assert.ok(unifiedTemplate, 'Expected "<template>" to be registered');

  const canonical = toCanonicalResume(createSampleResume('<template>'));
  const previewMarkup = renderToStaticMarkup(
    React.createElement(unifiedTemplate.PreviewComponent, { resume: canonical }),
  );
  const exportMarkup = unifiedTemplate.buildHtml(canonical);

  assert.match(previewMarkup, /<li[^>]*>Accessibility<\/li>/);
  assert.match(exportMarkup, /<li[^>]*>Accessibility<\/li>/);
  assert.doesNotMatch(exportMarkup, /Accessibility,\s*Design Systems,\s*Tauri/);
}
```

如果模板使用标签样式，则断言 `<span class="...">skill</span>`；如果模板本身就是文本拼接，则断言预览和导出都拼接一致。

## QR Code 处理

统一模板中的 `qr_codes` 要兼容两种情况：

- 导出：`builders.ts` 会提前生成 `_qrSvgs`；
- 预览：一般没有 `_qrSvgs`。

当前统一模板里推荐做法是：

```tsx
if (section.type === 'qr_codes') {
  const items = (content as unknown as { items: QrCodeItem[] }).items || [];
  const svgs = (content as unknown as { _qrSvgs?: Record<string, string> })._qrSvgs;
  if (!svgs) return null;

  const validItems = items.filter((q) => svgs[q.id]);
  if (validItems.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 24px', paddingTop: '4px' }}>
      {validItems.map((qr) => (
        <div key={qr.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: 96 }}>
          <div style={{ width: 80, height: 80 }} dangerouslySetInnerHTML={{ __html: svgs[qr.id] }} />
          {qr.label && <span style={{ fontSize: '10px', color: '#6b7280', lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-all', maxWidth: 96 }}>{qr.label}</span>}
        </div>
      ))}
    </div>
  );
}
```

导出 HTML：

```ts
if (section.type === 'qr_codes') {
  const items = (content as unknown as { items: QrCodeItem[] }).items || [];
  const svgs = (content as unknown as { _qrSvgs?: Record<string, string> })._qrSvgs || {};
  const validItems = items.filter((q) => svgs[q.id]);
  if (validItems.length === 0) return '';

  return `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px 24px;padding-top:4px">${validItems.map((qr) =>
    `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:96px">${svgs[qr.id]}<span style="font-size:10px;color:#6b7280;line-height:1.2;text-align:center;word-break:break-all;max-width:96px">${esc(qr.label)}</span></div>`
  ).join('')}</div>`;
}
```

如果后续希望 preview 也显示 QR，可以单独设计统一的 async preview 方案，不要在每个模板里重复生成。

## 头像处理

React 预览使用：

```tsx
<AvatarImage
  src={pi.avatar}
  avatarStyle={resume.themeConfig.avatarStyle}
  size={72}
  className="shrink-0"
  style={{ border: `2px solid ${PRIMARY}` }}
/>
```

HTML 导出通常仍输出 `<img>`，由导出页面上的 `data-avatar-style` CSS 统一覆盖形状：

```ts
${pi.avatar ? `<img src="${esc(pi.avatar)}" alt="" class="h-[72px] w-[72px] shrink-0 rounded-full border-2 object-cover" style="border-color:${PRIMARY}"/>` : ''}
```

不要在导出模板里引入 React 组件。

## Sidebar 和双栏模板注意事项

以下模板需要额外小心：

- `two-column`
- `sidebar`
- `coder`
- `compact`

这些模板会把 section 分成左右栏，例如：

```ts
const LEFT_TYPES = new Set(['skills', 'languages', 'certifications', 'custom']);
const leftSections = sections.filter((s) => LEFT_TYPES.has(s.type));
const rightSections = sections.filter((s) => !LEFT_TYPES.has(s.type));
```

迁移时必须保证：

- 预览和导出使用同一组分栏类型；
- sidebar 宽度和导出背景规则匹配；
- `src/app/api/resume/[id]/export/builders.ts` 中的 `SIDEBAR_DARK_TEMPLATES` 仍然覆盖对应模板；
- section 的 `data-section` 仍在每个 section 容器上；
- PDF 分页时 sidebar 背景不能断。

这类模板迁移后需要人工导出 PDF 检查多页简历。

## 背景模板注意事项

`BACKGROUND_TEMPLATES` 中的模板会影响导出 padding、页面背景和分页策略。

相关文件：

```bash
src/lib/constants.ts
src/app/api/resume/[id]/export/builders.ts
```

迁移这些模板时不要随意改变最外层结构。如果改变了外层结构，必须检查：

- `.resume-export > div` 的选择器是否仍命中；
- 背景是否铺满 PDF 页面；
- `box-decoration-break` 是否仍按预期工作；
- 页面之间是否出现白边。

## Neon 模板注意事项

`neon` 是全暗色模板，导出里有特殊逻辑：

```ts
const FULL_DARK_TEMPLATES: Record<string, string> = {
  neon: '#111827',
};
```

迁移 `neon` 时必须单独验证：

- PDF 页面背景是否全暗；
- 多页时背景是否断层；
- 所有正文颜色是否可读；
- 链接、技能标签、section 标题是否保持高对比；
- 打印模式下没有出现白底黑字错位。

建议最后迁移。

## 验证命令

每迁移一个模板，至少运行：

```bash
pnpm exec tsx "src/lib/template-renderer/__tests__/template-renderer.test.ts"
pnpm type-check
pnpm exec eslint "src/lib/template-renderer/index.ts" "src/lib/template-renderer/templates/<template>.tsx" "src/lib/template-renderer/__tests__/template-renderer.test.ts"
```

每完成一批模板，运行：

```bash
pnpm lint
```

说明：当前 `pnpm lint` 会把 Web reference lint debt 标为 observation-only。判断是否阻断时，以脚本退出码和 desktop/shared blocking surface 为准。

## 人工验收清单

每个模板迁移后，至少检查：

- 预览能正常渲染；
- PDF 导出能正常生成；
- section 顺序一致；
- 隐藏 section 不显示；
- 空 section 不显示；
- 头像形状和边框一致；
- 联系方式字段一致；
- summary 的 Markdown 加粗一致；
- work experience 的职责、技术栈、亮点一致；
- skills 的结构一致；
- projects 的描述、技术栈、亮点一致；
- certifications、languages、custom、github 一致；
- QR code 不导致渲染崩溃；
- 多页 PDF 没有背景断层和明显分页异常。

对于 `skills`，重点看：

- 如果预览是列表，导出必须也是列表；
- 如果预览是标签，导出必须也是标签；
- 如果预览是逗号拼接，导出才可以逗号拼接；
- 不要在迁移时擅自改变模板设计。

## 不要做的事

- 不要一次迁移全部模板；
- 不要删除 legacy 预览和导出文件；
- 不要绕过 `toCanonicalResume(...)`；
- 不要复制新的 `md`、`esc`、`visibleSections`；
- 不要把用户输入直接插入 HTML 字符串；
- 不要修改 `BACKGROUND_TEMPLATES`、`SIDEBAR_DARK_TEMPLATES`，除非迁移中明确发现模板分类错误；
- 不要只跑类型检查就认为完成，必须做 parity 测试；
- 不要让预览和导出的 skills、highlights、projects 使用不同 DOM 结构。

## 完成标准

一个模板可以认为迁移完成，需要同时满足：

- `src/lib/template-renderer/templates/<template>.tsx` 已创建；
- `src/lib/template-renderer/index.ts` 已注册；
- `testTemplateParity('<template>')` 已加入；
- 针对本模板特殊结构的回归断言已加入；
- legacy fallback 仍保留；
- 针对性测试通过；
- `pnpm type-check` 通过；
- 相关 ESLint 通过；
- 一次人工预览和导出对比通过。

完成后可以在提交说明中写：

```text
feat: migrate <template> resume template to unified renderer
```
