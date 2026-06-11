import type { Experience, Project, ResumeDocument } from "@/features/resume/types";

type IntakeEntry = Pick<Experience | Project, "evidence" | "bullets">;

function isEmptySkeleton(entry: IntakeEntry): boolean {
  const hasEvidence = entry.evidence.length > 0;
  const hasConfirmedBullet = entry.bullets.some((bullet) => bullet.status === "confirmed");
  return !hasEvidence && !hasConfirmedBullet;
}

/**
 * 判定是否进入 intake 引导式经历盘点子阶段。
 * 仅当经历与项目合计为 0 条，或全部条目均为空骨架（无 evidence 且无 confirmed bullet）
 * 时返回 true；只要存在一条有实质内容的条目，就走 deep-dive（buildExperienceQuestionQueue）。
 * education/skills 是否为空不参与判定。
 */
export function shouldRunIntake(document: ResumeDocument): boolean {
  const entries: IntakeEntry[] = [...document.experiences, ...document.projects];
  if (entries.length === 0) {
    return true;
  }
  return entries.every(isEmptySkeleton);
}
