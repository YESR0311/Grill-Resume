import { NextResponse } from "next/server";
import { renderResumeDocx } from "@/features/export/docx";
import type { ResumeDocument } from "@/features/resume/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { document: ResumeDocument; partialMode?: boolean };
  const result = await renderResumeDocx(body.document, { partialMode: body.partialMode ?? true });
  const bodyBytes = new Uint8Array(result.buffer);
  return new NextResponse(bodyBytes, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "x-gap-report": encodeURIComponent(JSON.stringify(result.report)),
    },
  });
}
