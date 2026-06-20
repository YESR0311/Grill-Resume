/**
 * 问答维度清单（纯常量，无 server-only 依赖）。
 * 脚本定义必须覆盖的维度，靠 prompt 引导模型逐一覆盖。
 */

export const INTAKE_DIMENSIONS = [
  "basics",      // 姓名、目标岗位、联系方式
  "experience",  // 工作经历：角色、公司、时间、要点
  "project",     // 项目经历
  "skill",       // 技能组
  "education",   // 教育背景
  "evidence",    // 证据（纯文字：可量化、可信信息）
] as const;

export type IntakeDimension = (typeof INTAKE_DIMENSIONS)[number];

export const INTAKE_DIMENSION_LABELS: Record<IntakeDimension, string> = {
  basics: "基本信息",
  experience: "工作经历",
  project: "项目经历",
  skill: "技能组",
  education: "教育背景",
  evidence: "补充证据",
};