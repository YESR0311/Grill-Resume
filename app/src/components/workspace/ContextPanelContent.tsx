import type { PipelineStage } from "@/features/pipeline";
import type { WorkspaceView } from "@/lib/workspace-view";
import { STAGE_LABELS, STAGE_DESCRIPTIONS } from "@/lib/stage-messages";

/**
 * 右侧上下文面板内容（RSC，design §信息架构）。把全程空态变引导载体：
 *  - 当前阶段说明（这一步在做什么）
 *  - 已确认内容统计（evidence-first：让用户看到积累了多少有据内容）
 *  - 下一步该做什么
 * 纯展示，所有数据由 page.tsx 算好传入，不依赖 document/gapReport 类型。
 */

const NEXT_STEP: Record<WorkspaceView, string> = {
  start: "新建或打开项目后，粘贴材料生成经历，开始第一轮问答。",
  "grill-chat": "逐题回答追问，把流水账补成可证事实；可随时补充更多材料。",
  "grill-gate": "确认问答结果，进入 AI 联网评估。",
  "evaluate-running": "AI 正在联网评估，稍候自动显示报告。",
  "evaluate-report": "查看评估报告，确认后进入候选润色。",
  polish: "为每条要点选择候选版本，全部处理后进入导出。",
  export: "确认单页排版，导出中文 DOCX 并下载。",
  completed: "已完成。可在侧栏切换其他项目或重新导出。",
};

export function ContextPanelContent({
  view,
  stage,
  experienceCount,
  projectCount,
  skillGroupCount,
  confirmedBullets,
  missingBasics,
}: {
  view: WorkspaceView;
  stage: PipelineStage | null;
  experienceCount: number;
  projectCount: number;
  skillGroupCount: number;
  confirmedBullets: number;
  missingBasics: string[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="text-xs font-medium text-muted-foreground">当前阶段</p>
        <p className="mt-1.5 text-sm font-semibold text-foreground">
          {stage ? STAGE_LABELS[stage] : "未开始"}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {stage ? STAGE_DESCRIPTIONS[stage] : "新建或打开项目后开始第一轮问答。"}
        </p>
      </section>

      <section>
        <p className="text-xs font-medium text-muted-foreground">已确认内容</p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="经历" value={experienceCount} />
          <Stat label="项目" value={projectCount} />
          <Stat label="确定事实" value={confirmedBullets} />
          <Stat label="技能组" value={skillGroupCount} />
        </dl>
        {missingBasics.length > 0 ? (
          <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/30 px-2.5 py-1.5 text-xs leading-5 text-amber-800">
            待补全：{missingBasics.join("、")}
          </p>
        ) : null}
      </section>

      <section>
        <p className="text-xs font-medium text-muted-foreground">下一步</p>
        <p className="mt-1.5 text-xs leading-5 text-foreground">{NEXT_STEP[view]}</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
