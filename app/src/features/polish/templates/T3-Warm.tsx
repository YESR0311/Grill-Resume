import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/**
 * T3-Warm 模板：时序·暖色版
 *
 * 特点：
 * - Playfair Display 衬线标题，暖色系
 * - 适合创意/设计/市场岗
 * - 证件照位置：右上角
 */

interface T3WarmProps {
  draft: ResumeDraft;
  style: ResumeStyle;
}

export function T3Warm({ draft, style }: T3WarmProps) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
    backgroundColor: "#FBF9F5", // 暖白背景
  };

  return (
    <div className="relative" style={sheetStyle}>
      <PhotoPlaceholder position="right" />

      <header className="mb-6 text-center">
        <h1
          className="text-4xl mb-2"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 600,
            fontStyle: "italic",
            color: style.colorScheme.primary,
          }}
        >
          {draft.name}
        </h1>
        <div
          className="text-base mb-1"
          style={{ color: style.colorScheme.accent }}
        >
          {draft.title}
        </div>
        <div
          className="text-sm flex gap-4 justify-center"
          style={{ color: style.colorScheme.accent }}
        >
          {draft.email && <span>{draft.email}</span>}
          {draft.phone && <span>{draft.phone}</span>}
        </div>
      </header>

      {style.sectionOrder.map((key) => (
        <section key={key} className="mb-5">
          {key === "summary" && draft.summary && (
            <>
              <SectionTitle text="个人简介" color={style.colorScheme.primary} />
              <p className="text-sm">{draft.summary}</p>
            </>
          )}

          {key === "workExperience" && draft.workExperience.items.length > 0 && (
            <>
              <SectionTitle
                text={draft.workExperience.title || "工作经历"}
                color={style.colorScheme.primary}
              />
              {draft.workExperience.items.map((item, idx) => (
                <ExperienceItem key={item.id || idx} item={item} style={style} />
              ))}
            </>
          )}

          {key === "projects" && draft.projects.items.length > 0 && (
            <>
              <SectionTitle
                text={draft.projects.title || "项目经历"}
                color={style.colorScheme.primary}
              />
              {draft.projects.items.map((item, idx) => (
                <ExperienceItem key={item.id || idx} item={item} style={style} />
              ))}
            </>
          )}

          {key === "education" && draft.education.items.length > 0 && (
            <>
              <SectionTitle
                text={draft.education.title || "教育背景"}
                color={style.colorScheme.primary}
              />
              {draft.education.items.map((item, idx) => (
                <EducationItem key={item.id || idx} item={item} />
              ))}
            </>
          )}

          {key === "skills" && draft.skills.length > 0 && (
            <>
              <SectionTitle text="技能" color={style.colorScheme.primary} />
              <div className="flex flex-wrap gap-2">
                {draft.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-3 py-1.5 text-xs rounded-full"
                    style={{
                      backgroundColor: "#F2E3D6", // accent-tint
                      color: style.colorScheme.primary,
                      fontWeight: 500,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

function SectionTitle({ text, color }: { text: string; color: string }) {
  return (
    <h2
      className="mb-3 pb-1.5 text-base font-semibold tracking-wide"
      style={{
        fontFamily: "'Playfair Display', serif",
        color,
        borderBottom: `2px solid ${color}`,
      }}
    >
      {text}
    </h2>
  );
}

interface ExperienceItemProps {
  item: {
    organization: string;
    role: string;
    startDate: string;
    endDate: string;
    bullets: Array<{ text: string }>;
  };
  style: ResumeStyle;
}

function ExperienceItem({ item, style }: ExperienceItemProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <div className="font-semibold text-base" style={{ color: style.colorScheme.primary }}>
          {item.role}
        </div>
        <div className="text-xs" style={{ color: style.colorScheme.accent }}>
          {item.startDate} - {item.endDate}
        </div>
      </div>
      <div className="text-sm mb-2" style={{ color: style.colorScheme.accent, fontStyle: "italic" }}>
        {item.organization}
      </div>
      {item.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {item.bullets.map((bullet, idx) => (
            <li key={idx} className="text-sm flex items-start">
              <span
                className="mr-2 mt-2 inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: style.colorScheme.primary }}
              />
              <span dangerouslySetInnerHTML={{ __html: bullet.text }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface EducationItemProps {
  item: {
    organization: string;
    role: string;
    endDate: string;
  };
}

function EducationItem({ item }: EducationItemProps) {
  return (
    <div className="mb-2 flex justify-between items-baseline">
      <div>
        <span className="font-semibold text-sm">{item.organization}</span>
        <span className="text-sm text-muted-foreground ml-2">{item.role}</span>
      </div>
      <div className="text-xs text-muted-foreground">{item.endDate}</div>
    </div>
  );
}
