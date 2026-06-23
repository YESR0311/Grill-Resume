import "server-only";

import { Document, Packer } from "docx";
import type { ResumeDraft } from "@/features/polish/types";
import { getTemplate } from "@/features/polish/template-registry";
import { buildExportCtx, selectExporter } from "./template-exporters";

/**
 * ResumeDraft → DOCX Buffer（与 StructuredEditor preview 完全对齐）。
 *
 * 关键修复（Sprint 06-23 export-preview-align）：
 * 1. 根据 `draft.templateId` 选模板导出器（9 模板各自 docx-native 渲染）
 * 2. 颜色/字体从 `getTheme(themeId)` 取（template-registry 是用 themeId 推 colorScheme 的，
 *    旧版从 draft.style.colorScheme 取会漂移）
 * 3. 字号/行距/边距从 `getTemplate(templateId).style` 取
 * 4. TopHeader + PhotoPlaceholder + section 标题样式严格走 template-exporters
 * 5. 强制 A4 竖版（210×297mm）
 *
 * 不外发任何网络请求；纯本地生成（spec database-guidelines 隐私契约）。
 */

/** mm → twips（1mm ≈ 56.6929 twips）。 */
function mmToTwips(mm: number): number {
  return Math.round(mm * 56.6929);
}

export async function buildDraftDocx(draft: ResumeDraft): Promise<Buffer> {
  const ctx = buildExportCtx(draft);
  const template = getTemplate(draft.templateId) ?? getTemplate("t1-classic")!;
  const m = template.style.margins;

  // 1. 调模板导出器拿到 children 列表
  const exporter = selectExporter(draft.templateId);
  const children = exporter(ctx);

  // 2. 拼 Document
  const doc = new Document({
    sections: [
      {
        properties: {
          // 强制 A4 竖版（210mm × 297mm）。
          // 此前未显式设 size，docx 默认 Letter portrait，HR 国内/欧洲导出排版错位。
          page: {
            size: {
              orientation: "portrait",
              width: mmToTwips(210),
              height: mmToTwips(297),
            },
            margin: {
              top: mmToTwips(m.top),
              bottom: mmToTwips(m.bottom),
              left: mmToTwips(m.left),
              right: mmToTwips(m.right),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
