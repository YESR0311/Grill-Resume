import { z } from "zod";
import { nanoid } from "nanoid";

/**
 * 简历草稿——润色产出，DOCX 导出的源。
 * 综合 PersonProfile + EvaluationReport 两个来源生成。
 */

export const ResumeBulletSchema = z.object({
  text: z.string(),
  sourceExpId: z.string().optional(),   // 关联的经历 ID
  sourceBulletId: z.string().optional(), // 关联的原要点 ID
  isConfirmed: z.boolean().default(false),
});

export const ResumeSectionSchema = z.object({
  title: z.string().default(""),
  items: z.array(
    z.object({
      id: z.string().default(() => nanoid(8)),
      organization: z.string().default(""),
      role: z.string().default(""),
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      bullets: z.array(ResumeBulletSchema).default([]),
    }),
  ).default([]),
});

export const ResumeDraftSchema = z.object({
  profileId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // 简历正文
  name: z.string().default(""),
  title: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  summary: z.string().default(""),

  workExperience: ResumeSectionSchema.default({ title: "工作经历", items: [] }),
  projects: ResumeSectionSchema.default({ title:  "项目经历", items: [] }),
  education: ResumeSectionSchema.default({ title: "教育背景", items: [] }),
  skills: z.array(z.string()).default([]),

  // 状态
  status: z.enum(["draft", "confirmed"]).default("draft"),
});
export type ResumeDraft = z.infer<typeof ResumeDraftSchema>;
export type ResumeBullet = z.infer<typeof ResumeBulletSchema>;
