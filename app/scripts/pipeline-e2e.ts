import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { saveOpenAICompatibleConfig, getDefaultModelConfig } from "@/features/ai/model-configs";
import { TavilySearchProvider } from "@/features/search/tavily";
import { saveTavilyConfig, getTavilyConfig } from "@/features/search/settings";
import { buildExperienceQuestionQueue } from "@/features/coach/questions";
import { buildGrillSession } from "@/features/coach/conversation/engine";
import { buildGrillEnhancement } from "@/features/coach/conversation/llm-enhance";
import { upsertCoachQaAnswer } from "@/features/coach/storage";
import { evaluateSkillScarcity } from "@/features/coach/skill-scarcity";
import { analyzeJdCoverage, augmentJdCoverageWithSearch } from "@/features/coach/jd-coverage";
import { verifyCompaniesAndProjects } from "@/features/coach/company-verify";
import { generatePolishCandidates } from "@/features/polish/generate";
import { createPolishRun, listPolishRuns, writePolishRun } from "@/features/polish/store";
import { createSession, saveSession } from "@/features/pipeline/storage";
import { buildPipelineExportSnapshot } from "@/features/pipeline/pipeline-exporter";
import { appendExperienceBullet, archiveExperienceBullet, createExportRecord, createProject, getProjectResume, updateResumeSections } from "@/features/resume/storage";
import { renderExport } from "@/features/export/render";
import type { CoachQaAnswer } from "@/features/coach/storage";
import type { ResumeDocument } from "@/features/resume/types";

type EvidenceStep = {
  step: string;
  status: "ok" | "failed";
  details: string[];
};

const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || "local-proxy";
const tavilyApiKey = process.env.TAVILY_API_KEY?.trim();
const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "http://127.0.0.1:15721/v1";
const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";

const jdText = [
  "高级前端工程师，负责 React / Next.js 产品工程、TypeScript 工程化、性能优化、AI SDK 接入。",
  "要求能设计本地优先的数据模型，维护隐私合规的 AI 工作流，能输出中文简历/文档类产品。",
].join("\n");

function requireEnv(): void {
  const isLocalProxy = openaiBaseUrl.startsWith("http://127.0.0.1") || openaiBaseUrl.startsWith("http://localhost");
  if (!isLocalProxy && openaiApiKey === "local-proxy") throw new Error("OPENAI_API_KEY missing");
  if (!tavilyApiKey) throw new Error("TAVILY_API_KEY missing");
}

function nowIso(): string {
  return new Date().toISOString();
}

function sampleDocument(resumeId: string): ResumeDocument {
  const now = nowIso();
  return {
    schemaVersion: "resume-local-v1",
    id: resumeId,
    kind: "master",
    title: "C11 Pipeline E2E Demo",
    target: {
      role: "高级前端工程师",
      jdText,
      keywords: ["React", "Next.js", "TypeScript", "性能优化", "AI SDK", "本地优先"],
    },
    basics: {
      name: "林澈",
      phone: "000-0000-0000",
      email: "demo@example.invalid",
      city: "上海",
      targetRole: "高级前端工程师 / AI 产品工程师",
      links: [{ id: "link-github", label: "GitHub", url: "https://example.invalid/demo-linche" }],
    },
    education: [
      {
        id: "edu-1",
        school: "华东理工大学",
        degree: "硕士",
        major: "软件工程",
        startDate: "2014.09",
        endDate: "2017.06",
      },
    ],
    experiences: [
      {
        id: "exp-1",
        organization: "星桥智能科技",
        role: "高级前端工程师 / AI 产品工程师",
        location: "上海",
        startDate: "2022.07",
        endDate: "至今",
        evidence: [
          {
            id: "ev-1",
            context: "AI 简历工作台 0 到 1",
            task: "把材料导入、证据图、AI 润色和 Word 导出串成闭环",
            actions: ["设计本地优先的 ResumeDocument、证据图、candidate-only polish 和 confirmed-only 导出链路"],
            results: [{ text: "用户可在单次会话内完成材料整理、追问、润色与 Word 生成", metric: "单次会话闭环", confidence: "confirmed" }],
            skills: ["Next.js", "TypeScript", "SQLite", "docx"],
            sourceText: "主导 AI 简历工作台从 0 到 1，覆盖材料导入、证据图、AI 润色、Word 导出。",
          },
          {
            id: "ev-2",
            context: "多步骤简历表单中断后恢复困难",
            task: "把复杂表单流程拆为本地持久化状态机",
            actions: ["实现草稿保存、候选确认、错误回退与导出记录"],
            results: [{ text: "关键流程中断恢复率提升至 95% 以上", metric: "95%+", confidence: "confirmed" }],
            skills: ["状态机", "本地持久化", "Next.js"],
            sourceText: "将复杂表单流程拆为本地持久化状态机，减少用户重复输入。",
          },
        ],
        bullets: [
          {
            id: "bullet-1",
            text: "主导 AI 简历工作台从 0 到 1 落地，设计本地优先的 ResumeDocument、证据图和 confirmed-only 导出链路，使用户可在单次会话内完成材料整理、追问、润色与 Word 生成。",
            sourceEvidenceIds: ["ev-1"],
            qualityFlags: [],
            status: "confirmed",
          },
          {
            id: "bullet-2",
            text: "重构多步骤表单为可恢复状态机，覆盖草稿保存、候选确认、错误回退与导出记录，关键流程中断恢复率提升至 95% 以上。",
            sourceEvidenceIds: ["ev-2"],
            qualityFlags: [],
            status: "confirmed",
          },
        ],
      },
      {
        id: "exp-2",
        organization: "云澜教育科技",
        role: "前端工程师",
        location: "杭州",
        startDate: "2019.08",
        endDate: "2022.06",
        evidence: [
          {
            id: "ev-3",
            context: "在线课程后台需要把课程配置、学员进度和运营报表集中管理",
            task: "负责课程运营后台的前端工程化与核心页面交付",
            actions: ["维护 React 组件库", "接入 TypeScript 校验", "沉淀表单和表格配置模式"],
            results: [{ text: "运营同学可在统一后台完成课程配置和进度跟踪", confidence: "confirmed" }],
            skills: ["React", "TypeScript", "组件库"],
            sourceText: "负责在线课程运营后台，维护 React 组件库并接入 TypeScript 校验。",
          },
        ],
        bullets: [],
      },
    ],
    projects: [
      {
        id: "project-1",
        name: "本地优先 AI 履历教练",
        role: "架构与核心开发",
        startDate: "2025.01",
        endDate: "2025.05",
        techStack: ["Next.js", "React", "TypeScript", "SQLite", "docx"],
        links: [],
        goal: "构建 evidence-first 的半自动中文简历生成器",
        evidence: [
          {
            id: "project-ev-1",
            context: "个人工具产品需要把隐私确认、AI 候选内容和本地导出串成可审计流程",
            task: "设计 evidence-first 的半自动中文简历生成器",
            actions: ["设计 privacy gate、grill Q&A、candidate-only polish 和 confirmed-only DOCX 四段式流程"],
            results: [{ text: "AI 只生成候选内容，不直接覆盖用户确认事实", confidence: "confirmed" }],
            skills: ["Next.js", "TypeScript", "SQLite", "docx"],
            sourceText: "设计 privacy gate、grill Q&A、candidate-only polish 和 confirmed-only DOCX 四段式流程。",
          },
        ],
        bullets: [
          {
            id: "project-bullet-1",
            text: "设计 privacy gate、grill Q&A、candidate-only polish 和 confirmed-only DOCX 四段式流程，保证 AI 只生成候选内容，不直接覆盖用户确认事实。",
            sourceEvidenceIds: ["project-ev-1"],
            qualityFlags: [],
            status: "confirmed",
          },
        ],
      },
    ],
    skills: [
      { id: "skill-1", category: "frameworks", name: "前端工程", items: ["React", "Next.js", "TypeScript", "Tailwind CSS"] },
      { id: "skill-2", category: "tools", name: "AI 产品工程", items: ["AI SDK", "Prompt Engineering", "RAG 基础", "本地优先架构"] },
    ],
    certificates: [{ id: "cert-1", name: "PMP 项目管理认证" }],
    awards: [],
    template: { id: "ats" },
    metadata: { createdAt: now, updatedAt: now },
  };
}

function firstConfirmedBullet(document: ResumeDocument) {
  for (const experience of document.experiences) {
    const bullet = experience.bullets.find((item) => item.status === "confirmed");
    if (bullet) return { experience, bullet };
  }
  throw new Error("no confirmed bullet");
}

function allConfirmedBulletsAreEvidenceBacked(document: ResumeDocument): boolean {
  const experienceBacked = document.experiences.every((experience) =>
    experience.bullets
      .filter((bullet) => bullet.status === "confirmed")
      .every((bullet) => bullet.sourceEvidenceIds.length > 0),
  );
  const projectBacked = document.projects.every((project) =>
    project.bullets
      .filter((bullet) => bullet.status === "confirmed")
      .every((bullet) => bullet.sourceEvidenceIds.length > 0),
  );
  return experienceBacked && projectBacked;
}

function qaAnswerText(kind: string, index: number, targetId: string): string {
  if (targetId === "exp-2") {
    const exp2ByKind: Record<string, string> = {
      context: "当时在线课程后台需要把课程配置、学员进度和运营报表集中管理，我负责课程运营后台的前端工程化与核心页面交付。",
      action: "我维护 React 组件库，接入 TypeScript 校验，沉淀表单和表格配置模式。",
      result: "结果是运营同学可在统一后台完成课程配置和进度跟踪。",
      evidence: "可公开证据包括课程运营后台的页面交付记录、组件库变更记录和 TypeScript 接入记录。",
      "jd-fit": "真实覆盖 React、TypeScript、组件库和前端工程化；没有 Next.js 或 AI SDK 相关事实，不写入这段经历。",
    };
    return exp2ByKind[kind] ?? `补充课程运营后台事实 ${index + 1}：只确认用户已说明的材料，不新增事实。`;
  }
  const byKind: Record<string, string> = {
    context: "当时多步骤简历表单中断后恢复困难，我负责把材料导入、证据图、AI 润色和 Word 导出串成闭环。",
    action: "我设计本地优先的 ResumeDocument、证据图、candidate-only polish 和 confirmed-only 导出链路，并实现草稿保存、候选确认、错误回退与导出记录。",
    result: "结果是用户可在单次会话内完成材料整理、追问、润色与 Word 生成，复杂流程中断恢复率提升到 95% 以上。",
    metric: "关键指标是中断恢复率提升至 95% 以上；统计口径是用户中断后再次进入并成功恢复草稿继续完成流程的比例。",
    evidence: "可公开证据包括本地项目记录、导出记录、候选确认记录和恢复流程日志；这些证据都只用于本地演示。",
    "jd-fit": "真实覆盖 Next.js、React、TypeScript、本地优先架构、AI SDK 接入和中文文档导出；没有覆盖的 JD 点不会写入简历。",
  };
  return byKind[kind] ?? `补充事实笔记 ${index + 1}：只确认用户已说明的材料，不新增事实。`;
}

async function main() {
  requireEnv();
  const steps: EvidenceStep[] = [];

  await saveOpenAICompatibleConfig({
    name: "C11 OpenAI E2E",
    baseUrl: openaiBaseUrl,
    apiKey: openaiApiKey!,
    model: openaiModel,
    isDefault: true,
  });
  const modelConfig = await getDefaultModelConfig();
  if (!modelConfig?.apiKey) throw new Error("model config write failed");

  await saveTavilyConfig({
    name: "C11 Tavily E2E",
    baseUrl: "https://api.tavily.com",
    apiKey: tavilyApiKey!,
    freeTier: true,
    monthlyQuota: 1000,
  });
  const tavilyConfig = await getTavilyConfig();
  if (!tavilyConfig?.apiKey) throw new Error("tavily config write failed");
  const searchProvider = new TavilySearchProvider(tavilyConfig);
  steps.push({
    step: "provider-config",
    status: "ok",
    details: [`model=${modelConfig.model}`, `modelBaseUrl=${modelConfig.baseUrl}`, `search=${searchProvider.name}`],
  });

  const { project, resume } = await createProject({ name: `C11 pipeline e2e ${nowIso()}` });
  await updateResumeSections(resume.id, sampleDocument(resume.id));
  const current = await getProjectResume(project.id, resume.id);
  if (!current) throw new Error("fresh project missing");
  steps.push({ step: "fresh-project", status: "ok", details: [`projectId=${project.id}`, `resumeId=${resume.id}`] });

  const session = await createSession(project.id, resume.id, true);
  const confirmedAt = nowIso();
  const confirmedSession = {
    ...session,
    egressPlan: {
      ...session.egressPlan,
      userConfirmedAt: confirmedAt,
      allConfirmedAt: confirmedAt,
      items: session.egressPlan.items.map((item) => ({ ...item, userConfirmedAt: confirmedAt })),
    },
    stages: { ...session.stages, grill: { ...session.stages.grill, status: "in_progress" as const, enteredAt: confirmedAt } },
  };
  await saveSession(confirmedSession);
  steps.push({
    step: "privacy-gate",
    status: "ok",
    details: [`confirmedItems=${confirmedSession.egressPlan.items.length}`, `userConfirmedAt=${confirmedAt}`],
  });

  const document = current.document;
  const qaQueue = buildExperienceQuestionQueue(document);
  const activeItem = qaQueue.find((item) => item.source === "experience" && item.questions.length >= 3) ?? qaQueue.find((item) => item.source === "experience") ?? qaQueue[0];
  if (!activeItem) throw new Error("no grill questions generated");
  const qaAnswers: CoachQaAnswer[] = [];
  for (const [index, question] of activeItem.questions.slice(0, 3).entries()) {
    qaAnswers.push(await upsertCoachQaAnswer({
      projectId: project.id,
      resumeId: resume.id,
      targetId: activeItem.id,
      targetSource: activeItem.source,
      questionId: question.id,
      questionKind: question.kind,
      questionPrompt: question.prompt,
      answerText: qaAnswerText(question.kind, index, activeItem.id),
      status: "confirmed",
    }));
  }
  const grillSession = buildGrillSession({ queue: qaQueue, answers: qaAnswers, document });
  const answeredTurn = grillSession.base.turns.find((turn) => turn.answer && turn.targetSource === "experience") ?? grillSession.base.activeTurn;
  const enhancement = await buildGrillEnhancement({
    config: modelConfig,
    activeTurn: answeredTurn,
    answers: qaAnswers,
    document,
    weakestDimension: grillSession.weakestDimension,
  });
  if (!enhancement) throw new Error("grill enhancement failed");
  steps.push({
    step: "grill",
    status: "ok",
    details: [`answeredQuestions=${qaAnswers.length}`, `activeQuestion=${answeredTurn?.questionId ?? "none"}`, `fuzzyTerms=${enhancement.fuzzyTerms.length}`, `hasDraft=${Boolean(enhancement.distilledEvidenceDraft)}`],
  });

  const search = async (query: string) => searchProvider.query({ query, maxResults: 3 });
  const [scarcity, verification, jdCoverage] = await Promise.all([
    evaluateSkillScarcity({ document, search }),
    verifyCompaniesAndProjects({ document, search }),
    augmentJdCoverageWithSearch(analyzeJdCoverage(document), searchProvider),
  ]);
  const citationCount =
    scarcity.reduce((count, item) => count + item.citations.length, 0) +
    verification.reduce((count, item) => count + item.citations.length, 0) +
    Object.values(jdCoverage.status === "ok" ? jdCoverage.webCitations ?? {} : {}).reduce((count, items) => count + items.length, 0);
  if (citationCount === 0) throw new Error("search produced no citations");
  steps.push({
    step: "evaluate",
    status: "ok",
    details: [`scarcityItems=${scarcity.length}`, `verificationItems=${verification.length}`, `jdStatus=${jdCoverage.status}`, `citations=${citationCount}`],
  });

  const { experience, bullet } = firstConfirmedBullet(document);
  const evidenceSnippets = experience.evidence
    .filter((evidence) => bullet.sourceEvidenceIds.includes(evidence.id))
    .map((evidence) => [evidence.context, evidence.task, ...evidence.actions, ...evidence.results.map((item) => item.metric ? `${item.text}（${item.metric}）` : item.text)].filter(Boolean).join("；"));
  const candidates = await generatePolishCandidates({
    config: modelConfig,
    sourceBullet: bullet.text,
    evidenceSnippets,
    jdContext: document.target?.jdText,
  });
  const polishRun = await createPolishRun({
    projectId: project.id,
    resumeId: resume.id,
    experienceId: experience.id,
    sourceBulletId: bullet.id,
    sourceBulletText: bullet.text,
    sourceEvidenceIds: bullet.sourceEvidenceIds,
    candidates,
  });
  const selectedCandidate = polishRun.candidates.find((candidate) => !candidate.lowConfidence) ?? polishRun.candidates[0];
  if (!selectedCandidate) throw new Error("polish candidate missing");
  const appliedBulletId = nanoid();
  await appendExperienceBullet({
    projectId: project.id,
    resumeId: resume.id,
    experienceId: experience.id,
    bullet: {
      id: appliedBulletId,
      text: selectedCandidate.text,
      sourceEvidenceIds: polishRun.sourceEvidenceIds,
      polishCandidateId: selectedCandidate.id,
      polishAppliedAt: nowIso(),
    },
  });
  await archiveExperienceBullet({ projectId: project.id, resumeId: resume.id, experienceId: experience.id, bulletId: bullet.id });
  await writePolishRun({
    ...polishRun,
    candidates: polishRun.candidates.map((candidate) =>
      candidate.id === selectedCandidate.id ? { ...candidate, status: "applied" } : candidate,
    ),
    appliedAt: nowIso(),
    appliedCandidateId: selectedCandidate.id,
    appliedBulletId,
  });
  const polishRuns = await listPolishRuns(project.id, resume.id);
  steps.push({
    step: "polish",
    status: "ok",
    details: [`runId=${polishRun.id}`, `candidateCount=${candidates.length}`, `storedRuns=${polishRuns.length}`, `appliedBulletId=${appliedBulletId}`, `appliedTone=${selectedCandidate.tone}`],
  });

  const polished = await getProjectResume(project.id, resume.id);
  if (!polished) throw new Error("polished resume missing");
  const exportDocument = polished.document;
  const exportSnapshot = await buildPipelineExportSnapshot({ projectId: project.id, resumeId: resume.id, document: exportDocument });
  const exported = await createExportRecord({
    resumeId: resume.id,
    format: "docx-zh-clean",
    content: await renderExport(exportDocument, "docx-zh-clean", {
      partialMode: true,
      layoutSchema: exportSnapshot.layoutSchema,
      gapReport: exportSnapshot.gapReport,
    }),
  });
  const finalSession = await saveSession({
    ...confirmedSession,
    currentStage: "export",
    exportSnapshot,
    completedAt: nowIso(),
    updatedAt: nowIso(),
    stages: {
      grill: { status: "completed", enteredAt: confirmedAt, completedAt: nowIso(), resultRef: "grill-enhancement" },
      evaluate: { status: "completed", enteredAt: nowIso(), completedAt: nowIso(), resultRef: `citations:${citationCount}` },
      polish: { status: "completed", enteredAt: nowIso(), completedAt: nowIso(), resultRef: polishRun.id },
      export: { status: "completed", enteredAt: nowIso(), completedAt: nowIso(), resultRef: exported.id },
    },
    checkpoints: [
      { stageFrom: undefined, stageTo: "grill", timestamp: confirmedAt, summary: "privacy gate confirmed; grill started" },
      { stageFrom: "grill", stageTo: "evaluate", timestamp: nowIso(), summary: `grill generated ${enhancement.fuzzyTerms.length} fuzzy terms` },
      { stageFrom: "evaluate", stageTo: "polish", timestamp: nowIso(), summary: `evaluate produced ${citationCount} citations` },
      { stageFrom: "polish", stageTo: "export", timestamp: nowIso(), summary: `polish generated ${candidates.length} candidates` },
    ],
  });

  const docxStat = await fs.stat(exported.filePath);
  steps.push({
    step: "export",
    status: "ok",
    details: [`exportId=${exported.id}`, `docxBytes=${docxStat.size}`, `readyForExport=${exportSnapshot.readyForExport}`],
  });

  const evidenceBacked = allConfirmedBulletsAreEvidenceBacked(exportDocument);
  if (!evidenceBacked) throw new Error("confirmed bullet without evidence");
  steps.push({
    step: "evidence-first",
    status: "ok",
    details: [`confirmedOnly=${exportSnapshot.layoutSchema.meta.confirmedOnly}`, `evidenceBacked=${evidenceBacked}`, `polishedBulletId=${appliedBulletId}`],
  });

  const report = [
    "# C11 Pipeline E2E Evidence",
    "",
    `Generated: ${nowIso()}`,
    "",
    "This run used real local provider configuration from environment variables and wrote secrets only to ignored local workspace settings.",
    "The task PRD requested writing evidence under .trellis, but project execution rules prohibit modifying .trellis; this tracked e2e/ file is the evidence artifact.",
    "",
    "## IDs",
    "",
    `- projectId: ${project.id}`,
    `- resumeId: ${resume.id}`,
    `- sessionId: ${finalSession.id}`,
    `- exportId: ${exported.id}`,
    `- exportedFile: ${exported.filePath}`,
    `- exportedBytes: ${docxStat.size}`,
    "",
    "## Steps",
    "",
    ...steps.flatMap((step) => [`### ${step.step}`, "", `- status: ${step.status}`, ...step.details.map((detail) => `- ${detail}`), ""]),
    "## Invariants Checked",
    "",
    `- privacy gate confirmed once at session start: ${Boolean(finalSession.egressPlan.userConfirmedAt)}`,
    `- all egress items confirmed: ${finalSession.egressPlan.items.every((item) => Boolean(item.userConfirmedAt))}`,
    `- all stages completed: ${Object.values(finalSession.stages).every((stage) => stage.status === "completed")}`,
    `- checkpoint count: ${finalSession.checkpoints.length}`,
    `- LayoutSchema source: pipeline export snapshot generated by project(document)`,
    `- confirmed experience/project bullets evidence-backed: ${evidenceBacked}`,
    `- polish applied by archiving source bullet and appending confirmed candidate: ${appliedBulletId}`,
    "",
  ].join("\n");

  const outDir = path.resolve(process.cwd(), "..", "e2e");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "e2e-run-evidence.md"), report, "utf-8");
  console.log(JSON.stringify({ projectId: project.id, resumeId: resume.id, sessionId: finalSession.id, exportId: exported.id, docxBytes: docxStat.size }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
