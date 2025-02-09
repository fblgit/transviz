/* ui/src/stores/metricsStore.js */
import create from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { validateWebSocketMessage, validateMetricName } from '../utils/validationHelpers';
import { wsClient } from '../services/wsClient';

const MAX_DATA_POINTS = 1000;
const PRUNE_INTERVAL = 60000; // 1 minute

export const useStore = create(
  immer((set, get) => ({
    // State
    availableMetrics: [],
    selectedMetrics: [],
    metricData: [],

    // Action: Add new metric data received via the centralized wsClient.
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

    // Action: Toggle a metric on/off from the selected metrics
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

    // Action: Batch add metrics after validating names.
    addMetrics: (metrics) => {
      set(state => {
        metrics.forEach(metric => {
          if (validateMetricName(metric) && !state.availableMetrics.includes(metric)) {
            state.availableMetrics.push(metric);
          }
        });
      });
    },

    // Action: Prune old metric data, keeping only entries from the last 5 minutes.
    pruneData: () => {
      const now = Date.now();
      set(state => {
        state.metricData = state.metricData.filter(
          entry => now - entry.timestamp < 300000 // 5 minutes in milliseconds
        );
      });
    },

    // Action: Reset the metrics store state.
    reset: () => {
      set({
        availableMetrics: [],
        selectedMetrics: [],
        metricData: []
      });
    }
  }))
);

// Subscribe to wsClient events and set up periodic pruning.
// This subscription is performed only once.
let wsSubscribed = false;
useStore.subscribe(() => {
  if (!wsSubscribed) {
    wsSubscribed = true;
    // Subscribe to 'metric_update' events from the centralized wsClient.
    wsClient.subscribe('metric_update', (message) => {
      if (validateWebSocketMessage(message) && message.type === 'metric_update') {
        useStore.getState().addMetricData(message);
      }
    });
    // Start periodic pruning of metric data.
    setInterval(() => useStore.getState().pruneData(), PRUNE_INTERVAL);
  }
});
