import React, { forwardRef, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mail, Phone, MapPin, Globe, Github, Linkedin, Terminal, ExternalLink } from 'lucide-react';
import type { ParsedResume } from '@/lib/resumeTemplates';
import type { ThemeStyle } from './MarkdownRenderer';

// ============================================================================
// 主题配置系统
// ============================================================================

interface ThemeConfig {
  name: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary: string;
    muted: string;
    accent: string;
    border: string;
    background: string;
  };
  spacing: {
    sectionGap: string;
    itemGap: string;
    tight: boolean;
  };
  typography: {
    headingSize: string;
    bodySize: string;
    lineHeight: string;
  };
  decorations: {
    sectionBorder: boolean;
    sectionPrefix: string;
    skillBadge: boolean;
    listStyle: 'disc' | 'arrow' | 'none';
  };
}

const THEME_CONFIGS: Record<ThemeStyle, ThemeConfig> = {
  minimal: {
    name: 'The Minimalist',
    fonts: {
      heading: 'Inter, system-ui, -apple-system, sans-serif',
      body: 'Inter, system-ui, -apple-system, sans-serif',
    },
    colors: {
      primary: '#111827',
      secondary: '#4b5563',
      muted: '#9ca3af',
      accent: '#6b7280',
      border: '#e5e7eb',
      background: '#ffffff',
    },
    spacing: {
      sectionGap: '28px',
      itemGap: '20px',
      tight: false,
    },
    typography: {
      headingSize: '11px',
      bodySize: '13px',
      lineHeight: '1.7',
    },
    decorations: {
      sectionBorder: false,
      sectionPrefix: '',
      skillBadge: false,
      listStyle: 'disc',
    },
  },
  elite: {
    name: 'The Elite',
    fonts: {
      heading: 'Merriweather, Georgia, serif',
      body: '"Source Sans 3", "Source Sans Pro", system-ui, sans-serif',
    },
    colors: {
      primary: '#111827',
      secondary: '#374151',
      muted: '#4b5563',
      accent: '#1d4ed8',
      border: '#d1d5db',
      background: '#ffffff',
    },
    spacing: {
      sectionGap: '18px',
      itemGap: '14px',
      tight: true,
    },
    typography: {
      headingSize: '16px',
      bodySize: '13px',
      lineHeight: '1.5',
    },
    decorations: {
      sectionBorder: true,
      sectionPrefix: '',
      skillBadge: false,
      listStyle: 'disc',
    },
  },
  geek: {
    name: 'The Geek',
    fonts: {
      heading: '"JetBrains Mono", "Fira Code", Consolas, monospace',
      body: '"JetBrains Mono", "Fira Code", Consolas, monospace',
    },
    colors: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#64748b',
      accent: '#4f46e5',
      border: '#e2e8f0',
      background: '#ffffff',
    },
    spacing: {
      sectionGap: '18px',
      itemGap: '14px',
      tight: true,
    },
    typography: {
      headingSize: '13px',
      bodySize: '11px',
      lineHeight: '1.5',
    },
    decorations: {
      sectionBorder: false,
      sectionPrefix: '## ',
      skillBadge: true,
      listStyle: 'arrow',
    },
  },
};

// ============================================================================
// 通用组件
// ============================================================================

interface SectionProps {
  title: string;
  theme: ThemeConfig;
  themeStyle: ThemeStyle;
  children: ReactNode;
  show?: boolean;
}

function Section({ title, theme, themeStyle, children, show = true }: SectionProps) {
  if (!show) return null;

  return (
    <section 
      className="resume-section"
      style={{ 
        marginBottom: theme.spacing.sectionGap,
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      }}
    >
      <h2 style={{
        fontSize: theme.typography.headingSize,
        fontWeight: 700,
        fontFamily: theme.fonts.heading,
        color: themeStyle === 'minimal' ? theme.colors.muted : theme.colors.primary,
        letterSpacing: themeStyle === 'minimal' ? '0.1em' : 'normal',
        textTransform: themeStyle === 'minimal' ? 'uppercase' : 'none',
        marginBottom: theme.spacing.tight ? '10px' : '14px',
        paddingBottom: theme.decorations.sectionBorder ? '4px' : '0',
        borderBottom: theme.decorations.sectionBorder ? `1px solid ${theme.colors.border}` : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {theme.decorations.sectionPrefix && (
          <span style={{ color: theme.colors.muted }}>{theme.decorations.sectionPrefix.replace('## ', '##')}</span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}

// Markdown 渲染组件 - 适配不同主题
function MarkdownContent({
  content,
  theme,
  themeStyle,
}: {
  content: string;
  theme: ThemeConfig;
  themeStyle: ThemeStyle;
}) {
  const components = useMemo(
    () => ({
      p: ({ children }: { children?: ReactNode }) => (
        <p
          style={{
            marginBottom: '6px',
            fontSize: theme.typography.bodySize,
            color: theme.colors.secondary,
            lineHeight: theme.typography.lineHeight,
          }}
        >
          {children}
        </p>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong style={{ fontWeight: 600, color: theme.colors.primary }}>{children}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
      ul: ({ children }: { children?: ReactNode }) => (
        <ul
          style={{
            listStyleType: theme.decorations.listStyle === 'disc' ? 'disc' : 'none',
            paddingLeft: theme.decorations.listStyle === 'disc' ? '18px' : '0',
            margin: '6px 0',
          }}
        >
          {children}
        </ul>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li
          style={{
            fontSize: theme.typography.bodySize,
            color: theme.colors.secondary,
            lineHeight: theme.typography.lineHeight,
            marginBottom: theme.spacing.tight ? '3px' : '5px',
            display: theme.decorations.listStyle === 'arrow' ? 'flex' : 'list-item',
          }}
        >
          {theme.decorations.listStyle === 'arrow' && (
            <span style={{ color: '#10b981', marginRight: '8px', flexShrink: 0 }}>→</span>
          )}
          <span>{children}</span>
        </li>
      ),
      code: ({ children }: { children?: ReactNode }) => (
        <code
          style={{
            backgroundColor: themeStyle === 'geek' ? '#f1f5f9' : '#f3f4f6',
            color: themeStyle === 'geek' ? '#db2777' : theme.colors.primary,
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: `calc(${theme.typography.bodySize} - 1px)`,
            fontFamily: themeStyle === 'geek' ? theme.fonts.body : 'inherit',
          }}
        >
          {children}
        </code>
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a href={href} style={{ color: theme.colors.accent, textDecoration: 'underline' }}>
          {children}
        </a>
      ),
    }),
    [theme, themeStyle]
  );

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// 高亮列表项（解析 Markdown）
function HighlightItem({
  text,
  theme,
  themeStyle,
}: {
  text: string;
  theme: ThemeConfig;
  themeStyle: ThemeStyle;
}) {
  // 清理列表前缀
  const cleanText = text.replace(/^[-•*]\s*/, '');

  const components = useMemo(
    () => ({
      p: ({ children }: { children?: ReactNode }) => <>{children}</>,
      strong: ({ children }: { children?: ReactNode }) => (
        <strong style={{ fontWeight: 700, color: theme.colors.primary }}>{children}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
      code: ({ children }: { children?: ReactNode }) => (
        <code
          style={{
            backgroundColor: themeStyle === 'geek' ? '#f1f5f9' : '#f3f4f6',
            color: themeStyle === 'geek' ? '#db2777' : theme.colors.primary,
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: `calc(${theme.typography.bodySize} - 1px)`,
            fontFamily: themeStyle === 'geek' ? theme.fonts.body : 'inherit',
          }}
        >
          {children}
        </code>
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a href={href} style={{ color: theme.colors.accent, textDecoration: 'underline' }}>
          {children}
        </a>
      ),
      // 处理嵌套列表元素 - 直接展示内容
      ul: ({ children }: { children?: ReactNode }) => <>{children}</>,
      ol: ({ children }: { children?: ReactNode }) => <>{children}</>,
      li: ({ children }: { children?: ReactNode }) => <>{children}</>,
    }),
    [theme, themeStyle]
  );

  return (
    <span className="markdown-content highlight-item">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleanText}
      </ReactMarkdown>
    </span>
  );
}

// 单行/行内 Markdown（用于标题、职位等字段）
function InlineMarkdown({
  text,
  theme,
  themeStyle,
}: {
  text: string;
  theme: ThemeConfig;
  themeStyle: ThemeStyle;
}) {
  if (!text) return null;

  // 移除 allowedElements 限制，让所有 Markdown 都能正确解析
  return (
    <span className="markdown-content inline-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }: { children?: ReactNode }) => <>{children}</>,
          strong: ({ children }: { children?: ReactNode }) => (
            <strong style={{ fontWeight: 700, color: theme.colors.primary }}>{children}</strong>
          ),
          em: ({ children }: { children?: ReactNode }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
          code: ({ children }: { children?: ReactNode }) => (
            <code
              style={{
                backgroundColor: themeStyle === 'geek' ? '#f1f5f9' : '#f3f4f6',
                color: themeStyle === 'geek' ? '#db2777' : theme.colors.primary,
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: '0.95em',
                fontFamily: themeStyle === 'geek' ? theme.fonts.body : 'inherit',
              }}
            >
              {children}
            </code>
          ),
          a: ({ href, children }: { href?: string; children?: ReactNode }) => (
            <a href={href} style={{ color: theme.colors.accent, textDecoration: 'underline' }}>
              {children}
            </a>
          ),
          ul: ({ children }: { children?: ReactNode }) => <>{children}</>,
          ol: ({ children }: { children?: ReactNode }) => <>{children}</>,
          li: ({ children }: { children?: ReactNode }) => <>{children}</>,
        }}
      >
        {text}
      </ReactMarkdown>
    </span>
  );
}

// ============================================================================
// 主题化简历组件
// ============================================================================

interface ThemedResumeProps {
  data: ParsedResume;
  themeStyle: ThemeStyle;
}

export const ThemedResume = forwardRef<HTMLDivElement, ThemedResumeProps>(
  ({ data, themeStyle }, ref) => {
    const theme = THEME_CONFIGS[themeStyle];

    // 计算内容密度
    const contentDensity = useMemo(() => {
      const expCount = data.experience.length;
      const highlightsCount = data.experience.reduce((acc, exp) => acc + exp.highlights.length, 0);
      const eduCount = data.education.length;
      const skillsCount = data.skills.length;
      const projectsCount = data.projects?.length || 0;

      const total = expCount * 3 + highlightsCount + eduCount * 2 + skillsCount * 0.5 + projectsCount * 2;
      
      if (total > 25) return 'high';
      if (total > 15) return 'medium';
      return 'low';
    }, [data]);

    // 动态调整间距
    const dynamicGap = contentDensity === 'high' ? '14px' : contentDensity === 'medium' ? '20px' : '28px';

    // 检查模块是否有内容
    const hasExperience = data.experience.length > 0 && data.experience.some(e => e.company || e.role);
    const hasEducation = data.education.length > 0 && data.education.some(e => e.school);
    const hasSkills = data.skills.length > 0;
    const hasProjects = data.projects && data.projects.length > 0 && data.projects.some(p => p.name);
    const hasSummary = !!data.summary?.trim();

    return (
      <div
        ref={ref}
        className="resume-a4"
        style={{
          padding: '20mm',
          fontFamily: theme.fonts.body,
          color: theme.colors.primary,
          fontSize: theme.typography.bodySize,
          lineHeight: theme.typography.lineHeight,
          backgroundColor: theme.colors.background,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '297mm',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <ResumeHeader data={data} theme={theme} themeStyle={themeStyle} />

        {/* 主体内容 - Flexbox 流式布局 */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: dynamicGap,
          flex: 1,
        }}>
          {/* 个人简介 */}
          {hasSummary && (
            <Section title={themeStyle === 'geek' ? 'About' : 'Summary'} theme={theme} themeStyle={themeStyle}>
              <MarkdownContent content={data.summary} theme={theme} themeStyle={themeStyle} />
            </Section>
          )}

          {/* 工作经历 - 核心内容，可伸缩 */}
          <Section 
            title={themeStyle === 'elite' ? 'Professional Experience' : themeStyle === 'geek' ? 'Experience' : 'Work Experience'}
            theme={theme} 
            themeStyle={themeStyle}
            show={hasExperience}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.itemGap }}>
              {data.experience.map((exp, index) => (
                <ExperienceItem key={index} exp={exp} theme={theme} themeStyle={themeStyle} />
              ))}
            </div>
          </Section>

          {/* 项目经验 */}
          {hasProjects && (
            <Section title="Projects" theme={theme} themeStyle={themeStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.itemGap }}>
                {data.projects!.map((project, index) => (
                  <ProjectItem key={index} project={project} theme={theme} themeStyle={themeStyle} />
                ))}
              </div>
            </Section>
          )}

          {/* 教育背景 */}
          <Section title="Education" theme={theme} themeStyle={themeStyle} show={hasEducation}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.tight ? '8px' : '12px' }}>
              {data.education.map((edu, index) => (
                <EducationItem key={index} edu={edu} theme={theme} themeStyle={themeStyle} />
              ))}
            </div>
          </Section>

          {/* 专业技能 */}
          <Section title="Skills" theme={theme} themeStyle={themeStyle} show={hasSkills}>
            <SkillsDisplay skills={data.skills} theme={theme} themeStyle={themeStyle} />
          </Section>
        </div>

        {/* Geek 主题 Footer */}
        {themeStyle === 'geek' && (
          <footer style={{
            marginTop: '20px',
            paddingTop: '12px',
            borderTop: `1px solid ${theme.colors.border}`,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '10px', color: theme.colors.muted }}>
              {'// Generated with Resume Alchemist'}
            </p>
          </footer>
        )}
      </div>
    );
  }
);

ThemedResume.displayName = 'ThemedResume';

// ============================================================================
// 子组件
// ============================================================================

function ResumeHeader({ data, theme, themeStyle }: { data: ParsedResume; theme: ThemeConfig; themeStyle: ThemeStyle }) {
  const IconComponent = themeStyle === 'geek' ? Terminal : null;

  if (themeStyle === 'minimal') {
    return (
      <header style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: theme.colors.primary,
          marginBottom: '10px',
          fontFamily: theme.fonts.heading,
        }}>
          {data.name}
        </h1>
        {data.title && (
          <p style={{ fontSize: '16px', color: theme.colors.secondary, marginBottom: '14px' }}>
            <InlineMarkdown text={data.title} theme={theme} themeStyle={themeStyle} />
          </p>
        )}
        <ContactInfo data={data} theme={theme} themeStyle={themeStyle} />
      </header>
    );
  }

  if (themeStyle === 'elite') {
    return (
      <header style={{
        marginBottom: '20px',
        paddingBottom: '14px',
        borderBottom: `2px solid ${theme.colors.primary}`,
      }}>
        <h1 style={{
          fontSize: '26px',
          fontWeight: 700,
          fontFamily: theme.fonts.heading,
          color: theme.colors.primary,
          marginBottom: '6px',
        }}>
          {data.name}
        </h1>
        <ContactInfo data={data} theme={theme} themeStyle={themeStyle} />
      </header>
    );
  }

  // Geek theme
  return (
    <header style={{
      marginBottom: '20px',
      padding: '14px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Terminal style={{ width: '18px', height: '18px', color: theme.colors.muted }} />
        <span style={{ fontSize: '12px', color: theme.colors.muted }}>~/resume</span>
      </div>
      <h1 style={{
        fontSize: '22px',
        fontWeight: 700,
        color: theme.colors.primary,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: theme.fonts.heading,
      }}>
        <span style={{ color: '#10b981' }}>{'>'}_</span>
        {data.name}
      </h1>
      {data.title && (
        <p style={{ color: theme.colors.secondary, marginLeft: '26px', fontSize: '13px' }}>
          <InlineMarkdown text={data.title} theme={theme} themeStyle={themeStyle} />
        </p>
      )}
      <div style={{ marginLeft: '26px', marginTop: '10px' }}>
        <ContactInfo data={data} theme={theme} themeStyle={themeStyle} />
      </div>
    </header>
  );
}

function ContactInfo({ data, theme, themeStyle }: { data: ParsedResume; theme: ThemeConfig; themeStyle: ThemeStyle }) {
  const iconSize = themeStyle === 'geek' ? 12 : 14;
  const fontSize = themeStyle === 'geek' ? '11px' : '13px';

  // 图标样式 - 确保垂直居中
  const iconStyle: React.CSSProperties = {
    width: iconSize,
    height: iconSize,
    flexShrink: 0,
  };

  // 联系项样式 - 使用 inline-flex 确保对齐
  const contactItemStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: themeStyle === 'minimal' ? 'center' : 'flex-start',
      gap: themeStyle === 'geek' ? '10px' : '14px',
      fontSize,
      color: theme.colors.muted,
    }}>
      {data.email && (
        <span style={contactItemStyle}>
          <Mail style={iconStyle} />
          <span>{data.email}</span>
        </span>
      )}
      {data.phone && (
        <>
          {themeStyle === 'minimal' && <span style={{ color: theme.colors.border }}>·</span>}
          <span style={contactItemStyle}>
            <Phone style={iconStyle} />
            <span>{data.phone}</span>
          </span>
        </>
      )}
      {data.location && (
        <>
          {themeStyle === 'minimal' && <span style={{ color: theme.colors.border }}>·</span>}
          <span style={contactItemStyle}>
            <MapPin style={iconStyle} />
            <span>{data.location}</span>
          </span>
        </>
      )}
      {data.links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          style={{
            ...contactItemStyle,
            color: themeStyle === 'minimal' ? theme.colors.muted : theme.colors.accent,
            textDecoration: themeStyle === 'elite' ? 'underline' : 'none',
          }}
        >
          {themeStyle === 'minimal' && <span style={{ color: theme.colors.border, marginRight: '4px' }}>·</span>}
          {link.label === 'GitHub' ? (
            <Github style={iconStyle} />
          ) : link.label === 'LinkedIn' ? (
            <Linkedin style={iconStyle} />
          ) : (
            themeStyle === 'elite' ? <ExternalLink style={iconStyle} /> : <Globe style={iconStyle} />
          )}
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}

function ExperienceItem({ exp, theme, themeStyle }: { exp: ParsedResume['experience'][0]; theme: ThemeConfig; themeStyle: ThemeStyle }) {
  const hasHighlights = exp.highlights && exp.highlights.length > 0;

  return (
    <div style={{ 
      borderLeft: themeStyle === 'geek' ? `2px solid ${theme.colors.border}` : 'none',
      paddingLeft: themeStyle === 'geek' ? '14px' : '0',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '6px',
        flexWrap: 'wrap',
        gap: '4px',
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h3 style={{
            fontWeight: themeStyle === 'geek' ? 700 : 600,
            color: theme.colors.primary,
            fontSize: themeStyle === 'geek' ? '12px' : '14px',
            fontFamily: themeStyle === 'elite' ? theme.fonts.heading : theme.fonts.body,
          }}>
            <InlineMarkdown text={themeStyle === 'geek' ? exp.role : exp.company} theme={theme} themeStyle={themeStyle} />
            {themeStyle === 'elite' && exp.location && (
              <span style={{ fontWeight: 400, color: theme.colors.secondary }}> — {exp.location}</span>
            )}
          </h3>
          <p
            style={{
              fontSize: theme.typography.bodySize,
              color: theme.colors.secondary,
              fontStyle: themeStyle === 'elite' ? 'italic' : 'normal',
            }}
          >
            <InlineMarkdown text={themeStyle === 'geek' ? exp.company : exp.role} theme={theme} themeStyle={themeStyle} />
          </p>
        </div>
        {themeStyle === 'geek' ? (
          <code style={{
            fontSize: '10px',
            backgroundColor: '#f1f5f9',
            color: theme.colors.secondary,
            padding: '2px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            {exp.period}
          </code>
        ) : (
          <span style={{ 
            fontSize: theme.typography.bodySize, 
            color: theme.colors.muted, 
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}>
            {exp.period}
          </span>
        )}
      </div>

      {hasHighlights && (
        <ul style={{
          marginTop: '6px',
          paddingLeft: theme.decorations.listStyle === 'disc' ? '18px' : '0',
          listStyleType: theme.decorations.listStyle === 'disc' ? 'disc' : 'none',
        }}>
          {exp.highlights.map((item, i) => (
            <li key={i} style={{
              fontSize: theme.typography.bodySize,
              color: theme.colors.secondary,
              lineHeight: theme.typography.lineHeight,
              marginBottom: theme.spacing.tight ? '3px' : '5px',
              display: theme.decorations.listStyle === 'arrow' ? 'flex' : 'list-item',
            }}>
              {theme.decorations.listStyle === 'arrow' && (
                <span style={{ color: '#10b981', marginRight: '8px', flexShrink: 0 }}>→</span>
              )}
              {themeStyle === 'minimal' && theme.decorations.listStyle !== 'disc' && (
                <span style={{ color: theme.colors.muted, marginRight: '8px' }}>•</span>
              )}
              <span><HighlightItem text={item} theme={theme} themeStyle={themeStyle} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectItem({ project, theme, themeStyle }: { project: NonNullable<ParsedResume['projects']>[0]; theme: ThemeConfig; themeStyle: ThemeStyle }) {
  return (
    <div style={{
      borderLeft: themeStyle === 'geek' ? `2px solid ${theme.colors.border}` : 'none',
      paddingLeft: themeStyle === 'geek' ? '14px' : '0',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    }}>
      <h3 style={{
        fontWeight: 600,
        color: theme.colors.primary,
        fontSize: themeStyle === 'geek' ? '12px' : '14px',
        fontFamily: themeStyle === 'elite' ? theme.fonts.heading : theme.fonts.body,
      }}>
        <InlineMarkdown text={project.name} theme={theme} themeStyle={themeStyle} />
      </h3>
      {project.description && (
        <div style={{ marginTop: '4px' }}>
          <MarkdownContent content={project.description} theme={theme} themeStyle={themeStyle} />
        </div>
      )}
      {project.tech && project.tech.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {project.tech.map((t, i) => (
            <span
              key={i}
              style={{
                backgroundColor: themeStyle === 'geek' ? '#eef2ff' : '#f3f4f6',
                color: themeStyle === 'geek' ? '#4338ca' : theme.colors.secondary,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: themeStyle === 'geek' ? theme.fonts.body : 'inherit',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EducationItem({ edu, theme, themeStyle }: { edu: ParsedResume['education'][0]; theme: ThemeConfig; themeStyle: ThemeStyle }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    }}>
      <div>
        <h3 style={{
          fontWeight: themeStyle === 'geek' ? 700 : 600,
          color: theme.colors.primary,
          fontSize: themeStyle === 'geek' ? '11px' : '14px',
          fontFamily: themeStyle === 'elite' ? theme.fonts.heading : theme.fonts.body,
        }}>
          {edu.school}
        </h3>
        <p style={{ fontSize: theme.typography.bodySize, color: theme.colors.secondary }}>
          {themeStyle === 'elite' && edu.major && <span style={{ fontStyle: 'italic' }}>{edu.major}</span>}
          {themeStyle === 'elite' && edu.major && edu.degree && ', '}
          {themeStyle !== 'elite' && edu.degree}
          {themeStyle !== 'elite' && edu.major && ` · ${edu.major}`}
          {themeStyle === 'elite' && edu.degree}
          {edu.gpa && ` — GPA: ${edu.gpa}`}
        </p>
      </div>
      {themeStyle === 'geek' ? (
        <code style={{ fontSize: '10px', color: theme.colors.muted }}>{edu.period}</code>
      ) : (
        <span style={{ fontSize: theme.typography.bodySize, color: theme.colors.muted, textAlign: 'right' }}>
          {edu.period}
        </span>
      )}
    </div>
  );
}

function SkillsDisplay({ skills, theme, themeStyle }: { skills: string[]; theme: ThemeConfig; themeStyle: ThemeStyle }) {
  // 对于长技能描述使用列表格式
  const hasLongSkills = skills.some(s => s.length > 50);
  
  if (hasLongSkills) {
    // 列表形式展示技能（适合技能描述句子）
    return (
      <ul style={{
        listStyleType: theme.decorations.listStyle === 'disc' ? 'disc' : 'none',
        paddingLeft: theme.decorations.listStyle === 'disc' ? '18px' : '0',
        margin: 0,
      }}>
        {skills.map((skill, index) => (
          <li
            key={index}
            style={{
              fontSize: theme.typography.bodySize,
              color: theme.colors.secondary,
              lineHeight: theme.typography.lineHeight,
              marginBottom: '4px',
              display: theme.decorations.listStyle === 'arrow' ? 'flex' : 'list-item',
            }}
          >
            {theme.decorations.listStyle === 'arrow' && (
              <span style={{ color: '#10b981', marginRight: '8px', flexShrink: 0 }}>→</span>
            )}
            <span><HighlightItem text={skill} theme={theme} themeStyle={themeStyle} /></span>
          </li>
        ))}
      </ul>
    );
  }

  if (theme.decorations.skillBadge || themeStyle === 'geek') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {skills.map((skill, index) => (
          <span
            key={index}
            style={{
              backgroundColor: '#eef2ff',
              color: '#4338ca',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              border: '1px solid #e0e7ff',
              fontFamily: themeStyle === 'geek' ? theme.fonts.body : 'inherit',
            }}
          >
            {themeStyle === 'geek' ? `<${skill}/>` : skill}
          </span>
        ))}
      </div>
    );
  }

  if (themeStyle === 'elite') {
    return (
      <p style={{ fontSize: theme.typography.bodySize, color: theme.colors.secondary, lineHeight: theme.typography.lineHeight }}>
        <span style={{ fontWeight: 600 }}>Technical:</span> {skills.join(', ')}
      </p>
    );
  }

  // Minimal
  return (
    <p style={{ fontSize: theme.typography.bodySize, color: theme.colors.secondary, lineHeight: theme.typography.lineHeight }}>
      {skills.join(' · ')}
    </p>
  );
}

export { THEME_CONFIGS };
export type { ThemeConfig };
