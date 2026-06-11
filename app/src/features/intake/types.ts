import { z } from "zod";

export const INTAKE_CATEGORIES = ["education", "internship", "project", "competition", "skill"] as const;

export const intakeCategorySchema = z.enum(INTAKE_CATEGORIES);

export type IntakeCategory = z.infer<typeof intakeCategorySchema>;

export const intakeQuestionSchema = z.object({
  id: z.string(),
  category: intakeCategorySchema,
  prompt: z.string(),
  hint: z.string().optional(),
  repeatable: z.boolean(),
});

export type IntakeQuestion = z.infer<typeof intakeQuestionSchema>;

export const intakeAnswerSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  category: intakeCategorySchema,
  answerText: z.string(),
  createdAt: z.string(),
});

export type IntakeAnswer = z.infer<typeof intakeAnswerSchema>;

export const INTAKE_SESSION_STATUSES = ["collecting", "consolidating", "review", "applied"] as const;

export const intakeSessionStatusSchema = z.enum(INTAKE_SESSION_STATUSES);

export type IntakeSessionStatus = z.infer<typeof intakeSessionStatusSchema>;

export const intakeInterviewSessionSchema = z.object({
  schemaVersion: z.literal("intake-interview-v1"),
  id: z.string(),
  projectId: z.string(),
  resumeId: z.string(),
  status: intakeSessionStatusSchema,
  answers: z.array(intakeAnswerSchema),
  skippedCategories: z.array(intakeCategorySchema),
  candidateId: z.string().optional(),
  appliedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IntakeInterviewSession = z.infer<typeof intakeInterviewSessionSchema>;
