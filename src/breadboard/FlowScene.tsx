/**
 * Electron flow: particles moving along every current path, coloured by which source
 * drives them, plus "ride" mode where the camera follows a single electron.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { formatSI } from '../lib/units';
import { electronDir, MIN_AMPS, type FlowEdge } from './flow';
import type { BoardAnalysis, BoardPart } from './model';
import { describeStop, isStopEdge, summarizeLap, type LapEntry } from './rideStops';
import { pointAt } from './paths';
import { useBench } from './store';

const MAX_PARTICLES = 3000;
const SPACING = 0.3;

/** Drift speed for display: log scale so µA and A are both visible. Units per second. */
export const flowSpeed = (amps: number) => Math.min(6, 0.45 + 1.8 * Math.log10(1 + Math.abs(amps) * 1000));

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Pick a source colour for particle i of an edge, weighted by the sources pushing the net flow. */
function particleColor(e: FlowEdge, i: number, colors: Record<string, string>): string {
  const sign = Math.sign(e.amps);
  const weights = Object.entries(e.shares)
    .map(([k, v]) => [k, Math.max(0, v * sign)] as const)
    .filter(([k, w]) => w > 0 && colors[k]);
  const total = weights.reduce((s, [, w]) => s + w, 0);
  if (!total) return '#39ff88';
  let r = hash(i + e.id.length * 1000 + e.id.charCodeAt(0)) * total;
  for (const [k, w] of weights) { r -= w; if (r <= 0) return colors[k]!; }
  return colors[weights[weights.length - 1]![0]]!;
}

interface Particle { edge: number; s: number; }

export function FlowParticles({ edges, colors, size = 0.075 }: { edges: FlowEdge[]; colors: Record<string, string>; size?: number }) {
  const conventional = useBench((s) => s.conventional);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const live = useMemo(() => edges.map((e, i) => ({ e, i })).filter(({ e }) => Math.abs(e.amps) > MIN_AMPS), [edges]);

  const particles = useMemo(() => {
    const out: Particle[] = [];
    const colorsOut: string[] = [];
    for (const { e, i } of live) {
      const n = Math.max(1, Math.floor(e.length / SPACING));
      for (let k = 0; k < n && out.length < MAX_PARTICLES; k++) {
        out.push({ edge: i, s: (k / n) * e.length + hash(k + i) * 0.05 });
        colorsOut.push(particleColor(e, k, colors));
      }
    }
    return { list: out, colors: colorsOut };
  }, [live, colors]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    particles.colors.forEach((hex, i) => m.setColorAt(i, c.set(hex)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.count = particles.list.length;
  }, [particles]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const obj = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const step = Math.min(dt, 0.05);
    particles.list.forEach((p, i) => {
      const e = edges[p.edge]!;
      const dir = electronDir(e, conventional);
      p.s += dir * flowSpeed(e.amps) * step;
      if (p.s < 0) p.s += e.length; else if (p.s > e.length) p.s -= e.length;
      pointAt(e.points, p.s, tmp);
      obj.position.copy(tmp);
      obj.updateMatrix();
      m.setMatrixAt(i, obj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_PARTICLES]} renderOrder={10} frustumCulled={false}>
      <sphereGeometry args={[size, 8, 6]} />
      <meshBasicMaterial toneMapped={false} depthTest={false} transparent opacity={0.95} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- ride mode

const TRAIL = 40;

function describe(e: FlowEdge, analysis: BoardAnalysis): { title: string; detail: string } {
  const amps = formatSI(Math.abs(e.amps), 'A');
  const va = analysis.voltageAt(e.from) ?? 0, vb = analysis.voltageAt(e.to) ?? 0;
  const drop = formatSI(Math.abs(va - vb), 'V');
  if (e.kind === 'supply') return { title: 'Inside the bench supply', detail: `Pumped up ${drop} of energy · ${amps}` };
  if (e.kind === 'strip') return { title: `Along the ${e.label}`, detail: `${amps} · no energy lost in the metal strip` };
  const id = e.partId ?? e.id;
  if (e.label.includes('resistor')) return { title: `Squeezing through ${id}`, detail: `${amps} · losing ${drop} as heat` };
  if (e.label.includes('LED')) return { title: `Through ${id}`, detail: `${amps} · giving up ${drop} as light` };
  if (e.label.includes('battery')) return { title: `Inside battery ${id}`, detail: `Pumped up ${drop} · ${amps}` };
  if (e.label.includes('button')) return { title: `Across push button ${id}`, detail: amps };
  if (e.label.includes('generator')) return { title: `Inside function generator ${id}`, detail: `Pumped up ${drop} right now · ${amps}` };
  if (e.label.includes('capacitor')) return { title: `Onto the plates of ${id}`, detail: `${amps} · charge piling up, not passing through` };
  return { title: `Along jumper wire ${id}`, detail: `${amps} · practically no voltage drop` };
}

interface RideState {
  edge: number;
  s: number;
  dir: number;
  lastInfo: number;
  color: string;
  /** moving along wires, waiting at a component for Go, or crossing the component. */
  phase: 'moving' | 'waiting' | 'crossing';
  stops: number;
  lap: LapEntry[];
  /** The Go counter when we stopped: a change means the player pressed Go. */
  seenGo: number;
}

/** Travel speeds in step mode (board units per second): calm along wires, slow through parts. */
const STEP_SPEED = { wire: 3.2, part: 1.1 } as const;

export function RideElectron({ edges, analysis, colors, parts }: { edges: FlowEdge[]; analysis: BoardAnalysis; colors: Record<string, string>; parts: BoardPart[] }) {
  const { camera } = useThree();
  const conventional = useBench((s) => s.conventional);
  const setRideInfo = useBench((s) => s.setRideInfo);
  const ball = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    return g;
  }, []);
  const state = useRef<RideState | null>(null);
  const stepMode = useBench((s) => s.rideStep);
  const setRideStop = useBench((s) => s.setRideStop);
  const mid = useMemo(() => new THREE.Vector3(), []);

  /** Arrive at the start of an edge: in step mode, components are stops. */
  const arrive = (st: RideState) => {
    const e = edges[st.edge]!;
    if (!useBench.getState().rideStep || !isStopEdge(e)) { st.phase = 'moving'; return; }
    st.stops += 1;
    const part = parts.find((p) => p.id === e.partId);
    const { stop, entry } = describeStop(e, part, analysis, st.stops, useBench.getState().conventional);
    if (entry.kind === 'gain' && st.lap.some((x) => x.kind === 'loss')) {
      stop.lap = summarizeLap(st.lap);
      st.lap = [entry];
    } else {
      st.lap.push(entry);
    }
    st.phase = 'waiting';
    st.seenGo = useBench.getState().rideGo;
    setRideStop(stop);
  };
  const pos = useMemo(() => new THREE.Vector3(), []);
  const prevPos = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const flowing = useMemo(() => edges.map((e, i) => ({ e, i })).filter(({ e }) => Math.abs(e.amps) > MIN_AMPS), [edges]);

  // start (or restart) at the busiest source
  const start = () => {
    if (!flowing.length) { state.current = null; return; }
    const src = flowing.filter(({ e }) => e.kind === 'supply' || e.label.includes('battery') || e.label.includes('generator'));
    const pick = (src.length ? src : flowing).reduce((a, b) => (Math.abs(b.e.amps) > Math.abs(a.e.amps) ? b : a));
    const dir = electronDir(pick.e, conventional);
    state.current = {
      edge: pick.i, s: dir > 0 ? 0 : pick.e.length, dir, lastInfo: 0, color: particleColor(pick.e, 0, colors),
      phase: 'moving', stops: 0, lap: [], seenGo: 0,
    };
    arrive(state.current);
  };
  useEffect(() => {
    start();
    const pts = trail.getAttribute('position') as THREE.BufferAttribute;
    const first = flowing[0]?.e.points[0];
    if (first) for (let i = 0; i < TRAIL; i++) pts.setXYZ(i, first[0], first[1], first[2]);
    if (!flowing.length) setRideInfo({ title: 'Nothing is flowing', detail: 'The circuit is open or blocked somewhere. Switch to Build and find out why.' });
  }, [flowing, conventional, stepMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    camera.position.set(0, 27, 21);
    camera.lookAt(0, 0, 0);
    setRideInfo(null);
    setRideStop(null);
  }, [camera, setRideInfo, setRideStop]);

  useFrame((_, rawDt) => {
    const st = state.current;
    if (!st) return;
    const dt = Math.min(rawDt, 0.05);
    const e = edges[st.edge]!;
    const slow = e.label.includes('resistor') ? 0.35 : e.label.includes('LED') ? 0.5 : 1;
    if (st.phase === 'waiting' && useBench.getState().rideGo !== st.seenGo) st.phase = 'crossing';
    if (st.phase === 'waiting') {
      // parked at the component's entrance: frame the whole part and wait for Go
      pointAt(e.points, e.length / 2, mid);
      // back off far enough to see the whole part and what it connects to (the supply's leads are long)
      const d = Math.min(22, 9 + e.length * 0.45);
      camTarget.set(mid.x, mid.y + d * 0.62, mid.z + d * 0.78);
      camera.position.lerp(camTarget, 1 - Math.pow(0.005, dt));
      look.lerp(mid, 1 - Math.pow(0.001, dt));
      camera.lookAt(look);
      return;
    }
    // Step mode keeps a calm pace, but never lingers: any part takes at most ~1.6 s to cross and
    // any wire or strip ~1.2 s, however long its path (the supply's leads are long).
    const speed = !stepMode ? (3 + flowSpeed(e.amps)) * slow
      : st.phase === 'crossing' ? Math.max(STEP_SPEED.part, e.length / 1.6) : Math.max(STEP_SPEED.wire, e.length / 1.2);
    st.s += st.dir * speed * dt;

    // reached the end of this edge: pick the next one, weighted by how much current goes each way
    if (st.s < 0 || st.s > e.length) {
      const at = st.dir > 0 ? e.to : e.from;
      const options = flowing.filter(({ e: n, i }) => {
        if (i === st.edge) return false;
        const d = electronDir(n, conventional);
        return (d > 0 ? n.from : n.to) === at;
      });
      if (!options.length) { start(); return; }
      const total = options.reduce((s, o) => s + Math.abs(o.e.amps), 0);
      let r = Math.random() * total;
      let next = options[0]!;
      for (const o of options) { r -= Math.abs(o.e.amps); if (r <= 0) { next = o; break; } }
      const d = electronDir(next.e, conventional);
      st.edge = next.i; st.dir = d; st.s = d > 0 ? 0 : next.e.length;
      st.color = particleColor(next.e, Math.floor(Math.random() * 1000), colors);
      st.lastInfo = 0;
      arrive(st);
    }

    const cur = edges[st.edge]!;
    prevPos.copy(pos);
    pointAt(cur.points, st.s, pos);
    ball.current?.position.copy(pos);
    light.current?.position.copy(pos);
    const mat = ball.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.color.set(st.color);
    if (light.current) light.current.color.set(st.color);

    // trail
    const tp = trail.getAttribute('position') as THREE.BufferAttribute;
    for (let i = TRAIL - 1; i > 0; i--) tp.setXYZ(i, tp.getX(i - 1), tp.getY(i - 1), tp.getZ(i - 1));
    tp.setXYZ(0, pos.x, pos.y, pos.z);
    tp.needsUpdate = true;

    // chase camera: behind and above, with a little shake while squeezing through resistors
    const motion = pos.clone().sub(prevPos).setY(0);
    if (motion.lengthSq() > 1e-8) motion.normalize(); else motion.set(0, 0, -1);
    camTarget.copy(pos).addScaledVector(motion, -4.5).add(new THREE.Vector3(0, 3.2, 0));
    if (slow < 0.4) camTarget.add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06, 0));
    camera.position.lerp(camTarget, 1 - Math.pow(0.02, dt));
    look.lerp(pos, 1 - Math.pow(0.001, dt));
    camera.lookAt(look);

    st.lastInfo -= dt;
    if (st.lastInfo <= 0) { setRideInfo(describe(cur, analysis)); st.lastInfo = 0.25; }
  });

  return (
    <group>
      <mesh ref={ball} renderOrder={11}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color="#39ff88" toneMapped={false} depthTest={false} />
      </mesh>
      <pointLight ref={light} intensity={4} distance={5} decay={2} />
      <line>
        <primitive object={trail} attach="geometry" />
        <lineBasicMaterial color="#baffd8" transparent opacity={0.55} depthTest={false} />
      </line>
    </group>
  );
}
