/**
 * The bench: desk, wall, lamp and the four level objects, seen from a seated view looking down
 * over the desk (about 58°). Whatever is in focus comes to the camera (or the camera leans
 * over it) and the room dims around it. Every move is time-based; reduced motion cuts.
 */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { BOARD, hole } from '../breadboard/layout';
import type { BoardAnalysis } from '../breadboard/model';
import { BreadboardContents } from '../breadboard/Scene';
import { useBench } from '../breadboard/store';
import { easeInOutCubic, easeOutCubic, reducedMotion, useEased } from './anim';
import { Lamp } from './assets/Lamp';
import { JACKS, Lead, METER, Multimeter } from './assets/Multimeter';
import { Notebook, NOTEBOOK } from './assets/Notebook';
import { PartsBox, type BoxItem } from './assets/PartsBox';
import { PowerUnit } from './assets/PowerUnit';
import { Corkboard, Desk, DESK, Mug, Poster, Wall } from './assets/Room';
import { useHover } from './hover';
import type { DeskObject } from './steps';
import { useDesk, type DeskPhase } from './store';

/** Breadboard units → metres: the board is about 30 cm across on the desk. */
export const S = 0.0095;
const BOARD_POS = new THREE.Vector3(0, BOARD.thickness * S, -0.03);
export const boardToWorld = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S).add(BOARD_POS);

const REST = {
  notebook: { pos: new THREE.Vector3(-0.37, 0, 0.04), rotY: 0.16 },
  meter: { pos: new THREE.Vector3(0.33, 0, 0.04), rotY: -0.22 },
};
const LAMP = { base: new THREE.Vector3(0.6, 0, -0.32), head: new THREE.Vector3(0.36, 0.5, -0.12), aim: new THREE.Vector3(0.02, 0, 0.0) };

// ---------------------------------------------------------------- camera

interface Pose { pos: THREE.Vector3; target: THREE.Vector3 }

/** Look at a w × d patch of desk from `elevation` degrees, close enough that it fills the view. */
function framePose(center: THREE.Vector3, w: number, d: number, elevation: number, cam: THREE.PerspectiveCamera, fill = 0.9): Pose {
  const el = THREE.MathUtils.degToRad(elevation);
  const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  const tanH = tanV * cam.aspect;
  const dist = Math.max(w / 2 / (tanH * fill), (d * Math.sin(el)) / 2 / (tanV * fill));
  return { pos: center.clone().add(new THREE.Vector3(0, Math.sin(el), Math.cos(el)).multiplyScalar(dist)), target: center.clone() };
}

const DESK_CENTER = new THREE.Vector3(0, 0, -0.07);
const BOARD_CENTER = new THREE.Vector3(-0.01, 0, -0.045);
const METER_VIEW_CENTER = new THREE.Vector3(0.05, 0, -0.035);

function poseFor(focus: DeskObject | null, phase: DeskPhase, cam: THREE.PerspectiveCamera, diveAt: THREE.Vector3): Pose {
  if (phase === 'dive') return { pos: diveAt.clone().add(new THREE.Vector3(0, 0.012, 0.003)), target: diveAt.clone() };
  if (phase === 'power' || focus === 'breadboard') return framePose(BOARD_CENTER, 0.36, 0.26, 64, cam);
  if (focus === 'meter') return framePose(METER_VIEW_CENTER, 0.5, 0.28, 64, cam);
  if (focus === 'corkboard') return { pos: new THREE.Vector3(-0.18, 0.3, 0.22), target: new THREE.Vector3(-0.18, 0.2, DESK.wallZ) };
  // Seated at the desk (also while the notebook is presented: it comes to you).
  return framePose(DESK_CENTER, 1.0, 0.7, 60, cam, 0.8);
}

function CameraRig({ diveAt }: { diveAt: THREE.Vector3 }) {
  const { camera, size } = useThree();
  const focus = useDesk((s) => s.focus);
  const phase = useDesk((s) => s.phase);
  const tw = useRef<{ from: Pose; to: Pose; t0: number; dur: number; key: string } | null>(null);
  const cur = useRef<Pose>({ pos: new THREE.Vector3(), target: new THREE.Vector3() });

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const key = `${focus}|${phase}|${size.width}x${size.height}`;
    if (!tw.current || tw.current.key !== key) {
      const to = poseFor(focus, phase, cam, diveAt);
      const first = !tw.current;
      const dive = phase === 'dive';
      const resize = tw.current && tw.current.key.split('|').slice(0, 2).join('|') === key.split('|').slice(0, 2).join('|');
      tw.current = {
        from: first ? to : { pos: cur.current.pos.clone(), target: cur.current.target.clone() },
        to, t0: performance.now(), dur: reducedMotion() || resize ? 0 : dive ? 1400 : 700, key,
      };
    }
    const t = tw.current;
    const k = t.dur ? Math.min(1, (performance.now() - t.t0) / t.dur) : 1;
    const e = phase === 'dive' ? easeInOutCubic(k) : easeOutCubic(k);
    cur.current.pos.lerpVectors(t.from.pos, t.to.pos, e);
    cur.current.target.lerpVectors(t.from.target, t.to.target, e);
    cam.position.copy(cur.current.pos);
    cam.lookAt(cur.current.target);
  });
  return null;
}

// ---------------------------------------------------------------- interaction and glow

let haloTex: THREE.Texture | null = null;
function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,72,176,0.9)'); r.addColorStop(0.55, 'rgba(255,72,176,0.35)'); r.addColorStop(1, 'rgba(255,72,176,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

/** A soft pink pool of light under the object that's next. Pulses gently (steady with reduced motion). */
function Glow({ w, d, on }: { w: number; d: number; on: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const k = useEased(on ? 1 : 0, 0.5);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const pulse = reducedMotion() ? 1 : 0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.4);
    mat.current.opacity = k.value * pulse;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015, 0]} renderOrder={1}>
      <planeGeometry args={[w * 1.9, d * 1.9]} />
      <meshBasicMaterial ref={mat} map={halo()} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/**
 * Hover lifts an object and shows its tag; a click brings it into focus. While something else
 * is in focus, a click on the dimmed desk goes back.
 */
function Interactive({ id, children, lift = 0.012 }: { id: DeskObject; children: ReactNode; lift?: number }) {
  const g = useRef<THREE.Group>(null);
  const hovered = useHover((s) => s.object === id);
  const k = useEased(hovered ? 1 : 0, 0.2);
  useFrame(() => { if (g.current) g.current.position.y = k.value * lift; });
  const over = (e: ThreeEvent<PointerEvent>) => {
    const d = useDesk.getState();
    if (d.focus !== null || d.phase !== 'desk') return;
    e.stopPropagation();
    useHover.getState().set(id, e.nativeEvent.clientX, e.nativeEvent.clientY);
    document.body.style.cursor = 'pointer';
  };
  return (
    <group
      ref={g}
      onPointerOver={over}
      onPointerMove={over}
      onPointerOut={() => { if (useHover.getState().object === id) useHover.getState().set(null); document.body.style.cursor = ''; }}
      onClick={(e) => {
        const d = useDesk.getState();
        if (d.phase !== 'desk') return;
        e.stopPropagation();
        useHover.getState().set(null);
        document.body.style.cursor = '';
        if (d.focus === null) d.focusOn(id);
        else if (d.focus !== id) d.focusOn(null);
      }}
    >
      {children}
    </group>
  );
}

// ---------------------------------------------------------------- objects

/** Where a presented object sits: in front of the camera, facing it, filling most of the view. */
function presentPose(cam: THREE.PerspectiveCamera, w: number, h: number, fill = 0.82) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  const dist = Math.max(w / 2 / (tanV * cam.aspect * fill), h / 2 / (tanV * fill));
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const pos = cam.position.clone().add(dir.clone().multiplyScalar(dist));
  // Page normal (+y) toward the camera; the top of the page (−z) toward the top of the screen.
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  return { pos, quat };
}

function NotebookOnDesk({ goal, level, glow }: { goal: string; level: string; glow: boolean }) {
  const focused = useDesk((s) => s.focus === 'notebook');
  const g = useRef<THREE.Group>(null);
  const k = useEased(focused ? 1 : 0);
  const open = useEased(focused ? 1 : 0, 0.8, easeInOutCubic);
  const { camera } = useThree();
  const restQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, REST.notebook.rotY, 0)), []);
  useFrame(() => {
    if (!g.current) return;
    // Rest pose puts the closed book's centre at REST; open, the spine is the centre.
    const rest = REST.notebook.pos.clone().add(new THREE.Vector3(-NOTEBOOK.w / 2, 0, 0).applyQuaternion(restQ));
    const p = presentPose(camera as THREE.PerspectiveCamera, NOTEBOOK.w * 2, NOTEBOOK.d);
    g.current.position.lerpVectors(rest, p.pos, k.value);
    g.current.quaternion.slerpQuaternions(restQ, p.quat, k.value);
  });
  return (
    <group ref={g}>
      <Interactive id="notebook">
        <group position={[NOTEBOOK.w / 2, 0, 0]}><Glow w={NOTEBOOK.w} d={NOTEBOOK.d} on={glow} /></group>
        <Notebook open={open} goal={goal} level={level} />
      </Interactive>
    </group>
  );
}

function MeterOnDesk({ reading, glow }: { reading: number | null; glow: boolean }) {
  const focused = useDesk((s) => s.focus === 'meter');
  const g = useRef<THREE.Group>(null);
  const k = useEased(focused ? 1 : 0);
  const probes = useBench((s) => s.probes);
  const restQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, REST.meter.rotY, 0)), []);
  // In the meter view it stands beside the board, tilted up toward you.
  const viewPos = useMemo(() => new THREE.Vector3(0.235, 0.012, 0.0), []);
  const viewQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, -0.12, 0)), []);
  useFrame(() => {
    if (!g.current) return;
    g.current.position.lerpVectors(REST.meter.pos, viewPos, k.value);
    g.current.quaternion.slerpQuaternions(restQ, viewQ, k.value);
    g.current.updateMatrixWorld();
  });
  const jack = (j: THREE.Vector3) => () => (g.current ? j.clone().applyMatrix4(g.current.matrixWorld) : j.clone());
  const tip = (h: string | null, side: number) => () => {
    if (h) { const i = hole(h); return boardToWorld(i.x, 2.4, i.z); }
    // Resting on the desk beside the meter.
    const base = g.current ? g.current.position : REST.meter.pos;
    return new THREE.Vector3(base.x + 0.07 + side * 0.012, 0.005, base.z + 0.1 + side * 0.02);
  };
  return (
    <>
      <group ref={g}>
        <Interactive id="meter">
          <Glow w={METER.w} d={METER.d} on={glow} />
          <Multimeter reading={reading} />
        </Interactive>
      </group>
      <Lead from={jack(JACKS.com)} to={tip(probes.black, 0)} color="#1b1b1b" resting={!probes.black} />
      <Lead from={jack(JACKS.v)} to={tip(probes.red, 1)} color="#d8322c" resting={!probes.red} />
    </>
  );
}

function BreadboardOnDesk({ analysis, glow, flipped }: { analysis: BoardAnalysis; glow: boolean; flipped: boolean }) {
  const focus = useDesk((s) => s.focus);
  const phase = useDesk((s) => s.phase);
  const working = (focus === 'breadboard' || focus === 'meter') && phase === 'desk';
  const w = BOARD.width * S, d = BOARD.depth * S;
  return (
    <group>
      <group position={BOARD_POS} scale={S}>
        <BreadboardContents analysis={analysis} dynamic={false} look="desk" supplyBox={false} />
        <PowerUnit flipped={flipped} glow={false} />
      </group>
      <group position={[BOARD_POS.x, 0, BOARD_POS.z]}>
        <Glow w={w} d={d} on={glow} />
      </group>
      {/* At the desk, the board is one object: a click focuses it rather than poking a hole. */}
      {!working && (
        <Interactive id="breadboard" lift={0}>
          <mesh position={[BOARD_POS.x - 0.01, 0.02, BOARD_POS.z - 0.02]}>
            <boxGeometry args={[w + 0.08, 0.05, d + 0.08]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </Interactive>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- scene

export interface DeskSceneProps {
  analysis: BoardAnalysis;
  reading: number | null;
  glow: DeskObject | null;
  goal: string;
  levelLabel: string;
  levelNumber: number;
  passed: Set<number>;
  boxItems: BoxItem[];
  /** Hole the camera dives into after a submit. */
  diveHole: string;
}

export function DeskScene(p: DeskSceneProps) {
  const focus = useDesk((s) => s.focus);
  const phase = useDesk((s) => s.phase);
  const submitted = useDesk((s) => s.flags.submitted);
  const dim = focus !== null || phase !== 'desk';
  const ambient = useEased(dim ? 0.12 : 0.34);
  // In focus the lamp drops back so it doesn't burn out the page you're reading.
  const lamp = useEased(focus === 'notebook' ? 0.9 : dim ? 1.8 : 3.2);
  const focusLight = useEased(focus && focus !== 'corkboard' ? 1 : 0);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.PointLight>(null);
  const { scene } = useThree();
  const diveAt = useMemo(() => { const h = hole(p.diveHole); return boardToWorld(h.x, 0, h.z); }, [p.diveHole]);

  useEffect(() => { scene.background = new THREE.Color('#15110d'); }, [scene]);
  useFrame(() => {
    if (amb.current) amb.current.intensity = ambient.value;
    if (hemi.current) hemi.current.intensity = ambient.value * 1.4;
    if (key.current) key.current.intensity = focusLight.value * 0.9;
  });

  return (
    <>
      <ambientLight ref={amb} color="#ffe6c8" />
      <hemisphereLight ref={hemi} args={['#fff0dc', '#3a2a1c']} />
      {/* soft fill from where you sit, and a key light over whatever is in focus */}
      <directionalLight position={[-0.4, 1.2, 1.2]} intensity={dim ? 0.15 : 0.35} color="#ffe2c0" />
      <pointLight ref={key} position={[0.05, 0.55, 0.25]} color="#fff4e4" distance={2} decay={1.5} />
      <LampWithIntensity intensity={lamp} />
      <CameraRig diveAt={diveAt} />

      <Desk />
      <Wall />
      <group position={[-0.18, 0.2, DESK.wallZ + 0.012]}>
        <Interactive id="corkboard" lift={0}>
          <Glow w={0.3} d={0.15} on={p.glow === 'corkboard'} />
          <Corkboard current={p.levelNumber} passed={p.passed} />
        </Interactive>
      </group>
      <group position={[0.36, 0.22, DESK.wallZ + 0.003]} rotation={[0, 0, -0.03]}><Poster /></group>

      <BreadboardOnDesk analysis={p.analysis} glow={p.glow === 'breadboard'} flipped={submitted} />
      <NotebookOnDesk goal={p.goal} level={p.levelLabel} glow={p.glow === 'notebook'} />
      <MeterOnDesk reading={p.reading} glow={p.glow === 'meter'} />
      <group position={[-0.3, 0, -0.3]} rotation={[0, 0.1, 0]}><PartsBox items={p.boxItems} /></group>
      <group position={[0.66, 0, 0.12]}><Mug /></group>

      {/* A click on the dimmed desk goes back. */}
      <mesh position={[0, 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => { const d = useDesk.getState(); if (d.focus && d.phase === 'desk') d.focusOn(null); }}>
        <planeGeometry args={[DESK.width, DESK.depth * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}

function LampWithIntensity({ intensity }: { intensity: { value: number } }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current?.traverse((o) => { if ((o as THREE.SpotLight).isSpotLight) (o as THREE.SpotLight).intensity = intensity.value; });
  });
  return <group ref={ref}><Lamp base={LAMP.base} head={LAMP.head} aim={LAMP.aim} intensity={3} /></group>;
}
