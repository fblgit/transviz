import create from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { validateWebSocketMessage, validateMetricName } from '../utils/validationHelpers';

const MAX_DATA_POINTS = 1000;
const PRUNE_INTERVAL = 60000; // 1 minute

export const useStore = create(
  immer((set, get) => ({
    // State
    availableMetrics: [],
    selectedMetrics: [],
    metricData: [],
    
    // Actions
    initialize: () => {
      // Set up WebSocket connection
      const ws = new WebSocket(`wss://${window.location.host}/metrics`);
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (validateWebSocketMessage(message) && message.type === 'metric_update') {
          get().addMetricData(message);
        }
      };

      // Set up data pruning
      setInterval(() => get().pruneData(), PRUNE_INTERVAL);
    },

    addMetricData: (message) => {
      set(state => {
        // Add new metric if not exists
        if (!state.availableMetrics.includes(message.name)) {
          state.availableMetrics.push(message.name);
        }
        
        // Update metric data
        state.metricData.push({
          timestamp: message.timestamp,
          values: {
            [message.name]: message.value
          }
        });
        
        // Keep data within limit
        if (state.metricData.length > MAX_DATA_POINTS) {
          state.metricData.splice(0, state.metricData.length - MAX_DATA_POINTS);
        }
      });
    },

    toggleMetric: (metric) => {
      set(state => {
        const index = state.selectedMetrics.indexOf(metric);
        if (index === -1) {
          state.selectedMetrics.push(metric);
        } else {
          state.selectedMetrics.splice(index, 1);
        }
      });
    },

    addMetrics: (metrics) => {
      set(state => {
        metrics.forEach(metric => {
          if (validateMetricName(metric) && !state.availableMetrics.includes(metric)) {
            state.availableMetrics.push(metric);
          }
        });
      });
    },

    pruneData: () => {
      const now = Date.now();
      set(state => {
        state.metricData = state.metricData.filter(
          entry => now - entry.timestamp < 300000 // 5 minutes
        );
      });
    },

    reset: () => {
      set({
        availableMetrics: [],
        selectedMetrics: [],
        metricData: []
      });
    }
  }))
);

// Initialize WebSocket connection on first store access
let initialized = false;
useStore.subscribe(state => {
  if (!initialized && state.initialize) {
    state.initialize();
    initialized = true;
  }
});
