/* ui/src/App.jsx */
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { wsClient } from './services/wsClient';
import TensorViewer from './components/TensorViewer/TensorViewer';
import BreakpointManager from './components/BreakpointManager/BreakpointManager';
import MetricsDashboard from './components/MetricsDashboard/MetricsDashboard';

const App = () => {
  useEffect(() => {
    // Initialize the centralized WebSocket connection on app startup.
    wsClient.initialize();
    return () => {
      // Clean up the connection when the app unmounts.
      wsClient.close();
    };
  }, []);

  return (
    <Router>
      <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
        {/* Navigation */}
        <nav className="bg-gray-800 p-4 border-b border-gray-700">
          <div className="flex space-x-6">
            <Link to="/" className="hover:text-blue-400 transition-colors">
              Tensor Debugger
            </Link>
            <Link to="/breakpoints" className="hover:text-blue-400 transition-colors">
              Breakpoints
            </Link>
            <Link to="/metrics" className="hover:text-blue-400 transition-colors">
              Metrics
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-6">
          <Routes>
            <Route
              path="/"
              element={
                <div className="grid grid-cols-3 gap-6 h-full">
                  <div className="col-span-2">
                    <TensorViewer />
                  </div>
                  <div className="col-span-1">
                    <BreakpointManager />
                  </div>
                </div>
              }
            />
            <Route path="/tensor/:tensorId" element={<TensorViewer />} />
            <Route path="/breakpoints" element={<BreakpointManager />} />
            <Route path="/metrics" element={<MetricsDashboard />} />
          </Routes>
        </main>

        {/* Status Bar */}
        <footer className="bg-gray-800 p-2 text-sm text-gray-400 border-t border-gray-700">
          <div className="flex justify-between items-center px-4">
            <span>ModelViz Debugging Toolkit</span>
            <div className="flex items-center space-x-4">
              <span>
                WebSocket: {wsClient.socket && wsClient.socket.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}
              </span>
              <span>v1.0.0</span>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
