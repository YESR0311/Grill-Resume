import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalAlignTable,
  WidthType,
} from "docx";
import type {
  Award,
  Certificate,
  Education,
  Experience,
  Project,
  ResumeBullet,
  ResumeDocument,
  SkillGroup,
} from "@/features/resume/types";

type DocxChild = Paragraph | Table;

const FONT_CJK = "Microsoft YaHei";
const FONT_LATIN = "Aptos";
const INK = "172033";
const MUTED = "64748B";
const NAVY = "0F2742";
const BLUE = "1D4ED8";
const CYAN = "0E7490";
const GREEN = "047857";
const AMBER = "B45309";
const PAPER = "FFFFFF";
const MIST = "EEF6FF";
const PALE_BLUE = "DCEBFF";
const PALE_CYAN = "DDF7F9";
const PALE_GREEN = "DFF5EA";
const PALE_AMBER = "FEF3C7";
const SOFT_LINE = "E2E8F0";
const SIDEBAR = "F8FAFC";
const WHITE = "FFFFFF";

const BODY = 20;
const SMALL = 17;
const TINY = 15;
const SECTION = 21;
const TITLE = 44;
const ROLE = 22;

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clean(value: string | undefined | null): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

function join(parts: Array<string | undefined>, sep = " · "): string {
  return parts.filter(hasText).map((item) => item.trim()).join(sep);
}

function safeItems(items: string[] | undefined): string[] {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

function period(startDate?: string, endDate?: string): string {
  return join([clean(startDate), clean(endDate)], " - ");
}

function confirmedBullets(items: ResumeBullet[]): ResumeBullet[] {
  return items.filter((item) => item.status === "confirmed" && hasText(item.text));
}

function font() {
  return { ascii: FONT_LATIN, eastAsia: FONT_CJK, hAnsi: FONT_LATIN };
}

function run(
  text: string,
  options: {
    bold?: boolean;
    color?: string;
    size?: number;
    break?: number;
    allCaps?: boolean;
    characterSpacing?: number;
  } = {},
): TextRun {
  return new TextRun({
    text,
    bold: options.bold,
    color: options.color ?? INK,
    size: options.size ?? BODY,
    break: options.break,
    allCaps: options.allCaps,
    characterSpacing: options.characterSpacing,
    font: font(),
  });
}

function paragraph(
  text: string,
  options: {
    bold?: boolean;
    color?: string;
    size?: number;
    before?: number;
    after?: number;
    center?: boolean;
    right?: boolean;
    shading?: string;
    borderColor?: string;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 72, line: 276 },
    shading: options.shading ? { type: ShadingType.CLEAR, fill: options.shading, color: "auto" } : undefined,
    border: options.borderColor
      ? {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: options.borderColor },
        }
      : undefined,
    children: [run(text, options)],
  });
}

function richParagraph(
  children: TextRun[],
  options: { before?: number; after?: number; center?: boolean; right?: boolean; borderColor?: string } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 72, line: 276 },
    border: options.borderColor
      ? {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: options.borderColor },
        }
      : undefined,
    children,
  });
}

function emptyParagraph(after = 60): Paragraph {
  return new Paragraph({ spacing: { after }, children: [] });
}

function noBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: WHITE },
    bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
    left: { style: BorderStyle.NONE, size: 0, color: WHITE },
    right: { style: BorderStyle.NONE, size: 0, color: WHITE },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: WHITE },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: WHITE },
  };
}

function boxBorders(color = SOFT_LINE, size = 4) {
  return {
    top: { style: BorderStyle.SINGLE, size, color },
    bottom: { style: BorderStyle.SINGLE, size, color },
    left: { style: BorderStyle.SINGLE, size, color },
    right: { style: BorderStyle.SINGLE, size, color },
  };
}

function cell(
  children: DocxChild[],
  options: {
    width?: number;
    fill?: string;
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
    vertical?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable];
    borders?: ReturnType<typeof noBorders> | ReturnType<typeof boxBorders>;
  } = {},
): TableCell {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill, color: "auto" } : undefined,
    margins: {
      top: options.margins?.top ?? 120,
      bottom: options.margins?.bottom ?? 120,
      left: options.margins?.left ?? 160,
      right: options.margins?.right ?? 160,
    },
    verticalAlign: options.vertical ?? VerticalAlign.TOP,
    borders: options.borders,
    children: children.length > 0 ? children : [emptyParagraph(0)],
  });
}

function table(rows: TableRow[], options: { borders?: ReturnType<typeof noBorders> | ReturnType<typeof boxBorders>; widths?: number[] } = {}): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: options.borders ?? noBorders(),
    columnWidths: options.widths,
    rows,
  });
}

function label(text: string, color = BLUE): Paragraph {
  return paragraph(text, {
    bold: true,
    color,
    size: TINY,
    after: 42,
    shading: color === AMBER ? PALE_AMBER : color === GREEN ? PALE_GREEN : color === CYAN ? PALE_CYAN : PALE_BLUE,
  });
}

function sectionHeading(text: string, accent = BLUE): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 90 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 10, color: accent },
    },
    children: [
      run(text, { bold: true, color: NAVY, size: SECTION }),
      run("   " + "●", { color: accent, size: SECTION }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 56, line: 276 },
    bullet: { level: 0 },
    children: [run(text.trim(), { size: BODY })],
  });
}

function miniBullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 44, line: 240 },
    bullet: { level: 0 },
    children: [run(text.trim(), { size: SMALL, color: INK })],
  });
}

function titleLine(left: string, right?: string): Paragraph {
  return richParagraph(
    [
      run(left, { bold: true, color: INK, size: 22 }),
      ...(hasText(right) ? [run(`    ${right}`, { color: MUTED, size: SMALL })] : []),
    ],
    { after: 46 },
  );
}

function metaLine(text: string): Paragraph {
  return paragraph(text, { color: MUTED, size: SMALL, after: 56 });
}

function skillChips(items: string[], fill = PALE_BLUE, color = BLUE): Table[] {
  const rows: Table[] = [];
  for (let index = 0; index < items.length; index += 3) {
    const chunk = items.slice(index, index + 3);
    rows.push(
      table(
        [
          new TableRow({
            children: [0, 1, 2].map((slot) =>
              cell(
                chunk[slot] ? [paragraph(chunk[slot], { center: true, bold: true, color, size: TINY, after: 0 })] : [emptyParagraph(0)],
                {
                  width: 33,
                  fill: chunk[slot] ? fill : PAPER,
                  margins: { top: 70, bottom: 70, left: 70, right: 70 },
                  borders: chunk[slot] ? boxBorders("D8E6F8", 3) : noBorders(),
                },
              ),
            ),
          }),
        ],
        { widths: [1800, 1800, 1800] },
      ),
    );
  }
  return rows;
}

function header(document: ResumeDocument): Table {
  const name = document.basics.name?.trim() || document.title || "我的简历";
  const role = clean(document.basics.targetRole) ?? clean(document.target?.role) ?? "目标岗位";
  const keywords = safeItems(document.target?.keywords).slice(0, 5);
  const contacts = [
    clean(document.basics.phone),
    clean(document.basics.email),
    clean(document.basics.city),
    ...document.basics.links.map((item) => clean(item.url)),
  ].filter(hasText);

  return table(
    [
      new TableRow({
        children: [
          cell(
            [
              richParagraph(
                [
                  run(name, { bold: true, color: WHITE, size: TITLE, characterSpacing: 20 }),
                  run(`   ${role}`, { color: "BFE7FF", size: ROLE }),
                ],
                { after: 92 },
              ),
              ...(keywords.length > 0
                ? [
                    paragraph(keywords.join("  /  "), {
                      color: "E0F2FE",
                      size: SMALL,
                      after: 74,
                    }),
                  ]
                : []),
              paragraph(contacts.join("   |   "), { color: WHITE, size: SMALL, after: 0 }),
            ],
            { width: 74, fill: NAVY, margins: { top: 260, bottom: 230, left: 280, right: 220 } },
          ),
          cell(
            [
              paragraph("中文视觉版", { center: true, bold: true, color: NAVY, size: 20, after: 60 }),
              paragraph("CONFIRMED", { center: true, bold: true, color: BLUE, size: TINY, shading: PALE_BLUE, after: 60 }),
              paragraph("本地生成 Word", { center: true, color: MUTED, size: TINY, after: 0 }),
            ],
            { width: 26, fill: MIST, margins: { top: 260, bottom: 230, left: 160, right: 160 }, vertical: VerticalAlign.CENTER },
          ),
        ],
      }),
    ],
    { widths: [6900, 2400] },
  );
}

function summaryCard(document: ResumeDocument): DocxChild[] {
  if (!document.summary) return [];
  const children: DocxChild[] = [];
  if (hasText(document.summary.headline)) {
    children.push(paragraph(document.summary.headline, { bold: true, color: NAVY, size: 21, after: 70 }));
  }
  for (const item of confirmedBullets(document.summary.bullets).slice(0, 4)) {
    children.push(miniBullet(item.text));
  }
  if (children.length === 0) return [];
  return [
    table([
      new TableRow({
        children: [
          cell([label("PROFILE 个人优势", BLUE), ...children], {
            fill: MIST,
            margins: { top: 150, bottom: 130, left: 170, right: 170 },
            borders: boxBorders("D6E6F8", 4),
          }),
        ],
      }),
    ]),
  ];
}

function sidebarSkills(groups: SkillGroup[]): DocxChild[] {
  const out: DocxChild[] = [];
  for (const group of groups.filter((item) => item.items.some(hasText)).slice(0, 5)) {
    out.push(paragraph(group.name, { bold: true, color: NAVY, size: SMALL, after: 40 }));
    out.push(...skillChips(safeItems(group.items).slice(0, 9), PALE_BLUE, BLUE));
    out.push(emptyParagraph(50));
  }
  return out;
}

function sidebarEducation(items: Education[]): DocxChild[] {
  return items.flatMap((item) => {
    const lines = [
      paragraph(item.school, { bold: true, color: INK, size: SMALL, after: 24 }),
      paragraph(join([item.degree, item.major]), { color: MUTED, size: TINY, after: 20 }),
      paragraph(join([period(item.startDate, item.endDate), item.gpa ? `GPA ${item.gpa}` : undefined, item.rank]), {
        color: MUTED,
        size: TINY,
        after: 70,
      }),
    ];
    return lines;
  });
}

function sidebarExtras(certificates: Certificate[], awards: Award[]): DocxChild[] {
  const extras = [
    ...certificates.map((item) => join([item.name, item.issuer, item.date])),
    ...awards.map((item) => join([item.name, item.issuer, item.date])),
  ].filter(hasText);
  return extras.slice(0, 8).map((item) => miniBullet(item));
}

function sidebar(document: ResumeDocument): DocxChild[] {
  const children: DocxChild[] = [
    sectionHeading("能力标签", CYAN),
    ...sidebarSkills(document.skills),
    ...(document.education.length > 0 ? [sectionHeading("教育背景", GREEN), ...sidebarEducation(document.education)] : []),
    ...(document.certificates.length > 0 || document.awards.length > 0 ? [sectionHeading("证书奖项", AMBER), ...sidebarExtras(document.certificates, document.awards)] : []),
  ];

  return [
    table([
      new TableRow({
        children: [
          cell(children, {
            fill: SIDEBAR,
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            borders: boxBorders(SOFT_LINE, 4),
          }),
        ],
      }),
    ]),
  ];
}

function experienceCard(item: Experience): Table | null {
  const bullets = confirmedBullets(item.bullets);
  if (bullets.length === 0) return null;
  const meta = join([item.role, item.location, period(item.startDate, item.endDate)]);
  return table(
    [
      new TableRow({
        children: [
          cell(
            [
              titleLine(item.organization, period(item.startDate, item.endDate)),
              ...(hasText(meta) ? [metaLine(meta)] : []),
              ...bullets.slice(0, 5).map((entry) => bullet(entry.text)),
            ],
            {
              fill: PAPER,
              margins: { top: 130, bottom: 110, left: 160, right: 160 },
              borders: boxBorders(SOFT_LINE, 4),
            },
          ),
        ],
      }),
    ],
    { borders: noBorders() },
  );
}

function projectCard(item: Project): Table | null {
  const bullets = confirmedBullets(item.bullets);
  if (bullets.length === 0) return null;
  const details = [
    item.techStack.length > 0 ? `技术栈：${safeItems(item.techStack).join("，")}` : undefined,
    clean(item.goal) ? `目标：${clean(item.goal)}` : undefined,
  ].filter(hasText);
  return table(
    [
      new TableRow({
        children: [
          cell(
            [
              titleLine(join([item.name, item.role]), period(item.startDate, item.endDate)),
              ...details.map((text) => metaLine(text)),
              ...bullets.slice(0, 4).map((entry) => bullet(entry.text)),
            ],
            {
              fill: "FBFDFF",
              margins: { top: 130, bottom: 110, left: 160, right: 160 },
              borders: boxBorders("D7E7F6", 4),
            },
          ),
        ],
      }),
    ],
    { borders: noBorders() },
  );
}

function mainColumn(document: ResumeDocument): DocxChild[] {
  const experienceCards = document.experiences.map(experienceCard).filter((item): item is Table => Boolean(item));
  const projectCards = document.projects.map(projectCard).filter((item): item is Table => Boolean(item));
  const children: DocxChild[] = [
    ...summaryCard(document),
    ...(experienceCards.length > 0 ? [sectionHeading("工作 / 实习经历", BLUE), ...experienceCards] : []),
    ...(projectCards.length > 0 ? [sectionHeading("项目经历", CYAN), ...projectCards] : []),
  ];

  if (children.length === 0) {
    children.push(
      table([
        new TableRow({
          children: [
            cell([paragraph("暂无 confirmed 经历或项目内容。请先确认事实后再导出正式投递版。", { color: MUTED, after: 0 })], {
              fill: MIST,
              borders: boxBorders("D6E6F8", 4),
            }),
          ],
        }),
      ]),
    );
  }
  return children;
}

function bodyLayout(document: ResumeDocument): Table {
  return table(
    [
      new TableRow({
        children: [
          cell(sidebar(document), { width: 31, margins: { top: 0, bottom: 0, left: 0, right: 120 }, borders: noBorders() }),
          cell(mainColumn(document), { width: 69, margins: { top: 0, bottom: 0, left: 120, right: 0 }, borders: noBorders() }),
        ],
      }),
    ],
    { widths: [2880, 6420] },
  );
}

function compactFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 80 },
        children: [
          run("Grill-Resume 本地生成 · confirmed-only · 第 ", { color: MUTED, size: TINY }),
          new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: TINY, font: font() }),
          run(" 页", { color: MUTED, size: TINY }),
        ],
      }),
    ],
  });
}

function compactHeader(document: ResumeDocument): Header {
  const name = document.basics.name?.trim() || document.title || "我的简历";
  return new Header({
    children: [
      richParagraph(
        [run(name, { bold: true, color: MUTED, size: TINY }), run("  ·  中文视觉 Word", { color: MUTED, size: TINY })],
        { right: true, after: 30 },
      ),
    ],
  });
}

export async function buildVisualDocx(document: ResumeDocument): Promise<Buffer> {
  const children: DocxChild[] = [header(document), emptyParagraph(120), bodyLayout(document)];

  const doc = new Document({
    creator: "Grill-Resume",
    title: document.title,
    description: "中文视觉 Word 简历，本地生成，仅导出 confirmed 内容。",
    styles: {
      default: {
        document: {
          run: { font: font(), size: BODY, color: INK },
          paragraph: { spacing: { line: 276, after: 72 } },
        },
      },
    },
    sections: [
      {
        headers: { default: compactHeader(document) },
        footers: { default: compactFooter() },
        properties: {
          page: {
            margin: { top: 560, right: 520, bottom: 560, left: 520, header: 260, footer: 260 },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
