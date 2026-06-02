// UI pattern reference: external/JobPilot/src/components/editor/* text controls (Apache-2.0). Reimplemented as confirmed-only wording overrides; no code copied.

import Link from "next/link";
import { useState } from "react";
import { validateMicroEdit, type MicroEditEvidence, type MicroEditValidation } from "./grounding";
import { diffText } from "@/features/polish/diff";

type EditableBullet = {
  bulletId: string;
  original: string;
  value: string;
  label: string;
};

function reasonLabel(result: Exclude<MicroEditValidation, { ok: true }>): string {
  if (result.reason === "introduces-unsourced-number") return `新增数字「${result.token}」缺少证据`;
  return `新增实体「${result.token}」缺少证据`;
}

function InlineDiff({ original, value }: { original: string; value: string }) {
  const parts = diffText(original, value);
  return (
    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">
      {parts.map((part, index) => (
        <span
          key={`${part.type}:${index}`}
          className={
            part.type === "added"
              ? "bg-emerald-100 text-emerald-900"
              : part.type === "removed"
              ? "bg-rose-100 text-rose-700 line-through"
              : undefined
          }
        >
          {part.value}
        </span>
      ))}
    </p>
  );
}

export function MicroEditPanel({
  bullets,
  evidenceMap,
  grillHref,
  onChange,
}: {
  bullets: EditableBullet[];
  evidenceMap: Record<string, MicroEditEvidence>;
  grillHref: string;
  onChange: (bulletId: string, value: string | undefined) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (bullets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-950">措辞微调</h2>
        <p className="mt-3 text-sm text-slate-500">当前没有 confirmed bullet 可微调。</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">措辞微调</h2>
      <div className="mt-4 space-y-4">
        {bullets.map((bullet) => {
          const evidence = evidenceMap[bullet.bulletId];
          const validationEvidence = evidence?.evidence ?? [];
          return (
            <div key={bullet.bulletId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-medium text-slate-500">{bullet.label}</p>
                {bullet.value.trim() !== bullet.original.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrors((current) => {
                        const next = { ...current };
                        delete next[bullet.bulletId];
                        return next;
                      });
                      onChange(bullet.bulletId, undefined);
                    }}
                    className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-400"
                  >
                    还原
                  </button>
                ) : null}
              </div>
              <textarea
                value={bullet.value}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  const result = validateMicroEdit({ original: bullet.original, edited: nextValue, evidence: validationEvidence });
                  if (!result.ok) {
                    setErrors((current) => ({ ...current, [bullet.bulletId]: reasonLabel(result) }));
                    return;
                  }
                  setErrors((current) => {
                    const next = { ...current };
                    delete next[bullet.bulletId];
                    return next;
                  });
                  onChange(bullet.bulletId, nextValue.trim() === bullet.original.trim() ? undefined : nextValue);
                }}
                className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800"
              />
              {errors[bullet.bulletId] ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  <p>{errors[bullet.bulletId]}</p>
                  <Link href={grillHref} className="mt-1 inline-flex font-medium underline underline-offset-2">
                    回 grill 补证据
                  </Link>
                </div>
              ) : null}
              <InlineDiff original={bullet.original} value={bullet.value} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
