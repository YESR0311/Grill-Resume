import { MessageSquare, BarChart3, Sparkles, FileDown } from "lucide-react";

/**
 * 首页特性展示卡片
 */
const features = [
  {
    icon: MessageSquare,
    title: "智能追问采集",
    description: "AI 通过多轮对话引导你梳理经历，自动提取关键信息，无需手动填写表格。",
  },
  {
    icon: BarChart3,
    title: "评估反馈",
    description: "基于行业标准对简历逐项评分，指出薄弱点并提供改进建议。",
  },
  {
    icon: Sparkles,
    title: "专业润色编辑",
    description: "一键生成多套简历模板，支持自由编辑和实时预览。",
  },
  {
    icon: FileDown,
    title: "Word 导出",
    description: "导出为标准 Word 文档，可直接用于投递或进一步编辑。",
  },
];

export function FeatureCards() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="flex flex-col items-center rounded-2xl bg-card p-6 text-center shadow-sm ring-1 ring-border transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta-tint">
                <Icon className="h-6 w-6 text-terracotta" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
