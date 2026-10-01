/**
 * Surface-mount parts, in millimetres: chip resistors, capacitors and LEDs (0402, 0603, 0805),
 * SOT-23 and SOT-223, SOIC-8 and QFP chips, crystals, USB-B and micro-USB sockets and a DC
 * barrel jack. They sit on y = 0 (the top of a PCB).
 */
import { EPOXY, GullWing, printTexture, SHIELD, TIN } from './common';

export type ChipSize = '0402' | '0603' | '0805';
const CHIP: Record<ChipSize, [number, number, number]> = { '0402': [1.0, 0.5, 0.35], '0603': [1.6, 0.8, 0.45], '0805': [2.0, 1.25, 0.5] };

/** Chip resistor: black body with a printed value code, tinned ends. */
export function ChipResistor({ size = '0603', code = '102' }: { size?: ChipSize; code?: string }) {
  const [l, w, h] = CHIP[size];
  const end = l * 0.2;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow><boxGeometry args={[l - 2 * end, h, w]} /><meshStandardMaterial color="#141414" roughness={0.5} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} position={[k * (l / 2 - end / 2), h / 2, 0]}><boxGeometry args={[end, h, w]} /><meshStandardMaterial {...TIN} /></mesh>)}
      {size !== '0402' && <mesh position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[l * 0.55, w * 0.7]} /><meshBasicMaterial map={printTexture([code], { size: 80, w: 128, h: 64 })} transparent /></mesh>}
    </group>
  );
}

export function ChipCap({ size = '0603' }: { size?: ChipSize }) {
  const [l, w, h] = CHIP[size];
  const end = l * 0.22;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow><boxGeometry args={[l - 2 * end, h, w]} /><meshStandardMaterial color="#b9956a" roughness={0.6} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} position={[k * (l / 2 - end / 2), h / 2, 0]}><boxGeometry args={[end, h, w]} /><meshStandardMaterial {...TIN} /></mesh>)}
    </group>
  );
}

export function ChipLed({ size = '0603', color = '#39d86a', lit = false }: { size?: ChipSize; color?: string; lit?: boolean }) {
  const [l, w, h] = CHIP[size];
  return (
    <group>
      <mesh position={[0, h / 2, 0]}><boxGeometry args={[l * 0.7, h, w]} /><meshStandardMaterial color="#f4f4f0" roughness={0.3} /></mesh>
      <mesh position={[0, h + 0.02, 0]}><boxGeometry args={[l * 0.6, 0.05, w * 0.8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 2 : 0.05} transparent opacity={0.9} toneMapped={!lit} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} position={[k * l * 0.42, h / 2, 0]}><boxGeometry args={[l * 0.16, h, w]} /><meshStandardMaterial {...TIN} /></mesh>)}
      {lit && <pointLight position={[0, h + 1, 0]} color={color} intensity={0.2} distance={6} />}
    </group>
  );
}

export function SOT23({ marking = 'J6' }: { marking?: string }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[2.9, 1.0, 1.3]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[0, 1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2, 1]} /><meshBasicMaterial map={printTexture([marking], { size: 70, w: 128, h: 64 })} transparent /></mesh>
      <GullWing at={[-0.95, 0.65]} dir={[0, 1]} w={0.4} len={0.9} h={0.5} />
      <GullWing at={[0.95, 0.65]} dir={[0, 1]} w={0.4} len={0.9} h={0.5} />
      <GullWing at={[0, -0.65]} dir={[0, -1]} w={0.4} len={0.9} h={0.5} />
    </group>
  );
}

/** SOT-223 regulator: the wide tab on one side, three legs on the other; `volts` is printed under the part number. */
export function SOT223({ marking = 'AMS1117', volts = '3.3' }: { marking?: string; volts?: string }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[6.5, 1.6, 3.5]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[0, 1.71, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.5, 2.4]} /><meshBasicMaterial map={printTexture([marking, volts], { size: 40, w: 256, h: 112 })} transparent /></mesh>
      {/* the wide tab on one side, three legs on the other */}
      <GullWing at={[0, -1.75]} dir={[0, -1]} w={3} len={1.8} h={0.8} />
      {[-2.3, 0, 2.3].map((x) => <GullWing key={x} at={[x, 1.75]} dir={[0, 1]} w={0.7} len={1.8} h={0.8} />)}
    </group>
  );
}

export function SOIC8({ marking = '25Q32' }: { marking?: string }) {
  return (
    <group>
      <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[4.9, 1.5, 3.9]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[-1.8, 1.61, 1.2]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.3, 12]} /><meshBasicMaterial color="#555" /></mesh>
      <mesh position={[0, 1.61, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4.2, 2.4]} /><meshBasicMaterial map={printTexture([marking], { size: 44, w: 256, h: 128 })} transparent /></mesh>
      {[-1.905, -0.635, 0.635, 1.905].map((x) => [1, -1].map((k) => <GullWing key={`${x}${k}`} at={[x, k * 1.95]} dir={[0, k]} w={0.42} len={1.1} h={0.75} />))}
    </group>
  );
}

/** Square QFP chip with `n` pins in total (a quarter on each side). */
export function QFP({ n = 32, size = 7, marking = ['ATMEGA', '328P'] }: { n?: number; size?: number; marking?: string[] }) {
  const per = n / 4;
  const pitch = (size - 1.2) / (per - 1);
  const legs: [number, number, number, number][] = [];
  for (let i = 0; i < per; i++) {
    const o = -((per - 1) * pitch) / 2 + i * pitch;
    legs.push([o, size / 2, 0, 1], [o, -size / 2, 0, -1], [size / 2, o, 1, 0], [-size / 2, o, -1, 0]);
  }
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[size, 1.4, size]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[-size / 2 + 1, 1.51, size / 2 - 1]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.45, 16]} /><meshBasicMaterial color="#555" /></mesh>
      <mesh position={[0, 1.51, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[size * 0.8, size * 0.5]} /><meshBasicMaterial map={printTexture(marking, { size: 44, w: 256, h: 160 })} transparent /></mesh>
      {legs.map(([x, z, dx, dz], i) => <GullWing key={i} at={[x, z]} dir={[dx, dz]} w={0.22} len={1} h={0.7} />)}
    </group>
  );
}

/** HC-49 crystal, the low SMD-style can. */
export function Crystal({ mhz = '16.000' }: { mhz?: string }) {
  return (
    <group>
      <mesh position={[0, 1.8, 0]} castShadow scale={[1, 1, 0.42]}><cylinderGeometry args={[5.5, 5.5, 3.6, 32]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[0, 3.61, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[7, 2]} /><meshBasicMaterial map={printTexture([mhz], { size: 60, w: 256, h: 64, fg: '#333' })} transparent /></mesh>
    </group>
  );
}

export function UsbB() {
  return (
    <group>
      <mesh position={[0, 5.5, 0]} castShadow><boxGeometry args={[16, 11, 12]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[8.01, 5.5, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[8.5, 7.5]} /><meshStandardMaterial color="#e8e8e8" roughness={0.5} /></mesh>
      <mesh position={[8.02, 5.5, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[5.5, 4.5]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
    </group>
  );
}

export function MicroUsb() {
  return (
    <group>
      <mesh position={[0, 1.4, 0]} castShadow><boxGeometry args={[5.5, 2.8, 7.5]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[0, 1.4, -3.76]}><planeGeometry args={[5, 1.9]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
    </group>
  );
}

export function DcJack() {
  return (
    <group>
      <mesh position={[0, 5.5, 0]} castShadow><boxGeometry args={[14, 11, 9]} /><meshStandardMaterial color="#141414" roughness={0.5} /></mesh>
      <mesh position={[7.01, 6, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[3.2, 24]} /><meshStandardMaterial color="#050505" /></mesh>
      <mesh position={[7.02, 6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[1, 1, 0.5, 12]} /><meshStandardMaterial {...TIN} /></mesh>
    </group>
  );
}

/** A small tactile button as used on boards (reset, boot). */
export function SmdButton({ w = 6, color = '#1c1c1e' }: { w?: number; color?: string }) {
  return (
    <group>
      <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[w, 3.2, w]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[0, 3.6, 0]}><cylinderGeometry args={[w * 0.28, w * 0.28, 1.2, 20]} /><meshStandardMaterial color={color} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} position={[k * (w / 2 + 0.4), 0.2, 0]}><boxGeometry args={[0.8, 0.3, w * 0.6]} /><meshStandardMaterial {...TIN} /></mesh>)}
    </group>
  );
}
