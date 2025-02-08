import React, { useState } from 'react';
import { useStore } from '../../stores/breakpointStore';
import BreakpointList from './BreakpointList';
import ConditionEditor from './ConditionEditor';

const BreakpointManager = () => {
  const [selectedBreakpoint, setSelectedBreakpoint] = useState(null);
  const { addBreakpoint } = useStore();

  const handleAddBreakpoint = (layerId, condition) => {
    addBreakpoint(layerId, condition);
    setSelectedBreakpoint(null);
  };

  return (
    <div className="flex h-full">
      <div className="w-1/2 p-4">
        <h2 className="text-2xl font-bold mb-4">Breakpoints</h2>
        <BreakpointList onSelect={setSelectedBreakpoint} />
      </div>
      <div className="w-1/2 p-4">
        <ConditionEditor
          selectedBreakpoint={selectedBreakpoint}
          onSave={handleAddBreakpoint}
          onClose={() => setSelectedBreakpoint(null)}
        />
      </div>
    </div>
  );
};

export default BreakpointManager;
