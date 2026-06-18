# F4 fit-explanation-view-check 验收证据

- 运行时间：2026-06-18T02:18:51.989Z
- 命令：pnpm exec tsx scripts/fit-explanation-view-check.ts
- 结果：27/27 通过
- 说明：F4 只测纯函数 buildFitExplanation（不调 B4 引擎、不写盘、不出网）。
  覆盖空决策/trim/hide/混合汇总/排序/block 名映射/未知 id 兜底/不可变。

| 组 | 断言 | 结果 |
|---|---|---|
| A | hasAdaptation=false | PASS |
| A | items 空 | PASS |
| A | 计数全 0 | PASS |
| B | removedCount=2 | PASS |
| B | label=字节跳动 · 后端工程师 | PASS |
| B | kind=experience | PASS |
| B | trimmedBulletTotal=2 | PASS |
| C | removedCount=0 | PASS |
| C | hiddenBlockTotal=1 | PASS |
| C | label=开源简历生成器 | PASS |
| C | trimmedBulletTotal=0 | PASS |
| D | trimmedBulletTotal=4 | PASS |
| D | hiddenBlockTotal=1 | PASS |
| D | items=3 | PASS |
| D | hasAdaptation=true | PASS |
| E | 首项为 hide-block | PASS |
| E | 次项 removedCount 多者在前 | PASS |
| E | 末项 removedCount 少者在后 | PASS |
| E2 | 同数量按 blockId 字典序 exp-1 在前 | PASS |
| F | experience=org · role | PASS |
| F | project=name | PASS |
| F | education 带 degree=org · degree | PASS |
| F | education 无 degree=org | PASS |
| G | label=未知板块 | PASS |
| G | kind=unknown | PASS |
| G | 仍计入裁剪数 | PASS |
| H | 输入数组顺序未被改动 | PASS |
