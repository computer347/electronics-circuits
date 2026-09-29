/**
 * Handheld multimeter: yellow holster, dark face, an LCD with the solver's reading (digits roll
 * to each new value), a rotary dial on DC volts and three jacks. Origin at the bottom centre;
 * the display is at the −z end.
 */
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { reducedMotion } from '../anim';
import { drawLcd } from './textures';

export const METER = { w: 0.09, d: 0.17, h: 0.032 } as const;
/** Jack positions in the meter's own frame: COM (black) and V (red). */
export const JACKS = { com: new THREE.Vector3(-0.018, METER.h + 0.004, 0.066), v: new THREE.Vector3(0.018, METER.h + 0.004, 0.066) };

export function Multimeter({ reading }: { reading: number | null }) {
  const lcd = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 200;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { c, t, g: c.getContext('2d')! };
  }, []);
  const roll = useRef({ from: 0, to: 0, t0: 0, shown: '' });

  useFrame(() => {
    const r = roll.current;
    const target = reading ?? NaN;
    if (!Number.isNaN(target) && target !== r.to) { r.from = Number.isNaN(r.to) ? 0 : r.to; r.to = target; r.t0 = performance.now(); }
    if (Number.isNaN(target)) r.to = NaN;
    const k = reducedMotion() ? 1 : Math.min(1, (performance.now() - r.t0) / 350);
    const v = Number.isNaN(r.to) ? NaN : r.from + (r.to - r.from) * (1 - (1 - k) ** 3);
    const text = Number.isNaN(v) ? '- - - -' : (Math.abs(v) < 0.0005 ? 0 : v).toFixed(v <= -10 || v >= 10 ? 2 : 3);
    if (text !== r.shown) {
      r.shown = text;
      drawLcd(lcd.g, text, 'V', !Number.isNaN(v));
      lcd.t.needsUpdate = true;
    }
  });

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
      {/* dial with a pointer on V DC */}
      <mesh position={[0, METER.h + 0.006, 0.012]} castShadow>
        <cylinderGeometry args={[0.024, 0.026, 0.008, 40]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.4} />
      </mesh>
      <mesh position={[0, METER.h + 0.011, 0.003]}>
        <boxGeometry args={[0.005, 0.003, 0.02]} />
        <meshStandardMaterial color="#ff48b0" roughness={0.4} />
      </mesh>
      {[-0.035, -0.02, 0.02, 0.035].map((x, i) => (
        <mesh key={x} position={[x, METER.h + 0.0035, 0.012 - (i === 0 || i === 3 ? 0 : 0.028)]}>
          <boxGeometry args={[0.006, 0.001, 0.002]} />
          <meshBasicMaterial color="#d8d8d8" />
        </mesh>
      ))}
      {/* jacks: COM, V, 10 A */}
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
