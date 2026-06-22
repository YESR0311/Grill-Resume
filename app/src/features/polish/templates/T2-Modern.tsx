import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/**
 * T2-Modern 模板：时序·现代版
 *
 * 特点：
 * - 单侧强调色条，Inter 字体
 * - 适合互联网/科技行业
 * - 证件照位置：左上角
 */

interface T2ModernProps {
  draft: ResumeDraft;
  style: ResumeStyle;
}

export function T2Modern({ draft, style }: T2ModernProps) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };

  return (
    <div className="relative bg-white" style={sheetStyle}>
      {/* 左侧强调色条 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: style.colorScheme.primary }}
      />

      {/* 证件照占位符 */}
      <PhotoPlaceholder position="left" />

      {/* 顶部基础信息 */}
      <header className="mb-6 ml-4">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: style.colorScheme.primary }}
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
          className="text-sm flex gap-4"
          style={{ color: style.colorScheme.accent }}
        >
          {draft.email && <span>{draft.email}</span>}
          {draft.phone && <span>{draft.phone}</span>}
        </div>
      </header>

      {/* 内容区域 */}
      <div className="ml-4">
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
                      className="inline-block px-2 py-1 text-xs rounded"
                      style={{
                        backgroundColor: `${style.colorScheme.primary}1a`,
                        color: style.colorScheme.text,
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
    </div>
  );
}

function SectionTitle({ text, color }: { text: string; color: string }) {
  return (
    <h2
      className="mb-2 text-sm font-semibold uppercase tracking-wider"
      style={{ color }}
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
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <div className="font-semibold text-sm" style={{ color: style.colorScheme.primary }}>
          {item.role}
        </div>
        <div className="text-xs" style={{ color: style.colorScheme.accent }}>
          {item.startDate} - {item.endDate}
        </div>
      </div>
      <div className="text-sm mb-1" style={{ color: style.colorScheme.accent }}>
        {item.organization}
      </div>
      {item.bullets.length > 0 && (
        <ul className="space-y-1">
          {item.bullets.map((bullet, idx) => (
            <li key={idx} className="text-sm flex items-start">
              <span
                className="mr-2 mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: style.colorScheme.accent }}
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
