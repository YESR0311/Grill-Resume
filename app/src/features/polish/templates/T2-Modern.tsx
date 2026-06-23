import type { ResumeDraft, ResumeStyle } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";
import { getTemplateDesign } from "../template-style";

/**
 * T2-Modern 模板：四象限布局版
 *
 * 特点：
 * - 智能·科技主题（紫罗兰 + 顶/底色条）
 * - 四象限布局：左上姓名+联系 / 右上证件照 / 左下经历 / 右下其他
 * - 适合互联网/科技行业
 */

interface T2ModernProps {
  draft: ResumeDraft;
  style: ResumeStyle;
}

export function T2Modern({ draft, style }: T2ModernProps) {
  const design = getTemplateDesign("t2-modern");
  const sheetStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineSpacing,
    color: style.colorScheme.text,
    padding: `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`,
  };

  // 四象限布局：A(姓名+联系) B(证件照) C(经历) D(其他)
  return (
    <div className="relative" style={sheetStyle}>
      {/* 顶部强调色条 */}
      <div
        className="absolute left-0 top-0 right-0 h-2"
        style={{ backgroundColor: style.colorScheme.primary }}
      />

      {/* 第一行：姓名信息 + 证件照（flex 兄弟非 absolute，min-w-0 防止姓名撑爆） */}
      <div className="mt-6 mb-4 flex items-start gap-4">
        {/* 左上象限：姓名 + 联系信息 */}
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: style.colorScheme.primary }}
          >
            {draft.name}
          </h1>
          {draft.title && (
            <p className="text-base mb-2" style={{ color: style.colorScheme.accent }}>
              {draft.title}
            </p>
          )}
          <div className="space-y-1 text-sm" style={{ color: style.colorScheme.accent }}>
            {draft.email && <p>{draft.email}</p>}
            {draft.phone && <p>{draft.phone}</p>}
          </div>
        </div>

        {/* 右上象限：证件照占位符（仅 photo != "none"） */}
        {design.photo !== "none" && (
          <PhotoPlaceholder position={design.photo} primary={style.colorScheme.primary} />
        )}
      </div>

      {/* 分隔线 */}
      <div className="mb-4 h-px" style={{ backgroundColor: style.colorScheme.primary }} />

      {/* 第二行：经历模块（左下） + 其他模块（右下） */}
      <div className="flex gap-4">
        {/* 左下象限：工作经历 + 项目经历 */}
        <div className="flex-1">
          {style.sectionOrder.map((key) => {
            if (key === "workExperience" && draft.workExperience.items.length > 0) {
              return (
                <section key={key} className="mb-4">
                  <h2
                    className="mb-2 text-sm font-semibold uppercase tracking-wider"
                    style={{ color: style.colorScheme.primary }}
                  >
                    {draft.workExperience.title || "工作经历"}
                  </h2>
                  {draft.workExperience.items.map((item, idx) => (
                    <div key={item.id || idx} className="mb-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="font-semibold text-sm" style={{ color: style.colorScheme.primary }}>
                          {item.role}
                        </div>
                        <div className="text-xs" style={{ color: style.colorScheme.accent }}>
                          {item.startDate} - {item.endDate}
                        </div>
                      </div>
                      <div className="text-sm mb-1" style={{ color: style.colorScheme.accent, fontStyle: "italic" }}>
                        {item.organization}
                      </div>
                      {item.bullets.length > 0 && (
                        <ul className="space-y-1">
                          {item.bullets.map((bullet, i) => (
                            <li key={i} className="text-sm flex items-start">
                              <span
                                className="mr-2 mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: style.colorScheme.primary }}
                              />
                              <span dangerouslySetInnerHTML={{ __html: bullet.text }} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </section>
              );
            }

            if (key === "projects" && draft.projects.items.length > 0) {
              return (
                <section key={key} className="mb-4">
                  <h2
                    className="mb-2 text-sm font-semibold uppercase tracking-wider"
                    style={{ color: style.colorScheme.primary }}
                  >
                    {draft.projects.title || "项目经历"}
                  </h2>
                  {draft.projects.items.map((item, idx) => (
                    <div key={item.id || idx} className="mb-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="font-semibold text-sm" style={{ color: style.colorScheme.primary }}>
                          {item.role}
                        </div>
                        <div className="text-xs" style={{ color: style.colorScheme.accent }}>
                          {item.startDate} - {item.endDate}
                        </div>
                      </div>
                      {item.organization && (
                        <div className="text-sm mb-1" style={{ color: style.colorScheme.accent, fontStyle: "italic" }}>
                          {item.organization}
                        </div>
                      )}
                      {item.bullets.length > 0 && (
                        <ul className="space-y-1">
                          {item.bullets.map((bullet, i) => (
                            <li key={i} className="text-sm flex items-start">
                              <span
                                className="mr-2 mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: style.colorScheme.primary }}
                              />
                              <span dangerouslySetInnerHTML={{ __html: bullet.text }} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </section>
              );
            }

            return null;
          })}
        </div>

        {/* 右下象限：简介 + 技能 + 教育 */}
        <div className="w-2/5">
          {style.sectionOrder.map((key) => {
            if (key === "summary" && draft.summary) {
              return (
                <section key={key} className="mb-4">
                  <h2
                    className="mb-2 text-sm font-semibold uppercase tracking-wider"
                    style={{ color: style.colorScheme.primary }}
                  >
                    个人简介
                  </h2>
                  <p className="text-sm">{draft.summary}</p>
                </section>
              );
            }

            if (key === "skills" && draft.skills.length > 0) {
              return (
                <section key={key} className="mb-4">
                  <h2
                    className="mb-2 text-sm font-semibold uppercase tracking-wider"
                    style={{ color: style.colorScheme.primary }}
                  >
                    技能
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {draft.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-2 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: `${style.colorScheme.primary}15`,
                          color: style.colorScheme.primary,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              );
            }

            if (key === "education" && draft.education.items.length > 0) {
              return (
                <section key={key} className="mb-4">
                  <h2
                    className="mb-2 text-sm font-semibold uppercase tracking-wider"
                    style={{ color: style.colorScheme.primary }}
                  >
                    {draft.education.title || "教育背景"}
                  </h2>
                  {draft.education.items.map((item, idx) => (
                    <div key={item.id || idx} className="mb-2">
                      <div className="font-semibold text-sm">{item.organization}</div>
                      <div className="text-xs" style={{ color: style.colorScheme.accent }}>
                        {item.role}
                      </div>
                      <div className="text-xs" style={{ color: style.colorScheme.accent }}>
                        {item.endDate}
                      </div>
                    </div>
                  ))}
                </section>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
