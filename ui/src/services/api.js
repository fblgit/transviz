// ui/src/services/api.js
import axios from 'axios';
import { validateWebSocketMessage, validateTensorStructure } from '../utils/validationHelpers';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Request interceptor for API calls
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const tensorAPI = {
  getTensorData: async (tensorId) => {
    const response = await apiClient.get(`/tensors/${tensorId}`);
    if (!validateTensorStructure(response.data)) {
      throw new Error('Invalid tensor structure from API');
    }
    return response.data;
  },

  updateTensorMetadata: async (tensorId, metadata) => {
    return apiClient.patch(`/tensors/${tensorId}/metadata`, metadata);
  }
};

export const breakpointAPI = {
  createBreakpoint: async (layerId, condition) => {
    return apiClient.post('/breakpoints', {
      layerId,
      condition,
      enabled: true
    });
  },

  syncBreakpoints: async (breakpoints) => {
    return apiClient.put('/breakpoints', {
      breakpoints: Array.from(breakpoints.entries())
    });
  }
};

export const metricsAPI = {
  fetchMetricsHistory: async (metricNames, timeRange) => {
    return apiClient.post('/metrics/history', {
      metrics: metricNames,
      start: timeRange.start,
      end: timeRange.end
    });
  },

  exportMetrics: async (format = 'csv') => {
    return apiClient.get(`/metrics/export?format=${format}`, {
      responseType: 'blob'
    });
  }
};

export const authAPI = {
  refreshToken: async () => {
    const response = await axios.post('/auth/refresh', {
      refreshToken: localStorage.getItem('refreshToken')
    });
    return response.data;
  }
};

export const setAuthToken = (token) => {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};
