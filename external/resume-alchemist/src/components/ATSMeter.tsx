import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ATSMeterProps {
  score: number;
}

export function ATSMeter({ score }: ATSMeterProps) {
  const getScoreStatus = () => {
    if (score >= 80) return { label: '优秀', color: 'bg-green-500', textColor: 'text-green-400' };
    if (score >= 60) return { label: '良好', color: 'bg-yellow-500', textColor: 'text-yellow-400' };
    if (score >= 40) return { label: '一般', color: 'bg-orange-500', textColor: 'text-orange-400' };
    return { label: '较差', color: 'bg-red-500', textColor: 'text-red-400' };
  };

  const status = getScoreStatus();

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium">ATS 友好度</h3>
            <p className="text-xs text-muted-foreground">机器筛选通过率</p>
          </div>
        </div>
        <div className={cn('text-2xl font-bold', status.textColor)}>
          {score}%
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', status.color)}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>ATS机器筛选</span>
          <span className={status.textColor}>{status.label}</span>
        </div>
      </div>
    </div>
  );
}
