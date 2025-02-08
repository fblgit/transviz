// ui/src/stores/breakpointStore.js
import create from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { validateConditionSyntax } from '../utils/validationHelpers';

export const useStore = create(
  immer((set, get) => ({
    // State
    breakpoints: new Map(), // Map<layerId, Breakpoint>
    wsConnection: null,
    
    // Breakpoint structure:
    // {
    //   condition: string,
    //   hits: number,
    //   enabled: boolean,
    //   lastHit: timestamp,
    //   created: timestamp
    // }

    // Actions
    initialize: () => {
      const ws = new WebSocket(`wss://${window.location.host}/breakpoints`);
      set({ wsConnection: ws });

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'breakpoint_hit') {
          get().handleBreakpointHit(message);
        }
      };

      ws.onclose = () => {
        setTimeout(() => get().initialize(), 1000);
      };

      // Resend active breakpoints on reconnect
      ws.onopen = () => {
        get().resendActiveBreakpoints();
      };
    },

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

    toggleBreakpoint: (layerId) => {
      set(state => {
        const bp = state.breakpoints.get(layerId);
        if (bp) {
          bp.enabled = !bp.enabled;
          get().syncBreakpoint(layerId);
        }
      });
    },

    removeBreakpoint: (layerId) => {
      set(state => {
        if (state.breakpoints.delete(layerId)) {
          get().sendBreakpointUpdate(layerId, 'remove');
        }
      });
    },

    syncBreakpoint: (layerId) => {
      const bp = get().breakpoints.get(layerId);
      if (bp) {
        get().sendBreakpointUpdate(layerId, bp.enabled ? 'update' : 'disable');
      }
    },

    sendBreakpointUpdate: (layerId, action) => {
      const bp = get().breakpoints.get(layerId);
      if (!bp || !get().wsConnection) return;

      const message = {
        type: 'breakpoint_update',
        action,
        layerId,
        condition: action !== 'remove' ? bp.condition : null
      };

      get().wsConnection.send(JSON.stringify(message));
    },

    resendActiveBreakpoints: () => {
      get().breakpoints.forEach((bp, layerId) => {
        if (bp.enabled) {
          get().syncBreakpoint(layerId);
        }
      });
    },

    pruneInactiveBreakpoints: (maxAge = 604800000) => { // 1 week
      const now = Date.now();
      set(state => {
        state.breakpoints.forEach((bp, layerId) => {
          if (now - bp.lastHit > maxAge && !bp.enabled) {
            state.breakpoints.delete(layerId);
          }
        });
      });
    },

    getBreakpointState: (layerId) => {
      return get().breakpoints.get(layerId) || null;
    }
  }))
);

// Initialize WebSocket connection
let initialized = false;
useStore.subscribe(state => {
  if (!initialized && state.initialize) {
    state.initialize();
    setInterval(() => state.pruneInactiveBreakpoints(), 3600000); // Hourly pruning
    initialized = true;
  }
});
