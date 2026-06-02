import { motion } from 'framer-motion';
import { Flame, AlertTriangle, Sparkles, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RoastCardProps {
  roast: string;
  highlights: string[];
  weaknesses: string[];
  keywords_missing: string[];
}

export function RoastCard({ roast, highlights, weaknesses, keywords_missing }: RoastCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-6"
    >
      {/* Roast Section */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
            <Flame className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-lg">毒舌 HR 点评</h3>
        </div>
        <p className="text-muted-foreground leading-relaxed italic">
          "{roast}"
        </p>
      </div>

      {/* Highlights & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Highlights */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-500/20 text-green-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-medium">亮点</h4>
          </div>
          <ul className="space-y-2">
            {highlights.map((item, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-green-400 mt-1">✓</span>
                {item}
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h4 className="font-medium">待改进</h4>
          </div>
          <ul className="space-y-2">
            {weaknesses.map((item, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-red-400 mt-1">✗</span>
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Missing Keywords */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
            <Search className="w-4 h-4" />
          </div>
          <h4 className="font-medium">建议补充的关键词</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords_missing.map((keyword, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.05 }}
            >
              <Badge variant="outline" className="border-primary/30 text-primary">
                + {keyword}
              </Badge>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
