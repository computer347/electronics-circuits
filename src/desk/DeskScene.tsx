/**
 * The bench: desk, wall, lamp and the four level objects, seen from a seated view looking down
 * over the desk (about 58°). Whatever is in focus comes to the camera (or the camera leans
 * over it) and the room dims around it. Every move is time-based; reduced motion cuts.
 */
import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { BOARD, hole } from '../breadboard/layout';
import { SUPPLY_ID, type BoardAnalysis } from '../breadboard/model';
import { SUPPLY_HOLES } from '../breadboard/paths';
import { BreadboardContents } from '../breadboard/Scene';
import { useBench } from '../breadboard/store';
import { easeInOutCubic, easeOutCubic, reducedMotion, useEased } from './anim';
import { Lamp } from './assets/Lamp';
import { JACKS, Lead, METER, Multimeter } from './assets/Multimeter';
import { Notebook, NOTEBOOK } from './assets/Notebook';
import { PartsBox, type BoxItem } from './assets/PartsBox';
import { BenchSupply } from './assets/BenchSupply';
import { Cutters, LedBag, PartsDrawers, ResistorTape, Tweezers } from './assets/Clutter';
import { AntistaticMat } from './assets/Mat';
import { HelpingHands, SolderingStation, SolderSpool } from './assets/Soldering';
import { Corkboard, Desk, DESK, Mug, Poster, Wall } from './assets/Room';
import { useHover } from './hover';
import type { Reading } from './meter';
import { useNotebookRect } from './notebookRect';
import { partInfo } from './partInfo';
import { TOUR } from './tour';
import type { TaskPage } from './taskPages';
import type { DeskObject } from './steps';
import { LAYOUT, MAT_T } from './layout';
import { useDesk, type DeskPhase } from './store';

/** Breadboard units → metres: the board is about 30 cm across on the desk. */
export const S = 0.0095;
// The board sits on the antistatic mat.
const BOARD_POS = new THREE.Vector3(0, BOARD.thickness * S + MAT_T, -0.03);
export const boardToWorld = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S).add(BOARD_POS);

const REST = { notebook: LAYOUT.notebook, meter: LAYOUT.meter };
const LAMP = LAYOUT.lamp;

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

const DESK_CENTER = new THREE.Vector3(0, 0, -0.06);
const BOARD_CENTER = new THREE.Vector3(-0.01, 0, -0.045);
const METER_VIEW_CENTER = new THREE.Vector3(0.05, 0, -0.035);

function poseFor(focus: DeskObject | null, phase: DeskPhase, cam: THREE.PerspectiveCamera, diveAt: THREE.Vector3): Pose {
  if (phase === 'dive') return { pos: diveAt.clone().add(new THREE.Vector3(0, 0.012, 0.003)), target: diveAt.clone() };
  if (phase === 'power' || focus === 'breadboard') return framePose(BOARD_CENTER, 0.36, 0.26, 64, cam);
  if (focus === 'meter') return framePose(METER_VIEW_CENTER, 0.5, 0.28, 64, cam);
  if (focus === 'corkboard') return { pos: new THREE.Vector3(-0.18, 0.3, 0.22), target: new THREE.Vector3(-0.18, 0.2, DESK.wallZ) };
  // Seated at the desk (also while the notebook is presented: it comes to you).
  return framePose(DESK_CENTER, 1.2, 0.72, 60, cam, 0.86);
}

function CameraRig({ diveAt }: { diveAt: THREE.Vector3 }) {
  const { camera, size } = useThree();
  const focus = useDesk((s) => s.focus);
  const phase = useDesk((s) => s.phase);
  const zoom = useDesk((s) => s.zoom);
  const zoomAt = useDesk((s) => s.zoomAt);
  const tour = useDesk((s) => s.tour);
  const tw = useRef<{ from: Pose; to: Pose; t0: number; dur: number; key: string } | null>(null);
  const cur = useRef<Pose>({ pos: new THREE.Vector3(), target: new THREE.Vector3() });

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const zooming = (focus === 'breadboard' || focus === 'meter') && phase === 'desk' && zoom > 1;
    const stop = tour !== null && phase === 'desk' && focus === null ? TOUR[tour] : undefined;
    const key = `${focus}${stop ? `@${stop.id}` : ''}|${phase}|${size.width}x${size.height}|${zooming ? `${zoom.toFixed(3)},${zoomAt.join(',')}` : ''}`;
    if (!tw.current || tw.current.key !== key) {
      const to = stop ? framePose(stop.target, stop.size, stop.size * 0.6, stop.elevation, cam, 0.9) : poseFor(focus, phase, cam, diveAt);
      if (zooming) {
        // Lean in toward the point under the pointer, keeping the same viewing angle.
        const at = new THREE.Vector3(zoomAt[0], 0, zoomAt[1]);
        const target = to.target.clone().lerp(at, 1 - 1 / zoom);
        to.pos = target.clone().add(to.pos.clone().sub(to.target).divideScalar(zoom));
        to.target = target;
      }
      const zoomOnly = !!tw.current && tw.current.key.split('|').slice(0, 3).join('|') === key.split('|').slice(0, 3).join('|');
      const first = !tw.current;
      const dive = phase === 'dive';
      const resize = !zoomOnly && !!tw.current && tw.current.key.split('|').slice(0, 2).join('|') === key.split('|').slice(0, 2).join('|');
      tw.current = {
        from: first ? to : { pos: cur.current.pos.clone(), target: cur.current.target.clone() },
        to, t0: performance.now(), dur: reducedMotion() || resize ? 0 : dive ? 1400 : zoomOnly ? 220 : 700, key,
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

function NotebookOnDesk({ page, glow }: { page: TaskPage; glow: boolean }) {
  const focused = useDesk((s) => s.focus === 'notebook');
  const g = useRef<THREE.Group>(null);
  const k = useEased(focused ? 1 : 0);
  const open = useEased(focused ? 1 : 0, 0.8, easeInOutCubic);
  const { camera, size, gl } = useThree();
  const restQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, REST.notebook.rotY, 0)), []);
  useFrame(() => {
    if (!g.current) return;
    // Rest pose puts the closed book's centre at REST; open, the spine is the centre.
    const rest = REST.notebook.pos.clone().add(new THREE.Vector3(-NOTEBOOK.w / 2, 0, 0).applyQuaternion(restQ));
    const p = presentPose(camera as THREE.PerspectiveCamera, NOTEBOOK.w * 2, NOTEBOOK.d, 0.8);
    g.current.position.lerpVectors(rest, p.pos, k.value);
    g.current.quaternion.slerpQuaternions(restQ, p.quat, k.value);
    // Once it's open in front of you, report where the pages are so the HTML pages can sit on them.
    if (focused && open.value > 0.98) {
      g.current.updateMatrixWorld();
      const y = NOTEBOOK.pages + NOTEBOOK.cover;
      const pts = [[-NOTEBOOK.w, -NOTEBOOK.d / 2], [NOTEBOOK.w, -NOTEBOOK.d / 2], [NOTEBOOK.w, NOTEBOOK.d / 2], [-NOTEBOOK.w, NOTEBOOK.d / 2]]
        .map(([x, z]) => g.current!.localToWorld(new THREE.Vector3(x, y, z)).project(camera));
      const xs = pts.map((q) => ((q.x + 1) / 2) * size.width), ys = pts.map((q) => ((1 - q.y) / 2) * size.height);
      const r = gl.domElement.getBoundingClientRect();
      useNotebookRect.getState().set({ left: r.left + Math.min(...xs), top: r.top + Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) });
    } else if (useNotebookRect.getState().rect) useNotebookRect.getState().set(null);
  });
  return (
    <group ref={g}>
      <Interactive id="notebook">
        <group position={[NOTEBOOK.w / 2, 0, 0]}><Glow w={NOTEBOOK.w} d={NOTEBOOK.d} on={glow} /></group>
        <Notebook open={open} page={page} />
      </Interactive>
    </group>
  );
}

function MeterOnDesk({ reading, glow }: { reading: Reading; glow: boolean }) {
  const mode = useDesk((s) => s.meterMode);
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
          <Multimeter reading={reading} mode={mode} onMode={(m) => useDesk.getState().setMeterMode(m)} interactive={focused} />
        </Interactive>
      </group>
      <Lead from={jack(JACKS.com)} to={tip(probes.black, 0)} color="#1b1b1b" resting={!probes.black} />
      <Lead from={jack(JACKS.v)} to={tip(probes.red, 1)} color="#d8322c" resting={!probes.red} />
    </>
  );
}

function BreadboardOnDesk({ analysis, glow }: { analysis: BoardAnalysis; glow: boolean }) {
  const focus = useDesk((s) => s.focus);
  const phase = useDesk((s) => s.phase);
  const working = (focus === 'breadboard' || focus === 'meter') && phase === 'desk';
  const w = BOARD.width * S, d = BOARD.depth * S;
  // The wheel zooms in toward the point under the pointer (only while working at the board).
  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    if (!working) return;
    e.stopPropagation();
    const d = useDesk.getState();
    d.setZoom(d.zoom * Math.exp(-e.nativeEvent.deltaY * 0.0015), [e.point.x, e.point.z]);
  };
  return (
    <group onWheel={onWheel}>
      <group position={BOARD_POS} scale={S}>
        <BreadboardContents analysis={analysis} dynamic={false} look="desk" supplyBox={false} />
        {working && <PartLabels analysis={analysis} />}
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

/**
 * Parts are small on a real board, so at the board each one carries a label, and the one you
 * click opens a card with what the solver says about it. Drawn as HTML over the 3D board so it
 * stays sharp and readable at any zoom; it never takes clicks away from the board.
 */
function PartLabels({ analysis }: { analysis: BoardAnalysis }) {
  const parts = useBench((s) => s.parts);
  const selected = useBench((s) => s.selected);
  return (
    <>
      {parts.filter((p) => p.kind !== 'wire' || p.id === selected).map((p) => {
        const a = hole(p.h1), b = hole(p.h2);
        const info = partInfo(p, analysis);
        const open = p.id === selected;
        return (
          <Html key={p.id} position={[(a.x + b.x) / 2, open ? 2.6 : 1.9, (a.z + b.z) / 2]} center zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
            {open ? (
              <div className="part-card">
                <b>{p.id}</b>
                {info.state && <p className={`part-state ${info.tone}`}>{info.state}</p>}
                <table><tbody>{info.rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
              </div>
            ) : (
              <span className={`part-tag ${info.tone === 'bad' ? 'bad' : ''}`}>{info.tag}</span>
            )}
          </Html>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- scene

export interface DeskSceneProps {
  analysis: BoardAnalysis;
  reading: Reading;
  glow: DeskObject | null;
  page: TaskPage;
  levelNumber: number;
  passed: Set<number>;
  unlocked: Set<number>;
  onPickLevel: (n: number) => void;
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
  const lamp = useEased(focus === 'notebook' ? 0.35 : dim ? 1.8 : 3.2);
  const focusLight = useEased(focus && focus !== 'corkboard' ? 1 : 0);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.PointLight>(null);
  const { scene } = useThree();
  const diveAt = useMemo(() => { const h = hole(p.diveHole); return boardToWorld(h.x, 0, h.z); }, [p.diveHole]);
  const supply = useBench((s) => s.supply);
  // The supply's leads plug into the first holes of the top rails.
  const { railPlus, railMinus } = useMemo(() => {
    const at = (id: string) => { const h = hole(id); return boardToWorld(h.x, 0, h.z); };
    return { railPlus: at(SUPPLY_HOLES.plus), railMinus: at(SUPPLY_HOLES.minus) };
  }, []);

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
      <group position={LAYOUT.corkboard.pos}>
        <Interactive id="corkboard" lift={0}>
          <Glow w={0.3} d={0.15} on={p.glow === 'corkboard'} />
          <Corkboard current={p.levelNumber} passed={p.passed} unlocked={p.unlocked} onPick={focus === 'corkboard' ? p.onPickLevel : undefined} />
        </Interactive>
      </group>
      <group position={LAYOUT.poster.pos} rotation={[0, 0, -0.03]}><Poster /></group>

      <group position={LAYOUT.mat.pos}><AntistaticMat w={LAYOUT.mat.w} d={LAYOUT.mat.d} cordTo={new THREE.Vector3(-0.1, 0.002, -0.2)} /></group>
      <BreadboardOnDesk analysis={p.analysis} glow={p.glow === 'breadboard'} />
      <BenchSupply position={LAYOUT.supply.pos} rotY={LAYOUT.supply.rotY} volts={supply.volts} on={supply.on}
        amps={Math.max(0, -(p.analysis.result.currents[SUPPLY_ID] ?? 0))} pressed={submitted} plusTo={railPlus} minusTo={railMinus} />
      <NotebookOnDesk page={p.page} glow={p.glow === 'notebook'} />
      <MeterOnDesk reading={p.reading} glow={p.glow === 'meter'} />
      <group position={LAYOUT.partsBox.pos} rotation={[0, LAYOUT.partsBox.rotY, 0]}><PartsBox items={p.boxItems} /></group>
      <group position={LAYOUT.drawers.pos} rotation={[0, LAYOUT.drawers.rotY, 0]}><PartsDrawers /></group>
      <group position={LAYOUT.station.pos} rotation={[0, LAYOUT.station.rotY, 0]}><SolderingStation /></group>
      <group position={LAYOUT.spool.pos}><SolderSpool /></group>
      <group position={LAYOUT.helpingHands.pos} rotation={[0, LAYOUT.helpingHands.rotY, 0]}><HelpingHands /></group>
      <group position={LAYOUT.cutters.pos} rotation={[0, LAYOUT.cutters.rotY, 0]}><Cutters /></group>
      <group position={LAYOUT.tweezers.pos} rotation={[0, LAYOUT.tweezers.rotY, 0]}><Tweezers /></group>
      <group position={LAYOUT.resistorTape.pos} rotation={[0, LAYOUT.resistorTape.rotY, 0]}><ResistorTape /></group>
      <group position={LAYOUT.ledBag.pos} rotation={[0, LAYOUT.ledBag.rotY, 0]}><LedBag /></group>
      <group position={LAYOUT.mug.pos}><Mug /></group>

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
