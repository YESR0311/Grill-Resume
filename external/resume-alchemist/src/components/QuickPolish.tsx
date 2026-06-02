import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, Copy, Check, Sparkles, BarChart3, Crown, ArrowLeft, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStreamingPolish } from '@/hooks/useStreamingPolish';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getIndustryConfig } from '@/lib/constants';

interface QuickPolishProps {
  industry: string;
  onBack: () => void;
}

export function QuickPolish({ industry, onBack }: QuickPolishProps) {
  const [inputText, setInputText] = useState('');
  const [polishedResults, setPolishedResults] = useState<Record<string, string>>({});
  const [activeStyles, setActiveStyles] = useState<Set<string>>(new Set());
  const [copiedStyle, setCopiedStyle] = useState<string | null>(null);
  
  const { isStreaming, streamPolishSentence, abort } = useStreamingPolish();

  // 根据行业动态生成润色风格选项
  const polishStyles = useMemo(() => {
    const config = getIndustryConfig(industry);
    return [
      { id: 'standard', label: '标准专业版', icon: Sparkles, description: '语言简练专业' },
      { id: 'data', label: '数据驱动版', icon: BarChart3, description: `自动插入 ${config.dataPlaceholders[0]} 等占位符` },
      { id: 'expert', label: config.expertModeName, icon: Crown, description: '强调技术深度与行业影响力' },
    ] as const;
  }, [industry]);

  const handlePolish = async (style: 'standard' | 'data' | 'expert') => {
    if (!inputText.trim() || inputText.trim().length < 5) {
      toast.error('请输入至少5个字的句子');
      return;
    }
    
    setActiveStyles(prev => new Set(prev).add(style));
    setPolishedResults(prev => ({ ...prev, [style]: '' }));
    
    await streamPolishSentence(inputText, industry, style, {
      onChunk: (text) => {
        setPolishedResults(prev => ({ ...prev, [style]: text }));
      },
      onComplete: (text) => {
        setPolishedResults(prev => ({ ...prev, [style]: text }));
        setActiveStyles(prev => {
          const next = new Set(prev);
          next.delete(style);
          return next;
        });
      },
      onError: () => {
        setActiveStyles(prev => {
          const next = new Set(prev);
          next.delete(style);
          return next;
        });
      }
    });
  };

  const handlePolishAll = async () => {
    if (!inputText.trim() || inputText.trim().length < 5) {
      toast.error('请输入至少5个字的句子');
      return;
    }
    
    // 并行润色所有风格
    const styles: Array<'standard' | 'data' | 'expert'> = ['standard', 'data', 'expert'];
    setActiveStyles(new Set(styles));
    setPolishedResults({});
    
    const promises = styles.map(async (style) => {
      setPolishedResults(prev => ({ ...prev, [style]: '' }));
      
      await streamPolishSentence(inputText, industry, style, {
        onChunk: (text) => {
          setPolishedResults(prev => ({ ...prev, [style]: text }));
        },
        onComplete: (text) => {
          setPolishedResults(prev => ({ ...prev, [style]: text }));
          setActiveStyles(prev => {
            const next = new Set(prev);
            next.delete(style);
            return next;
          });
        },
        onError: () => {
          setActiveStyles(prev => {
            const next = new Set(prev);
            next.delete(style);
            return next;
          });
        }
      });
    });
    
    await Promise.all(promises);
    toast.success('3 种风格润色完成！');
  };

  const handleAbort = () => {
    abort();
    setActiveStyles(new Set());
    toast.info('已停止生成');
  };

  const handleCopy = (text: string, style: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStyle(style);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopiedStyle(null), 2000);
  };

  const renderHighlightedText = (text: string) => {
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return (
          <span key={index} className="bg-primary/30 text-primary px-1 rounded font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const config = getIndustryConfig(industry);
  const isAnyLoading = activeStyles.size > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            单句原子润色
          </h2>
          <p className="text-sm text-muted-foreground">
            输入一句简历描述，获取 3 种 AI 改写版本
          </p>
        </div>
      </div>

      {/* 行业提示 */}
      <div className="glass-card p-4 bg-primary/5 border-primary/20">
        <p className="text-sm">
          当前行业：<span className="text-primary font-medium">{config.name}</span>
          <span className="text-muted-foreground ml-2">
            · 专家模式：{config.expertModeName}
          </span>
        </p>
      </div>

      {/* 输入区域 */}
      <div className="space-y-4">
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="例如：负责公司官网的开发和维护工作"
          className="min-h-[120px] resize-none text-base"
        />
        
        <div className="flex gap-2">
          <Button
            onClick={handlePolishAll}
            disabled={isAnyLoading || !inputText.trim()}
            className="flex-1 btn-ai-glow text-primary-foreground"
            size="lg"
          >
            {isAnyLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                一键生成 3 种改写版本
              </>
            )}
          </Button>
          {isAnyLoading && (
            <Button
              onClick={handleAbort}
              variant="outline"
              size="lg"
              className="gap-1"
            >
              <Square className="w-4 h-4" />
              停止
            </Button>
          )}
        </div>
      </div>

      {/* 结果展示 */}
      <div className="space-y-4">
        {polishStyles.map((style) => {
          const Icon = style.icon;
          const result = polishedResults[style.id];
          const isLoadingThis = activeStyles.has(style.id);

          return (
            <motion.div
              key={style.id}
              className={cn(
                'glass-card p-4 space-y-3 transition-all',
                result && 'border-primary/30'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{style.label}</span>
                  <span className="text-xs text-muted-foreground">{style.description}</span>
                </div>
                {isLoadingThis ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    生成中...
                  </div>
                ) : !result ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePolish(style.id as 'standard' | 'data' | 'expert')}
                    disabled={isAnyLoading || !inputText.trim()}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    生成
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(result, style.id)}
                  >
                    {copiedStyle === style.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              
              <AnimatePresence>
                {(result || isLoadingThis) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm leading-relaxed p-3 bg-muted/50 rounded-lg"
                  >
                    {result ? (
                      <>
                        {renderHighlightedText(result)}
                        {isLoadingThis && (
                          <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" />
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground animate-pulse">正在生成...</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* 使用提示 */}
      <div className="text-center text-sm text-muted-foreground">
        <p>💡 数据驱动版会自动插入占位符如 {config.dataPlaceholders[0]}，请替换为真实数据</p>
      </div>
    </motion.div>
  );
}
