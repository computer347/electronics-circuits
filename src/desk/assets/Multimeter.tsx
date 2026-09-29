/**
 * Handheld multimeter: yellow holster, dark face, an LCD with the solver's reading (digits roll
 * to each new value), a rotary dial on DC volts and three jacks. Origin at the bottom centre;
 * the display is at the −z end.
 */
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { reducedMotion, useEased } from '../anim';
import { DIAL, nextMode, type MeterMode, type Reading } from '../meter';
import { drawLcd } from './textures';

export const METER = { w: 0.09, d: 0.17, h: 0.032 } as const;
/** Jack positions in the meter's own frame: COM (black) and V (red). */
export const JACKS = { com: new THREE.Vector3(-0.018, METER.h + 0.004, 0.066), v: new THREE.Vector3(0.018, METER.h + 0.004, 0.066) };

/** Dial angle (radians, clockwise from pointing at the display) for each mode. */
const DIAL_ANGLE: Record<MeterMode, number> = { off: -1.05, V: -0.35, 'Ω': 0.35, A: 1.05 };
const DIAL_R = 0.022;
const LABEL_R = 0.034;
const DIAL_Z = 0.016;

/** The printed ring round the dial: OFF, V⎓, Ω, A, with a tick at each. */
let dialFace: THREE.CanvasTexture | null = null;
function dialFaceTexture() {
  if (dialFace) return dialFace;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const m of DIAL) {
    const a = DIAL_ANGLE[m];
    const x = 256 + Math.sin(a) * 180, y = 256 - Math.cos(a) * 180;
    g.fillStyle = m === 'off' ? '#bdbdbd' : m === 'V' ? '#ffe800' : m === 'Ω' ? '#9fd0f2' : '#ff48b0';
    g.font = `bold ${m === 'off' ? 46 : 70}px 'Space Mono', monospace`;
    g.fillText(m === 'off' ? 'OFF' : m, x, y);
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(256 + Math.sin(a) * 118, 256 - Math.cos(a) * 118); g.lineTo(256 + Math.sin(a) * 138, 256 - Math.cos(a) * 138); g.stroke();
  }
  dialFace = new THREE.CanvasTexture(c);
  dialFace.colorSpace = THREE.SRGBColorSpace;
  return dialFace;
}

/**
 * The meter. `interactive` lets you twist the dial: click the knob (or drag it sideways) to
 * turn it a click, or click a label to jump there.
 */
export function Multimeter({ reading, mode, onMode, interactive }: {
  reading: Reading; mode: MeterMode; onMode: (m: MeterMode) => void; interactive: boolean;
}) {
  const lcd = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 200;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { c, t, g: c.getContext('2d')! };
  }, []);
  const roll = useRef({ from: 0, to: 0, unit: '', t0: 0, shown: '' });
  const knob = useRef<THREE.Group>(null);
  const angle = useEased(DIAL_ANGLE[mode], 0.22);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  useFrame(() => {
    if (knob.current) knob.current.rotation.y = -angle.value;
    const r = roll.current;
    let text = reading.text;
    if (reading.value !== undefined) {
      // Digits roll to a new number in the same unit; a unit change just cuts.
      const target = Number(reading.text);
      if (reading.unit !== r.unit) { r.from = target; r.to = target; r.unit = reading.unit; }
      else if (target !== r.to) { r.from = r.to; r.to = target; r.t0 = performance.now(); }
      const k = reducedMotion() ? 1 : Math.min(1, (performance.now() - r.t0) / 350);
      const decimals = (reading.text.split('.')[1] ?? '').length;
      text = (r.from + (r.to - r.from) * (1 - (1 - k) ** 3)).toFixed(decimals);
    } else r.unit = '';
    const key = `${mode}|${text}|${reading.unit}`;
    if (key !== r.shown) {
      r.shown = key;
      drawLcd(lcd.g, text, reading.unit, mode !== 'off');
      lcd.t.needsUpdate = true;
    }
  });

  /** One click round the dial, wrapping from the last stop back to the first. */
  const turn = (dir: 1 | -1) => onMode(nextMode(mode, dir));
  const cursor = (c: string) => () => { if (interactive) document.body.style.cursor = c; };

  return (
    <group>
      <RoundedBox args={[METER.w, METER.h, METER.d]} radius={0.012} smoothness={4} position={[0, METER.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f2b817" roughness={0.55} />
      </RoundedBox>
      {/* dark face */}
      <RoundedBox args={[METER.w - 0.014, 0.004, METER.d - 0.02]} radius={0.002} position={[0, METER.h + 0.0005, 0]} receiveShadow>
        <meshStandardMaterial color="#2a2a2e" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, METER.h + 0.003, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.068, 0.028]} />
        <meshBasicMaterial map={lcd.t} toneMapped={false} />
      </mesh>
      {/* the printed ring of modes, and a click target on each label */}
      <mesh position={[0, METER.h + 0.0031, DIAL_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.095, 0.095]} />
        <meshBasicMaterial map={dialFaceTexture()} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {interactive && DIAL.map((m) => (
        <mesh key={m} position={[Math.sin(DIAL_ANGLE[m]) * LABEL_R, METER.h + 0.004, DIAL_Z - Math.cos(DIAL_ANGLE[m]) * LABEL_R]} rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => { e.stopPropagation(); onMode(m); }} onPointerOver={cursor('pointer')} onPointerOut={cursor('')}>
          <circleGeometry args={[0.012, 16]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
      {/* the knob: a grip with a pink pointer */}
      <group ref={knob} position={[0, METER.h + 0.006, DIAL_Z]}
        onPointerDown={(e) => { if (!interactive) return; e.stopPropagation(); drag.current = { x: e.nativeEvent.clientX, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.nativeEvent.clientX - d.x;
          if (Math.abs(dx) > 28) { turn(dx > 0 ? 1 : -1); d.x = e.nativeEvent.clientX; d.moved = true; }
        }}
        onPointerLeave={() => { drag.current = null; }}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          const d = drag.current; drag.current = null;
          // A plain click turns it one click on; shift-click turns it back.
          if (!d?.moved) turn(e.nativeEvent.shiftKey ? -1 : 1);
        }}
        onPointerOver={cursor('grab')} onPointerOut={cursor('')}>
        <mesh castShadow>
          <cylinderGeometry args={[DIAL_R, DIAL_R + 0.002, 0.008, 40]} />
          <meshStandardMaterial color="#1a1a1c" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.006, 0]} castShadow>
          <boxGeometry args={[0.012, 0.006, DIAL_R * 1.9]} />
          <meshStandardMaterial color="#26262a" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.0095, -DIAL_R * 0.62]}>
          <boxGeometry args={[0.004, 0.001, 0.012]} />
          <meshBasicMaterial color="#ff48b0" toneMapped={false} />
        </mesh>
      </group>
      {/* jacks: COM, V/Ω, mA */}
      {[[JACKS.com, '#111'], [JACKS.v, '#c0392b'], [new THREE.Vector3(0, METER.h + 0.004, 0.066), '#333']].map(([p, c], i) => (
        <mesh key={i} position={p as THREE.Vector3}>
          <cylinderGeometry args={[0.0055, 0.0055, 0.004, 20]} />
          <meshStandardMaterial color={c as string} roughness={0.4} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** A test lead: a soft cable from a jack to a probe tip, with the probe's handle at the end. */
export function Lead({ from, to, color, resting }: { from: () => THREE.Vector3; to: () => THREE.Vector3; color: string; resting: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const handle = useRef<THREE.Group>(null);
  const last = useRef('');
  useFrame(() => {
    const a = from(), b = to();
    const key = `${a.toArray().map((x) => x.toFixed(4))}${b.toArray().map((x) => x.toFixed(4))}`;
    if (key === last.current || !mesh.current) return;
    last.current = key;
    const top = b.clone().add(new THREE.Vector3(0, resting ? 0.004 : 0.03, 0));
    const mid = a.clone().lerp(top, 0.5);
    mid.y = Math.min(a.y, top.y) - 0.01 + (resting ? 0.01 : 0.02);
    const sag = a.clone().lerp(top, 0.3); sag.y = Math.max(0.004, sag.y - 0.02);
    const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0, 0.02, 0.02)), sag, mid, top]);
    mesh.current.geometry.dispose();
    mesh.current.geometry = new THREE.TubeGeometry(curve, 48, 0.0022, 8, false);
    if (handle.current) {
      handle.current.position.copy(top);
      handle.current.rotation.set(resting ? Math.PI / 2 : 0, 0, 0);
    }
  });
  return (
    <group>
      <mesh ref={mesh} castShadow>
        <bufferGeometry />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {resting && (
        <group ref={handle}>
          <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.005, 0.005, 0.06, 14]} /><meshStandardMaterial color={color} roughness={0.45} /></mesh>
          <mesh position={[0, -0.006, 0]}><coneGeometry args={[0.0022, 0.014, 10]} /><meshStandardMaterial color="#ccc" metalness={0.8} roughness={0.2} /></mesh>
        </group>
      )}
    </group>
  );
}
