import type { ResumeBullet, ResumeDocument } from "./types";

export type SupportedIssueTargetPath =
  | `experiences.${number}.bullets.${number}`
  | `projects.${number}.bullets.${number}`
  | `summary.bullets.${number}`;

const targetPathPattern = /^(experiences|projects)\.(\d+)\.bullets\.(\d+)$|^summary\.bullets\.(\d+)$/;

export function isSupportedIssueTargetPath(value: string | undefined): value is SupportedIssueTargetPath {
  return typeof value === "string" && targetPathPattern.test(value);
}

export function readIssueTargetBullet(document: ResumeDocument, targetPath: string): ResumeBullet | null {
  if (!isSupportedIssueTargetPath(targetPath)) return null;
  const parts = targetPath.split(".");
  if (parts[0] === "summary") {
    const bulletIndex = Number(parts[2]);
    return document.summary?.bullets[bulletIndex] ?? null;
  }

  const section = parts[0];
  const itemIndex = Number(parts[1]);
  const bulletIndex = Number(parts[3]);
  if (section === "experiences") {
    return document.experiences[itemIndex]?.bullets[bulletIndex] ?? null;
  }
  return document.projects[itemIndex]?.bullets[bulletIndex] ?? null;
}

export function readIssueTargetText(document: ResumeDocument, targetPath: string): string | null {
  return readIssueTargetBullet(document, targetPath)?.text ?? null;
}

export function updateIssueTargetText(document: ResumeDocument, targetPath: string, text: string): ResumeDocument | null {
  if (!isSupportedIssueTargetPath(targetPath)) return null;
  const parts = targetPath.split(".");
  if (parts[0] === "summary") {
    const bulletIndex = Number(parts[2]);
    const bullet = document.summary?.bullets[bulletIndex];
    if (!document.summary || !bullet) return null;
    const bullets = document.summary.bullets.map((item, index) => (index === bulletIndex ? { ...item, text } : item));
    return { ...document, summary: { ...document.summary, bullets } };
  }

  const itemIndex = Number(parts[1]);
  const bulletIndex = Number(parts[3]);
  if (parts[0] === "experiences") {
    const item = document.experiences[itemIndex];
    if (!item?.bullets[bulletIndex]) return null;
    const experiences = document.experiences.map((experience, index) =>
      index === itemIndex
        ? {
            ...experience,
            bullets: experience.bullets.map((bullet, currentBulletIndex) =>
              currentBulletIndex === bulletIndex ? { ...bullet, text } : bullet,
            ),
          }
        : experience,
    );
    return { ...document, experiences };
  }

  const item = document.projects[itemIndex];
  if (!item?.bullets[bulletIndex]) return null;
  const projects = document.projects.map((project, index) =>
    index === itemIndex
      ? {
          ...project,
          bullets: project.bullets.map((bullet, currentBulletIndex) =>
            currentBulletIndex === bulletIndex ? { ...bullet, text } : bullet,
          ),
        }
      : project,
  );
  return { ...document, projects };
}
