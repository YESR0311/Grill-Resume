import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile, saveProfile } from "@/features/profile/store";
import { parseDimension } from "@/features/intake/parser";
import { applyDimensionResult, INTAKE_DIMENSIONS, type IntakeDimension } from "@/features/intake/dimensions";
import { toUserMessage } from "@/features/ai/chat";

/**
 * POST /api/intake/parse
 *
 * 后台异步解析：把某一阶段的对话历史解析成结构化信息，写回 profile。
 * 用户不可见——前端 fire-and-await，不展示 loading/toast。
 *
 * 入参：{ profileId, dimension, messages? }
 * 出参：{ success, partial, writtenFields, skipped, error? }
 */

const RequestSchema = z.object({
  profileId: z.string().min(1),
  dimension: z.enum(INTAKE_DIMENSIONS),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, partial: false, writtenFields: [], skipped: [], error: "请求参数无效" },
        { status: 400 },
      );
    }

    const { profileId, dimension, messages } = parsed.data;

    const profile = getProfile(profileId);
    if (!profile) {
      return NextResponse.json(
        { success: false, partial: false, writtenFields: [], skipped: [], error: "档案不存在" },
        { status: 404 },
      );
    }

    // 解析（失败不抛，走 empty）
    const result = await parseDimension({ profileId, dimension: dimension as IntakeDimension, messages });

    // 合并进 profile + 更新 intakeStatus
    const merged = applyDimensionResult(profile, dimension as IntakeDimension, result);
    saveProfile(merged);

    const partial = result.completeness === "partial";
    const empty = result.completeness === "empty";

    return NextResponse.json({
      success: true,
      partial,
      writtenFields: empty ? [] : [dimension],
      skipped: empty ? [dimension] : [],
    });
  } catch (err) {
    console.error("POST /api/intake/parse failed:", err);
    return NextResponse.json(
      { success: false, partial: false, writtenFields: [], skipped: [], error: toUserMessage(err) },
      { status: 500 },
    );
  }
}
