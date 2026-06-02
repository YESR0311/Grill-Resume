import { motion } from 'framer-motion';
import { Check, Sparkles, Building2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResumeTemplate, ParsedResume } from '@/lib/resumeTemplates';

interface ResumeTemplatePreviewProps {
  template: ResumeTemplate;
  isSelected: boolean;
  onClick: () => void;
  resumeData?: ParsedResume;
}

const templateIcons = {
  minimal: Sparkles,
  elite: Building2,
  geek: Terminal,
};

export function ResumeTemplatePreview({
  template,
  isSelected,
  onClick,
  resumeData,
}: ResumeTemplatePreviewProps) {
  const Icon = templateIcons[template.style];

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border transition-colors p-3',
        'bg-card hover:bg-accent/40',
        isSelected ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'shrink-0 h-10 w-10 rounded-md flex items-center justify-center border',
            isSelected ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'
          )}
        >
          <Icon className="h-5 w-5 text-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">
                {template.name}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {template.nameEn}
              </div>
            </div>
            {isSelected && (
              <span className="inline-flex items-center gap-1 text-xs text-primary">
                <Check className="h-4 w-4" />
                已选
              </span>
            )}
          </div>

          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {template.description}
          </div>

          {/* 小提示：用真实简历信息增强“已选择哪个”的反馈 */}
          {resumeData?.name && (
            <div className="mt-2 text-[11px] text-muted-foreground truncate">
              预览：{resumeData.name}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

