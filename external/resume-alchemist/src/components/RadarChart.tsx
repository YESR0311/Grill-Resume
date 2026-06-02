import { motion } from 'framer-motion';
import { Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface RadarChartProps {
  data: Record<string, number>;
}

export function RadarChart({ data }: RadarChartProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    dimension: name,
    value,
    fullMark: 100,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className="radar-container w-full h-[300px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid 
            stroke="hsl(var(--border))" 
            strokeOpacity={0.5}
          />
          <PolarAngleAxis 
            dataKey="dimension" 
            tick={{ 
              fill: 'hsl(var(--muted-foreground))', 
              fontSize: 11,
              fontWeight: 500,
            }}
            tickLine={false}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="能力评估"
            dataKey="value"
            stroke="hsl(262, 83%, 58%)"
            fill="hsl(262, 83%, 58%)"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={{
              fill: 'hsl(262, 83%, 58%)',
              strokeWidth: 2,
              r: 4,
            }}
            animationBegin={300}
            animationDuration={1000}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </motion.div>
  );
}
