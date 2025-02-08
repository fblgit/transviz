import React, { useMemo } from 'react';
import { useStore } from '../../stores/tensorStore';
import { formatStats, tensorSummary } from '../../utils/tensorMath';

/**
 * Tensor Statistics Panel Component
 * 
 * Requirements:
 * - Display real-time statistics for selected tensor
 * - Handle various tensor formats (dense/sparse)
 * - Show memory consumption and compute device
 * - Highlight numerical instability indicators
 * - Support tensor comparison operations
 */
const TensorStatsPanel = ({ tensorId }) => {
  const { tensors } = useStore();
  const tensor = tensors.get(tensorId);
  
  // Memoized statistics calculation
  const stats = useMemo(() => {
    if (!tensor) return null;
    return tensorSummary(tensor.data, tensor.metadata);
  }, [tensor]);

  // Formatting helper for large numbers
  const formatNumber = (value, unit = '') => {
    if (value > 1e9) return `${(value / 1e9).toFixed(2)}G${unit}`;
    if (value > 1e6) return `${(value / 1e6).toFixed(2)}M${unit}`;
    if (value > 1e3) return `${(value / 1e3).toFixed(2)}K${unit}`;
    return `${value.toFixed(4)}${unit}`;
  };

  if (!tensor) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a tensor to view statistics
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 p-4 space-y-4" 
         role="region"
         aria-label="Tensor statistics">
      {/* Header Section */}
      <div className="border-b border-gray-700 pb-2">
        <h3 className="text-lg font-semibold text-gray-200">
          {tensorId}
          <span className="ml-2 text-sm text-gray-400">
            ({tensor.metadata.dtype}, {tensor.metadata.device})
          </span>
        </h3>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* Basic Stats */}
        <StatItem 
          label="Shape"
          value={`[${tensor.metadata.shape.join(', ')}]`}
        />
        <StatItem
          label="Memory"
          value={formatNumber(tensor.metadata.memory, 'B')}
          barValue={tensor.metadata.memory / 1e9}
          max={2}
          unit="GB"
        />
        
        {/* Numerical Stability */}
        <StatItem
          label="NaN/Inf"
          value={`${stats.nanCount} / ${stats.infCount}`}
          alert={stats.nanCount > 0 || stats.infCount > 0}
        />
        <StatItem
          label="Zero %"
          value={`${(stats.zeroRatio * 100).toFixed(2)}%`}
          barValue={stats.zeroRatio}
        />
        
        {/* Value Distribution */}
        <StatItem
          label="Min"
          value={formatStats(stats.min, tensor.metadata.dtype)}
          barValue={(stats.min - stats.mean) / stats.std}
        />
        <StatItem
          label="Max"
          value={formatStats(stats.max, tensor.metadata.dtype)}
          barValue={(stats.max - stats.mean) / stats.std}
        />
        <StatItem
          label="Mean"
          value={formatStats(stats.mean, tensor.metadata.dtype)}
          barValue={0}
          showBar={false}
        />
        <StatItem
          label="σ"
          value={formatStats(stats.std, tensor.metadata.dtype)}
          barValue={1}
          showBar={false}
        />
      </div>

      {/* Advanced Statistics */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-400">Gradient Norm</div>
            <div className="text-lg font-mono text-blue-400">
              {formatNumber(stats.gradNorm)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Update Ratio</div>
            <div className="text-lg font-mono text-purple-400">
              {formatStats(stats.updateRatio, 'float32')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Sparsity</div>
            <div className="text-lg font-mono text-green-400">
              {(stats.sparsity * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for statistic items
const StatItem = ({ label, value, barValue, max = 3, unit = '', alert = false, showBar = true }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm">
      <span className={`text-gray-400 ${alert ? 'text-red-400' : ''}`}>{label}</span>
      <span className={`font-mono ${alert ? 'text-red-300' : 'text-gray-200'}`}>
        {value}{unit}
      </span>
    </div>
    {showBar && (
      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${alert ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ 
            width: `${Math.min(Math.abs(barValue) / max * 100, 100)}%`,
            marginLeft: `${barValue < 0 ? 50 : 0}%`
          }}
        />
      </div>
    )}
  </div>
);

export default React.memo(TensorStatsPanel);
