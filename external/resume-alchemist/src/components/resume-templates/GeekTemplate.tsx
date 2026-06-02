import { forwardRef } from 'react';
import { ThemedResume } from './ThemeEngine';
import type { ParsedResume } from '@/lib/resumeTemplates';

interface GeekTemplateProps {
  data: ParsedResume;
}

export const GeekTemplate = forwardRef<HTMLDivElement, GeekTemplateProps>(
  ({ data }, ref) => {
    return <ThemedResume ref={ref} data={data} themeStyle="geek" />;
  }
);

GeekTemplate.displayName = 'GeekTemplate';
