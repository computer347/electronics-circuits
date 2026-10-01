/**
 * Through-hole parts, true to size in millimetres: resistor, ceramic and electrolytic
 * capacitors, 5 mm LED, signal and rectifier diodes, potentiometer, tactile and slide
 * switches, AA and 9 V batteries, piezo buzzer, TO-92 transistor and TO-220 parts
 * (MOSFET, regulator). Legs run down to y = 0 (the board or the mat).
 */
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

export function ResistorTHT({ ohms = 330 }: { ohms?: number }) {
  const bands = colorBands(ohms).colors;
  return (
    <Axial len={6.3} r={1.2} body="#e7b863" span={10.16}>
      {[-1.9, -1.05, -0.2, 1.8].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[1.23, 1.23, 0.45, 20]} /><meshStandardMaterial color={bands[i]} roughness={0.5} /></mesh>
      ))}
    </Axial>
  );
}

/** Axial diode, cathode (the band) at +x. `band={false}` for one whose band has worn off. */
export function DiodeTHT({ kind = '1N4148', band = true }: { kind?: '1N4148' | '1N4007'; band?: boolean }) {
  const glass = kind === '1N4148';
  return (
    <Axial len={glass ? 3.8 : 5.2} r={glass ? 0.9 : 1.35} body={glass ? '#e0703a' : '#1c1c1e'} span={glass ? 7.62 : 10.16}>
      {/* the cathode band */}
      {band && <mesh position={[glass ? 1.2 : 1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[glass ? 0.93 : 1.38, glass ? 0.93 : 1.38, 0.5, 20]} /><meshStandardMaterial color={glass ? '#111' : '#c9ccd2'} roughness={0.5} /></mesh>}
    </Axial>
  );
}

export function CeramicCap({ code = '104' }: { code?: string }) {
  return (
    <group>
      <mesh position={[0, 5.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[2.5, 2.5, 1.6, 28]} />
        <meshStandardMaterial color="#d9a441" roughness={0.6} />
      </mesh>
      <mesh position={[0, 5.5, 0.81]}><planeGeometry args={[3.2, 1.6]} /><meshBasicMaterial map={printTexture([code], { size: 70, fg: '#2a1a08' })} transparent /></mesh>
      <Leg x={-1.27} y0={3.5} y1={0} r={0.25} />
      <Leg x={1.27} y0={3.5} y1={0} r={0.25} />
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
      <mesh position={[0, pressed ? 3.9 : 4.5, 0]} castShadow><cylinderGeometry args={[1.75, 1.75, 1.8, 20]} /><meshStandardMaterial color="#0078bf" roughness={0.4} /></mesh>
      {[[-3.25, -2.25], [3.25, -2.25], [-3.25, 2.25], [3.25, 2.25]].map(([x, z]) => <Leg key={`${x}${z}`} x={x!} z={z!} y0={0.5} y1={-3} r={0.3} />)}
    </group>
  );
}

export function SlideSwitch({ on = false }: { on?: boolean }) {
  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow><boxGeometry args={[8.6, 5, 3.6]} /><meshStandardMaterial {...TIN} /></mesh>
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
    </group>
  );
}

export function Battery9V() {
  return (
    <group>
      <mesh position={[0, 8.75, 0]} castShadow><boxGeometry args={[26.5, 17.5, 48.5]} /><meshStandardMaterial color="#1c1c1e" roughness={0.5} /></mesh>
      <mesh position={[0, 8.75, 10]}><boxGeometry args={[26.6, 17.6, 18]} /><meshStandardMaterial color="#ffb000" roughness={0.5} /></mesh>
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
      <Leg x={-3.8} y0={0} y1={-3} r={0.3} />
      <Leg x={3.8} y0={0} y1={-3} r={0.3} />
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
