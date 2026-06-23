import type { ResumeDraft, ResumeStyle } from "../types";
import { TopHeader } from "./TopHeader";
import { getTemplateDesign } from "../template-style";

/**
 * T4-Compact 模板：时序·紧凑版
 *
 * 特点：黑蓝·ATS 紧凑主题，1.4 倍行距，信息密度高。
 * 证件照位置：右上角。
 */

export function T4Compact({ draft, style }: { draft: ResumeDraft; style: ResumeStyle }) {
  const design = getTemplateDesign("t4-compact");
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };

  return (
    <div className="relative" style={sheetStyle}>
      <TopHeader draft={draft} style={style} photo={design.photo} variant="compact" />
      {style.sectionOrder.map((key) => (
        <section key={key} className="mb-3">
          {key === "summary" && draft.summary && (
            <>
              <h2 className="mb-1 text-xs font-semibold uppercase" style={{ color: style.colorScheme.primary }}>个人简介</h2>
              <p className="text-xs">{draft.summary}</p>
            </>
          )}
          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-semibold uppercase" style={{ color: style.colorScheme.primary }}>
                {draft.workExperience.title || "工作经历"}
              </h2>
              {draft.workExperience.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{item.role} · {item.organization}</span>
                    <span>{item.startDate} - {item.endDate}</span>
                  </div>
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
              <h2 className="mb-1 text-xs font-semibold uppercase" style={{ color: style.colorScheme.primary }}>
                {draft.projects.title || "项目经历"}
              </h2>
              {draft.projects.items.map((item, idx) => (
                <div key={item.id || idx} className="mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{item.role} · {item.organization}</span>
                    <span>{item.startDate} - {item.endDate}</span>
                  </div>
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
          {key === "education" && draft.education.items.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-semibold uppercase" style={{ color: style.colorScheme.primary }}>
                {draft.education.title || "教育背景"}
              </h2>
              {draft.education.items.map((item, idx) => (
                <div key={item.id || idx} className="text-xs flex justify-between mb-1">
                  <span><strong>{item.organization}</strong> {item.role}</span>
                  <span>{item.endDate}</span>
                </div>
              ))}
            </>
          )}
          {key === "skills" && draft.skills.length > 0 && (
            <>
              <h2 className="mb-1 text-xs font-semibold uppercase" style={{ color: style.colorScheme.primary }}>技能</h2>
              <div className="text-xs">{draft.skills.join(" · ")}</div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
