"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import type { Mesh } from "three";

function Crystal({
  position,
  color,
  scale = 1,
  speed = 1,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  speed?: number;
}) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * 0.15 * speed;
    ref.current.rotation.y = state.clock.elapsedTime * 0.22 * speed;
  });

  return (
    <Float speed={1.8 * speed} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={ref} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.15}
          metalness={0.85}
          distort={0.35}
          speed={2}
          transparent
          opacity={0.92}
        />
      </mesh>
    </Float>
  );
}

function Ring() {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = Math.PI / 2;
    ref.current.rotation.z = state.clock.elapsedTime * 0.08;
  });

  return (
    <mesh ref={ref} position={[0, 0, -2]}>
      <torusGeometry args={[4.5, 0.02, 16, 128]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} />
    </mesh>
  );
}

function SceneContent() {
  return (
    <>
      <color attach="background" args={["#030014"]} />
      <fog attach="fog" args={["#030014", 8, 28]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color="#22d3ee" />
      <pointLight position={[-10, -5, 5]} intensity={0.8} color="#a78bfa" />
      <pointLight position={[0, 8, -5]} intensity={0.5} color="#e879f9" />

      <Stars
        radius={80}
        depth={40}
        count={3000}
        factor={3}
        saturation={0}
        fade
        speed={0.6}
      />
      <Sparkles
        count={80}
        scale={14}
        size={2}
        speed={0.3}
        opacity={0.4}
        color="#22d3ee"
      />

      <Crystal position={[-3.2, 1.2, -1]} color="#22d3ee" scale={0.85} speed={1.1} />
      <Crystal position={[3.5, -0.8, 0]} color="#a78bfa" scale={1.1} speed={0.9} />
      <Crystal position={[0.5, 2.2, -2]} color="#e879f9" scale={0.55} speed={1.3} />
      <Crystal position={[-2, -2, 1]} color="#3b82f6" scale={0.7} speed={1} />
      <Ring />
    </>
  );
}

export default function Scene3D() {
  const dpr = useMemo(
    () => (typeof window !== "undefined" && window.innerWidth < 768 ? 1 : 1.5),
    []
  );

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, 9], fov: 55 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
