import type { ExportFormat, ResumeDocument } from "@/features/resume/types";
import { buildAtsDocx } from "./templates/ats";
import { buildVisualDocx } from "./templates/zh-visual";
import { renderJsonResume } from "./json-resume";
import { renderPdf } from "./pdf";
import { renderResumeDocx } from "./docx";

export async function renderExport(document: ResumeDocument, format: ExportFormat, options: { partialMode?: boolean } = {}): Promise<string | Buffer> {
  switch (format) {
    case "json-resume":
      return renderJsonResume(document);
    case "docx-ats":
      return await buildAtsDocx(document);
    case "docx-visual":
      return await buildVisualDocx(document);
    case "docx-zh-clean":
      return (await renderResumeDocx(document, options)).buffer;
    case "pdf":
      return renderPdf(document);
    default: {
      const exhaustive: never = format;
      throw new Error(`未知导出格式：${exhaustive as string}`);
    }
  }
}
