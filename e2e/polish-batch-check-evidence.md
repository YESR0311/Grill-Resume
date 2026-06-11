# B3 polish-batch-check 验收证据

- 运行时间：2026-06-11T09:53:12.829Z
- 命令：pnpm exec tsx --conditions=react-server scripts/polish-batch-check.ts
- 结果：46/46 通过
- 说明：临时项目均以 polish-batch-check 前缀创建于本地 .workspace（gitignored）；
  旧数据 fixture 仅记录路径不记录内容；mock LLM 仅监听本机回环端口。
- mock LLM 端口：44124（仅本机回环，返回不可解析内容驱动 fallback 候选）

| 组 | 断言 | 结果 |
|---|---|---|
| A store 加固 | createPolishRun 后无 *.tmp 残留 | PASS |
| A store 加固 | writePolishRun 后无 *.tmp 残留 | PASS |
| A store 加固 | 目录混入坏文件后 listPolishRuns 不抛 | PASS |
| A store 加固 | 坏文件被跳过、好 run 仍在列表 | PASS |
| A store 加固 | readPolishRun 坏文件 → null | PASS |
| A store 加固 | readPolishRun 好文件正常返回且更新已落盘 | PASS |
| B 旧数据兼容 | 找到真实 v1 applied fixture | PASS |
| B 旧数据兼容 | 真实 v1 run parse 通过并出现在列表 | PASS |
| B 旧数据兼容 | 旧 run valueTier 为 undefined | PASS |
| B 旧数据兼容 | 旧 run schemaVersion 不变 | PASS |
| C 排序纯函数 | high → 无评级(medium 档) → low，同 rank 保序 | PASS |
| C 排序纯函数 | 无 summary → 输出与入参顺序一致 | PASS |
| C 排序纯函数 | 返回新数组，不改入参 | PASS |
| C 排序纯函数 | 全部无评级（同 rank）→ 稳定排序退化为原顺序 | PASS |
| D 生成集成 | 端点不可达 → 生成整体抛错（既有行为不回归） | PASS |
| D 生成集成 | 抛错后未落盘半截 run | PASS |
| D 生成集成 | limit=0 → 不生成仅返回 progress | PASS |
| D 生成集成 | limit=1 → 只生成 1 条 | PASS |
| D 生成集成 | 首条按 tier 排序命中 high 经历 | PASS |
| D 生成集成 | 有评级 → run.valueTier 落盘 | PASS |
| D 生成集成 | LLM 内容不可解析 → 3 条 fallback 候选（lowConfidence） | PASS |
| D 生成集成 | 二次 limit=1 幂等续跑（不重复生成首条） | PASS |
| D 生成集成 | 次条命中无评级经历（medium 档居中） | PASS |
| D 生成集成 | 无评级 → valueTier 不落盘 | PASS |
| D 生成集成 | 不带 limit 补齐剩余条目 | PASS |
| D 生成集成 | low 经历 valueTier 落盘 | PASS |
| D 生成集成 | 全覆盖后再调 → 0 新增 | PASS |
| D 生成集成 | 不带 options → 全量生成（现调用方行为） | PASS |
| D 生成集成 | 不带 options → 全部 run 无 valueTier | PASS |
| E batchApply | applied 2 / failed 1 | PASS |
| E batchApply | 非法 runId 失败原因明确 | PASS |
| E batchApply | 新 bullet confirmed 且带 polish 痕迹字段 | PASS |
| E batchApply | 新 bullet 默认取候选文本 | PASS |
| E batchApply | finalText 覆写生效（trim 后） | PASS |
| E batchApply | 原 bullet 已 archived | PASS |
| E batchApply | run 状态推进为 applied | PASS |
| E batchApply | 已应用候选再次应用 → failed（非 ready） | PASS |
| E batchApply | 同一 run 在 items 出现两次 → 第二项失败（批内同源护栏先截获） | PASS |
| E batchApply | 不同 run 同一原始 bullet → 后到项失败 | PASS |
| E batchApply | finalText 全空白 → failed 且不落盘 | PASS |
| E batchApply | 失败项不产生半截改动 | PASS |
| E batchApply | 空 items → 空结果 | PASS |
| E batchApply | 项目不存在 → 全部 failed | PASS |
| F 单条路径回归 | executeApplyPolish 仍以 redirect 收尾 | PASS |
| F 单条路径回归 | 单条 apply 三步序列行为不变（新增/归档/run 推进） | PASS |
| F 单条路径回归 | 单条默认取候选文本（FormData 无 finalText） | PASS |
