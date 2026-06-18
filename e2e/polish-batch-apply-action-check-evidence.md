# F3 polish-batch-apply-action-check 验收证据

- 运行时间：2026-06-18T01:56:42.065Z
- 命令：pnpm exec tsx scripts/polish-batch-apply-action-check.ts
- 结果：13/13 通过
- 说明：F3 只测纯函数 parseBatchApplySelections / buildBatchPolishRedirect（不调引擎、不写盘、不出网）；
  引擎 executeBatchApplyPolish 已由 B3 polish-batch-check.ts 覆盖，F3 不重测。
  覆盖合法解析/畸形丢弃/精确对去重/首冒号切分/计数编码/空选择/路由前缀。

| 组 | 断言 | 结果 |
|---|---|---|
| A | 解析出 2 项 | PASS |
| A | r1:c1 正确 | PASS |
| A | r2:c2 正确 | PASS |
| B | 仅保留合法项 r2:c2 | PASS |
| C | 去重后 2 项 | PASS |
| C | 保留 r1:c1 + r1:c2 | PASS |
| D | 按首个冒号切分 | PASS |
| E | polishStatus=batch-applied | PASS |
| E | batchApplied=3 | PASS |
| E | batchFailed=1 | PASS |
| F | 空选择 → batch-empty | PASS |
| F | 无 batchApplied 参数 | PASS |
| G | 前缀 /projects/proj-1/coach/polish? | PASS |
