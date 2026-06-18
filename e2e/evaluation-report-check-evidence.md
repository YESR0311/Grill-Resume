# F1 evaluation-report-check 验收证据

- 运行时间：2026-06-18T01:02:05.334Z
- 命令：pnpm exec tsx scripts/evaluation-report-check.ts
- 结果：21/21 通过
- 说明：F1 只测纯函数 buildEvaluationReportView（不渲染 React、不出网、无临时项目）；
  覆盖空态/experienceId 映射/未知经历降级/tier 分桶/jdMatchScore 缺省在场/关键词与引用透传。

| 组 | 断言 | 结果 |
|---|---|---|
| A | summary 缺省 → empty=true | PASS |
| A | ratings 为空数组 | PASS |
| A | tierCounts 全 0 | PASS |
| A | jdMatchScore undefined | PASS |
| A | uncoveredKeywords 空 | PASS |
| B | exp-1 解析为对应 label | PASS |
| B | exp-2 解析为对应 label | PASS |
| B | empty=false（有 ratings） | PASS |
| C | 未知 experienceId 不丢行 | PASS |
| C | 降级 resolved=false | PASS |
| C | 降级标题以「未知经历(」开头 | PASS |
| C | 降级标题含 experienceId 前 8 位 | PASS |
| D | tierCounts high=2 | PASS |
| D | tierCounts medium=1 | PASS |
| D | tierCounts low=1 | PASS |
| D | score 整数原值透传 | PASS |
| E | jdMatchScore 缺省 → undefined | PASS |
| E | jdMatchScore 在场 → 82 透传 | PASS |
| F | uncoveredKeywords 原序透传 | PASS |
| F | searchCitations 透传到 citations | PASS |
| F | reportId/createdAt 透传 | PASS |
