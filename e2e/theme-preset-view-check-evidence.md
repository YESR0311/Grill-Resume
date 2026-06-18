# F5 theme-preset-view-check 验收证据

- 运行时间：2026-06-18T02:38:00.146Z
- 命令：pnpm exec tsx scripts/theme-preset-view-check.ts
- 结果：20/20 通过
- 说明：F5 只测纯函数 summarizeThemePreset / applyPresetToOverrides（不调写盘 action、不出网）。
  写盘清洗（normalizeLayoutOverrides 钳制 + 证据校验）由既有 saveLayoutOverridesAction 路径覆盖，F5 不重测。
  覆盖摘要派生（clean/classic/compact）/整体替换/删 theme 字段/不残留手调/保留非 theme 字段/不可变/SSoT 完整性。

| 组 | 断言 | 结果 |
|---|---|---|
| A | clean → 默认排版 | PASS |
| B | 含 正文 SimSun | PASS |
| B | 含 标题 SimHei | PASS |
| B | 含 西文 Times New Roman | PASS |
| B | 含 11pt | PASS |
| B | 含 行距 1.2 | PASS |
| C | 含 10pt | PASS |
| C | 含 行距 1.12 | PASS |
| C | 不含字体 chip | PASS |
| D | theme.fontCJK=SimSun | PASS |
| D | theme.fontCJKHeading=SimHei | PASS |
| D | theme.baseFontPt=11 | PASS |
| E | clean → 无 theme 字段 | PASS |
| F | accentColor 不残留 | PASS |
| F | fontLatin 被 classic 覆盖 | PASS |
| G | blockOrder 保留 | PASS |
| G | hiddenBlocks 保留 | PASS |
| G | bulletOverrides 保留 | PASS |
| H | 输入 overrides 未被改动 | PASS |
| I | 预设为 clean/classic/compact | PASS |
