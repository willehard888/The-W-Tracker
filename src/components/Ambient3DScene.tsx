import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 120;

const FloatingParticles = () => {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, colors, sizes, velocities, phases } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);

    const goldColor = new THREE.Color("hsl(42, 78%, 54%)");
    const amberColor = new THREE.Color("hsl(32, 95%, 56%)");
    const purpleColor = new THREE.Color("hsl(270, 60%, 58%)");
    const tealColor = new THREE.Color("hsl(172, 66%, 50%)");

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 12;
      positions[i3 + 1] = (Math.random() - 0.5) * 16;
      positions[i3 + 2] = (Math.random() - 0.5) * 8 - 2;

      const type = Math.random();
      const color = type < 0.5 ? goldColor : type < 0.7 ? amberColor : type < 0.88 ? purpleColor : tealColor;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = 1.5 + Math.random() * 4;

      velocities[i3] = (Math.random() - 0.5) * 0.003;
      velocities[i3 + 1] = 0.002 + Math.random() * 0.006;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.002;

      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, colors, sizes, velocities, phases };
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const sizeAttr = geo.attributes.size as THREE.BufferAttribute;
    const t = clock.getElapsedTime();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      let x = posAttr.array[i3] as number;
      let y = posAttr.array[i3 + 1] as number;
      let z = posAttr.array[i3 + 2] as number;

      x += velocities[i3] + Math.sin(t * 0.3 + phases[i]) * 0.002;
      y += velocities[i3 + 1];
      z += velocities[i3 + 2];

      // Wrap around
      if (y > 9) y = -9;
      if (x > 7) x = -7;
      if (x < -7) x = 7;

      (posAttr.array as Float32Array)[i3] = x;
      (posAttr.array as Float32Array)[i3 + 1] = y;
      (posAttr.array as Float32Array)[i3 + 2] = z;

      // Pulsing size
      (sizeAttr.array as Float32Array)[i] = sizes[i] * (0.7 + 0.3 * Math.sin(t * 0.8 + phases[i]));
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        size={3}
      />
    </points>
  );
};

const GlowOrbs = () => {
  const groupRef = useRef<THREE.Group>(null);

  const orbs = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 10,
        -3 - Math.random() * 3,
      ] as [number, number, number],
      color: i < 2 ? "#d4a012" : i < 3 ? "#9b59b6" : i < 4 ? "#2dd4bf" : "#e67e22",
      scale: 0.8 + Math.random() * 1.2,
      speed: 0.15 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const orb = orbs[i];
      child.position.y = orb.position[1] + Math.sin(t * orb.speed + orb.phase) * 1.5;
      child.position.x = orb.position[0] + Math.cos(t * orb.speed * 0.7 + orb.phase) * 0.8;
    });
  });

  return (
    <group ref={groupRef}>
      {orbs.map((orb, i) => (
        <mesh key={i} position={orb.position}>
          <sphereGeometry args={[orb.scale, 16, 16]} />
          <meshBasicMaterial
            color={orb.color}
            transparent
            opacity={0.04}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

const Ambient3DScene = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.85 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <FloatingParticles />
          <GlowOrbs />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Ambient3DScene;
