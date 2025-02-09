// ui/src/components/TensorViewer/WebGLRenderer.jsx
import React, { useRef, useEffect, useMemo } from 'react';
//import { useStore } from '../../stores/tensorStore';
import { useGlobalStore } from '../../stores/globalStore';
import { tensorValidator } from '../../utils/validationHelpers';

/**
 * WebGL Tensor Renderer Component
 * 
 * Requirements:
 * - Render 3D/4D tensors as interactive heatmaps
 * - Support dimension slicing and axis manipulation
 * - GPU-accelerated computations
 * - Real-time updates via WebGL buffers
 * - Adaptive resolution scaling
 */

const WebGLRenderer = ({ tensorId }) => {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  //const { tensors } = useStore();
  const { tensors } = useGlobalStore(state => state.tensors);
  const tensor = tensors.get(tensorId);

  // WebGL initialization
  const initWebGL = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      glRef.current = canvas.getContext('webgl2', {
        antialias: false,
        preserveDrawingBuffer: true
      }) || canvas.getContext('experimental-webgl2');

      if (!glRef.current) {
        throw new Error('WebGL 2 not supported');
      }
    } catch (error) {
      console.error('WebGL initialization failed:', error);
    }
  };

  // Shader compilation
  const compileShader = (type, source) => {
    const gl = glRef.current;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  // Heatmap shader program
  const heatmapShader = useMemo(() => {
    if (!glRef.current) return null;

    const vertexShaderSource = `
      attribute vec2 position;
      varying vec2 vUV;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        vUV = position * 0.5 + 0.5;
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform sampler2D tensorData;
      uniform vec2 sliceRange;
      varying vec2 vUV;
      
      void main() {
        float value = texture2D(tensorData, vUV).r;
        float scaled = (value - sliceRange.x) / (sliceRange.y - sliceRange.x);
        
        vec3 color = vec3(
          smoothstep(0.0, 0.5, scaled),
          smoothstep(0.3, 0.7, scaled),
          smoothstep(0.6, 1.0, scaled)
        );
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const gl = glRef.current;
    const program = gl.createProgram();
    const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader linking failed:', gl.getProgramInfoLog(program));
      return null;
    }

    return {
      program,
      attributes: {
        position: gl.getAttribLocation(program, 'position')
      },
      uniforms: {
        tensorData: gl.getUniformLocation(program, 'tensorData'),
        sliceRange: gl.getUniformLocation(program, 'sliceRange')
      }
    };
  }, []);

  // Tensor texture update
  const updateTexture = (tensorData) => {
    const gl = glRef.current;
    if (!gl || !heatmapShader) return;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      tensorData.width,
      tensorData.height,
      0,
      gl.RED,
      gl.FLOAT,
      tensorData
    );
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  };

  // Render loop
  const render = useMemo(() => {
    if (!glRef.current || !heatmapShader) return;

    const gl = glRef.current;
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    return (texture, minVal, maxVal) => {
      gl.useProgram(heatmapShader.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      
      gl.enableVertexAttribArray(heatmapShader.attributes.position);
      gl.vertexAttribPointer(
        heatmapShader.attributes.position,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(heatmapShader.uniforms.tensorData, 0);
      gl.uniform2f(heatmapShader.uniforms.sliceRange, minVal, maxVal);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }, [heatmapShader]);

  // Handle tensor updates
  useEffect(() => {
    if (!tensor || !glRef.current || !render) return;

    const flatData = new Float32Array(tensor.data);
    const [width, height] = tensor.metadata.shape.slice(-2);
    const textureData = new Float32Array(width * height);
    
    // Extract current slice from ND tensor
    const sliceIndex = Math.floor(tensor.metadata.currentSlice || 0);
    const sliceSize = width * height;
    textureData.set(flatData.subarray(sliceIndex * sliceSize, (sliceIndex + 1) * sliceSize));

    const texture = updateTexture({
      width,
      height,
      data: textureData
    });

    const minVal = Math.min(...textureData);
    const maxVal = Math.max(...textureData);
    
    render(texture, minVal, maxVal);
    glRef.current.deleteTexture(texture);

  }, [tensor, render]);

  // Initialization and cleanup
  useEffect(() => {
    initWebGL();
    return () => {
      if (glRef.current) {
        glRef.current.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, []);

  if (!tensor || !tensorValidator(tensor)) {
    return <div className="text-red-500">Invalid tensor data</div>;
  }

  return (
    <canvas 
      ref={canvasRef}
      className="w-full h-full"
      width={1024}
      height={1024}
    />
  );
};

export default React.memo(WebGLRenderer);
