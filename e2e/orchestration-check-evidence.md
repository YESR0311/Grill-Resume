# B5 orchestration-check 验收证据

- 运行时间：2026-06-18T00:39:10.384Z
- 命令：pnpm exec tsx --conditions=react-server scripts/orchestration-check.ts
- 结果：18/18 通过
- 说明：全程闭网（config=null 规则降级 + limit:0 不触发 LLM，不出网）；
  临时项目以 orchestration-check 前缀创建于本地 .workspace（gitignored），仅记前缀不记 ID。
- B 组临时项目以 orchestration-check-b 前缀创建于本地 .workspace（gitignored）

| 组 | 断言 | 结果 |
|---|---|---|
| A-evaluate引擎 | config=null 走规则降级 source=rule-based | PASS |
| A-evaluate引擎 | experienceRatings 非空且覆盖全部经历 | PASS |
| A-evaluate引擎 | 所有 score 均为整数（clampScore 取整） | PASS |
| A-evaluate引擎 | jdMatchScore 为整数或缺省 | PASS |
| B-session写读 | 新建 session 未写入前 evaluationSummary 缺省 | PASS |
| B-session写读 | updateSessionEvaluationSummary 返回的 session 带 summary | PASS |
| B-session写读 | readSession 读回 session.evaluationSummary 与写入深相等 | PASS |
| C-polish接线 | 传入 summary：high 经历 bullet 排在 low 之前 | PASS |
| C-polish接线 | summary 缺省：维持原序（优雅降级） | PASS |
| D-export接线 | singlePage:true → snapshot.fitDecisions 在场 | PASS |
| D-export接线 | 不传 options → 无 fitDecisions（与现状一致） | PASS |
| E-coach零回归 | findings 计数 = scarcity + verification（webCitations 缺省无 jd） | PASS |
| E-coach零回归 | scarcity 映射：high-demand→high、niche→low；source 随 citations 空为 resume | PASS |
| E-coach零回归 | verification 映射：verified→high/company verify、unverified→low/project verify | PASS |
| E-coach零回归 | 所有 finding kind=research_fact、canEnterResume=false | PASS |
| F-.int() | 整数 score=99 通过 | PASS |
| F-.int() | 小数 score=99.5 被拒绝 | PASS |
| F-.int() | 越界 score=120 仍被拒绝（max 不变） | PASS |
