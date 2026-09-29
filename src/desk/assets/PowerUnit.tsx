/**
 * Bench power unit with the big rocker you flip to submit. Built in breadboard units (it sits
 * inside the board's group), so its leads reuse the bench's own supply lead paths.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SUPPLY_BOX, SUPPLY_HOLES, supplyLeadCurve } from '../../breadboard/paths';
import { useEased } from '../anim';

const BOX: [number, number, number] = [6.4, 2.6, 3.8];
const CENTER: [number, number, number] = [SUPPLY_BOX[0] - 0.2, BOX[1] / 2 - 0.8, SUPPLY_BOX[2] - 0.5];

export function PowerUnit({ flipped, glow }: { flipped: boolean; glow: boolean }) {
  const rocker = useRef<THREE.Group>(null);
  const k = useEased(flipped ? 1 : 0, 0.25);
  useFrame(() => { if (rocker.current) rocker.current.rotation.x = -0.28 + k.value * 0.56; });
  const leads = useMemo(() => [
    new THREE.TubeGeometry(supplyLeadCurve(SUPPLY_HOLES.plus, 0.7), 40, 0.1, 8, false),
    new THREE.TubeGeometry(supplyLeadCurve(SUPPLY_HOLES.minus, -0.7), 40, 0.1, 8, false),
  ], []);
  const top = CENTER[1] + BOX[1] / 2;
  return (
    <group>
      <mesh position={CENTER} castShadow receiveShadow>
        <boxGeometry args={BOX} />
        <meshStandardMaterial color="#d9d3c7" roughness={0.55} />
      </mesh>
      {/* front panel */}
      <mesh position={[CENTER[0], CENTER[1], CENTER[2] + BOX[2] / 2 + 0.01]}>
        <planeGeometry args={[BOX[0] - 0.6, BOX[1] - 0.6]} />
        <meshStandardMaterial color="#2c2a28" roughness={0.5} />
      </mesh>
      {/* rocker */}
      <mesh position={[CENTER[0] + 1, top + 0.05, CENTER[2]]}><boxGeometry args={[2.6, 0.12, 1.9]} /><meshStandardMaterial color="#222" roughness={0.5} /></mesh>
      <group ref={rocker} position={[CENTER[0] + 1, top + 0.15, CENTER[2]]}>
        <mesh castShadow>
          <boxGeometry args={[2.2, 0.5, 1.6]} />
          <meshStandardMaterial color="#ff48b0" roughness={0.45} emissive="#ff48b0" emissiveIntensity={glow ? 0.35 : 0} />
        </mesh>
      </group>
      {/* power lamp */}
      <mesh position={[CENTER[0] - 1.8, top + 0.12, CENTER[2]]}>
        <sphereGeometry args={[0.32, 16, 10]} />
        <meshStandardMaterial color={flipped ? '#ffe800' : '#6b6450'} emissive={flipped ? '#ffcc00' : '#000'} emissiveIntensity={flipped ? 1.5 : 0} toneMapped={!flipped} />
      </mesh>
      <mesh geometry={leads[0]} castShadow><meshStandardMaterial color="#e8413c" roughness={0.5} /></mesh>
      <mesh geometry={leads[1]} castShadow><meshStandardMaterial color="#1b1b1b" roughness={0.5} /></mesh>
    </group>
  );
}
