import { z } from "zod";

const linkSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string(),
});

const resultEvidenceSchema = z.object({
  text: z.string(),
  metric: z.string().optional(),
  confidence: z.enum(["confirmed", "needs_confirmation"]),
});

const starEvidenceSchema = z.object({
  id: z.string(),
  context: z.string().optional(),
  task: z.string().optional(),
  actions: z.array(z.string()),
  results: z.array(resultEvidenceSchema),
  skills: z.array(z.string()),
  scope: z.string().optional(),
  reflection: z.string().optional(),
  sourceText: z.string().optional(),
});

const resumeBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceEvidenceIds: z.array(z.string()),
  relevanceScore: z.number().optional(),
  qualityFlags: z.array(
    z.enum([
      "missing_metric",
      "too_generic",
      "unsupported_claim",
      "too_long",
      "keyword_gap",
    ]),
  ),
  status: z.enum(["draft", "confirmed", "archived"]),
  polishCandidateId: z.string().optional(),
  polishAppliedAt: z.string().optional(),
});

const experienceSchema = z.object({
  id: z.string(),
  organization: z.string(),
  role: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  evidence: z.array(starEvidenceSchema),
  bullets: z.array(resumeBulletSchema),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  techStack: z.array(z.string()),
  links: z.array(linkSchema),
  goal: z.string().optional(),
  evidence: z.array(starEvidenceSchema),
  bullets: z.array(resumeBulletSchema),
});

export const resumeDocumentSchema = z.object({
  schemaVersion: z.literal("resume-local-v1"),
  id: z.string(),
  kind: z.enum(["master", "variant"]),
  title: z.string(),
  target: z
    .object({
      role: z.string().optional(),
      industry: z.string().optional(),
      jdText: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
  basics: z.object({
    name: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    city: z.string().optional(),
    targetRole: z.string().optional(),
    links: z.array(linkSchema),
  }),
  education: z.array(
    z.object({
      id: z.string(),
      school: z.string(),
      degree: z.string(),
      major: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      gpa: z.string().optional(),
      rank: z.string().optional(),
      courses: z.array(z.string()).optional(),
      honors: z.array(z.string()).optional(),
    }),
  ),
  experiences: z.array(experienceSchema),
  projects: z.array(projectSchema),
  skills: z.array(
    z.object({
      id: z.string(),
      category: z.enum([
        "languages",
        "frameworks",
        "tools",
        "soft_skills",
        "human_languages",
      ]),
      name: z.string(),
      items: z.array(z.string()),
    }),
  ),
  certificates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      issuer: z.string().optional(),
      date: z.string().optional(),
    }),
  ),
  awards: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      issuer: z.string().optional(),
      date: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  summary: z
    .object({
      headline: z.string().optional(),
      bullets: z.array(resumeBulletSchema),
    })
    .optional(),
  template: z.object({
    id: z.enum(["ats", "classic-cn", "modern"]),
  }),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});
