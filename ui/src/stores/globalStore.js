import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { wsClient } from '../services/wsClient';
import { applyTensorDiff, validateDiff } from '../utils/diffHelpers';
import { validateConditionSyntax } from '../utils/validationHelpers';

/*
  The unified store state contains three top-level keys:
    • tensors – a Map keyed by tensor name, holding its data and metadata
    • metrics – an object with availableMetrics, selectedMetrics, and metricData
    • breakpoints – a Map keyed by breakpoint name
*/
export const useGlobalStore = create(
  immer((set, get) => ({
    tensors: new Map(),  // key: tensor name → { data: Float32Array, metadata: { ... } }
    metrics: {
      availableMetrics: [],
      selectedMetrics: [],
      metricData: []   // Each entry, e.g. {timestamp, values: { [metricName]: number } }
    },
    breakpoints: new Map(), // key: breakpoint name → { condition, hits, enabled, created, lastHit, lastTensor }

    // ----------------
    // TENSOR HANDLERS
    // When a full tensor update is received
    handleTensorFull: (message) => {
      // Expected message format:
      // { type: "tensor_full", name, data: [...], shape: [...], dtype }
      set(state => {
        state.tensors.set(message.name, {
          data: new Float32Array(message.data),
          metadata: {
            version: 1,
            shape: message.shape,
            dtype: message.dtype,
            device: 'cpu',
            lastUpdated: Date.now()
          }
        });
      });
    },
    // When a diff or light update is received
    handleTensorDiffOrUpdate: (message) => {
      // Expected message formats:
      // { type: "tensor_diff", name, diff } OR
      // { type: "tensor_update", name, shape, dtype, stats } for light info
      console.log(message);
      set(state => {
        let tensor = state.tensors.get(message.name);
        if (!tensor) {
          // Create a new tensor entry if not exists
          tensor = {
            data: new Float32Array(),
            metadata: {
              version: 0,
              shape: message.shape || [],
              dtype: message.dtype || 'float32',
              device: 'cpu',
              lastUpdated: Date.now()
            }
          };
          state.tensors.set(message.name, tensor);
        }
        if (message.type === 'tensor_update') {
          // In light mode, simply update lastUpdated and optionally stats
          tensor.metadata.lastUpdated = Date.now();
          // Optionally, you can update tensor.stats = message.stats;
        } else if (message.type === 'tensor_diff') {
          try {
            validateDiff(message.diff, tensor.metadata.shape);
            applyTensorDiff(tensor, message.diff);
            tensor.metadata.lastUpdated = Date.now();
          } catch (error) {
            console.error('Error applying tensor diff:', error);
          }
        }
      });
    },

    // ----------------
    // METRICS HANDLERS
    handleMetricUpdate: (message) => {
      // Expected message format:
      // { type: "metric_update", name, value, timestamp }
      set(state => {
        // Add new metric name if not already in the list
        if (!state.metrics.availableMetrics.includes(message.name)) {
          state.metrics.availableMetrics.push(message.name);
        }
        state.metrics.metricData.push({
          timestamp: message.timestamp,
          values: {
            [message.name]: message.value
          }
        });
        // Limit data array length if necessary
        const MAX_DATA_POINTS = 1000;
        if (state.metrics.metricData.length > MAX_DATA_POINTS) {
          state.metrics.metricData.splice(0, state.metrics.metricData.length - MAX_DATA_POINTS);
        }
      });
    },

    // ----------------
    // BREAKPOINT HANDLERS
    handleBreakpointHit: (message) => {
      // Expected message format:
      // { type: "breakpoint_hit", name, tensorData }
      set(state => {
        const bp = state.breakpoints.get(message.name);
        if (bp && bp.enabled) {
          bp.hits++;
          bp.lastHit = Date.now();
          bp.lastTensor = message.tensorData;
        }
      });
    },
    addBreakpoint: (name, condition) => {
      if (!validateConditionSyntax(condition)) {
        throw new Error('Invalid breakpoint condition syntax');
      }
      set(state => {
        state.breakpoints.set(name, {
          condition,
          hits: 0,
          enabled: true,
          created: Date.now(),
          lastHit: null,
          lastTensor: null
        });
      });
    },
    updateBreakpoint: (name, condition) => {
      if (!validateConditionSyntax(condition)) {
        throw new Error('Invalid breakpoint condition syntax');
      }
      set(state => {
        const bp = state.breakpoints.get(name);
        if (bp) {
          bp.condition = condition;
        }
      });
    },
    toggleBreakpoint: (name) => {
      set(state => {
        const bp = state.breakpoints.get(name);
        if (bp) {
          bp.enabled = !bp.enabled;
        }
      });
    },

    // Additional actions for metrics and tensor pruning can be added here…
  }))
);

// ----------------
// WebSocket Subscriptions – ensure that we subscribe only once.
let wsSubscribed = false;
useGlobalStore.subscribe(() => {
  if (!wsSubscribed) {
    wsSubscribed = true;
    wsClient.subscribe('tensor_full', (message) => {
      useGlobalStore.getState().handleTensorFull(message);
    });
    wsClient.subscribe('tensor_diff', (message) => {
      useGlobalStore.getState().handleTensorDiffOrUpdate(message);
    });
    wsClient.subscribe('tensor_update', (message) => {
      useGlobalStore.getState().handleTensorDiffOrUpdate(message);
    });
    wsClient.subscribe('metric_update', (message) => {
      useGlobalStore.getState().handleMetricUpdate(message);
    });
    wsClient.subscribe('breakpoint_hit', (message) => {
      useGlobalStore.getState().handleBreakpointHit(message);
    });
  }
});
