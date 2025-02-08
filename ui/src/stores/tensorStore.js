// ui/src/stores/tensorStore.js
import create from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { applyTensorDiff, validateDiff } from '../utils/diffHelpers';
import { validateTensorStructure, validateConditionSyntax } from '../utils/validationHelpers';

export const useStore = create(
  immer((set, get) => ({
    // State
    tensors: new Map(),        // Map<string, Tensor>
    breakpoints: new Map(),    // Map<string, Breakpoint>
    wsConnection: null,
    
    // Actions
    initialize: () => {
      const ws = new WebSocket(`wss://${window.location.host}/tensors`);
      set({ wsConnection: ws });

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'tensor_update') {
          get().handleTensorUpdate(message);
        }
        if (message.type === 'breakpoint_hit') {
          get().handleBreakpointHit(message);
        }
      };

      ws.onclose = () => {
        setTimeout(() => get().initialize(), 1000);
      };
    },

    handleTensorUpdate: (message) => {
      set(state => {
        const tensor = state.tensors.get(message.name) || {
          data: new Float32Array(),
          metadata: {
            version: 0,
            shape: [],
            dtype: 'float32',
            device: 'cpu',
            lastUpdated: Date.now()
          }
        };

        try {
          validateDiff(message.diff, tensor.metadata.shape);
          applyTensorDiff(tensor, message.diff);
          tensor.metadata.lastUpdated = Date.now();
          state.tensors.set(message.name, tensor);
        } catch (error) {
          console.error('Failed to apply tensor diff:', error);
        }
      });
    },

    handleBreakpointHit: (message) => {
      set(state => {
        const bp = state.breakpoints.get(message.name);
        if (bp) {
          bp.hits++;
          bp.lastHit = Date.now();
        }
      });
    },

    updateBreakpoint: (layerId, condition) => {
      if (!validateConditionSyntax(condition)) {
        throw new Error('Invalid breakpoint condition syntax');
      }

      set(state => {
        const bp = state.breakpoints.get(layerId) || {
          condition: '',
          hits: 0,
          enabled: true
        };
        bp.condition = condition;
        state.breakpoints.set(layerId, bp);
      });
    },

    toggleBreakpoint: (layerId) => {
      set(state => {
        const bp = state.breakpoints.get(layerId);
        if (bp) {
          bp.enabled = !bp.enabled;
        }
      });
    },

    addBreakpoint: (layerId, condition) => {
      if (!validateConditionSyntax(condition)) {
        throw new Error('Invalid breakpoint condition');
      }

      set(state => {
        state.breakpoints.set(layerId, {
          condition,
          hits: 0,
          enabled: true,
          created: Date.now()
        });
      });
    },

    removeBreakpoint: (layerId) => {
      set(state => {
        state.breakpoints.delete(layerId);
      });
    },

    pruneOldTensors: (maxAge = 300000) => {
      const now = Date.now();
      set(state => {
        state.tensors.forEach((tensor, name) => {
          if (now - tensor.metadata.lastUpdated > maxAge) {
            state.tensors.delete(name);
          }
        });
      });
    },

    getTensorSnapshot: (name) => {
      const tensor = get().tensors.get(name);
      return tensor ? structuredClone(tensor) : null;
    }
  }))
);

// Initialize WebSocket connection
let initialized = false;
useStore.subscribe(state => {
  if (!initialized && state.initialize) {
    state.initialize();
    setInterval(() => state.pruneOldTensors(), 60000);
    initialized = true;
  }
});
