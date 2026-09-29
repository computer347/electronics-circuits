/**
 * Clear the circuit, in first person. You've shrunk into the board: the loop from `buildMap`
 * is a ring of corridors (the wires, blue floors) and rooms (the parts), under a pale blue fog
 * that hides what's ahead. Walk (↑ / W forward, ↓ / S turn round, or click a room), scan a
 * room to see the voltage on both sides and whether anything flows, fix what's wrong (a
 * backwards LED is a one-way door facing you: turn it round), then switch the current on and
 * watch it run round, lighting each room as it passes. Current is conventional, + to −.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { analyzeBoard } from '../breadboard/model';
import { useBench } from '../breadboard/store';
import { reducedMotion } from '../desk/anim';
import { buildMap, type Room } from './map';

// ---------------------------------------------------------------- layout

const RING = { hw: 22, hd: 13 } as const; // half width / depth of the loop, in metres of the tiny world
const PERIM = 4 * (RING.hw + RING.hd);
const EYE = 1.55;
const WALK_SPEED = 7; // m/s
const DOOR_GAP = 3.2; // how close you can get to a closed door
const ROOM_HALF = 3.6;
const HALL = 1.7; // half width of a corridor

/** A point on the loop (x, z), walking from the middle of the left side, first toward −z. */
export function pointAt(s: number): [number, number] {
  const w = 2 * RING.hw, h = 2 * RING.hd;
  let d = (((s + RING.hd) % PERIM) + PERIM) % PERIM; // from the corner at (−hw, +hd)
  if (d < h) return [-RING.hw, RING.hd - d];
  d -= h; if (d < w) return [-RING.hw + d, -RING.hd];
  d -= w; if (d < h) return [RING.hw, -RING.hd + d];
  d -= h; return [RING.hw - d, RING.hd];
}
const wrap = (s: number) => ((s % PERIM) + PERIM) % PERIM;
const dist = (a: number, b: number) => Math.min(wrap(a - b), wrap(b - a));
/** Unit direction of travel (+s) at s. */
function heading(s: number): THREE.Vector2 {
  const [a, b] = pointAt(s - 0.01), [c, d] = pointAt(s + 0.01);
  return new THREE.Vector2(c - a, d - b).normalize();
}

// ---------------------------------------------------------------- textures

function labelTexture(text: string, bg: string, fg: string, w = 512, h = 160, size = 88) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `${size}px 'Anton', 'Impact', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The door's face: a big diode arrow and its bar, in riso ink on paper. */
function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 768;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f1ece1'; g.fillRect(0, 0, 512, 768);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#ff48b0'; g.beginPath(); g.moveTo(90, 190); g.lineTo(390, 384); g.lineTo(90, 578); g.closePath(); g.fill();
  g.fillStyle = '#0078bf'; g.fillRect(400, 170, 44, 428);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#1c0a3a'; g.lineWidth = 16; g.strokeRect(8, 8, 496, 752);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- world pieces

/** A diode arrow, pointing +x (the way the door lets current through). */
const ARROW = (() => { const sh = new THREE.Shape(); sh.moveTo(-1, -1.1); sh.lineTo(1.1, 0); sh.lineTo(-1, 1.1); sh.closePath(); return sh; })();

const ROOM_COLOR: Record<Room['kind'], string> = {
  source: '#ff48b0', resistor: '#ffe800', led: '#ff48b0', button: '#0078bf', capacitor: '#0078bf', battery: '#ff48b0', generator: '#ff48b0',
};

/** Corridor floors and walls, laid in 1 m pieces round the loop (gaps where the rooms are). */
function Corridors({ roomS }: { roomS: number[] }) {
  const floor = useRef<THREE.InstancedMesh>(null);
  const walls = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const n = Math.ceil(PERIM);
  useEffect(() => {
    const m = new THREE.Object3D();
    let wi = 0, ai = 0;
    for (let i = 0; i < n; i++) {
      const s = i + 0.5;
      const [x, z] = pointAt(s);
      const h = heading(s);
      const yaw = Math.atan2(-h.y, h.x);
      m.position.set(x, 0, z); m.rotation.set(0, yaw, 0); m.scale.set(1.02, 1, 1); m.updateMatrix();
      floor.current?.setMatrixAt(i, m.matrix);
      if (roomS.some((r) => dist(r, s) < ROOM_HALF)) continue;
      for (const side of [-1, 1]) {
        const nx = -h.y, nz = h.x; // left normal of the heading
        m.position.set(x + nx * side * HALL, 1.2, z + nz * side * HALL);
        m.rotation.set(0, yaw, 0); m.scale.set(1.02, 1, 1); m.updateMatrix();
        walls.current?.setMatrixAt(wi++, m.matrix);
      }
      if (i % 3 === 0) { m.position.set(x, 0.02, z); m.rotation.set(0, yaw, 0); m.scale.set(1, 1, 1); m.updateMatrix(); arrows.current?.setMatrixAt(ai++, m.matrix); }
    }
    if (walls.current) { walls.current.count = wi; walls.current.instanceMatrix.needsUpdate = true; }
    if (arrows.current) { arrows.current.count = ai; arrows.current.instanceMatrix.needsUpdate = true; }
    if (floor.current) floor.current.instanceMatrix.needsUpdate = true;
  }, [roomS, n]);
  const chevron = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.35, -0.5); sh.lineTo(0.25, 0); sh.lineTo(-0.35, 0.5); sh.lineTo(-0.1, 0.5); sh.lineTo(0.5, 0); sh.lineTo(-0.1, -0.5); sh.closePath();
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;
  }, []);
  return (
    <group>
      <instancedMesh ref={floor} args={[undefined, undefined, n]} receiveShadow>
        <boxGeometry args={[1, 0.1, HALL * 2]} />
        <meshStandardMaterial color="#1f6fb2" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={walls} args={[undefined, undefined, n * 2]} castShadow receiveShadow>
        <boxGeometry args={[1, 2.4, 0.25]} />
        <meshStandardMaterial color="#e9dcc4" roughness={0.9} />
      </instancedMesh>
      {/* floor chevrons: the way current goes, + to − */}
      <instancedMesh ref={arrows} args={[chevron, undefined, n]}>
        <meshBasicMaterial color="#9fd0f2" />
      </instancedMesh>
    </group>
  );
}

function Sign({ text, pos, yaw, bg = '#f1ece1', fg = '#1c0a3a', w = 3.2 }: { text: string; pos: [number, number, number]; yaw: number; bg?: string; fg?: string; w?: number }) {
  const tex = useMemo(() => labelTexture(text, bg, fg), [text, bg, fg]);
  return (
    <mesh position={pos} rotation={[0, yaw, 0]}>
      <planeGeometry args={[w, w * (160 / 512)]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/** One room: a coloured floor pad, four pillars, a sign over the way in, and the part's own prop. */
function RoomView({ room, s, lit: baseLit, flowAt, turning, onClick }: {
  room: Room; s: number; lit: boolean; /** performance.now() when the flowing current reaches this room. */ flowAt: number | null; turning: boolean; onClick: () => void;
}) {
  const [reached, setReached] = useState(false);
  const lit = baseLit || reached;
  const [x, z] = pointAt(s);
  const h = heading(s);
  const yaw = Math.atan2(-h.y, h.x);
  const color = ROOM_COLOR[room.kind];
  const glow = useRef<THREE.PointLight>(null);
  const door = useRef<THREE.Group>(null);
  const doorAngle = useRef(room.forward === false ? Math.PI : 0);
  const doorTex = useMemo(() => (room.kind === 'led' ? doorTexture() : null), [room.kind]);
  const ledColor = room.color === 'green' ? '#39ff88' : room.color === 'yellow' ? '#ffd60a' : room.color === 'blue' ? '#3a8bff' : '#ff3b30';

  useFrame((_, dt) => {
    if (flowAt !== null && !reached && performance.now() >= flowAt) setReached(true);
    if (glow.current) glow.current.intensity = THREE.MathUtils.damp(glow.current.intensity, lit ? (room.kind === 'led' ? 40 : 10) : 0, 4, dt);
    if (door.current) {
      // The door swings round to face the way the current goes.
      const want = room.forward || turning ? 0 : Math.PI;
      doorAngle.current = reducedMotion() ? want : THREE.MathUtils.damp(doorAngle.current, want, 3.2, dt);
      door.current.rotation.y = doorAngle.current;
    }
  });

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[ROOM_HALF * 2, 0.08, ROOM_HALF * 2]} />
        <meshStandardMaterial color={room.fault === 'burnt' ? '#2b2320' : color} roughness={0.85} emissive={color} emissiveIntensity={lit ? 0.25 : 0} />
      </mesh>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => (
        <mesh key={`${a}${b}`} position={[a! * (ROOM_HALF - 0.3), 1.8, b! * (ROOM_HALF - 0.3)]} castShadow>
          <boxGeometry args={[0.6, 3.6, 0.6]} />
          <meshStandardMaterial color="#e9dcc4" roughness={0.9} />
        </mesh>
      ))}
      <Sign text={room.label} pos={[-ROOM_HALF + 0.05, 3.1, 0]} yaw={Math.PI / 2} />
      <pointLight ref={glow} position={[0, 2.6, 0]} color={room.kind === 'led' ? ledColor : '#fff2c8'} intensity={0} distance={12} decay={1.6} />

      {room.kind === 'source' && (
        <>
          {/* a battery cell standing either side: + ahead of you, − behind */}
          <mesh position={[0, 1.4, -2.4]} castShadow><cylinderGeometry args={[0.9, 0.9, 2.8, 32]} /><meshStandardMaterial color="#ff48b0" roughness={0.5} /></mesh>
          <mesh position={[0, 3, -2.4]}><cylinderGeometry args={[0.35, 0.35, 0.4, 20]} /><meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.25} /></mesh>
          <Sign text="+ 5 V" pos={[1.2, 1.6, -2.4]} yaw={0} bg="#ff48b0" fg="#f1ece1" w={1.8} />
          <Sign text="− 0 V" pos={[-1.2, 1.6, -2.4]} yaw={Math.PI} bg="#0078bf" fg="#f1ece1" w={1.8} />
        </>
      )}
      {room.kind === 'resistor' && [-1.6, -0.5, 0.6, 1.7].map((dx, i) => (
        // colour-band arches you walk through: brown, green, brown, gold for 150 Ω
        <mesh key={dx} position={[dx, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[2.1, 0.22, 12, 32, Math.PI]} />
          <meshStandardMaterial color={['#7a4a22', '#2e9e4f', '#7a4a22', '#d4af37'][i]} roughness={0.5} emissive="#ffb000" emissiveIntensity={lit ? 0.3 : 0} />
        </mesh>
      ))}
      {room.kind === 'led' && (
        <>
          {/* inside the LED's lens: a dome that glows in its own colour when current flows */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[ROOM_HALF * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={ledColor} transparent opacity={lit ? 0.35 : 0.12} side={THREE.DoubleSide} emissive={ledColor} emissiveIntensity={lit ? 1.2 : 0} depthWrite={false} />
          </mesh>
          {/* door frame across the corridor */}
          <mesh position={[0, 3.05, 0]}><boxGeometry args={[0.35, 0.3, HALL * 2 + 0.6]} /><meshStandardMaterial color="#1c0a3a" /></mesh>
          {[-1, 1].map((k) => <mesh key={k} position={[0, 1.5, k * (HALL + 0.15)]}><boxGeometry args={[0.35, 3, 0.3]} /><meshStandardMaterial color="#1c0a3a" /></mesh>)}
          {/* the leaf turns about the vertical: facing +s it opens with the current */}
          <group ref={door}>
            {/* the diode arrow on the floor: the only way through the door */}
            <mesh position={[-1.4, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <shapeGeometry args={[ARROW]} />
              <meshBasicMaterial color={room.fault ? '#ff2e88' : '#ff48b0'} toneMapped={false} />
            </mesh>
            <mesh position={[0, 1.45, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
              <boxGeometry args={[HALL * 2, 2.8, 0.12]} />
              <meshStandardMaterial map={doorTex} roughness={0.8} transparent opacity={lit ? 0.25 : 1} />
            </mesh>
          </group>
          {room.fault === 'reversed' && !turning && <pointLight position={[-1.5, 2.4, 0]} color="#ff2e88" intensity={12} distance={6} />}
        </>
      )}
      {room.kind === 'button' && <mesh position={[0, 0.3, 0]}><boxGeometry args={[1.6, 0.5, 1.6]} /><meshStandardMaterial color="#0078bf" /></mesh>}
      {room.kind === 'capacitor' && [-0.6, 0.6].map((dx) => <mesh key={dx} position={[dx, 1.5, 0]}><boxGeometry args={[0.2, 3, HALL * 2]} /><meshStandardMaterial color="#0078bf" /></mesh>)}
    </group>
  );
}

/** Pink charge running round the loop once the current is switched on. */
function Flow({ on }: { on: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const t0 = useRef(0);
  const COUNT = 90;
  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = on;
    if (!on) { t0.current = performance.now(); return; }
    const t = (performance.now() - t0.current) / 1000;
    const m = new THREE.Object3D();
    const front = t * 18; // the leading charge fills the loop in a few seconds
    for (let i = 0; i < COUNT; i++) {
      const s0 = (i / COUNT) * PERIM;
      const s = s0 + t * 5;
      const [x, z] = pointAt(s);
      m.position.set(x, 0.5 + 0.15 * Math.sin(i * 1.7 + t * 3), z);
      m.scale.setScalar(s0 < front ? 1 : 0.001);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.22, 12, 8]} />
      <meshBasicMaterial color="#ff48b0" toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- first-person walker

interface Walker {
  s: number;
  facing: 1 | -1;
  held: 0 | 1;
  /** Auto-walk target. */
  to: number | null;
  look: THREE.Vector3;
  bump: number;
}

function FirstPerson({ w, doorS, onMove, onBlocked, scanning }: {
  w: { current: Walker }; doorS: number | null;
  onMove: (s: number) => void; onBlocked: () => void; scanning: boolean;
}) {
  const { camera } = useThree();
  const scan = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const st = w.current;
    let delta = 0;
    if (st.held) delta = st.facing * WALK_SPEED * dt;
    else if (st.to !== null) {
      const left = st.facing === 1 ? wrap(st.to - st.s) : wrap(st.s - st.to);
      delta = st.facing * Math.min(left, WALK_SPEED * dt);
      if (left <= WALK_SPEED * dt) st.to = null;
    }
    if (delta) {
      let next = wrap(st.s + delta), blocked = false;
      if (doorS !== null) {
        const u = wrap(st.s - doorS) + delta;
        if (u < DOOR_GAP) { next = wrap(doorS + DOOR_GAP); blocked = true; }
        if (u > PERIM - DOOR_GAP) { next = wrap(doorS - DOOR_GAP); blocked = true; }
      }
      st.s = next;
      onMove(next);
      if (blocked) { st.held = 0; st.to = null; st.bump = performance.now(); onBlocked(); }
    }
    const [x, z] = pointAt(st.s);
    const [lx, lz] = pointAt(st.s + st.facing * 5);
    // Look where you're going; turning round swings the view rather than cutting (unless reduced motion).
    const want = new THREE.Vector3(lx - x, -0.18, lz - z).normalize();
    if (st.look.dot(want) < -0.9) st.look.add(new THREE.Vector3(-want.z, 0, want.x).multiplyScalar(0.2));
    if (reducedMotion()) st.look.copy(want); else st.look.lerp(want, 1 - Math.exp(-dt * 7)).normalize();
    const shake = performance.now() - st.bump < 300 && !reducedMotion() ? Math.sin((performance.now() - st.bump) / 18) * 0.06 : 0;
    const bob = st.held || st.to !== null ? Math.sin(performance.now() / 140) * (reducedMotion() ? 0 : 0.04) : 0;
    camera.position.set(x + shake * st.look.z, EYE + bob, z - shake * st.look.x);
    camera.lookAt(camera.position.clone().add(st.look));
    if (scan.current) {
      scan.current.position.copy(camera.position);
      target.position.copy(camera.position.clone().add(st.look.clone().multiplyScalar(6)));
      target.updateMatrixWorld();
      scan.current.target = target;
      scan.current.intensity = THREE.MathUtils.damp(scan.current.intensity, scanning ? 60 : 0, 6, dt);
    }
  });
  return <spotLight ref={scan} color="#ffe800" angle={0.35} penumbra={0.6} distance={18} intensity={0} />;
}

function WorldFog({ clear }: { clear: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#cfe3f2');
    scene.fog = new THREE.FogExp2('#cfe3f2', 0.11);
  }, [scene]);
  useFrame((_, dt) => {
    const f = scene.fog as THREE.FogExp2 | null;
    if (f) f.density = THREE.MathUtils.damp(f.density, clear ? 0.018 : 0.11, 1.5, dt);
  });
  return null;
}

// ---------------------------------------------------------------- the mode

export function CircuitWorld({ onCleared, rail }: { onCleared: () => void; rail: ReactNode }) {
  const parts = useBench((s) => s.parts);
  const supply = useBench((s) => s.supply);
  const map = useMemo(() => { const b = { supply, parts }; return buildMap(b, analyzeBoard(b)); }, [supply, parts]);
  const n = map.loop.length;
  const roomS = useMemo(() => map.loop.map((_, i) => (i * PERIM) / n), [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const faultIdx = map.loop.findIndex((r) => r.fault === 'reversed');
  const doorS = faultIdx >= 0 ? roomS[faultIdx]! : null;

  // Start just past the supply, facing along the current.
  const walker = useRef<Walker>({ s: 2.5, facing: 1, held: 0, to: null, look: new THREE.Vector3(0, -0.18, -1).normalize(), bump: 0 });
  const [here, setHere] = useState(0);
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState<string | null>(null);
  const [turning, setTurning] = useState(false);
  const [flowing, setFlowing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => { const t = setTimeout(() => setLanded(true), reducedMotion() ? 0 : 900); return () => clearTimeout(t); }, []);

  const nearest = (s: number) => {
    let best = -1, bestD = ROOM_HALF + 1.6;
    roomS.forEach((rs, i) => { const d = dist(rs, s); if (d < bestD) { bestD = d; best = i; } });
    return best;
  };
  const onMove = (s: number) => { const i = nearest(s); setHere((h) => (h === i ? h : i)); };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const st = walker.current;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { st.held = 1; st.to = null; }
      if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && !e.repeat) { st.facing = st.facing === 1 ? -1 : 1; st.to = null; }
    };
    const up = (e: KeyboardEvent) => { if (['ArrowUp', 'w', 'W'].includes(e.key)) walker.current.held = 0; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /** Walk to a room the way that isn't blocked (stopping in front of a closed door). */
  const walkTo = (i: number) => {
    setNotice(null);
    const st = walker.current;
    let target = roomS[i]!;
    if (doorS !== null && i === faultIdx) target = wrap(st.s - doorS) < PERIM / 2 ? wrap(doorS + DOOR_GAP) : wrap(doorS - DOOR_GAP);
    let dir: 1 | -1 = wrap(target - st.s) <= wrap(st.s - target) ? 1 : -1;
    if (doorS !== null) dir = wrap(target - doorS) >= wrap(st.s - doorS) ? 1 : -1; // never through the door
    st.facing = dir;
    st.to = target;
  };

  const room = here >= 0 ? map.loop[here] : undefined;
  const nextUnscanned = map.loop.findIndex((r, i) => i > 0 && !scanned.has(r.id));

  const fix = () => {
    if (!room || room.fault !== 'reversed') return;
    setTurning(true);
    setScanning(null);
    setTimeout(() => { useBench.getState().flipPart(room.id); setTurning(false); setNotice(null); }, reducedMotion() ? 0 : 1100);
  };
  const switchOn = () => {
    setFlowing(true);
    setScanning(null);
    setTimeout(onCleared, reducedMotion() ? 600 : 3200);
  };

  // The one main button for this moment.
  let main: { label: string; run: () => void; icon: string } | null = null;
  if (flowing || turning || !landed) main = null;
  else if (map.faults.length === 0 && map.closed) main = { label: 'Switch the current on', run: switchOn, icon: '⚡' };
  else if (room && room.id !== 'SUPPLY' && !scanned.has(room.id)) main = { label: `Scan ${room.id}`, run: () => { setScanned(new Set([...scanned, room.id])); setScanning(room.id); }, icon: '◎' };
  else if (room?.fault === 'reversed' && scanned.has(room.id)) main = { label: 'Turn the door round', run: fix, icon: '↻' };
  else if (nextUnscanned >= 0) main = { label: `Walk to ${map.loop[nextUnscanned]!.id}`, run: () => walkTo(nextUnscanned), icon: '→' };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && main) { e.preventDefault(); main.run(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Scan results go away when you walk off.
  useEffect(() => { if (scanning && room?.id !== scanning) setScanning(null); }, [here]); // eslint-disable-line react-hooks/exhaustive-deps

  const scanRoom = scanning ? map.loop.find((r) => r.id === scanning) : undefined;
  const vmax = Math.max(supply.volts, 0.1);
  const [flowStart] = useState(() => ({ t: 0 }));
  if (flowing && !flowStart.t) flowStart.t = performance.now();

  return (
    <div className={`cw ${landed ? 'cw-in' : ''}`}>
      <Canvas className="cw-canvas" shadows camera={{ fov: 70, near: 0.05, far: 200 }} dpr={[1, 2]}>
        <WorldFog clear={flowing} />
        <ambientLight intensity={0.55} color="#fff6ea" />
        <hemisphereLight args={['#ffffff', '#6a8fb0', 0.6]} />
        <directionalLight position={[10, 30, 8]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} />
        <Corridors roomS={roomS} />
        {map.loop.map((r, i) => (
          <RoomView key={r.id} room={r} s={roomS[i]!} turning={turning && i === faultIdx} onClick={() => walkTo(i)}
            lit={!!r.lit} flowAt={flowing ? flowStart.t + (roomS[i]! / 18) * 1000 : null} />
        ))}
        {/* corridor voltage plates on the walls, halfway between rooms */}
        {map.corridors.map((c, i) => {
          if (c.v === undefined) return null;
          const mid = (roomS[i]! + (i + 1 < n ? roomS[i + 1]! : PERIM)) / 2;
          const [x, z] = pointAt(mid);
          const h = heading(mid);
          return <Sign key={i} text={`${c.v.toFixed(1)} V`} pos={[x - h.y * (HALL - 0.2), 1.9, z + h.x * (HALL - 0.2)]} yaw={Math.atan2(-h.y, h.x)} bg="#ffe800" w={1.6} />;
        })}
        <Flow on={flowing} />
        <FirstPerson w={walker} doorS={doorS} onMove={onMove} scanning={!!scanning}
          onBlocked={() => setNotice('A one-way door facing you: it only opens from the other side. Scan it.')} />
      </Canvas>
      <div className="cw-halftone" aria-hidden />
      {!landed && <div className="cw-landing" aria-hidden />}
      {rail}
      <p className="cw-legend"><span className="cw-legend-arrow">»</span> current flows + → − · <kbd>↑</kbd> walk · <kbd>↓</kbd> turn round</p>

      {scanRoom && (
        <div className="cw-scan" role="status">
          <b>{scanRoom.label}</b>
          <div className="cw-bars">
            <Bar label="in" v={scanRoom.vIn} max={vmax} />
            <Bar label="out" v={scanRoom.vOut} max={vmax} />
            <div className={`cw-flowicon ${Math.abs(scanRoom.amps) > 1e-4 ? 'on' : 'off'}`}>
              <span>{Math.abs(scanRoom.amps) > 1e-4 ? '→' : '✕'}</span>
              <small>{Math.abs(scanRoom.amps) > 1e-4 ? `${(Math.abs(scanRoom.amps) * 1000).toFixed(1)} mA` : 'nothing flows'}</small>
            </div>
          </div>
          {scanRoom.fault === 'reversed' && <p>The door faces the wrong way: all the voltage on one side, none on the other.</p>}
          {scanRoom.fault === 'burnt' && <p>Burnt out. Nothing gets through here.</p>}
          <button className="cw-scan-close" onClick={() => setScanning(null)} aria-label="Close scan">×</button>
        </div>
      )}
      {notice && !scanRoom && <p className="desk-notice">{notice}</p>}
      {main && <button className="desk-main" onClick={main.run}><span aria-hidden>{main.icon}</span> {main.label}</button>}
    </div>
  );
}

function Bar({ label, v, max }: { label: string; v: number | undefined; max: number }) {
  const k = v === undefined ? 0 : Math.max(0, Math.min(1, v / max));
  return (
    <div className="cw-bar">
      <div className="cw-bar-track"><div className="cw-bar-fill" style={{ height: `${k * 100}%` }} /></div>
      <b>{v === undefined ? '?' : `${v.toFixed(1)} V`}</b>
      <small>{label}</small>
    </div>
  );
}
