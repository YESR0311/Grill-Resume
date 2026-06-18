import { promises as fs } from "node:fs";
import path from "node:path";
// generateMissingPipelinePolishRuns 即便 limit:0 也无条件读全局模型配置（crypto），与本任务接线正交；
// 开发态给 crypto dev fallback secret（src/lib/crypto.ts:7），与 B3/B4 验收同前提。
if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: "development" });
}
import { synthesizeEvaluationSummary } from "@/features/evaluation";
import type { EvaluationResearchRaw } from "@/features/coach/evaluation-research";
import { buildResearchFindings } from "@/features/coach/evaluation-research";
import {
  createSession,
  readSession,
  updateSessionEvaluationSummary,
} from "@/features/pipeline";
import {
  orderEligibleBulletsByValue,
  type EligibleBullet,
} from "@/features/pipeline/polish";
import { buildPipelineExportSnapshot } from "@/features/pipeline/pipeline-exporter";
import { experienceValueRatingSchema, type EvaluationSummary } from "@/features/pipeline/types";
import { createProject, getProjectResume, updateResumeSections } from "@/features/resume/storage";
import type { Experience } from "@/features/resume/types";

// 运行方式：cd app && pnpm exec tsx --conditions=react-server scripts/orchestration-check.ts
// （与 polish-batch-check.ts 同惯例；依赖 cwd = app/）
// B5 编排接线闭网验收：config=null 规则降级 + limit:0 不触发 LLM，全程不出网。
// 临时项目均以 orchestration-check 前缀创建于本地 .workspace（gitignored），证据只记路径。

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "orchestration-check-evidence.md");

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };

const results: CheckResult[] = [];
const evidenceNotes: string[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------- fixtures ----------

function makeExperience(id: string, organization: string, bulletTexts: string[]): Experience {
  return {
    id,
    organization,
    role: "前端工程师",
    location: "上海",
    startDate: "2022.07",
    endDate: "至今",
    evidence: [
      {
        id: `${id}-ev-1`,
        context: `${organization} 的业务背景`,
        task: "负责核心页面交付",
        actions: ["维护组件库", "接入类型校验"],
        results: [{ text: "页面交付效率提升", confidence: "confirmed" as const }],
        skills: ["React", "TypeScript"],
        sourceText: `${organization} 经历原始材料。`,
      },
    ],
    bullets: bulletTexts.map((text, index) => ({
      id: `${id}-b${index + 1}`,
      text,
      sourceEvidenceIds: [`${id}-ev-1`],
      qualityFlags: [],
      status: "confirmed" as const,
    })),
  } as Experience;
}

// 手构三路 raw（闭网：runEvaluationResearch 需 provider 出网，此处直接喂引擎与映射）。
function makeRaw(experienceIds: string[]): EvaluationResearchRaw {
  return {
    scarcity: [
      { skill: "React", level: "high-demand", citations: [] },
      { skill: "Excel", level: "niche", citations: [] },
    ],
    verification: experienceIds.map((id, index) => ({
      id,
      label: `${id} 公司`,
      source: "experience" as const,
      status: index === 0 ? ("verified" as const) : ("unverified" as const),
      citations: [],
    })),
    jdCoverage: { status: "ok", covered: ["react"], uncovered: ["kubernetes"], total: 2 },
  };
}

async function setupProject(name: string, experiences: Experience[]) {
  const { project, resume } = await createProject({ name });
  await updateResumeSections(resume.id, { experiences });
  const current = await getProjectResume(project.id, resume.id);
  if (!current) throw new Error("temp project setup failed");
  return { project, resume, current };
}

function makeSummary(ratings: Array<{ experienceId: string; tier: "high" | "medium" | "low" }>): EvaluationSummary {
  return {
    schemaVersion: "eval-summary-v1",
    reportId: "report-orchestration-check",
    createdAt: "2026-06-18T08:00:00.000Z",
    experienceRatings: ratings.map((rating) => ({
      experienceId: rating.experienceId,
      score: rating.tier === "high" ? 80 : rating.tier === "medium" ? 55 : 30,
      tier: rating.tier,
      rationale: "orchestration-check fixture",
      searchCitations: [],
    })),
    uncoveredKeywords: [],
  };
}

// ---------- A 组：evaluate 引擎降级产出 ----------

async function groupA(document: Experience[]): Promise<EvaluationSummary> {
  const group = "A-evaluate引擎";
  const doc = {
    schemaVersion: "resume-local-v1" as const,
    id: "doc-a",
    kind: "master" as const,
    title: "测试简历",
    basics: { name: "张三" },
    education: [],
    experiences: document,
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    template: { id: "ats" as const },
    metadata: { createdAt: "2026-06-18T08:00:00.000Z", updatedAt: "2026-06-18T08:00:00.000Z" },
    // cast：config=null 规则降级路径只读 document.experiences（见 synthesize.ts rateExperienceRuleBased）；
    // 此 fixture 满足该访问面。若 ResumeDocument 新增规则路径会读的必填字段，需补全此 fixture。
  } as unknown as Parameters<typeof synthesizeEvaluationSummary>[0]["document"];

  const raw = makeRaw(document.map((exp) => exp.id));
  const { summary, source } = await synthesizeEvaluationSummary({
    document: doc,
    reportId: "report-orchestration-check",
    scarcity: raw.scarcity,
    verification: raw.verification,
    jdCoverage: raw.jdCoverage,
    config: null,
  });

  check(group, "config=null 走规则降级 source=rule-based", source === "rule-based", source);
  check(
    group,
    "experienceRatings 非空且覆盖全部经历",
    summary.experienceRatings.length === document.length,
    `${summary.experienceRatings.length}/${document.length}`,
  );
  const allInt = summary.experienceRatings.every((rating) => Number.isInteger(rating.score));
  check(group, "所有 score 均为整数（clampScore 取整）", allInt, summary.experienceRatings.map((r) => r.score).join(","));
  const jdInt = summary.jdMatchScore === undefined || Number.isInteger(summary.jdMatchScore);
  check(group, "jdMatchScore 为整数或缺省", jdInt, String(summary.jdMatchScore));
  return summary;
}

// ---------- B 组：session 写读 ----------

async function groupB(summary: EvaluationSummary): Promise<void> {
  const group = "B-session写读";
  const { project, resume } = await setupProject("orchestration-check-b", [
    makeExperience("exp-b1", "公司B1", ["负责核心模块交付"]),
  ]);
  const session = await createSession(project.id, resume.id);
  evidenceNotes.push("B 组临时项目以 orchestration-check-b 前缀创建于本地 .workspace（gitignored）");

  const before = await readSession(project.id, session.id);
  check(group, "新建 session 未写入前 evaluationSummary 缺省", before?.evaluationSummary === undefined);

  const updated = await updateSessionEvaluationSummary(session.id, summary);
  check(group, "updateSessionEvaluationSummary 返回的 session 带 summary", deepEqual(updated.evaluationSummary, summary));

  const readBack = await readSession(project.id, session.id);
  check(
    group,
    "readSession 读回 session.evaluationSummary 与写入深相等",
    deepEqual(readBack?.evaluationSummary, summary),
  );
}

// ---------- C 组：polish 接线 ----------

function groupC(): void {
  const group = "C-polish接线";
  const summary = makeSummary([
    { experienceId: "exp-c-high", tier: "high" },
    { experienceId: "exp-c-low", tier: "low" },
  ]);

  // B5 接线 = actions.ts:107 把 session.evaluationSummary 传入 generateMissingPipelinePolishRuns
  // （tsc 验签名 + B3 polish-batch-check 已全量覆盖该函数 options 行为）。本组只验 B5 关心的
  // 「summary 驱动排序」纯函数流（无配置/无出网），不重复 B3 的引擎运行时断言。
  const eligible: EligibleBullet[] = [
    { experienceId: "exp-c-low", sourceBulletId: "exp-c-low-b1", sourceBulletText: "低1", sourceEvidenceIds: [], evidenceSnippets: [] },
    { experienceId: "exp-c-high", sourceBulletId: "exp-c-high-b1", sourceBulletText: "高1", sourceEvidenceIds: [], evidenceSnippets: [] },
  ];
  const sorted = orderEligibleBulletsByValue(eligible, summary);
  check(
    group,
    "传入 summary：high 经历 bullet 排在 low 之前",
    sorted[0]?.experienceId === "exp-c-high" && sorted[1]?.experienceId === "exp-c-low",
    sorted.map((item) => item.experienceId).join(","),
  );
  const original = orderEligibleBulletsByValue(eligible, undefined);
  check(
    group,
    "summary 缺省：维持原序（优雅降级）",
    deepEqual(original.map((item) => item.sourceBulletId), eligible.map((item) => item.sourceBulletId)),
  );
}

// ---------- D 组：export 接线 ----------

async function groupD(summary: EvaluationSummary): Promise<void> {
  const group = "D-export接线";
  const { project, resume, current } = await setupProject("orchestration-check-d", [
    makeExperience("exp-d1", "公司D1", ["负责核心模块交付", "推动性能优化"]),
  ]);

  const withSingle = await buildPipelineExportSnapshot({
    projectId: project.id,
    resumeId: resume.id,
    document: current.document,
    options: { evaluationSummary: summary, singlePage: true },
  });
  check(group, "singlePage:true → snapshot.fitDecisions 在场", Array.isArray(withSingle.fitDecisions), JSON.stringify(withSingle.fitDecisions));

  const withoutSingle = await buildPipelineExportSnapshot({
    projectId: project.id,
    resumeId: resume.id,
    document: current.document,
  });
  check(group, "不传 options → 无 fitDecisions（与现状一致）", !("fitDecisions" in withoutSingle));
}

// ---------- E 组：coach 零回归（buildResearchFindings 抽取等价） ----------

function groupE(): void {
  const group = "E-coach零回归";
  const raw: EvaluationResearchRaw = {
    scarcity: [
      { skill: "React", level: "high-demand", citations: [] },
      { skill: "Excel", level: "niche", citations: [] },
    ],
    verification: [
      { id: "exp-1", label: "字节跳动", source: "experience", status: "verified", citations: [] },
      { id: "proj-1", label: "内部平台", source: "project", status: "unverified", citations: [] },
    ],
    jdCoverage: { status: "ok", covered: ["react"], uncovered: ["k8s"], total: 2 },
  };
  const findings = buildResearchFindings(raw);

  // 下方 index 断言依赖 buildResearchFindings 的固定产出顺序 [jdFindings..., scarcity..., verification...]：
  // 本 fixture 的 jdCoverage 不带 webCitations → 无 jd findings，故 findings[0/1]=scarcity、[2/3]=verification。
  // 若改 fixture 引入 webCitations，须同步更新下方计数与 index。
  // jdCoverage.webCitations 缺省 → 无 jd findings；scarcity 2 + verification 2 = 4。
  check(group, "findings 计数 = scarcity + verification（webCitations 缺省无 jd）", findings.length === 4, String(findings.length));
  check(
    group,
    "scarcity 映射：high-demand→high、niche→low；source 随 citations 空为 resume",
    findings[0]?.confidence === "high" && findings[1]?.confidence === "low" && findings[0]?.source === "resume",
  );
  check(
    group,
    "verification 映射：verified→high/company verify、unverified→low/project verify",
    findings[2]?.confidence === "high" &&
      findings[2]?.sourceLabel === "Tavily company verify" &&
      findings[3]?.confidence === "low" &&
      findings[3]?.sourceLabel === "Tavily project verify",
  );
  check(group, "所有 finding kind=research_fact、canEnterResume=false", findings.every((f) => f.kind === "research_fact" && f.canEnterResume === false));
}

// ---------- F 组：.int() 契约 ----------

function groupF(): void {
  const group = "F-.int()";
  const base = { experienceId: "exp-1", tier: "high" as const, rationale: "x", searchCitations: [] };
  check(group, "整数 score=99 通过", experienceValueRatingSchema.safeParse({ ...base, score: 99 }).success);
  check(group, "小数 score=99.5 被拒绝", experienceValueRatingSchema.safeParse({ ...base, score: 99.5 }).success === false);
  check(group, "越界 score=120 仍被拒绝（max 不变）", experienceValueRatingSchema.safeParse({ ...base, score: 120 }).success === false);
}

// ---------- evidence ----------

async function writeEvidence(): Promise<void> {
  const passed = results.filter((result) => result.passed).length;
  const lines = [
    "# B5 orchestration-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    `- 命令：pnpm exec tsx --conditions=react-server scripts/orchestration-check.ts`,
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：全程闭网（config=null 规则降级 + limit:0 不触发 LLM，不出网）；",
    "  临时项目以 orchestration-check 前缀创建于本地 .workspace（gitignored），仅记前缀不记 ID。",
    ...evidenceNotes.map((note) => `- ${note}`),
    "",
    "| 组 | 断言 | 结果 |",
    "|---|---|---|",
    ...results.map((result) => `| ${result.group} | ${result.name} | ${result.passed ? "PASS" : "FAIL"} |`),
    "",
  ];
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  const experiences = [makeExperience("exp-a1", "公司A1", ["负责核心模块"]), makeExperience("exp-a2", "公司A2", ["支撑业务扩展"])];
  const summary = await groupA(experiences);
  await groupB(summary);
  groupC();
  await groupD(summary);
  groupE();
  groupF();

  await writeEvidence();
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("orchestration-check 运行失败：", error);
  process.exitCode = 1;
});
