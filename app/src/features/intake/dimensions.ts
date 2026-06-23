/**
 * intake-v2 6 阶段索引。
 * - 对话阶段（INTAKE_DIMENSIONS）：与 profile.intakeStatus.phase 取值集合一致。
 * - 解析结果合并函数（mergeByDimension）：把一次解析结果并入已有 profile。
 * - parseResultByDimension 映射：每个阶段对应一个 schema + parsePrompt。
 */
import { ParseBasicsResultSchema } from "./schemas/parse-basics";
import { ParseExperienceResultSchema } from "./schemas/parse-experience";
import { ParseProjectResultSchema } from "./schemas/parse-project";
import { ParseSkillResultSchema } from "./schemas/parse-skill";
import { ParseEducationResultSchema } from "./schemas/parse-education";
import { ParseEvidenceResultSchema } from "./schemas/parse-evidence";
import { nanoid } from "nanoid";
import type { z } from "zod";
import type { PersonProfile } from "@/features/profile/types";

/** 6 阶段 + 1 个 ready 终态。 */
export const INTAKE_DIMENSIONS = [
  "basics",
  "experience",
  "project",
  "skill",
  "education",
  "evidence",
] as const;
export type IntakeDimension = (typeof INTAKE_DIMENSIONS)[number];

/** 阶段显示名（中文） */
export const DIMENSION_LABEL: Record<IntakeDimension, string> = {
  basics: "基本信息",
  experience: "工作经历",
  project: "项目经历",
  skill: "技能",
  education: "教育背景",
  evidence: "补充证据",
};

/** 各阶段开场白（client + server 共用；server 端 engine.buildPhaseOpening 取同源文案）。 */
export const DIMENSION_OPENING: Record<IntakeDimension, string> = {
  basics: "你好！我是你的简历顾问。我们先从基本信息聊起——方便告诉我你的名字和想投递的目标岗位吗？",
  experience: "好的，接下来聊聊你的工作经历。从最近的一份开始就行——在哪家公司、做什么角色、大概多久？",
  project: "我们来聊聊项目经历。可以是公司里的项目，也可以是个人作品、开源项目。最近做过什么有意思的项目吗？",
  skill: "接下来聊聊你的技能。平时常用哪些技术、工具或框架？也可以说说软技能。",
  education: "聊聊你的教育背景吧——读的什么学校、什么专业、什么学位？",
  evidence: "最后，有没有一些锦上添花的内容？比如证书、开源贡献、获奖、技术博客、作品集等。有什么说什么，没有也完全没关系。",
};

/** 下一阶段映射（最后阶段后跳 ready） */
export const NEXT_DIMENSION: Record<IntakeDimension, IntakeDimension | "ready"> = {
  basics: "experience",
  experience: "project",
  project: "skill",
  skill: "education",
  education: "evidence",
  evidence: "ready",
};

/** 解析结果 zod schema 表（按阶段） */
export const PARSE_SCHEMA_BY_DIMENSION = {
  basics: ParseBasicsResultSchema,
  experience: ParseExperienceResultSchema,
  project: ParseProjectResultSchema,
  skill: ParseSkillResultSchema,
  education: ParseEducationResultSchema,
  evidence: ParseEvidenceResultSchema,
} as const;

export type ParseResultByDimension = {
  [K in IntakeDimension]: z.infer<(typeof PARSE_SCHEMA_BY_DIMENSION)[K]>;
}[IntakeDimension];

/** 6 阶段解析对话 prompt 文件名（不含 .md） */
export const CHAT_PROMPT_BY_DIMENSION: Record<IntakeDimension, string> = {
  basics: "chat-basics",
  experience: "chat-experience",
  project: "chat-project",
  skill: "chat-skill",
  education: "chat-education",
  evidence: "chat-evidence",
};

/** 6 阶段解析 prompt 文件名（不含 .md） */
export const PARSE_PROMPT_BY_DIMENSION: Record<IntakeDimension, string> = {
  basics: "parse-basics",
  experience: "parse-experience",
  project: "parse-project",
  skill: "parse-skill",
  education: "parse-education",
  evidence: "parse-evidence",
};

/**
 * 把一次解析结果并入已有 profile（不破坏其它阶段数据）。
 * 设计原则：
 * - 解析返回 `empty` 时不动该阶段数据（让用户后续补充）。
 * - 解析返回 `partial` 时，覆盖更新（最新的对话可能比旧的更准），并把该阶段加入 partialDimensions（半亮）。
 * - 解析返回 `full` 时，覆盖更新，并把该阶段加入 coveredDimensions。
 */
export function applyDimensionResult(
  profile: PersonProfile,
  dimension: IntakeDimension,
  result: ParseResultByDimension,
): PersonProfile {
  const phase = profile.intakeStatus.phase;
  const next = structuredClone(profile);

  switch (dimension) {
    case "basics": {
      const d = (result as { data: { name: string | null; title: string | null; email: string | null; phone: string | null; location: string | null } }).data;
      if (d.name) next.name = d.name;
      if (d.title) next.title = d.title;
      if (d.email) next.email = d.email;
      if (d.phone) next.phone = d.phone;
      if (d.location) next.location = d.location;
      break;
    }
    case "experience": {
      const exps = (result as { data: { experiences: { organization: string; role: string; startDate: string; endDate: string; bullets: string[] }[] } }).data.experiences;
      if (exps.length > 0) {
        next.experiences = exps.map((e) => ({
          id: nanoid(8),
          organization: e.organization,
          role: e.role || "",
          startDate: e.startDate || "",
          endDate: e.endDate || "",
          bullets: e.bullets.map((b) => ({
            id: nanoid(8),
            text: b,
            isConfirmed: false,
            evidence: [],
          })),
        }));
      }
      break;
    }
    case "project": {
      const projs = (result as { data: { projects: { name: string; role: string; description: string; evidence: string[] }[] } }).data.projects;
      if (projs.length > 0) {
        next.projects = projs.map((p) => ({
          id: nanoid(8),
          name: p.name,
          role: p.role || "",
          url: "",
          description: p.description || "",
          evidence: p.evidence.map((e) => ({ id: nanoid(8), type: "text", content: e, note: "" })),
        }));
      }
      break;
    }
    case "skill": {
      const groups = (result as { data: { skillGroups: { category: string; skills: string[] }[] } }).data.skillGroups;
      if (groups.length > 0) {
        next.skillGroups = groups.map((g) => ({
          id: nanoid(8),
          category: g.category || "通用",
          skills: g.skills,
        }));
      }
      break;
    }
    case "education": {
      const edus = (result as { data: { education: { institution: string; degree: string; field: string; startDate: string; endDate: string }[] } }).data.education;
      if (edus.length > 0) {
        next.education = edus.map((e) => ({
          id: nanoid(8),
          institution: e.institution,
          degree: e.degree || "",
          field: e.field || "",
          startDate: e.startDate || "",
          endDate: e.endDate || "",
        }));
      }
      break;
    }
    case "evidence": {
      const evs = (result as { data: { evidence: { type: "certificate" | "open-source" | "award" | "blog" | "portfolio" | "patent" | "talk" | "other"; content: string; note: string }[] } }).data.evidence;
      // evidence 合并：追加到第一段 experience 的第一条 bullet 的 evidence 数组。
      // 设计取舍：profile schema 无顶层 evidence[]，故挂到 experience.bullets[].evidence。
      // 后续 polish flow 会把这些 evidence 重新分配到合适的 bullet/project。
      if (evs.length > 0 && next.experiences.length > 0) {
        const firstExp = next.experiences[0];
        if (firstExp.bullets.length === 0) {
          firstExp.bullets.push({ id: nanoid(8), text: "(补充证据)", isConfirmed: false, evidence: [] });
        }
        firstExp.bullets[0].evidence.push(
          ...evs.map((e) => ({ id: nanoid(8), type: e.type, content: e.content, note: e.note })),
        );
      } else if (evs.length > 0) {
        // 没有 experience 时，evidence 暂存到 summary 备注（兜底，避免丢数据）。
        next.summary = (next.summary || "") + "\n\n[补充证据]\n" + evs.map((e) => `- (${e.type}) ${e.content}${e.note ? " — " + e.note : ""}`).join("\n");
      }
      break;
    }
  }

  // 更新 intakeStatus.coveredDimensions / partialDimensions
  const covered = new Set(next.intakeStatus.coveredDimensions);
  const partial = new Set(next.intakeStatus.partialDimensions);

  if (result.completeness === "full") {
    covered.add(dimension);
    partial.delete(dimension);
  } else if (result.completeness === "partial") {
    partial.add(dimension);
    // partial 不算 covered
  }
  // empty: 啥都不动

  next.intakeStatus = {
    ...next.intakeStatus,
    phase: phase, // 不在这里改 phase，由 intake flow 控制
    coveredDimensions: Array.from(covered),
    partialDimensions: Array.from(partial),
  };

  return next;
}
