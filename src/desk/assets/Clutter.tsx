/**
 * The small things that make it a lab: a parts-drawer cabinet with labelled drawers, side
 * cutters, tweezers, a strip of taped resistors and a bag of spare LEDs.
 */
import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { FONT_MONO } from './textures';

const DRAWER_LABELS = ['100 Ω', '220 Ω', '330 Ω', '470 Ω', '1 kΩ', '2.2 kΩ', '4.7 kΩ', '10 kΩ', 'LED R', 'LED G', '100 nF', '100 µF'];

function labelTex(text: string) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 128, 48);
  g.fillStyle = '#1c0a3a'; g.font = `bold 24px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A 3 × 4 cabinet of little drawers, one pulled out a little. Origin: bottom centre, front at +z. */
export function PartsDrawers() {
  const labels = useMemo(() => DRAWER_LABELS.map(labelTex), []);
  const W = 0.2, H = 0.22, D = 0.13, cols = 3, rows = 4;
  const cw = (W - 0.016) / cols, ch = (H - 0.016) / rows;
  const plastic = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#dfe6ea', roughness: 0.2, transparent: true, opacity: 0.7, transmission: 0.3 }), []);
  return (
    <group>
      <RoundedBox args={[W, H, D]} radius={0.004} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2f6f9f" roughness={0.55} />
      </RoundedBox>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const out = i === 4 ? 0.035 : 0;
        const x = -W / 2 + 0.008 + cw * (c + 0.5), y = H - 0.008 - ch * (r + 0.5);
        return (
          <group key={i} position={[x, y, D / 2 + out]}>
            <mesh material={plastic} position={[0, 0, -0.03]}><boxGeometry args={[cw - 0.004, ch - 0.004, 0.06]} /></mesh>
            <mesh position={[0, 0.006, 0.0005]}><planeGeometry args={[cw - 0.014, 0.011]} /><meshStandardMaterial map={labels[i]} roughness={0.9} /></mesh>
            <mesh position={[0, -0.012, 0.004]}><boxGeometry args={[0.018, 0.004, 0.008]} /><meshStandardMaterial color="#1b1b1b" /></mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Flush side cutters with pink grips. */
export function Cutters() {
  const grip = (side: 1 | -1) => (
    <mesh position={[side * 0.009, 0.006, 0.045]} rotation={[0, side * 0.12, 0]} castShadow>
      <boxGeometry args={[0.01, 0.009, 0.075]} /><meshStandardMaterial color="#ff48b0" roughness={0.55} />
    </mesh>
  );
  return (
    <group>
      {grip(1)}{grip(-1)}
      <mesh position={[0, 0.005, -0.004]} castShadow><boxGeometry args={[0.016, 0.008, 0.028]} /><meshStandardMaterial color="#8a8f94" metalness={0.85} roughness={0.3} /></mesh>
      <mesh position={[0, 0.005, -0.022]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[0.012, 0.007, 0.012]} /><meshStandardMaterial color="#8a8f94" metalness={0.85} roughness={0.3} /></mesh>
      <mesh position={[0, 0.01, 0.002]}><cylinderGeometry args={[0.004, 0.004, 0.003, 12]} /><meshStandardMaterial color="#555" metalness={0.9} /></mesh>
    </group>
  );
}

export function Tweezers() {
  return (
    <group>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 0.003, 0.0025, 0]} rotation={[0, k * 0.04, 0]} castShadow>
          <boxGeometry args={[0.003, 0.0015, 0.11]} /><meshStandardMaterial color="#b9bdc2" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/** Resistors on their paper tape, as they come off the reel. */
export function ResistorTape({ count = 7 }: { count?: number }) {
  return (
    <group>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, 0.0006, k * 0.022]} receiveShadow><boxGeometry args={[count * 0.012 + 0.01, 0.0012, 0.008]} /><meshStandardMaterial color="#f1ece1" roughness={0.9} /></mesh>
      ))}
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[-count * 0.006 + i * 0.012 + 0.006, 0.003, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.0005, 0.0005, 0.044, 6]} /><meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.3} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.0022, 0.0022, 0.011, 12]} /><meshStandardMaterial color="#e7b863" roughness={0.5} /></mesh>
          {[-0.003, 0, 0.003].map((z, j) => (
            <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.00225, 0.00225, 0.0012, 12]} /><meshStandardMaterial color={['#e67e22', '#e67e22', '#8b4513'][j]} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** A little antistatic zip bag with spare LEDs in it. */
export function LedBag() {
  const leds = [[-0.012, 0.004, '#ff3b30'], [0.004, -0.008, '#ff3b30'], [0.014, 0.01, '#39d86a'], [-0.002, 0.014, '#ffd60a']] as const;
  return (
    <group>
      <mesh position={[0, 0.002, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.055, 0.004, 0.07]} />
        <meshPhysicalMaterial color="#c9b9c8" roughness={0.3} transparent opacity={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.0045, -0.03]}><boxGeometry args={[0.055, 0.001, 0.004]} /><meshStandardMaterial color="#ff48b0" /></mesh>
      {leds.map(([x, z, c], i) => (
        <mesh key={i} position={[x, 0.004, z]} rotation={[Math.PI / 2, 0, i]}><cylinderGeometry args={[0.0025, 0.0025, 0.006, 12]} /><meshStandardMaterial color={c} roughness={0.25} /></mesh>
      ))}
    </group>
  );
}
