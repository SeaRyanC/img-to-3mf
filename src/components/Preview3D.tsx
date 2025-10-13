import { useEffect, useRef } from 'preact/hooks';
import * as THREE from 'three';
import type { ColorLayer } from '../types';

interface Preview3DProps {
  colorLayers: ColorLayer[];
}

export function Preview3D({ colorLayers }: Preview3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    meshes: THREE.Mesh[];
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-10, -10, -10);
    scene.add(directionalLight2);

    sceneRef.current = { scene, camera, renderer, meshes: [] };

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      // Rotate scene slowly
      if (sceneRef.current) {
        sceneRef.current.meshes.forEach(mesh => {
          mesh.rotation.y += 0.005;
        });
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current || !sceneRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      sceneRef.current.camera.aspect = width / height;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const { scene, meshes } = sceneRef.current;

    // Remove old meshes
    meshes.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    sceneRef.current.meshes = [];

    // Add new meshes
    const newMeshes: THREE.Mesh[] = [];
    let minY = Infinity;
    let maxY = -Infinity;
    let centerX = 0;
    let centerZ = 0;
    let totalVertices = 0;

    // First pass: calculate bounds
    colorLayers.forEach(layer => {
      if (!layer.mesh) return;
      
      const { vertices } = layer.mesh;
      for (let i = 0; i < vertices.length; i += 3) {
        centerX += vertices[i];
        centerZ += vertices[i + 2];
        minY = Math.min(minY, vertices[i + 1]);
        maxY = Math.max(maxY, vertices[i + 1]);
        totalVertices++;
      }
    });

    centerX /= totalVertices;
    centerZ /= totalVertices;
    const heightRange = maxY - minY;

    // Second pass: create meshes
    colorLayers.forEach((layer) => {
      if (!layer.mesh) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(layer.mesh.vertices, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(layer.mesh.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(layer.mesh.indices, 1));

      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(
          layer.color[0] / 255,
          layer.color[1] / 255,
          layer.color[2] / 255
        ),
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Center the mesh
      mesh.position.set(-centerX, -minY - heightRange / 2, -centerZ);
      
      scene.add(mesh);
      newMeshes.push(mesh);
    });

    sceneRef.current.meshes = newMeshes;

    // Adjust camera distance based on model size
    if (heightRange > 0 && sceneRef.current) {
      const distance = Math.max(heightRange * 1.5, 50);
      sceneRef.current.camera.position.z = distance;
    }
  }, [colorLayers]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
