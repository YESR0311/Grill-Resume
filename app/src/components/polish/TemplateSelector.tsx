"use client";

import { Check } from "lucide-react";
import { useDraft } from "./DraftProvider";
import {
  RESUME_TEMPLATES,
  TEMPLATE_TYPE_LABELS,
  type ResumeTemplateType,
} from "@/features/polish/templates";

/**
 * 模板选择器（design §5.3 / §4.3）。
 * 一键切换模板，applyTemplate 只换样式参数、内容不变（4.7 实时预览）。
 */
export function TemplateSelector() {
  const { templateId, applyTemplate } = useDraft();

  // 按类型分组
  const groups = new Map<ResumeTemplateType, typeof RESUME_TEMPLATES>();
  for (const tpl of RESUME_TEMPLATES) {
    const arr = groups.get(tpl.type) ?? [];
    arr.push(tpl);
    groups.set(tpl.type, arr);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([type, templates]) => (
        <div key={type}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {TEMPLATE_TYPE_LABELS[type]}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((tpl) => {
              const active = tpl.id === templateId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl.id)}
                  className={`group relative flex flex-col gap-1 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <span
                    className="h-1.5 w-10 rounded-full"
                    style={{ backgroundColor: tpl.style.colorScheme.primary }}
                  />
                  <span className="text-sm font-medium text-foreground">{tpl.name}</span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {tpl.description}
                  </span>
                  {active && (
                    <Check size={14} className="absolute top-2 right-2 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
