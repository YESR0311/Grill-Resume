import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/** H2-Achievement: 混合·成就导向 */
export function H2Achievement({ draft, style }: { draft: ResumeDraft; style: ResumeStyle }) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };
  return (
    <div className="relative bg-white" style={sheetStyle}>
      <PhotoPlaceholder position="right" />
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: style.colorScheme.primary, fontFamily: "'Playfair Display', serif" }}>
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
              <h2 className="mb-2 text-base font-semibold" style={{ color: style.colorScheme.primary, fontFamily: "'Playfair Display', serif" }}>个人简介</h2>
              <p className="text-sm">{draft.summary}</p>
            </>
          )}
          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: style.colorScheme.primary, fontFamily: "'Playfair Display', serif" }}>
                {draft.workExperience.title || "工作经历"}
              </h2>
              {draft.workExperience.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <div className="font-bold text-sm" style={{ color: style.colorScheme.primary }}>{item.role}</div>
                    <div className="text-xs">{item.startDate} - {item.endDate}</div>
                  </div>
                  <div className="text-sm mb-1" style={{ fontStyle: "italic" }}>{item.organization}</div>
                  {item.bullets.length > 0 && (
                    <ul className="space-y-1">
                      {item.bullets.map((b, i) => (
                        <li key={i} className="text-sm flex">
                          <span className="mr-2">•</span>
                          <span dangerouslySetInnerHTML={{ __html: b.text }} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
          {key === "projects" && draft.projects.items.length > 0 && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: style.colorScheme.primary, fontFamily: "'Playfair Display', serif" }}>
                {draft.projects.title || "项目经历"}
              </h2>
              {draft.projects.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <div className="font-bold text-sm" style={{ color: style.colorScheme.primary }}>{item.role}</div>
                    <div className="text-xs">{item.startDate} - {item.endDate}</div>
                  </div>
                  <div className="text-sm mb-1" style={{ fontStyle: "italic" }}>{item.organization}</div>
                  {item.bullets.length > 0 && (
                    <ul className="space-y-1">
                      {item.bullets.map((b, i) => (
                        <li key={i} className="text-sm flex">
                          <span className="mr-2">•</span>
                          <span dangerouslySetInnerHTML={{ __html: b.text }} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
          {key === "education" && draft.education.items.length > 0 && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: style.colorScheme.primary, fontFamily: "'Playfair Display', serif" }}>
                {draft.education.title || "教育背景"}
              </h2>
              {draft.education.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2 flex justify-between">
                  <div><strong>{item.organization}</strong> <span className="ml-2">{item.role}</span></div>
                  <div className="text-xs">{item.endDate}</div>
                </div>
              ))}
            </>
          )}
          {key === "skills" && draft.skills.length > 0 && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: style.colorScheme.primary, fontFamily: "'Playfair Display', serif" }}>技能</h2>
              <div className="flex flex-wrap gap-2">
                {draft.skills.map((s, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: `${style.colorScheme.primary}1a` }}>{s}</span>
                ))}
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

/** H3-Project: 混合·项目导向 */
export function H3Project({ draft, style }: { draft: ResumeDraft; style: ResumeStyle }) {
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
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: style.colorScheme.primary }}>{draft.name}</h1>
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
              <h2 className="mb-2 border-l-4 pl-2 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>个人简介</h2>
              <p className="text-sm pl-2">{draft.summary}</p>
            </>
          )}
          {key === "projects" && draft.projects.items.length > 0 && (
            <>
              <h2 className="mb-2 border-l-4 pl-2 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>
                {draft.projects.title || "项目经历"}
              </h2>
              {draft.projects.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3 pl-2">
                  <div className="flex justify-between mb-1">
                    <div className="font-semibold text-sm">{item.role}</div>
                    <div className="text-xs">{item.startDate} - {item.endDate}</div>
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
          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <h2 className="mb-2 border-l-4 pl-2 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>
                {draft.workExperience.title || "工作经历"}
              </h2>
              {draft.workExperience.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3 pl-2">
                  <div className="flex justify-between mb-1">
                    <div className="font-semibold text-sm">{item.role}</div>
                    <div className="text-xs">{item.startDate} - {item.endDate}</div>
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
          {key === "skills" && draft.skills.length > 0 && (
            <>
              <h2 className="mb-2 border-l-4 pl-2 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>技能</h2>
              <div className="flex flex-wrap gap-2 pl-2">
                {draft.skills.map((s, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: `${style.colorScheme.primary}1a` }}>{s}</span>
                ))}
              </div>
            </>
          )}
          {key === "education" && draft.education.items.length > 0 && (
            <>
              <h2 className="mb-2 border-l-4 pl-2 text-sm font-semibold uppercase" style={{ color: style.colorScheme.primary, borderColor: style.colorScheme.primary }}>
                {draft.education.title || "教育背景"}
              </h2>
              {draft.education.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2 flex justify-between pl-2">
                  <div><strong>{item.organization}</strong> <span className="ml-2">{item.role}</span></div>
                  <div className="text-xs">{item.endDate}</div>
                </div>
              ))}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

/** F1-Functional: 功能·转行版 */
export function F1Functional({ draft, style }: { draft: ResumeDraft; style: ResumeStyle }) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };
  return (
    <div className="relative bg-white" style={sheetStyle}>
      <PhotoPlaceholder position="right" />
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold mb-2" style={{ color: style.colorScheme.primary }}>{draft.name}</h1>
        <div className="text-base mb-1" style={{ color: style.colorScheme.accent }}>{draft.title}</div>
        <div className="text-sm flex gap-4 justify-center" style={{ color: style.colorScheme.accent }}>
          {draft.email && <span>{draft.email}</span>}
          {draft.phone && <span>{draft.phone}</span>}
        </div>
      </header>
      {style.sectionOrder.map((key) => (
        <section key={key} className="mb-5">
          {key === "summary" && draft.summary && (
            <>
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider" style={{ color: style.colorScheme.primary }}>个人简介</h2>
              <p className="text-sm text-center">{draft.summary}</p>
            </>
          )}
          {key === "skills" && draft.skills.length > 0 && (
            <>
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider" style={{ color: style.colorScheme.primary }}>核心技能</h2>
              <div className="flex flex-wrap gap-2 justify-center">
                {draft.skills.map((s, i) => (
                  <span key={i} className="px-3 py-1.5 text-sm font-medium rounded" style={{ backgroundColor: `${style.colorScheme.primary}20`, color: style.colorScheme.primary }}>{s}</span>
                ))}
              </div>
            </>
          )}
          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider" style={{ color: style.colorScheme.primary }}>
                {draft.workExperience.title || "相关经历"}
              </h2>
              {draft.workExperience.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3">
                  <div className="font-semibold text-sm mb-1">{item.organization} · {item.role}</div>
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
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider" style={{ color: style.colorScheme.primary }}>
                {draft.projects.title || "项目经历"}
              </h2>
              {draft.projects.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-3">
                  <div className="font-semibold text-sm mb-1">{item.role} · {item.organization}</div>
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
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider" style={{ color: style.colorScheme.primary }}>
                {draft.education.title || "教育背景"}
              </h2>
              {draft.education.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2 text-center text-sm">
                  <strong>{item.organization}</strong> · {item.role} · {item.endDate}
                </div>
              ))}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

/** A1-ATS: ATS 优化版 */
export function A1ATS({ draft, style }: { draft: ResumeDraft; style: ResumeStyle }) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };
  return (
    <div className="relative bg-white" style={sheetStyle}>
      <PhotoPlaceholder position="right" />
      <header className="mb-4">
        <h1 className="text-2xl font-bold mb-1" style={{ color: style.colorScheme.primary }}>{draft.name}</h1>
        <div className="text-sm mb-1">{draft.title}</div>
        <div className="text-xs">{draft.email} | {draft.phone}</div>
      </header>
      {style.sectionOrder.map((key) => (
        <section key={key} className="mb-4">
          {key === "summary" && draft.summary && (
            <>
              <h2 className="mb-1 text-xs font-bold uppercase border-b border-black">PROFESSIONAL SUMMARY</h2>
              <p className="text-xs">{draft.summary}</p>
            </>
          )}
          {key === "education" && draft.education.items.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-bold uppercase border-b border-black">EDUCATION</h2>
              {draft.education.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-1 text-xs">
                  <div><strong>{item.organization}</strong></div>
                  <div>{item.role} | {item.endDate}</div>
                </div>
              ))}
            </>
          )}
          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-bold uppercase border-b border-black">WORK EXPERIENCE</h2>
              {draft.workExperience.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2">
                  <div className="text-xs"><strong>{item.role}</strong> | {item.organization}</div>
                  <div className="text-xs">{item.startDate} - {item.endDate}</div>
                  {item.bullets.length > 0 && (
                    <ul className="list-disc list-inside text-xs">
                      {item.bullets.map((b, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: b.text }} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
          {key === "projects" && draft.projects.items.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-bold uppercase border-b border-black">PROJECTS</h2>
              {draft.projects.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2">
                  <div className="text-xs"><strong>{item.role}</strong> | {item.organization}</div>
                  <div className="text-xs">{item.startDate} - {item.endDate}</div>
                  {item.bullets.length > 0 && (
                    <ul className="list-disc list-inside text-xs">
                      {item.bullets.map((b, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: b.text }} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
          {key === "skills" && draft.skills.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-bold uppercase border-b border-black">SKILLS</h2>
              <div className="text-xs">{draft.skills.join(", ")}</div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
