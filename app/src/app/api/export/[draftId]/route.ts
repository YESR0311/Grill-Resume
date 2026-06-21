import { NextResponse } from "next/server";
import { getResumeDraftById } from "@/features/polish/draft-store";
import { buildDraftDocx } from "@/features/export/from-draft";

/**
 * DOCX 导出 Route Handler（Sprint 6.1，design §4.3）。
 *
 * 替代旧 exportDocxAction 的 number[] bridge：直接返回 binary，
 * Content-Disposition: attachment 触发浏览器下载到系统默认 Downloads 文件夹。
 *
 * 错误以中文文案返回，不泄漏绝对路径/上游响应体（spec error-handling）。
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ draftId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { draftId } = await params;
  if (!draftId) {
    return NextResponse.json({ error: "草稿无效" }, { status: 400 });
  }

  try {
    const draft = await getResumeDraftById(draftId);
    if (!draft) {
      return NextResponse.json({ error: "尚未生成简历草稿" }, { status: 404 });
    }

    const buffer = await buildDraftDocx(draft);
    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="resume.docx"; filename*=UTF-8''${encodeURIComponent("简历.docx")}`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("export route failed:", err);
    return NextResponse.json({ error: "导出失败，请稍后重试" }, { status: 500 });
  }
}
