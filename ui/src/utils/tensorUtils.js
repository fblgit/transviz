//import { SIMD } from 'wasm-feature-detect';
import { simd } from 'wasm-feature-detect';
//import tensorWasm from './tensor.wasm';

/**
 * Tensor Processing Utilities
 * 
 * Requirements:
 * - Handle dense/sparse tensor formats
 * - Validate tensor structures
 * - Perform memory-efficient operations
 * - Support WebAssembly acceleration
 * - Implement numerical stability checks
 */

// WebAssembly module instance
let wasmInstance = null;

async function checkSIMDSupport() {
  if (await simd()) {
    console.log("SIMD is supported");
    // Load SIMD-enabled WebAssembly module
  } else {
    console.log("SIMD is not supported");
    // Load fallback WebAssembly module
  }
}

// Initialize WebAssembly module
//(async function initWasm() {
//  if (await SIMD()) {
//    const module = await WebAssembly.compile(tensorWasm);
//    wasmInstance = await WebAssembly.Instance(module);
//  }
//})();

/** 
 * Tensor Structure Validator
 * @param {object} tensor 
 * @returns {boolean} validity
 */
export const validateTensor = (tensor) => {
  if (!tensor?.data || !tensor?.metadata) return false;
  
  const { shape, dtype, sparse } = tensor.metadata;
  const expectedLength = shape.reduce((a, b) => a * b, 1);
  
  // Check data buffer compatibility
  if (dtype === 'float32' && !(tensor.data instanceof Float32Array)) return false;
  if (dtype === 'int32' && !(tensor.data instanceof Int32Array)) return false;
  
  // Validate sparse tensor structure
  if (sparse) {
    return (
      tensor.metadata.indices instanceof Int32Array &&
      tensor.metadata.indices.length === tensor.data.length * shape.length
    );
  }
  
  // Validate dense tensor structure
  return tensor.data.length === expectedLength;
};

/**
 * Tensor Statistics Calculator
 * @param {TypedArray} data 
 * @param {object} metadata 
 * @returns {object} statistics
 */
export const tensorSummary = (data, metadata) => {
  if (!validateTensor({ data, metadata })) {
    throw new Error('Invalid tensor structure');
  }

  let stats;
  if (wasmInstance) {
    // WebAssembly accelerated computation
    const memory = new Uint8Array(wasmInstance.exports.memory.buffer);
    const dataPtr = wasmInstance.exports.alloc(data.length);
    new data.constructor(memory.buffer, dataPtr, data.length).set(data);
    
    stats = wasmInstance.exports.tensor_summary(
      dataPtr,
      data.length,
      metadata.dtype === 'float32' ? 0 : 1
    );
    
    wasmInstance.exports.free(dataPtr);
  } else {
    // JavaScript fallback implementation
    stats = {
      min: Number.MAX_VALUE,
      max: -Number.MAX_VALUE,
      sum: 0,
      sumSquares: 0,
      nanCount: 0,
      infCount: 0,
      zeroCount: 0
    };

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (isNaN(val)) stats.nanCount++;
      if (!isFinite(val)) stats.infCount++;
      if (val === 0) stats.zeroCount++;
      
      stats.min = Math.min(stats.min, val);
      stats.max = Math.max(stats.max, val);
      stats.sum += val;
      stats.sumSquares += val * val;
    }
  }

  const count = metadata.sparse ? 
    metadata.shape.reduce((a, b) => a * b, 1) : 
    data.length;

  return {
    ...stats,
    mean: stats.sum / count,
    std: Math.sqrt(stats.sumSquares/count - (stats.sum/count)**2),
    zeroRatio: stats.zeroCount / count,
    sparsity: metadata.sparse ? 
      (metadata.sparseRatio ?? stats.zeroCount / count) : 
      0,
    gradNorm: metadata.gradients?.norm || 0,
    updateRatio: metadata.updates?.ratio || 0
  };
};

/**
 * Sparse Tensor Updater
 * @param {TypedArray} tensorData 
 * @param {object} update {indices: Array<number>, values: Array<number>}
 * @param {Array<number>} shape 
 */
export const applySparseUpdate = (tensorData, update, shape) => {
  if (!update.indices || !update.values) {
    throw new Error('Invalid sparse update format');
  }

  const strides = shape.slice(1).reduceRight(
    (acc, dim) => [dim * acc[0], ...acc],
    [1]
  );

  update.indices.forEach((indexArr, i) => {
    const flatIndex = indexArr.reduce(
      (acc, dim, idx) => acc + dim * strides[idx],
      0
    );
    tensorData[flatIndex] = update.values[i];
  });
};

/**
 * Format Tensor Values for Display
 * @param {number} value 
 * @param {string} dtype 
 * @returns {string} formatted value
 */
export const formatStats = (value, dtype) => {
  if (dtype === 'float32') {
    if (Math.abs(value) < 1e-4 || Math.abs(value) > 1e4) {
      return value.toExponential(4);
    }
    return value.toFixed(6).replace(/\.?0+$/, '');
  }
  return Math.round(value).toString();
};

/**
 * Tensor Shape Validator
 * @param {TypedArray} data 
 * @param {Array<number>} shape 
 */
export const validateShape = (data, shape) => {
  const expectedSize = shape.reduce((a, b) => a * b, 1);
  if (data.length !== expectedSize) {
    throw new Error(`Shape ${shape} requires ${expectedSize} elements, got ${data.length}`);
  }
};

/**
 * Tensor Memory Calculator
 * @param {Array<number>} shape 
 * @param {string} dtype 
 * @returns {number} bytes
 */
export const calculateTensorMemory = (shape, dtype) => {
  const elements = shape.reduce((a, b) => a * b, 1);
  return elements * (dtype === 'float32' ? 4 : 4);
};

/**
 * Create Empty Tensor
 * @param {Array<number>} shape 
 * @param {string} dtype 
 * @returns {object} tensor
 */
export const createEmptyTensor = (shape, dtype = 'float32') => {
  const size = shape.reduce((a, b) => a * b, 1);
  return {
    data: dtype === 'float32' ? 
      new Float32Array(size) : 
      new Int32Array(size),
    metadata: {
      shape: [...shape],
      dtype,
      device: 'cpu',
      memory: calculateTensorMemory(shape, dtype),
      sparse: false
    }
  };
};

/**
 * Convert Tensor to Display String
 * @param {object} tensor 
 * @param {number} maxElements 
 * @returns {string} formatted string
 */
export const tensorToString = (tensor, maxElements = 100) => {
  const { data, metadata } = tensor;
  const elements = data.slice(0, maxElements);
  
  return `Tensor(
    shape: [${metadata.shape.join(', ')}],
    dtype: ${metadata.dtype},
    values: [${elements.map(v => formatStats(v, metadata.dtype)).join(', ')}...]
  )`;
};

// WebAssembly memory management
const wasmMemoryManager = {
  allocate: (size) => wasmInstance.exports.alloc(size),
  free: (ptr) => wasmInstance.exports.free(ptr),
  copyToWasm: (data, ptr) => {
    new data.constructor(
      wasmInstance.exports.memory.buffer,
      ptr,
      data.length
    ).set(data);
  }
};

export default {
  validateTensor,
  tensorSummary,
  applySparseUpdate,
  formatStats,
  validateShape,
  calculateTensorMemory,
  createEmptyTensor,
  tensorToString
};
