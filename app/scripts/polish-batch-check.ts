import { promises as fs } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { saveOpenAICompatibleConfig } from "@/features/ai/model-configs";
import { executeApplyPolish, executeBatchApplyPolish } from "@/features/coach/action-helpers";
import {
  generateMissingPipelinePolishRuns,
  orderEligibleBulletsByValue,
  type EligibleBullet,
} from "@/features/pipeline/polish";
import type { EvaluationSummary } from "@/features/pipeline";
import type { PolishCandidate } from "@/features/polish/generate";
import { createPolishRun, listPolishRuns, readPolishRun, writePolishRun } from "@/features/polish/store";
import { createProject, getProjectResume, updateResumeSections } from "@/features/resume/storage";
import type { Experience } from "@/features/resume/types";

// 运行方式：cd app && pnpm exec tsx --conditions=react-server scripts/polish-batch-check.ts
// （与 evaluation-check.ts 同惯例；依赖 cwd = app/）
// saveOpenAICompatibleConfig 在非 development 环境拒绝 http://127.0.0.1 baseUrl，
// 且 encryptJson 需要 RESUME_CONFIG_SECRET；本脚本默认走开发态（与 pipeline-e2e 本地代理同前提）。
if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: "development" });
}

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "polish-batch-check-evidence.md");
const FIXED_NOW = "2026-06-11T08:00:00.000Z";

type CheckResult = {
  group: string;
  name: string;
  passed: boolean;
  detail?: string;
};

const results: CheckResult[] = [];
const evidenceNotes: string[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
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

async function setupProject(name: string, experiences: Experience[]) {
  const { project, resume } = await createProject({ name });
  await updateResumeSections(resume.id, { experiences });
  const current = await getProjectResume(project.id, resume.id);
  if (!current) throw new Error("temp project setup failed");
  return { project, resume, current };
}

async function polishDirOf(projectId: string, resumeId: string): Promise<string> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) throw new Error("resume missing");
  return path.join(path.dirname(current.resume.filePath), "polish");
}

function makeCandidates(prefix: string): PolishCandidate[] {
  return (["conservative", "balanced", "aggressive"] as const).map((tone) => ({
    tone,
    text: `${prefix}（${tone} 候选文案）`,
    rationale: `${prefix} 的 ${tone} 改写理由`,
    structure: {},
    lowConfidence: false,
  }));
}

function makeSummary(ratings: Array<{ experienceId: string; tier: "high" | "medium" | "low" }>): EvaluationSummary {
  return {
    schemaVersion: "eval-summary-v1",
    reportId: "report-polish-batch-check",
    createdAt: FIXED_NOW,
    experienceRatings: ratings.map((rating) => ({
      experienceId: rating.experienceId,
      score: rating.tier === "high" ? 80 : rating.tier === "medium" ? 55 : 30,
      tier: rating.tier,
      rationale: "polish-batch-check fixture",
      searchCitations: [],
    })),
    uncoveredKeywords: [],
  };
}

async function noTmpResidue(dir: string): Promise<{ ok: boolean; entries: string[] }> {
  const entries = await fs.readdir(dir);
  return { ok: entries.every((name) => !name.endsWith(".tmp")), entries };
}

// 在创建任何临时项目之前扫描既有 .workspace，锁定真实 v1 fixture（无 valueTier 的已存量 run），
// 避免把本脚本自己生成的 run 误当旧数据。只记录路径，不向证据文件写入内容（PII）。
async function findLegacyRunFile(): Promise<string | null> {
  const projectsDir = path.resolve(APP_ROOT, ".workspace", "projects");
  let projectIds: string[];
  try {
    projectIds = await fs.readdir(projectsDir);
  } catch {
    return null;
  }
  for (const projectId of projectIds) {
    const polishDir = path.join(projectsDir, projectId, "resumes", "master", "polish");
    let entries: string[];
    try {
      entries = await fs.readdir(polishDir);
    } catch {
      continue;
    }
    for (const entry of entries.filter((name) => name.endsWith(".json"))) {
      try {
        const json = JSON.parse(await fs.readFile(path.join(polishDir, entry), "utf-8")) as Record<string, unknown>;
        if (json.schemaVersion === "polish-run-v1" && !("valueTier" in json) && typeof json.appliedAt === "string") {
          return path.join(polishDir, entry);
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ---------- A 组：store 加固 ----------

async function groupAB(legacyRunFile: string | null): Promise<void> {
  const group = "A store 加固";
  const { project, resume } = await setupProject("polish-batch-check store", [
    makeExperience("exp-store", "存储测试公司", ["负责存储层加固验证条目"]),
  ]);
  const run = await createPolishRun({
    projectId: project.id,
    resumeId: resume.id,
    experienceId: "exp-store",
    sourceBulletId: "exp-store-b1",
    sourceBulletText: "负责存储层加固验证条目",
    sourceEvidenceIds: ["exp-store-ev-1"],
    candidates: makeCandidates("存储加固"),
  });
  const dir = await polishDirOf(project.id, resume.id);
  const afterCreate = await noTmpResidue(dir);
  check(group, "createPolishRun 后无 *.tmp 残留", afterCreate.ok, afterCreate.entries.join(","));

  await writePolishRun({
    ...run,
    candidates: run.candidates.map((candidate, index) => (index === 0 ? { ...candidate, status: "discarded" } : candidate)),
  });
  const afterWrite = await noTmpResidue(dir);
  check(group, "writePolishRun 后无 *.tmp 残留", afterWrite.ok, afterWrite.entries.join(","));

  await fs.writeFile(path.join(dir, "bad-not-json.json"), "{{{ 不是 JSON", "utf-8");
  await fs.writeFile(
    path.join(dir, "bad-wrong-version.json"),
    JSON.stringify({ schemaVersion: "polish-run-v2", id: "bad-wrong-version" }),
    "utf-8",
  );
  const listed = await listPolishRuns(project.id, resume.id).then(
    (runs) => ({ ok: true as const, runs }),
    (error) => ({ ok: false as const, error: String(error) }),
  );
  check(group, "目录混入坏文件后 listPolishRuns 不抛", listed.ok, listed.ok ? undefined : listed.error);
  check(
    group,
    "坏文件被跳过、好 run 仍在列表",
    listed.ok && listed.runs.length === 1 && listed.runs[0]?.id === run.id,
    listed.ok ? `runs=${listed.runs.length}` : undefined,
  );
  check(group, "readPolishRun 坏文件 → null", (await readPolishRun(project.id, resume.id, "bad-not-json")) === null);
  const reloaded = await readPolishRun(project.id, resume.id, run.id);
  check(group, "readPolishRun 好文件正常返回且更新已落盘", reloaded?.candidates[0]?.status === "discarded");

  // ---------- B 组：旧数据兼容 ----------
  const groupB = "B 旧数据兼容";
  if (!legacyRunFile) {
    check(groupB, "找到真实 v1 applied fixture", false, ".workspace 下无可用旧 run 文件");
    return;
  }
  check(groupB, "找到真实 v1 applied fixture", true, path.relative(APP_ROOT, legacyRunFile));
  const legacyJson = JSON.parse(await fs.readFile(legacyRunFile, "utf-8")) as { id: string };
  await fs.copyFile(legacyRunFile, path.join(dir, `${legacyJson.id}.json`));
  const withLegacy = await listPolishRuns(project.id, resume.id);
  const legacy = withLegacy.find((item) => item.id === legacyJson.id);
  check(groupB, "真实 v1 run parse 通过并出现在列表", withLegacy.length === 2 && Boolean(legacy));
  check(groupB, "旧 run valueTier 为 undefined", legacy !== undefined && legacy.valueTier === undefined);
  check(groupB, "旧 run schemaVersion 不变", legacy?.schemaVersion === "polish-run-v1");
}

// ---------- C 组：排序纯函数 ----------

function groupC(): void {
  const group = "C 排序纯函数";
  const bullet = (experienceId: string, sourceBulletId: string): EligibleBullet => ({
    experienceId,
    sourceBulletId,
    sourceBulletText: `${sourceBulletId} 原文`,
    sourceEvidenceIds: [],
    evidenceSnippets: [],
  });
  // 入参顺序：low 经历两条 → high 一条 → 无评级一条
  const bullets = [bullet("exp-low", "b1"), bullet("exp-low", "b2"), bullet("exp-high", "b3"), bullet("exp-none", "b4")];
  const summary = makeSummary([
    { experienceId: "exp-high", tier: "high" },
    { experienceId: "exp-low", tier: "low" },
  ]);

  const sorted = orderEligibleBulletsByValue(bullets, summary);
  check(
    group,
    "high → 无评级(medium 档) → low，同 rank 保序",
    JSON.stringify(sorted.map((item) => item.sourceBulletId)) === JSON.stringify(["b3", "b4", "b1", "b2"]),
    sorted.map((item) => item.sourceBulletId).join(","),
  );
  const unsorted = orderEligibleBulletsByValue(bullets, undefined);
  check(
    group,
    "无 summary → 输出与入参顺序一致",
    JSON.stringify(unsorted.map((item) => item.sourceBulletId)) === JSON.stringify(["b1", "b2", "b3", "b4"]),
  );
  check(group, "返回新数组，不改入参", unsorted !== bullets && bullets[0]?.sourceBulletId === "b1");
  const allSame = orderEligibleBulletsByValue(bullets, makeSummary([]));
  check(
    group,
    "全部无评级（同 rank）→ 稳定排序退化为原顺序",
    JSON.stringify(allSame.map((item) => item.sourceBulletId)) === JSON.stringify(["b1", "b2", "b3", "b4"]),
  );
}

// ---------- D 组：生成集成（mock LLM） ----------

async function groupD(): Promise<void> {
  const group = "D 生成集成";
  const { project, resume } = await setupProject("polish-batch-check generate", [
    makeExperience("exp-low", "低价值公司", ["低价值经历条目"]),
    makeExperience("exp-high", "高价值公司", ["高价值经历条目"]),
    makeExperience("exp-none", "未评级公司", ["未评级经历条目"]),
  ]);
  const summary = makeSummary([
    { experienceId: "exp-high", tier: "high" },
    { experienceId: "exp-low", tier: "low" },
  ]);

  // 既有行为回归：端点不可达 → callOpenAICompatible 抛错，整体失败向上传播
  // （fallback 候选只覆盖「响应 200 但内容不可解析」；网络错误不降级，失败语义归 B5）。
  await saveOpenAICompatibleConfig({
    name: "polish-batch-check unreachable",
    baseUrl: "http://127.0.0.1:9/v1",
    apiKey: "sk-test-polish-batch-check",
    model: "test-model",
    isDefault: true,
  });
  const threw = await generateMissingPipelinePolishRuns(project.id, resume.id, { limit: 1 }).then(
    () => false,
    () => true,
  );
  check(group, "端点不可达 → 生成整体抛错（既有行为不回归）", threw);
  check(group, "抛错后未落盘半截 run", (await listPolishRuns(project.id, resume.id)).length === 0);

  // mock LLM：200 但内容不可解析 → 走 fallback 候选（lowConfidence）
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "这不是合法 JSON 响应" } }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    await saveOpenAICompatibleConfig({
      name: "polish-batch-check mock LLM",
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "sk-test-polish-batch-check",
      model: "mock-model",
      isDefault: true,
    });
    evidenceNotes.push(`mock LLM 端口：${port}（仅本机回环，返回不可解析内容驱动 fallback 候选）`);

    const zero = await generateMissingPipelinePolishRuns(project.id, resume.id, { evaluationSummary: summary, limit: 0 });
    check(group, "limit=0 → 不生成仅返回 progress", zero.generatedRunCount === 0 && zero.eligibleBulletCount === 3);

    const first = await generateMissingPipelinePolishRuns(project.id, resume.id, { evaluationSummary: summary, limit: 1 });
    const afterFirst = await listPolishRuns(project.id, resume.id);
    check(group, "limit=1 → 只生成 1 条", first.generatedRunCount === 1 && afterFirst.length === 1);
    check(
      group,
      "首条按 tier 排序命中 high 经历",
      afterFirst[0]?.sourceBulletId === "exp-high-b1",
      afterFirst[0]?.sourceBulletId,
    );
    check(group, "有评级 → run.valueTier 落盘", afterFirst[0]?.valueTier === "high");
    check(
      group,
      "LLM 内容不可解析 → 3 条 fallback 候选（lowConfidence）",
      afterFirst[0]?.candidates.length === 3 && afterFirst[0].candidates.every((candidate) => candidate.lowConfidence),
    );

    const second = await generateMissingPipelinePolishRuns(project.id, resume.id, { evaluationSummary: summary, limit: 1 });
    const afterSecond = await listPolishRuns(project.id, resume.id);
    const secondRun = afterSecond.find((run) => run.sourceBulletId === "exp-none-b1");
    check(group, "二次 limit=1 幂等续跑（不重复生成首条）", second.generatedRunCount === 1 && afterSecond.length === 2);
    check(group, "次条命中无评级经历（medium 档居中）", Boolean(secondRun));
    check(group, "无评级 → valueTier 不落盘", secondRun !== undefined && secondRun.valueTier === undefined);

    const rest = await generateMissingPipelinePolishRuns(project.id, resume.id, { evaluationSummary: summary });
    const afterRest = await listPolishRuns(project.id, resume.id);
    const lowRun = afterRest.find((run) => run.sourceBulletId === "exp-low-b1");
    check(group, "不带 limit 补齐剩余条目", rest.generatedRunCount === 1 && rest.coveredBulletCount === 3);
    check(group, "low 经历 valueTier 落盘", lowRun?.valueTier === "low");

    const idempotent = await generateMissingPipelinePolishRuns(project.id, resume.id, { evaluationSummary: summary });
    check(group, "全覆盖后再调 → 0 新增", idempotent.generatedRunCount === 0 && (await listPolishRuns(project.id, resume.id)).length === 3);

    // 现调用方形态：不带 options（pipeline/actions.ts:107）→ 全量生成、不写 valueTier
    const plain = await setupProject("polish-batch-check plain", [
      makeExperience("exp-plain", "无参调用公司", ["无参条目一", "无参条目二"]),
    ]);
    const plainProgress = await generateMissingPipelinePolishRuns(plain.project.id, plain.resume.id);
    const plainRuns = await listPolishRuns(plain.project.id, plain.resume.id);
    check(
      group,
      "不带 options → 全量生成（现调用方行为）",
      plainProgress.generatedRunCount === 2 && plainProgress.coveredBulletCount === 2,
    );
    check(group, "不带 options → 全部 run 无 valueTier", plainRuns.length === 2 && plainRuns.every((run) => run.valueTier === undefined));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ---------- E 组：batchApply ----------

async function groupE(): Promise<{ projectId: string; resumeId: string }> {
  const group = "E batchApply";
  const { project, resume } = await setupProject("polish-batch-check apply", [
    makeExperience("exp-apply", "批量应用公司", [
      "条目一原文",
      "条目二原文",
      "条目三原文",
      "条目四原文",
      "条目五原文",
    ]),
  ]);
  const makeRun = (index: number) =>
    createPolishRun({
      projectId: project.id,
      resumeId: resume.id,
      experienceId: "exp-apply",
      sourceBulletId: `exp-apply-b${index}`,
      sourceBulletText: `条目${["一", "二", "三", "四", "五"][index - 1]}原文`,
      sourceEvidenceIds: ["exp-apply-ev-1"],
      candidates: makeCandidates(`条目${index}`),
    });
  const run1 = await makeRun(1);
  const run2 = await makeRun(2);
  const run3 = await makeRun(3);
  const run4 = await makeRun(4);
  const candidate1 = run1.candidates[1]!;
  const candidate2 = run2.candidates[0]!;

  const result = await executeBatchApplyPolish(project.id, resume.id, [
    { runId: run1.id, candidateId: candidate1.id },
    { runId: run2.id, candidateId: candidate2.id, finalText: "  覆写后的最终文本  " },
    { runId: "no-such-run", candidateId: "no-such-candidate" },
  ]);
  check(group, "applied 2 / failed 1", result.applied.length === 2 && result.failed.length === 1);
  check(group, "非法 runId 失败原因明确", result.failed[0]?.reason === "润色记录不存在", result.failed[0]?.reason);

  const document = (await getProjectResume(project.id, resume.id))?.document;
  const experience = document?.experiences.find((item) => item.id === "exp-apply");
  const newBullet1 = experience?.bullets.find((item) => item.id === result.applied[0]?.bulletId);
  const newBullet2 = experience?.bullets.find((item) => item.id === result.applied[1]?.bulletId);
  const sourceBullet1 = experience?.bullets.find((item) => item.id === "exp-apply-b1");
  check(
    group,
    "新 bullet confirmed 且带 polish 痕迹字段",
    newBullet1?.status === "confirmed" && newBullet1.polishCandidateId === candidate1.id && Boolean(newBullet1.polishAppliedAt),
  );
  check(group, "新 bullet 默认取候选文本", newBullet1?.text === candidate1.text);
  check(group, "finalText 覆写生效（trim 后）", newBullet2?.text === "覆写后的最终文本");
  check(group, "原 bullet 已 archived", sourceBullet1?.status === "archived");
  const run1After = await readPolishRun(project.id, resume.id, run1.id);
  check(
    group,
    "run 状态推进为 applied",
    run1After?.appliedCandidateId === candidate1.id &&
      run1After.appliedBulletId === result.applied[0]?.bulletId &&
      run1After.candidates.find((item) => item.id === candidate1.id)?.status === "applied",
  );

  const reapply = await executeBatchApplyPolish(project.id, resume.id, [{ runId: run1.id, candidateId: candidate1.id }]);
  check(group, "已应用候选再次应用 → failed（非 ready）", reapply.applied.length === 0 && reapply.failed[0]?.reason === "候选不存在或已被处理");

  const duplicated = await executeBatchApplyPolish(project.id, resume.id, [
    { runId: run3.id, candidateId: run3.candidates[0]!.id },
    { runId: run3.id, candidateId: run3.candidates[0]!.id },
  ]);
  check(
    group,
    "同一 run 在 items 出现两次 → 第二项失败（批内同源护栏先截获）",
    duplicated.applied.length === 1 && duplicated.failed.length === 1 && duplicated.failed[0]?.reason === "该原始条目已在本批中应用",
    duplicated.failed[0]?.reason,
  );

  // 审查 M2：不同 run 指向同一 sourceBulletId（手工单条路径可产生）→ 后到项失败，
  // 避免原始 bullet 已归档后第二条新 bullet 仍被追加。
  const run4b = await createPolishRun({
    projectId: project.id,
    resumeId: resume.id,
    experienceId: "exp-apply",
    sourceBulletId: "exp-apply-b4",
    sourceBulletText: "条目四原文",
    sourceEvidenceIds: ["exp-apply-ev-1"],
    candidates: makeCandidates("条目4替身"),
  });
  const sameSource = await executeBatchApplyPolish(project.id, resume.id, [
    { runId: run4.id, candidateId: run4.candidates[1]!.id },
    { runId: run4b.id, candidateId: run4b.candidates[1]!.id },
  ]);
  check(
    group,
    "不同 run 同一原始 bullet → 后到项失败",
    sameSource.applied.length === 1 && sameSource.failed[0]?.reason === "该原始条目已在本批中应用",
    sameSource.failed[0]?.reason,
  );

  const run6 = await createPolishRun({
    projectId: project.id,
    resumeId: resume.id,
    experienceId: "exp-apply",
    sourceBulletId: "exp-apply-b6",
    sourceBulletText: "条目六原文",
    sourceEvidenceIds: ["exp-apply-ev-1"],
    candidates: makeCandidates("条目6"),
  });
  const emptyText = await executeBatchApplyPolish(project.id, resume.id, [
    { runId: run6.id, candidateId: run6.candidates[0]!.id, finalText: "   " },
  ]);
  check(group, "finalText 全空白 → failed 且不落盘", emptyText.failed[0]?.reason === "最终文本不能为空");
  check(group, "失败项不产生半截改动", (await readPolishRun(project.id, resume.id, run6.id))?.appliedCandidateId === undefined);

  const empty = await executeBatchApplyPolish(project.id, resume.id, []);
  check(group, "空 items → 空结果", empty.applied.length === 0 && empty.failed.length === 0);

  const missingProject = await executeBatchApplyPolish("no-such-project", resume.id, [
    { runId: run6.id, candidateId: run6.candidates[0]!.id },
  ]);
  check(group, "项目不存在 → 全部 failed", missingProject.failed.length === 1 && missingProject.failed[0]?.reason === "项目不存在");

  return { projectId: project.id, resumeId: resume.id };
}

// ---------- F 组：既有单条路径回归 ----------

async function groupF(context: { projectId: string; resumeId: string }): Promise<void> {
  const group = "F 单条路径回归";
  const run5 = await createPolishRun({
    projectId: context.projectId,
    resumeId: context.resumeId,
    experienceId: "exp-apply",
    sourceBulletId: "exp-apply-b5",
    sourceBulletText: "条目五原文",
    sourceEvidenceIds: ["exp-apply-ev-1"],
    candidates: makeCandidates("条目5"),
  });
  const candidate = run5.candidates[2]!;
  let redirect: { ok: boolean; redirect: string } | null = null;
  try {
    await executeApplyPolish(context.projectId, context.resumeId, run5.id, candidate.id, new FormData());
  } catch (error) {
    if (error instanceof Error && error.name === "CoachActionRedirect") {
      redirect = (error as Error & { result: { ok: boolean; redirect: string } }).result;
    } else {
      throw error;
    }
  }
  check(group, "executeApplyPolish 仍以 redirect 收尾", redirect?.ok === true && redirect.redirect.includes("applied"), redirect?.redirect);

  const run5After = await readPolishRun(context.projectId, context.resumeId, run5.id);
  const document = (await getProjectResume(context.projectId, context.resumeId))?.document;
  const experience = document?.experiences.find((item) => item.id === "exp-apply");
  const newBullet = experience?.bullets.find((item) => item.id === run5After?.appliedBulletId);
  const sourceBullet = experience?.bullets.find((item) => item.id === "exp-apply-b5");
  check(
    group,
    "单条 apply 三步序列行为不变（新增/归档/run 推进）",
    newBullet?.status === "confirmed" &&
      newBullet.polishCandidateId === candidate.id &&
      sourceBullet?.status === "archived" &&
      run5After?.appliedCandidateId === candidate.id,
  );
  check(group, "单条默认取候选文本（FormData 无 finalText）", newBullet?.text === candidate.text);
}

// ---------- evidence ----------

async function writeEvidence(): Promise<void> {
  const passed = results.filter((result) => result.passed).length;
  const lines = [
    "# B3 polish-batch-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    `- 命令：pnpm exec tsx --conditions=react-server scripts/polish-batch-check.ts`,
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：临时项目均以 polish-batch-check 前缀创建于本地 .workspace（gitignored）；",
    "  旧数据 fixture 仅记录路径不记录内容；mock LLM 仅监听本机回环端口。",
    ...evidenceNotes.map((note) => `- ${note}`),
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
  const legacyRunFile = await findLegacyRunFile();
  await groupAB(legacyRunFile);
  groupC();
  await groupD();
  const applyContext = await groupE();
  await groupF(applyContext);

  await writeEvidence();
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("polish-batch-check 运行失败：", error);
  process.exitCode = 1;
});
