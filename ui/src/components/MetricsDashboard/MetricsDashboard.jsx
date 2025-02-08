import React from 'react';
import { useStore } from '../../stores/metricsStore';
import LiveChart from './LiveChart';
import MetricSelector from './MetricSelector';

const MetricsDashboard = () => {
  const { selectedMetrics } = useStore();

  return (
    <div className="flex h-full">
      <div className="w-3/4 p-4">
        <h2 className="text-2xl font-bold mb-4">Metrics Dashboard</h2>
        <LiveChart metrics={selectedMetrics} />
      </div>
      <div className="w-1/4 p-4">
        <MetricSelector />
      </div>
    </div>
  );
};

export default MetricsDashboard;
