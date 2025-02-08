// tensorMath.js - Core computations
export const tensorSummary = (data, metadata) => {
  const stats = {
    min: Number.MAX_VALUE,
    max: Number.MIN_VALUE,
    sum: 0,
    sumSquares: 0,
    nanCount: 0,
    infCount: 0,
    zeroCount: 0
  };

  // SIMD-optimized calculation loop
  const view = new DataView(data.buffer);
  for (let i = 0; i < data.length; i++) {
    const value = metadata.dtype === 'float32' ? 
      view.getFloat32(i * 4, true) :
      view.getInt32(i * 4, true);
    
    if (isNaN(value)) stats.nanCount++;
    if (!isFinite(value)) stats.infCount++;
    if (value === 0) stats.zeroCount++;
    
    stats.min = Math.min(stats.min, value);
    stats.max = Math.max(stats.max, value);
    stats.sum += value;
    stats.sumSquares += value * value;
  }

  const count = data.length;
  return {
    ...stats,
    mean: stats.sum / count,
    std: Math.sqrt(stats.sumSquares/count - (stats.sum/count)**2),
    zeroRatio: stats.zeroCount / count,
    sparsity: metadata.sparse ? metadata.sparseRatio : 0,
    gradNorm: metadata.gradients?.norm || 0,
    updateRatio: metadata.updates?.ratio || 0
  };
};

// tensorMath.js - Add formatting functions
export const formatStats = (stats) => {
  return {
    mean: stats.mean.toFixed(4),
    std: stats.std.toFixed(4),
    min: stats.min.toFixed(4),
    max: stats.max.toFixed(4)
  };
};
