import { calculateTensorMemory, validateShape } from './tensorUtils';

/**
 * Differential Update Utilities
 * 
 * Requirements:
 * - Handle sparse/dense tensor diffs
 * - Optimize binary diff size
 * - Validate diff structure
 * - Support partial updates
 * - Memory-efficient patch application
 */

// Differential update types
const DIFF_TYPES = {
  SPARSE: 'sparse',
  DENSE: 'dense',
  RANGE: 'range'
};

/**
 * Apply sparse tensor update
 * @param {TypedArray} targetData 
 * @param {object} diff 
 * @param {Array<number>} shape 
 */
export const applySparseUpdate = (targetData, diff, shape) => {
  if (!diff.indices || !diff.values) {
    throw new Error('Invalid sparse diff format');
  }

  const rank = shape.length;
  const elementSize = diff.values.length / diff.indices.length;
  
  // Precompute strides for ND indexing
  const strides = new Array(rank);
  strides[rank - 1] = 1;
  for (let i = rank - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }

  // Process updates in batches for better memory locality
  for (let i = 0; i < diff.indices.length; i += 1000) {
    const batchEnd = Math.min(i + 1000, diff.indices.length);
    for (let j = i; j < batchEnd; j++) {
      let index = 0;
      for (let d = 0; d < rank; d++) {
        index += diff.indices[j * rank + d] * strides[d];
      }
      targetData[index] = diff.values[j];
    }
  }
};

/**
 * Generate optimized diff between two tensors
 * @param {TypedArray} oldData 
 * @param {TypedArray} newData 
 * @param {object} options 
 * @returns {object} diff
 */
export const generateDiff = (oldData, newData, options = {}) => {
  const { threshold = 0.01, maxSparsity = 0.5 } = options;
  const changes = [];
  let identical = true;

  // First pass: detect changes and sparsity
  for (let i = 0; i < oldData.length; i++) {
    const delta = Math.abs(newData[i] - oldData[i]);
    if (delta > threshold) {
      changes.push(i);
      identical = false;
    }
  }

  if (identical) return null;

  // Choose optimal diff strategy
  const sparsity = changes.length / oldData.length;
  if (sparsity <= maxSparsity) {
    return compressSparseDiff(changes, newData, oldData);
  }
  return createFullDiff(newData, oldData);
};

/**
 * Compress sparse diff using delta encoding
 * @param {Array<number>} indices 
 * @param {TypedArray} newData 
 * @param {TypedArray} oldData 
 */
const compressSparseDiff = (indices, newData, oldData) => {
  const diff = {
    type: DIFF_TYPES.SPARSE,
    indices: new Int32Array(indices),
    values: new newData.constructor(indices.length)
  };

  // Store only changed values
  for (let i = 0; i < indices.length; i++) {
    diff.values[i] = newData[indices[i]] - oldData[indices[i]];
  }

  return diff;
};

/**
 * Create full tensor diff
 * @param {TypedArray} newData 
 */
const createFullDiff = (newData) => ({
  type: DIFF_TYPES.DENSE,
  data: newData.slice()
});

/**
 * Validate diff against tensor shape
 * @param {object} diff 
 * @param {Array<number>} shape 
 */
export const validateDiff = (diff, shape) => {
  const elementCount = shape.reduce((a, b) => a * b, 1);
  
  switch(diff.type) {
    case DIFF_TYPES.SPARSE:
      if (diff.indices.some(idx => idx >= elementCount)) {
        throw new Error('Diff index out of bounds');
      }
      if (diff.values.length !== diff.indices.length) {
        throw new Error('Values/indices length mismatch');
      }
      break;
      
    case DIFF_TYPES.DENSE:
      validateShape(diff.data, shape);
      break;
      
    default:
      throw new Error('Unknown diff type');
  }
};

/**
 * Memory-aware diff application
 * @param {object} tensor 
 * @param {object} diff 
 */
export const applyTensorDiff = (tensor, diff) => {
  validateDiff(diff, tensor.metadata.shape);
  
  switch(diff.type) {
    case DIFF_TYPES.SPARSE:
      applySparseUpdate(tensor.data, diff, tensor.metadata.shape);
      break;
      
    case DIFF_TYPES.DENSE:
      tensor.data.set(diff.data);
      break;
  }
  
  tensor.metadata.version++;
  tensor.metadata.lastUpdated = Date.now();
};

/**
 * Diff size estimator
 * @param {object} diff 
 * @returns {number} bytes
 */
export const estimateDiffSize = (diff) => {
  switch(diff.type) {
    case DIFF_TYPES.SPARSE:
      return diff.indices.byteLength + diff.values.byteLength + 16;
      
    case DIFF_TYPES.DENSE:
      return diff.data.byteLength + 8;
      
    default:
      return 0;
  }
};

// Differential compression formats
const DIFF_COMPRESSION = {
  NONE: 0,
  DELTA: 1,
  RUN_LENGTH: 2
};

/**
 * Compress diff using optimal strategy
 * @param {object} diff 
 * @param {string} dtype 
 */
export const compressDiff = (diff, dtype) => {
  if (diff.type !== DIFF_TYPES.SPARSE) return diff;
  
  // Optimize based on data type characteristics
  const isFloat = dtype === 'float32';
  const compression = isFloat ? DIFF_COMPRESSION.DELTA : DIFF_COMPRESSION.RUN_LENGTH;
  
  return {
    ...diff,
    compression,
    values: applyValueCompression(diff.values, compression)
  };
};

const applyValueCompression = (values, method) => {
  switch(method) {
    case DIFF_COMPRESSION.DELTA:
      return deltaEncode(values);
      
    case DIFF_COMPRESSION.RUN_LENGTH:
      return runLengthEncode(values);
      
    default:
      return values;
  }
};

export default {
  DIFF_TYPES,
  applySparseUpdate,
  generateDiff,
  validateDiff,
  applyTensorDiff,
  estimateDiffSize,
  compressDiff
};
