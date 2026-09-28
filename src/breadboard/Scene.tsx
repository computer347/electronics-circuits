/**
 * 3D breadboard scene. Pure view: reads the bench store and the latest analysis,
 * and reports hole hovers/clicks and part clicks back to the store.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { colorBands } from './colorCode';
import { BOARD, HOLES, hole, type HoleId } from './layout';
import { LED_MAX_AMPS, type BoardAnalysis, type BoardPart } from './model';
import { translateParts } from './move';
import { useBench } from './store';

const LED_HEX = { red: '#ff3b30', yellow: '#ffd60a', green: '#39ff88', blue: '#3a8bff', white: '#f5f5ff' } as const;
const SIGNAL = new THREE.Color('#39ff88');
const AMBER = '#ffb000';
const FAULT = '#ff2e88';
const Y_AXIS = new THREE.Vector3(0, 1, 0);

type V3 = [number, number, number];
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

function Board({ analysis }: { analysis: BoardAnalysis }) {
  const { hover, showStrips, supply, pending, tool } = useBench();
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

  const holeMatrices = useMemo(() => {
    const m = new THREE.Object3D();
    return HOLES.map((h) => { m.position.set(h.x, 0.011, h.z); m.updateMatrix(); return m.matrix.clone(); });
  }, []);

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    let best: HoleId | null = null;
    let bestD = 0.75;
    for (const h of HOLES) {
      const d = Math.hypot(h.x - e.point.x, h.z - e.point.z);
      if (d < bestD) { bestD = d; best = h.id; }
    }
    return best;
  };

  return (
    <group>
      <mesh position={[0, -BOARD.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[BOARD.width, BOARD.thickness, BOARD.depth]} />
        <meshStandardMaterial color="#1b2d23" roughness={0.75} />
      </mesh>
      {/* centre channel and rail stripes */}
      <mesh position={[0, 0.004, 0]}><boxGeometry args={[BOARD.width - 1, 0.01, 0.6]} /><meshBasicMaterial color="#0b140f" /></mesh>
      {/* rail markings: red beside the + rails, blue beside the - rails */}
      {[[-6.45, '#c0392b'], [-8.55, '#2f6fe0'], [6.45, '#c0392b'], [8.55, '#2f6fe0']].map(([z, c]) => (
        <mesh key={z as number} position={[0, 0.006, z as number]}>
          <boxGeometry args={[BOARD.width - 2, 0.004, 0.05]} />
          <meshBasicMaterial color={c as string} />
        </mesh>
      ))}
      {strips.map((s) => {
        const v = analysis.voltageAt(s.sample);
        const level = v === undefined || !supply.on ? 0 : Math.min(1, Math.abs(v) / Math.max(supply.volts, 0.1));
        const hot = s.strip === hoverStrip;
        const color = hot ? SIGNAL : new THREE.Color('#2a6b4a').lerp(SIGNAL, showStrips ? level * 0.85 : 0);
        return (
          <mesh key={s.strip} position={[s.cx, 0.006, s.cz]}>
            <boxGeometry args={[s.w, 0.006, s.d]} />
            <meshBasicMaterial color={color} transparent opacity={hot ? 0.6 : showStrips ? 0.3 + level * 0.5 : 0.28} toneMapped={false} />
          </mesh>
        );
      })}
      <instancedMesh args={[undefined, undefined, HOLES.length]} ref={(m) => { if (m) holeMatrices.forEach((mat, i) => m.setMatrixAt(i, mat)); if (m) m.instanceMatrix.needsUpdate = true; }}>
        <boxGeometry args={[0.3, 0.02, 0.3]} />
        <meshBasicMaterial color="#010302" />
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
          <meshBasicMaterial color={SIGNAL} toneMapped={false} />
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
      const d = (h: HoleId) => { const i = hole(h); return Math.hypot(i.x - e.point.x, i.z - e.point.z); };
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

function Led({ part, mark, amps }: { part: BoardPart; mark?: string; amps: number }) {
  const handlers = usePartHandlers(part);
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
  const geom = useMemo(() => {
    const a = new THREE.Vector3(...at(part.h1, -0.2)), b = new THREE.Vector3(...at(part.h2, -0.2));
    const lift = 0.5 + a.distanceTo(b) * 0.18;
    const a2 = a.clone().setY(0.35), b2 = b.clone().setY(0.35);
    const c = a2.clone().add(b2).multiplyScalar(0.5).setY(lift);
    const curve = new THREE.CurvePath<THREE.Vector3>();
    curve.add(new THREE.LineCurve3(a, a2));
    curve.add(new THREE.QuadraticBezierCurve3(a2, c, b2));
    curve.add(new THREE.LineCurve3(b2, b));
    return new THREE.TubeGeometry(curve, 48, 0.07, 8, false);
  }, [part.h1, part.h2]);
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

function Supply({ analysis }: { analysis: BoardAnalysis }) {
  const supply = useBench((s) => s.supply);
  const shorted = analysis.result.faults.some((f) => f.kind === 'short-circuit');
  const plus = at('T+:1', -0.2), minus = at('T-:1', -0.2);
  const box: V3 = [-13.2, 0.5, -11.8];
  const lead = (to: V3, color: string, dx: number) => {
    const from = new THREE.Vector3(box[0] + dx, 0.6, box[2] + 0.9);
    const end = new THREE.Vector3(...to);
    const c = from.clone().add(end).multiplyScalar(0.5).setY(1.6);
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([from, c, end.clone().setY(0.4), end]), 40, 0.08, 8, false);
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
      {lead(plus, '#e8413c', 0.7)}
      {lead(minus, '#1b1b1b', -0.7)}
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

export function BreadboardScene({ analysis }: { analysis: BoardAnalysis }) {
  const parts = useBench((s) => s.parts);
  const selected = useBench((s) => s.selected);
  const probes = useBench((s) => s.probes);
  const moving = useBench((s) => s.moving);
  const hover = useBench((s) => s.hover);
  const currents = analysis.result.currents;

  // While moving, draw the parts where they'd land, tinted green (ok) or magenta (blocked).
  const preview = useMemo(() => {
    if (!moving || !hover) return null;
    return translateParts(parts, moving.ids, moving.anchor, hover, moving.mode);
  }, [parts, moving, hover]);
  const shown = preview?.parts ?? parts;
  const movingIds = new Set(moving?.ids ?? []);
  const markOf = (id: string) =>
    movingIds.has(id) ? (preview && !preview.valid ? FAULT : '#39ff88') : id === selected ? AMBER : undefined;
  return (
    <Canvas camera={{ position: [0, 27, 21], fov: 40 }} dpr={[1, 2]} shadows={false}>
      <color attach="background" args={['#030604']} />
      <fog attach="fog" args={['#030604', 70, 130]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#c8ffe0', '#0a140e', 0.6]} />
      <directionalLight position={[8, 20, 10]} intensity={1.6} />
      <directionalLight position={[-10, 8, -6]} intensity={0.35} color="#7fffc4" />
      <gridHelper args={[80, 40, '#123824', '#0c2418']} position={[0, -BOARD.thickness - 0.01, 0]} />
      <Board analysis={analysis} />
      <Supply analysis={analysis} />
      {shown.map((p) => {
        const mark = markOf(p.id);
        switch (p.kind) {
          case 'resistor': return <Resistor key={p.id} part={p} mark={mark} />;
          case 'led': return <Led key={p.id} part={p} mark={mark} amps={movingIds.has(p.id) ? 0 : currents[p.id] ?? 0} />;
          case 'wire': return <Wire key={p.id} part={p} mark={mark} />;
          case 'button': return <Button key={p.id} part={p} mark={mark} />;
        }
      })}
      {probes.red && <Probe h={probes.red} color="#e8413c" />}
      {probes.black && <Probe h={probes.black} color="#222" />}
      <OrbitControls makeDefault enablePan target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.3} minDistance={8} maxDistance={45} />
    </Canvas>
  );
}
