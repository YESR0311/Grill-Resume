-- 创建速率限制表
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT 'resume-ai',
  request_count INTEGER NOT NULL DEFAULT 1,
  minute_window TEXT NOT NULL, -- 存储分钟级时间窗口，格式: YYYY-MM-DD-HH-MM
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建唯一索引
CREATE UNIQUE INDEX idx_rate_limits_ip_endpoint_minute 
ON public.rate_limits (ip_address, endpoint, minute_window);

-- 创建清理索引
CREATE INDEX idx_rate_limits_created_at ON public.rate_limits (created_at);

-- 启用 RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 允许 service role 完全访问（Edge Function 使用 service role）
CREATE POLICY "Service role full access" 
ON public.rate_limits 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 创建清理旧记录的函数
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE created_at < now() - INTERVAL '1 hour';
END;
$$;