"use client";

import { useState } from "react";
import { FileDown, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDraft } from "./DraftProvider";

/**
 * 导出面板（design §4.3 / §5.6，Sprint 6.1）。
 * 保存草稿 + 导出前确认弹窗「确认简历信息无误？」→ 经 Route Handler 触发浏览器下载。
 * 已弃用 exportDocxAction（number[] bridge），改用 /api/export/[draftId] binary 响应。
 */
export function ExportPanel() {
  const { draft, dirty, saving, saveError, onSave } = useDraft();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const doExport = async () => {
    setExportError(null);
    // 导出前先保存最新编辑，确保导出内容与编辑器一致。
    if (dirty) {
      const ok = await onSave();
      if (!ok) {
        setExportError("保存失败，无法导出");
        return;
      }
    }
    setExporting(true);
    try {
      // draftId 与 draft-store 约定一致：`${profileId}-draft`。
      const draftId = `${draft.profileId}-draft`;
      const res = await fetch(`/api/export/${encodeURIComponent(draftId)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setExportError(data?.error ?? "导出失败，请稍后重试");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `简历-${draft.profileId.slice(0, 6)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setExportError("导出失败，请稍后重试");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg" onClick={onSave} disabled={saving || !dirty}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {dirty ? "保存修改" : "已保存"}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button size="lg">
                <FileDown size={16} /> 导出 Word
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认简历信息无误？</DialogTitle>
              <DialogDescription>
                确认后将导出 .docx 文件到系统默认下载文件夹。
              </DialogDescription>
            </DialogHeader>
            {exportError && <p className="text-sm text-status-failed">{exportError}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" size="lg" />}>取消</DialogClose>
              <Button size="lg" onClick={doExport} disabled={exporting}>
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                确认导出
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {saveError && <p className="text-xs text-status-failed">{saveError}</p>}
    </div>
  );
}
