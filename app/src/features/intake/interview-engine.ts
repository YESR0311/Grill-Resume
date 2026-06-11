import {
  INTAKE_CATEGORIES,
  type IntakeAnswer,
  type IntakeCategory,
  type IntakeInterviewSession,
  type IntakeQuestion,
  type IntakeSessionStatus,
} from "./types";

/**
 * intake 引导访谈引擎：全部为纯函数 reducer，不做 IO、不自取时间。
 * 时间约定：submitIntakeAnswer 以 answer.createdAt 为时间源；
 * 其余状态转换由调用方传入 now（ISO 字符串）。
 */

type QuestionDef = {
  category: IntakeCategory;
  prompt: string;
  hint: string;
  repeatable: boolean;
};

const QUESTION_DEFS: readonly QuestionDef[] = [
  {
    category: "education",
    prompt: "先聊聊教育背景：你在哪所学校、读什么专业、什么学历？",
    hint: "格式：学校｜学历｜专业，如：示例大学｜本科｜计算机科学",
    repeatable: false,
  },
  {
    category: "internship",
    prompt: "有过实习或工作经历吗？挑一段说说：在哪家组织、什么岗位、主要做了什么？",
    hint: "格式：组织｜岗位｜做了什么；一段经历一次作答，答完可继续补充下一段",
    repeatable: true,
  },
  {
    category: "project",
    prompt: "做过什么项目（课程设计、毕业设计、个人或开源项目都算）？项目叫什么、你担任什么角色、用了哪些技术？",
    hint: "格式：项目名｜角色｜技术栈；一个项目一次作答",
    repeatable: true,
  },
  {
    category: "competition",
    prompt: "参加过比赛或竞赛吗？比赛名称是什么、你担任什么角色、取得了什么成绩？",
    hint: "格式：比赛名｜角色｜成绩；一个比赛一次作答",
    repeatable: true,
  },
  {
    category: "skill",
    prompt: "你掌握哪些技能或工具？用顿号或逗号列出来即可。",
    hint: "格式：技能1、技能2、技能3",
    repeatable: false,
  },
];

/** 生成固定的 5 类引导问题队列；id 稳定（同输入同输出），顺序 = INTAKE_CATEGORIES。 */
export function buildIntakeQuestionQueue(): IntakeQuestion[] {
  return QUESTION_DEFS.map((def) => ({
    id: `intake-${def.category}-1`,
    category: def.category,
    prompt: def.prompt,
    hint: def.hint,
    repeatable: def.repeatable,
  }));
}

/** 冷启动建会话：status 从 collecting 开始，时间由调用方传入。 */
export function createIntakeInterviewSession(input: {
  id: string;
  projectId: string;
  resumeId: string;
  now: string;
}): IntakeInterviewSession {
  return {
    schemaVersion: "intake-interview-v1",
    id: input.id,
    projectId: input.projectId,
    resumeId: input.resumeId,
    status: "collecting",
    answers: [],
    skippedCategories: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function assertStatus(
  session: IntakeInterviewSession,
  expected: IntakeSessionStatus,
  action: string,
): void {
  if (session.status !== expected) {
    throw new Error(`无法${action}：会话状态为 ${session.status}，要求 ${expected}`);
  }
}

/**
 * 取下一个待问问题：按 INTAKE_CATEGORIES 顺序，跳过已 skip 的类别；
 * 不可重复类别已答 → 下一类；可重复类别在被 skip 前持续返回
 * （“还有下一段吗”的追问语义由前端控制，引擎只看 skippedCategories）。
 * 全部覆盖 → null（提示可进入归拢）。
 */
export function nextIntakeQuestion(
  session: IntakeInterviewSession,
  queue: IntakeQuestion[],
): IntakeQuestion | null {
  for (const category of INTAKE_CATEGORIES) {
    if (session.skippedCategories.includes(category)) continue;
    const question = queue.find((item) => item.category === category);
    if (!question) continue;
    const answered = session.answers.some((answer) => answer.category === category);
    if (answered && !question.repeatable) continue;
    return question;
  }
  return null;
}

/** 提交一条回答（仅 collecting 可提交）；session.updatedAt 取 answer.createdAt。 */
export function submitIntakeAnswer(
  session: IntakeInterviewSession,
  answer: IntakeAnswer,
): IntakeInterviewSession {
  assertStatus(session, "collecting", "提交回答");
  if (!answer.answerText.trim()) {
    throw new Error("回答内容不能为空");
  }
  return {
    ...session,
    answers: [...session.answers, answer],
    updatedAt: answer.createdAt,
  };
}

/** 跳过一个类别（仅 collecting）；重复 skip 幂等。 */
export function skipIntakeCategory(
  session: IntakeInterviewSession,
  category: IntakeCategory,
  now: string,
): IntakeInterviewSession {
  assertStatus(session, "collecting", "跳过类别");
  if (session.skippedCategories.includes(category)) {
    return session;
  }
  return {
    ...session,
    skippedCategories: [...session.skippedCategories, category],
    updatedAt: now,
  };
}

/** collecting → consolidating；至少需要 1 条回答。 */
export function beginConsolidation(session: IntakeInterviewSession, now: string): IntakeInterviewSession {
  assertStatus(session, "collecting", "开始归拢");
  if (session.answers.length === 0) {
    throw new Error("至少需要一条回答才能开始归拢");
  }
  return {
    ...session,
    status: "consolidating",
    updatedAt: now,
  };
}

/** consolidating → review；记录归拢产物 candidateId。 */
export function markReview(
  session: IntakeInterviewSession,
  candidateId: string,
  now: string,
): IntakeInterviewSession {
  assertStatus(session, "consolidating", "进入确认");
  return {
    ...session,
    status: "review",
    candidateId,
    updatedAt: now,
  };
}

/** review → applied；applied 是终态，B5 据此把 grill subStage 切到 deep-dive。 */
export function markApplied(session: IntakeInterviewSession, now: string): IntakeInterviewSession {
  assertStatus(session, "review", "标记已落库");
  return {
    ...session,
    status: "applied",
    appliedAt: now,
    updatedAt: now,
  };
}

/** review → collecting：用户补答重归拢；清空上一轮 candidateId。 */
export function reopenCollecting(session: IntakeInterviewSession, now: string): IntakeInterviewSession {
  assertStatus(session, "review", "返回补答");
  return {
    ...session,
    status: "collecting",
    candidateId: undefined,
    updatedAt: now,
  };
}
