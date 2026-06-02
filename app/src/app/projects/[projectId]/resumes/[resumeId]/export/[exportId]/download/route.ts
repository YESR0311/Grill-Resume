import { promises as fs } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string; resumeId: string; exportId: string }>;
};

type ExportRow = { format: string; file_path: string };

function workspaceProjectsRoot(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".workspace", "projects");
}

function contentType(format: string): string {
  if (format === "json-resume") return "application/json; charset=utf-8";
  if (format === "pdf") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function fileName(format: string): string {
  if (format === "json-resume") return "resume.json";
  if (format === "pdf") return "resume.pdf";
  return "resume.docx";
}

function relocate(filePath: string): string {
  const resolved = path.resolve(filePath);
  const marker = `${path.sep}projects${path.sep}`;
  const index = resolved.lastIndexOf(marker);
  return index >= 0 ? path.resolve(workspaceProjectsRoot(), resolved.slice(index + marker.length)) : resolved;
}

export async function GET(_request: Request, { params }: Props) {
  const { projectId, resumeId, exportId } = await params;
  const row = getDb()
    .prepare(
      `SELECT exports.format, exports.file_path
       FROM exports INNER JOIN resumes ON exports.resume_id = resumes.id
       WHERE exports.id = ? AND exports.resume_id = ? AND resumes.project_id = ?`,
    )
    .get(exportId, resumeId, projectId) as ExportRow | undefined;
  if (!row) notFound();
  const resolved = relocate(row.file_path);
  const allowedRoot = path.resolve(workspaceProjectsRoot(), projectId);
  if (!resolved.startsWith(allowedRoot + path.sep)) notFound();
  const body = await fs.readFile(resolved);
  return new Response(body, {
    headers: {
      "content-type": contentType(row.format),
      "content-disposition": `attachment; filename="${fileName(row.format)}"`,
    },
  });
}
