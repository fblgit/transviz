// ui/src/components/BreakpointManager/ConditionEditor.jsx
import React, { useState, useEffect } from 'react';
import { useStore } from '../../stores/breakpointStore';
import ReactAce from 'react-ace-editor';
import { parse } from '@babel/parser';
import { tensorValidator } from '../../utils/validationHelpers';

/**
 * Breakpoint Condition Editor Component
 * 
 * Requirements:
 * - Real-time syntax validation for tensor conditions
 * - Code completion for common tensor operations
 * - Sandboxed condition evaluation preview
 * - Multi-step validation (syntax + runtime safety)
 * - Integration with breakpoint store for persistence
 */
const ConditionEditor = ({ selectedBreakpoint, onClose }) => {
  const { updateBreakpoint } = useStore();
  const [condition, setCondition] = useState(selectedBreakpoint?.condition || '');
  const [validationError, setValidationError] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState(null);

  // Syntax validation using Babel parser
  const validateCondition = (code) => {
    try {
      parse(`(tensor) => { return ${code}; }`, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      return { valid: true, error: null };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  };

  // Handle condition code changes
  const handleCodeChange = (newValue) => {
    setCondition(newValue);
    const { valid, error } = validateCondition(newValue);
    setValidationError(valid ? '' : error);
  };

  // Test condition against sample input
  const handleTestCondition = async () => {
    try {
      const tensorData = JSON.parse(testInput);
      if (!tensorValidator(tensorData)) {
        throw new Error('Invalid tensor structure');
      }
      
      const testFunction = new Function('tensor', `return ${condition}`);
      const result = testFunction(tensorData);
      
      setTestResult({
        status: result ? 'condition-met' : 'condition-not-met',
        message: result ? '✅ Condition met' : '❌ Condition not met',
        details: `Evaluated to: ${result}`
      });
    } catch (err) {
      setTestResult({
        status: 'error',
        message: '⚠️ Test Error',
        details: err.message
      });
    }
  };

  // Save condition to store
  const handleSave = () => {
    if (!validationError && selectedBreakpoint) {
      updateBreakpoint(selectedBreakpoint.layerId, condition);
      onClose();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800 p-6 space-y-6" 
         role="dialog"
         aria-labelledby="condition-editor-heading">
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-gray-700 pb-4">
        <h2 id="condition-editor-heading" className="text-xl font-semibold text-gray-200">
          {selectedBreakpoint ? `Edit Condition: ${selectedBreakpoint.layerId}` : 'New Breakpoint'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close condition editor"
        >
          ✕
        </button>
      </div>

      {/* Main Editor Section */}
      <div className="flex-1 grid grid-cols-2 gap-6">
        {/* Editor Column */}
        <div className="flex flex-col space-y-4">
          <label className="text-sm font-medium text-gray-300">
            Breakpoint Condition
          </label>
          
          <ReactAce
            mode="javascript"
            theme="tomorrow_night"
            value={condition}
            onChange={handleCodeChange}
            height="400px"
            width="100%"
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              showLineNumbers: true,
              tabSize: 2,
            }}
            className="rounded-lg overflow-hidden"
            aria-label="Condition code editor"
          />
          
          {validationError && (
            <div className="p-3 bg-red-900 text-red-100 rounded-lg text-sm">
              <strong>Syntax Error:</strong> {validationError}
            </div>
          )}
        </div>

        {/* Test Panel */}
        <div className="flex flex-col space-y-4">
          <label className="text-sm font-medium text-gray-300">
            Test Condition
          </label>
          
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Paste sample tensor JSON..."
            className="h-48 p-3 bg-gray-900 text-gray-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Test tensor input"
          />
          
          <button
            onClick={handleTestCondition}
            disabled={!!validationError}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Test
          </button>
          
          {testResult && (
            <div className={`p-4 rounded-lg ${
              testResult.status === 'error' ? 'bg-red-900 text-red-100' :
              testResult.status === 'condition-met' ? 'bg-green-900 text-green-100' :
              'bg-yellow-900 text-yellow-100'
            }`}>
              <div className="font-medium">{testResult.message}</div>
              <div className="text-sm mt-2">{testResult.details}</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex justify-end space-x-4 border-t border-gray-700 pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!!validationError}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save Condition
        </button>
      </div>
    </div>
  );
};

export default ConditionEditor;
