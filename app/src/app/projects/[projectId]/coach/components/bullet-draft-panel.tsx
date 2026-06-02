"use client";

import { useState, useTransition } from "react";
import { applyBulletDraftAction, generateBulletDraftAction } from "@/features/coach/actions";

type Candidate = { text: string; rationale?: string };

type GenerateProps = {
  mode: "generate";
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  hasPendingDraft: boolean;
};

type ApplyProps = {
  mode: "apply";
  projectId: string;
  resumeId: string;
  draftId: string;
  candidates: Candidate[];
};

export function BulletDraftPanel(props: GenerateProps | ApplyProps) {
  if (props.mode === "generate") return <GeneratePanel {...props} />;
  return <ApplyPanel {...props} />;
}

function GeneratePanel({ projectId, resumeId, reportId, findingId, hasPendingDraft }: GenerateProps) {
  const [pending, startTransition] = useTransition();

  function trigger(formData: FormData) {
    startTransition(async () => {
      await generateBulletDraftAction(projectId, resumeId, reportId, findingId, formData);
    });
  }

  if (hasPendingDraft) {
    return <p className="mt-3 text-xs text-slate-500">已有待审草稿。</p>;
  }

  return (
    <form action={trigger} className="mt-3 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-1" />
        <span>我已确认：将向当前模型 provider 发送这条已确认 research finding 和关联 STAR 证据，用于生成候选 bullet。</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "生成中…" : "生成 bullet 草稿"}
      </button>
    </form>
  );
}

function ApplyPanel({ projectId, resumeId, draftId, candidates }: ApplyProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [finalText, setFinalText] = useState(candidates[0]?.text ?? "");
  const [pending, startTransition] = useTransition();

  function selectCandidate(index: number) {
    setCandidateIndex(index);
    setFinalText(candidates[index]?.text ?? "");
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      await applyBulletDraftAction(projectId, resumeId, draftId, formData);
    });
  }

  return (
    <form action={submit} className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
      <p className="font-medium text-slate-900">选一条 bullet 草稿入正文</p>
      <input type="hidden" name="candidateIndex" value={candidateIndex} />
      <ul className="space-y-2">
        {candidates.map((candidate, index) => (
          <li key={index} className="rounded-xl border border-slate-200 p-3">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="candidate"
                checked={index === candidateIndex}
                onChange={() => selectCandidate(index)}
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block whitespace-pre-line text-slate-800">{candidate.text}</span>
                {candidate.rationale ? (
                  <span className="block text-[11px] text-slate-500">理由：{candidate.rationale}</span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="block">
        <span>最终 bullet 文本（可改）</span>
        <textarea
          name="finalText"
          value={finalText}
          onChange={(event) => setFinalText(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5"
          rows={3}
          maxLength={800}
          required
        />
      </label>
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "提交中…" : "确认入正文"}
        </button>
      </div>
    </form>
  );
}
