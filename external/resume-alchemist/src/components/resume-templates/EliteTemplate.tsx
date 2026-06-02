import { forwardRef } from 'react';
import { ThemedResume } from './ThemeEngine';
import type { ParsedResume } from '@/lib/resumeTemplates';

interface EliteTemplateProps {
  data: ParsedResume;
}

export const EliteTemplate = forwardRef<HTMLDivElement, EliteTemplateProps>(
  ({ data }, ref) => {
    return <ThemedResume ref={ref} data={data} themeStyle="elite" />;
  }
);

EliteTemplate.displayName = 'EliteTemplate';
