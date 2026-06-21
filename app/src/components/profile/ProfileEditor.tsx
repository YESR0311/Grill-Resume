"use client";

import { useReducer, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowRight, ArrowLeft, Plus, X } from "lucide-react";
import { nanoid } from "nanoid";
import type { PersonProfile } from "@/features/profile/types";
import { saveProfileAction } from "@/app/profile/[id]/actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── 状态与 reducer ──────────────────────────────────────
type Step = "basics" | "experiences" | "projects" | "skills" | "education";

type ProfileFormState = {
  step: Step;
  dirty: boolean;
  data: PersonProfile;
};

type ProfileFormAction =
  | { type: "UPDATE_FIELD"; field: keyof PersonProfile; value: PersonProfile[keyof PersonProfile] }
  | { type: "ADD_EXPERIENCE" }
  | { type: "REMOVE_EXPERIENCE"; id: string }
  | { type: "UPDATE_EXPERIENCE"; id: string; patch: Partial<PersonProfile["experiences"][number]> }
  | { type: "ADD_BULLET"; expId: string }
  | { type: "REMOVE_BULLET"; expId: string; bulletId: string }
  | { type: "UPDATE_BULLET"; expId: string; bulletId: string; text: string }
  | { type: "ADD_PROJECT" }
  | { type: "REMOVE_PROJECT"; id: string }
  | { type: "UPDATE_PROJECT"; id: string; patch: Partial<PersonProfile["projects"][number]> }
  | { type: "ADD_SKILL_GROUP" }
  | { type: "REMOVE_SKILL_GROUP"; id: string }
  | { type: "UPDATE_SKILL_GROUP_CATEGORY"; id: string; category: string }
  | { type: "ADD_SKILL"; groupId: string }
  | { type: "REMOVE_SKILL"; groupId: string; index: number }
  | { type: "UPDATE_SKILL"; groupId: string; index: number; value: string }
  | { type: "ADD_EDUCATION" }
  | { type: "REMOVE_EDUCATION"; id: string }
  | { type: "UPDATE_EDUCATION"; id: string; patch: Partial<PersonProfile["education"][number]> }
  | { type: "SWITCH_STEP"; step: Step }
  | { type: "MARK_SAVED" };

function reducer(state: ProfileFormState, action: ProfileFormAction): ProfileFormState {
  const data = state.data;
  const dirty = (next: PersonProfile): ProfileFormState => ({ ...state, data: next, dirty: true });

  switch (action.type) {
    case "UPDATE_FIELD":
      return dirty({ ...data, [action.field]: action.value });

    case "ADD_EXPERIENCE":
      return dirty({
        ...data,
        experiences: [
          ...data.experiences,
          { id: nanoid(8), organization: "", role: "", startDate: "", endDate: "", bullets: [] },
        ],
      });
    case "REMOVE_EXPERIENCE":
      return dirty({ ...data, experiences: data.experiences.filter((e) => e.id !== action.id) });
    case "UPDATE_EXPERIENCE":
      return dirty({
        ...data,
        experiences: data.experiences.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      });
    case "ADD_BULLET":
      return dirty({
        ...data,
        experiences: data.experiences.map((e) =>
          e.id === action.expId
            ? { ...e, bullets: [...e.bullets, { id: nanoid(8), text: "", evidence: [], isConfirmed: false }] }
            : e,
        ),
      });
    case "REMOVE_BULLET":
      return dirty({
        ...data,
        experiences: data.experiences.map((e) =>
          e.id === action.expId ? { ...e, bullets: e.bullets.filter((b) => b.id !== action.bulletId) } : e,
        ),
      });
    case "UPDATE_BULLET":
      return dirty({
        ...data,
        experiences: data.experiences.map((e) =>
          e.id === action.expId
            ? {
                ...e,
                bullets: e.bullets.map((b) => (b.id === action.bulletId ? { ...b, text: action.text } : b)),
              }
            : e,
        ),
      });

    case "ADD_PROJECT":
      return dirty({
        ...data,
        projects: [
          ...data.projects,
          { id: nanoid(8), name: "", role: "", url: "", description: "", evidence: [] },
        ],
      });
    case "REMOVE_PROJECT":
      return dirty({ ...data, projects: data.projects.filter((p) => p.id !== action.id) });
    case "UPDATE_PROJECT":
      return dirty({
        ...data,
        projects: data.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      });

    case "ADD_SKILL_GROUP":
      return dirty({
        ...data,
        skillGroups: [...data.skillGroups, { id: nanoid(8), category: "", skills: [] }],
      });
    case "REMOVE_SKILL_GROUP":
      return dirty({ ...data, skillGroups: data.skillGroups.filter((g) => g.id !== action.id) });
    case "UPDATE_SKILL_GROUP_CATEGORY":
      return dirty({
        ...data,
        skillGroups: data.skillGroups.map((g) => (g.id === action.id ? { ...g, category: action.category } : g)),
      });
    case "ADD_SKILL":
      return dirty({
        ...data,
        skillGroups: data.skillGroups.map((g) =>
          g.id === action.groupId ? { ...g, skills: [...g.skills, ""] } : g,
        ),
      });
    case "REMOVE_SKILL":
      return dirty({
        ...data,
        skillGroups: data.skillGroups.map((g) =>
          g.id === action.groupId ? { ...g, skills: g.skills.filter((_, i) => i !== action.index) } : g,
        ),
      });
    case "UPDATE_SKILL":
      return dirty({
        ...data,
        skillGroups: data.skillGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, skills: g.skills.map((s, i) => (i === action.index ? action.value : s)) }
            : g,
        ),
      });

    case "ADD_EDUCATION":
      return dirty({
        ...data,
        education: [
          ...data.education,
          { id: nanoid(8), institution: "", degree: "", field: "", startDate: "", endDate: "" },
        ],
      });
    case "REMOVE_EDUCATION":
      return dirty({ ...data, education: data.education.filter((e) => e.id !== action.id) });
    case "UPDATE_EDUCATION":
      return dirty({
        ...data,
        education: data.education.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      });

    case "SWITCH_STEP":
      return { ...state, step: action.step };
    case "MARK_SAVED":
      return { ...state, dirty: false };
    default:
      return state;
  }
}

const STEPS: { value: Step; label: string }[] = [
  { value: "basics", label: "基础信息" },
  { value: "experiences", label: "工作经历" },
  { value: "projects", label: "项目" },
  { value: "skills", label: "技能" },
  { value: "education", label: "教育" },
];

/**
 * 档案编辑页——分步工作台（design §5.2）。
 * useReducer 单一状态对象 + Tabs 分节 + 条目增删 + 确认弹窗。
 */
export function ProfileEditor({ profile: initial }: { profile: PersonProfile }) {
  const [state, dispatch] = useReducer(reducer, {
    step: "basics",
    dirty: false,
    data: initial,
  });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStep, setPendingStep] = useState<Step | null>(null);
  const router = useRouter();

  const { data, step, dirty } = state;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveProfileAction(JSON.stringify(data));
      dispatch({ type: "MARK_SAVED" });
    } finally {
      setSaving(false);
    }
  }, [data]);

  const handleSwitchStep = useCallback(
    (next: Step) => {
      if (next === step) return;
      if (dirty) {
        setPendingStep(next);
        return;
      }
      dispatch({ type: "SWITCH_STEP", step: next });
    },
    [step, dirty],
  );

  const handleConfirmEvaluate = useCallback(async () => {
    setConfirmOpen(false);
    await handleSave();
    router.push(`/evaluate/${data.id}`);
  }, [handleSave, router, data.id]);

  return (
    <div className="mx-auto w-full max-w-4xl pb-24">
      {/* 顶栏 */}
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-semibold">人物档案编辑</h1>
        <Button size="lg" variant="outline" onClick={handleSave} disabled={saving}>
          <Save size={15} />
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>

      <Tabs value={step} onValueChange={(v) => handleSwitchStep(v as Step)}>
        <TabsList className="mb-6">
          {STEPS.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 基础信息 */}
        <TabsContent value="basics">
          <div className="grid grid-cols-2 gap-4">
            <Field label="姓名" value={data.name} onChange={(v) => dispatch({ type: "UPDATE_FIELD", field: "name", value: v })} />
            <Field label="目标岗位" value={data.title} onChange={(v) => dispatch({ type: "UPDATE_FIELD", field: "title", value: v })} />
            <Field label="邮箱" value={data.email} onChange={(v) => dispatch({ type: "UPDATE_FIELD", field: "email", value: v })} />
            <Field label="电话" value={data.phone} onChange={(v) => dispatch({ type: "UPDATE_FIELD", field: "phone", value: v })} />
            <Field label="地点" value={data.location} onChange={(v) => dispatch({ type: "UPDATE_FIELD", field: "location", value: v })} className="col-span-2" />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">个人简介</label>
            <textarea
              value={data.summary}
              onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "summary", value: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </TabsContent>

        {/* 工作经历 */}
        <TabsContent value="experiences">
          <div className="space-y-4">
            {data.experiences.map((exp) => (
              <div key={exp.id} className="relative rounded-xl border border-border p-4">
                <RemoveButton onClick={() => dispatch({ type: "REMOVE_EXPERIENCE", id: exp.id })} />
                <div className="grid grid-cols-2 gap-3 pr-8">
                  <input
                    value={exp.organization}
                    onChange={(e) => dispatch({ type: "UPDATE_EXPERIENCE", id: exp.id, patch: { organization: e.target.value } })}
                    placeholder="公司/组织"
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <input
                    value={exp.role}
                    onChange={(e) => dispatch({ type: "UPDATE_EXPERIENCE", id: exp.id, patch: { role: e.target.value } })}
                    placeholder="职位"
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="mt-2 flex gap-4">
                  <input
                    value={exp.startDate}
                    onChange={(e) => dispatch({ type: "UPDATE_EXPERIENCE", id: exp.id, patch: { startDate: e.target.value } })}
                    placeholder="开始时间"
                    className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <input
                    value={exp.endDate}
                    onChange={(e) => dispatch({ type: "UPDATE_EXPERIENCE", id: exp.id, patch: { endDate: e.target.value } })}
                    placeholder="结束时间"
                    className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {exp.bullets.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">•</span>
                      <input
                        value={b.text}
                        onChange={(e) => dispatch({ type: "UPDATE_BULLET", expId: exp.id, bulletId: b.id, text: e.target.value })}
                        placeholder="经历要点"
                        className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "REMOVE_BULLET", expId: exp.id, bulletId: b.id })}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="删除要点"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "ADD_BULLET", expId: exp.id })}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={13} /> 添加要点
                  </button>
                </div>
              </div>
            ))}
            <AddButton label="添加工作经历" onClick={() => dispatch({ type: "ADD_EXPERIENCE" })} />
          </div>
        </TabsContent>

        {/* 项目 */}
        <TabsContent value="projects">
          <div className="space-y-4">
            {data.projects.map((proj) => (
              <div key={proj.id} className="relative rounded-xl border border-border p-4">
                <RemoveButton onClick={() => dispatch({ type: "REMOVE_PROJECT", id: proj.id })} />
                <div className="grid grid-cols-2 gap-3 pr-8">
                  <input
                    value={proj.name}
                    onChange={(e) => dispatch({ type: "UPDATE_PROJECT", id: proj.id, patch: { name: e.target.value } })}
                    placeholder="项目名称"
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <input
                    value={proj.role}
                    onChange={(e) => dispatch({ type: "UPDATE_PROJECT", id: proj.id, patch: { role: e.target.value } })}
                    placeholder="担任角色"
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <input
                  value={proj.url}
                  onChange={(e) => dispatch({ type: "UPDATE_PROJECT", id: proj.id, patch: { url: e.target.value } })}
                  placeholder="项目链接（可选）"
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <textarea
                  value={proj.description}
                  onChange={(e) => dispatch({ type: "UPDATE_PROJECT", id: proj.id, patch: { description: e.target.value } })}
                  placeholder="项目描述"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            ))}
            <AddButton label="添加项目" onClick={() => dispatch({ type: "ADD_PROJECT" })} />
          </div>
        </TabsContent>

        {/* 技能 */}
        <TabsContent value="skills">
          <div className="space-y-4">
            {data.skillGroups.map((sg) => (
              <div key={sg.id} className="relative rounded-xl border border-border p-3">
                <RemoveButton onClick={() => dispatch({ type: "REMOVE_SKILL_GROUP", id: sg.id })} />
                <input
                  value={sg.category}
                  onChange={(e) => dispatch({ type: "UPDATE_SKILL_GROUP_CATEGORY", id: sg.id, category: e.target.value })}
                  placeholder="技能分类（如：编程语言）"
                  className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 pr-8 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {sg.skills.map((sk, si) => (
                    <div key={`${sg.id}-${si}`} className="flex items-center gap-1">
                      <input
                        value={sk}
                        onChange={(e) => dispatch({ type: "UPDATE_SKILL", groupId: sg.id, index: si, value: e.target.value })}
                        placeholder="技能"
                        className="w-28 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "REMOVE_SKILL", groupId: sg.id, index: si })}
                        className="rounded-md p-0.5 text-muted-foreground hover:text-destructive"
                        title="删除技能"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "ADD_SKILL", groupId: sg.id })}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={13} /> 技能
                  </button>
                </div>
              </div>
            ))}
            <AddButton label="添加技能组" onClick={() => dispatch({ type: "ADD_SKILL_GROUP" })} />
          </div>
        </TabsContent>

        {/* 教育 */}
        <TabsContent value="education">
          <div className="space-y-4">
            {data.education.map((edu) => (
              <div key={edu.id} className="relative grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
                <RemoveButton onClick={() => dispatch({ type: "REMOVE_EDUCATION", id: edu.id })} />
                <input
                  value={edu.institution}
                  onChange={(e) => dispatch({ type: "UPDATE_EDUCATION", id: edu.id, patch: { institution: e.target.value } })}
                  placeholder="学校"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  value={edu.degree}
                  onChange={(e) => dispatch({ type: "UPDATE_EDUCATION", id: edu.id, patch: { degree: e.target.value } })}
                  placeholder="学位"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  value={edu.field}
                  onChange={(e) => dispatch({ type: "UPDATE_EDUCATION", id: edu.id, patch: { field: e.target.value } })}
                  placeholder="专业"
                  className="col-span-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  value={edu.startDate}
                  onChange={(e) => dispatch({ type: "UPDATE_EDUCATION", id: edu.id, patch: { startDate: e.target.value } })}
                  placeholder="开始时间"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  value={edu.endDate}
                  onChange={(e) => dispatch({ type: "UPDATE_EDUCATION", id: edu.id, patch: { endDate: e.target.value } })}
                  placeholder="结束时间"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            ))}
            <AddButton label="添加教育背景" onClick={() => dispatch({ type: "ADD_EDUCATION" })} />
          </div>
        </TabsContent>
      </Tabs>

      {/* 底部操作栏 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button size="lg" variant="ghost" onClick={() => router.push(`/intake/${data.id}`)}>
            <ArrowLeft size={15} />
            返回问答
          </Button>
          <Button size="lg" onClick={() => setConfirmOpen(true)}>
            确认无误
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>

      {/* 确认进入评估弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>档案信息确认无误？</DialogTitle>
            <DialogDescription>确认后将保存档案并进入逐条联网评估。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setConfirmOpen(false)}>
              继续编辑
            </Button>
            <Button size="lg" onClick={handleConfirmEvaluate}>
              是，进入评估
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tab 切换未保存提示弹窗 */}
      <Dialog open={pendingStep !== null} onOpenChange={(open) => !open && setPendingStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>有未保存更改</DialogTitle>
            <DialogDescription>切换分节将丢失当前未保存的修改，是否放弃？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setPendingStep(null)}>
              留下
            </Button>
            <Button
              size="lg"
              onClick={() => {
                if (pendingStep) dispatch({ type: "SWITCH_STEP", step: pendingStep });
                setPendingStep(null);
              }}
            >
              放弃并切换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 小组件 ──────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary"
    >
      <Plus size={15} />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
      title="删除"
    >
      <X size={16} />
    </button>
  );
}
