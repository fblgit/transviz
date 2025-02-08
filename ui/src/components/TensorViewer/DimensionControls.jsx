// ui/src/components/TensorViewer/DimensionControls.jsx
import React, { useState, useEffect } from 'react';
import { useStore } from '../../stores/tensorStore';
import { validateTensor } from '../../utils/validationHelpers';

const DimensionControls = ({ tensorId }) => {
  const { tensors, updateTensorMetadata } = useStore();
  const tensor = tensors.get(tensorId);
  const [activeDimensions, setActiveDimensions] = useState([]);
  const [sliceValues, setSliceValues] = useState({});

  useEffect(() => {
    if (!tensor) return;
    
    const shape = tensor.metadata.shape;
    if (shape.length < 3) return;

    // Initialize dimension controls for 3D+ tensors
    const newDims = shape.slice(0, -2).map((_, i) => i);
    const initialSlices = Object.fromEntries(
      newDims.map(dim => [dim, tensor.metadata.sliceValues?.[dim] || 0])
    );
    
    setActiveDimensions(newDims);
    setSliceValues(initialSlices);
  }, [tensor]);

  const handleDimensionChange = (dimension, value) => {
    if (!tensor) return;

    const newSlices = { ...sliceValues, [dimension]: value };
    const flatIndex = tensor.metadata.shape
      .slice(0, -2)
      .reduce((acc, size, idx) => acc * size + (newSlices[idx] || 0), 0);

    updateTensorMetadata(tensorId, {
      currentSlice: flatIndex,
      sliceValues: newSlices
    });

    setSliceValues(newSlices);
  };

  if (!tensor || tensor.metadata.shape.length < 3) return null;

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <h4 className="text-gray-300 text-sm font-semibold">
        Dimension Slicing
      </h4>
      
      {activeDimensions.map(dim => {
        const size = tensor.metadata.shape[dim];
        return (
          <div key={dim} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">
                Dimension {dim} (0-{size - 1})
              </span>
              <span className="text-blue-400 text-sm">
                Slice: {sliceValues[dim] || 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={size - 1}
              value={sliceValues[dim] || 0}
              onChange={(e) => handleDimensionChange(dim, parseInt(e.target.value))}
              className="w-full bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(DimensionControls);
