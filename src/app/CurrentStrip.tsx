/**
 * Placeholder for the Electron Run: a trace with electrons whose speed follows the
 * simulated current. Proves the solver -> Three.js pipeline; the real view comes later.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const COUNT = 160;
const LENGTH = 12;

function Electrons({ amps, fault }: { amps: number; fault: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const offsets = useMemo(() => Array.from({ length: COUNT }, (_, i) => (i / COUNT) * LENGTH), []);
  const jitter = useMemo(() => Array.from({ length: COUNT }, () => [(Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25]), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useRef(0);

  useFrame((_, delta) => {
    // Map current to a visible speed: log scale so 1 mA and 1 A both read.
    const speed = amps <= 1e-9 ? 0 : Math.min(8, 1 + Math.log10(amps * 1e3 + 1) * 2.5);
    phase.current = (phase.current + delta * speed) % LENGTH;
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < COUNT; i++) {
      const x = ((offsets[i]! + phase.current) % LENGTH) - LENGTH / 2;
      const [jy, jz] = jitter[i]!;
      dummy.position.set(x, jy!, jz!);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color={fault ? '#ff2e88' : '#39ff88'} toneMapped={false} />
    </instancedMesh>
  );
}

export function CurrentStrip({ amps, fault }: { amps: number; fault: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0.6, 5], fov: 60 }} dpr={[1, 2]}>
      <color attach="background" args={['#030604']} />
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, LENGTH, 24, 1, true]} />
        <meshBasicMaterial color="#0e3b26" wireframe transparent opacity={0.35} />
      </mesh>
      <Electrons amps={amps} fault={fault} />
    </Canvas>
  );
}
