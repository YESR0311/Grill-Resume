import { motion } from 'framer-motion';
import { ScoreDisplay } from './ScoreDisplay';
import { RadarChart } from './RadarChart';
import { RoastCard } from './RoastCard';
import { ATSMeter } from './ATSMeter';
import { Button } from '@/components/ui/button';
import { ArrowRight, RefreshCw, FileDown } from 'lucide-react';

interface AnalysisResultProps {
  result: {
    score: number;
    roast: string;
    dimensions: Record<string, number>;
    ats_score: number;
    highlights: string[];
    weaknesses: string[];
    keywords_missing: string[];
  };
  onPolish: () => void;
  onExport?: () => void;
  onReset: () => void;
}

export function AnalysisResult({ result, onPolish, onExport, onReset }: AnalysisResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Score Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Score & Radar */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex justify-center">
            <ScoreDisplay score={result.score} label="综合评分" size="lg" />
          </div>
          <RadarChart data={result.dimensions} />
        </div>

        {/* Right: ATS & Actions */}
        <div className="space-y-4">
          <ATSMeter score={result.ats_score} />
          
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-medium">下一步</h3>
            <div className="space-y-3">
              <Button 
                onClick={onPolish}
                className="w-full btn-ai-glow text-primary-foreground"
                size="lg"
              >
                开始 AI 润色
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {onExport && (
                <Button 
                  onClick={onExport}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  模板导出 PDF
                </Button>
              )}
              <Button 
                onClick={onReset}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重新分析
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Roast & Details */}
      <RoastCard
        roast={result.roast}
        highlights={result.highlights}
        weaknesses={result.weaknesses}
        keywords_missing={result.keywords_missing}
      />
    </motion.div>
  );
}
