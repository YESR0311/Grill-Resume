import { forwardRef } from 'react';
import { MinimalistTemplate } from './resume-templates/MinimalistTemplate';
import { EliteTemplate } from './resume-templates/EliteTemplate';
import { GeekTemplate } from './resume-templates/GeekTemplate';
import type { ResumeTemplate, ParsedResume } from '@/lib/resumeTemplates';

interface ResumeDocumentProps {
  template: ResumeTemplate;
  resumeData: ParsedResume;
  polishedContent?: string;
}

export const ResumeDocument = forwardRef<HTMLDivElement, ResumeDocumentProps>(
  ({ template, resumeData, polishedContent }, ref) => {
    // 如果有润色后的内容，尝试提取要点到第一个工作经历
    const processedData = { ...resumeData };
    
    if (polishedContent) {
      const highlights = polishedContent
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 10 && 
                 trimmed.length < 200 &&
                 (trimmed.includes('%') || 
                  trimmed.includes('提升') || 
                  trimmed.includes('优化') ||
                  trimmed.includes('负责') ||
                  trimmed.includes('主导') ||
                  trimmed.startsWith('-') ||
                  trimmed.startsWith('•'));
        })
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .slice(0, 6);

      if (highlights.length > 0 && processedData.experience.length > 0) {
        processedData.experience = [
          { ...processedData.experience[0], highlights },
          ...processedData.experience.slice(1),
        ];
      }
    }

    // 根据模板类型渲染对应组件
    switch (template.style) {
      case 'minimal':
        return <MinimalistTemplate ref={ref} data={processedData} />;
      case 'elite':
        return <EliteTemplate ref={ref} data={processedData} />;
      case 'geek':
        return <GeekTemplate ref={ref} data={processedData} />;
      default:
        return <MinimalistTemplate ref={ref} data={processedData} />;
    }
  }
);

ResumeDocument.displayName = 'ResumeDocument';
