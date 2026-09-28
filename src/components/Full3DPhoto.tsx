import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface Full3DPhotoProps {
  photoUrl: string;
  depthMapUrl: string;
  width?: number;
  height?: number;
  className?: string;
}

const DisplacedPlane: React.FC<{
  photoUrl: string;
  depthMapUrl: string;
  width: number;
  height: number;
  subdivisions?: number;
}> = ({ photoUrl, depthMapUrl, width, height, subdivisions = 256 }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { viewport, pointer, camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const [targetRotation, setTargetRotation] = useState({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });

  const { colorTexture, depthTexture } = useTexture({
    colorTexture: photoUrl,
    depthTexture: depthMapUrl,
  });

  useEffect(() => {
    if (colorTexture) {
      colorTexture.wrapS = THREE.ClampToEdgeWrapping;
      colorTexture.wrapT = THREE.ClampToEdgeWrapping;
      colorTexture.needsUpdate = true;
    }
    if (depthTexture) {
      depthTexture.wrapS = THREE.ClampToEdgeWrapping;
      depthTexture.wrapT = THREE.ClampToEdgeWrapping;
      depthTexture.needsUpdate = true;
    }
  }, [colorTexture, depthTexture]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!hovered) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setTargetRotation({
        x: y * 0.15,
        y: x * 0.25,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [hovered]);

  useFrame(() => {
    if (meshRef.current) {
      currentRotation.current.x += (targetRotation.x - currentRotation.current.x) * 0.08;
      currentRotation.current.y += (targetRotation.y - currentRotation.current.y) * 0.08;
      meshRef.current.rotation.x = currentRotation.current.x;
      meshRef.current.rotation.y = currentRotation.current.y;
    }
  });

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, subdivisions, subdivisions);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [width, height, subdivisions]);

  const material = useMemo(() => {
    if (!depthTexture || !colorTexture) return null;
    return new THREE.MeshStandardMaterial({
      map: colorTexture,
      displacementMap: depthTexture,
      displacementScale: 2.5,
      metalness: 0.1,
      roughness: 0.8,
      normalMap: depthTexture,
      normalScale: new THREE.Vector2(0.3, 0.3),
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.01,
    });
  }, [depthTexture, colorTexture]);

  if (!material) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    />
  );
};

export const Full3DPhoto: React.FC<Full3DPhotoProps> = ({
  photoUrl,
  depthMapUrl,
  width = 4,
  height = 3,
  className = '',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError('Failed to load photo. Please check the URL.');
    img.src = photoUrl;
  }, [photoUrl]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 rounded-lg">
          <div className="w-8 h-8 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 rounded-lg text-red-400">
          {error}
        </div>
      )}
      {loaded && !error && (
        <Canvas
          camera={{ position: [0, 2, 5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ touchAction: 'pan-y' }}
          onCreated={(state) => {
            state.gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
          <DisplacedPlane
            photoUrl={photoUrl}
            depthMapUrl={depthMapUrl}
            width={width}
            height={height}
            subdivisions={256}
          />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            autoRotate={false}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={(2 * Math.PI) / 3}
          />
          <Environment preset="warehouse" />
        </Canvas>
      )}
    </div>
  );
};

export default Full3DPhoto;
