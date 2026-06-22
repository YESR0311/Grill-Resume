"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  FontSize,
  LetterSpacing,
  FontWeight,
  LineHeight,
  TextAlign,
  FontFamily,
} from "@/features/polish/extensions";
import { Plus, Trash2 } from "lucide-react";
import { useDraft } from "./DraftProvider";
import { useActiveEditor } from "./active-editor";
import type { ResumeDraft, ResumeSectionKey } from "@/features/polish/types";

/**
 * 结构化编辑器（design §5.3）。
 * 按 style.sectionOrder 渲染各模块，实时套用模板样式参数（4.7 实时预览）。
 * 内容编辑用受控 input + 富文本 bullet（Tiptap，支持 inline mark）。
 */

const SECTION_TITLES: Record<ResumeSectionKey, string> = {
  summary: "个人简介",
  workExperience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
  skills: "技能",
};

export function StructuredEditor() {
  const { style } = useDraft();

  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <div style={sheetStyle}>
        <HeaderBlock />
        {style.sectionOrder.map((key) => (
          <div key={key} className="mb-6">
            <SectionTitle text={SECTION_TITLES[key]} color={style.colorScheme.primary} />
            <SectionBody sectionKey={key} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ text, color }: { text: string; color: string }) {
  return (
    <h3
      className="mb-2 border-b pb-1 text-sm font-semibold uppercase tracking-wider"
      style={{ color, borderColor: color }}
    >
      {text}
    </h3>
  );
}

function SectionBody({ sectionKey }: { sectionKey: ResumeSectionKey }) {
  switch (sectionKey) {
    case "summary":
      return <SummaryBlock />;
    case "workExperience":
      return <SectionBlock field="workExperience" />;
    case "projects":
      return <SectionBlock field="projects" />;
    case "education":
      return <EducationBlock />;
    case "skills":
      return <SkillTagBlock />;
    default:
      return null;
  }
}

// ─── 个人简介 ────────────────────────────────────────────────

function SummaryBlock() {
  const { draft, updateField } = useDraft();
  return (
    <textarea
      value={draft.summary}
      onChange={(e) => updateField("summary", e.target.value)}
      rows={3}
      className="w-full resize-y rounded-lg border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
      placeholder="个人简介…"
    />
  );
}

// ─── 工作经历 / 项目经历（可增删 item + bullet） ──────────────

function SectionBlock({ field }: { field: "workExperience" | "projects" }) {
  const { draft, updateField, style } = useDraft();
  const section = draft[field];

  const updateItems = (items: typeof section.items) => {
    updateField(field, { ...section, items });
  };

  const addItem = () => {
    updateItems([
      ...section.items,
      { id: crypto.randomUUID().slice(0, 8), organization: "", role: "", startDate: "", endDate: "", bullets: [] },
    ]);
  };

  const removeItem = (idx: number) => {
    updateItems(section.items.filter((_, i) => i !== idx));
  };

  const patchItem = (idx: number, patch: Partial<typeof section.items[number]>) => {
    updateItems(section.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <div className="space-y-3">
      {section.items.map((item, idx) => (
        <div key={item.id || idx} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={item.role}
              onChange={(e) => patchItem(idx, { role: e.target.value })}
              placeholder="职位 / 角色"
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={item.organization}
              onChange={(e) => patchItem(idx, { organization: e.target.value })}
              placeholder="公司 / 项目名"
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="rounded p-1 text-muted-foreground hover:text-status-failed"
              aria-label="删除条目"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="mb-2 flex gap-2">
            <input
              value={item.startDate}
              onChange={(e) => patchItem(idx, { startDate: e.target.value })}
              placeholder="开始时间"
              className="w-28 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={item.endDate}
              onChange={(e) => patchItem(idx, { endDate: e.target.value })}
              placeholder="结束时间"
              className="w-28 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <BulletListBlock
            bullets={item.bullets}
            accent={style.colorScheme.accent}
            onChange={(bullets) => patchItem(idx, { bullets })}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      >
        <Plus size={13} /> 添加条目
      </button>
    </div>
  );
}

// ─── 要点列表（增删 + 富文本 inline mark） ──────────────────

type BulletItem = ResumeDraft["workExperience"]["items"][number]["bullets"][number];

function BulletListBlock({
  bullets,
  accent,
  onChange,
}: {
  bullets: BulletItem[];
  accent: string;
  onChange: (bullets: BulletItem[]) => void;
}) {
  const addBullet = () => onChange([...bullets, { text: "", isConfirmed: false }]);
  const removeBullet = (idx: number) => onChange(bullets.filter((_, i) => i !== idx));
  const patchBullet = (idx: number, text: string) =>
    onChange(bullets.map((b, i) => (i === idx ? { ...b, text } : b)));

  return (
    <div className="space-y-1.5 pl-1">
      {bullets.map((b, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
          <RichBullet value={b.text} onChange={(text) => patchBullet(idx, text)} />
          <button
            type="button"
            onClick={() => removeBullet(idx)}
            className="mt-1 rounded p-0.5 text-muted-foreground hover:text-status-failed"
            aria-label="删除要点"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addBullet}
        className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus size={12} /> 添加要点
      </button>
    </div>
  );
}

/** 单条 bullet 的 Tiptap 富文本编辑器，支持 bold/italic/underline/strike/color。 */
function RichBullet({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const { setEditor } = useActiveEditor();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      LetterSpacing,
      FontWeight,
      LineHeight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontFamily.configure({ types: ["textStyle"] }),
    ],
    content: value || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-[1.5rem] flex-1 rounded border border-transparent px-1 py-0.5 text-sm outline-none focus:border-border",
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    onFocus: ({ editor: ed }) => setEditor(ed as Editor),
  });

  // 卸载时清空 active 引用，避免悬空指针。
  useEffect(() => {
    return () => setEditor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!editor) return null;
  return <EditorContent editor={editor} className="flex-1" />;
}

// ─── 教育背景 ────────────────────────────────────────────────

function EducationBlock() {
  const { draft, updateField } = useDraft();
  const section = draft.education;

  const updateItems = (items: typeof section.items) => {
    updateField("education", { ...section, items });
  };
  const patchItem = (idx: number, patch: Partial<typeof section.items[number]>) => {
    updateItems(section.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () =>
    updateItems([
      ...section.items,
      { id: crypto.randomUUID().slice(0, 8), organization: "", role: "", startDate: "", endDate: "", bullets: [] },
    ]);
  const removeItem = (idx: number) => updateItems(section.items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {section.items.map((item, idx) => (
        <div key={item.id || idx} className="flex items-center gap-2">
          <input
            value={item.organization}
            onChange={(e) => patchItem(idx, { organization: e.target.value })}
            placeholder="学校"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={item.role}
            onChange={(e) => patchItem(idx, { role: e.target.value })}
            placeholder="学位 专业"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={item.endDate}
            onChange={(e) => patchItem(idx, { endDate: e.target.value })}
            placeholder="毕业时间"
            className="w-28 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="rounded p-1 text-muted-foreground hover:text-status-failed"
            aria-label="删除教育条目"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      >
        <Plus size={13} /> 添加教育
      </button>
    </div>
  );
}

// ─── 技能标签（增删） ────────────────────────────────────────

function SkillTagBlock() {
  const { draft, updateField, style } = useDraft();
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v) return;
    updateField("skills", [...draft.skills, v]);
    setInput("");
  };
  const remove = (idx: number) => {
    updateField("skills", draft.skills.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {draft.skills.map((sk, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
            style={{ backgroundColor: `${style.colorScheme.primary}1a`, color: style.colorScheme.text }}
          >
            {sk}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-status-failed"
              aria-label="删除技能"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="输入技能后回车"
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
        >
          添加
        </button>
      </div>
    </div>
  );
}

// ─── 顶部基础信息 ────────────────────────────────────────────

function HeaderBlock() {
  const { draft, updateField, style } = useDraft();
  return (
    <div className="mb-6 space-y-1.5 text-center">
      <input
        value={draft.name}
        onChange={(e) => updateField("name", e.target.value)}
        placeholder="姓名"
        className="w-full bg-transparent text-center text-2xl font-bold outline-none"
        style={{ color: style.colorScheme.primary }}
      />
      <input
        value={draft.title}
        onChange={(e) => updateField("title", e.target.value)}
        placeholder="目标岗位"
        className="w-full bg-transparent text-center text-sm outline-none"
        style={{ color: style.colorScheme.accent }}
      />
      <div className="flex justify-center gap-2">
        <input
          value={draft.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="邮箱"
          className="w-40 bg-transparent text-center text-xs outline-none"
          style={{ color: style.colorScheme.accent }}
        />
        <input
          value={draft.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          placeholder="电话"
          className="w-32 bg-transparent text-center text-xs outline-none"
          style={{ color: style.colorScheme.accent }}
        />
      </div>
    </div>
  );
}
