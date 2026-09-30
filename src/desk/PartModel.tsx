/**
 * A part up close, turning slowly on the notebook page, with numbered callouts on the bits that
 * matter (the long leg, the flat side, the bands). The numbers match the list on the facing
 * page. Everything is modelled here in code, big enough to read.
 */
import { Html } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { colorBands } from '../breadboard/colorCode';
import { reducedMotion } from './anim';
import { Multimeter } from './assets/Multimeter';
import type { PartId } from './notebook';

const METAL = { color: '#c9ccd2', metalness: 0.85, roughness: 0.3 } as const;

/** Callouts go into their own layer beside the canvas (not a node React also manages). */
const CalloutLayer = createContext<RefObject<HTMLDivElement | null> | null>(null);

function Callout({ n, at, label }: { n: number; at: [number, number, number]; label: string }) {
  const layer = useContext(CalloutLayer);
  return (
    <Html position={at} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} portal={(layer ?? undefined) as RefObject<HTMLElement> | undefined}>
      <span className="callout"><i>{n}</i>{label}</span>
    </Html>
  );
}

function Leg({ x, len, z = 0 }: { x: number; len: number; z?: number }) {
  return <mesh position={[x, -len / 2, z]}><cylinderGeometry args={[0.035, 0.035, len, 10]} /><meshStandardMaterial {...METAL} /></mesh>;
}

function Led({ labels }: { labels: string[] }) {
  // The rim has a flat on the cathode side: a cylinder with a slice cut off, closed by a plane.
  const rim = useMemo(() => {
    const shape = new THREE.Shape();
    const r = 0.62, cut = 0.5;
    const a = Math.acos(cut / r);
    shape.absarc(0, 0, r, a, Math.PI * 2 - a, false);
    shape.lineTo(cut, -Math.sqrt(r * r - cut * cut));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group position={[0, 0.9, 0]}>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.5, 0.5, 1.1, 40]} /><meshPhysicalMaterial color="#ff3b30" transparent opacity={0.8} roughness={0.15} transmission={0.2} /></mesh>
      <mesh position={[0, 1.1, 0]}><sphereGeometry args={[0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color="#ff3b30" transparent opacity={0.8} roughness={0.15} /></mesh>
      <mesh geometry={rim}><meshPhysicalMaterial color="#ff3b30" transparent opacity={0.85} roughness={0.2} /></mesh>
      <Leg x={-0.2} len={2.8} />
      <Leg x={0.2} len={2.2} />
      <Callout n={1} at={[-0.85, -1.6, 0]} label={labels[0]!} />
      <Callout n={2} at={[0.85, -1.2, 0]} label={labels[1]!} />
      <Callout n={3} at={[0.75, 0.1, 0]} label={labels[2]!} />
      <Callout n={4} at={[0, 1.9, 0]} label={labels[3]!} />
    </group>
  );
}

function Resistor({ labels }: { labels: string[] }) {
  const bands = colorBands(330).colors;
  return (
    <group rotation={[0, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.035, 0.035, 4.4, 10]} /><meshStandardMaterial {...METAL} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.32, 1.2, 8, 24]} /><meshStandardMaterial color="#e7b863" roughness={0.5} /></mesh>
      {[-0.45, -0.2, 0.05, 0.5].map((x, i) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.335, 0.335, 0.12, 24]} /><meshStandardMaterial color={bands[i]} roughness={0.5} /></mesh>
      ))}
      <Callout n={1} at={[-0.45, 0.7, 0]} label={labels[0]!} />
      <Callout n={2} at={[-0.2, -0.7, 0]} label={labels[1]!} />
      <Callout n={3} at={[0.05, 0.95, 0]} label={labels[2]!} />
      <Callout n={4} at={[0.5, -0.95, 0]} label={labels[3]!} />
    </group>
  );
}

function BoardPatch({ labels }: { labels: string[] }) {
  const holes: [number, number][] = [];
  for (let c = 0; c < 6; c++) for (const z of [-1.5, -1.1, -0.7, -0.3, 0.1, 0.9, 1.3, 1.7, 2.1, 2.5]) holes.push([-1.25 + c * 0.5, z - 0.5]);
  return (
    <group rotation={[0.9, 0, 0]}>
      <mesh position={[0, -0.15, 0]}><boxGeometry args={[3.2, 0.3, 5.2]} /><meshStandardMaterial color="#ebe6da" roughness={0.75} /></mesh>
      <mesh position={[0, 0.005, 0]}><boxGeometry args={[3.1, 0.02, 0.3]} /><meshStandardMaterial color="#d3ccbd" /></mesh>
      {holes.map(([x, z], i) => <mesh key={i} position={[x, 0.01, z]}><boxGeometry args={[0.16, 0.02, 0.16]} /><meshBasicMaterial color="#3b3530" /></mesh>)}
      {/* one strip of five, lit */}
      <mesh position={[-0.75, 0.02, -1.4]}><boxGeometry args={[0.3, 0.02, 1.9]} /><meshBasicMaterial color="#0078bf" transparent opacity={0.45} /></mesh>
      {/* the rails */}
      {[['#c0392b', -2.35], ['#2f6fe0', -2.15]].map(([c, z]) => <mesh key={z as number} position={[0, 0.01, z as number]}><boxGeometry args={[3, 0.02, 0.04]} /><meshBasicMaterial color={c as string} /></mesh>)}
      <Callout n={1} at={[-0.75, 0.3, -1.4]} label={labels[0]!} />
      <Callout n={2} at={[1.1, 0.3, -0.1]} label={labels[1]!} />
      <Callout n={3} at={[0.6, 0.3, -2.3]} label={labels[2]!} />
    </group>
  );
}

function Capacitor({ labels }: { labels: string[] }) {
  return (
    <group position={[0, 0.8, 0]}>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.6, 0.6, 1.6, 40]} /><meshStandardMaterial color="#2f6fc0" roughness={0.45} /></mesh>
      {/* the stripe on the − side */}
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.605, 0.605, 1.58, 40, 1, true, Math.PI * 0.35, Math.PI * 0.4]} /><meshStandardMaterial color="#d6dde6" roughness={0.5} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.61, 0]}><cylinderGeometry args={[0.58, 0.58, 0.02, 40]} /><meshStandardMaterial {...METAL} /></mesh>
      <Leg x={-0.2} len={2.4} />
      <Leg x={0.2} len={1.9} />
      <Callout n={1} at={[0.75, 1.0, 0.3]} label={labels[0]!} />
      <Callout n={2} at={[-0.85, -1.4, 0]} label={labels[1]!} />
      <Callout n={3} at={[0, 2.0, 0]} label={labels[2]!} />
    </group>
  );
}

function Button({ labels }: { labels: string[] }) {
  return (
    <group position={[0, 0.3, 0]} rotation={[0.5, 0, 0]}>
      <mesh><boxGeometry args={[1.2, 0.35, 1.2]} /><meshStandardMaterial color="#222" roughness={0.5} /></mesh>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.35, 0.35, 0.3, 32]} /><meshStandardMaterial color="#0078bf" roughness={0.4} /></mesh>
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z]) => <Leg key={`${x}${z}`} x={x!} z={z!} len={0.9} />)}
      <Callout n={1} at={[0, 0.8, 0]} label={labels[0]!} />
      <Callout n={2} at={[0.9, -0.3, 0]} label={labels[1]!} />
    </group>
  );
}

function Battery({ labels }: { labels: string[] }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh><cylinderGeometry args={[0.7, 0.7, 3.2, 40]} /><meshStandardMaterial color="#1e1e1e" roughness={0.5} /></mesh>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.705, 0.705, 1.2, 40]} /><meshStandardMaterial color="#e57b23" roughness={0.5} /></mesh>
      <mesh position={[0, 1.7, 0]}><cylinderGeometry args={[0.25, 0.3, 0.25, 24]} /><meshStandardMaterial {...METAL} /></mesh>
      <mesh position={[0, -1.62, 0]}><cylinderGeometry args={[0.55, 0.55, 0.06, 32]} /><meshStandardMaterial {...METAL} /></mesh>
      <Callout n={1} at={[0, 2.2, 0]} label={labels[0]!} />
      <Callout n={2} at={[0, -2.1, 0]} label={labels[1]!} />
      <Callout n={3} at={[0.9, 0, 0]} label={labels[2]!} />
    </group>
  );
}

function Meter({ labels }: { labels: string[] }) {
  return (
    <group scale={16} rotation={[0.9, 0, 0]} position={[0, 0, 0]}>
      <group position={[0, 0, 0]}>
        <Multimeter reading={{ text: '5.000', unit: 'V', value: 5 }} mode="V" onMode={() => {}} interactive={false} />
      </group>
      <Callout n={1} at={[-0.018, 0.045, 0.066]} label={labels[0]!} />
      <Callout n={2} at={[0.018, 0.05, 0.066]} label={labels[1]!} />
      <Callout n={3} at={[-0.03, 0.04, -0.0]} label={labels[2]!} />
      <Callout n={4} at={[0.035, 0.04, 0.03]} label={labels[3]!} />
    </group>
  );
}

function Turntable({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    // A gentle swing rather than a full spin, so the callouts stay on the side they label.
    g.current.rotation.y = reducedMotion() ? 0 : Math.sin(clock.elapsedTime * 0.5) * 0.45;
  });
  return <group ref={g}>{children}</group>;
}

export function PartModel({ part, labels }: { part: PartId; labels: string[] }) {
  const model = {
    led: <Led labels={labels} />, resistor: <Resistor labels={labels} />, breadboard: <BoardPatch labels={labels} />,
    capacitor: <Capacitor labels={labels} />, button: <Button labels={labels} />, multimeter: <Meter labels={labels} />,
    battery: <Battery labels={labels} />,
  }[part];
  const layer = useRef<HTMLDivElement>(null);
  return (
    <div className="part-model">
      <Canvas camera={{ position: [0, -0.2, 11], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true }}>
        <ambientLight intensity={0.9} color="#fff4e6" />
        <directionalLight position={[3, 5, 6]} intensity={1.6} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#bcd8ff" />
        <CalloutLayer.Provider value={layer}><Turntable>{model}</Turntable></CalloutLayer.Provider>
      </Canvas>
      <div ref={layer} className="callout-layer" />
    </div>
  );
}
