"use client";

import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDraft } from "./DraftProvider";
import { useActiveEditor } from "./active-editor";

/**
 * 样式调整面板（design §5.3，右侧 Sheet）。
 * 上半：当前聚焦 bullet 的 inline mark（bold/italic/underline/strike + color）。
 * 下半：全局样式参数（字号 / 行距 / 边距 / 主题色）。
 * 不做 WYSIWYG toolbar——格式控制集中在此 Sheet（design §5.3）。
 */
export function StyleControls() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="lg">
            <SlidersHorizontal size={16} /> 样式调整
          </Button>
        }
      />
      <SheetContent side="right" className="w-96 max-w-full overflow-y-auto p-5">
        <SheetHeader className="px-0">
          <SheetTitle>样式调整</SheetTitle>
          <SheetDescription>
            选中要点后可设置加粗 / 斜体等格式；下方调整全局字号、行距、边距与主题色。
          </SheetDescription>
        </SheetHeader>

        <InlineMarkControls />
        <GlobalStyleControls />
      </SheetContent>
    </Sheet>
  );
}

// ─── inline mark（操作 active editor） ──────────────────────

function InlineMarkControls() {
  const { editor } = useActiveEditor();
  const disabled = !editor;

  const markBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-40 ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        文字格式（选中要点）
      </h4>
      <div className="flex items-center gap-2">
        {markBtn(
          !!editor?.isActive("bold"),
          () => editor?.chain().focus().toggleBold().run(),
          "加粗",
          <Bold size={15} />,
        )}
        {markBtn(
          !!editor?.isActive("italic"),
          () => editor?.chain().focus().toggleItalic().run(),
          "斜体",
          <Italic size={15} />,
        )}
        {markBtn(
          !!editor?.isActive("underline"),
          () => editor?.chain().focus().toggleUnderline().run(),
          "下划线",
          <UnderlineIcon size={15} />,
        )}
        {markBtn(
          !!editor?.isActive("strike"),
          () => editor?.chain().focus().toggleStrike().run(),
          "删除线",
          <Strikethrough size={15} />,
        )}
        <label className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
          颜色
          <input
            type="color"
            disabled={disabled}
            defaultValue="#0f172a"
            onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
            className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent disabled:opacity-40"
          />
        </label>
      </div>
      {disabled && (
        <p className="mt-1.5 text-xs text-muted-foreground">先点击一条要点再设置格式。</p>
      )}
    </div>
  );
}

// ─── 全局样式参数 ────────────────────────────────────────────

function GlobalStyleControls() {
  const { style, updateStyle } = useDraft();

  return (
    <div className="mt-6 space-y-4 border-t border-border pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        全局排版
      </h4>

      <Range
        label={`正文字号 ${style.fontSize}px`}
        min={11}
        max={20}
        step={1}
        value={style.fontSize}
        onChange={(v) => updateStyle({ fontSize: v })}
      />
      <Range
        label={`行距 ${style.lineSpacing.toFixed(2)}`}
        min={1}
        max={2.4}
        step={0.05}
        value={style.lineSpacing}
        onChange={(v) => updateStyle({ lineSpacing: v })}
      />
      <Range
        label={`页边距 ${style.margins.top}mm`}
        min={10}
        max={40}
        step={1}
        value={style.margins.top}
        onChange={(v) =>
          updateStyle({ margins: { top: v, right: v, bottom: v, left: v } })
        }
      />

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">主题色</label>
        <div className="flex items-center gap-3">
          <ColorField
            label="主色"
            value={style.colorScheme.primary}
            onChange={(v) => updateStyle({ colorScheme: { ...style.colorScheme, primary: v } })}
          />
          <ColorField
            label="辅色"
            value={style.colorScheme.accent}
            onChange={(v) => updateStyle({ colorScheme: { ...style.colorScheme, accent: v } })}
          />
          <ColorField
            label="正文"
            value={style.colorScheme.text}
            onChange={(v) => updateStyle({ colorScheme: { ...style.colorScheme, text: v } })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">字体族</label>
        <select
          value={style.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="'Helvetica Neue', Arial, 'PingFang SC', sans-serif">无衬线（默认）</option>
          <option value="Georgia, 'Times New Roman', 'Songti SC', serif">衬线（商务）</option>
          <option value="'Times New Roman', Georgia, 'Songti SC', serif">衬线（学术）</option>
          <option value="'Avenir Next', 'Helvetica Neue', 'PingFang SC', sans-serif">现代圆体（创意）</option>
        </select>
      </div>
    </div>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
      />
    </label>
  );
}
