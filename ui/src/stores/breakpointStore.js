/* ui/src/stores/breakpointStore.js */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { validateConditionSyntax } from '../utils/validationHelpers';
import { wsClient } from '../services/wsClient';

export const useStore = create(
  immer((set, get) => ({
    // State: A map to store breakpoints keyed by layerId
    breakpoints: new Map(),

    // Removed internal WebSocket connection and initialization;
    // We now rely on the global wsClient to dispatch messages.

    // Action: Process a breakpoint hit received via wsClient.
    handleBreakpointHit: (message) => {
      set(state => {
        const bp = state.breakpoints.get(message.layerId);
        if (bp && bp.enabled) {
          bp.hits++;
          bp.lastHit = Date.now();
          bp.lastTensor = message.tensorData;
        }
      });
    },

    // Action: Add a new breakpoint after validating its condition syntax.
    addBreakpoint: (layerId, condition) => {
      if (!validateConditionSyntax(condition)) {
        throw new Error('Invalid breakpoint condition syntax');
      }
      set(state => {
        state.breakpoints.set(layerId, {
          condition,
          hits: 0,
          enabled: true,
          created: Date.now(),
          lastHit: null,
          lastTensor: null
        });
        get().syncBreakpoint(layerId);
      });
    },

    // Action: Update an existing breakpoint.
    updateBreakpoint: (layerId, condition) => {
      if (!validateConditionSyntax(condition)) {
        throw new Error('Invalid breakpoint condition syntax');
      }
      set(state => {
        const bp = state.breakpoints.get(layerId);
        if (bp) {
          bp.condition = condition;
          get().syncBreakpoint(layerId);
        }
      });
    },

    // Action: Toggle a breakpoint's enabled state.
    toggleBreakpoint: (layerId) => {
      set(state => {
        const bp = state.breakpoints.get(layerId);
        if (bp) {
          bp.enabled = !bp.enabled;
          get().syncBreakpoint(layerId);
        }
      });
    },

    // Action: Remove a breakpoint and notify the server.
    removeBreakpoint: (layerId) => {
      set(state => {
        if (state.breakpoints.delete(layerId)) {
          get().sendBreakpointUpdate(layerId, 'remove');
        }
      });
    },

    // Action: Synchronize a breakpoint's state with the server.
    syncBreakpoint: (layerId) => {
      const bp = get().breakpoints.get(layerId);
      if (bp) {
        // If enabled, send an update; if disabled, send a disable action.
        get().sendBreakpointUpdate(layerId, bp.enabled ? 'update' : 'disable');
      }
    },

    // Action: Send a breakpoint update via the centralized wsClient.
    sendBreakpointUpdate: (layerId, action) => {
      const bp = get().breakpoints.get(layerId);
      if (!bp) return;
      const message = {
        type: 'breakpoint_update',
        action,
        layerId,
        condition: action !== 'remove' ? bp.condition : null
      };
      wsClient.send(message);
    },

    // Action: Resend all active breakpoints (for example on reconnect).
    resendActiveBreakpoints: () => {
      get().breakpoints.forEach((bp, layerId) => {
        if (bp.enabled) {
          get().syncBreakpoint(layerId);
        }
      });
    },

    // Action: Prune breakpoints that have not been hit within maxAge (default: 1 week).
    pruneInactiveBreakpoints: (maxAge = 604800000) => {
      const now = Date.now();
      set(state => {
        state.breakpoints.forEach((bp, layerId) => {
          if (bp.lastHit && now - bp.lastHit > maxAge && !bp.enabled) {
            state.breakpoints.delete(layerId);
          }
        });
      });
    },

    // Action: Retrieve the state of a specific breakpoint.
    getBreakpointState: (layerId) => {
      return get().breakpoints.get(layerId) || null;
    }
  }))
);

// Subscribe to breakpoint hit events coming from the centralized wsClient.
// This subscription is performed only once.
let wsSubscribed = false;
useStore.subscribe(() => {
  if (!wsSubscribed) {
    wsSubscribed = true;
    wsClient.subscribe('breakpoint_hit', (message) => {
      useStore.getState().handleBreakpointHit(message);
    });
    // Start pruning inactive breakpoints on an hourly basis.
    setInterval(() => useStore.getState().pruneInactiveBreakpoints(), 3600000);
  }
});
