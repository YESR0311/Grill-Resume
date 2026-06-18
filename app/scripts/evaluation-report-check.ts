import { promises as fs } from "node:fs";
import path from "node:path";
import { buildEvaluationReportView } from "@/app/projects/[projectId]/coach/components/evaluation-report-panel";
import type { EvaluationSummary } from "@/features/pipeline/types";

// 运行方式：cd app && pnpm exec tsx scripts/evaluation-report-check.ts
// （F1 只测纯函数 buildEvaluationReportView，不渲染 React、不出网；预计无需 --conditions=react-server）

const APP_ROOT = process.cwd();
const EVIDENCE_PATH = path.resolve(APP_ROOT, "..", "e2e", "evaluation-report-check-evidence.md");

type CheckResult = { group: string; name: string; passed: boolean; detail?: string };
const results: CheckResult[] = [];

function check(group: string, name: string, passed: boolean, detail?: string): void {
  results.push({ group, name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

const EXPERIENCES = [
  { id: "exp-1", label: "后端工程师 @ 字节跳动" },
  { id: "exp-2", label: "数据分析实习 @ 腾讯" },
];

function rating(over: Partial<EvaluationSummary["experienceRatings"][number]>): EvaluationSummary["experienceRatings"][number] {
  return {
    experienceId: "exp-1",
    score: 80,
    tier: "high",
    rationale: "核心系统主导，量化结果充分。",
    searchCitations: [],
    ...over,
  };
}

function summary(over: Partial<EvaluationSummary>): EvaluationSummary {
  return {
    schemaVersion: "eval-summary-v1",
    reportId: "report-xyz",
    createdAt: "2026-06-18T00:00:00.000Z",
    experienceRatings: [],
    uncoveredKeywords: [],
    ...over,
  };
}

// A 组 空态
function groupA(): void {
  const view = buildEvaluationReportView({ summary: undefined, experiences: [] });
  check("A", "summary 缺省 → empty=true", view.empty === true);
  check("A", "ratings 为空数组", Array.isArray(view.ratings) && view.ratings.length === 0);
  check("A", "tierCounts 全 0", view.tierCounts.high === 0 && view.tierCounts.medium === 0 && view.tierCounts.low === 0);
  check("A", "jdMatchScore undefined", view.jdMatchScore === undefined);
  check("A", "uncoveredKeywords 空", view.uncoveredKeywords.length === 0);
}

// B 组 experienceId → label 映射
function groupB(): void {
  const view = buildEvaluationReportView({
    summary: summary({
      experienceRatings: [
        rating({ experienceId: "exp-1", tier: "high" }),
        rating({ experienceId: "exp-2", tier: "medium", score: 60 }),
      ],
    }),
    experiences: EXPERIENCES,
  });
  check("B", "exp-1 解析为对应 label", view.ratings[0]?.title === "后端工程师 @ 字节跳动" && view.ratings[0]?.resolved === true);
  check("B", "exp-2 解析为对应 label", view.ratings[1]?.title === "数据分析实习 @ 腾讯" && view.ratings[1]?.resolved === true);
  check("B", "empty=false（有 ratings）", view.empty === false);
}

// C 组 未知 experienceId 降级
function groupC(): void {
  const view = buildEvaluationReportView({
    summary: summary({
      experienceRatings: [
        rating({ experienceId: "exp-1" }),
        rating({ experienceId: "ghost-9999abcd", tier: "low", score: 30 }),
      ],
    }),
    experiences: EXPERIENCES,
  });
  check("C", "未知 experienceId 不丢行", view.ratings.length === 2);
  const ghost = view.ratings[1];
  check("C", "降级 resolved=false", ghost?.resolved === false);
  check("C", "降级标题以「未知经历(」开头", ghost?.title.startsWith("未知经历(") === true, ghost?.title);
  check("C", "降级标题含 experienceId 前 8 位", ghost?.title.includes("ghost-99") === true, ghost?.title);
}

// D 组 tier 分桶 + score 整数透传
function groupD(): void {
  const view = buildEvaluationReportView({
    summary: summary({
      experienceRatings: [
        rating({ experienceId: "exp-1", tier: "high", score: 90 }),
        rating({ experienceId: "exp-2", tier: "high", score: 85 }),
        rating({ experienceId: "exp-1", tier: "medium", score: 55 }),
        rating({ experienceId: "exp-2", tier: "low", score: 20 }),
      ],
    }),
    experiences: EXPERIENCES,
  });
  check("D", "tierCounts high=2", view.tierCounts.high === 2);
  check("D", "tierCounts medium=1", view.tierCounts.medium === 1);
  check("D", "tierCounts low=1", view.tierCounts.low === 1);
  check("D", "score 整数原值透传", view.ratings.map((r) => r.score).join(",") === "90,85,55,20");
}

// E 组 jdMatchScore 缺省/在场
function groupE(): void {
  const without = buildEvaluationReportView({ summary: summary({ experienceRatings: [rating({})] }), experiences: EXPERIENCES });
  check("E", "jdMatchScore 缺省 → undefined", without.jdMatchScore === undefined);
  const withScore = buildEvaluationReportView({ summary: summary({ experienceRatings: [rating({})], jdMatchScore: 82 }), experiences: EXPERIENCES });
  check("E", "jdMatchScore 在场 → 82 透传", withScore.jdMatchScore === 82);
}

// F 组 uncoveredKeywords + searchCitations 透传
function groupF(): void {
  const view = buildEvaluationReportView({
    summary: summary({
      experienceRatings: [rating({ experienceId: "exp-1", searchCitations: ["https://a.example", "https://b.example"] })],
      uncoveredKeywords: ["k8s", "gRPC"],
    }),
    experiences: EXPERIENCES,
  });
  check("F", "uncoveredKeywords 原序透传", view.uncoveredKeywords.join(",") === "k8s,gRPC");
  check("F", "searchCitations 透传到 citations", view.ratings[0]?.citations.join(",") === "https://a.example,https://b.example");
  check("F", "reportId/createdAt 透传", view.reportId === "report-xyz" && view.createdAt === "2026-06-18T00:00:00.000Z");
}

async function writeEvidence(): Promise<void> {
  const passed = results.filter((r) => r.passed).length;
  const lines = [
    "# F1 evaluation-report-check 验收证据",
    "",
    `- 运行时间：${new Date().toISOString()}`,
    "- 命令：pnpm exec tsx scripts/evaluation-report-check.ts",
    `- 结果：${passed}/${results.length} 通过`,
    "- 说明：F1 只测纯函数 buildEvaluationReportView（不渲染 React、不出网、无临时项目）；",
    "  覆盖空态/experienceId 映射/未知经历降级/tier 分桶/jdMatchScore 缺省在场/关键词与引用透传。",
    "",
    "| 组 | 断言 | 结果 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.group} | ${r.name} | ${r.passed ? "PASS" : "FAIL"} |`),
    "",
  ];
  await fs.writeFile(EVIDENCE_PATH, lines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  groupA();
  groupB();
  groupC();
  groupD();
  groupE();
  groupF();

  await writeEvidence();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} 通过；证据：${EVIDENCE_PATH}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("evaluation-report-check 运行失败：", error);
  process.exitCode = 1;
});
