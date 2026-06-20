"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowRight } from "lucide-react";
import type { PersonProfile } from "@/features/profile/types";
import { saveProfileAction } from "@/app/profile/[id]/actions";

/**
 * 档案编辑页——工作台编辑器样式。
 * 打开即展示档案各字段，用户可自主自定义修改。
 * 修改完成后跳转到评估页。
 */
export function ProfileEditor({
  profile: initial,
}: {
  profile: PersonProfile;
}) {
  const [profile, setProfile] = useState<PersonProfile>(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const update = useCallback(
    <K extends keyof PersonProfile>(key: K, value: PersonProfile[K]) => {
      setProfile((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfileAction(JSON.stringify(profile));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* 工具栏 */}
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-semibold">人物档案编辑</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            onClick={() => router.push(`/evaluate/${profile.id}`)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            进入评估
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* 基础信息 */}
        <Section title="基础信息">
          <div className="grid grid-cols-2 gap-4">
            <Field label="姓名" value={profile.name} onChange={(v) => update("name", v)} />
            <Field label="目标岗位" value={profile.title} onChange={(v) => update("title", v)} />
            <Field label="邮箱" value={profile.email} onChange={(v) => update("email", v)} />
            <Field label="电话" value={profile.phone} onChange={(v) => update("phone", v)} />
            <Field label="地点" value={profile.location} onChange={(v) => update("location", v)} className="col-span-2" />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">个人简介</label>
            <textarea
              value={profile.summary}
              onChange={(e) => update("summary", e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </Section>

        {/* 经历 */}
        <Section title="工作经历">
          {profile.experiences.map((exp, idx) => (
            <div key={exp.id} className="rounded-xl border border-border p-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={exp.organization}
                  onChange={(e) => {
                    const next = [...profile.experiences];
                    next[idx] = { ...next[idx], organization: e.target.value };
                    update("experiences", next);
                  }}
                  placeholder="公司/组织"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  value={exp.role}
                  onChange={(e) => {
                    const next = [...profile.experiences];
                    next[idx] = { ...next[idx], role: e.target.value };
                    update("experiences", next);
                  }}
                  placeholder="职位"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div className="mt-2 flex gap-4">
                <input
                  value={exp.startDate}
                  onChange={(e) => {
                    const next = [...profile.experiences];
                    next[idx] = { ...next[idx], startDate: e.target.value };
                    update("experiences", next);
                  }}
                  placeholder="开始时间"
                  className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  value={exp.endDate}
                  onChange={(e) => {
                    const next = [...profile.experiences];
                    next[idx] = { ...next[idx], endDate: e.target.value };
                    update("experiences", next);
                  }}
                  placeholder="结束时间"
                  className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              {exp.bullets.map((b, bi) => (
                <div key={b.id} className="mt-2 flex items-start gap-2">
                  <span className="mt-2 text-xs text-muted-foreground">•</span>
                  <input
                    value={b.text}
                    onChange={(e) => {
                      const next = [...profile.experiences];
                      next[idx].bullets[bi] = { ...next[idx].bullets[bi], text: e.target.value };
                      update("experiences", next);
                    }}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          ))}
        </Section>

        {/* 技能组 */}
        <Section title="技能组">
          {profile.skillGroups.map((sg, idx) => (
            <div key={sg.id} className="rounded-xl border border-border p-3">
              <input
                value={sg.category}
                onChange={(e) => {
                  const next = [...profile.skillGroups];
                  next[idx] = { ...next[idx], category: e.target.value };
                  update("skillGroups", next);
                }}
                className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {sg.skills.map((sk, si) => (
                  <input
                    key={`${sg.id}-${si}`}
                    value={sk}
                    onChange={(e) => {
                      const next = [...profile.skillGroups];
                      next[idx].skills[si] = e.target.value;
                      update("skillGroups", next);
                    }}
                    className="w-28 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                  />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* 教育 */}
        <Section title="教育背景">
          {profile.education.map((edu, idx) => (
            <div key={edu.id} className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3">
              <input value={edu.institution} onChange={(e) => {
                const next = [...profile.education];
                next[idx] = { ...next[idx], institution: e.target.value };
                update("education", next);
              }} placeholder="学校" className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
              <input value={edu.degree} onChange={(e) => {
                const next = [...profile.education];
                next[idx] = { ...next[idx], degree: e.target.value };
                update("education", next);
              }} placeholder="学位" className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

// ─── 小组件 ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

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