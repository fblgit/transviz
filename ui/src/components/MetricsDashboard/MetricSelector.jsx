import React from 'react';
import { useStore } from '../../stores/metricsStore';

/**
 * Metric Selection Control Component
 * 
 * Requirements:
 * - Multi-select interface with search
 * - Visual color coding for selected metrics
 * - Toggle individual/metric group selection
 * - Display basic metric statistics
 */
const MetricSelector = () => {
  const { availableMetrics, selectedMetrics, toggleMetric } = useStore();
  const metricCategories = ['loss', 'accuracy', 'gradients', 'weights'];
  const colorMap = {
    loss: '#EF4444',
    accuracy: '#10B981',
    gradients: '#3B82F6',
    weights: '#F59E0B'
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">
        Tracked Metrics
      </h3>
      
      <div className="flex-1 space-y-4 overflow-y-auto">
        {metricCategories.map((category) => (
          <div key={category} className="border-b border-gray-700 pb-4">
            <div className="flex items-center mb-2">
              <span 
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: colorMap[category] }}
              />
              <h4 className="text-sm font-medium text-gray-300 capitalize">
                {category}
              </h4>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {availableMetrics
                .filter(m => m.startsWith(category))
                .map((metric) => (
                  <label
                    key={metric}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric)}
                      onChange={() => toggleMetric(metric)}
                      className="form-checkbox h-4 w-4 text-blue-500"
                    />
                    <span className="text-sm text-gray-200 font-mono">
                      {metric.split('/').pop()}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Selected: {selectedMetrics.length}</span>
          <span>Available: {availableMetrics.length}</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(MetricSelector);
