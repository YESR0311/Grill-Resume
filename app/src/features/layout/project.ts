import { buildDocxGapReport, type DocxGapReport } from "@/features/export/gap-report";
import type { ResumeBullet, ResumeDocument } from "@/features/resume/types";
import type { LayoutBlock, LayoutBullet, LayoutProjection, LayoutSchema, LayoutTextItem } from "./schema";

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clean(value: string | undefined | null): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

function join(parts: Array<string | undefined>, sep = " · "): string {
  return parts.filter(hasText).map((part) => part.trim()).join(sep);
}

function period(startDate?: string, endDate?: string): string {
  return join([clean(startDate), clean(endDate)], " - ");
}

function confirmedLayoutBullets(items: ResumeBullet[], limit?: number): LayoutBullet[] {
  const bullets = items
    .filter((item) => item.status === "confirmed" && hasText(item.text))
    .map((item) => ({
      bulletId: item.id,
      text: item.text.trim(),
      sourceEvidenceIds: item.sourceEvidenceIds,
    }));
  return typeof limit === "number" ? bullets.slice(0, limit) : bullets;
}

function textItem(id: string, text: string | undefined): LayoutTextItem | undefined {
  if (!hasText(text)) return undefined;
  return { id, text: text.trim() };
}

function defaultSchema(partialMode: boolean, blocks: LayoutBlock[]): LayoutSchema {
  return {
    version: "layout-v1",
    page: {
      size: "A4",
      columns: 1,
      marginsMm: { top: 19.8, right: 19.8, bottom: 19.8, left: 19.8 },
    },
    theme: {
      fontCJK: "Microsoft YaHei",
      fontLatin: "Calibri",
      accentColor: "#2F6F73",
      baseFontPt: 10.5,
      lineSpacing: 1.15,
    },
    blocks,
    meta: {
      confirmedOnly: true,
      partialMode,
    },
  };
}

function profileBlock(document: ResumeDocument): LayoutBlock | undefined {
  const bullets = confirmedLayoutBullets(document.summary?.bullets ?? []);
  const headline = clean(document.summary?.headline);
  if (!headline && bullets.length === 0) return undefined;
  return { kind: "profile", headline, bullets };
}

function experienceBlocks(document: ResumeDocument): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];
  const experiences = document.experiences
    .map((item) => ({
      item,
      bullets: confirmedLayoutBullets(item.bullets, 4),
    }))
    .filter(({ bullets }) => bullets.length > 0);

  if (experiences.length === 0) return blocks;
  blocks.push({ kind: "section-title", en: "EXPERIENCE", zh: "工作经历" });
  for (const { item, bullets } of experiences) {
    blocks.push({
      kind: "experience",
      id: item.id,
      org: item.organization,
      role: item.role,
      location: clean(item.location),
      period: period(item.startDate, item.endDate),
      bullets,
    });
  }
  return blocks;
}

function projectBlocks(document: ResumeDocument): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];
  const projects = document.projects
    .map((item) => ({
      item,
      bullets: confirmedLayoutBullets(item.bullets, 3),
    }))
    .filter(({ bullets }) => bullets.length > 0);

  if (projects.length === 0) return blocks;
  blocks.push({ kind: "section-title", en: "PROJECT", zh: "项目经历" });
  for (const { item, bullets } of projects) {
    const goal = clean(item.goal);
    blocks.push({
      kind: "project",
      id: item.id,
      name: item.name,
      role: clean(item.role),
      period: period(item.startDate, item.endDate),
      details: [
        textItem(`${item.id}:tech`, item.techStack.length > 0 ? `技术栈：${item.techStack.filter(hasText).join("，")}` : undefined),
        textItem(`${item.id}:goal`, goal ? `目标：${goal}` : undefined),
      ].filter((item): item is LayoutTextItem => Boolean(item)),
      bullets,
    });
  }
  return blocks;
}

function educationBlocks(document: ResumeDocument): LayoutBlock[] {
  if (document.education.length === 0) return [];
  const blocks: LayoutBlock[] = [{ kind: "section-title", en: "EDUCATION", zh: "教育背景" }];
  for (const item of document.education) {
    blocks.push({
      kind: "education",
      id: item.id,
      org: item.school,
      degree: join([clean(item.degree), clean(item.major)]),
      period: period(item.startDate, item.endDate),
      meta: join([item.gpa ? `GPA ${item.gpa}` : undefined, clean(item.rank)]),
      notes: (item.honors ?? []).map((honor, index) => textItem(`${item.id}:honor:${index}`, honor)).filter((note): note is LayoutTextItem => Boolean(note)),
    });
  }
  return blocks;
}

function skillsBlock(document: ResumeDocument): LayoutBlock[] {
  const groups = document.skills
    .map((group) => ({
      id: group.id,
      label: group.name,
      items: group.items.filter(hasText).map((item) => item.trim()),
    }))
    .filter((group) => group.items.length > 0);

  const extras = [
    ...document.certificates.map((item) => join([item.name, item.issuer, item.date])),
    ...document.awards.map((item) => join([item.name, item.issuer, item.date, item.description])),
  ]
    .map((item, index) => textItem(`extra:${index}`, item))
    .filter((item): item is LayoutTextItem => Boolean(item));

  if (groups.length === 0 && extras.length === 0) return [];
  return [{ kind: "section-title", en: "SKILLS", zh: "技能证书" }, { kind: "skills", groups, extras }];
}

function hasVisibleConfirmedContent(blocks: LayoutBlock[]): boolean {
  return blocks.some((block) => {
    if (block.kind === "profile") return Boolean(block.headline) || block.bullets.length > 0;
    if (block.kind === "experience" || block.kind === "project") return block.bullets.length > 0;
    return false;
  });
}

function partialMode(gap: DocxGapReport, blocks: LayoutBlock[]): boolean {
  return gap.missingBasics.length > 0 || !hasVisibleConfirmedContent(blocks);
}

export function project(document: ResumeDocument): LayoutProjection {
  const blocks: LayoutBlock[] = [
    {
      kind: "header",
      name: document.basics.name || document.title || "我的简历",
      targetRole: clean(document.basics.targetRole) ?? clean(document.target?.role) ?? "目标岗位",
      metaLines: [clean(document.basics.city), clean(document.target?.industry)].filter(hasText),
      contacts: [clean(document.basics.phone), clean(document.basics.email), ...document.basics.links.map((item) => clean(item.url))].filter(hasText),
      photo: { widthMm: 35, heightMm: 45, placeholder: true },
    },
  ];

  const profile = profileBlock(document);
  if (profile) blocks.push({ kind: "section-title", en: "PROFILE", zh: "个人优势" }, profile);
  blocks.push(...experienceBlocks(document), ...projectBlocks(document), ...educationBlocks(document), ...skillsBlock(document));

  const gap = buildDocxGapReport(document);
  return {
    schema: defaultSchema(partialMode(gap, blocks), blocks),
    gap,
  };
}
