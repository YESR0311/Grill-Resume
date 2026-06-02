-- 创建使用统计表
CREATE TABLE public.usage_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE UNIQUE,
  polish_count INTEGER NOT NULL DEFAULT 0,
  dau INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

-- 允许公开读取统计数据
CREATE POLICY "Anyone can read usage stats"
  ON public.usage_stats
  FOR SELECT
  USING (true);

-- 创建更新 updated_at 的函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 创建触发器
CREATE TRIGGER update_usage_stats_updated_at
  BEFORE UPDATE ON public.usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 插入今天的初始数据
INSERT INTO public.usage_stats (date, polish_count, dau) 
VALUES (CURRENT_DATE, 128, 42)
ON CONFLICT (date) DO NOTHING;