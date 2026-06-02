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
];

function applyMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const runMigrations = db.transaction((statements: readonly string[]) => {
    for (const sql of statements) {
      db.prepare(sql).run();
    }
  });
  runMigrations(SCHEMA_STATEMENTS);
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
