import React from 'react';
import { useStore } from '../../stores/breakpointStore';
import { FixedSizeList } from 'react-window';

/**
 * Breakpoint List Component
 * 
 * Requirements:
 * - Display active breakpoints with current status
 * - Show layer association and hit counts
 * - Enable/disable breakpoints via toggle
 * - Visual indication of recently triggered breakpoints
 * - Virtualized scrolling for large numbers of breakpoints
 */
const BreakpointList = ({ onSelect }) => {
  const { breakpoints, toggleBreakpoint, removeBreakpoint } = useStore();
  
  // Convert breakpoints Map to array for rendering
  const breakpointArray = Array.from(breakpoints.entries());
  
  // Virtualized list item renderer
  const BreakpointRow = ({ index, style }) => {
    const [layerId, bp] = breakpointArray[index];
    const { condition, hits, enabled } = bp;
    
    return (
      <div 
        style={style}
        className={`flex items-center p-4 border-b border-gray-700 ${
          enabled ? 'bg-gray-800' : 'bg-gray-900 opacity-50'
        } hover:bg-gray-700 transition-colors`}
        role="listitem"
        aria-labelledby={`breakpoint-${layerId}`}
      >
        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
          {/* Toggle Control */}
          <div className="col-span-1">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => toggleBreakpoint(layerId)}
              aria-label={`Toggle breakpoint for ${layerId}`}
              className="form-checkbox h-5 w-5 text-blue-500"
            />
          </div>
          
          {/* Layer Identifier */}
          <div className="col-span-3 font-mono text-blue-400">
            {layerId}
          </div>
          
          {/* Condition Display */}
          <div className="col-span-5 font-medium text-gray-200">
            <code 
              className="text-sm bg-gray-900 p-1 rounded"
              onClick={() => onSelect(bp)}
              aria-label="Edit condition"
              role="button"
            >
              {condition}
            </code>
          </div>
          
          {/* Hit Counter */}
          <div className="col-span-2 text-right">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-800 text-red-100">
              {hits} hit{hits !== 1 ? 's' : ''}
            </span>
          </div>
          
          {/* Remove Button */}
          <div className="col-span-1 text-right">
            <button
              onClick={() => removeBreakpoint(layerId)}
              aria-label="Remove breakpoint"
              className="text-gray-400 hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" role="region" aria-label="Breakpoint List">
      <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200">
          Active Breakpoints
          <span className="ml-2 text-sm text-gray-400">
            ({breakpointArray.length} registered)
          </span>
        </h3>
      </div>
      
      {breakpointArray.length > 0 ? (
        <FixedSizeList
          height={600}
          width="100%"
          itemSize={64}
          itemCount={breakpointArray.length}
          overscanCount={10}
          role="list"
          aria-label="List of active breakpoints"
        >
          {BreakpointRow}
        </FixedSizeList>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No breakpoints defined
        </div>
      )}
    </div>
  );
};

export default BreakpointList;
