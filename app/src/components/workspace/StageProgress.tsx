import { PIPELINE_STAGES, type PipelineSession } from "@/features/pipeline";
import { STAGE_LABELS, STATUS_LABELS } from "@/lib/stage-messages";
import { cn } from "@/lib/utils";

/**
 * grill→evaluate→polish→export 进度指示。teal 单色明度梯度（globals.css --stage-*）。
 * 纯展示，无交互——推进动作在主区 gate 触发。
 */
export function StageProgress({ session }: { session: PipelineSession | null }) {
  return (
    <ol className="flex flex-col gap-1" aria-label="流程进度">
      {PIPELINE_STAGES.map((stage, index) => {
        const state = session?.stages[stage];
        const status = state?.status ?? "not_started";
        const isCurrent = session?.currentStage === stage && !session?.completedAt;
        const isDone = status === "completed";
        const isFailed = status === "failed";

        return (
          <li
            key={stage}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              isCurrent && "bg-accent text-accent-foreground font-medium",
              !isCurrent && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ring-1",
                isDone && "bg-status-confirmed text-status-confirmed-foreground ring-transparent",
                isFailed && "bg-status-failed text-status-failed-foreground ring-transparent",
                isCurrent && !isDone && !isFailed && "bg-primary text-primary-foreground ring-transparent",
                !isCurrent && !isDone && !isFailed && "ring-border text-muted-foreground",
              )}
            >
              {isDone ? "✓" : index + 1}
            </span>
            <span className="flex-1">{STAGE_LABELS[stage]}</span>
            {(isCurrent || isFailed) && (
              <span className="text-[11px] tabular-nums opacity-70">{STATUS_LABELS[status]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
