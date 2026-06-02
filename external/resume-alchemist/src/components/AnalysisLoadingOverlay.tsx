import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileSearch, Brain, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AnalysisLoadingOverlayProps {
  isVisible: boolean;
}

const loadingSteps = [
  { icon: FileSearch, text: '正在扫描简历内容...', duration: 1500 },
  { icon: Brain, text: 'AI 正在深度分析...', duration: 2000 },
  { icon: Sparkles, text: '生成专业诊断报告...', duration: 2000 },
  { icon: CheckCircle2, text: '即将完成...', duration: 1500 },
];

export function AnalysisLoadingOverlay({ isVisible }: AnalysisLoadingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    // 自动循环切换步骤
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 2500);

    // 进度条动画
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // 最多到 95%，等待实际完成
        return prev + Math.random() * 3;
      });
    }, 200);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isVisible]);

  const CurrentIcon = loadingSteps[currentStep].icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card p-8 max-w-md w-full mx-4 space-y-6"
          >
            {/* 动画图标 */}
            <div className="flex justify-center">
              <motion.div
                key={currentStep}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="relative"
              >
                {/* 外圈动画 */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 w-20 h-20 rounded-full border-2 border-primary/30 border-t-primary"
                />
                
                {/* 图标容器 */}
                <div className="w-20 h-20 rounded-full bg-gradient-ai flex items-center justify-center">
                  <CurrentIcon className="w-8 h-8 text-white" />
                </div>
                
                {/* 光晕效果 */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 w-20 h-20 rounded-full bg-primary/20 blur-lg"
                />
              </motion.div>
            </div>

            {/* 加载文字 */}
            <div className="text-center space-y-2">
              <motion.p
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-lg font-medium"
              >
                {loadingSteps[currentStep].text}
              </motion.p>
              <p className="text-sm text-muted-foreground">
                请稍候，AI 正在为您的简历进行全面体检
              </p>
            </div>

            {/* 进度条 */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-ai"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(progress)}%
              </p>
            </div>

            {/* 步骤指示器 */}
            <div className="flex justify-center gap-2">
              {loadingSteps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                  animate={index === currentStep ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.5 }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
