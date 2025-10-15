import { useEffect, useRef } from 'preact/hooks';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Mesh } from '../utils/meshGeneration';

interface PreviewProps {
  meshes: Array<{ mesh: Mesh; color: string; name: string }>;
  backplateMesh?: Mesh;
  backplateColor?: string;
}

export function Preview({ meshes, backplateMesh, backplateColor }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
  } | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      antialias: true 
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);
    
    sceneRef.current = { scene, camera, renderer, controls };
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    
    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current || !sceneRef.current) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
    };
  }, []);
  
  useEffect(() => {
    if (!sceneRef.current) return;
    
    const { scene } = sceneRef.current;
    
    // Clear existing meshes
    while (scene.children.length > 2) {
      scene.remove(scene.children[2]);
    }
    
    // Add backplate
    if (backplateMesh && backplateColor) {
      const geometry = createThreeGeometry(backplateMesh);
      const material = new THREE.MeshPhongMaterial({ 
        color: backplateColor,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    }
    
    // Add color layer meshes
    for (const { mesh, color } of meshes) {
      const geometry = createThreeGeometry(mesh);
      const material = new THREE.MeshPhongMaterial({ 
        color: color,
        side: THREE.DoubleSide
      });
      const threeMesh = new THREE.Mesh(geometry, material);
      scene.add(threeMesh);
    }
    
    // Center camera on objects
    if (meshes.length > 0 || backplateMesh) {
      const box = new THREE.Box3();
      scene.children.slice(2).forEach(obj => {
        if (obj instanceof THREE.Mesh) {
          box.expandByObject(obj);
        }
      });
      
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = sceneRef.current.camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 2;
      
      sceneRef.current.camera.position.set(
        center.x + cameraZ * 0.5,
        center.y + cameraZ * 0.5,
        center.z + cameraZ
      );
      sceneRef.current.camera.lookAt(center);
      sceneRef.current.controls.target.copy(center);
      sceneRef.current.controls.update();
    }
  }, [meshes, backplateMesh, backplateColor]);
  
  return <canvas ref={canvasRef} />;
}

function createThreeGeometry(mesh: Mesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(mesh.vertices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const indices = new Uint32Array(mesh.triangles);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  
  geometry.computeVertexNormals();
  
  return geometry;
}
