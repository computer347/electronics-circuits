/**
 * Drawing the circuit world: terraces for plazas (their top is their voltage), floors and low
 * walls along each link, the supply's staircase, resistor passages with their colour bands,
 * LED doors with their ledge and dome, drawbridges, reservoirs, chasms, and signs. When the
 * power is on, pink charge runs round the loop, downhill.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorBands } from '../breadboard/colorCode';
import { formatSI } from '../lib/units';
import { reducedMotion } from '../desk/anim';
import { linkFloor, linkPoint, linkYaw, PLAZA_R, type Link, type Plaza, type World } from './world';

const INK = { paper: '#f1ece1', pink: '#ff48b0', blue: '#0078bf', yellow: '#ffe800', ink: '#1c0a3a' } as const;
const FLOOR = '#1f6fb2';
const STONE = '#e2d6c0';
const LED_HEX: Record<string, string> = { red: '#ff3b30', yellow: '#ffd60a', green: '#39d86a', blue: '#3a8bff', white: '#f5f5ff' };

// ---------------------------------------------------------------- textures

const texCache = new Map<string, THREE.CanvasTexture>();
export function labelTexture(text: string, bg: string, fg: string, w = 512, h = 160, size = 88) {
  const key = `${text}|${bg}|${fg}|${w}|${h}`;
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  // Shrink long text to fit the sign rather than clipping it.
  let px = size;
  do { g.font = `${px}px 'Anton', 'Impact', sans-serif`; px -= 4; } while (px > 24 && g.measureText(text).width > w - 36);
  g.fillText(text, w / 2, h / 2 + 4);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

let doorTex: THREE.CanvasTexture | null = null;
function doorTexture() {
  if (doorTex) return doorTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 768;
  const g = c.getContext('2d')!;
  g.fillStyle = INK.paper; g.fillRect(0, 0, 512, 768);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = INK.pink; g.beginPath(); g.moveTo(90, 190); g.lineTo(390, 384); g.lineTo(90, 578); g.closePath(); g.fill();
  g.fillStyle = INK.blue; g.fillRect(400, 170, 44, 428);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = INK.ink; g.lineWidth = 16; g.strokeRect(8, 8, 496, 752);
  doorTex = new THREE.CanvasTexture(c);
  doorTex.colorSpace = THREE.SRGBColorSpace;
  return doorTex;
}

/** A two-sided sign: printed the right way round on both faces, so it reads from either direction. */
export function Sign({ text, pos, yaw, bg = INK.paper, fg = INK.ink, w = 2.6 }: { text: string; pos: [number, number, number]; yaw: number; bg?: string; fg?: string; w?: number }) {
  const map = labelTexture(text, bg, fg);
  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      {[0, Math.PI].map((r) => (
        <mesh key={r} rotation={[0, r, 0]}>
          <planeGeometry args={[w, w * (160 / 512)]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- geometry helpers

/** A box from p to q (a slab of floor, or a wall), with a thickness and height. */
function Slab({ p, q, width, thick, color, y0 = 0 }: { p: THREE.Vector3; q: THREE.Vector3; width: number; thick: number; color: string; y0?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const d = q.clone().sub(p);
    const len = d.length();
    const yaw = Math.atan2(-d.z, d.x);
    const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YXZ'));
    const pos = p.clone().add(q).multiplyScalar(0.5).add(new THREE.Vector3(0, y0 - thick / 2, 0));
    return { pos, quat, len };
  }, [p, q, thick, y0]);
  return (
    <mesh position={pos} quaternion={quat} castShadow receiveShadow>
      <boxGeometry args={[len + 0.02, thick, width]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

// ---------------------------------------------------------------- plazas

function PlazaView({ p }: { p: Plaza }) {
  const top = p.height;
  const depth = top + 3;
  return (
    <group position={[p.center[0], 0, p.center[1]]}>
      <mesh position={[0, top - depth / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[PLAZA_R, PLAZA_R + 0.2, depth, 48]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[0, top + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[PLAZA_R - 0.25, 48]} />
        <meshStandardMaterial color={FLOOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, top + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[PLAZA_R - 0.25, PLAZA_R, 48]} />
        <meshStandardMaterial color="#9fd0f2" roughness={0.8} />
      </mesh>
      {/* the height of this place is its voltage, on a post */}
      <mesh position={[0, top + 1.2, -PLAZA_R + 0.6]}><cylinderGeometry args={[0.06, 0.06, 2.4, 8]} /><meshStandardMaterial color={INK.ink} /></mesh>
      <Sign text={p.volts === undefined ? '? V' : `${p.volts.toFixed(1)} V`} pos={[0, top + 2.3, -PLAZA_R + 0.6]} yaw={0} bg={INK.yellow} w={1.8} />
      <Sign text={p.volts === undefined ? '? V' : `${p.volts.toFixed(1)} V`} pos={[0, top + 2.3, -PLAZA_R + 0.58]} yaw={Math.PI} bg={INK.yellow} w={1.8} />
      {p.ground && <Sign text="0 V · GROUND" pos={[0, top + 0.03, 0]} yaw={0} bg={FLOOR} fg={INK.paper} w={4} />}
    </group>
  );
}

// ---------------------------------------------------------------- links

/** Floor and low walls along a link, in short pieces that follow its height profile. */
function LinkFloor({ l }: { l: Link }) {
  const pieces = useMemo(() => {
    const out: { p: THREE.Vector3; q: THREE.Vector3 }[] = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const f0 = linkFloor(l, t0 + 0.001), f1 = linkFloor(l, t1 - 0.001);
      if (f0 === undefined || f1 === undefined) continue;
      if (l.profile === 'ledge' && t0 < l.at && t1 > l.at) {
        out.push({ p: linkPoint(l, t0), q: linkPoint(l, l.at - 0.001) });
        out.push({ p: linkPoint(l, l.at + 0.001), q: linkPoint(l, t1) });
        continue;
      }
      out.push({ p: linkPoint(l, t0), q: linkPoint(l, t1) });
    }
    return out;
  }, [l]);
  const walls = l.kind !== 'stair';
  return (
    <group>
      {pieces.map((s, i) => {
        const d = s.q.clone().sub(s.p).setY(0).normalize();
        const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(l.width / 2 + 0.1);
        return (
          <group key={i}>
            <Slab p={s.p} q={s.q} width={l.width + 0.4} thick={0.3} color={FLOOR} />
            {walls && [1, -1].map((k) => (
              <Slab key={k} p={s.p.clone().add(side.clone().multiplyScalar(k))} q={s.q.clone().add(side.clone().multiplyScalar(k))} width={0.2} thick={1.1} y0={1.1} color={STONE} />
            ))}
            {/* a pillar down to the ground under raised floor */}
            {i % 4 === 0 && s.p.y > 0.5 && (
              <mesh position={[s.p.x, s.p.y / 2 - 0.3, s.p.z]}><boxGeometry args={[0.5, s.p.y, 0.5]} /><meshStandardMaterial color={STONE} roughness={0.9} /></mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** The supply's staircase: real steps up from the floor to its voltage, in power pink. */
function Stair({ l }: { l: Link }) {
  const steps = useMemo(() => {
    const rise = l.h1 - l.h0;
    const n = Math.max(4, Math.round(Math.abs(rise) / 0.25));
    return Array.from({ length: n }, (_, i) => ({ p: linkPoint(l, i / n), q: linkPoint(l, (i + 1) / n), y: l.h0 + (rise * (i + 1)) / n }));
  }, [l]);
  const yaw = linkYaw(l, 0.5);
  return (
    <group>
      {steps.map((s, i) => {
        const mid = s.p.clone().add(s.q).multiplyScalar(0.5);
        const len = s.p.distanceTo(new THREE.Vector3(s.q.x, s.p.y, s.q.z));
        return (
          <mesh key={i} position={[mid.x, s.y / 2 - 0.5, mid.z]} rotation={[0, yaw, 0]} castShadow receiveShadow>
            <boxGeometry args={[len + 0.02, s.y + 1, l.width]} />
            <meshStandardMaterial color={i % 2 ? '#ff6cc0' : INK.pink} roughness={0.7} />
          </mesh>
        );
      })}
      <Sign text={l.room?.fault === 'reversed' ? `${l.id} BACKWARDS · ${(l.h1 - l.h0).toFixed(1)} V` : `${l.id === 'SUPPLY' ? '' : `${l.id} · `}+ ${(l.h1 - l.h0).toFixed(1)} V`}
        pos={[linkPoint(l, 0.5).x, Math.max(l.h0, l.h1) + 2.2, linkPoint(l, 0.5).z]} yaw={yaw + Math.PI / 2}
        bg={l.room?.fault === 'reversed' ? '#1c0a3a' : INK.pink} fg={INK.paper} w={l.room?.fault === 'reversed' ? 3.6 : 2.4} />
    </group>
  );
}

/** Height of the straight posts under a resistor's arches, so the arch clears your head. */
const ARCH_POST = 1.4;

/** A resistor's way in: arches in its colour bands, and its name. */
function ResistorGate({ l }: { l: Link }) {
  const ohms = l.room?.part?.ohms ?? 1000;
  const bands = colorBands(ohms).colors;
  const yaw = linkYaw(l, 0.05);
  const at = linkPoint(l, 0.04);
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      {/* a gateway in its colour bands, high enough to walk under */}
      {bands.map((c, i) => (
        <group key={i} position={[0.35 * i, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, ARCH_POST, 0]} castShadow>
            <torusGeometry args={[l.width / 2 + 0.35, 0.12, 10, 28, Math.PI]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * (l.width / 2 + 0.35), ARCH_POST / 2, 0]}><cylinderGeometry args={[0.12, 0.12, ARCH_POST, 10]} /><meshStandardMaterial color={c} roughness={0.5} /></mesh>
          ))}
        </group>
      ))}
      <Sign text={`${l.id} · ${formatSI(ohms, 'Ω')}`} pos={[-0.1, ARCH_POST + l.width / 2 + 1, 0]} yaw={Math.PI / 2} w={2.6} />
    </group>
  );
}

/** An LED: the door (its diode arrow shows the only way through), the ledge, and its dome. */
function DoorView({ l, turning, lit }: { l: Link; turning: boolean; lit: boolean }) {
  const leaf = useRef<THREE.Group>(null);
  const angle = useRef(l.room?.forward === false ? Math.PI : 0);
  const at = linkPoint(l, l.at).setY(l.h0);
  const yaw = linkYaw(l, l.at);
  const color = LED_HEX[l.room?.color ?? 'red'] ?? '#ff3b30';
  useFrame((_, dt) => {
    const want = l.room?.forward !== false || turning ? 0 : Math.PI;
    angle.current = reducedMotion() ? want : THREE.MathUtils.damp(angle.current, want, 3.2, dt);
    if (leaf.current) leaf.current.rotation.y = angle.current;
  });
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      {/* frame */}
      <mesh position={[0, 3.05, 0]}><boxGeometry args={[0.35, 0.3, l.width + 0.6]} /><meshStandardMaterial color={INK.ink} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} position={[0, 1.5, k * (l.width / 2 + 0.15)]}><boxGeometry args={[0.35, 3, 0.3]} /><meshStandardMaterial color={INK.ink} /></mesh>)}
      <group ref={leaf}>
        <mesh position={[0, 1.45, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[l.width, 2.8, 0.12]} />
          <meshStandardMaterial map={doorTexture()} roughness={0.8} transparent opacity={lit ? 0.3 : 1} />
        </mesh>
        <mesh position={[-1.6, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[ARROW]} />
          <meshBasicMaterial color={l.room?.fault ? '#ff2e88' : INK.pink} toneMapped={false} />
        </mesh>
      </group>
      {/* the dome over the drop: the LED's lens, glowing in its colour when lit */}
      <mesh position={[1.2, (l.h1 - l.h0), 0]}>
        <sphereGeometry args={[l.width * 1.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} transparent opacity={lit ? 0.16 : 0.08} side={THREE.DoubleSide} emissive={color} emissiveIntensity={lit ? 0.45 : 0} depthWrite={false} />
      </mesh>
      {lit && <pointLight position={[1.2, (l.h1 - l.h0) + 3, 0]} color={color} intensity={10} distance={12} decay={1.6} />}
      {l.room?.fault === 'reversed' && !turning && <pointLight position={[-1.5, 2.4, 0]} color="#ff2e88" intensity={10} distance={6} />}
      <Sign text={`${l.id} · ${l.room?.color ?? 'LED'}`} pos={[-0.25, 3.7, 0]} yaw={Math.PI / 2} w={2.4} />
    </group>
  );
}

const ARROW = (() => { const sh = new THREE.Shape(); sh.moveTo(-1, -1.1); sh.lineTo(1.1, 0); sh.lineTo(-1, 1.1); sh.closePath(); return sh; })();

/** A push button: a drawbridge that's down only while the button is held. */
function BridgeView({ l, down }: { l: Link; down: boolean }) {
  const plank = useRef<THREE.Group>(null);
  const k = useRef(down ? 1 : 0);
  const hinge = linkPoint(l, l.at - 0.2);
  const yaw = linkYaw(l, l.at);
  useFrame((_, dt) => {
    k.current = reducedMotion() ? (down ? 1 : 0) : THREE.MathUtils.damp(k.current, down ? 1 : 0, 6, dt);
    if (plank.current) plank.current.rotation.z = (1 - k.current) * 1.3;
  });
  return (
    <group position={hinge} rotation={[0, yaw, 0]}>
      <group ref={plank}>
        <mesh position={[1.1, -0.15, 0]} castShadow><boxGeometry args={[2.3, 0.2, l.width]} /><meshStandardMaterial color={INK.blue} roughness={0.6} /></mesh>
      </group>
      {[-1, 1].map((s) => <mesh key={s} position={[0, 1, s * (l.width / 2 + 0.2)]}><boxGeometry args={[0.3, 2, 0.3]} /><meshStandardMaterial color={INK.ink} /></mesh>)}
      <Sign text={`${l.id} · hold E`} pos={[0, 2.6, 0]} yaw={Math.PI / 2} w={2.4} />
    </group>
  );
}

/** A capacitor: two plates with a gap, and the charge standing between them like water. */
function ReservoirView({ l }: { l: Link }) {
  const at = linkPoint(l, l.at).setY(Math.min(l.h0, l.h1));
  const yaw = linkYaw(l, l.at);
  const level = Math.abs(l.h0 - l.h1);
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      {[-1, 1].map((k) => <mesh key={k} position={[k * 1.1, 1.8, 0]} castShadow><boxGeometry args={[0.3, 3.6, l.width + 1]} /><meshStandardMaterial color={INK.blue} roughness={0.5} /></mesh>)}
      <mesh position={[0, Math.max(0.05, level) / 2 - 1, 0]}><boxGeometry args={[1.9, Math.max(0.05, level) + 2, l.width]} /><meshStandardMaterial color="#9fd0f2" transparent opacity={0.6} /></mesh>
      <Sign text={`${l.id} · ${level.toFixed(1)} V`} pos={[0, 4.1, 0]} yaw={Math.PI / 2} w={2.4} />
    </group>
  );
}

function ChasmView({ l }: { l: Link }) {
  const at = linkPoint(l, l.at).setY(l.h0);
  const yaw = linkYaw(l, l.at);
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      <mesh position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5, l.width]} /><meshBasicMaterial color="#0a2a45" /></mesh>
      <Sign text="NO PATH" pos={[-2.6, 2.2, 0]} yaw={Math.PI / 2} bg={INK.pink} fg={INK.paper} w={2.6} />
      <pointLight position={[0, 1.5, 0]} color="#ff2e88" intensity={8} distance={7} />
    </group>
  );
}

// ---------------------------------------------------------------- current

/** Pink charge running round the loop, downhill, once the power is on. */
function Flow({ world }: { world: World }) {
  const route = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (const l of world.links.filter((x) => !x.side)) {
      for (let i = 0; i <= 20; i++) pts.push(linkPoint(l, i / 20).add(new THREE.Vector3(0, 0.45, 0)));
      const p = world.plazas[l.to]!;
      pts.push(new THREE.Vector3(p.center[0], p.height + 0.45, p.center[1]));
    }
    return pts.length > 2 ? new THREE.CatmullRomCurve3(pts, true) : null;
  }, [world]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 140;
  const t0 = useRef(performance.now());
  useFrame(() => {
    if (!ref.current || !route) return;
    const t = (performance.now() - t0.current) / 1000;
    const m = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const u = (((i / COUNT) + t * 0.035) % 1 + 1) % 1;
      m.position.copy(route.getPointAt(u));
      m.scale.setScalar(u < t * 0.12 ? 1 : 0.001);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.22, 12, 8]} />
      <meshBasicMaterial color={INK.pink} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- the whole world

export function WorldView({ world, turning, flowing, pressed }: { world: World; turning: string | null; flowing: boolean; pressed: Set<string> }) {
  return (
    <group>
      {/* the ground far below everything: the board's own dark */}
      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#b9cfe0" roughness={1} /></mesh>
      {world.plazas.map((p) => <PlazaView key={p.index} p={p} />)}
      {world.links.map((l) => (
        <group key={`${l.id}-${l.from}-${l.to}`}>
          {l.kind === 'stair' ? <Stair l={l} /> : <LinkFloor l={l} />}
          {l.kind === 'ramp' && <ResistorGate l={l} />}
          {l.kind === 'door' && <DoorView l={l} turning={turning === l.id} lit={flowing || !!l.room?.lit} />}
          {l.kind === 'bridge' && <BridgeView l={l} down={pressed.has(l.id) || !!l.room?.part?.pressed} />}
          {l.kind === 'reservoir' && <ReservoirView l={l} />}
          {l.kind === 'chasm' && <ChasmView l={l} />}
        </group>
      ))}
      {flowing && <Flow world={world} />}
    </group>
  );
}
