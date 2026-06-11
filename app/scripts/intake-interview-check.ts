import { promises as fs } from "node:fs";
import path from "node:path";
import {
  INTAKE_CATEGORIES,
  beginConsolidation,
  buildIntakeQuestionQueue,
  consolidateIntakeAnswers,
  consolidateIntakeAnswersRuleBased,
  createIntakeInterviewSession,
  listIntakeSessions,
  loadIntakeSession,
  markApplied,
  markReview,
  nextIntakeQuestion,
  reopenCollecting,
  saveIntakeSession,
  shouldRunIntake,
  skipIntakeCategory,
  submitIntakeAnswer,
  applyIntakeCandidates,
} from "@/features/intake";
import type { IntakeAnswer, IntakeCategory, IntakeInterviewSession } from "@/features/intake";
import { buildExperienceQuestionQueue } from "@/features/coach/questions";
import { createProject } from "@/features/resume/storage";
import type { OpenAICompatibleConfig } from "@/features/ai/model-configs";

// 运行方式：cd app && pnpm exec tsx --conditions=react-server scripts/intake-interview-check.ts
// （--conditions=react-server 让 "server-only" 解析到空模块；依赖 cwd = app/，与 contracts-check.ts 同惯例）
const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "intake-interview-evidence.md");

type CheckResult = {
  group: string;
  name: string;
  passed: boolean;
  detail?: string;
};

const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function expectThrow(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function makeAnswer(category: IntakeCategory, text: string, seq: number): IntakeAnswer {
  return {
    id: `intake-check-answer-${category}-${seq}`,
    questionId: `intake-${category}-1`,
    category,
    answerText: text,
    createdAt: nowIso(),
  };
}

/** 归一化 nanoid / 时间戳后做确定性深比较。 */
function normalizeGenerated(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeGenerated);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = key === "id" || key === "createdAt" ? "<normalized>" : normalizeGenerated(val);
    }
    return out;
  }
  return value;
}

function groupA(): void {
  const group = "A. 问题队列";
  const queue1 = buildIntakeQuestionQueue();
  const queue2 = buildIntakeQuestionQueue();
  check(group, "覆盖全部 5 类且顺序 = INTAKE_CATEGORIES", queue1.map((q) => q.category).join(",") === INTAKE_CATEGORIES.join(","));
  check(group, "id 稳定（两次调用深相等）", JSON.stringify(queue1) === JSON.stringify(queue2));
  check(group, "prompt / hint 全部非空", queue1.every((q) => q.prompt.trim().length > 0 && (q.hint ?? "").trim().length > 0));
  check(
    group,
    "repeatable 标记（实习/项目/比赛可重复，教育/技能不可）",
    queue1.every((q) => q.repeatable === ["internship", "project", "competition"].includes(q.category)),
  );
}

/** B 组顺带产出后续 C/D/F 复用的已归拢会话。 */
function groupB(): { consolidating: IntakeInterviewSession } {
  const group = "B. 会话 reducer 状态机";
  const queue = buildIntakeQuestionQueue();
  let session = createIntakeInterviewSession({
    id: "intake-check-session-1",
    projectId: "placeholder",
    resumeId: "placeholder",
    now: nowIso(),
  });
  check(group, "冷启动会话 status = collecting", session.status === "collecting");
  check(group, "首问为 education", nextIntakeQuestion(session, queue)?.category === "education");

  const before = session;
  session = submitIntakeAnswer(session, makeAnswer("education", "示例大学｜本科｜计算机科学", 1));
  check(group, "reducer 纯函数（原会话对象未被修改）", before.answers.length === 0 && session.answers.length === 1);
  check(group, "education 已答（不可重复）→ 下一问 internship", nextIntakeQuestion(session, queue)?.category === "internship");

  session = submitIntakeAnswer(session, makeAnswer("internship", "示例科技｜后端实习生｜负责订单服务的接口开发与联调", 1));
  check(group, "internship 可重复：已答仍返回该类", nextIntakeQuestion(session, queue)?.category === "internship");
  session = submitIntakeAnswer(session, makeAnswer("internship", "示例传媒｜运营实习生｜负责校园活动的策划与执行", 2));

  session = skipIntakeCategory(session, "internship", nowIso());
  check(group, "skip internship 后跳到 project", nextIntakeQuestion(session, queue)?.category === "project");
  check(group, "重复 skip 幂等", skipIntakeCategory(session, "internship", nowIso()).skippedCategories.length === session.skippedCategories.length);

  session = submitIntakeAnswer(session, makeAnswer("project", "校园二手交易平台｜后端负责人｜Spring Boot、MySQL", 1));
  session = skipIntakeCategory(session, "project", nowIso());
  session = submitIntakeAnswer(session, makeAnswer("competition", "全国大学生数学建模竞赛｜队长｜省一等奖", 1));
  session = skipIntakeCategory(session, "competition", nowIso());
  session = submitIntakeAnswer(session, makeAnswer("skill", "Python、SQL、Excel", 1));
  check(group, "全类别覆盖后 nextIntakeQuestion = null", nextIntakeQuestion(session, queue) === null);

  check(group, "非法转换 collecting → applied 被拒", expectThrow(() => markApplied(session, nowIso())));
  check(group, "空回答被拒", expectThrow(() => submitIntakeAnswer(session, makeAnswer("skill", "   ", 9))));
  const emptySession = createIntakeInterviewSession({ id: "intake-check-empty", projectId: "p", resumeId: "r", now: nowIso() });
  check(group, "无回答时 beginConsolidation 被拒", expectThrow(() => beginConsolidation(emptySession, nowIso())));

  const consolidating = beginConsolidation(session, nowIso());
  check(group, "beginConsolidation → consolidating", consolidating.status === "consolidating");
  const review = markReview(consolidating, "intake-check-candidate-1", nowIso());
  check(group, "markReview → review 且记录 candidateId", review.status === "review" && review.candidateId === "intake-check-candidate-1");
  const reopened = reopenCollecting(review, nowIso());
  check(group, "reopenCollecting → collecting 且清空 candidateId", reopened.status === "collecting" && reopened.candidateId === undefined);
  const applied = markApplied(markReview(beginConsolidation(reopened, nowIso()), "intake-check-candidate-2", nowIso()), nowIso());
  check(group, "补答后重走 → applied 且记录 appliedAt", applied.status === "applied" && Boolean(applied.appliedAt));

  return { consolidating };
}

function groupC(consolidating: IntakeInterviewSession): { candidate: ReturnType<typeof consolidateIntakeAnswersRuleBased> } {
  const group = "C. 规则归拢";
  const candidate = consolidateIntakeAnswersRuleBased(consolidating);

  check(group, "internship 两条 → experiences 两张卡", candidate.experiences.length === 2);
  check(
    group,
    "经历卡组织/岗位/draft 要点正确",
    candidate.experiences[0]?.organization === "示例科技" &&
      candidate.experiences[0]?.role === "后端实习生" &&
      candidate.experiences[0]?.bullets.length === 1 &&
      candidate.experiences[0]?.bullets[0]?.status === "draft",
  );
  check(group, "project + competition → projects 两张卡", candidate.projects.length === 2);
  check(group, "竞赛卡名称带“竞赛：”前缀", candidate.projects.some((p) => p.name.startsWith("竞赛：")));
  check(group, "education → 教育卡（学校/学历/专业）", candidate.education.length === 1 && candidate.education[0]?.school === "示例大学" && candidate.education[0]?.degree === "本科");
  check(group, "skill → 技能卡且顿号分列", candidate.skills.length === 1 && JSON.stringify(candidate.skills[0]?.items) === JSON.stringify(["Python", "SQL", "Excel"]));
  check(
    group,
    "全部卡片为骨架（evidence 空、bullets 全 draft）",
    [...candidate.experiences, ...candidate.projects].every(
      (card) => card.evidence.length === 0 && card.bullets.every((b) => b.status === "draft"),
    ),
  );
  const again = consolidateIntakeAnswersRuleBased(consolidating);
  check(
    group,
    "同输入两次归拢确定性（归一化 id/createdAt 后深相等）",
    JSON.stringify(normalizeGenerated(candidate)) === JSON.stringify(normalizeGenerated(again)),
  );
  return { candidate };
}

async function groupD(consolidating: IntakeInterviewSession): Promise<void> {
  const group = "D. LLM 降级";
  const noConfig = await consolidateIntakeAnswers({ session: consolidating, config: null });
  check(group, "config = null → source = rule-based", noConfig.source === "rule-based" && noConfig.candidate.experiences.length === 2);

  const unreachable: OpenAICompatibleConfig = {
    id: "intake-check-model",
    provider: "openai-compatible",
    name: "intake-check 不可达端点",
    baseUrl: "http://127.0.0.1:9",
    apiKey: "intake-check-placeholder",
    model: "none",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const failed = await consolidateIntakeAnswers({ session: consolidating, config: unreachable });
  check(group, "端点不可达 → 降级 rule-based", failed.source === "rule-based" && failed.candidate.experiences.length === 2);
}

async function groupE(consolidating: IntakeInterviewSession): Promise<{ projectId: string; resumeId: string }> {
  const group = "E. 会话存储";
  const { project, resume } = await createProject({ name: "intake-check-b1" });
  const session: IntakeInterviewSession = { ...consolidating, projectId: project.id, resumeId: resume.id };

  const filePath = await saveIntakeSession(session);
  const loaded = await loadIntakeSession(project.id, resume.id, session.id);
  check(group, "save → load 深相等", JSON.stringify(loaded) === JSON.stringify(session));
  check(group, "不存在的会话 → null", (await loadIntakeSession(project.id, resume.id, "no-such-session")) === null);
  check(group, "非法 sessionId（路径穿越）被拒", await loadIntakeSession(project.id, resume.id, "../escape").then(() => false).catch(() => true));

  const dir = path.dirname(filePath);
  const entriesAfterSave = await fs.readdir(dir);
  check(group, "原子写无 *.tmp 残留", entriesAfterSave.every((name) => !name.endsWith(".tmp")));

  await fs.writeFile(path.join(dir, "intake-check-broken.json"), "{ 不是合法 JSON", "utf-8");
  const second = { ...session, id: "intake-check-session-2", updatedAt: new Date(Date.now() + 1000).toISOString() };
  await saveIntakeSession(second);
  const listed = await listIntakeSessions(project.id, resume.id);
  check(group, "坏文件被跳过、合法会话齐全", listed.length === 2 && listed.every((s) => s.id.startsWith("intake-check-session")));
  check(group, "列表按 updatedAt 倒序", listed[0]?.id === "intake-check-session-2");

  return { projectId: project.id, resumeId: resume.id };
}

async function groupF(
  ids: { projectId: string; resumeId: string },
  candidate: ReturnType<typeof consolidateIntakeAnswersRuleBased>,
): Promise<void> {
  const group = "F. 落库衔接 deep-dive";
  const document = await applyIntakeCandidates({
    projectId: ids.projectId,
    resumeId: ids.resumeId,
    candidate,
    selection: {
      educationIds: candidate.education.map((item) => item.id),
      experienceIds: candidate.experiences.map((item) => item.id),
      projectIds: candidate.projects.map((item) => item.id),
      skillIds: candidate.skills.map((item) => item.id),
    },
  });
  check(group, "applyIntakeCandidates 落库（经历2/项目2/教育1/技能1）",
    document.experiences.length === 2 && document.projects.length === 2 && document.education.length === 1 && document.skills.length === 1);

  // 固化转换语义依据：draft 骨架落库后 shouldRunIntake 仍为 true，
  // 故 intake → deep-dive 必须由会话状态（applied）驱动，而非该函数（见 B1 design §5 / B0 design §3）。
  check(group, "落库后 shouldRunIntake 仍为 true（转换须由会话状态驱动）", shouldRunIntake(document) === true);

  const queue = buildExperienceQuestionQueue(document);
  check(group, "deep-dive 队列为全部 4 张经历/项目卡生成条目", queue.length === 4);
  const requiredKinds = ["context", "action", "result", "evidence"] as const;
  check(
    group,
    "每张骨架卡均获得 context/action/result/evidence 四连问",
    queue.every((item) => {
      const kinds = new Set(item.questions.map((q) => q.kind));
      return requiredKinds.every((kind) => kinds.has(kind));
    }),
    queue.map((item) => `${item.label}:${item.questions.length}问`).join("; "),
  );
}

async function writeEvidence(): Promise<void> {
  const failed = results.filter((r) => !r.passed);
  const lines = [
    "# intake-interview-check 验收证据（B1）",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 运行命令：`cd app && pnpm exec tsx --conditions=react-server scripts/intake-interview-check.ts`",
    `- 结果：${failed.length === 0 ? "全部通过" : `${failed.length} 项失败`}（共 ${results.length} 项断言）`,
    "",
    "| 组 | 断言 | 结果 | 备注 |",
    "|---|---|---|---|",
    ...results.map((r) => `| ${r.group} | ${r.name} | ${r.passed ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`),
    "",
    "说明：F 组同时固化了转换语义的事实依据——draft 骨架落库后 `shouldRunIntake` 仍为 true，",
    "因此 intake → deep-dive 由 IntakeInterviewSession.status === \"applied\" 驱动（B5 接线约束）。",
    "E/F 组在 `.workspace`（gitignored）创建了 `intake-check-b1` 临时项目，未强制清理。",
    "",
  ];
  await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf-8");
  console.log(`evidence → ${EVIDENCE_PATH}`);
}

async function main(): Promise<void> {
  groupA();
  const { consolidating } = groupB();
  const { candidate } = groupC(consolidating);
  await groupD(consolidating);
  const ids = await groupE(consolidating);
  await groupF(ids, candidate);
  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`intake-interview-check FAILED: ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`intake-interview-check OK: ${results.length}/${results.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
