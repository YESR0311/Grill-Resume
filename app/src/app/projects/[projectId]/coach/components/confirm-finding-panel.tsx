"use client";

import { useState, useTransition } from "react";
import { confirmCoachFindingAction } from "@/features/coach/actions";

type ExperienceOption = { id: string; label: string };

type Props = {
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  findingText: string;
  experiences: ExperienceOption[];
};

type ResultRow = { text: string; metric: string; confidence: "confirmed" | "needs_confirmation" };

export function ConfirmFindingPanel({ projectId, resumeId, reportId, findingId, findingText, experiences }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [experienceId, setExperienceId] = useState(experiences[0]?.id ?? "");
  const [context, setContext] = useState("");
  const [task, setTask] = useState("");
  const [actions, setActions] = useState<string[]>([""]);
  const [results, setResults] = useState<ResultRow[]>([{ text: "", metric: "", confidence: "needs_confirmation" }]);
  const [skills, setSkills] = useState<string[]>([""]);
  const [scope, setScope] = useState("");
  const [reflection, setReflection] = useState("");
  const [sourceText, setSourceText] = useState(findingText);

  if (experiences.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        当前简历尚无任何经历段，请先在编辑页添加一段经历，再回来确认。
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-3 rounded-full bg-slate-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        onClick={() => setOpen(true)}
      >
        确认进入证据图
      </button>
    );
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      await confirmCoachFindingAction(projectId, resumeId, reportId, findingId, formData);
    });
  }

  return (
    <form action={submit} className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
      <p className="font-medium text-slate-900">确认到 STAR 证据</p>
      <label className="block">
        <span>挂到哪段经历</span>
        <select
          name="experienceId"
          value={experienceId}
          onChange={(event) => setExperienceId(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5"
          required
        >
          {experiences.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span>背景 Context（可选）</span>
        <textarea name="starContext" value={context} onChange={(e) => setContext(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5" rows={2} />
      </label>
      <label className="block">
        <span>任务 Task（可选）</span>
        <textarea name="starTask" value={task} onChange={(e) => setTask(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5" rows={2} />
      </label>

      <fieldset className="space-y-2">
        <legend>动作 Actions（至少一条）</legend>
        {actions.map((value, index) => (
          <div key={index} className="flex gap-2">
            <textarea
              name="starAction"
              value={value}
              required={index === 0}
              onChange={(event) =>
                setActions((prev) => prev.map((item, idx) => (idx === index ? event.target.value : item)))
              }
              className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5"
              rows={2}
            />
            {actions.length > 1 ? (
              <button
                type="button"
                className="rounded-full bg-slate-100 px-3 text-xs"
                onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== index))}
              >
                删
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="rounded-full bg-slate-100 px-3 py-1 text-xs"
          onClick={() => setActions((prev) => [...prev, ""])}
        >
          + 加一条动作
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend>结果 Results（至少一条）</legend>
        {results.map((row, index) => (
          <div key={index} className="space-y-1 rounded-xl border border-slate-200 p-2">
            <textarea
              name="starResultText"
              value={row.text}
              required={index === 0}
              onChange={(event) =>
                setResults((prev) => prev.map((item, idx) => (idx === index ? { ...item, text: event.target.value } : item)))
              }
              placeholder="结果文本"
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5"
              rows={2}
            />
            <div className="flex gap-2">
              <input
                name="starResultMetric"
                value={row.metric}
                placeholder="量化指标（可选）"
                onChange={(event) =>
                  setResults((prev) => prev.map((item, idx) => (idx === index ? { ...item, metric: event.target.value } : item)))
                }
                className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5"
              />
              <select
                name="starResultConfidence"
                value={row.confidence}
                onChange={(event) =>
                  setResults((prev) =>
                    prev.map((item, idx) =>
                      idx === index ? { ...item, confidence: event.target.value as ResultRow["confidence"] } : item,
                    ),
                  )
                }
                className="rounded-xl border border-slate-300 px-2 py-1.5"
              >
                <option value="needs_confirmation">待复核</option>
                <option value="confirmed">已核实</option>
              </select>
              {results.length > 1 ? (
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 text-xs"
                  onClick={() => setResults((prev) => prev.filter((_, idx) => idx !== index))}
                >
                  删
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="rounded-full bg-slate-100 px-3 py-1 text-xs"
          onClick={() => setResults((prev) => [...prev, { text: "", metric: "", confidence: "needs_confirmation" }])}
        >
          + 加一条结果
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend>技能 Skills（可选）</legend>
        {skills.map((value, index) => (
          <div key={index} className="flex gap-2">
            <input
              name="starSkill"
              value={value}
              onChange={(event) =>
                setSkills((prev) => prev.map((item, idx) => (idx === index ? event.target.value : item)))
              }
              className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5"
            />
            {skills.length > 1 ? (
              <button
                type="button"
                className="rounded-full bg-slate-100 px-3 text-xs"
                onClick={() => setSkills((prev) => prev.filter((_, idx) => idx !== index))}
              >
                删
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="rounded-full bg-slate-100 px-3 py-1 text-xs"
          onClick={() => setSkills((prev) => [...prev, ""])}
        >
          + 加一项技能
        </button>
      </fieldset>

      <label className="block">
        <span>范围 Scope（可选）</span>
        <input name="starScope" value={scope} onChange={(e) => setScope(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5" />
      </label>
      <label className="block">
        <span>反思 Reflection（可选）</span>
        <textarea name="starReflection" value={reflection} onChange={(e) => setReflection(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5" rows={2} />
      </label>
      <label className="block">
        <span>原始来源 SourceText</span>
        <textarea name="starSourceText" value={sourceText} onChange={(e) => setSourceText(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5" rows={2} />
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" className="rounded-full bg-slate-100 px-4 py-1.5 text-xs" onClick={() => setOpen(false)}>
          取消
        </button>
        <button type="submit" disabled={pending} className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {pending ? "提交中…" : "确认入图"}
        </button>
      </div>
    </form>
  );
}
