// ui/src/components/MetricsDashboard/LiveChart.jsx
import React from 'react';
import { useStore } from '../../stores/metricsStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

/**
 * Real-Time Metrics Visualization Component
 * 
 * Requirements:
 * - Display multiple metrics in overlapping line charts
 * - Auto-scroll time axis with 5 minute window
 * - Dynamic color assignment for metrics
 * - Crosshair tooltip with precise values
 * - Performance-optimized for high update frequency
 */
const LiveChart = ({ metrics }) => {
  const { metricData } = useStore();
  const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
  
  // Process data for Recharts format
  const processData = () => {
    return metricData.map(entry => ({
      timestamp: entry.timestamp,
      ...Object.fromEntries(
        metrics.map(metric => [metric, entry.values[metric]])
      )
    }));
  };

  return (
    <div className="h-[500px] bg-gray-800 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={processData()}
          margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
        >
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts) => format(ts, 'HH:mm:ss')}
            tick={{ fill: '#94A3B8' }}
            stroke="#475569"
          />
          <YAxis
            width={80}
            tick={{ fill: '#94A3B8' }}
            stroke="#475569"
            tickFormatter={(value) => value.toFixed(4)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: 'none' }}
            labelFormatter={(ts) => format(ts, 'HH:mm:ss.SSS')}
            formatter={(value) => [value.toFixed(6), 'Value']}
            itemStyle={{ color: '#FFFFFF' }}
          />
          {metrics.map((metric, idx) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={colorPalette[idx % colorPalette.length]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(LiveChart);
