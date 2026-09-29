/**
 * Soldering: the station (base with a temperature readout and knob), the iron resting in its
 * coil stand with the damp sponge and brass wool, a solder spool, and a pair of helping hands
 * with crocodile clips and a magnifier.
 */
import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { FONT_MONO } from './textures';

const tube = (pts: THREE.Vector3[], r: number, seg = 48) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8, false);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function readout(text: string) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0c0c'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#ff5a3c'; g.font = `bold 60px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Station base, the iron in its stand, sponge tray. Origin: centre of the base's footprint. */
export function SolderingStation() {
  const temp = useMemo(() => readout('330°'), []);
  // The stand: a wire coil the iron's shaft slides into, angled up and away.
  const coil = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = t * Math.PI * 2 * 7;
      const along = t * 0.07;
      pts.push(v(Math.cos(a) * 0.011, Math.sin(a) * 0.011, along).applyAxisAngle(v(1, 0, 0), -0.55));
    }
    return tube(pts, 0.0012, 240);
  }, []);
  const cable = useMemo(() => tube([v(0.05, 0.03, 0.04), v(0.08, 0.01, 0.07), v(0.12, 0.004, 0.02), v(0.13, 0.03, -0.05), v(0.12, 0.05, -0.1)], 0.0022), []);
  return (
    <group>
      {/* base unit */}
      <RoundedBox args={[0.1, 0.075, 0.12]} radius={0.006} position={[0, 0.0375, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3d40" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.052, 0.0605]}><planeGeometry args={[0.05, 0.019]} /><meshBasicMaterial map={temp} toneMapped={false} /></mesh>
      <mesh position={[0, 0.024, 0.066]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.012, 0.012, 24]} /><meshStandardMaterial color="#c62828" roughness={0.45} />
      </mesh>
      {/* stand, to the right of the base */}
      <group position={[0.1, 0, 0]}>
        <mesh position={[0, 0.006, 0]} castShadow receiveShadow><cylinderGeometry args={[0.035, 0.038, 0.012, 32]} /><meshStandardMaterial color="#2b2b2d" roughness={0.4} metalness={0.3} /></mesh>
        {/* sponge in its tray, and a ball of brass wool */}
        <mesh position={[-0.012, 0.014, 0.012]}><boxGeometry args={[0.03, 0.006, 0.03]} /><meshStandardMaterial color="#e2c23a" roughness={1} /></mesh>
        <mesh position={[0.015, 0.018, 0.014]}><sphereGeometry args={[0.009, 12, 8]} /><meshStandardMaterial color="#c9a13b" roughness={0.8} metalness={0.6} /></mesh>
        <group position={[0, 0.03, -0.01]}>
          <mesh geometry={coil}><meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.3} /></mesh>
          {/* the iron: grip, then the steel shaft into the coil, tip hidden inside */}
          <group rotation={[-0.55, 0, 0]}>
            <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.003, 0.003, 0.08, 12]} /><meshStandardMaterial color="#9ea2a6" metalness={0.9} roughness={0.25} /></mesh>
            <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.009, 0.007, 0.07, 18]} /><meshStandardMaterial color="#1f5d8c" roughness={0.6} /></mesh>
            <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.005, 0.009, 0.02, 14]} /><meshStandardMaterial color="#1b1b1b" roughness={0.6} /></mesh>
          </group>
        </group>
      </group>
      <mesh geometry={cable} castShadow><meshStandardMaterial color="#1b1b1b" roughness={0.6} /></mesh>
    </group>
  );
}

/** A reel of solder wire with a loose tail. */
export function SolderSpool() {
  const tail = useMemo(() => tube([v(0.022, 0.03, 0), v(0.05, 0.01, 0.02), v(0.07, 0.002, 0.05), v(0.06, 0.002, 0.09)], 0.0008), []);
  return (
    <group>
      <group position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        {[-1, 1].map((k) => <mesh key={k} position={[0, k * 0.017, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.003, 32]} /><meshStandardMaterial color="#1e4f8c" roughness={0.5} /></mesh>)}
        <mesh castShadow><cylinderGeometry args={[0.022, 0.022, 0.031, 32]} /><meshStandardMaterial color="#b9bdc2" metalness={0.85} roughness={0.35} /></mesh>
        <mesh><cylinderGeometry args={[0.007, 0.007, 0.036, 16]} /><meshStandardMaterial color="#111" /></mesh>
      </group>
      <mesh geometry={tail}><meshStandardMaterial color="#c3c7cc" metalness={0.9} roughness={0.3} /></mesh>
    </group>
  );
}

/** Helping hands: a heavy base, two bendy arms with crocodile clips, and a magnifier. */
export function HelpingHands() {
  const arms = useMemo(() => [
    tube([v(0, 0.02, 0), v(-0.02, 0.08, 0.01), v(-0.05, 0.12, 0.04), v(-0.07, 0.1, 0.07)], 0.003),
    tube([v(0, 0.02, 0), v(0.03, 0.09, 0), v(0.06, 0.11, 0.04), v(0.07, 0.09, 0.07)], 0.003),
  ], []);
  const clip = (at: THREE.Vector3, yaw: number) => (
    <group position={at} rotation={[0.4, yaw, 0]}>
      <mesh position={[0, 0, 0.012]}><boxGeometry args={[0.006, 0.004, 0.024]} /><meshStandardMaterial color="#c9ccd2" metalness={0.85} roughness={0.3} /></mesh>
      <mesh position={[0, -0.004, 0.012]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.006, 0.003, 0.024]} /><meshStandardMaterial color="#c9ccd2" metalness={0.85} roughness={0.3} /></mesh>
    </group>
  );
  return (
    <group>
      <RoundedBox args={[0.08, 0.018, 0.06]} radius={0.004} position={[0, 0.009, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b2b2d" roughness={0.4} metalness={0.4} />
      </RoundedBox>
      {arms.map((g, i) => <mesh key={i} geometry={g} castShadow><meshStandardMaterial color="#1b1b1b" roughness={0.35} metalness={0.3} /></mesh>)}
      {clip(v(-0.07, 0.1, 0.07), -0.3)}
      {clip(v(0.07, 0.09, 0.07), 0.3)}
      {/* magnifier on a short post */}
      <mesh position={[0, 0.07, -0.01]}><cylinderGeometry args={[0.003, 0.003, 0.1, 10]} /><meshStandardMaterial color="#1b1b1b" metalness={0.3} /></mesh>
      <group position={[0, 0.13, 0.0]} rotation={[-0.9, 0, 0]}>
        <mesh castShadow><torusGeometry args={[0.035, 0.004, 10, 40]} /><meshStandardMaterial color="#1b1b1b" roughness={0.4} /></mesh>
        <mesh><circleGeometry args={[0.034, 40]} /><meshPhysicalMaterial color="#dfeaf2" transparent opacity={0.25} roughness={0.05} transmission={0.6} side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  );
}
