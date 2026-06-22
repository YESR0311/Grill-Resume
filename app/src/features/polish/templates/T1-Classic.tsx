import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/**
 * T1-Classic 模板：时序·简约版
 *
 * 特点：
 * - 黑白极简，Helvetica 无衬线
 * - ATS 友好，适合大多数岗位
 * - 证件照位置：右上角
 */

interface T1ClassicProps {
  draft: ResumeDraft;
  style: ResumeStyle;
}

export function T1Classic({ draft, style }: T1ClassicProps) {
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };

  return (
    <div className="relative bg-white" style={sheetStyle}>
      {/* 证件照占位符 */}
      <PhotoPlaceholder position="right" />

      {/* 顶部基础信息 */}
      <header className="mb-6">
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

      {/* 按 sectionOrder 渲染各模块 */}
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
                <ExperienceItem key={item.id || idx} item={item} />
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
                <ExperienceItem key={item.id || idx} item={item} />
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
  );
}

// ────────────────────────────────────────────────────────────
// 子组件
// ────────────────────────────────────────────────────────────

function SectionTitle({ text, color }: { text: string; color: string }) {
  return (
    <h2
      className="mb-2 border-b pb-1 text-sm font-semibold uppercase tracking-wider"
      style={{ color, borderColor: color }}
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
}

function ExperienceItem({ item }: ExperienceItemProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <div className="font-semibold text-sm">{item.role}</div>
        <div className="text-xs text-muted-foreground">
          {item.startDate} - {item.endDate}
        </div>
      </div>
      <div className="text-sm text-muted-foreground mb-1">
        {item.organization}
      </div>
      {item.bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-1">
          {item.bullets.map((bullet, idx) => (
            <li key={idx} className="text-sm" dangerouslySetInnerHTML={{ __html: bullet.text }} />
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
