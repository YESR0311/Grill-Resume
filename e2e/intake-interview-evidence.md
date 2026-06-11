# intake-interview-check 验收证据（B1）

- 运行时间：2026-06-11T09:02:21.311Z
- 运行命令：`cd app && pnpm exec tsx --conditions=react-server scripts/intake-interview-check.ts`
- 结果：全部通过（共 39 项断言）

| 组 | 断言 | 结果 | 备注 |
|---|---|---|---|
| A. 问题队列 | 覆盖全部 5 类且顺序 = INTAKE_CATEGORIES | PASS |  |
| A. 问题队列 | id 稳定（两次调用深相等） | PASS |  |
| A. 问题队列 | prompt / hint 全部非空 | PASS |  |
| A. 问题队列 | repeatable 标记（实习/项目/比赛可重复，教育/技能不可） | PASS |  |
| B. 会话 reducer 状态机 | 冷启动会话 status = collecting | PASS |  |
| B. 会话 reducer 状态机 | 首问为 education | PASS |  |
| B. 会话 reducer 状态机 | reducer 纯函数（原会话对象未被修改） | PASS |  |
| B. 会话 reducer 状态机 | education 已答（不可重复）→ 下一问 internship | PASS |  |
| B. 会话 reducer 状态机 | internship 可重复：已答仍返回该类 | PASS |  |
| B. 会话 reducer 状态机 | skip internship 后跳到 project | PASS |  |
| B. 会话 reducer 状态机 | 重复 skip 幂等 | PASS |  |
| B. 会话 reducer 状态机 | 全类别覆盖后 nextIntakeQuestion = null | PASS |  |
| B. 会话 reducer 状态机 | 非法转换 collecting → applied 被拒 | PASS |  |
| B. 会话 reducer 状态机 | 空回答被拒 | PASS |  |
| B. 会话 reducer 状态机 | 无回答时 beginConsolidation 被拒 | PASS |  |
| B. 会话 reducer 状态机 | beginConsolidation → consolidating | PASS |  |
| B. 会话 reducer 状态机 | markReview → review 且记录 candidateId | PASS |  |
| B. 会话 reducer 状态机 | reopenCollecting → collecting 且清空 candidateId | PASS |  |
| B. 会话 reducer 状态机 | 补答后重走 → applied 且记录 appliedAt | PASS |  |
| C. 规则归拢 | internship 两条 → experiences 两张卡 | PASS |  |
| C. 规则归拢 | 经历卡组织/岗位/draft 要点正确 | PASS |  |
| C. 规则归拢 | project + competition → projects 两张卡 | PASS |  |
| C. 规则归拢 | 竞赛卡名称带“竞赛：”前缀 | PASS |  |
| C. 规则归拢 | education → 教育卡（学校/学历/专业） | PASS |  |
| C. 规则归拢 | skill → 技能卡且顿号分列 | PASS |  |
| C. 规则归拢 | 全部卡片为骨架（evidence 空、bullets 全 draft） | PASS |  |
| C. 规则归拢 | 同输入两次归拢确定性（归一化 id/createdAt 后深相等） | PASS |  |
| D. LLM 降级 | config = null → source = rule-based | PASS |  |
| D. LLM 降级 | 端点不可达 → 降级 rule-based | PASS |  |
| E. 会话存储 | save → load 深相等 | PASS |  |
| E. 会话存储 | 不存在的会话 → null | PASS |  |
| E. 会话存储 | 非法 sessionId（路径穿越）被拒 | PASS |  |
| E. 会话存储 | 原子写无 *.tmp 残留 | PASS |  |
| E. 会话存储 | 坏文件被跳过、合法会话齐全 | PASS |  |
| E. 会话存储 | 列表按 updatedAt 倒序 | PASS |  |
| F. 落库衔接 deep-dive | applyIntakeCandidates 落库（经历2/项目2/教育1/技能1） | PASS |  |
| F. 落库衔接 deep-dive | 落库后 shouldRunIntake 仍为 true（转换须由会话状态驱动） | PASS |  |
| F. 落库衔接 deep-dive | deep-dive 队列为全部 4 张经历/项目卡生成条目 | PASS |  |
| F. 落库衔接 deep-dive | 每张骨架卡均获得 context/action/result/evidence 四连问 | PASS | 后端实习生 @ 示例科技:4问; 运营实习生 @ 示例传媒:4问; 校园二手交易平台 · 后端负责人:4问; 竞赛：全国大学生数学建模竞赛 · 队长:4问 |

说明：F 组同时固化了转换语义的事实依据——draft 骨架落库后 `shouldRunIntake` 仍为 true，
因此 intake → deep-dive 由 IntakeInterviewSession.status === "applied" 驱动（B5 接线约束）。
E/F 组在 `.workspace`（gitignored）创建了 `intake-check-b1` 临时项目，未强制清理。
