import "server-only";

import { nanoid } from "nanoid";
import type { Education, Experience, Project, SkillGroup } from "@/features/resume/types";

export type ResumeIntakeCandidate = {
  id: string;
  createdAt: string;
  sourceText: string;
  target?: { role?: string; jdText?: string };
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  skills: SkillGroup[];
};

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function splitItems(value: string): string[] {
  return value.split(/[，,、；;\n]/).map((item) => item.trim()).filter(Boolean);
}

function stripLabel(line: string): string {
  return line.replace(/^(经历|经验|实习|工作|项目|技能|教育|学校|学历|专业|岗位|目标)[:：-]?\s*/, "").trim();
}

export function parseRawTextIntake(input: {
  rawText: string;
  jdText?: string;
  targetRole?: string;
}): ResumeIntakeCandidate {
  const sourceText = input.rawText.trim();
  const sourceLines = lines(sourceText);
  const now = new Date().toISOString();
  const candidate: ResumeIntakeCandidate = {
    id: nanoid(),
    createdAt: now,
    sourceText,
    target: input.targetRole || input.jdText ? { role: input.targetRole?.trim() || undefined, jdText: input.jdText?.trim() || undefined } : undefined,
    education: [],
    experiences: [],
    projects: [],
    skills: [],
  };

  for (const line of sourceLines) {
    const body = stripLabel(line);
    if (/^(教育|学校|学历|专业)/.test(line)) {
      const parts = body.split(/[｜|，,]/).map((part) => part.trim()).filter(Boolean);
      candidate.education.push({
        id: nanoid(),
        school: parts[0] ?? body,
        degree: parts[1] ?? "待确认",
        major: parts[2] ?? "待确认",
      });
    } else if (/^(项目)/.test(line)) {
      const [name, role, ...rest] = body.split(/[｜|]/).map((part) => part.trim()).filter(Boolean);
      candidate.projects.push({
        id: nanoid(),
        name: name || body,
        role,
        techStack: splitItems(rest.join("，")),
        links: [],
        evidence: [],
        bullets: [],
      });
    } else if (/^(技能)/.test(line)) {
      candidate.skills.push({
        id: nanoid(),
        category: "tools",
        name: "技能",
        items: splitItems(body),
      });
    } else if (/^(经历|经验|实习|工作)/.test(line)) {
      const [organization, role, bullet] = body.split(/[｜|]/).map((part) => part.trim());
      candidate.experiences.push({
        id: nanoid(),
        organization: organization || body,
        role: role || "待确认",
        evidence: [],
        bullets: bullet
          ? [{ id: nanoid(), text: bullet, sourceEvidenceIds: [], qualityFlags: [], status: "draft" }]
          : [],
      });
    }
  }

  if (candidate.experiences.length === 0 && sourceText) {
    candidate.experiences.push({
      id: nanoid(),
      organization: "待确认组织",
      role: input.targetRole?.trim() || "待确认岗位",
      evidence: [],
      bullets: [{ id: nanoid(), text: sourceText.slice(0, 800), sourceEvidenceIds: [], qualityFlags: [], status: "draft" }],
    });
  }

  return candidate;
}
