import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScoreDisplayProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
}

export function ScoreDisplay({ score, label, size = 'md', showAnimation = true }: ScoreDisplayProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!showAnimation) {
      setDisplayScore(score);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, showAnimation]);

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-yellow-500';
    if (s >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreGradient = (s: number) => {
    if (s >= 80) return 'from-green-500 to-emerald-400';
    if (s >= 60) return 'from-yellow-500 to-amber-400';
    if (s >= 40) return 'from-orange-500 to-amber-500';
    return 'from-red-500 to-rose-400';
  };

  const sizes = {
    sm: { container: 'w-20 h-20', text: 'text-2xl', label: 'text-xs' },
    md: { container: 'w-32 h-32', text: 'text-4xl', label: 'text-sm' },
    lg: { container: 'w-40 h-40', text: 'text-5xl', label: 'text-base' },
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative', sizes[size].container)}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={cn('stop-color-current', getScoreColor(score))} />
              <stop offset="100%" className={cn('stop-color-current', getScoreColor(score))} />
            </linearGradient>
          </defs>
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={cn('font-bold', sizes[size].text, getScoreColor(displayScore))}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            {displayScore}
          </motion.span>
        </div>
      </div>
      <span className={cn('text-muted-foreground font-medium', sizes[size].label)}>
        {label}
      </span>
    </div>
  );
}
