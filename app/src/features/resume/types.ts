export type ResumeKind = "master" | "variant";

export type ResumeSection =
  | "basics"
  | "education"
  | "experiences"
  | "projects"
  | "skills"
  | "certificates"
  | "awards";

export type ConfirmationStatus = "confirmed" | "needs_confirmation";

export type QualityFlag =
  | "missing_metric"
  | "too_generic"
  | "unsupported_claim"
  | "too_long"
  | "keyword_gap";

export type Link = {
  id: string;
  label: string;
  url: string;
};

export type TargetJob = {
  role?: string;
  industry?: string;
  jdText?: string;
  keywords?: string[];
};

export type Basics = {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  targetRole?: string;
  links: Link[];
};

export type Education = {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  rank?: string;
  courses?: string[];
  honors?: string[];
};

export type ResultEvidence = {
  text: string;
  metric?: string;
  confidence: ConfirmationStatus;
};

export type StarEvidence = {
  id: string;
  context?: string;
  task?: string;
  actions: string[];
  results: ResultEvidence[];
  skills: string[];
  scope?: string;
  reflection?: string;
  sourceText?: string;
};

export type ResumeBullet = {
  id: string;
  text: string;
  sourceEvidenceIds: string[];
  relevanceScore?: number;
  qualityFlags: QualityFlag[];
  status: "draft" | "confirmed" | "archived";
  polishCandidateId?: string;
  polishAppliedAt?: string;
};

export type Experience = {
  id: string;
  organization: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  evidence: StarEvidence[];
  bullets: ResumeBullet[];
};

export type Project = {
  id: string;
  name: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  techStack: string[];
  links: Link[];
  goal?: string;
  evidence: StarEvidence[];
  bullets: ResumeBullet[];
};

export type SkillGroup = {
  id: string;
  category:
    | "languages"
    | "frameworks"
    | "tools"
    | "soft_skills"
    | "human_languages";
  name: string;
  items: string[];
};

export type Certificate = {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
};

export type Award = {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  description?: string;
};

export type SummarySection = {
  headline?: string;
  bullets: ResumeBullet[];
};

export type TemplateSelection = {
  id: "ats" | "classic-cn" | "modern";
};

export type ResumeMetadata = {
  createdAt: string;
  updatedAt: string;
};

export type ResumeDocument = {
  schemaVersion: "resume-local-v1";
  id: string;
  kind: ResumeKind;
  title: string;
  target?: TargetJob;
  basics: Basics;
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  skills: SkillGroup[];
  certificates: Certificate[];
  awards: Award[];
  summary?: SummarySection;
  template: TemplateSelection;
  metadata: ResumeMetadata;
};

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  path: string;
};

export type ResumeRecord = {
  id: string;
  projectId: string;
  kind: ResumeKind;
  name: string;
  targetRole?: string;
  targetJd?: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
};

export type VersionRecord = {
  id: string;
  resumeId: string;
  label?: string;
  filePath: string;
  createdAt: string;
};

export type ExportFormat = "pdf" | "docx-ats" | "docx-visual" | "docx-zh-clean" | "json-resume";

export type ExportRecord = {
  id: string;
  resumeId: string;
  format: ExportFormat;
  filePath: string;
  createdAt: string;
};
