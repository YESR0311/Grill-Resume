/**
 * mergeCollected 纯逻辑单元测试（无测试框架，直接用 node:assert）。
 *
 * 运行方式（项目无 vitest/jest，engine.ts 顶部 import "server-only" 在非
 * server 上下文会抛错，故用 react-server 条件让 server-only 解析为 empty.js）：
 *
 *   cd app && npx tsx --conditions=react-server \
 *     src/features/intake/__tests__/merge-collected.test.ts
 *
 * 验证 evidence/bullets 归属修复（方案 B：成果内嵌 experiences[].bullets）：
 * 成果挂到对应经历（非恒定最后一段）、同经历重复成果去重、跨经历同文本各自保留、
 * 新建经历自带 bullets 写入、空 bullets/空文本安全跳过。
 */

import assert from "node:assert/strict";
import { mergeCollected } from "../engine";
import { createEmptyProfile } from "@/features/profile/types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

// 构造 collected 入参（补齐 mergeCollected 需要的全部字段）。
type Collected = Parameters<typeof mergeCollected>[1];
function collected(
  experiences: Array<{
    id?: string;
    organization?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
    title?: string;
    bullets?: string[];
  }>,
): Collected {
  return {
    name: null,
    title: null,
    email: null,
    phone: null,
    location: null,
    experiences: experiences.map((e) => ({
      id: e.id ?? "",
      organization: e.organization ?? "",
      role: e.role ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      title: e.title ?? "",
      bullets: e.bullets ?? [],
    })),
    projects: [],
    skills: [],
    education: [],
  };
}

// 取某经历的 bullet 文本数组。
function bulletsOf(
  profile: ReturnType<typeof createEmptyProfile>,
  organization: string,
  role: string,
): string[] {
  const exp = profile.experiences.find(
    (e) => e.organization === organization && e.role === role,
  );
  assert.ok(exp, `未找到经历 ${organization}/${role}`);
  return exp.bullets.map((b) => b.text);
}

console.log("intake mergeCollected");

test("成果挂到对应经历，而非恒定最后一段", () => {
  const profile = createEmptyProfile({ id: "p1" });
  mergeCollected(
    profile,
    collected([
      { organization: "公司A", role: "工程师", bullets: ["把延迟降低 40%"] },
      { organization: "公司B", role: "经理", bullets: ["带领 5 人团队"] },
    ]),
  );
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), ["把延迟降低 40%"]);
  assert.deepEqual(bulletsOf(profile, "公司B", "经理"), ["带领 5 人团队"]);
});

test("同一经历重复成果不重复 append（trim 精确去重）", () => {
  const profile = createEmptyProfile({ id: "p2" });
  // 第一轮
  mergeCollected(
    profile,
    collected([{ organization: "公司A", role: "工程师", bullets: ["把延迟降低 40%"] }]),
  );
  // 第二轮：模型重复输出同一成果（含前后空白）
  mergeCollected(
    profile,
    collected([
      { organization: "公司A", role: "工程师", bullets: ["  把延迟降低 40%  ", "新增：上线支付模块"] },
    ]),
  );
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), [
    "把延迟降低 40%",
    "新增：上线支付模块",
  ]);
});

test("同一轮内重复成果也去重", () => {
  const profile = createEmptyProfile({ id: "p3" });
  mergeCollected(
    profile,
    collected([{ organization: "公司A", role: "工程师", bullets: ["A 成果", "A 成果", "B 成果"] }]),
  );
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), ["A 成果", "B 成果"]);
});

test("跨经历同文本各自保留（不跨经历去重）", () => {
  const profile = createEmptyProfile({ id: "p4" });
  mergeCollected(
    profile,
    collected([
      { organization: "公司A", role: "工程师", bullets: ["独立完成核心模块"] },
      { organization: "公司B", role: "经理", bullets: ["独立完成核心模块"] },
    ]),
  );
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), ["独立完成核心模块"]);
  assert.deepEqual(bulletsOf(profile, "公司B", "经理"), ["独立完成核心模块"]);
});

test("新建经历自带 bullets 正确写入", () => {
  const profile = createEmptyProfile({ id: "p5" });
  assert.equal(profile.experiences.length, 0);
  mergeCollected(
    profile,
    collected([{ organization: "新公司", role: "实习生", bullets: ["搭建 CI 流程"] }]),
  );
  assert.equal(profile.experiences.length, 1);
  assert.deepEqual(bulletsOf(profile, "新公司", "实习生"), ["搭建 CI 流程"]);
});

test("空 bullets / 空文本安全跳过", () => {
  const profile = createEmptyProfile({ id: "p6" });
  mergeCollected(
    profile,
    collected([
      { organization: "公司A", role: "工程师", bullets: [] },
      { organization: "公司B", role: "经理", bullets: ["", "   ", "有效成果"] },
    ]),
  );
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), []);
  assert.deepEqual(bulletsOf(profile, "公司B", "经理"), ["有效成果"]);
});

test("bullet 结构含 evidence 子项（content=text）", () => {
  const profile = createEmptyProfile({ id: "p7" });
  mergeCollected(
    profile,
    collected([{ organization: "公司A", role: "工程师", bullets: ["量化成果 X"] }]),
  );
  const exp = profile.experiences[0];
  const bullet = exp.bullets[0];
  assert.equal(bullet.isConfirmed, true);
  assert.equal(bullet.evidence.length, 1);
  assert.equal(bullet.evidence[0].type, "text");
  assert.equal(bullet.evidence[0].content, "量化成果 X");
});

// ─── 方案 b：稳定 id 匹配 + 归一化 label 回退（label-match） ─────────────

test("带 id 命中已有经历：org 本轮缺失也命中，不重复创建", () => {
  const profile = createEmptyProfile({ id: "lm1" });
  // 第一轮：完整经历，记下其 id
  mergeCollected(
    profile,
    collected([{ organization: "公司A", role: "工程师", bullets: ["把延迟降低 40%"] }]),
  );
  assert.equal(profile.experiences.length, 1);
  const expId = profile.experiences[0].id;
  // 第二轮：organization 缺失（label 会变），但 LLM 回传 id → 仍命中同一段
  mergeCollected(
    profile,
    collected([{ id: expId, organization: "", role: "工程师", bullets: ["上线支付模块"] }]),
  );
  assert.equal(profile.experiences.length, 1, "带 id 应命中已有经历，不重复创建");
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), ["把延迟降低 40%", "上线支付模块"]);
});

test("无 id 但归一化 label 命中（大小写/空白差异）", () => {
  const profile = createEmptyProfile({ id: "lm2" });
  mergeCollected(
    profile,
    collected([{ organization: "Acme Corp", role: "Engineer", bullets: ["A 成果"] }]),
  );
  // 第二轮：大小写 + 多余空白差异，无 id → 归一化 label 命中
  mergeCollected(
    profile,
    collected([{ organization: "acme   corp", role: "  ENGINEER ", bullets: ["B 成果"] }]),
  );
  assert.equal(profile.experiences.length, 1, "归一化 label 应命中，不重复创建");
  assert.deepEqual(bulletsOf(profile, "Acme Corp", "Engineer"), ["A 成果", "B 成果"]);
});

test("无 id 无 label 命中 → 新建", () => {
  const profile = createEmptyProfile({ id: "lm3" });
  mergeCollected(
    profile,
    collected([{ organization: "公司A", role: "工程师", bullets: ["A 成果"] }]),
  );
  mergeCollected(
    profile,
    collected([{ organization: "公司B", role: "经理", bullets: ["B 成果"] }]),
  );
  assert.equal(profile.experiences.length, 2, "不同经历应各自新建");
});

test("命中后补全此前为空字段，不覆盖已有非空值", () => {
  const profile = createEmptyProfile({ id: "lm4" });
  // 第一轮：org 为空靠 title 兜底，startDate 缺失
  mergeCollected(
    profile,
    collected([{ organization: "", title: "公司A", role: "工程师", bullets: ["A 成果"] }]),
  );
  const exp0 = profile.experiences[0];
  assert.equal(exp0.organization, "公司A", "title 兜底写入 organization");
  assert.equal(exp0.startDate, "");
  const expId = exp0.id;
  // 第二轮：带 id 命中，本轮补 startDate（之前空）+ 试图改 organization（已非空，应不覆盖）
  mergeCollected(
    profile,
    collected([
      { id: expId, organization: "公司A正式名", role: "工程师", startDate: "2020-01", bullets: [] },
    ]),
  );
  assert.equal(profile.experiences.length, 1);
  assert.equal(exp0.organization, "公司A", "已有非空 organization 不被覆盖");
  assert.equal(exp0.startDate, "2020-01", "此前为空的 startDate 被补全");
});

test("id 失效（profile 无此 id）回退归一化 label 匹配", () => {
  const profile = createEmptyProfile({ id: "lm5" });
  mergeCollected(
    profile,
    collected([{ organization: "公司A", role: "工程师", bullets: ["A 成果"] }]),
  );
  // LLM 回传了一个不存在的 id，但 org/role 一致 → 应回退 label 命中，不重复创建
  mergeCollected(
    profile,
    collected([{ id: "nonexistent", organization: "公司A", role: "工程师", bullets: ["B 成果"] }]),
  );
  assert.equal(profile.experiences.length, 1, "id 失效应回退 label 匹配");
  assert.deepEqual(bulletsOf(profile, "公司A", "工程师"), ["A 成果", "B 成果"]);
});

console.log(`\nmerge-collected: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
