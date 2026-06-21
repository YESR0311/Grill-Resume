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

console.log(`\nmerge-collected: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
