import { validateTensor } from './tensorUtils';

/**
 * Validation Utilities
 * 
 * Requirements:
 * - Validate tensor conditions syntax
 * - Check tensor structure integrity
 * - Sanitize user inputs
 * - Verify WebSocket message formats
 * - Ensure numerical stability
 */

// Error code constants
const VALIDATION_ERRORS = {
  INVALID_CONDITION: 'VC001',
  TENSOR_STRUCTURE: 'VC002',
  UNSAFE_FUNCTION: 'VC003',
  METRIC_NAME: 'VC004',
  WS_MESSAGE: 'VC005',
  NUMERICAL_STABILITY: 'VC006'
};

// Allowed condition function keywords
const ALLOWED_KEYWORDS = new Set([
  'return', 'Math', 'abs', 'max', 'min', 'sqrt', 'pow',
  'exp', 'log', 'sin', 'cos', 'tan', 'sum', 'mean', 'std'
]);

// Metric name validation regex
const METRIC_NAME_REGEX = /^[a-zA-Z_][\w/-]{1,63}$/;

/**
 * Validate tensor condition syntax
 * @param {string} condition
 * @returns {boolean}
 */
export const validateConditionSyntax = (condition) => {
  try {
    const ast = parseCondition(condition);
    return validateConditionAST(ast);
  } catch (error) {
    return false;
  }
};

/**
 * Parse and validate condition AST
 * @param {string} condition 
 */
const parseCondition = (condition) => {
  const wrapped = `(function(tensor) { return ${condition} })`;
  const ast = Babel.parse(wrapped, {
    sourceType: 'script',
    plugins: ['typescript']
  });
  
  const body = ast.program.body[0].expression.callee.body;
  return body;
};

/**
 * Validate AST nodes recursively
 * @param {object} node 
 */
const validateConditionAST = (node) => {
  const validators = {
    Identifier: (n) => {
      if (!ALLOWED_KEYWORDS.has(n.name)) {
        throw new Error(`Disallowed identifier: ${n.name}`);
      }
    },
    MemberExpression: (n) => {
      if (n.object.name !== 'Math' && n.object.name !== 'tensor') {
        throw new Error(`Invalid member access: ${n.object.name}`);
      }
    },
    CallExpression: (n) => {
      if (n.callee.object?.name !== 'Math') {
        throw new Error('Only Math functions allowed');
      }
    }
  };

  if (validators[node.type]) {
    validators[node.type](node);
  }

  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      validateConditionAST(node[key]);
    }
  }
  
  return true;
};

/**
 * Validate tensor structure
 * @param {object} tensor 
 * @returns {boolean}
 */
export const validateTensorStructure = (tensor) => {
  const requiredKeys = ['data', 'metadata'];
  const requiredMetadata = ['shape', 'dtype', 'device'];
  
  return (
    validateTensor(tensor) &&
    requiredKeys.every(k => tensor.hasOwnProperty(k)) &&
    requiredMetadata.every(k => tensor.metadata.hasOwnProperty(k)) &&
    Array.isArray(tensor.metadata.shape) &&
    ['float32', 'int32'].includes(tensor.metadata.dtype)
  );
};

/**
 * Safe evaluation wrapper for conditions
 * @param {string} condition 
 * @param {object} tensor 
 */
export const safeEvalCondition = (condition, tensor) => {
  try {
    const func = new Function('tensor', `
      "use strict";
      const T = tensor.data;
      const shape = ${JSON.stringify(tensor.metadata.shape)};
      return ${condition};
    `);
    
    return func(tensor);
  } catch (error) {
    throw new ValidationError(
      VALIDATION_ERRORS.INVALID_CONDITION,
      `Condition evaluation failed: ${error.message}`
    );
  }
};

/**
 * Validate WebSocket message structure
 * @param {object} message 
 * @returns {boolean}
 */
export const validateWebSocketMessage = (message) => {
  const types = ['tensor_update', 'breakpoint_hit', 'metric_update'];
  const required = {
    tensor_update: ['type', 'name', 'data'],
    breakpoint_hit: ['type', 'name', 'tensor'],
    metric_update: ['type', 'name', 'value', 'timestamp']
  };

  if (!types.includes(message.type)) return false;
  return required[message.type].every(k => message.hasOwnProperty(k));
};

/**
 * Validate metric name format
 * @param {string} name 
 * @returns {boolean}
 */
export const validateMetricName = (name) => {
  return METRIC_NAME_REGEX.test(name) && name.length <= 64;
};

/**
 * Validate numerical tensor values
 * @param {TypedArray} data 
 * @returns {object}
 */
export const validateTensorNumerics = (data) => {
  let hasNaN = false;
  let hasInf = false;
  
  // SIMD optimized check
  const vectorSize = 4;
  const simdArray = new Float32Array(data.buffer);
  
  for (let i = 0; i < simdArray.length; i += vectorSize) {
    const vec = simdArray.subarray(i, i + vectorSize);
    if (vec.some(v => Number.isNaN(v))) hasNaN = true;
    if (vec.some(v => !Number.isFinite(v))) hasInf = true;
  }
  
  return { valid: !hasNaN && !hasInf, hasNaN, hasInf };
};

/**
 * Validate user input shape
 * @param {string} shapeStr 
 * @returns {boolean}
 */
export const validateShapeString = (shapeStr) => {
  try {
    const shape = shapeStr.split(',').map(Number);
    return shape.every(Number.isInteger) && 
           shape.length > 0 && 
           shape.every(d => d > 0);
  } catch {
    return false;
  }
};

// Custom error class
export class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ValidationError';
  }
}

// validationHelpers.js - Add missing export
//export const tensorValidator = (tensor) => {
// Validation logic from core/breakpoints.py
//  return !torch.isnan(tensor).any() && !torch.isinf(tensor).any();
//};

export const tensorValidator = async (tensorData) => {
  const { simd } = await import('wasm-feature-detect');
  const useSIMD = await simd();
  
  const module = await import('../../public/wasm/tensor' + 
    (useSIMD ? '-simd' : '') + '.wasm');
  // Run validation using compiled WASM
  return module.validate_tensor(tensorData);
};

export default {
  VALIDATION_ERRORS,
  validateConditionSyntax,
  validateTensorStructure,
  safeEvalCondition,
  validateWebSocketMessage,
  validateMetricName,
  validateTensorNumerics,
  validateShapeString,
  tensorValidator
};
