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
  // profiles 主表 Sprint 1 维持 blob 结构（与 profile/store.ts 一致，子表拆分留到 Sprint 6.3）；
  // 规范化子表的 FK 仅引用 profiles(id)，blob 表同样含 id 列，FK 合法。
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
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
// CREATE TABLE IF NOT EXISTS 不会给已存在的旧表补列，故对 Sprint 1-5 期间创建的库做 ALTER 补齐。
const SCHEMA_VERSION = 2;

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
