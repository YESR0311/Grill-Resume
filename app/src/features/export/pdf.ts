import type { ResumeDocument } from "@/features/resume/types";

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function collectLines(document: ResumeDocument): string[] {
  return [
    document.basics.name || "Resume",
    [document.basics.targetRole, document.basics.city, document.basics.phone, document.basics.email].filter(Boolean).join(" · "),
    "Education",
    ...document.education.map((item) => [item.school, item.degree, item.major].filter(Boolean).join(" · ")),
    "Experience",
    ...document.experiences.flatMap((item) => [
      [item.organization, item.role].filter(Boolean).join(" · "),
      ...item.bullets.map((bullet) => `- ${bullet.text}`),
    ]),
    "Projects",
    ...document.projects.flatMap((item) => [
      [item.name, item.role, item.techStack.join(" / ")].filter(Boolean).join(" · "),
      ...item.bullets.map((bullet) => `- ${bullet.text}`),
    ]),
    "Skills",
    ...document.skills.map((group) => `${group.name}: ${group.items.join(", ")}`),
  ].filter((line) => line.trim().length > 0);
}

export function renderPdf(document: ResumeDocument): Buffer {
  const content = collectLines(document)
    .slice(0, 42)
    .map((line, index) => `BT /F1 11 Tf 50 ${790 - index * 17} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  const header = "%PDF-1.4\n";
  let body = header;
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");
  return Buffer.from(body + xref);
}
