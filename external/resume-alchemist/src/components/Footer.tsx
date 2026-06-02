import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function Footer() {
  const [stats, setStats] = useState({ todayCount: 0, totalCount: 0 });

  const fetchStats = async () => {
    try {
      const { data } = await supabase
        .from('usage_stats')
        .select('polish_count, dau, date')
        .order('date', { ascending: false });
      
      if (data && data.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayData = data.find(d => d.date === today);
        
        // 计算总数
        const totalCount = data.reduce((sum, d) => sum + (d.polish_count || 0), 0);
        const todayCount = todayData?.polish_count || 0;
        
        setStats({ todayCount, totalCount });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    // 初始加载
    fetchStats();
    
    // 订阅实时更新
    const channel = supabase
      .channel('usage_stats_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // 监听所有事件 (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'usage_stats'
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // 收到更新时重新获取数据
          fetchStats();
        }
      )
      .subscribe();

    // 清理订阅
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Privacy Badge */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20"
          >
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">
              隐私优先模式：数据本地处理，不保存用户简历
            </span>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm">
                一共已助力 <span className="text-primary font-semibold">{stats.totalCount.toLocaleString()}</span> 位求职者
              </span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">
                今日已助力 <span className="text-primary font-semibold">{stats.todayCount}</span> 位求职者
              </span>
            </div>
          </motion.div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© 2026 简历炼金术 Resume Alchemist By Anarkh-Lee</p>
          
          {/* 不蒜子统计 */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/80">
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/60">👀</span>
              <span>访问量：</span>
              <span id="busuanzi_value_site_pv" className="text-primary font-medium">-</span>
            </span>
            <span className="text-border/50">·</span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/60">👥</span>
              <span>访客数：</span>
              <span id="busuanzi_value_site_uv" className="text-primary font-medium">-</span>
            </span>
          </div>
          
          <p>Powered by AI ✨</p>
        </div>
      </div>
    </footer>
  );
}
