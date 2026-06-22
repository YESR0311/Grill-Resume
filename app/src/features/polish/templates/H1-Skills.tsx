import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/**
 * H1-Skills 模板：混合·技能优先
 * 特点：技能模块前置，适合技术岗突出能力栈
 */

export function H1Skills({ draft, style }: { draft: ResumeDraft; style: ResumeStyle }) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };

  return (
    <div className="relative bg-white" style={sheetStyle}>
      <PhotoPlaceholder position="left" />
      <header className="mb-6 ml-36">
        <h1 className="text-3xl font-bold mb-2" style={{ color: style.colorScheme.primary }}>
          {draft.name}
        </h1>
        <div className="text-base mb-1" style={{ color: style.colorScheme.accent }}>{draft.title}</div>
        <div className="text-sm flex gap-4" style={{ color: style.colorScheme.accent }}>
          {draft.email && <span>{draft.email}</span>}
          {draft.phone && <span>{draft.phone}</span>}
        </div>
      </header>
      {style.sectionOrder.map((key) => (
        <section key={key} className="mb-5">
          {key === "summary" && draft.summary && (
            <>
              <h2 className="mb-2 border-b pb-1 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>个人简介</h2>
              <p className="text-sm">{draft.summary}</p>
            </>
          )}
          {key === "skills" && draft.skills.length > 0 && (
            <>
              <h2 className="mb-2 border-b pb-1 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>技能</h2>
              <div className="grid grid-cols-3 gap-2">
                {draft.skills.map((skill, idx) => (
                  <div key={idx} className="px-2 py-1 text-sm text-center rounded" style={{ backgroundColor: `${style.colorScheme.primary}1a` }}>
                    {skill}
                  </div>
                ))}
              </div>
            </>
          )}
          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <h2 className="mb-2 border-b pb-1 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>
                {draft.workExperience.title || "工作经历"}
              </h2>
              {draft.workExperience.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="font-semibold text-sm">{item.role}</div>
                    <div className="text-xs text-muted-foreground">{item.startDate} - {item.endDate}</div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">{item.organization}</div>
                  {item.bullets.length > 0 && (
                    <ul className="list-disc list-inside space-y-1">
                      {item.bullets.map((b, i) => (
                        <li key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: b.text }} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
          {key === "projects" && draft.projects.items.length > 0 && (
            <>
              <h2 className="mb-2 border-b pb-1 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>
                {draft.projects.title || "项目经历"}
              </h2>
              {draft.projects.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="font-semibold text-sm">{item.role}</div>
                    <div className="text-xs text-muted-foreground">{item.startDate} - {item.endDate}</div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">{item.organization}</div>
                  {item.bullets.length > 0 && (
                    <ul className="list-disc list-inside space-y-1">
                      {item.bullets.map((b, i) => (
                        <li key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: b.text }} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
          {key === "education" && draft.education.items.length > 0 && (
            <>
              <h2 className="mb-2 border-b pb-1 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>
                {draft.education.title || "教育背景"}
              </h2>
              {draft.education.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2 flex justify-between items-baseline">
                  <div>
                    <span className="font-semibold text-sm">{item.organization}</span>
                    <span className="text-sm text-muted-foreground ml-2">{item.role}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{item.endDate}</div>
                </div>
              ))}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
