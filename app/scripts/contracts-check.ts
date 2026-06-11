import { promises as fs } from "node:fs";
import path from "node:path";
import {
  evaluationSummarySchema,
  pipelineSessionSchema,
  pipelineStageStateSchema,
} from "@/features/pipeline/types";
import { shouldRunIntake } from "@/features/intake/interview-rules";
import { resumeDocumentSchema } from "@/features/resume/schema";
import type { Experience, Project, ResumeDocument } from "@/features/resume/types";

// 运行方式：cd app && pnpm exec tsx scripts/contracts-check.ts（依赖 cwd = app/，与 pipeline-e2e.ts 同惯例）
const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "contracts-check-evidence.md");

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

function baseDocument(overrides: Partial<ResumeDocument>): ResumeDocument {
  return {
    schemaVersion: "resume-local-v1",
    id: "doc-contract-check",
    kind: "master",
    title: "契约检查样例",
    basics: { name: "测试", links: [] },
    education: [],
    experiences: [],
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    template: { id: "ats" },
    metadata: { createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" },
    ...overrides,
  };
}

function makeExperience(overrides: Partial<Experience>): Experience {
  return {
    id: "exp-1",
    organization: "某公司",
    role: "实习生",
    evidence: [],
    bullets: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "某项目",
    techStack: [],
    links: [],
    evidence: [],
    bullets: [],
    ...overrides,
  };
}

function groupA(): void {
  const group = "A. EvaluationSummary schema";
  const valid = {
    schemaVersion: "eval-summary-v1",
    reportId: "report-1",
    createdAt: "2026-06-11T00:00:00.000Z",
    experienceRatings: [
      {
        experienceId: "exp-1",
        score: 72,
        tier: "high",
        rationale: "头部公司核心业务，含外部佐证",
        searchCitations: ["https://example.com/source"],
      },
      {
        experienceId: "exp-2",
        score: 30,
        tier: "low",
        rationale: "无外部佐证，纯 LLM 推断",
        searchCitations: [],
      },
    ],
    jdMatchScore: 65,
    uncoveredKeywords: ["数据分析"],
  };
  check(group, "合法样例 parse 通过", evaluationSummarySchema.safeParse(valid).success);
  check(group, "可选字段 jdMatchScore 缺省仍通过", evaluationSummarySchema.safeParse({ ...valid, jdMatchScore: undefined }).success);

  const scoreOutOfRange = {
    ...valid,
    experienceRatings: [{ ...valid.experienceRatings[0], score: 120 }],
  };
  check(group, "score 越界 (120) 被拒绝", !evaluationSummarySchema.safeParse(scoreOutOfRange).success);

  const badTier = {
    ...valid,
    experienceRatings: [{ ...valid.experienceRatings[0], tier: "ultra" }],
  };
  check(group, "tier 非法 (ultra) 被拒绝", !evaluationSummarySchema.safeParse(badTier).success);

  const missingVersion: Record<string, unknown> = { ...valid };
  delete missingVersion.schemaVersion;
  check(group, "缺 schemaVersion 被拒绝", !evaluationSummarySchema.safeParse(missingVersion).success);
}

function groupB(): void {
  const group = "B. shouldRunIntake 形态矩阵";
  const emptyDoc = baseDocument({});
  check(group, "全空文档 → intake", shouldRunIntake(emptyDoc) === true);

  const skeletonDoc = baseDocument({
    experiences: [makeExperience({})],
    projects: [makeProject({})],
  });
  check(group, "纯骨架（无 evidence/confirmed bullet）→ intake", shouldRunIntake(skeletonDoc) === true);

  const draftBulletDoc = baseDocument({
    experiences: [
      makeExperience({
        bullets: [
          { id: "b1", text: "草稿要点", sourceEvidenceIds: [], qualityFlags: [], status: "draft" },
        ],
      }),
    ],
  });
  check(group, "仅 draft bullet 仍视为骨架 → intake", shouldRunIntake(draftBulletDoc) === true);

  const evidenceDoc = baseDocument({
    experiences: [
      makeExperience({
        evidence: [
          { id: "ev1", actions: ["负责活动策划"], results: [], skills: [] },
        ],
      }),
    ],
  });
  check(group, "含 evidence 经历 → deep-dive", shouldRunIntake(evidenceDoc) === false);

  const mixedDoc = baseDocument({
    experiences: [makeExperience({})],
    projects: [
      makeProject({
        bullets: [
          { id: "b2", text: "已确认要点", sourceEvidenceIds: [], qualityFlags: [], status: "confirmed" },
        ],
      }),
    ],
  });
  check(group, "骨架 + confirmed bullet 项目混合 → deep-dive", shouldRunIntake(mixedDoc) === false);

  const educationOnlyDoc = baseDocument({
    education: [{ id: "edu1", school: "某大学", degree: "本科", major: "市场营销" }],
  });
  check(group, "仅有教育信息不影响判定 → intake", shouldRunIntake(educationOnlyDoc) === true);
}

function groupC(): void {
  const group = "C. 新字段前向形态";
  const stageWithSubStage = pipelineStageStateSchema.safeParse({
    status: "in_progress",
    enteredAt: "2026-06-11T00:00:00.000Z",
    subStage: "intake",
  });
  check(group, "stage state 携带 subStage parse 通过", stageWithSubStage.success);

  const stageWithoutSubStage = pipelineStageStateSchema.safeParse({ status: "not_started" });
  check(
    group,
    "stage state 不带 subStage 仍通过（旧形态）",
    stageWithoutSubStage.success && stageWithoutSubStage.data?.subStage === undefined,
  );
}

async function groupD(): Promise<void> {
  const group = "D. 旧 fixture 向后兼容";

  const sessionDirsRoot = path.resolve(APP_ROOT, ".workspace", "projects");
  let sessionFiles: string[] = [];
  try {
    const projectDirs = await fs.readdir(sessionDirsRoot);
    for (const dir of projectDirs) {
      const sessionsDir = path.join(sessionDirsRoot, dir, "pipeline-sessions");
      const files = await fs.readdir(sessionsDir).catch(() => [] as string[]);
      sessionFiles.push(...files.filter((f) => f.endsWith(".json")).map((f) => path.join(sessionsDir, f)));
    }
  } catch {
    sessionFiles = [];
  }
  if (sessionFiles.length === 0) {
    check(group, "workspace pipeline-session 文件", true, "无文件可验（跳过，不计失败）");
  } else {
    let allOk = true;
    let firstError = "";
    for (const file of sessionFiles) {
      try {
        const raw = JSON.parse(await fs.readFile(file, "utf8"));
        const parsed = pipelineSessionSchema.safeParse(raw);
        if (!parsed.success) {
          allOk = false;
          firstError = `${path.basename(file)}: ${parsed.error.issues[0]?.message ?? "unknown"}`;
          break;
        }
      } catch (error) {
        allOk = false;
        firstError = `${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`;
        break;
      }
    }
    check(group, `扩展后 schema parse 全部旧 session（${sessionFiles.length} 个）`, allOk, firstError || undefined);
  }

  for (const fixture of [".backend-coach-document.json", ".backend-coach-document-2page.json"]) {
    const filePath = path.resolve(APP_ROOT, fixture);
    try {
      const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
      const parsed = resumeDocumentSchema.safeParse(raw);
      check(group, `${fixture} 经 resumeDocumentSchema parse`, parsed.success, parsed.success ? undefined : parsed.error.issues[0]?.message);
      if (parsed.success) {
        check(group, `${fixture} shouldRunIntake 可运行且为 deep-dive`, shouldRunIntake(raw as ResumeDocument) === false);
      }
    } catch (error) {
      check(group, `${fixture} 读取`, false, error instanceof Error ? error.message : String(error));
    }
  }

  // .backend-coach-session.json 实际是 coach 问答 answers 文件（顶层 {answers: [...]}），
  // 不是 pipeline session；此处只验可读且结构未变。
  try {
    const raw = JSON.parse(await fs.readFile(path.resolve(APP_ROOT, ".backend-coach-session.json"), "utf8"));
    check(group, ".backend-coach-session.json 可读且含 answers 数组", Array.isArray(raw.answers) && raw.answers.length > 0);
  } catch (error) {
    check(group, ".backend-coach-session.json 读取", false, error instanceof Error ? error.message : String(error));
  }
}

async function writeEvidence(): Promise<void> {
  const failed = results.filter((r) => !r.passed);
  const lines = [
    "# contracts-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 运行命令：`cd app && pnpm exec tsx scripts/contracts-check.ts`",
    `- 结果：${failed.length === 0 ? "全部通过" : `${failed.length} 项失败`}（共 ${results.length} 项断言）`,
    "",
    "| 组 | 断言 | 结果 | 备注 |",
    "|---|---|---|---|",
    ...results.map((r) => `| ${r.group} | ${r.name} | ${r.passed ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`),
    "",
    "说明：`.backend-coach-session.json` 为 coach 问答 answers fixture（非 pipeline session），",
    "向后兼容验证以 `.workspace/projects/*/pipeline-sessions/*.json` 为 pipelineSessionSchema 实际对象。",
    "",
  ];
  await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf8");
  console.log(`evidence → ${EVIDENCE_PATH}`);
}

async function main(): Promise<void> {
  groupA();
  groupB();
  groupC();
  await groupD();
  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`contracts-check FAILED: ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`contracts-check OK: ${results.length}/${results.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
