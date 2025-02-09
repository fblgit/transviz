import React, { useState, useEffect } from 'react';
//import { useStore } from '../../stores/tensorStore';
import { useGlobalStore } from '../../stores/globalStore';
import WebGLRenderer from './WebGLRenderer';
import TensorStatsPanel from './TensorStatsPanel';
import DimensionControls from './DimensionControls';

const TensorViewer = () => {
  const [selectedTensor, setSelectedTensor] = useState(null);
  // const { tensors } = useStore();
  const tensors = useGlobalStore(state => state.tensors);

  useEffect(() => {
    // Subscribe to tensor updates
    const unsubscribe = useGlobalStore.subscribe(
      state => state.tensors,
      (tensors) => {
        // Update the view when tensors change
        if (selectedTensor && tensors.has(selectedTensor)) {
          setSelectedTensor(selectedTensor);
        }
      }
    );

    return () => unsubscribe();
  }, [selectedTensor]);

  return (
    <div className="flex h-full">
      <div className="w-3/4 p-4">
        <h2 className="text-2xl font-bold mb-4">Tensor Viewer</h2>
        <select
          value={selectedTensor || ''}
          onChange={(e) => setSelectedTensor(e.target.value)}
          className="mb-4 p-2 bg-gray-700 text-white rounded"
        >
          <option value="">Select a tensor</option>
          {Array.from(tensors.keys()).map((tensorId) => (
            <option key={tensorId} value={tensorId}>{tensorId}</option>
          ))}
        </select>
        {selectedTensor && (
          <>
            <WebGLRenderer tensorId={selectedTensor} />
            <DimensionControls tensorId={selectedTensor} />
          </>
        )}
      </div>
      <div className="w-1/4 p-4">
        <TensorStatsPanel tensorId={selectedTensor} />
      </div>
    </div>
  );
};

export default TensorViewer;
