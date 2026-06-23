import { z } from "zod";

// ─── 证据（纯文字，无需文件） ─────────────────────────────
export const EvidenceSchema = z.object({
  id: z.string(),
  type: z.string().default("text"), // text / reference
  content: z.string(),
  note: z.string().default(""),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ─── 人物档案 ─────────────────────────────────────────────
export const PersonProfileSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // 基础信息
  name: z.string().default(""),
  title: z.string().default(""),       // 目标岗位
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  summary: z.string().default(""),     // 个人简介

  // 经历
  experiences: z
    .array(
      z.object({
        id: z.string(),
        organization: z.string().default(""),
        role: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
        bullets: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            evidence: z.array(EvidenceSchema).default([]),
            isConfirmed: z.boolean().default(false),
          })
        ).default([]),
      })
    )
    .default([]),

  // 项目
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        role: z.string().default(""),
        url: z.string().default(""),
        description: z.string().default(""),
        evidence: z.array(EvidenceSchema).default([]),
      })
    )
    .default([]),

  // 技能
  skillGroups: z
    .array(
      z.object({
        id: z.string(),
        category: z.string(),
        skills: z.array(z.string()).default([]),
      })
    )
    .default([]),

  // 教育
  education: z
    .array(
      z.object({
        id: z.string(),
        institution: z.string().default(""),
        degree: z.string().default(""),
        field: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
      })
    )
    .default([]),

  // 问答进度
  intakeStatus: z
    .object({
      phase: z.enum(["basics", "experience", "project", "skill", "education", "evidence", "ready"]),
      coveredDimensions: z.array(z.string()).default([]),
      // 半亮维度：解析返回 partial=true（信息不足）。仍推进到下一阶段，但 IntakeProgress 半亮。
      partialDimensions: z.array(z.string()).default([]),
      totalRounds: z.number().default(0),
    })
    .default({ phase: "basics", coveredDimensions: [], partialDimensions: [], totalRounds: 0 }),
});
export type PersonProfile = z.infer<typeof PersonProfileSchema>;

// ─── 新建空白档案 ──────────────────────────────────────────
export function createEmptyProfile(overrides?: Partial<PersonProfile>): PersonProfile {
  const now = new Date().toISOString();
  return PersonProfileSchema.parse({
    id: overrides?.id ?? "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}