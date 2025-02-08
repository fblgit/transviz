// ui/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Link, Switch } from 'react-router-dom';
import { wsClient } from './services/wsClient';
import TensorViewer from './components/TensorViewer/TensorViewer';
import BreakpointManager from './components/BreakpointManager/BreakpointManager';
import MetricsDashboard from './components/MetricsDashboard/MetricsDashboard';

const App = () => {
  useEffect(() => {
    wsClient.initialize();
    return () => wsClient.close();
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
          <Switch>
            <Route exact path="/">
              <div className="grid grid-cols-3 gap-6 h-full">
                <div className="col-span-2">
                  <TensorViewer />
                </div>
                <div className="col-span-1">
                  <BreakpointManager />
                </div>
              </div>
            </Route>
            
            <Route path="/tensor/:tensorId">
              <TensorViewer />
            </Route>

            <Route path="/breakpoints">
              <BreakpointManager />
            </Route>

            <Route path="/metrics">
              <MetricsDashboard />
            </Route>
          </Switch>
        </main>

        {/* Status Bar */}
        <footer className="bg-gray-800 p-2 text-sm text-gray-400 border-t border-gray-700">
          <div className="flex justify-between items-center px-4">
            <span>ModelViz Debugging Toolkit</span>
            <div className="flex items-center space-x-4">
              <span>WebSocket: {wsClient.socket?.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
