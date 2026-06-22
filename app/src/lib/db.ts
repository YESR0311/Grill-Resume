import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { getDatabasePath, getWorkspaceRoot } from "./workspace";

let cached: Database.Database | null = null;

const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    path TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    target_role TEXT,
    target_jd TEXT,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS resumes_project_id_idx ON resumes(project_id)`,
  `CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    label TEXT,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS versions_resume_id_idx ON versions(resume_id)`,
  `CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS exports_resume_id_idx ON exports(resume_id)`,
  `CREATE TABLE IF NOT EXISTS coach_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    queue_item_ids TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS coach_reports_project_resume_idx ON coach_reports(project_id, resume_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS coach_bullet_drafts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    report_id TEXT NOT NULL,
    finding_id TEXT NOT NULL,
    experience_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS coach_bullet_drafts_finding_status_idx ON coach_bullet_drafts(finding_id, status)`,
  `CREATE INDEX IF NOT EXISTS coach_bullet_drafts_resume_idx ON coach_bullet_drafts(project_id, resume_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS coach_bullet_drafts_finding_pending_idx ON coach_bullet_drafts(finding_id) WHERE status = 'pending'`,
  `CREATE TABLE IF NOT EXISTS model_configs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    encrypted_config_path TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  )`,

  // ─── 三步流规范化新表（Sprint 1，design §2.1，14 张） ───
  // 注意：简历项目经历表命名 resume_projects，避免与上方旧死代码表 projects 同名（同名会被静默跳过、FK 失效且不报错）。
  // profiles 主表 Phase 3（v3）已去掉 data 兼容 blob 列：基础字段直接落列，
  // 嵌套子实体（经历/项目/技能/教育）走规范化子表，intakeStatus 作小型结构化 JSON 列持久化。
  // 规范化子表的 FK 仅引用 profiles(id)。
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    intake_status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS experiences (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    organization TEXT,
    role TEXT,
    start_date TEXT,
    end_date TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS experiences_profile_id_idx ON experiences(profile_id)`,
  `CREATE TABLE IF NOT EXISTS experience_bullets (
    id TEXT PRIMARY KEY,
    experience_id TEXT NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    text TEXT,
    is_confirmed INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS experience_bullets_experience_id_idx ON experience_bullets(experience_id)`,
  `CREATE TABLE IF NOT EXISTS bullet_evidences (
    id TEXT PRIMARY KEY,
    bullet_id TEXT NOT NULL REFERENCES experience_bullets(id) ON DELETE CASCADE,
    type TEXT,
    content TEXT,
    note TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS bullet_evidences_bullet_id_idx ON bullet_evidences(bullet_id)`,
  `CREATE TABLE IF NOT EXISTS resume_projects (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    role TEXT,
    url TEXT,
    description TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS resume_projects_profile_id_idx ON resume_projects(profile_id)`,
  `CREATE TABLE IF NOT EXISTS skill_groups (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    category TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS skill_groups_profile_id_idx ON skill_groups(profile_id)`,
  `CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    skill_group_id TEXT NOT NULL REFERENCES skill_groups(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    name TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS skills_skill_group_id_idx ON skills(skill_group_id)`,
  `CREATE TABLE IF NOT EXISTS education (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    institution TEXT,
    degree TEXT,
    field TEXT,
    start_date TEXT,
    end_date TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS education_profile_id_idx ON education(profile_id)`,
  `CREATE TABLE IF NOT EXISTS intake_messages (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS intake_messages_profile_id_idx ON intake_messages(profile_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS evaluation_reports (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    overall_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS evaluation_reports_profile_id_idx ON evaluation_reports(profile_id)`,
  `CREATE TABLE IF NOT EXISTS evaluation_items (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES evaluation_reports(id) ON DELETE CASCADE,
    target_type TEXT,
    target_id TEXT,
    bullet_id TEXT,
    original_text TEXT,
    relevance REAL NOT NULL DEFAULT 5,
    specificity REAL NOT NULL DEFAULT 5,
    credibility REAL NOT NULL DEFAULT 5,
    recency REAL NOT NULL DEFAULT 5,
    expression REAL NOT NULL DEFAULT 5,
    scarcity REAL NOT NULL DEFAULT 5,
    overall_score REAL NOT NULL DEFAULT 5,
    search_evidence TEXT,
    suggestion TEXT,
    suggested_rewrite TEXT,
    status TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS evaluation_items_report_id_idx ON evaluation_items(report_id)`,
  // 同一 report 下同一 bullet 唯一，消除 DELETE+INSERT 竞态（Sprint 6 额外修复）。
  `CREATE UNIQUE INDEX IF NOT EXISTS evaluation_items_report_bullet_idx ON evaluation_items(report_id, bullet_id)`,
  `CREATE TABLE IF NOT EXISTS resume_drafts (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT,
    title TEXT,
    email TEXT,
    phone TEXT,
    summary TEXT,
    skills TEXT,
    template_id TEXT,
    style TEXT,
    status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS resume_drafts_profile_id_idx ON resume_drafts(profile_id)`,
  `CREATE TABLE IF NOT EXISTS draft_sections (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES resume_drafts(id) ON DELETE CASCADE,
    kind TEXT,
    idx INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    organization TEXT,
    role TEXT,
    start_date TEXT,
    end_date TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS draft_sections_draft_id_idx ON draft_sections(draft_id)`,
  `CREATE TABLE IF NOT EXISTS draft_bullets (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES draft_sections(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    text TEXT,
    source_exp_id TEXT,
    source_bullet_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS draft_bullets_section_id_idx ON draft_bullets(section_id)`,
];

// v2（Sprint 6）：resume_drafts 增列（skills/template_id/style），用于样式参数随草稿持久化。
// v3（Phase 3）：profiles 去掉 data 兼容 blob 列——基础字段落实列、intakeStatus 走 intake_status JSON 列，
//   嵌套子实体走规范化子表。DROP 前先把仅存在于 blob 的数据回填到列/子表，保证升级不丢数据。
// CREATE TABLE IF NOT EXISTS 不会给已存在的旧表补列，故对旧库做 ALTER/回填/DROP 迁移。
// v4（Sprint 2, 06-21-FE-R2）：evaluation_items UNIQUE(report_id, bullet_id) → UNIQUE(report_id, target_type, target_id)，
//   以支持按条目整体评估。旧 evaluation_reports + evaluation_items 全部清空（bullet 索引无法映射到条目粒度）。
const SCHEMA_VERSION = 4;

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

function sqliteSupportsDropColumn(db: Database.Database): boolean {
  const ver = (db.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v;
  const [maj, min] = ver.split(".").map((n) => parseInt(n, 10));
  return maj > 3 || (maj === 3 && min >= 35);
}

/**
 * v2 → v3 迁移：从 profiles.data blob 回填基础列 + intake_status + 规范化子表，再 DROP data 列。
 * 幂等：用 hasColumn(profiles,'data') 守卫；已无 data 列直接跳过。重跑安全。
 */
function migrateProfilesDropBlob(db: Database.Database): void {
  if (!tableExists(db, "profiles")) return;
  if (!hasColumn(db, "profiles", "data")) return; // 已迁移过，幂等跳过

  // 1) 确保基础列存在（旧库可能只有 data/created_at/updated_at）。
  for (const col of [
    "name TEXT NOT NULL DEFAULT ''",
    "title TEXT NOT NULL DEFAULT ''",
    "email TEXT NOT NULL DEFAULT ''",
    "phone TEXT NOT NULL DEFAULT ''",
    "location TEXT NOT NULL DEFAULT ''",
    "summary TEXT NOT NULL DEFAULT ''",
    "intake_status TEXT NOT NULL DEFAULT ''",
  ]) {
    const name = col.split(" ")[0];
    if (!hasColumn(db, "profiles", name)) {
      db.prepare(`ALTER TABLE profiles ADD COLUMN ${col}`).run();
    }
  }

  // 2) 回填：逐 profile 读 data blob，写基础列、intake_status，并在子表为空时回填子实体。
  const rows = db
    .prepare("SELECT id, data FROM profiles")
    .all() as { id: string; data: string | null }[];

  const setBase = db.prepare(
    `UPDATE profiles SET name=?, title=?, email=?, phone=?, location=?, summary=?, intake_status=? WHERE id=?`,
  );
  const insExp = db.prepare(
    `INSERT INTO experiences (id, profile_id, idx, organization, role, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insBullet = db.prepare(
    `INSERT INTO experience_bullets (id, experience_id, idx, text, is_confirmed) VALUES (?, ?, ?, ?, ?)`,
  );
  const insEvidence = db.prepare(
    `INSERT INTO bullet_evidences (id, bullet_id, type, content, note) VALUES (?, ?, ?, ?, ?)`,
  );
  const insProj = db.prepare(
    `INSERT INTO resume_projects (id, profile_id, idx, name, role, url, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insSg = db.prepare(`INSERT INTO skill_groups (id, profile_id, idx, category) VALUES (?, ?, ?, ?)`);
  const insSkill = db.prepare(`INSERT INTO skills (id, skill_group_id, idx, name) VALUES (?, ?, ?, ?)`);
  const insEdu = db.prepare(
    `INSERT INTO education (id, profile_id, idx, institution, degree, field, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const expCount = db.prepare("SELECT COUNT(*) AS n FROM experiences WHERE profile_id = ?");
  const projCount = db.prepare("SELECT COUNT(*) AS n FROM resume_projects WHERE profile_id = ?");
  const sgCount = db.prepare("SELECT COUNT(*) AS n FROM skill_groups WHERE profile_id = ?");
  const eduCount = db.prepare("SELECT COUNT(*) AS n FROM education WHERE profile_id = ?");

  let migCounter = 0;
  const genId = (): string => `mig_${Date.now().toString(36)}_${(migCounter++).toString(36)}`;

  for (const row of rows) {
    if (!row.data) continue;
    let blob: Record<string, unknown>;
    try {
      blob = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      continue; // 损坏 blob：跳过，不阻断迁移（其它 profile 仍迁移）
    }

    const str = (v: unknown): string => (typeof v === "string" ? v : "");
    const intakeStatus =
      blob.intakeStatus && typeof blob.intakeStatus === "object"
        ? JSON.stringify(blob.intakeStatus)
        : "";
    setBase.run(
      str(blob.name),
      str(blob.title),
      str(blob.email),
      str(blob.phone),
      str(blob.location),
      str(blob.summary),
      intakeStatus,
      row.id,
    );

    // 子表仅在为空时回填（Phase 2 已双写的库子表非空 → 不重复插）。
    const experiences = Array.isArray(blob.experiences) ? (blob.experiences as Record<string, unknown>[]) : [];
    if ((expCount.get(row.id) as { n: number }).n === 0 && experiences.length > 0) {
      experiences.forEach((exp, ei) => {
        const expId = str(exp.id) || genId();
        insExp.run(expId, row.id, ei, str(exp.organization), str(exp.role), str(exp.startDate), str(exp.endDate));
        const bullets = Array.isArray(exp.bullets) ? (exp.bullets as Record<string, unknown>[]) : [];
        bullets.forEach((b, bi) => {
          const bId = str(b.id) || genId();
          insBullet.run(bId, expId, bi, str(b.text), b.isConfirmed ? 1 : 0);
          const evidence = Array.isArray(b.evidence) ? (b.evidence as Record<string, unknown>[]) : [];
          evidence.forEach((ev) => {
            insEvidence.run(str(ev.id) || genId(), bId, str(ev.type) || "text", str(ev.content), str(ev.note));
          });
        });
      });
    }

    const projects = Array.isArray(blob.projects) ? (blob.projects as Record<string, unknown>[]) : [];
    if ((projCount.get(row.id) as { n: number }).n === 0 && projects.length > 0) {
      projects.forEach((p, i) => {
        insProj.run(str(p.id) || genId(), row.id, i, str(p.name), str(p.role), str(p.url), str(p.description));
      });
    }

    const skillGroups = Array.isArray(blob.skillGroups) ? (blob.skillGroups as Record<string, unknown>[]) : [];
    if ((sgCount.get(row.id) as { n: number }).n === 0 && skillGroups.length > 0) {
      skillGroups.forEach((sg, gi) => {
        const sgId = str(sg.id) || genId();
        insSg.run(sgId, row.id, gi, str(sg.category));
        const skills = Array.isArray(sg.skills) ? (sg.skills as unknown[]) : [];
        skills.forEach((name, si) => {
          if (typeof name === "string") insSkill.run(genId(), sgId, si, name);
        });
      });
    }

    const education = Array.isArray(blob.education) ? (blob.education as Record<string, unknown>[]) : [];
    if ((eduCount.get(row.id) as { n: number }).n === 0 && education.length > 0) {
      education.forEach((e, i) => {
        insEdu.run(
          str(e.id) || genId(),
          row.id,
          i,
          str(e.institution),
          str(e.degree),
          str(e.field),
          str(e.startDate),
          str(e.endDate),
        );
      });
    }
  }

  // 3) DROP data 列：SQLite 3.35+ 支持 DROP COLUMN，否则走 建新表→拷贝→改名。
  if (sqliteSupportsDropColumn(db)) {
    db.prepare("ALTER TABLE profiles DROP COLUMN data").run();
  } else {
    db.prepare(
      `CREATE TABLE profiles_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        intake_status TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ).run();
    db.prepare(
      `INSERT INTO profiles_new (id, name, title, email, phone, location, summary, intake_status, created_at, updated_at)
       SELECT id, name, title, email, phone, location, summary, intake_status, created_at, updated_at FROM profiles`,
    ).run();
    db.prepare("DROP TABLE profiles").run();
    db.prepare("ALTER TABLE profiles_new RENAME TO profiles").run();
  }
}

function applyForwardMigrations(db: Database.Database, fromVersion: number): void {
  // v1 → v2：补齐 resume_drafts 的样式列（仅对已存在的旧表生效）。
  if (fromVersion < 2 && tableExists(db, "resume_drafts")) {
    for (const col of ["skills TEXT", "template_id TEXT", "style TEXT"]) {
      const name = col.split(" ")[0];
      if (!hasColumn(db, "resume_drafts", name)) {
        db.prepare(`ALTER TABLE resume_drafts ADD COLUMN ${col}`).run();
      }
    }
  }
  // v2 → v3：profiles 去 blob（回填后 DROP data 列），幂等。
  if (fromVersion < 3) {
    migrateProfilesDropBlob(db);
  }
  // v3 → v4：evaluation_items UNIQUE(report_id, bullet_id) → UNIQUE(report_id, target_type, target_id)；
  // 旧评估数据全部清空（bullet 索引无法映射到条目粒度）。
  if (fromVersion < 4) {
    if (tableExists(db, "evaluation_items")) {
      db.prepare("DELETE FROM evaluation_items").run();
      db.prepare("DELETE FROM evaluation_reports").run();
      db.prepare("DROP INDEX IF EXISTS evaluation_items_report_bullet_idx").run();
      db.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS evaluation_items_report_target_idx ON evaluation_items(report_id, target_type, target_id)",
      ).run();
    }
  }
}

function applyMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const runMigrations = db.transaction((statements: readonly string[]) => {
    for (const sql of statements) {
      db.prepare(sql).run();
    }
  });
  runMigrations(SCHEMA_STATEMENTS);

  // schema 版本号：启动时检查并前向迁移。
  const current = db.pragma("user_version", { simple: true }) as number;
  if (current < SCHEMA_VERSION) {
    const forward = db.transaction((from: number) => applyForwardMigrations(db, from));
    forward(current);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
}

export function getDb(): Database.Database {
  if (cached) return cached;
  mkdirSync(getWorkspaceRoot(), { recursive: true });
  const file = getDatabasePath();
  const db = new Database(file);
  applyMigrations(db);
  cached = db;
  return db;
}

export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
}
