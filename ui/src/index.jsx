// ui/src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';

// Configure WASM paths
setWasmPaths({
  'tfjs-backend-wasm.wasm': '/wasm/tfjs-backend-wasm.wasm',
  'tfjs-backend-wasm-simd.wasm': '/wasm/tfjs-backend-wasm-simd.wasm',
  'tfjs-backend-wasm-threaded-simd.wasm': '/wasm/tfjs-backend-wasm-threaded-simd.wasm'
});

// Initialize backend
tf.setBackend('wasm').then(() => {
  console.log('WASM backend initialized');
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
