/* ui/src/stores/tensorStore.js */
import create from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { applyTensorDiff, validateDiff } from '../utils/diffHelpers';
import { validateTensorStructure, validateConditionSyntax } from '../utils/validationHelpers';
import { wsClient } from '../services/wsClient';

export const useStore = create(
  immer((set, get) => ({
    // State
    tensors: new Map(),        // Map<string, Tensor>
    breakpoints: new Map(),    // Map<string, Breakpoint>

    // Action: Handle incoming tensor update messages.
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

    // Action: Handle incoming breakpoint hit message.
    handleBreakpointHit: (message) => {
      set(state => {
        const bp = state.breakpoints.get(message.name);
        if (bp) {
          bp.hits++;
          bp.lastHit = Date.now();
        }
      });
    },

    // Action: Update a breakpoint’s condition.
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

    // Action: Toggle a breakpoint’s enabled state.
    toggleBreakpoint: (layerId) => {
      set(state => {
        const bp = state.breakpoints.get(layerId);
        if (bp) {
          bp.enabled = !bp.enabled;
        }
      });
    },

    // Action: Add a new breakpoint.
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

    // Action: Remove an existing breakpoint.
    removeBreakpoint: (layerId) => {
      set(state => {
        state.breakpoints.delete(layerId);
      });
    },

    // Action: Prune tensor entries that haven't been updated within the maxAge (default: 5 minutes).
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

    // Action: Returns a snapshot of the tensor data.
    getTensorSnapshot: (name) => {
      const tensor = get().tensors.get(name);
      return tensor ? structuredClone(tensor) : null;
    }
  }))
);

// Subscribe to global wsClient events only once.
let wsSubscribed = false;
useStore.subscribe(() => {
  if (!wsSubscribed) {
    wsSubscribed = true;
    // Subscribe to tensor updates
    wsClient.subscribe('tensor_update', (message) => {
      useStore.getState().handleTensorUpdate(message);
    });
    // Subscribe to breakpoint hit events (if needed in tensor store too)
    wsClient.subscribe('breakpoint_hit', (message) => {
      useStore.getState().handleBreakpointHit(message);
    });
    // Start a periodic prune of old tensors every minute.
    setInterval(() => useStore.getState().pruneOldTensors(), 60000);
  }
});
