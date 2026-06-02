import { forwardRef } from 'react';
import { ThemedResume } from './ThemeEngine';
import type { ParsedResume } from '@/lib/resumeTemplates';

interface MinimalistTemplateProps {
  data: ParsedResume;
}

export const MinimalistTemplate = forwardRef<HTMLDivElement, MinimalistTemplateProps>(
  ({ data }, ref) => {
    return <ThemedResume ref={ref} data={data} themeStyle="minimal" />;
  }
);

MinimalistTemplate.displayName = 'MinimalistTemplate';
