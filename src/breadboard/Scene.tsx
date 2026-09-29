/**
 * 3D breadboard scene. Pure view: reads the bench store and the latest analysis,
 * and reports hole hovers/clicks and part clicks back to the store.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { colorBands } from './colorCode';
import { BOARD, HOLES, hole, type HoleId } from './layout';
import { useLive } from './live';
import { isElectrolytic, LED_MAX_AMPS, type BoardAnalysis, type BoardPart, type BoardState } from './model';
import { buildFlow, sourceColors } from './flow';
import { FlowParticles, RideElectron } from './FlowScene';
import { translateParts } from './move';
import { PartMotion } from './PartMotion';
import { CAP_Y, ledMid, supplyLeadCurve, wireCurve, SUPPLY_BOX, SUPPLY_HOLES } from './paths';
import { useBench } from './store';

const LED_HEX = { red: '#ff3b30', yellow: '#ffd60a', green: '#39ff88', blue: '#3a8bff', white: '#f5f5ff' } as const;
const SIGNAL = new THREE.Color('#39ff88');
const AMBER = '#ffb000';
const FAULT = '#ff2e88';
const Y_AXIS = new THREE.Vector3(0, 1, 0);

type V3 = [number, number, number];

/**
 * Two looks for the same board: the phosphor bench (dark green, glowing strips) and the desk
 * (a real white breadboard under a warm lamp, strips tinted riso blue).
 */
export type BoardLook = 'phosphor' | 'desk';
const LOOKS = {
  phosphor: { body: '#1b2d23', channel: '#0b140f', hole: '#010302', strip: '#2a6b4a', hot: SIGNAL, mark: '#39ff88' },
  desk: { body: '#ebe6da', channel: '#d3ccbd', hole: '#3b3530', strip: '#c9c2b3', hot: new THREE.Color('#0078bf'), mark: '#ff48b0' },
} as const;
const LookContext = createContext<BoardLook>('phosphor');
const useLook = () => LOOKS[useContext(LookContext)];
const at = (id: HoleId, y = 0): V3 => { const h = hole(id); return [h.x, y, h.z]; };

/** A cylinder stretched between two points. */
function Segment({ from, to, r = 0.045, color = '#b9c2bd', emissive }: { from: V3; to: V3; r?: number; color?: string; emissive?: string }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    return {
      pos: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d.clone().normalize()),
      len: d.length(),
    };
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} emissive={emissive ?? '#000'} />
    </mesh>
  );
}

// ---------------------------------------------------------------- board

/** Board group: everything below is in board units, whatever the board's scale and place in the scene. */
let boardRoot: THREE.Object3D | null = null;
/** An event's hit point in board units. */
function boardPoint(e: ThreeEvent<PointerEvent | MouseEvent>): THREE.Vector3 {
  return boardRoot ? boardRoot.worldToLocal(e.point.clone()) : e.point.clone();
}

/** Largest source voltage on the board, for scaling the strip glow. */
function boardVref(b: BoardState): number {
  let v = b.supply.on ? b.supply.volts : 0;
  for (const p of b.parts) {
    if (p.kind === 'battery') v = Math.max(v, p.volts ?? 0);
    if (p.kind === 'generator' && p.wave) v = Math.max(v, Math.abs(p.wave.offset) + p.wave.vpp / 2);
  }
  return Math.max(v, 0.1);
}

function Board({ analysis, dynamic }: { analysis: BoardAnalysis; dynamic: boolean }) {
  const { hover, showStrips, supply, parts, pending, tool } = useBench();
  const live = useLive((st) => (dynamic ? st.result : null));
  const vref = boardVref({ supply, parts });
  const voltageAt = (h: HoleId) => (live?.ok ? live.nodeVoltages[analysis.nodeOf(h)] : analysis.voltageAt(h));
  const setHover = useBench((s) => s.setHover);
  const clickHole = useBench((s) => s.clickHole);

  // One glow bar per internal strip, brightness following its voltage.
  const strips = useMemo(() => {
    const m = new Map<string, { xs: number[]; zs: number[] }>();
    for (const h of HOLES) {
      const e = m.get(h.strip) ?? { xs: [], zs: [] };
      e.xs.push(h.x); e.zs.push(h.z); m.set(h.strip, e);
    }
    return [...m.entries()].map(([strip, { xs, zs }]) => {
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      return { strip, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0 + 0.5, d: z1 - z0 + 0.5, sample: HOLES.find((h) => h.strip === strip)!.id };
    });
  }, []);
  const hoverStrip = hover ? hole(hover).strip : null;
  const look = useLook();

  const holeMatrices = useMemo(() => {
    const m = new THREE.Object3D();
    return HOLES.map((h) => { m.position.set(h.x, 0.011, h.z); m.updateMatrix(); return m.matrix.clone(); });
  }, []);

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    // Holes are in board units: bring the hit point into the board's own frame (the desk scales and moves the board).
    const p = boardPoint(e);
    let best: HoleId | null = null;
    let bestD = 0.75;
    for (const h of HOLES) {
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < bestD) { bestD = d; best = h.id; }
    }
    return best;
  };

  return (
    <group>
      <mesh position={[0, -BOARD.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[BOARD.width, BOARD.thickness, BOARD.depth]} />
        <meshStandardMaterial color={look.body} roughness={0.75} />
      </mesh>
      {/* centre channel and rail stripes */}
      <mesh position={[0, 0.004, 0]}><boxGeometry args={[BOARD.width - 1, 0.01, 0.6]} /><meshStandardMaterial color={look.channel} roughness={0.8} /></mesh>
      {/* rail markings: red beside the + rails, blue beside the - rails */}
      {[[-6.45, '#c0392b'], [-8.55, '#2f6fe0'], [6.45, '#c0392b'], [8.55, '#2f6fe0']].map(([z, c]) => (
        <mesh key={z as number} position={[0, 0.006, z as number]}>
          <boxGeometry args={[BOARD.width - 2, 0.004, 0.05]} />
          <meshBasicMaterial color={c as string} />
        </mesh>
      ))}
      {strips.map((s) => {
        const v = voltageAt(s.sample);
        const level = v === undefined ? 0 : Math.min(1, Math.abs(v) / vref);
        const hot = s.strip === hoverStrip;
        const color = hot ? look.hot : new THREE.Color(look.strip).lerp(look.hot, showStrips ? level * 0.85 : 0);
        return (
          <mesh key={s.strip} position={[s.cx, 0.006, s.cz]}>
            <boxGeometry args={[s.w, 0.006, s.d]} />
            <meshBasicMaterial color={color} transparent opacity={hot ? 0.6 : showStrips ? 0.3 + level * 0.5 : 0.28} toneMapped={false} />
          </mesh>
        );
      })}
      <instancedMesh args={[undefined, undefined, HOLES.length]} ref={(m) => { if (m) holeMatrices.forEach((mat, i) => m.setMatrixAt(i, mat)); if (m) m.instanceMatrix.needsUpdate = true; }}>
        <boxGeometry args={[0.3, 0.02, 0.3]} />
        <meshBasicMaterial color={look.hole} />
      </instancedMesh>
      {/* invisible hit plane for picking the nearest hole */}
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => { e.stopPropagation(); const h = pick(e); if (h !== hover) setHover(h); }}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => { e.nativeEvent.preventDefault(); const st = useBench.getState(); if (st.moving) st.cancelMove(); st.closeMenu(); }}
        onClick={(e) => { e.stopPropagation(); const h = pick(e); if (h) clickHole(h); else if (tool === 'select') useBench.getState().select(null); }}
      >
        <planeGeometry args={[BOARD.width, BOARD.depth]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hover && (
        <mesh position={at(hover, 0.03)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.3, 24]} />
          <meshBasicMaterial color={look.mark} toneMapped={false} />
        </mesh>
      )}
      {pending && (
        <>
          <mesh position={at(pending, 0.03)} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.34, 24]} />
            <meshBasicMaterial color={AMBER} toneMapped={false} />
          </mesh>
          {hover && hover !== pending && <Segment from={at(pending, 0.1)} to={at(hover, 0.1)} r={0.03} color={AMBER} emissive={AMBER} />}
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- parts

/** Left click selects, right click opens the part menu (anchored at the nearest leg). */
function usePartHandlers(part: BoardPart) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const st = useBench.getState();
      if (st.tool !== 'select' || st.moving) return;
      e.stopPropagation();
      st.select(part.id);
    },
    onContextMenu: (e: ThreeEvent<MouseEvent>) => {
      const st = useBench.getState();
      if (st.moving) return;
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      const p = boardPoint(e);
      const d = (h: HoleId) => { const i = hole(h); return Math.hypot(i.x - p.x, i.z - p.z); };
      const anchor = d(part.h1) <= d(part.h2) ? part.h1 : part.h2;
      st.openMenu(part.id, e.nativeEvent.clientX, e.nativeEvent.clientY, anchor);
    },
  };
}

function Resistor({ part, mark }: { part: BoardPart; mark?: string }) {
  const handlers = usePartHandlers(part);
  const a = new THREE.Vector3(...at(part.h1)), b = new THREE.Vector3(...at(part.h2));
  const dir = b.clone().sub(a);
  const dist = dir.length();
  const bodyLen = Math.min(2.0, Math.max(dist - 0.5, 0.6));
  const y = 0.55;
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const u = dir.clone().normalize();
  const e1 = mid.clone().addScaledVector(u, -bodyLen / 2), e2 = mid.clone().addScaledVector(u, bodyLen / 2);
  const quat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, u);
  const bands = colorBands(part.ohms ?? 1000).colors;
  const bandPos = [-0.32, -0.16, 0, 0.3];
  return (
    <group {...handlers}>
      <Segment from={[a.x, 0, a.z]} to={[a.x, y, a.z]} />
      <Segment from={[a.x, y, a.z]} to={[e1.x, y, e1.z]} />
      <Segment from={[b.x, 0, b.z]} to={[b.x, y, b.z]} />
      <Segment from={[b.x, y, b.z]} to={[e2.x, y, e2.z]} />
      <group position={[mid.x, y, mid.z]} quaternion={quat}>
        <mesh>
          <capsuleGeometry args={[0.2, bodyLen - 0.4, 6, 14]} />
          <meshStandardMaterial color="#d8c39a" roughness={0.6} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.45 : 0} />
        </mesh>
        {bands.map((c, i) => (
          <mesh key={i} position={[0, bandPos[i]! * (bodyLen / 1.2), 0]}>
            <cylinderGeometry args={[0.215, 0.215, 0.08, 18]} />
            <meshStandardMaterial color={c} roughness={0.5} metalness={c === '#c9a227' ? 0.7 : 0} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Led({ part, mark, amps: dcAmps, dynamic }: { part: BoardPart; mark?: string; amps: number; dynamic: boolean }) {
  const handlers = usePartHandlers(part);
  // On a changing board the LED shows its average current, the way your eye averages a fast blink.
  const liveAmps = useLive((st) => (dynamic ? st.avgCurrents[part.id] ?? 0 : null));
  const amps = liveAmps ?? dcAmps;
  const a = at(part.h1), b = at(part.h2);
  const mid: V3 = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
  const color = LED_HEX[part.color ?? 'red'];
  const level = part.burnt ? 0 : Math.min(1, Math.max(0, amps) / (LED_MAX_AMPS * 0.66));
  const bodyColor = part.burnt ? '#2a2326' : color;
  return (
    <group {...handlers}>
      <Segment from={a} to={[mid[0] - 0.1, 0.9, mid[2]]} />
      <Segment from={b} to={[mid[0] + 0.1, 0.8, mid[2]]} />
      <mesh position={[mid[0], 1.15, mid[2]]}>
        <cylinderGeometry args={[0.34, 0.38, 0.55, 24]} />
        <meshStandardMaterial color={bodyColor} transparent opacity={0.85} emissive={part.burnt ? FAULT : color} emissiveIntensity={part.burnt ? 0.15 : 0.05 + level * 3} toneMapped={false} />
      </mesh>
      <mesh position={[mid[0], 1.42, mid[2]]}>
        <sphereGeometry args={[0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={bodyColor} transparent opacity={0.85} emissive={part.burnt ? FAULT : color} emissiveIntensity={part.burnt ? 0.15 : 0.05 + level * 3} toneMapped={false} />
      </mesh>
      {mark && (
        <mesh position={[mid[0], 0.03, mid[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={mark} toneMapped={false} />
        </mesh>
      )}
      {level > 0.02 && (
        <mesh position={[mid[0], 1.3, mid[2]]}>
          <sphereGeometry args={[0.55 + level * 0.6, 20, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.12 + level * 0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {level > 0.02 && <pointLight position={[mid[0], 1.6, mid[2]]} color={color} intensity={level * 6} distance={6} decay={2} />}
    </group>
  );
}

function Wire({ part, mark }: { part: BoardPart; mark?: string }) {
  const handlers = usePartHandlers(part);
  const geom = useMemo(() => new THREE.TubeGeometry(wireCurve(part.h1, part.h2), 48, 0.07, 8, false), [part.h1, part.h2]);
  return (
    <mesh geometry={geom} {...handlers}>
      <meshStandardMaterial color={part.wireColor ?? '#e8413c'} roughness={0.5} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.6 : 0} />
    </mesh>
  );
}

function Button({ part, mark }: { part: BoardPart; mark?: string }) {
  const handlers = usePartHandlers(part);
  const tool = useBench((s) => s.tool);
  const select = useBench((s) => s.select);
  const togglePress = useBench((s) => s.togglePress);
  const a = at(part.h1), b = at(part.h2);
  const mid: V3 = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
  const down = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== 'select' || e.nativeEvent.button !== 0 || useBench.getState().moving) return;
    e.stopPropagation();
    select(part.id);
    togglePress(part.id, true);
    const up = () => { togglePress(part.id, false); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointerup', up);
  };
  return (
    <group onPointerDown={down} onContextMenu={handlers.onContextMenu}>
      <Segment from={a} to={[a[0], 0.25, a[2]]} />
      <Segment from={b} to={[b[0], 0.25, b[2]]} />
      <mesh position={[mid[0], 0.3, mid[2]]}>
        <boxGeometry args={[Math.max(1.0, Math.abs(b[0] - a[0]) + 0.4), 0.3, Math.max(1.0, Math.abs(b[2] - a[2]) + 0.4)]} />
        <meshStandardMaterial color="#1a1f1c" roughness={0.7} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.35 : 0} />
      </mesh>
      <mesh position={[mid[0], part.pressed ? 0.5 : 0.62, mid[2]]}>
        <cylinderGeometry args={[0.26, 0.26, 0.3, 20]} />
        <meshStandardMaterial color={part.pressed ? '#39ff88' : '#2b332e'} emissive={part.pressed ? '#39ff88' : '#000'} emissiveIntensity={part.pressed ? 1.2 : 0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Battery({ part, mark, color }: { part: BoardPart; mark?: string; color: string }) {
  const handlers = usePartHandlers(part);
  const a = at(part.h1), b = at(part.h2);
  const m = ledMid(part);
  const y = 0.9;
  return (
    <group {...handlers}>
      <Segment from={a} to={[a[0], 0.5, a[2]]} color="#e8413c" />
      <Segment from={[a[0], 0.5, a[2]]} to={[m[0] - 0.5, y, m[2]]} color="#e8413c" />
      <Segment from={b} to={[b[0], 0.5, b[2]]} color="#222" />
      <Segment from={[b[0], 0.5, b[2]]} to={[m[0] + 0.5, y, m[2]]} color="#222" />
      <mesh position={[m[0], y, m[2]]}>
        <boxGeometry args={[1.5, 0.8, 0.8]} />
        <meshStandardMaterial color="#15191a" roughness={0.5} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.4 : 0} />
      </mesh>
      <mesh position={[m[0], y + 0.41, m[2]]}>
        <boxGeometry args={[1.2, 0.02, 0.5]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[m[0] - 0.62, y, m[2]]}>
        <boxGeometry args={[0.2, 0.84, 0.84]} />
        <meshStandardMaterial color="#c87533" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Capacitor({ part, mark }: { part: BoardPart; mark?: string }) {
  const handlers = usePartHandlers(part);
  const a = at(part.h1), b = at(part.h2);
  const m = ledMid(part);
  const dir = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]);
  const yaw = Math.atan2(-dir.z, dir.x);
  if (isElectrolytic(part)) {
    // Upright can with a light stripe down the − side (h2), like a real electrolytic.
    const big = (part.farads ?? 0) >= 100e-6;
    const r = big ? 0.42 : 0.3, h = big ? 1.3 : 0.95;
    return (
      <group {...handlers}>
        <Segment from={a} to={[m[0] - 0.12, 0.25, m[2]]} />
        <Segment from={b} to={[m[0] + 0.12, 0.25, m[2]]} />
        <group position={[m[0], 0.25 + h / 2, m[2]]} rotation={[0, yaw, 0]}>
          <mesh>
            <cylinderGeometry args={[r, r, h, 28]} />
            <meshStandardMaterial color="#1d3f8f" roughness={0.45} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.45 : 0} />
          </mesh>
          <mesh position={[r * 0.72, 0, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[r * 0.6, h * 1.002, r * 0.55]} />
            <meshStandardMaterial color="#c9d3e6" roughness={0.5} />
          </mesh>
          <mesh position={[0, h / 2 + 0.005, 0]}>
            <cylinderGeometry args={[r * 0.96, r * 0.96, 0.01, 28]} />
            <meshStandardMaterial color="#9aa3ad" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      </group>
    );
  }
  // Ceramic disc on two legs.
  return (
    <group {...handlers}>
      <Segment from={a} to={[a[0], 0.35, a[2]]} />
      <Segment from={[a[0], 0.35, a[2]]} to={[m[0] - 0.12, CAP_Y, m[2]]} />
      <Segment from={b} to={[b[0], 0.35, b[2]]} />
      <Segment from={[b[0], 0.35, b[2]]} to={[m[0] + 0.12, CAP_Y, m[2]]} />
      <mesh position={[m[0], CAP_Y + 0.28, m[2]]} rotation={[Math.PI / 2, 0, yaw + Math.PI / 2]}>
        <cylinderGeometry args={[0.38, 0.38, 0.16, 28]} />
        <meshStandardMaterial color="#d98a2b" roughness={0.55} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.45 : 0} />
      </mesh>
    </group>
  );
}

function Generator({ part, mark, color }: { part: BoardPart; mark?: string; color: string }) {
  const handlers = usePartHandlers(part);
  const a = at(part.h1), b = at(part.h2);
  const m = ledMid(part);
  const y = 1.1;
  // little waveform icon on the lid, in the source's colour
  const icon = useMemo(() => {
    const shape = part.wave?.shape ?? 'square';
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, ph = (u * 2) % 1;
      const v = shape === 'sine' ? Math.sin(ph * Math.PI * 2) : shape === 'triangle' ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : ph < 0.5 ? 1 : -1;
      pts.push(new THREE.Vector3(-0.55 + u * 1.1, 0, -v * 0.16));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 80, 0.025, 4, false);
  }, [part.wave?.shape]);
  return (
    <group {...handlers}>
      <Segment from={a} to={[a[0], 0.6, a[2]]} color="#e8413c" />
      <Segment from={[a[0], 0.6, a[2]]} to={[m[0] - 0.6, y, m[2]]} color="#e8413c" />
      <Segment from={b} to={[b[0], 0.6, b[2]]} color="#222" />
      <Segment from={[b[0], 0.6, b[2]]} to={[m[0] + 0.6, y, m[2]]} color="#222" />
      <mesh position={[m[0], y, m[2]]}>
        <boxGeometry args={[1.8, 0.8, 1.0]} />
        <meshStandardMaterial color="#141a17" roughness={0.5} emissive={mark ?? '#000'} emissiveIntensity={mark ? 0.4 : 0} />
      </mesh>
      <mesh geometry={icon} position={[m[0], y + 0.42, m[2]]}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Oscilloscope probe tip with a coloured hook, clipped onto a hole. */
function ScopeProbe({ h, color, label }: { h: HoleId; color: string; label: string }) {
  const p = at(h);
  return (
    <group position={[p[0], 0, p[2]]}>
      <mesh position={[0, 0.35, 0]}>
        <torusGeometry args={[0.16, 0.035, 8, 20, Math.PI * 1.4]} />
        <meshStandardMaterial color="#d0d4d2" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0.25, 1.35, -0.2]} rotation={[0.25, 0, -0.25]}>
        <cylinderGeometry args={[0.15, 0.12, 1.8, 14]} />
        <meshStandardMaterial color="#1b211e" roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.62, -0.08]} rotation={[0.25, 0, -0.25]}>
        <cylinderGeometry args={[0.17, 0.17, 0.12, 14]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0.45, 2.4, -0.45]} name={label}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Supply({ analysis }: { analysis: BoardAnalysis }) {
  const supply = useBench((s) => s.supply);
  const shorted = analysis.result.faults.some((f) => f.kind === 'short-circuit');
  const box = SUPPLY_BOX;
  const lead = (to: string, color: string, dx: number) => {
    const g = new THREE.TubeGeometry(supplyLeadCurve(to, dx), 40, 0.08, 8, false);
    return <mesh geometry={g}><meshStandardMaterial color={color} roughness={0.5} /></mesh>;
  };
  const glow = shorted ? FAULT : supply.on ? '#39ff88' : '#1a2a20';
  return (
    <group>
      <mesh position={box}>
        <boxGeometry args={[3.2, 1.2, 1.8]} />
        <meshStandardMaterial color="#111814" roughness={0.6} />
      </mesh>
      <mesh position={[box[0], box[1] + 0.61, box[2]]}>
        <boxGeometry args={[2.4, 0.02, 0.8]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {lead(SUPPLY_HOLES.plus, '#e8413c', 0.7)}
      {lead(SUPPLY_HOLES.minus, '#1b1b1b', -0.7)}
    </group>
  );
}

function Probe({ h, color }: { h: HoleId; color: string }) {
  const p = at(h);
  return (
    <group position={[p[0], 0, p[2]]}>
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.5, 12]} />
        <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 1.7, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- scene

/** Dev only: lets browser tests find a hole's position on screen, to click it like a player. */
function DevProject() {
  const { camera, size, gl } = useThree();
  useEffect(() => {
    const w = window as unknown as { __signalPathProject?: (id: HoleId) => [number, number] };
    w.__signalPathProject = (id) => {
      const h = hole(id);
      const v = new THREE.Vector3(h.x, 0.02, h.z).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * size.width, r.top + ((1 - v.y) / 2) * size.height];
    };
  }, [camera, size, gl]);
  return null;
}

/** Camera looks at the board from above and in front, along this direction. */
const VIEW_DIR = new THREE.Vector3(0, 22, 17).normalize();

/**
 * Frame the whole board (and the bench supply) whatever shape the stage has: a wide, short
 * stage with the scope open needs a different distance from a tall one without it.
 */
function FitCamera() {
  const { camera, size } = useThree();
  const view = useBench((s) => s.view);
  useEffect(() => {
    if (view === 'ride' || !(camera instanceof THREE.PerspectiveCamera)) return;
    const v = THREE.MathUtils.degToRad(camera.fov) / 2;
    const h = Math.atan(Math.tan(v) * (size.width / Math.max(1, size.height)));
    const dist = Math.max(18.5 / Math.tan(h), 12.5 / Math.tan(v));
    camera.position.copy(VIEW_DIR).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height, view]);
  return null;
}

/** Everything on the board (board, supply, parts, probes, flow), without a canvas, camera or lights. */
export function BreadboardContents({ analysis, dynamic, look = 'phosphor', supplyBox = true }: {
  analysis: BoardAnalysis; dynamic: boolean; look?: BoardLook; supplyBox?: boolean;
}) {
  const parts = useBench((s) => s.parts);
  const selected = useBench((s) => s.selected);
  const probes = useBench((s) => s.probes);
  const scopeProbes = useBench((s) => s.scopeProbes);
  const moving = useBench((s) => s.moving);
  const hover = useBench((s) => s.hover);
  const view = useBench((s) => s.view);
  const supply = useBench((s) => s.supply);
  const currents = analysis.result.currents;
  const board = useMemo(() => ({ supply, parts }), [supply, parts]);
  const edges = useMemo(() => (view === 'build' ? [] : buildFlow(board, analysis)), [view, board, analysis]);
  const colors = useMemo(() => sourceColors(board), [board]);

  // While moving, draw the parts where they'd land, tinted green (ok) or magenta (blocked).
  const preview = useMemo(() => {
    if (!moving || !hover) return null;
    return translateParts(parts, moving.ids, moving.anchor, hover, moving.mode);
  }, [parts, moving, hover]);
  const shown = preview?.parts ?? parts;
  const movingIds = new Set(moving?.ids ?? []);
  const markOf = (id: string) =>
    movingIds.has(id) ? (preview && !preview.valid ? FAULT : '#39ff88') : id === selected ? (look === 'desk' ? '#ff48b0' : AMBER) : undefined;
  return (
    <LookContext.Provider value={look}>
      <group ref={(g) => { if (g) boardRoot = g; }} />
      <Board analysis={analysis} dynamic={dynamic} />
      {supplyBox && <Supply analysis={analysis} />}
      {shown.map((p) => {
        const mark = markOf(p.id);
        let el: ReactNode = null;
        switch (p.kind) {
          case 'resistor': el = <Resistor part={p} mark={mark} />; break;
          case 'led': el = <Led part={p} mark={mark} amps={movingIds.has(p.id) ? 0 : currents[p.id] ?? 0} dynamic={dynamic && !movingIds.has(p.id)} />; break;
          case 'wire': el = <Wire part={p} mark={mark} />; break;
          case 'button': el = <Button part={p} mark={mark} />; break;
          case 'battery': el = <Battery part={p} mark={mark} color={colors[p.id] ?? '#3ad7ff'} />; break;
          case 'capacitor': el = <Capacitor part={p} mark={mark} />; break;
          case 'generator': el = <Generator part={p} mark={mark} color={colors[p.id] ?? '#ffb000'} />; break;
        }
        // Parts being dragged follow the pointer as they are; everything else animates its moves.
        return <PartMotion key={p.id} part={p} still={movingIds.has(p.id)}>{el}</PartMotion>;
      })}
      {view === 'flow' && <FlowParticles edges={edges} colors={colors} />}
      {view === 'ride' && (
        <>
          <FlowParticles edges={edges} colors={colors} size={0.045} />
          <RideElectron edges={edges} analysis={analysis} colors={colors} parts={parts} />
        </>
      )}
      {probes.red && <Probe h={probes.red} color="#e8413c" />}
      {probes.black && <Probe h={probes.black} color="#222" />}
      {scopeProbes.ch1 && <ScopeProbe h={scopeProbes.ch1} color="#39ff88" label="CH1" />}
      {scopeProbes.ch2 && <ScopeProbe h={scopeProbes.ch2} color="#3ad7ff" label="CH2" />}
    </LookContext.Provider>
  );
}

export function BreadboardScene({ analysis, dynamic }: { analysis: BoardAnalysis; dynamic: boolean }) {
  const view = useBench((s) => s.view);
  const dim = view !== 'build';
  return (
    <Canvas camera={{ position: [0, 22, 17], fov: 40 }} dpr={[1, 2]} shadows={false}>
      <color attach="background" args={['#030604']} />
      <fog attach="fog" args={['#030604', 70, 130]} />
      <ambientLight intensity={dim ? 0.35 : 0.9} />
      <hemisphereLight args={['#c8ffe0', '#0a140e', dim ? 0.25 : 0.6]} />
      <directionalLight position={[8, 20, 10]} intensity={dim ? 0.6 : 1.6} />
      <directionalLight position={[-10, 8, -6]} intensity={0.35} color="#7fffc4" />
      <gridHelper args={[80, 40, '#123824', '#0c2418']} position={[0, -BOARD.thickness - 0.01, 0]} />
      <BreadboardContents analysis={analysis} dynamic={dynamic} />
      <FitCamera />
      {import.meta.env.DEV && <DevProject />}
      <OrbitControls makeDefault enabled={view !== 'ride'} enablePan target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.3} minDistance={8} maxDistance={60} />
    </Canvas>
  );
}
