# B4 layout-export-check 验收证据

- 运行时间：2026-06-12T13:22:50.934Z
- 命令：pnpm exec tsx --conditions=react-server scripts/layout-export-check.ts
- 结果：35/35 通过
- 说明：docx 产物与临时项目均在本地 .workspace（gitignored），证据只记录路径；
  docx 机检经 python3 zipfile 解包 word/document.xml；
  页边距换算 mmToTwips(19.8)=1123（design 原文 1122 为笔误，公式为准）。
- F 组临时项目以 layout-export-check-f 前缀创建于本地 .workspace（gitignored），仅记录前缀不记录 ID

| 组 | 断言 | 结果 |
|---|---|---|
| A-theme兼容 | 旧 overrides（无新字段）解析通过且不凭空出现新字段 | PASS |
| A-theme兼容 | 新字段白名单：空白字体名丢弃、headingFontPt clamp 22、sectionSpacingPt clamp 0 | PASS |
| A-theme兼容 | fontCJKHeading 缺省时全文 eastAsia 单一值（Microsoft YaHei） | PASS |
| A-theme兼容 | 缺省渲染 section 标题前距维持 210 twips | PASS |
| A-theme兼容 | 设 fontCJKHeading=SimHei：标题与姓名 run 为 SimHei、正文 run 仍 fontCJK | PASS |
| A-theme兼容 | headingFontPt=12 → 标题 sz 24 半点；sectionSpacingPt=12 → before 240 | PASS |
| B-preset | preset 表为 clean/classic/compact 三套 | PASS |
| B-preset | getLayoutThemePreset 命中与未知 id 返回 null | PASS |
| B-preset | preset clean 过 themeOverride 白名单解析无损往返 | PASS |
| B-preset | preset classic 过 themeOverride 白名单解析无损往返 | PASS |
| B-preset | preset compact 过 themeOverride 白名单解析无损往返 | PASS |
| B-preset | classic 渲染：标题 SimHei / 正文 SimSun / 标题 22 半点（11pt） | PASS |
| B-preset | classic 拉丁字体 Times New Roman 进入 ascii | PASS |
| C-marginsMm | 默认 19.8mm → pgMar 四边 = mmToTwips(19.8) = 1123（修正 design 笔误 1122） | PASS |
| C-marginsMm | classic margins {17.8,20.3,14,20.3} → {1009,1151,794,1151} | PASS |
| D-估算器 | 同输入两次深相等 | PASS |
| D-估算器 | 追加 bullet 后 totalLines 严格增加 | PASS |
| D-估算器 | 等长文本：CJK 行数 ≥ Latin（全宽 1 / 半宽 0.5 折算） | PASS |
| E-适配器 | 溢出 + 评级：low 先被裁且只裁必要数量（溢出 1 行 → 只删尾部 1 条） | PASS |
| E-适配器 | high/medium block 原样、low 裁后 3 条（≥ 下限 2）、不再溢出 | PASS |
| E-适配器 | 适配器确定性：同输入两次深相等 | PASS |
| E-适配器 | 极端溢出：overflow=true、high 仍 6 条原样、low 裁至下限（尾部先删）后整块隐藏 | PASS |
| E-适配器 | 无评级：全按 unrated（=medium 档）从尾部收紧，前部 block 原样 | PASS |
| E-适配器 | 不溢出：schema 原样返回（同引用）+ decisions 空 + overflow=false | PASS |
| F-pipelineToExport | 不带 options：layoutSchema/gapReport 与直投影深相等、无 fitDecisions 键 | PASS |
| F-pipelineToExport | 不带 options：readyForExport 与现状口径一致 | PASS |
| F-pipelineToExport | singlePage 不溢出：fitDecisions 在场且为空数组（表示适配已运行） | PASS |
| F-pipelineToExport | singlePage + summary：fitDecisions 非空、low 进入决策、high 原样 | PASS |
| F-pipelineToExport | snapshot 写入/读回 parse 通过且 fitDecisions 保留 | PASS |
| F-pipelineToExport | 旧 snapshot（无 fitDecisions）parse 通过（z.custom 兼容，零迁移） | PASS |
| G-旧模板零回归 | renderExport json-resume 不抛错且产物非空 | PASS |
| G-旧模板零回归 | renderExport docx-ats 不抛错且产物非空 | PASS |
| G-旧模板零回归 | renderExport docx-visual 不抛错且产物非空 | PASS |
| G-旧模板零回归 | renderExport docx-zh-clean 不抛错且产物非空 | PASS |
| G-旧模板零回归 | renderExport pdf 不抛错且产物非空 | PASS |
