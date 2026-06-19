import { notFound } from "next/navigation";
import { getProjectResume, listExports, listProjects, listResumes } from "@/features/resume/storage";
import { getSession } from "@/features/pipeline/storage";
import { buildExperienceQuestionQueue } from "@/features/coach/questions";
import { buildGrillSession } from "@/features/coach/conversation/engine";
import { listCoachQaAnswers, readCoachGrillEnhancement } from "@/features/coach/storage";
import { getDefaultModelConfig } from "@/features/ai/model-configs";
import { canAdvance } from "@/features/pipeline/orchestrator";
import { buildFitExplanation } from "@/features/coach/fit-explanation-view";
import { buildEvaluationReportView } from "@/features/coach/evaluation-report-builder";
import { buildDocxGapReport } from "@/features/export/gap-report";
import { listPolishRuns } from "@/features/polish/store";
import { project as projectLayout } from "@/features/layout/project";
import { projectWorkspaceView } from "@/lib/workspace-view";
import { projectChatMessages } from "@/lib/chat-projection";
import { Sidebar } from "@/components/workspace/Sidebar";
import { ContextPanel } from "@/components/workspace/ContextPanel";
import { ChatStream } from "@/components/chat/ChatStream";
import { StageGate } from "@/components/stages/StageGate";
import { EvaluateReportView, type EvaluationReportView } from "@/components/stages/EvaluateReportView";
import { PolishCandidatesView } from "@/components/stages/PolishCandidatesView";
import { ExportPreviewView } from "@/components/stages/ExportPreviewView";
import { StageAutoRunner } from "@/components/stages/StageAutoRunner";
import { AutoAdvanceRunner } from "@/components/stages/AutoAdvanceRunner";
import { AutoAdvanceToggle } from "@/components/workspace/AutoAdvanceToggle";
import { ContextPanelContent } from "@/components/workspace/ContextPanelContent";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string; resumeId: string }>;
};

/**
 * 主工作区（单页，Gemini 式）。RSC 一次读齐所有数据，
 * 按 session.currentStage + status 投影主区视图。
 * 每次 action 后由 revalidate 触发重查。
 */
export default async function WorkspacePage({ params }: Props) {
  const { projectId, resumeId } = await params;

  const projectResume = await getProjectResume(projectId, resumeId);
  if (!projectResume) notFound();
  const { document } = projectResume;

  // 项目列表 + 每个项目的 master resumeId（侧栏跳转用）
  const projects = listProjects();
  const resumeIdByProject: Record<string, string> = {};
  for (const project of projects) {
    const master = listResumes(project.id).find((r) => r.kind === "master");
    if (master) resumeIdByProject[project.id] = master.id;
  }

  // pipeline session
  const session = await getSession(projectId);

  // grill 派生数据
  const qaAnswers = await listCoachQaAnswers(projectId, resumeId);
  const queue = buildExperienceQuestionQueue(document);
  const baseGrill = buildGrillSession({ queue, answers: qaAnswers, document });
  const enhancementRecord = baseGrill.base.activeTurn
    ? await readCoachGrillEnhancement({
        projectId,
        resumeId,
        activeTurn: baseGrill.base.activeTurn,
      })
    : null;
  const grill = enhancementRecord
    ? buildGrillSession({ queue, answers: qaAnswers, document, enhancement: enhancementRecord.enhancement })
    : baseGrill;

  const advanceState = session ? canAdvance(session) : null;
  const projection = projectWorkspaceView(session);

  // grill 对话框派生
  const chatMessages = projectChatMessages(grill);
  const hasExperiences = document.experiences.length > 0 || document.projects.length > 0;
  const counts = grill.base.counts;
  const grillComplete =
    grill.base.turns.length > 0 &&
    counts.pending + counts.answered + counts["needs-evidence"] + counts["ready-to-promote"] === 0;
  const hasDefaultModel = Boolean((await getDefaultModelConfig().catch(() => null))?.apiKey);

  const isGrillView =
    projection.view === "grill-chat" || projection.view === "grill-gate" || projection.view === "start";

  // ── M3 阶段视图数据 ──────────────────────────────────

  // grill-gate  / evaluate-running / evaluate-report / polish / export
  const stage = session?.currentStage;

  // 评估报告（evaluate 阶段用）
  let evaluateView: EvaluationReportView | null = null;
  if (session?.evaluationSummary) {
    const experiences = document.experiences.map((e) => ({ id: e.id, label: `${e.role} @ ${e.organization}` }));
    evaluateView = buildEvaluationReportView({ summary: session.evaluationSummary, experiences });
  }

  // 润色候选（polish 阶段用）
  const polishRuns = stage === "polish" ? await listPolishRuns(projectId, resumeId) : [];

  // 导出预览（export 阶段用）
  const exportRecords = stage === "export" ? listExports(resumeId) : [];
  const latestExport =
    exportRecords.length > 0
      ? [...exportRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : null;
  const gapReport = buildDocxGapReport(document);
  const snapshot = session?.exportSnapshot;
  const fitExplanation =
    snapshot?.fitDecisions && snapshot.fitDecisions.length > 0
      ? buildFitExplanation({
          decisions: snapshot.fitDecisions,
          blocks: projectLayout(document).schema.blocks,
        })
      : null;

  // ── 主区分发 ─────────────────────────────────────────

  function renderMain() {
    if (isGrillView) {
      return (
        <ChatStream
          projectId={projectId}
          resumeId={resumeId}
          hasSession={Boolean(session)}
          messages={chatMessages}
          session={grill}
          hasExperiences={hasExperiences}
          hasDefaultModel={hasDefaultModel}
          grillComplete={grillComplete || Boolean(advanceState?.ready)}
        />
      );
    }

    // evaluate-running：自动触发评估执行 + skeleton 占位（替代永久 spinner）
    if (projection.view === "evaluate-running") {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <StageAutoRunner projectId={projectId} resumeId={resumeId} kind="evaluate" />
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <p className="text-sm font-medium">AI 联网评估中…</p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            正在搜索验证技能稀缺性、公司背景与岗位匹配度。完成后将自动显示报告。
          </p>
          <div className="mt-1 flex flex-col gap-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      );
    }

    // evaluate-report：评估报告（autoAdvance 时隐藏手动门，由 AutoAdvanceRunner 倒计时推进）
    if (projection.view === "evaluate-report" && session && evaluateView) {
      const autoRunning = session.autoAdvance;
      return (
        <>
          <EvaluateReportView
            projectId={projectId}
            resumeId={resumeId}
            viewModel={evaluateView}
            autoAdvancing={autoRunning}
          />
          {autoRunning ? (
            <div className="mx-auto mt-4 w-full max-w-3xl">
              <AutoAdvanceRunner projectId={projectId} resumeId={resumeId} nextLabel="润色" />
            </div>
          ) : null}
        </>
      );
    }

    // grill-gate：grill 完成后的阶段门（autoAdvance 时叠加倒计时器，透明展示外发项 + 可暂停）
    if (projection.view === "grill-gate" && session) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {session.autoAdvance ? (
            <AutoAdvanceRunner projectId={projectId} resumeId={resumeId} nextLabel="评估" />
          ) : null}
          <StageGate projectId={projectId} resumeId={resumeId} session={session} />
        </div>
      );
    }

    // polish：in_progress 自动触发润色生成；否则展示候选
    if (projection.view === "polish" && session) {
      const polishRunning = session.stages.polish.status === "in_progress";
      return (
        <>
          {polishRunning ? (
            <StageAutoRunner projectId={projectId} resumeId={resumeId} kind="polish" />
          ) : null}
          <PolishCandidatesView
            projectId={projectId}
            resumeId={resumeId}
            runs={polishRuns}
            stageStatus={session.stages.polish.status}
          />
        </>
      );
    }

    // export：导出预览
    if (projection.view === "export" && session) {
      return (
        <ExportPreviewView
          projectId={projectId}
          resumeId={resumeId}
          session={session}
          gapReport={gapReport}
          fitExplanation={fitExplanation}
          latestExportId={latestExport?.id ?? null}
        />
      );
    }

    // completed
    if (projection.view === "completed") {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-status-confirmed/40 bg-status-confirmed/10 p-8 text-center">
          <p className="text-lg font-semibold text-status-confirmed">项目已完成</p>
          <p className="text-sm leading-6 text-muted-foreground">
            所有阶段已完成。在侧栏可切换其他项目或返回。
          </p>
        </div>
      );
    }

    // fallback
    return (
      <div className="text-sm text-muted-foreground">
        视图 {projection.view} 将在后续里程碑接入。（当前 stage: {stage} / status: {session?.stages[stage!]?.status}）
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects}
        currentProjectId={projectId}
        currentResumeId={resumeId}
        session={session}
        resumeIdByProject={resumeIdByProject}
      />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {session ? (
          <div className="border-b border-border px-6 py-2.5">
            <AutoAdvanceToggle
              projectId={projectId}
              resumeId={resumeId}
              enabled={session.autoAdvance}
            />
          </div>
        ) : null}
        <div className="flex-1 px-6 py-8">
          {renderMain()}
        </div>
      </main>

      <ContextPanel title="上下文">
        <ContextPanelContent
          view={projection.view}
          stage={stage ?? null}
          experienceCount={document.experiences.length}
          projectCount={document.projects.length}
          skillGroupCount={document.skills.length}
          confirmedBullets={gapReport.confirmedExperienceBullets + gapReport.confirmedProjectBullets}
          missingBasics={gapReport.missingBasics}
        />
      </ContextPanel>
    </div>
  );
}