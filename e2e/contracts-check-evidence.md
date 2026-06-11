# contracts-check 验收证据

- 运行时间：2026-06-11T08:23:29.996Z
- 运行命令：`cd app && pnpm exec tsx scripts/contracts-check.ts`
- 结果：全部通过（共 19 项断言）

| 组 | 断言 | 结果 | 备注 |
|---|---|---|---|
| A. EvaluationSummary schema | 合法样例 parse 通过 | PASS |  |
| A. EvaluationSummary schema | 可选字段 jdMatchScore 缺省仍通过 | PASS |  |
| A. EvaluationSummary schema | score 越界 (120) 被拒绝 | PASS |  |
| A. EvaluationSummary schema | tier 非法 (ultra) 被拒绝 | PASS |  |
| A. EvaluationSummary schema | 缺 schemaVersion 被拒绝 | PASS |  |
| B. shouldRunIntake 形态矩阵 | 全空文档 → intake | PASS |  |
| B. shouldRunIntake 形态矩阵 | 纯骨架（无 evidence/confirmed bullet）→ intake | PASS |  |
| B. shouldRunIntake 形态矩阵 | 仅 draft bullet 仍视为骨架 → intake | PASS |  |
| B. shouldRunIntake 形态矩阵 | 含 evidence 经历 → deep-dive | PASS |  |
| B. shouldRunIntake 形态矩阵 | 骨架 + confirmed bullet 项目混合 → deep-dive | PASS |  |
| B. shouldRunIntake 形态矩阵 | 仅有教育信息不影响判定 → intake | PASS |  |
| C. 新字段前向形态 | stage state 携带 subStage parse 通过 | PASS |  |
| C. 新字段前向形态 | stage state 不带 subStage 仍通过（旧形态） | PASS |  |
| D. 旧 fixture 向后兼容 | 扩展后 schema parse 全部旧 session（9 个） | PASS |  |
| D. 旧 fixture 向后兼容 | .backend-coach-document.json 经 resumeDocumentSchema parse | PASS |  |
| D. 旧 fixture 向后兼容 | .backend-coach-document.json shouldRunIntake 可运行且为 deep-dive | PASS |  |
| D. 旧 fixture 向后兼容 | .backend-coach-document-2page.json 经 resumeDocumentSchema parse | PASS |  |
| D. 旧 fixture 向后兼容 | .backend-coach-document-2page.json shouldRunIntake 可运行且为 deep-dive | PASS |  |
| D. 旧 fixture 向后兼容 | .backend-coach-session.json 可读且含 answers 数组 | PASS |  |

说明：`.backend-coach-session.json` 为 coach 问答 answers fixture（非 pipeline session），
向后兼容验证以 `.workspace/projects/*/pipeline-sessions/*.json` 为 pipelineSessionSchema 实际对象。
