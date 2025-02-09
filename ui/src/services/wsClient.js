/* ui/src/services/wsClient.js */
import { validateWebSocketMessage } from '../utils/validationHelpers';

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribers = new Map(); // maps eventType to array of callbacks
    this.pendingMessages = [];
    this.isClosedManually = false; // distinguishes manual close vs. unintentional disconnect
    this.initialized = false;       // flag to prevent duplicate initialization
  }

  // Initialize the single, central WebSocket connection
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.isClosedManually = false; // Reset the manual closed flag
    this.connect();
    window.addEventListener('beforeunload', this.close.bind(this));
  }

  // Open a new connection only if there isn't one already or if not closed manually
  connect() {
    if (this.socket || this.isClosedManually) return;
    this.socket = new WebSocket(`ws://127.0.0.1:8080/ws`);
    //this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleClose.bind(this);
    this.socket.onerror = this.handleError.bind(this);
  }

  // When connection opens, reset backoff, flush any queued messages
  handleOpen() {
    this.reconnectAttempts = 3;
    this.flushPendingMessages();
    console.log('WebSocket connected');
    console.log(this.socket.readyState);
  }

  // On receiving a message, parse the message and – if valid – dispatch it to subscribers
  handleMessage(event) {
    try {
      const message = this.parseMessage(event.data);
      if (!message || !validateWebSocketMessage(message)) return;
      // Dispatch the message regardless of type; stores will subscribe to events they need
      this.notifySubscribers(message.type, message);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  // Parse JSON data from either ArrayBuffer or text payloads
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

  // When the connection is closed, clear the socket and schedule a reconnect if needed
  handleClose(event) {
    console.log(`WebSocket closed: ${event.reason || 'No reason provided'}`);
    this.socket = null;
    if (!this.isClosedManually && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  // Log and handle errors that occur on the socket
  handleError(error) {
    console.error('WebSocket error:', error);
  }

  // Use an exponential backoff delay (capped at 30s) to reconnect the socket
  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  // Send a message immediately if open, or queue it for later dispatch
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(message);
      this.socket.send(payload);
    } else {
      this.pendingMessages.push(message);
    }
  }

  // Flush any messages pending while the connection was closed
  flushPendingMessages() {
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift();
      this.send(msg);
    }
  }

  // Subscribe to specific message events; returns an unsubscribe function
  subscribe(eventType, callback) {
    const handlers = this.subscribers.get(eventType) || [];
    this.subscribers.set(eventType, [...handlers, callback]);
    return () => this.unsubscribe(eventType, callback);
  }

  // Remove a subscription for a given event type
  unsubscribe(eventType, callback) {
    const handlers = this.subscribers.get(eventType)?.filter(h => h !== callback);
    this.subscribers.set(eventType, handlers || []);
  }

  // Dispatch the message data to all subscribers registered under this event type
  notifySubscribers(eventType, data) {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  // Manually close the connection; mark so that reconnection is not attempted
  close() {
    this.isClosedManually = false;
    //if (this.socket) {
    //  this.socket.close();
    //}
  }
}

export const wsClient = new WebSocketClient();
