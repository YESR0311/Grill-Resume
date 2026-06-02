import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

export type ThemeStyle = 'minimal' | 'elite' | 'geek';

interface MarkdownRendererProps {
  content: string;
  theme: ThemeStyle;
  className?: string;
}

// 根据主题返回不同的 Markdown 组件样式
const getThemeComponents = (theme: ThemeStyle): Components => {
  const baseStyles = {
    minimal: {
      strong: { fontWeight: 600, color: '#111827' },
      p: { marginBottom: '8px', fontSize: '13px', color: '#4b5563', lineHeight: '1.7' },
      ul: { listStyleType: 'disc', paddingLeft: '20px', margin: '8px 0' },
      li: { fontSize: '13px', color: '#4b5563', lineHeight: '1.7', marginBottom: '4px' },
      code: { backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#374151' },
      a: { color: '#6b7280', textDecoration: 'underline', textUnderlineOffset: '2px' },
    },
    elite: {
      strong: { fontWeight: 700, color: '#111827' },
      p: { marginBottom: '6px', fontSize: '13px', color: '#374151', lineHeight: '1.6' },
      ul: { listStyleType: 'disc', paddingLeft: '20px', margin: '6px 0' },
      li: { fontSize: '13px', color: '#374151', lineHeight: '1.5', marginBottom: '3px' },
      code: { backgroundColor: '#f3f4f6', padding: '1px 4px', borderRadius: '2px', fontSize: '12px', color: '#1f2937' },
      a: { color: '#1d4ed8', textDecoration: 'underline', textUnderlineOffset: '2px' },
    },
    geek: {
      strong: { fontWeight: 700, color: '#0f172a' },
      p: { marginBottom: '6px', fontSize: '11px', color: '#475569', lineHeight: '1.6' },
      ul: { listStyleType: 'none', paddingLeft: '0', margin: '6px 0' },
      li: { fontSize: '11px', color: '#334155', lineHeight: '1.6', marginBottom: '4px', display: 'flex' },
      code: { backgroundColor: '#f1f5f9', color: '#db2777', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace' },
      a: { color: '#4f46e5', textDecoration: 'underline' },
    },
  };

  const styles = baseStyles[theme];

  return {
    p: ({ children }) => <p style={styles.p}>{children}</p>,
    strong: ({ children }) => <strong style={styles.strong}>{children}</strong>,
    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
    ul: ({ children }) => <ul style={styles.ul}>{children}</ul>,
    ol: ({ children }) => <ol style={{ ...styles.ul, listStyleType: 'decimal' }}>{children}</ol>,
    li: ({ children }) => (
      <li style={styles.li}>
        {theme === 'geek' && <span style={{ color: '#10b981', marginRight: '8px', flexShrink: 0 }}>→</span>}
        <span>{children}</span>
      </li>
    ),
    code: ({ children }) => <code style={styles.code}>{children}</code>,
    a: ({ href, children }) => (
      <a href={href} style={styles.a} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    h1: ({ children }) => <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote style={{ borderLeft: '3px solid #d1d5db', paddingLeft: '12px', margin: '8px 0', color: '#6b7280' }}>
        {children}
      </blockquote>
    ),
  };
};

export function MarkdownRenderer({ content, theme, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={getThemeComponents(theme)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// 用于渲染单行文本中的 Markdown（如 highlights）
export function MarkdownLine({ content, theme }: { content: string; theme: ThemeStyle }) {
  if (!content) return null;

  // 清理列表前缀
  const cleanContent = content.replace(/^[-•*]\s*/, '');
  const themeComponents = getThemeComponents(theme);

  return (
    <span className="markdown-inline">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        components={{
          ...themeComponents,
          // 确保段落不会破坏内联布局
          p: ({ children }) => <>{children}</>,
          ul: ({ children }) => <>{children}</>,
          ol: ({ children }) => <>{children}</>,
          li: ({ children }) => <>{children}</>,
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </span>
  );
}
