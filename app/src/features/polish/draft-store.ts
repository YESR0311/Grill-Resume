import "server-only";

import { getDb } from "@/lib/db";
import { ResumeDraftSchema, ResumeStyleSchema, type ResumeDraft } from "./types";

/**
 * ResumeDraft 存储（Sprint 6.3 Phase 2：SQLite 规范化表）。
 *
 * 主存储：resume_drafts + draft_sections + draft_bullets。
 * 每个 profile 一份草稿，draftId 用稳定值 `${profileId}-draft`，
 * Route Handler 按 draftId 读取（design §4.3）。
 * 样式参数（templateId/style/skills）随草稿 JSON 列存储，正文 section/bullet 入规范化表。
 */

function draftIdFor(profileId: string): string {
  return `${profileId}-draft`;
}

type DraftRow = {
  id: string;
  profile_id: string;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
  skills: string | null;
  template_id: string | null;
  style: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type SectionRow = {
  id: string;
  kind: string | null;
  idx: number;
  title: string | null;
  organization: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
};

type BulletRow = {
  section_id: string;
  text: string | null;
  source_exp_id: string | null;
  source_bullet_id: string | null;
};

function rowToDraft(row: DraftRow): ResumeDraft {
  const db = getDb();
  const sectionRows = db
    .prepare(
      `SELECT id, kind, idx, title, organization, role, start_date, end_date
       FROM draft_sections WHERE draft_id = ? ORDER BY idx, rowid`,
    )
    .all(row.id) as SectionRow[];
  const bulletRows = db
    .prepare(
      `SELECT section_id, text, source_exp_id, source_bullet_id
       FROM draft_bullets WHERE section_id IN (SELECT id FROM draft_sections WHERE draft_id = ?)
       ORDER BY idx, rowid`,
    )
    .all(row.id) as BulletRow[];

  const bulletsBySection = new Map<string, BulletRow[]>();
  for (const b of bulletRows) {
    const list = bulletsBySection.get(b.section_id) ?? [];
    list.push(b);
    bulletsBySection.set(b.section_id, list);
  }

  const sectionFor = (kind: string) => {
    const rows = sectionRows.filter((s) => s.kind === kind);
    return {
      title: rows[0]?.title ?? "",
      items: rows.map((s) => ({
        id: s.id,
        organization: s.organization ?? "",
        role: s.role ?? "",
        startDate: s.start_date ?? "",
        endDate: s.end_date ?? "",
        bullets: (bulletsBySection.get(s.id) ?? []).map((b) => ({
          text: b.text ?? "",
          sourceExpId: b.source_exp_id ?? undefined,
          sourceBulletId: b.source_bullet_id ?? undefined,
          isConfirmed: false,
        })),
      })),
    };
  };

  const style = row.style ? safeJson(row.style) : undefined;
  const skills = row.skills ? (safeJson<string[]>(row.skills) ?? []) : [];

  const draft = {
    profileId: row.profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name ?? "",
    title: row.title ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    summary: row.summary ?? "",
    workExperience: sectionFor("workExperience"),
    projects: sectionFor("projects"),
    education: sectionFor("education"),
    skills,
    templateId: row.template_id ?? undefined,
    style: style ?? ResumeStyleSchema.parse({}),
    status: (row.status as "draft" | "confirmed") ?? "draft",
  };

  const parsed = ResumeDraftSchema.safeParse(draft);
  return parsed.success ? parsed.data : ResumeDraftSchema.parse({ ...draft, style: ResumeStyleSchema.parse({}) });
}

function safeJson<T = unknown>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function getResumeDraft(profileId: string): Promise<ResumeDraft | null> {
  return getResumeDraftById(draftIdFor(profileId));
}

export async function getResumeDraftById(draftId: string): Promise<ResumeDraft | null> {
  const row = getDb()
    .prepare(
      `SELECT id, profile_id, name, title, email, phone, summary, skills, template_id, style, status, created_at, updated_at
       FROM resume_drafts WHERE id = ?`,
    )
    .get(draftId) as DraftRow | undefined;
  if (!row) return null;
  return rowToDraft(row);
}

export async function saveResumeDraft(draft: ResumeDraft): Promise<ResumeDraft> {
  const validated = ResumeDraftSchema.parse(draft);
  const draftId = draftIdFor(validated.profileId);
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare("SELECT created_at FROM resume_drafts WHERE id = ?").get(draftId) as
    | { created_at: string }
    | undefined;
  const createdAt = existing?.created_at ?? validated.createdAt ?? now;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO resume_drafts
         (id, profile_id, name, title, email, phone, summary, skills, template_id, style, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, title = excluded.title, email = excluded.email,
         phone = excluded.phone, summary = excluded.summary, skills = excluded.skills,
         template_id = excluded.template_id, style = excluded.style, status = excluded.status,
         updated_at = excluded.updated_at`,
    ).run(
      draftId,
      validated.profileId,
      validated.name,
      validated.title,
      validated.email,
      validated.phone,
      validated.summary,
      JSON.stringify(validated.skills),
      validated.templateId,
      JSON.stringify(validated.style),
      validated.status,
      createdAt,
      now,
    );

    // 重建 section/bullet 规范化表（删旧重插，section 删除级联 bullets）。
    db.prepare("DELETE FROM draft_sections WHERE draft_id = ?").run(draftId);

    const insSection = db.prepare(
      `INSERT INTO draft_sections (id, draft_id, kind, idx, title, organization, role, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insBullet = db.prepare(
      `INSERT INTO draft_bullets (id, section_id, idx, text, source_exp_id, source_bullet_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let sectionIdx = 0;
    const writeSection = (
      kind: "workExperience" | "projects" | "education",
      section: ResumeDraft["workExperience"],
    ) => {
      section.items.forEach((item) => {
        const sectionId = item.id || `${draftId}-${kind}-${sectionIdx}`;
        insSection.run(
          sectionId,
          draftId,
          kind,
          sectionIdx,
          section.title,
          item.organization,
          item.role,
          item.startDate,
          item.endDate,
        );
        item.bullets.forEach((b, bi) => {
          insBullet.run(
            `${sectionId}-b${bi}`,
            sectionId,
            bi,
            b.text,
            b.sourceExpId ?? null,
            b.sourceBulletId ?? null,
          );
        });
        sectionIdx += 1;
      });
    };

    writeSection("workExperience", validated.workExperience);
    writeSection("projects", validated.projects);
    writeSection("education", validated.education);
  });
  tx();

  return { ...validated, createdAt, updatedAt: now };
}

export async function deleteResumeDraft(profileId: string): Promise<void> {
  // draft 行删除经 FK CASCADE 级联清空 sections/bullets。
  getDb().prepare("DELETE FROM resume_drafts WHERE id = ?").run(draftIdFor(profileId));
}
