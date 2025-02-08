import React, { useEffect } from 'react';
import * as THREE from 'three';

export default function ModelOverview() {
  useEffect(() => {
    // Basic Three.js scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    
    // Temporary geometry
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);

    // Scene initialization
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('model-viewport').appendChild(renderer.domElement);
    scene.add(cube);
    camera.position.z = 5;

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      document.getElementById('model-viewport').removeChild(renderer.domElement);
    };
  }, []);

  return <div id="model-viewport" style={{ width: '100%', height: '600px' }} />;
}
