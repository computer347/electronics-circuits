/**
 * The parts box: a clear plastic organiser with compartments. It only holds the level's own
 * parts (a find-the-fault level gives you nothing new, so it's empty).
 */
import { useMemo } from 'react';
import * as THREE from 'three';

export type BoxItem = 'resistor' | 'led' | 'capacitor' | 'wire';

const W = 0.17, D = 0.11, H = 0.03;

function Item({ kind, at }: { kind: BoxItem; at: [number, number] }) {
  const [x, z] = at;
  if (kind === 'resistor') return (
    <mesh position={[x, 0.008, z]} rotation={[0, 0.3, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.004, 0.004, 0.022, 12]} /><meshStandardMaterial color="#e7b863" roughness={0.5} />
    </mesh>
  );
  if (kind === 'led') return (
    <mesh position={[x, 0.008, z]} castShadow><sphereGeometry args={[0.005, 12, 8]} /><meshStandardMaterial color="#ff2a3a" roughness={0.25} transparent opacity={0.9} /></mesh>
  );
  if (kind === 'capacitor') return (
    <mesh position={[x, 0.01, z]} castShadow><cylinderGeometry args={[0.005, 0.005, 0.014, 14]} /><meshStandardMaterial color="#2f6fc0" roughness={0.4} /></mesh>
  );
  return (
    <mesh position={[x, 0.006, z]} rotation={[0, 0.8, Math.PI / 2]}><cylinderGeometry args={[0.0012, 0.0012, 0.04, 6]} /><meshStandardMaterial color="#c87533" metalness={0.6} roughness={0.35} /></mesh>
  );
}

export function PartsBox({ items }: { items: BoxItem[] }) {
  const plastic = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#dfe8ee', roughness: 0.15, transmission: 0.6, transparent: true, opacity: 0.45, thickness: 0.002 }), []);
  const cells: [number, number][] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) cells.push([-W / 3 + i * (W / 3), -D / 4 + j * (D / 2)]);
  return (
    <group>
      <mesh position={[0, 0.001, 0]} receiveShadow><boxGeometry args={[W, 0.002, D]} /><meshStandardMaterial color="#cfd8de" roughness={0.3} /></mesh>
      {/* outer walls and dividers */}
      {[[0, -D / 2, W, 0.002], [0, D / 2, W, 0.002], [-W / 2, 0, 0.002, D], [W / 2, 0, 0.002, D], [-W / 6, 0, 0.0015, D], [W / 6, 0, 0.0015, D], [0, 0, W, 0.0015]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x!, H / 2, z!]} material={plastic} castShadow>
          <boxGeometry args={[w!, H, d!]} />
        </mesh>
      ))}
      {items.map((k, i) => <Item key={i} kind={k} at={cells[i % cells.length]!} />)}
    </group>
  );
}
