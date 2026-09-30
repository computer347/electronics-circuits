/**
 * Shared pieces for the parts models: metals and plastics, pins and legs, printed text
 * (markings and silkscreen) and PCB blanks. Everything is in millimetres; a model's origin is
 * the centre of its footprint on the surface it sits on (y = 0), +y up.
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';

export const TIN = { color: '#c9ccd2', metalness: 0.85, roughness: 0.3 } as const;
export const GOLD = { color: '#d4af37', metalness: 0.9, roughness: 0.25 } as const;
export const EPOXY = { color: '#1c1c1e', roughness: 0.55 } as const;
export const SHIELD = { color: '#b9bdc2', metalness: 0.8, roughness: 0.35 } as const;

const texCache = new Map<string, THREE.CanvasTexture>();

/** Text printed on a part or a board, as a canvas texture. */
export function printTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; size?: number; align?: CanvasTextAlign; font?: string } = {}) {
  const { w = 256, h = 128, bg = 'transparent', fg = '#e8e8e8', size = 40, align = 'center', font = "'Space Mono', monospace" } = opts;
  const key = JSON.stringify([lines, w, h, bg, fg, size, align, font]);
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  if (bg !== 'transparent') { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.textAlign = align; g.textBaseline = 'middle';
  g.font = `bold ${size}px ${font}`;
  const x = align === 'left' ? 8 : align === 'right' ? w - 8 : w / 2;
  lines.forEach((l, i) => g.fillText(l, x, (h / (lines.length + 1)) * (i + 1)));
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** A flat printed label lying on a surface at height y. */
export function Print({ lines, at, w, h, fg, size, rot = 0, align }: { lines: string[]; at: [number, number, number]; w: number; h: number; fg?: string; size?: number; rot?: number; align?: CanvasTextAlign }) {
  const tex = printTexture(lines, { w: Math.round(w * 40), h: Math.round(h * 40), fg, size, align });
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, rot]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** A straight round leg from y0 down to y1 (through-hole lead). */
export function Leg({ x, z = 0, y0, y1, r = 0.25, mat = TIN }: { x: number; z?: number; y0: number; y1: number; r?: number; mat?: typeof TIN | typeof GOLD }) {
  return (
    <mesh position={[x, (y0 + y1) / 2, z]}>
      <cylinderGeometry args={[r, r, Math.abs(y0 - y1), 10]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

/** A gull-wing SMD lead: out from the body side, down to the pad. `dir` is the outward direction in x/z. */
export function GullWing({ at, dir, w = 0.3, len = 0.8, h = 0.6 }: { at: [number, number]; dir: [number, number]; w?: number; len?: number; h?: number }) {
  const yaw = Math.atan2(-dir[1], dir[0]);
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      <mesh position={[len * 0.25, h, 0]}><boxGeometry args={[len * 0.5, 0.12, w]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[len * 0.5, h / 2, 0]}><boxGeometry args={[0.12, h, w]} /><meshStandardMaterial {...TIN} /></mesh>
      <mesh position={[len * 0.75, 0.06, 0]}><boxGeometry args={[len * 0.5, 0.12, w]} /><meshStandardMaterial {...TIN} /></mesh>
    </group>
  );
}

/** A row of pin headers (male), pitch 2.54 mm, running along x from `at`. */
export function HeaderRow({ n, at, female = false, rot = 0 }: { n: number; at: [number, number, number]; female?: boolean; rot?: number }) {
  const P = 2.54;
  return (
    <group position={at} rotation={[0, rot, 0]}>
      <mesh position={[(n - 1) * P / 2, female ? 4.25 : 1.25, 0]} castShadow>
        <boxGeometry args={[n * P, female ? 8.5 : 2.5, P]} />
        <meshStandardMaterial color="#141414" roughness={0.6} />
      </mesh>
      {Array.from({ length: n }, (_, i) => (
        female
          ? <mesh key={i} position={[i * P, 8.51, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#050505" /></mesh>
          : <mesh key={i} position={[i * P, 4.5, 0]}><boxGeometry args={[0.64, 6, 0.64]} /><meshStandardMaterial {...GOLD} /></mesh>
      ))}
    </group>
  );
}

/** A PCB blank: board of w × d mm, with its colour, rounded corners and mounting holes. */
export function Pcb({ w, d, color, holes = [], silk, children, thickness = 1.6 }: {
  w: number; d: number; color: string; holes?: [number, number][]; silk?: THREE.Texture; children?: ReactNode; thickness?: number;
}) {
  const shape = useMemo(() => {
    const r = Math.min(2.5, w / 10, d / 10);
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2);
    s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    for (const [hx, hz] of holes) { const p = new THREE.Path(); p.absarc(hx, -hz, 1.6, 0, Math.PI * 2, true); s.holes.push(p); }
    const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 16 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [w, d, holes, thickness]);
  return (
    <group>
      <mesh geometry={shape} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {holes.map(([hx, hz], i) => (
        <mesh key={i} position={[hx, thickness + 0.01, hz]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.6, 2.6, 24]} /><meshStandardMaterial {...TIN} /></mesh>
      ))}
      {silk && (
        <mesh position={[0, thickness + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial map={silk} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      <group position={[0, thickness, 0]}>{children}</group>
    </group>
  );
}

/** Draw a board's silkscreen: text and outlines on a transparent canvas the size of the board. */
export function silkTexture(key: string, w: number, d: number, draw: (g: CanvasRenderingContext2D, px: number) => void) {
  let t = texCache.get(`silk:${key}`);
  if (t) return t;
  const px = 12; // pixels per mm
  const c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(d * px);
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2f2ee'; g.strokeStyle = '#f2f2ee'; g.lineWidth = 0.25 * px;
  g.font = `bold ${2 * px}px 'Space Mono', monospace`; g.textBaseline = 'middle';
  draw(g, px);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(`silk:${key}`, t);
  return t;
}
