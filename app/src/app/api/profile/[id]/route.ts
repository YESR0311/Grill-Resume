import { NextResponse } from "next/server";
import { deleteProfile } from "@/features/profile/store";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/profile/[id]
 * 删除指定档案
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "缺少档案 ID" }, { status: 400 });
    }

    deleteProfile(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("删除档案失败:", err);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
