import { promises as fs } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import {
  rateExperienceRuleBased,
  reconcileLlmRatings,
  synthesizeEvaluationSummary,
} from "@/features/evaluation";
import type { LlmRating } from "@/features/evaluation";
import {
  createSession,
  evaluationSummarySchema,
  readSession,
  updateSessionEvaluationSummary,
} from "@/features/pipeline";
import type { EvaluationSummary } from "@/features/pipeline";
import type { CompanyVerifyFinding } from "@/features/coach/company-verify";
import type { JdCoverageResult } from "@/features/coach/jd-coverage";
import type { SkillScarcityFinding } from "@/features/coach/skill-scarcity";
import { createProject } from "@/features/resume/storage";
import type { Experience, ResumeDocument } from "@/features/resume/types";
import { getProjectDir } from "@/lib/workspace";

// 运行方式：cd app && pnpm exec tsx --conditions=react-server scripts/evaluation-check.ts
// （--conditions=react-server 让 "server-only" 解析到空模块；依赖 cwd = app/，与 intake-interview-check.ts 同惯例）
const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "evaluation-check-evidence.md");
const REAL_DOCUMENT_PATH = path.resolve(APP_ROOT, ".backend-coach-document.json");
const FIXED_NOW = "2026-06-11T08:00:00.000Z";

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

// ---------- fixtures ----------

function makeExperience(id: string, organization: string, bulletText: string): Experience {
  return {
    id,
    organization,
    role: "实习生",
    evidence: [],
    bullets: [
      {
        id: `${id}-b1`,
        text: bulletText,
        sourceEvidenceIds: [],
        qualityFlags: [],
        status: "confirmed",
      },
    ],
  };
}

function makeDocument(experiences: Experience[]): ResumeDocument {
  return {
    schemaVersion: "resume-local-v1",
    id: "doc-eval-check",
    kind: "master",
    title: "evaluation-check fixture",
    basics: { name: "测试", targetRole: "运营", links: [] },
    education: [],
    experiences,
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    template: { id: "ats" },
    metadata: { createdAt: FIXED_NOW, updatedAt: FIXED_NOW },
  } as ResumeDocument;
}

function citation(url: string, title: string) {
  return { title, url, snippet: `${title} 摘要` };
}

// e1 verified（2 来源）、e2 partial（1 来源）、e3 无核验结果但命中 2 项高需求技能
const expVerified = makeExperience("exp-verified", "已核验公司", "负责跨境订单跟进");
const expPartial = makeExperience("exp-partial", "部分核验公司", "负责活动策划执行");
const expScarce = makeExperience("exp-scarce", "未核验公司", "使用 Prompt Engineering 与 AI Agent 编排搭建流程");
const fixtureDocument = makeDocument([expVerified, expPartial, expScarce]);

const fixtureVerification: CompanyVerifyFinding[] = [
  {
    id: "exp-verified",
    label: "已核验公司",
    source: "experience",
    status: "verified",
    citations: [
      citation("https://example.com/a", "来源A"),
      citation("https://example.com/b", "来源B"),
      citation("https://example.com/a", "来源A重复"),
    ],
  },
  {
    id: "exp-partial",
    label: "部分核验公司",
    source: "experience",
    status: "partial",
    citations: [citation("https://example.com/c", "来源C")],
  },
  // source=project 的 finding 必须被引擎忽略（即使 id 撞 experience）
  {
    id: "exp-verified",
    label: "同名项目",
    source: "project",
    status: "unverified",
    citations: [],
  },
];

const fixtureScarcity: SkillScarcityFinding[] = [
  { skill: "Prompt Engineering", level: "high-demand", citations: [] },
  { skill: "AI Agent", level: "high-demand", citations: [] },
  { skill: "Excel", level: "moderate-demand", citations: [] },
];

const jdCoverageOk: JdCoverageResult = {
  status: "ok",
  covered: ["数据分析", "用户增长"],
  uncovered: ["SQL"],
  total: 3,
};
const jdCoverageNone: JdCoverageResult = { status: "no-keywords" };

function ratingOf(summary: EvaluationSummary, experienceId: string) {
  return summary.experienceRatings.find((rating) => rating.experienceId === experienceId);
}

// ---------- A 组：规则评级 ----------

async function groupA(): Promise<EvaluationSummary> {
  const group = "A 规则评级";
  const run = () =>
    synthesizeEvaluationSummary({
      document: fixtureDocument,
      reportId: "report-fixture",
      scarcity: fixtureScarcity,
      verification: fixtureVerification,
      jdCoverage: jdCoverageOk,
      config: null,
      now: FIXED_NOW,
    });

  const first = await run();
  const second = await run();

  check(group, "config null → source rule-based", first.source === "rule-based");
  check(group, "summary 过 evaluationSummarySchema.parse", evaluationSummarySchema.safeParse(first.summary).success);
  check(group, "每条经历都有评级", first.summary.experienceRatings.length === 3);

  const verified = ratingOf(first.summary, "exp-verified");
  const partial = ratingOf(first.summary, "exp-partial");
  const scarce = ratingOf(first.summary, "exp-scarce");
  check(group, "verified → high / 80 分", verified?.tier === "high" && verified.score === 80);
  check(group, "partial → medium / 55 分", partial?.tier === "medium" && partial.score === 55);
  check(
    group,
    "无核验 + 稀缺信号 2 → low 升 medium / 65 分",
    scarce?.tier === "medium" && scarce.score === 65,
    `tier=${scarce?.tier} score=${scarce?.score}`,
  );
  check(group, "升级评级 rationale 注明稀缺度加成", Boolean(scarce?.rationale.includes("技能稀缺度加成")));
  check(group, "同输入确定性（now 注入后深相等）", JSON.stringify(first) === JSON.stringify(second));
  check(group, "schemaVersion = eval-summary-v1", first.summary.schemaVersion === "eval-summary-v1");
  check(group, "reportId 透传", first.summary.reportId === "report-fixture");
  return first.summary;
}

// ---------- B 组：citations 归属 ----------

function groupB(summary: EvaluationSummary): void {
  const group = "B citations 归属";
  const verified = ratingOf(summary, "exp-verified");
  const partial = ratingOf(summary, "exp-partial");
  const scarce = ratingOf(summary, "exp-scarce");

  check(
    group,
    "verified citations URL 去重后落入对应经历",
    JSON.stringify(verified?.searchCitations) === JSON.stringify(["https://example.com/a", "https://example.com/b"]),
    JSON.stringify(verified?.searchCitations),
  );
  check(
    group,
    "partial 单来源归属正确",
    JSON.stringify(partial?.searchCitations) === JSON.stringify(["https://example.com/c"]),
  );
  check(group, "无核验经历 searchCitations 为空", scarce?.searchCitations.length === 0);
  check(group, "空佐证 rationale 含规则推断声明", Boolean(scarce?.rationale.includes("（无外部佐证，此评级为规则推断）")));
  check(
    group,
    "有佐证 rationale 不带推断声明",
    Boolean(verified && !verified.rationale.includes("规则推断")),
  );
}

// ---------- C 组：LLM 降级 ----------

async function groupC(): Promise<void> {
  const group = "C LLM 降级";
  const unreachable = await synthesizeEvaluationSummary({
    document: fixtureDocument,
    reportId: "report-unreachable",
    scarcity: fixtureScarcity,
    verification: fixtureVerification,
    jdCoverage: jdCoverageNone,
    config: {
      id: "cfg-check",
      provider: "openai-compatible",
      name: "evaluation-check 不可达端点",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "sk-test-evaluation-check",
      model: "test-model",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    now: FIXED_NOW,
  });
  check(group, "端点不可达 → source rule-based", unreachable.source === "rule-based");
  check(group, "降级后评级仍齐全且 schema 合法", evaluationSummarySchema.safeParse(unreachable.summary).success && unreachable.summary.experienceRatings.length === 3);

  // mock LLM 成功路径（审查 M1）：本地 http server 返回合法 chat completion，
  // 验证集成链路 source === "llm" 且后验（幻觉丢弃 / 遗漏补齐 / citations 确定性）生效。
  const mockRatings = {
    ratings: [
      { experienceId: "exp-ghost", score: 99, tier: "high", rationale: "幻觉经历，应被后验丢弃" },
      { experienceId: "exp-verified", score: 88, tier: "high", rationale: "据来源A/B，公司核验充分，经历可信" },
      { experienceId: "exp-scarce", score: 60, tier: "medium", rationale: "技能稀缺，价值较高" },
      // exp-partial 故意遗漏 → 后验规则补齐
    ],
  };
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockRatings) } }] }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const viaLlm = await synthesizeEvaluationSummary({
      document: fixtureDocument,
      reportId: "report-mock-llm",
      scarcity: fixtureScarcity,
      verification: fixtureVerification,
      jdCoverage: jdCoverageOk,
      config: {
        id: "cfg-mock",
        provider: "openai-compatible",
        name: "evaluation-check mock LLM",
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey: "sk-test-evaluation-check",
        model: "mock-model",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      now: FIXED_NOW,
    });
    check(group, "mock LLM 成功 → source llm", viaLlm.source === "llm");
    check(group, "LLM 路径 summary schema 合法", evaluationSummarySchema.safeParse(viaLlm.summary).success);
    const llmVerified = ratingOf(viaLlm.summary, "exp-verified");
    check(group, "LLM 评级被采纳（score/tier 来自模型）", llmVerified?.score === 88 && llmVerified.tier === "high");
    check(
      group,
      "集成链路 searchCitations 仍来自 verification",
      JSON.stringify(llmVerified?.searchCitations) === JSON.stringify(["https://example.com/a", "https://example.com/b"]),
    );
    check(group, "幻觉 experienceId 集成层被丢弃", !viaLlm.summary.experienceRatings.some((rating) => rating.experienceId === "exp-ghost"));
    const llmPartial = ratingOf(viaLlm.summary, "exp-partial");
    check(group, "遗漏经历集成层被规则补齐", Boolean(llmPartial?.rationale.startsWith("模型遗漏该经历，已按规则补齐：")));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ---------- D 组：reconcileLlmRatings 纯函数直测 ----------

function groupD(): void {
  const group = "D LLM 后验";
  const verificationByExperience = new Map(
    fixtureVerification
      .filter((finding) => finding.source === "experience")
      .map((finding) => [finding.id, finding] as const),
  );
  const llmRatings: LlmRating[] = [
    { experienceId: "exp-ghost", score: 99, tier: "high", rationale: "幻觉经历，应被丢弃" },
    { experienceId: "exp-verified", score: 250.7, tier: "high", rationale: "据来源A/B，跨境业务真实" },
    { experienceId: "exp-scarce", score: 70, tier: "medium", rationale: "技能稀缺，价值较高" },
    // exp-partial 故意遗漏 → 规则补齐
  ];
  const reconciled = reconcileLlmRatings({
    document: fixtureDocument,
    llmRatings,
    verificationByExperience,
    scarcity: fixtureScarcity,
  });

  check(group, "输出仅含 document 内经历（幻觉 id 被丢弃）", reconciled.length === 3 && !reconciled.some((rating) => rating.experienceId === "exp-ghost"));
  const verified = reconciled.find((rating) => rating.experienceId === "exp-verified");
  check(group, "score clamp 到 0-100 整数", verified?.score === 100);
  check(
    group,
    "searchCitations 来自 verification 而非 LLM",
    JSON.stringify(verified?.searchCitations) === JSON.stringify(["https://example.com/a", "https://example.com/b"]),
  );
  const partial = reconciled.find((rating) => rating.experienceId === "exp-partial");
  check(group, "遗漏经历被规则补齐并注明", Boolean(partial?.rationale.startsWith("模型遗漏该经历，已按规则补齐：")));
  check(group, "补齐评级沿用规则 tier", partial?.tier === "medium");
  const scarce = reconciled.find((rating) => rating.experienceId === "exp-scarce");
  check(
    group,
    "LLM 空佐证且未自述推断 → 追加推断声明",
    Boolean(scarce?.rationale.includes("（无外部佐证，此评级为推断）")),
    scarce?.rationale,
  );

  // 规则评级函数边界：scarcitySignal 升级在 verified 上封顶 high
  const topRating = rateExperienceRuleBased({
    experience: expVerified,
    verification: fixtureVerification[0],
    scarcitySignal: 3,
  });
  check(group, "verified + 加成仍封顶 high 且 score clamp", topRating.tier === "high" && topRating.score === 95);
}

// ---------- E 组：JD 推导 ----------

async function groupE(): Promise<void> {
  const group = "E JD 推导";
  const ok = await synthesizeEvaluationSummary({
    document: fixtureDocument,
    reportId: "report-jd",
    scarcity: [],
    verification: [],
    jdCoverage: jdCoverageOk,
    config: null,
    now: FIXED_NOW,
  });
  check(group, "jdMatchScore = round(2/3×100) = 67", ok.summary.jdMatchScore === 67, String(ok.summary.jdMatchScore));
  check(group, "uncoveredKeywords 正确", JSON.stringify(ok.summary.uncoveredKeywords) === JSON.stringify(["SQL"]));

  const none = await synthesizeEvaluationSummary({
    document: fixtureDocument,
    reportId: "report-jd-none",
    scarcity: [],
    verification: [],
    jdCoverage: jdCoverageNone,
    config: null,
    now: FIXED_NOW,
  });
  check(group, "no-keywords → jdMatchScore 缺省", none.summary.jdMatchScore === undefined);
  check(group, "no-keywords → uncoveredKeywords []", none.summary.uncoveredKeywords.length === 0);
}

// ---------- F 组：session 写入 ----------

async function groupF(summary: EvaluationSummary): Promise<void> {
  const group = "F session 写入";
  const { project, resume } = await createProject({ name: "evaluation-check-b2" });
  const session = await createSession(project.id, resume.id);
  check(group, "新建 session 无 evaluationSummary", session.evaluationSummary === undefined);

  const updated = await updateSessionEvaluationSummary(session.id, summary);
  check(group, "写入返回值携带 summary", updated.evaluationSummary?.schemaVersion === "eval-summary-v1");

  const reloaded = await readSession(project.id, session.id);
  check(group, "重新 load 后 summary 在场且 schema 合法", Boolean(reloaded?.evaluationSummary) && evaluationSummarySchema.safeParse(reloaded?.evaluationSummary).success);
  check(group, "重新 load 内容与写入一致", JSON.stringify(reloaded?.evaluationSummary) === JSON.stringify(summary));
  check(group, "updatedAt 已刷新", Boolean(reloaded && reloaded.updatedAt >= session.updatedAt && reloaded.updatedAt !== session.createdAt));

  const sessionsDir = path.join(getProjectDir(project.id), "pipeline-sessions");
  const entries = await fs.readdir(sessionsDir);
  check(group, "无 *.tmp 残留", entries.every((name) => !name.endsWith(".tmp")), entries.join(","));

  const badSummary = { ...summary, schemaVersion: "eval-summary-v999" } as unknown as EvaluationSummary;
  const rejected = await updateSessionEvaluationSummary(session.id, badSummary).then(
    () => false,
    () => true,
  );
  check(group, "非法 summary 被 parse 拒绝", rejected);
}

// ---------- G 组：真实文档回归 ----------

async function groupG(): Promise<void> {
  const group = "G 真实文档回归";
  let document: ResumeDocument;
  try {
    document = JSON.parse(await fs.readFile(REAL_DOCUMENT_PATH, "utf-8")) as ResumeDocument;
    check(group, "真实文档文件可读取", true);
  } catch (error) {
    check(group, "真实文档文件可读取", false, String(error));
    return;
  }
  const { summary, source } = await synthesizeEvaluationSummary({
    document,
    reportId: "report-real-doc",
    scarcity: [],
    verification: [],
    jdCoverage: jdCoverageNone,
    config: null,
    now: FIXED_NOW,
  });
  check(group, "规则路径（无配置）", source === "rule-based");
  check(group, "3 段经历全部产出评级", summary.experienceRatings.length === document.experiences.length && document.experiences.length === 3);
  check(group, "全部评级 schema 合法", evaluationSummarySchema.safeParse(summary).success);
  check(
    group,
    "无核验输入 → 全部 low + 推断声明",
    summary.experienceRatings.every((rating) => rating.tier === "low" && rating.rationale.includes("规则推断")),
  );
}

// ---------- evidence ----------

async function writeEvidence(): Promise<void> {
  const passed = results.filter((result) => result.passed).length;
  const lines = [
    "# B2 evaluation-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    `- 命令：pnpm exec tsx --conditions=react-server scripts/evaluation-check.ts`,
    `- 结果：${passed}/${results.length} 通过`,
    "",
    "| 组 | 断言 | 结果 |",
    "|---|---|---|",
    ...results.map(
      (result) => `| ${result.group} | ${result.name} | ${result.passed ? "PASS" : "FAIL"} |`,
    ),
    "",
  ];
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  const summary = await groupA();
  groupB(summary);
  await groupC();
  groupD();
  await groupE();
  await groupF(summary);
  await groupG();

  await writeEvidence();
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("evaluation-check 运行失败：", error);
  process.exitCode = 1;
});
