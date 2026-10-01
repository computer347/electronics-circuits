/**
 * Surface-mount parts, in millimetres: chip resistors, capacitors and LEDs (0402, 0603, 0805),
 * SOT-23 and SOT-223, SOIC-8 and QFP chips, crystals, USB-B and micro-USB sockets and a DC
 * barrel jack. They sit on y = 0 (the top of a PCB).
 */
import * as THREE from 'three';
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
      {size !== '0402' && code && <mesh position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[l * 0.58, w * 0.7]} /><meshBasicMaterial map={printTexture([code], { size: code.length > 3 ? 64 : 80, w: code.length > 3 ? 192 : 128, h: 64 })} transparent /></mesh>}
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
      {/* HC-49/S: a stadium-shaped metal can, 11 × 4.6 mm, on a black insulating base */}
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[11.6, 0.5, 5]} /><meshStandardMaterial color="#1a1a1a" roughness={0.7} /></mesh>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <extrudeGeometry args={[stadium(5.5, 2.3), { depth: 3.0, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 20 }]} />
        <meshStandardMaterial {...SHIELD} />
      </mesh>
      <mesh position={[0, 3.77, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[7, 2]} /><meshBasicMaterial map={printTexture([mhz], { size: 60, w: 256, h: 64, fg: '#333' })} transparent /></mesh>
    </group>
  );
}

export function UsbB() {
  return (
    <group>
      <mesh position={[0, 5.5, 0]} castShadow><boxGeometry args={[16, 11, 12]} /><meshStandardMaterial {...SHIELD} /></mesh>
      {/* the USB-B mouth: square with its two top corners bevelled (it only fits one way), a
          white tongue carrying the four contacts inside */}
      <mesh position={[8.01, 5.5, 0]} rotation={[0, Math.PI / 2, 0]}><shapeGeometry args={[usbBMouth()]} /><meshStandardMaterial color="#141414" side={2} /></mesh>
      <mesh position={[7.4, 5.0, 0]}><boxGeometry args={[1.2, 2.2, 4.2]} /><meshStandardMaterial color="#efefef" roughness={0.5} /></mesh>
      {[-1.2, 1.2].map((z) => <mesh key={z} position={[8.03, 6.16, z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.8, 0.3]} /><meshStandardMaterial color="#d8b45a" metalness={0.8} roughness={0.3} /></mesh>)}
    </group>
  );
}

export function MicroUsb() {
  return (
    <group>
      <mesh position={[0, 1.4, 0]} castShadow><boxGeometry args={[5.5, 2.8, 7.5]} /><meshStandardMaterial {...SHIELD} /></mesh>
      {/* the micro-USB mouth is a trapezoid: wider on top, so the plug only goes in one way */}
      <mesh position={[0, 1.4, -3.76]} rotation={[0, Math.PI, 0]}><shapeGeometry args={[microUsbMouth()]} /><meshStandardMaterial color="#141414" side={2} /></mesh>
      <mesh position={[0, 1.7, -3.2]}><boxGeometry args={[3.6, 0.35, 1.2]} /><meshStandardMaterial color="#1f1f1f" /></mesh>
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

/** USB-B socket opening (8 × 7.3 mm, top corners cut). */
function usbBMouth() {
  const sh = new THREE.Shape();
  const w = 4, h = 3.65, c = 1.2;
  sh.moveTo(-w, -h); sh.lineTo(w, -h); sh.lineTo(w, h - c); sh.lineTo(w - c, h); sh.lineTo(-w + c, h); sh.lineTo(-w, h - c); sh.closePath();
  return sh;
}

/** Micro-USB opening (6.9 × 1.85 mm, a trapezoid wider at the top). */
function microUsbMouth() {
  const sh = new THREE.Shape();
  sh.moveTo(-2.4, -0.9); sh.lineTo(2.4, -0.9); sh.lineTo(3.0, 0.9); sh.lineTo(-3.0, 0.9); sh.closePath();
  return sh;
}

/** A stadium (two half-circles joined by straight sides): half-length a, radius r. */
function stadium(a: number, r: number) {
  const sh = new THREE.Shape();
  sh.moveTo(-a + r, -r); sh.lineTo(a - r, -r); sh.absarc(a - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  sh.lineTo(-a + r, r); sh.absarc(-a + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return sh;
}

/**
 * QFN: a flat square chip with no legs, just pads round the edge underneath (and a big ground
 * pad in the middle). The ESP8266 and the CP2102 come like this; you can't probe their pins.
 */
export function QFN({ n = 32, size = 5, marking = ['ESP8266EX'] }: { n?: number; size?: number; marking?: string[] }) {
  const per = n / 4, pitch = (size - 0.8) / (per - 1);
  const pads: [number, number, number, number][] = [];
  for (let i = 0; i < per; i++) {
    const o = -((per - 1) * pitch) / 2 + i * pitch;
    pads.push([o, size / 2, pitch * 0.5, 0.35], [o, -size / 2, pitch * 0.5, 0.35], [size / 2, o, 0.35, pitch * 0.5], [-size / 2, o, 0.35, pitch * 0.5]);
  }
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[size, 0.85, size]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[-size / 2 + 0.6, 0.88, size / 2 - 0.6]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.25, 12]} /><meshBasicMaterial color="#555" /></mesh>
      <mesh position={[0, 0.88, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[size * 0.85, size * 0.5]} /><meshBasicMaterial map={printTexture(marking, { size: 38, w: 256, h: 128 })} transparent /></mesh>
      {pads.map(([x, z, w, d], i) => <mesh key={i} position={[x, 0.05, z]}><boxGeometry args={[w, 0.1, d]} /><meshStandardMaterial {...TIN} /></mesh>)}
    </group>
  );
}

/** A small SMD crystal (3.2 × 2.5 mm): a ceramic base with a soldered metal lid. */
export function Xtal3225({ mhz = '26.000' }: { mhz?: string }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[3.2, 0.5, 2.5]} /><meshStandardMaterial color="#d9cfc0" roughness={0.7} /></mesh>
      <mesh position={[0, 0.62, 0]} castShadow><boxGeometry args={[2.9, 0.25, 2.2]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[0, 0.755, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.6, 1]} /><meshBasicMaterial map={printTexture([mhz], { size: 52, w: 256, h: 96, fg: '#444' })} transparent /></mesh>
    </group>
  );
}

/** A jumper cap on two header pins (black, or yellow on a Blue Pill). */
export function JumperCap({ color = '#e8c228' }: { color?: string }) {
  return <mesh position={[1.27, 6.5, 0]} castShadow><boxGeometry args={[4.9, 6, 2.4]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>;
}
