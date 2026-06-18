# F2 polish-runs-view-check 验收证据

- 运行时间：2026-06-18T01:18:32.829Z
- 命令：pnpm exec tsx scripts/polish-runs-view-check.ts
- 结果：14/14 通过
- 说明：F2 只测纯函数 buildPolishRunsView（不渲染 React、不出网、不读文件）；
  覆盖空态/tier 排序/组内时间倒序/计数/untiered 降级/不 mutate 入参。

| 组 | 断言 | 结果 |
|---|---|---|
| A | 空 runs → total=0 | PASS |
| A | tierCounts 全 0 | PASS |
| A | runs 为空数组 | PASS |
| B | 排序为 high,medium,low,untiered | PASS |
| C | 同 tier 内新在前 | PASS |
| D | tierCounts high=3 | PASS |
| D | tierCounts medium=1 | PASS |
| D | tierCounts low=2 | PASS |
| D | tierCounts untiered=1 | PASS |
| D | total=7 | PASS |
| E | valueTier 缺省 → tier=untiered | PASS |
| E | 不丢行 | PASS |
| E | 计入 untiered | PASS |
| F | 原入参数组顺序未被 mutate | PASS |
