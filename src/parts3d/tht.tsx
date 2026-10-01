/**
 * Through-hole parts, true to size in millimetres: resistor, ceramic and electrolytic
 * capacitors, 5 mm LED, signal and rectifier diodes, potentiometer, tactile and slide
 * switches, AA and 9 V batteries, piezo buzzer, TO-92 transistor and TO-220 parts
 * (MOSFET, regulator). Legs run down to y = 0 (the board or the mat).
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { colorBands } from '../breadboard/colorCode';
import { EPOXY, Leg, printTexture, TIN } from './common';

const LED_HEX: Record<string, string> = { red: '#ff3b30', yellow: '#ffd60a', green: '#39d86a', blue: '#3a8bff', white: '#f5f5ff' };

/** Axial body lying across two legs bent down to the board (resistors, diodes). */
function Axial({ len, r, body, children, span }: { len: number; r: number; body: string; children?: React.ReactNode; span: number }) {
  const y = r + 1;
  return (
    <group>
      <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[r, len - 2 * r, 8, 20]} />
        <meshStandardMaterial color={body} roughness={0.5} />
      </mesh>
      <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, span, 8]} /><meshStandardMaterial {...TIN} /></mesh>
      <Leg x={-span / 2} y0={y} y1={0} r={0.3} />
      <Leg x={span / 2} y0={y} y1={0} r={0.3} />
      <group position={[0, y, 0]}>{children}</group>
    </group>
  );
}

/**
 * ¼ W carbon-film resistor, 6.3 × 2.4 mm: the "dog-bone" body (fatter caps at the ends, a slimmer
 * middle), beige, with three value bands bunched towards one end and the gold tolerance band
 * set apart at the other: that gap is how you know which end to read from.
 */
export function ResistorTHT({ ohms = 330 }: { ohms?: number }) {
  const bands = colorBands(ohms).colors;
  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const L = 6.3;
    for (let i = 0; i <= 40; i++) {
      const x = -L / 2 + (L * i) / 40;
      const u = Math.abs(x) / (L / 2);
      // end caps ~1.25 mm radius, body ~1.05 mm, rounded off at the very ends
      const cap = u > 0.62 ? 1.25 : 1.05 + 0.2 * Math.max(0, (u - 0.5) / 0.12) ** 2;
      const r = Math.min(1.25, cap) * Math.sqrt(Math.max(0, 1 - Math.max(0, u - 0.9) / 0.1 * 0.85));
      pts.push(new THREE.Vector2(Math.max(0.3, r), x));
    }
    return pts;
  }, []);
  // Lathe y runs to world −x here: the value bands end up on the left, gold on the right.
  const at = [2.05, 1.35, 0.65, -2.05];
  const radius = (x: number) => (Math.abs(x) > 1.95 ? 1.27 : 1.08);
  return (
    <group>
      <group position={[0, 2.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><latheGeometry args={[profile, 28]} /><meshStandardMaterial color="#d4ae72" roughness={0.6} /></mesh>
        {at.map((y, i) => (
          <mesh key={i} position={[0, y, 0]}><cylinderGeometry args={[radius(y), radius(y), 0.42, 28]} /><meshStandardMaterial color={bands[i]} roughness={0.5} metalness={i === 3 ? 0.6 : 0} /></mesh>
        ))}
        <mesh><cylinderGeometry args={[0.3, 0.3, 10.16, 8]} /><meshStandardMaterial {...TIN} /></mesh>
      </group>
      <Leg x={-5.08} y0={2.25} y1={0} r={0.3} />
      <Leg x={5.08} y0={2.25} y1={0} r={0.3} />
    </group>
  );
}

/** Axial diode, cathode (the band) at +x. `band={false}` for one whose band has worn off. */
export function DiodeTHT({ kind = '1N4148', band = true }: { kind?: '1N4148' | '1N4007'; band?: boolean }) {
  const glass = kind === '1N4148';
  return (
    <Axial len={glass ? 3.8 : 5.2} r={glass ? 0.9 : 1.35} body={glass ? '#e0703a' : '#1c1c1e'} span={glass ? 7.62 : 10.16}>
      {/* the cathode band */}
      {band && <mesh position={[glass ? 1.2 : 1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[glass ? 0.93 : 1.38, glass ? 0.93 : 1.38, 0.5, 20]} /><meshStandardMaterial color={glass ? '#111' : '#c9ccd2'} roughness={0.5} /></mesh>}
      {/* the 1N4148's glass shows the silicon die and its contact springs; the 1N4007 has its type printed */}
      {glass
        ? <mesh><cylinderGeometry args={[0.25, 0.25, 1.4, 10]} /><meshStandardMaterial color="#8a8f96" metalness={0.7} roughness={0.3} /></mesh>
        : <mesh position={[-0.4, 0, 1.36]}><planeGeometry args={[3, 1.2]} /><meshBasicMaterial map={printTexture(['1N4007'], { size: 56, w: 256, h: 96, fg: '#cfcfcf' })} transparent /></mesh>}
    </Axial>
  );
}

export function CeramicCap({ code = '104' }: { code?: string }) {
  return (
    <group>
      {/* a dipped disc: a lumpy, slightly drooping blob of coating, thicker at the bottom */}
      <mesh position={[0, 5.6, 0]} scale={[1, 1.05, 0.42]} castShadow>
        <sphereGeometry args={[2.6, 28, 20]} />
        <meshStandardMaterial color="#d9a441" roughness={0.65} />
      </mesh>
      <mesh position={[0, 3.4, 0]} scale={[1, 0.6, 0.5]}><sphereGeometry args={[1.3, 16, 10]} /><meshStandardMaterial color="#d9a441" roughness={0.65} /></mesh>
      <mesh position={[0, 5.6, 1.1]}><planeGeometry args={[3.2, 1.6]} /><meshBasicMaterial map={printTexture([code], { size: 70, fg: '#2a1a08' })} transparent /></mesh>
      {/* the legs come out of the coating, kink outwards, then go straight down */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <Leg x={k * 0.9} y0={3.6} y1={2.7} r={0.25} />
          <mesh position={[k * 1.085, 2.45, 0]} rotation={[0, 0, k * 0.97]}><cylinderGeometry args={[0.25, 0.25, 0.62, 8]} /><meshStandardMaterial {...TIN} /></mesh>
          <Leg x={k * 1.27} y0={2.25} y1={0} r={0.25} />
        </group>
      ))}
    </group>
  );
}

/** Radial electrolytic: + leg at −x, − leg at +x under the stripe. `loose` gives it its full legs (− shorter). */
export function Electrolytic({ uF = 100, volts = 16, loose = false }: { uF?: number; volts?: number; loose?: boolean }) {
  return (
    <group>
      <mesh position={[0, 6.5, 0]} castShadow><cylinderGeometry args={[2.5, 2.5, 11, 32]} /><meshStandardMaterial color="#2f6fc0" roughness={0.45} /></mesh>
      {/* the − stripe */}
      <mesh position={[0, 6.5, 0]}><cylinderGeometry args={[2.52, 2.52, 10.9, 32, 1, true, Math.PI * 0.35, Math.PI * 0.45]} /><meshStandardMaterial color="#d6dde6" roughness={0.5} side={2} /></mesh>
      <mesh position={[0, 12.02, 0]}><cylinderGeometry args={[2.4, 2.4, 0.05, 32]} /><meshStandardMaterial {...TIN} /></mesh>
      {/* the scored vent on top (it splits safely if the capacitor fails), and the rubber bung under it */}
      {[0, Math.PI / 2].map((a) => <mesh key={a} position={[0, 12.06, 0]} rotation={[0, a, 0]}><boxGeometry args={[3.4, 0.03, 0.18]} /><meshStandardMaterial color="#8d939a" metalness={0.6} roughness={0.4} /></mesh>)}
      <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[2.35, 2.35, 0.5, 28]} /><meshStandardMaterial color="#3a3a3a" roughness={0.9} /></mesh>
      {/* minus signs printed down the stripe */}
      <mesh position={[2.0, 6.5, -1.45]} rotation={[0, Math.PI * 0.32, 0]}><planeGeometry args={[1.4, 9]} /><meshBasicMaterial map={printTexture(['−', '−', '−', '−'], { size: 64, w: 64, h: 320, fg: '#1f3a6e' })} transparent /></mesh>
      <mesh position={[2.53, 6.5, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3, 5]} /><meshBasicMaterial map={printTexture([`${uF}µF`, `${volts}V`], { size: 44, w: 128, h: 200, fg: '#e8eef6' })} transparent /></mesh>
      <Leg x={-1} y0={1} y1={loose ? -14 : 0} r={0.25} />
      <Leg x={1} y0={1} y1={loose ? -12 : 0} r={0.25} />
    </group>
  );
}

/**
 * 5 mm LED: anode (the long leg) at −x, cathode at +x with the flat on the rim beside it.
 * `trimmed` cuts both legs to the same length, as they are once a part has been used.
 */
export function LedTHT({ color = 'red', lit = false, trimmed = false }: { color?: string; lit?: boolean; trimmed?: boolean }) {
  const c = LED_HEX[color] ?? color;
  return (
    <group>
      <mesh position={[0, 5.2, 0]}><cylinderGeometry args={[2.5, 2.5, 5.4, 28]} /><meshPhysicalMaterial color={c} transparent opacity={0.82} roughness={0.15} emissive={c} emissiveIntensity={lit ? 1.5 : 0} /></mesh>
      <mesh position={[0, 7.9, 0]}><sphereGeometry args={[2.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color={c} transparent opacity={0.82} roughness={0.15} emissive={c} emissiveIntensity={lit ? 1.5 : 0} /></mesh>
      {/* rim, with the flat on the cathode (+x) side */}
      <mesh position={[0, 2.7, 0]}><cylinderGeometry args={[2.9, 2.9, 1, 28, 1, false, Math.PI / 2 + 0.5, Math.PI * 2 - 1]} /><meshPhysicalMaterial color={c} transparent opacity={0.85} roughness={0.2} /></mesh>
      {/* inside the clear epoxy: the post (anode, small) and the anvil (cathode, the big flag
          the chip sits in). It's the third way to tell the legs apart, after length and the flat. */}
      <mesh position={[-1.0, 5.2, 0]}><boxGeometry args={[0.45, 4.6, 0.4]} /><meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0.9, 5.6, 0]}><boxGeometry args={[1.5, 3.2, 0.4]} /><meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0.9, 3.4, 0]}><boxGeometry args={[0.45, 1.6, 0.4]} /><meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} /></mesh>
      <Leg x={-1.27} y0={2.2} y1={trimmed ? -2 : -4} r={0.25} />
      <Leg x={1.27} y0={2.2} y1={-2} r={0.25} />
    </group>
  );
}

export function Potentiometer() {
  return (
    <group>
      <mesh position={[0, 3, 0]} castShadow><boxGeometry args={[9.5, 6, 10]} /><meshStandardMaterial color="#1f5fa8" roughness={0.5} /></mesh>
      <mesh position={[0, 7, 0]}><cylinderGeometry args={[3.5, 3.5, 2, 24]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[0, 12, 0]} castShadow><cylinderGeometry args={[3, 3, 8, 24]} /><meshStandardMaterial color="#1c1c1e" roughness={0.5} /></mesh>
      <mesh position={[0, 16.05, -1.5]}><boxGeometry args={[0.8, 0.1, 3]} /><meshBasicMaterial color="#ffe800" /></mesh>
      {[-2.5, 0, 2.5].map((x) => <Leg key={x} x={x} z={4.5} y0={0.5} y1={-3} r={0.35} />)}
    </group>
  );
}

export function TactileButton({ pressed = false }: { pressed?: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.75, 0]} castShadow><boxGeometry args={[6, 3.5, 6]} /><meshStandardMaterial color="#1c1c1e" roughness={0.5} /></mesh>
      <mesh position={[0, 3.6, 0]}><boxGeometry args={[6, 0.2, 6]} /><meshStandardMaterial {...TIN} /></mesh>
      {/* the cover plate's tabs, folded down two sides to clip it to the body */}
      {[-1, 1].map((k) => <mesh key={k} position={[0, 2.6, k * 3.02]}><boxGeometry args={[2.2, 2, 0.08]} /><meshStandardMaterial {...TIN} /></mesh>)}
      <mesh position={[0, pressed ? 3.9 : 4.5, 0]} castShadow><cylinderGeometry args={[1.75, 1.75, 1.8, 20]} /><meshStandardMaterial color="#0078bf" roughness={0.4} /></mesh>
      {[[-3.25, -2.25], [3.25, -2.25], [-3.25, 2.25], [3.25, 2.25]].map(([x, z]) => <Leg key={`${x}${z}`} x={x!} z={z!} y0={0.5} y1={-3} r={0.3} />)}
    </group>
  );
}

export function SlideSwitch({ on = false }: { on?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[8.6, 1.8, 3.6]} /><meshStandardMaterial color="#1c1c1e" roughness={0.6} /></mesh>
      <mesh position={[0, 3.4, 0]} castShadow><boxGeometry args={[8.7, 3.2, 3.7]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[0, 5.01, 0]}><boxGeometry args={[5.5, 0.05, 1.6]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[on ? 1.5 : -1.5, 6, 0]}><boxGeometry args={[2, 3, 1.6]} /><meshStandardMaterial color="#1c1c1e" /></mesh>
      {[-2.54, 0, 2.54].map((x) => <Leg key={x} x={x} y0={0} y1={-3.5} r={0.3} />)}
    </group>
  );
}

export function CellAA() {
  return (
    <group position={[0, 7.25, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[7.25, 7.25, 48, 40]} /><meshStandardMaterial color="#1e1e1e" roughness={0.5} /></mesh>
      <mesh position={[0, 14, 0]}><cylinderGeometry args={[7.3, 7.3, 18, 40]} /><meshStandardMaterial color="#e57b23" roughness={0.5} /></mesh>
      <mesh position={[0, 24.6, 0]}><cylinderGeometry args={[2.6, 2.8, 1.2, 24]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[0, -24.05, 0]}><cylinderGeometry args={[6, 6, 0.2, 32]} /><meshStandardMaterial {...TIN} /></mesh>
      {/* the print runs along the cell: + by the bump, the voltage and size in the middle */}
      <mesh position={[0, -4, 7.27]} rotation={[0, 0, -Math.PI / 2]}><planeGeometry args={[30, 9]} /><meshBasicMaterial map={printTexture(['1.5V  AA  ALKALINE'], { size: 52, w: 640, h: 96, fg: '#e8e8e8' })} transparent /></mesh>
      <mesh position={[0, 17, 7.32]} rotation={[0, 0, -Math.PI / 2]}><planeGeometry args={[6, 6]} /><meshBasicMaterial map={printTexture(['+'], { size: 90, w: 96, h: 96, fg: '#1e1e1e' })} transparent /></mesh>
    </group>
  );
}

export function Battery9V() {
  return (
    <group>
      <mesh position={[0, 8.75, 0]} castShadow><boxGeometry args={[26.5, 17.5, 48.5]} /><meshStandardMaterial color="#1c1c1e" roughness={0.5} /></mesh>
      <mesh position={[0, 8.75, 10]}><boxGeometry args={[26.6, 17.6, 18]} /><meshStandardMaterial color="#ffb000" roughness={0.5} /></mesh>
      <mesh position={[0, 17.56, 4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[22, 12]} /><meshBasicMaterial map={printTexture(['9V', 'ALKALINE'], { size: 80, w: 384, h: 220, fg: '#1c1c1e' })} transparent /></mesh>
      <mesh position={[-6.35, 17.56, -12]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4, 4]} /><meshBasicMaterial map={printTexture(['−'], { size: 90, w: 96, h: 96, fg: '#e8e8e8' })} transparent /></mesh>
      <mesh position={[6.35, 17.56, -12]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4, 4]} /><meshBasicMaterial map={printTexture(['+'], { size: 90, w: 96, h: 96, fg: '#e8e8e8' })} transparent /></mesh>
      <mesh position={[0, 8.75, 24.3]}><planeGeometry args={[20, 10]} /><meshBasicMaterial map={printTexture(['9V'], { size: 80, fg: '#111' })} transparent /></mesh>
      {/* snap terminals on the top end */}
      <mesh position={[-6.35, 17.5 + 1.5, -18]}><cylinderGeometry args={[3, 3, 3, 6]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[6.35, 17.5 + 1.5, -18]}><cylinderGeometry args={[2.5, 2.5, 3, 20]} /><meshStandardMaterial {...TIN} /></mesh>
    </group>
  );
}

export function Buzzer() {
  return (
    <group>
      <mesh position={[0, 4.75, 0]} castShadow><cylinderGeometry args={[6, 6, 9.5, 32]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[0, 9.52, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1, 16]} /><meshBasicMaterial color="#050505" /></mesh>
      <mesh position={[-3.5, 9.52, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2, 2]} /><meshBasicMaterial map={printTexture(['+'], { size: 90 })} transparent /></mesh>
      {/* new buzzers come with a sticker over the hole, to keep flux out while soldering */}
      <mesh position={[0, 9.53, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[4.2, 28]} /><meshBasicMaterial map={printTexture(['REMOVE SEAL', 'AFTER WASHING'], { size: 30, w: 256, h: 256, bg: '#f2f2ee', fg: '#222' })} transparent opacity={0.92} /></mesh>
      {/* the + leg is the longer one, like an LED */}
      <Leg x={-3.25} y0={0} y1={-4} r={0.3} />
      <Leg x={3.25} y0={0} y1={-3} r={0.3} />
    </group>
  );
}

/**
 * TO-92: a small transistor, a D-shaped body: the flat face (printed) looks along −z and the
 * rounded back along +z. Legs at −x, 0, +x are E, B, C for a BC547, so with the flat face
 * towards you they read C B E, left to right, as on the datasheet. `marking=""` is a part
 * whose print has worn off.
 */
export function TO92({ marking = 'BC547' }: { marking?: string }) {
  return (
    <group>
      <mesh position={[0, 5.5, 0]} castShadow><cylinderGeometry args={[2.3, 2.3, 4.5, 28, 1, false, -Math.PI / 2, Math.PI]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[0, 5.5, 0]}><boxGeometry args={[4.6, 4.5, 0.02]} /><meshStandardMaterial {...EPOXY} /></mesh>
      {marking && <mesh position={[0, 5.5, -0.02]} rotation={[0, Math.PI, 0]}><planeGeometry args={[4.2, 3]} /><meshBasicMaterial map={printTexture([marking, 'B331'], { size: 34, fg: '#d8d8d8' })} transparent /></mesh>}
      {[-1.27, 0, 1.27].map((x) => <Leg key={x} x={x} y0={3.3} y1={-2} r={0.22} />)}
    </group>
  );
}

/** TO-220: a power package with a metal tab (MOSFET, regulator). Legs 1 2 3 left to right. */
export function TO220({ marking = 'IRLZ44N' }: { marking?: string }) {
  return (
    <group>
      <mesh position={[0, 10.5, 0]} castShadow><boxGeometry args={[10, 9, 4.4]} /><meshStandardMaterial {...EPOXY} /></mesh>
      <mesh position={[0, 20, 1.6]} castShadow><boxGeometry args={[10, 12, 1.3]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[0, 22.5, 2.26]}><circleGeometry args={[1.8, 20]} /><meshBasicMaterial color="#101010" /></mesh>
      <mesh position={[0, 10.5, -2.21]} rotation={[0, Math.PI, 0]}><planeGeometry args={[9, 5]} /><meshBasicMaterial map={printTexture([marking], { size: 40, fg: '#d8d8d8' })} transparent /></mesh>
      {[-2.54, 0, 2.54].map((x) => <Leg key={x} x={x} y0={6} y1={-3} r={0.4} />)}
    </group>
  );
}

/**
 * DIP-14 logic chip (7.62 mm row spacing, 2.54 mm pitch): the notch and pin-1 dot at −x, pins
 * 1–7 along +z (the side facing you) left to right, 8–14 back along −z.
 */
export function Dip14({ marking = '74HC00' }: { marking?: string }) {
  return (
    <group>
      <mesh position={[0, 2.4, 0]} castShadow><boxGeometry args={[19.3, 3.3, 6.35]} /><meshStandardMaterial color="#17181a" roughness={0.6} /></mesh>
      <mesh position={[-9.66, 4.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1, 20, -Math.PI / 2, Math.PI]} /><meshBasicMaterial color="#050505" /></mesh>
      <mesh position={[-7.6, 4.07, 2.1]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.45, 16]} /><meshBasicMaterial color="#2a2c2e" /></mesh>
      <mesh position={[0.6, 4.07, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[14, 3.4]} /><meshBasicMaterial map={printTexture([marking, 'TI  8C K4'], { size: 40, w: 512, h: 128, fg: '#c8c8c8' })} transparent /></mesh>
      {Array.from({ length: 7 }, (_, i) => (i - 3) * 2.54).flatMap((x) => [
        <group key={`f${x}`}>
          <mesh position={[x, 1.4, 3.6]}><boxGeometry args={[1.5, 0.25, 1.2]} /><meshStandardMaterial {...TIN} /></mesh>
          <Leg x={x} z={3.81} y0={1.4} y1={-3} r={0.25} />
        </group>,
        <group key={`b${x}`}>
          <mesh position={[x, 1.4, -3.6]}><boxGeometry args={[1.5, 0.25, 1.2]} /><meshStandardMaterial {...TIN} /></mesh>
          <Leg x={x} z={-3.81} y0={1.4} y1={-3} r={0.25} />
        </group>,
      ])}
    </group>
  );
}
