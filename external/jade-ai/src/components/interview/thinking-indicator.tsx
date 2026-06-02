'use client';

import type { InterviewerConfig } from '@/types/interview';

interface ThinkingIndicatorProps {
  config: InterviewerConfig;
}

const WAVE_DELAYS = [0, 150, 300, 450, 600];

export function ThinkingIndicator({ config }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-white px-4 py-3 shadow-sm dark:border-pink-900 dark:bg-zinc-900">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-400 text-sm font-bold text-white">
        {config.name[0]}
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold">{config.name}</div>
        <div className="flex items-end gap-[3px]">
          {WAVE_DELAYS.map((delay, i) => (
            <span
              key={i}
              className="inline-block w-[3px] rounded-sm bg-pink-500"
              style={{
                height: '14px',
                animation: `thinkingWave 1.2s ease-in-out ${delay}ms infinite`,
                opacity: i % 2 === 0 ? 1 : 0.5,
              }}
            />
          ))}
          <span className="ml-1.5 text-[11px] text-zinc-400">思考中...</span>
        </div>
      </div>
    </div>
  );
}
