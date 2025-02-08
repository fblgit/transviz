// ui/src/services/wsClient.js
import { validateWebSocketMessage } from '../utils/validationHelpers';
import { useStore as useTensorStore } from '../stores/tensorStore';
import { useStore as useBreakpointStore } from '../stores/breakpointStore';
import { useStore as useMetricsStore } from '../stores/metricsStore';

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribers = new Map();
    this.pendingMessages = [];
  }

  initialize() {
    this.connect();
    window.addEventListener('beforeunload', () => this.close());
  }

  connect() {
    if (this.socket) return;

    this.socket = new WebSocket(`wss://${window.location.host}/ws`);
    
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleClose.bind(this);
    this.socket.onerror = this.handleError.bind(this);
  }

  handleOpen() {
    this.reconnectAttempts = 0;
    this.flushPendingMessages();
    console.log('WebSocket connected');
  }

  handleMessage(event) {
    try {
      const message = this.parseMessage(event.data);
      if (!validateWebSocketMessage(message)) return;

      switch(message.type) {
        case 'tensor_update':
          useTensorStore.getState().handleTensorUpdate(message);
          break;
        case 'breakpoint_hit':
          useBreakpointStore.getState().handleBreakpointHit(message);
          break;
        case 'metric_update':
          useMetricsStore.getState().addMetricData(message);
          break;
        default:
          this.notifySubscribers(message.type, message);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  parseMessage(data) {
    try {
      if (data instanceof ArrayBuffer) {
        return JSON.parse(new TextDecoder().decode(data));
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse message:', error);
      return null;
    }
  }

  handleClose(event) {
    console.log(`WebSocket closed: ${event.reason}`);
    this.socket = null;
    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  handleError(error) {
    console.error('WebSocket error:', error);
  }

  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(message);
      this.socket.send(payload);
    } else {
      this.pendingMessages.push(message);
    }
  }

  flushPendingMessages() {
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift();
      this.send(msg);
    }
  }

  subscribe(eventType, callback) {
    const handlers = this.subscribers.get(eventType) || [];
    this.subscribers.set(eventType, [...handlers, callback]);
    return () => this.unsubscribe(eventType, callback);
  }

  unsubscribe(eventType, callback) {
    const handlers = this.subscribers.get(eventType)?.filter(h => h !== callback);
    this.subscribers.set(eventType, handlers || []);
  }

  notifySubscribers(eventType, data) {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const wsClient = new WebSocketClient();
