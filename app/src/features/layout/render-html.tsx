import type { ReactNode } from "react";
import type { LayoutBlock, LayoutBullet, LayoutSchema } from "./schema";

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function bulletText(bullet: LayoutBullet): string {
  return bullet.displayTextOverride?.trim() || bullet.text;
}

function SectionTitle({ block, accent }: { block: Extract<LayoutBlock, { kind: "section-title" }>; accent: string }) {
  return (
    <div className="border-b pb-1 pt-5" style={{ borderColor: accent }}>
      <h3 className="text-sm font-semibold tracking-wide" style={{ color: accent }}>
        {block.en ? `${block.en}  ` : null}
        <span>{block.zh}</span>
      </h3>
    </div>
  );
}

function HeaderBlock({ block, accent }: { block: Extract<LayoutBlock, { kind: "header" }>; accent: string }) {
  return (
    <header className="grid grid-cols-[1fr_116px] overflow-hidden rounded-sm text-white" style={{ backgroundColor: "#16324F" }}>
      <div className="p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{block.name}</h2>
          {block.targetRole ? <p className="text-sm text-slate-200">{block.targetRole}</p> : null}
        </div>
        {block.metaLines.length > 0 ? <p className="mt-3 text-sm text-slate-100">{block.metaLines.join(" | ")}</p> : null}
        {block.contacts.length > 0 ? <p className="mt-2 text-sm text-slate-100">{block.contacts.join(" | ")}</p> : null}
      </div>
      {block.photo ? (
        <div className="flex flex-col items-center justify-center bg-slate-100 p-3 text-center text-xs text-slate-500">
          <p className="text-base font-semibold" style={{ color: accent }}>照片</p>
          <p className="mt-2">{block.photo.widthMm} x {block.photo.heightMm}mm</p>
          <p className="mt-1">商务证件照</p>
        </div>
      ) : null}
    </header>
  );
}

function ProfileBlock({ block }: { block: Extract<LayoutBlock, { kind: "profile" }> }) {
  return (
    <section className="space-y-2">
      {block.headline ? <p className="text-sm leading-6 text-slate-700">{block.headline}</p> : null}
      <BulletList bullets={block.bullets} />
    </section>
  );
}

function BulletList({ bullets }: { bullets: LayoutBullet[] }) {
  if (bullets.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
      {bullets.map((bullet) => (
        <li key={bullet.bulletId} className="grid grid-cols-[16px_1fr] gap-1">
          <span aria-hidden="true">•</span>
          <span>{bulletText(bullet)}</span>
        </li>
      ))}
    </ul>
  );
}

function ExperienceBlock({ block }: { block: Extract<LayoutBlock, { kind: "experience" }> }) {
  const right = [block.location, block.period].filter(hasText).join(" · ");
  return (
    <section className="space-y-2">
      <EntryTitle left={[block.org, block.role].filter(hasText).join(" · ")} right={right} />
      <BulletList bullets={block.bullets} />
    </section>
  );
}

function ProjectBlock({ block }: { block: Extract<LayoutBlock, { kind: "project" }> }) {
  return (
    <section className="space-y-2">
      <EntryTitle left={[block.name, block.role].filter(hasText).join(" · ")} right={block.period} />
      {block.details.map((item) => (
        <p key={item.id} className="text-sm leading-6 text-slate-700">{item.text}</p>
      ))}
      <BulletList bullets={block.bullets} />
    </section>
  );
}

function EducationBlock({ block }: { block: Extract<LayoutBlock, { kind: "education" }> }) {
  return (
    <section className="space-y-2">
      <EntryTitle left={[block.org, block.degree].filter(hasText).join(" · ")} right={block.period} />
      {block.meta ? <p className="text-sm leading-6 text-slate-700">{block.meta}</p> : null}
      {block.notes.length > 0 ? (
        <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
          {block.notes.map((note) => (
            <li key={note.id} className="grid grid-cols-[16px_1fr] gap-1">
              <span aria-hidden="true">•</span>
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SkillsBlock({ block }: { block: Extract<LayoutBlock, { kind: "skills" }> }) {
  return (
    <section className="space-y-2">
      {block.groups.map((group) => (
        <p key={group.id} className="text-sm leading-6 text-slate-700">
          <span className="font-medium text-slate-900">{group.label}：</span>
          {group.items.join("，")}
        </p>
      ))}
      {block.extras.length > 0 ? (
        <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
          {block.extras.map((extra) => (
            <li key={extra.id} className="grid grid-cols-[16px_1fr] gap-1">
              <span aria-hidden="true">•</span>
              <span>{extra.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EntryTitle({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h4 className="text-sm font-semibold text-slate-950">{left}</h4>
      {right ? <p className="text-xs text-slate-500">{right}</p> : null}
    </div>
  );
}

function renderBlock(block: LayoutBlock, index: number, accent: string): ReactNode {
  if (block.kind === "header") return <HeaderBlock key={`header:${index}`} block={block} accent={accent} />;
  if (block.kind === "section-title") return <SectionTitle key={`title:${index}:${block.zh}`} block={block} accent={accent} />;
  if (block.kind === "profile") return <ProfileBlock key={`profile:${index}`} block={block} />;
  if (block.kind === "experience") return <ExperienceBlock key={block.id} block={block} />;
  if (block.kind === "project") return <ProjectBlock key={block.id} block={block} />;
  if (block.kind === "education") return <EducationBlock key={block.id} block={block} />;
  return <SkillsBlock key={`skills:${index}`} block={block} />;
}

export function HtmlPreviewRenderer({ schema }: { schema: LayoutSchema }): ReactNode {
  const accent = schema.theme.accentColor;
  const margin = `${schema.page.marginsMm.top}mm ${schema.page.marginsMm.right}mm ${schema.page.marginsMm.bottom}mm ${schema.page.marginsMm.left}mm`;
  return (
    <article
      className="mx-auto bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: margin,
        fontFamily: `"${schema.theme.fontCJK}", "${schema.theme.fontLatin}", sans-serif`,
        fontSize: `${schema.theme.baseFontPt}pt`,
        lineHeight: schema.theme.lineSpacing,
      }}
    >
      {schema.meta.partialMode ? (
        <div className="mb-4 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          当前预览为 partial mode：只显示已确认内容，缺口不会被自动补写。
        </div>
      ) : null}
      <div className="space-y-3">{schema.blocks.map((block, index) => renderBlock(block, index, accent))}</div>
    </article>
  );
}
