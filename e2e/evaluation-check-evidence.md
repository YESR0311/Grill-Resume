# B2 evaluation-check 验收证据

- 运行时间：2026-06-11T09:53:31.459Z
- 命令：pnpm exec tsx --conditions=react-server scripts/evaluation-check.ts
- 结果：46/46 通过

| 组 | 断言 | 结果 |
|---|---|---|
| A 规则评级 | config null → source rule-based | PASS |
| A 规则评级 | summary 过 evaluationSummarySchema.parse | PASS |
| A 规则评级 | 每条经历都有评级 | PASS |
| A 规则评级 | verified → high / 80 分 | PASS |
| A 规则评级 | partial → medium / 55 分 | PASS |
| A 规则评级 | 无核验 + 稀缺信号 2 → low 升 medium / 65 分 | PASS |
| A 规则评级 | 升级评级 rationale 注明稀缺度加成 | PASS |
| A 规则评级 | 同输入确定性（now 注入后深相等） | PASS |
| A 规则评级 | schemaVersion = eval-summary-v1 | PASS |
| A 规则评级 | reportId 透传 | PASS |
| B citations 归属 | verified citations URL 去重后落入对应经历 | PASS |
| B citations 归属 | partial 单来源归属正确 | PASS |
| B citations 归属 | 无核验经历 searchCitations 为空 | PASS |
| B citations 归属 | 空佐证 rationale 含规则推断声明 | PASS |
| B citations 归属 | 有佐证 rationale 不带推断声明 | PASS |
| C LLM 降级 | 端点不可达 → source rule-based | PASS |
| C LLM 降级 | 降级后评级仍齐全且 schema 合法 | PASS |
| C LLM 降级 | mock LLM 成功 → source llm | PASS |
| C LLM 降级 | LLM 路径 summary schema 合法 | PASS |
| C LLM 降级 | LLM 评级被采纳（score/tier 来自模型） | PASS |
| C LLM 降级 | 集成链路 searchCitations 仍来自 verification | PASS |
| C LLM 降级 | 幻觉 experienceId 集成层被丢弃 | PASS |
| C LLM 降级 | 遗漏经历集成层被规则补齐 | PASS |
| D LLM 后验 | 输出仅含 document 内经历（幻觉 id 被丢弃） | PASS |
| D LLM 后验 | score clamp 到 0-100 整数 | PASS |
| D LLM 后验 | searchCitations 来自 verification 而非 LLM | PASS |
| D LLM 后验 | 遗漏经历被规则补齐并注明 | PASS |
| D LLM 后验 | 补齐评级沿用规则 tier | PASS |
| D LLM 后验 | LLM 空佐证且未自述推断 → 追加推断声明 | PASS |
| D LLM 后验 | verified + 加成仍封顶 high 且 score clamp | PASS |
| E JD 推导 | jdMatchScore = round(2/3×100) = 67 | PASS |
| E JD 推导 | uncoveredKeywords 正确 | PASS |
| E JD 推导 | no-keywords → jdMatchScore 缺省 | PASS |
| E JD 推导 | no-keywords → uncoveredKeywords [] | PASS |
| F session 写入 | 新建 session 无 evaluationSummary | PASS |
| F session 写入 | 写入返回值携带 summary | PASS |
| F session 写入 | 重新 load 后 summary 在场且 schema 合法 | PASS |
| F session 写入 | 重新 load 内容与写入一致 | PASS |
| F session 写入 | updatedAt 已刷新 | PASS |
| F session 写入 | 无 *.tmp 残留 | PASS |
| F session 写入 | 非法 summary 被 parse 拒绝 | PASS |
| G 真实文档回归 | 真实文档文件可读取 | PASS |
| G 真实文档回归 | 规则路径（无配置） | PASS |
| G 真实文档回归 | 3 段经历全部产出评级 | PASS |
| G 真实文档回归 | 全部评级 schema 合法 | PASS |
| G 真实文档回归 | 无核验输入 → 全部 low + 推断声明 | PASS |
