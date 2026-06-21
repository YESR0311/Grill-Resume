import "server-only";

import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createEmptyProfile, PersonProfileSchema, type PersonProfile } from "./types";

/**
 * 人物档案存储库（一等实体，SQLite）。
 *
 * Sprint 6.3/6.5 Phase 2：从单 blob 列拆为规范化子表（experiences/experience_bullets/
 * resume_projects/skill_groups/skills/education），读路径在 API 层重建嵌套对象。
 *
 * 双写策略（保留回滚形状）：
 * - 写：profiles.data blob（兼容/回滚） + 规范化子表（主存储）。
 * - 读：优先从规范化子表重建；子表为空时回落 blob（兼容 Phase 1 旧数据）。
 *
 * 物理表 resume_projects（避与旧死代码表 projects 同名）在重建时映射回逻辑属性
 * projects[]，前端组件无需感知表名（design §6.1）。
 */

// ─── 规范化写入 ────────────────────────────────────────────

function writeNormalized(profile: PersonProfile): void {
  const db = getDb();
  const tx = db.transaction(() => {
    // ON DELETE CASCADE：删 profiles 行会级联，但这里 profiles 行用 UPSERT 保留，
    // 故先手动清空各子表再重插（experiences 删除会级联 bullets/evidences）。
    db.prepare("DELETE FROM experiences WHERE profile_id = ?").run(profile.id);
    db.prepare("DELETE FROM resume_projects WHERE profile_id = ?").run(profile.id);
    db.prepare("DELETE FROM skill_groups WHERE profile_id = ?").run(profile.id);
    db.prepare("DELETE FROM education WHERE profile_id = ?").run(profile.id);

    const insExp = db.prepare(
      `INSERT INTO experiences (id, profile_id, idx, organization, role, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insBullet = db.prepare(
      `INSERT INTO experience_bullets (id, experience_id, idx, text, is_confirmed)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insEvidence = db.prepare(
      `INSERT INTO bullet_evidences (id, bullet_id, type, content, note) VALUES (?, ?, ?, ?, ?)`,
    );
    profile.experiences.forEach((exp, ei) => {
      insExp.run(exp.id, profile.id, ei, exp.organization, exp.role, exp.startDate, exp.endDate);
      exp.bullets.forEach((b, bi) => {
        insBullet.run(b.id, exp.id, bi, b.text, b.isConfirmed ? 1 : 0);
        b.evidence.forEach((ev) => {
          insEvidence.run(ev.id, b.id, ev.type, ev.content, ev.note);
        });
      });
    });

    const insProj = db.prepare(
      `INSERT INTO resume_projects (id, profile_id, idx, name, role, url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    profile.projects.forEach((p, i) => {
      insProj.run(p.id, profile.id, i, p.name, p.role, p.url, p.description);
    });

    const insSg = db.prepare(
      `INSERT INTO skill_groups (id, profile_id, idx, category) VALUES (?, ?, ?, ?)`,
    );
    const insSkill = db.prepare(
      `INSERT INTO skills (id, skill_group_id, idx, name) VALUES (?, ?, ?, ?)`,
    );
    profile.skillGroups.forEach((sg, gi) => {
      insSg.run(sg.id, profile.id, gi, sg.category);
      sg.skills.forEach((name, si) => {
        insSkill.run(nanoid(8), sg.id, si, name);
      });
    });

    const insEdu = db.prepare(
      `INSERT INTO education (id, profile_id, idx, institution, degree, field, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    profile.education.forEach((e, i) => {
      insEdu.run(e.id, profile.id, i, e.institution, e.degree, e.field, e.startDate, e.endDate);
    });
  });
  tx();
}

// ─── 规范化读取（重建嵌套对象，design §6.1） ───────────────

type ExpRow = { id: string; organization: string | null; role: string | null; start_date: string | null; end_date: string | null };
type BulletRow = { id: string; experience_id: string; text: string | null; is_confirmed: number };
type EvidenceRow = { id: string; bullet_id: string; type: string | null; content: string | null; note: string | null };
type ProjRow = { id: string; name: string | null; role: string | null; url: string | null; description: string | null };
type SgRow = { id: string; category: string | null };
type SkillRow = { skill_group_id: string; name: string | null };
type EduRow = { id: string; institution: string | null; degree: string | null; field: string | null; start_date: string | null; end_date: string | null };

function readNormalized(id: string): PersonProfile | null {
  const db = getDb();
  const meta = db
    .prepare("SELECT id, data, created_at, updated_at FROM profiles WHERE id = ?")
    .get(id) as { id: string; data: string; created_at: string; updated_at: string } | undefined;
  if (!meta) return null;

  const expRows = db
    .prepare("SELECT id, organization, role, start_date, end_date FROM experiences WHERE profile_id = ? ORDER BY idx, rowid")
    .all(id) as ExpRow[];

  // 子表为空 → 回落 blob（兼容 Phase 1 旧数据）。
  if (expRows.length === 0) {
    const blob = PersonProfileSchema.safeParse(JSON.parse(meta.data));
    if (blob.success && (blob.data.experiences.length > 0 || blob.data.name || blob.data.projects.length > 0)) {
      return blob.data;
    }
    // blob 也为空：返回 blob（可能是全新空档案）。
    return blob.success ? blob.data : null;
  }

  const bulletRows = db
    .prepare("SELECT id, experience_id, text, is_confirmed FROM experience_bullets WHERE experience_id IN (SELECT id FROM experiences WHERE profile_id = ?) ORDER BY idx, rowid")
    .all(id) as BulletRow[];
  const evidenceRows = db
    .prepare("SELECT id, bullet_id, type, content, note FROM bullet_evidences WHERE bullet_id IN (SELECT id FROM experience_bullets WHERE experience_id IN (SELECT id FROM experiences WHERE profile_id = ?))")
    .all(id) as EvidenceRow[];
  const projRows = db
    .prepare("SELECT id, name, role, url, description FROM resume_projects WHERE profile_id = ? ORDER BY idx, rowid")
    .all(id) as ProjRow[];
  const sgRows = db
    .prepare("SELECT id, category FROM skill_groups WHERE profile_id = ? ORDER BY idx, rowid")
    .all(id) as SgRow[];
  const skillRows = db
    .prepare("SELECT skill_group_id, name FROM skills WHERE skill_group_id IN (SELECT id FROM skill_groups WHERE profile_id = ?) ORDER BY idx, rowid")
    .all(id) as SkillRow[];
  const eduRows = db
    .prepare("SELECT id, institution, degree, field, start_date, end_date FROM education WHERE profile_id = ? ORDER BY idx, rowid")
    .all(id) as EduRow[];

  // blob 仍是基础字段（name/title/email/.../intakeStatus）的来源。
  const blob = PersonProfileSchema.safeParse(JSON.parse(meta.data));
  const base = blob.success ? blob.data : createEmptyProfile({ id });

  const evidenceByBullet = new Map<string, EvidenceRow[]>();
  for (const ev of evidenceRows) {
    const list = evidenceByBullet.get(ev.bullet_id) ?? [];
    list.push(ev);
    evidenceByBullet.set(ev.bullet_id, list);
  }
  const bulletsByExp = new Map<string, BulletRow[]>();
  for (const b of bulletRows) {
    const list = bulletsByExp.get(b.experience_id) ?? [];
    list.push(b);
    bulletsByExp.set(b.experience_id, list);
  }
  const skillsBySg = new Map<string, string[]>();
  for (const s of skillRows) {
    const list = skillsBySg.get(s.skill_group_id) ?? [];
    if (s.name) list.push(s.name);
    skillsBySg.set(s.skill_group_id, list);
  }

  const rebuilt: PersonProfile = {
    ...base,
    id,
    createdAt: meta.created_at || base.createdAt,
    updatedAt: meta.updated_at || base.updatedAt,
    experiences: expRows.map((e) => ({
      id: e.id,
      organization: e.organization ?? "",
      role: e.role ?? "",
      startDate: e.start_date ?? "",
      endDate: e.end_date ?? "",
      bullets: (bulletsByExp.get(e.id) ?? []).map((b) => ({
        id: b.id,
        text: b.text ?? "",
        isConfirmed: b.is_confirmed === 1,
        evidence: (evidenceByBullet.get(b.id) ?? []).map((ev) => ({
          id: ev.id,
          type: ev.type ?? "text",
          content: ev.content ?? "",
          note: ev.note ?? "",
        })),
      })),
    })),
    projects: projRows.map((p) => ({
      id: p.id,
      name: p.name ?? "",
      role: p.role ?? "",
      url: p.url ?? "",
      description: p.description ?? "",
      evidence: [],
    })),
    skillGroups: sgRows.map((sg) => ({
      id: sg.id,
      category: sg.category ?? "",
      skills: skillsBySg.get(sg.id) ?? [],
    })),
    education: eduRows.map((e) => ({
      id: e.id,
      institution: e.institution ?? "",
      degree: e.degree ?? "",
      field: e.field ?? "",
      startDate: e.start_date ?? "",
      endDate: e.end_date ?? "",
    })),
  };

  const parsed = PersonProfileSchema.safeParse(rebuilt);
  return parsed.success ? parsed.data : rebuilt;
}

// ─── 公共 API ──────────────────────────────────────────────

export function getProfile(id: string): PersonProfile | null {
  return readNormalized(id);
}

export function listProfiles(): PersonProfile[] {
  const ids = getDb()
    .prepare("SELECT id FROM profiles ORDER BY updated_at DESC")
    .all() as { id: string }[];
  return ids
    .map((r) => readNormalized(r.id))
    .filter((p): p is PersonProfile => p !== null);
}

export function saveProfile(profile: PersonProfile): PersonProfile {
  const validated = PersonProfileSchema.parse(profile);
  const now = new Date().toISOString();
  const next = { ...validated, updatedAt: now };
  const data = JSON.stringify(next);

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO profiles (id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).run(validated.id, data, validated.createdAt, now);
    writeNormalized(next);
  });
  tx();

  return next;
}

export function deleteProfile(id: string): void {
  // profiles 行删除经 FK CASCADE 级联清空所有子表。
  getDb().prepare("DELETE FROM profiles WHERE id = ?").run(id);
}

export function createProfile(overrides?: Partial<PersonProfile>): PersonProfile {
  const profile = createEmptyProfile({ id: nanoid(10), ...overrides });
  return saveProfile(profile);
}
