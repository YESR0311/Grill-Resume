"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import {
  applyIntakeInWorkspace,
  parseIntakeInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE, type WorkspaceActionState } from "@/lib/workspace-action-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { stageMessage } from "@/lib/stage-messages";

/**
 * 录入材料入口（design §5.2 IntakeComposer）。粘贴流水账 → parseIntakeAction 出候选
 * → 勾选确认 applyIntakeAction 写入简历。候选只是待确认草稿，不勾不写。默认不调 AI / 外部网络。
 *
 * 两段式：parse 把候选回填进 state（client 据此渲染勾选表单），apply 用 candidate.id 提交选择。
 */

export function IntakeComposer({ projectId, resumeId }: { projectId: string; resumeId: string }) {
  const [parseState, parseAction, parsePending] = useActionState(
    parseIntakeInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold">粘贴材料，生成待确认候选</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          候选只有勾选确认后才写入简历；默认不调用 AI 或外部网络。
        </p>
      </div>

      <form action={parseAction} className="flex flex-col gap-3">
        <input
          name="targetRole"
          placeholder="目标岗位（可选）"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Textarea name="jdText" placeholder="JD（可选）" className="min-h-20" />
        <Textarea
          name="rawText"
          required
          placeholder="粘贴流水账材料。可用：经历｜岗位｜成果；项目｜角色｜技术栈；技能｜React，Node.js"
          className="min-h-40"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={parsePending}>
            {parsePending ? "解析中…" : "解析候选"}
          </Button>
          {parseState.ts > 0 && !parseState.ok ? (
            <span className="text-xs text-destructive">{stageMessage(parseState.code) ?? "解析失败。"}</span>
          ) : null}
        </div>
      </form>

      {parseState.candidate ? (
        <CandidateConfirm projectId={projectId} resumeId={resumeId} candidate={parseState.candidate} />
      ) : null}
    </div>
  );
}

function CandidateConfirm({
  projectId,
  resumeId,
  candidate,
}: {
  projectId: string;
  resumeId: string;
  candidate: NonNullable<WorkspaceActionState["candidate"]>;
}) {
  const [state, action, pending] = useActionState(
    applyIntakeInWorkspace.bind(null, projectId, resumeId, candidate.id),
    IDLE_WORKSPACE_STATE,
  );

  const empty =
    candidate.education.length === 0 &&
    candidate.experiences.length === 0 &&
    candidate.projects.length === 0 &&
    candidate.skills.length === 0;

  return (
    <form action={action} className="flex flex-col gap-5 rounded-xl border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-semibold">候选确认</h4>
      {empty ? (
        <p className="text-xs text-muted-foreground">未从材料解析出结构化候选，请调整格式后重试。</p>
      ) : null}

      {candidate.education.length > 0 ? (
        <CandidateGroup title="教育">
          {candidate.education.map((item) => (
            <CandidateRow key={item.id} name="educationId" value={item.id}>
              {item.school} · {item.degree} · {item.major}
            </CandidateRow>
          ))}
        </CandidateGroup>
      ) : null}

      {candidate.experiences.length > 0 ? (
        <CandidateGroup title="经历">
          {candidate.experiences.map((item) => (
            <CandidateRow key={item.id} name="experienceId" value={item.id}>
              {item.organization} · {item.role}
              {item.bullets[0] ? <p className="mt-1 text-muted-foreground">{item.bullets[0].text}</p> : null}
            </CandidateRow>
          ))}
        </CandidateGroup>
      ) : null}

      {candidate.projects.length > 0 ? (
        <CandidateGroup title="项目">
          {candidate.projects.map((item) => (
            <CandidateRow key={item.id} name="projectId" value={item.id}>
              {item.name}
              {item.role ? ` · ${item.role}` : ""}
            </CandidateRow>
          ))}
        </CandidateGroup>
      ) : null}

      {candidate.skills.length > 0 ? (
        <CandidateGroup title="技能">
          {candidate.skills.map((item) => (
            <CandidateRow key={item.id} name="skillId" value={item.id}>
              {item.items.join("、")}
            </CandidateRow>
          ))}
        </CandidateGroup>
      ) : null}

      {!empty ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            写入勾选项
          </Button>
          {state.ts > 0 ? (
            <span className={cn("text-xs", state.ok ? "text-status-confirmed" : "text-destructive")}>
              {state.ok ? "已写入已确认候选。" : stageMessage(state.code) ?? "写入失败。"}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function CandidateGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h5 className="text-xs font-semibold text-muted-foreground">{title}</h5>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CandidateRow({ name, value, children }: { name: string; value: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm">
      <input name={name} value={value} type="checkbox" className="mt-0.5" />
      <span>{children}</span>
    </label>
  );
}
