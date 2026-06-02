import type { ResumeDocument } from "@/features/resume/types";

type JsonResume = {
  basics: {
    name: string;
    label?: string;
    email?: string;
    phone?: string;
    location?: { city?: string };
    profiles: { network: string; url: string; username?: string }[];
  };
  education: { institution: string; area: string; studyType: string; startDate?: string; endDate?: string; score?: string; courses?: string[] }[];
  work: { name: string; position: string; startDate?: string; endDate?: string; highlights: string[] }[];
  projects: { name: string; description?: string; keywords: string[]; roles?: string[]; highlights: string[]; url?: string }[];
  skills: { name: string; keywords: string[] }[];
  certificates: { name: string; issuer?: string; date?: string }[];
  awards: { title: string; awarder?: string; date?: string; summary?: string }[];
};

export function toJsonResume(document: ResumeDocument): JsonResume {
  return {
    basics: {
      name: document.basics.name,
      label: document.basics.targetRole,
      email: document.basics.email,
      phone: document.basics.phone,
      location: document.basics.city ? { city: document.basics.city } : undefined,
      profiles: document.basics.links.map((link) => ({
        network: link.label,
        url: link.url,
      })),
    },
    education: document.education.map((item) => ({
      institution: item.school,
      area: item.major,
      studyType: item.degree,
      startDate: item.startDate,
      endDate: item.endDate,
      score: item.gpa,
      courses: item.courses,
    })),
    work: document.experiences.map((item) => ({
      name: item.organization,
      position: item.role,
      startDate: item.startDate,
      endDate: item.endDate,
      highlights: item.bullets.map((bullet) => bullet.text),
    })),
    projects: document.projects.map((item) => ({
      name: item.name,
      description: item.goal,
      keywords: item.techStack,
      roles: item.role ? [item.role] : undefined,
      highlights: item.bullets.map((bullet) => bullet.text),
      url: item.links[0]?.url,
    })),
    skills: document.skills.map((group) => ({
      name: group.name,
      keywords: group.items,
    })),
    certificates: document.certificates.map((item) => ({
      name: item.name,
      issuer: item.issuer,
      date: item.date,
    })),
    awards: document.awards.map((item) => ({
      title: item.name,
      awarder: item.issuer,
      date: item.date,
      summary: item.description,
    })),
  };
}

export function renderJsonResume(document: ResumeDocument): string {
  return JSON.stringify(toJsonResume(document), null, 2);
}
