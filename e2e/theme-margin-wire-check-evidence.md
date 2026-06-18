# F6 theme-margin-wire-check 验收证据

- 运行时间：2026-06-18T03:58:04.098Z
- 命令：pnpm exec tsx scripts/theme-margin-wire-check.ts
- 结果：25/25 通过
- 说明：F6 全闭网纯函数验收（无写盘、无出网、无真实 API key）。
  覆盖：applyLayoutOverrides 按 themePresetId 注入 page.marginsMm（classic/compact 覆盖、clean/缺省/非法回默认）；
  normalizeThemePresetId + normalizeLayoutOverrides 白名单清洗；applyPresetToOverrides 记录 themePresetId；
  project() 端到端注入（手构最小 ResumeDocument）；applyLayoutOverrides / applyPresetToOverrides 不可变。

| 组 | 断言 | 结果 |
|---|---|---|
| A | classic → 17.8/20.3/14/20.3 | PASS |
| A | 注入值 = SSoT classic.marginsMm | PASS |
| B | compact → 14 ×4 | PASS |
| C | clean → 默认 19.8 | PASS |
| D | 无 presetId → 默认 19.8 | PASS |
| E | classic 保留 | PASS |
| E | compact 保留 | PASS |
| E | clean 保留 | PASS |
| E | 空串 → undefined | PASS |
| E | "foo" → undefined | PASS |
| E | 数字 → undefined | PASS |
| E | undefined → undefined | PASS |
| E | 对象 → undefined | PASS |
| E | normalize 保留合法 presetId | PASS |
| E | normalize 丢弃非法 presetId | PASS |
| F | 套 classic → themePresetId=classic | PASS |
| F | 套 classic → theme.fontCJK=SimSun | PASS |
| F | 套 clean → themePresetId=clean | PASS |
| F | 套 clean → theme 字段被删 | PASS |
| G | project(compact).page.marginsMm = 14 ×4 | PASS |
| G | project(无 presetId) → 默认 19.8 | PASS |
| G | project(无 overrides) → 默认 19.8 | PASS |
| H | applyLayoutOverrides 不改输入 schema | PASS |
| H | applyLayoutOverrides 不改输入 overrides | PASS |
| H | applyPresetToOverrides 不改输入 overrides | PASS |
