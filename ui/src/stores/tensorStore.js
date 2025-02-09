/* ui/src/stores/tensorStore.js */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { applyTensorDiff, validateDiff } from '../utils/diffHelpers';
import { validateTensorStructure, validateConditionSyntax } from '../utils/validationHelpers';
import { wsClient } from '../services/wsClient';

export const useStore = create(
  immer((set, get) => ({
    // State
    tensors: new Map(),        // Map<string, Tensor>
    breakpoints: new Map(),    // Map<string, Breakpoint>

    // Handle full tensor update messages (for first load or when a full tensor is sent)
    handleTensorFull: (message) => {
      set(state => {
        // Create or reset the tensor using received full data
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
    // Handle tensor diff (or light metadata) update messages  
    handleTensorUpdate: (message) => {
      set(state => {
        // Get existing tensor or initialize if missing (for diff updates we assume tensor exists)
        let tensor = state.tensors.get(message.name);
        if (!tensor) {
          // If the tensor does not exist yet, initialize a default tensor
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
          // In light mode, you might want to update only stats/metadata (or do nothing extra)
          tensor.metadata.lastUpdated = Date.now();
          // Optionally: update stats here from message.stats if needed.
        }
        else if (message.type === 'tensor_diff') {
          try {
            validateDiff(message.diff, tensor.metadata.shape);
            applyTensorDiff(tensor, message.diff);
            tensor.metadata.lastUpdated = Date.now();
          } catch (error) {
            console.error('Failed to apply tensor diff:', error);
          }
        }
      });
    },
    // Action: Handle incoming tensor update messages.
    legacyhandleTensorUpdate: (message) => {
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

// Subscribe to all tensor-related WebSocket events just once
let wsSubscribed = false;
useStore.subscribe(() => {
  if (!wsSubscribed) {
    wsSubscribed = true;
    // For full tensor updates:
    wsClient.subscribe('tensor_full', (message) => {
      useStore.getState().handleTensorFull(message);
    });
    // For diff updates:
    wsClient.subscribe('tensor_diff', (message) => {
      useStore.getState().handleTensorUpdate(message);
    });
    // For light (stat-only) updates:
    wsClient.subscribe('tensor_update', (message) => {
      useStore.getState().handleTensorUpdate(message);
    });
    // Periodically prune tensors.
    setInterval(() => useStore.getState().pruneOldTensors(), 60000);
  }
});
