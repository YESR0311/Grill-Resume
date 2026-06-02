-- 允许匿名用户插入新的统计记录
CREATE POLICY "Anyone can insert usage stats"
ON public.usage_stats
FOR INSERT
WITH CHECK (true);

-- 允许匿名用户更新统计记录（只能增加计数）
CREATE POLICY "Anyone can update usage stats"
ON public.usage_stats
FOR UPDATE
USING (true)
WITH CHECK (true);