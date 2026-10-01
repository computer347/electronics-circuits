/**
 * Clear the circuit, in first person, free to move. The circuit is a place where height is
 * voltage (see world.ts): you start at the top of the supply's stair and walk its loop.
 *
 * Four verbs: move (WASD / arrows, Shift to hurry, C to crouch), look (mouse, with the pointer
 * captured; ← → turn without a mouse), scan (hold Q or the right button: every nearby place
 * and part says its voltage, drop and current) and use (E or click: turn a backwards door
 * round, hold a drawbridge, switch the power on at the panel by the stair). Tab shows the map;
 * click a place on it and the electron walks there on its own.
 */
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { analyzeBoard } from '../breadboard/model';
import { useBench } from '../breadboard/store';
import { reducedMotion } from '../desk/anim';
import { formatSI } from '../lib/units';
import { CROUCH_EYE, EYE, spawnWalker, standable, step, type Walker } from './walker';
import { routeTo, targets, type Target } from './interact';
import { WorldView } from './WorldView';
import { buildWorld, floorsAt, linkPoint, linkYaw, type Link, type World } from './world';

const CONTROLS_KEY = 'signal-path.world.controls.v1';
const seen = () => { try { return localStorage.getItem(CONTROLS_KEY) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(CONTROLS_KEY, '1'); } catch { /* fine */ } };

/** What scanning a link tells you, in plain words and numbers. */
function scanText(l: Link): string {
  const r = l.room;
  const amps = Math.abs(r?.amps ?? 0);
  const drop = l.h0 - l.h1;
  if (l.kind === 'chasm') return 'No path: nothing connects here';
  if (l.kind === 'stair' && r?.fault === 'reversed') return `${l.id} · backwards: takes ${Math.abs(l.h1 - l.h0).toFixed(1)} V away`;
  if (l.kind === 'stair') return `${l.id === 'SUPPLY' ? 'Supply' : l.id} · lifts ${(l.h1 - l.h0).toFixed(1)} V · ${formatSI(amps, 'A')}`;
  // A transistor's door is opened from the side, by its base, not by the voltage across it.
  if (l.kind === 'door' && r?.kind === 'transistor') return r.fault === 'reversed' ? `${l.id} · in backwards: collector and emitter swapped`
    : r.lit ? `${l.id} · switched on by its base · ${drop.toFixed(1)} V across · ${formatSI(amps, 'A')}`
      : `${l.id} · switched off: no current into its base, so the door stays shut`;
  if (l.kind === 'door' && r?.kind === 'diode') return r.fault === 'reversed' ? `${l.id} · blocking: it's in backwards` : r.lit ? `${l.id} · conducting · drops ${drop.toFixed(1)} V` : `${l.id} · not conducting`;
  if (l.kind === 'door') return r?.fault === 'reversed' ? `${l.id} · blocking · ${Math.abs(drop).toFixed(1)} V across it, nothing flows`
    : !r?.lit ? `${l.id} · dark: only ${Math.max(0, drop).toFixed(1)} V across it, not enough to open`
      : `${l.id} · drops ${drop.toFixed(1)} V · ${formatSI(amps, 'A')} · lit`;
  if (l.kind === 'bridge') return `${l.id} · ${r?.part?.pressed ? 'closed' : r?.part?.kind === 'toggle' || r?.part?.kind === 'spdt' ? 'open: flip it' : 'open: hold it down'}`;
  if (l.kind === 'reservoir') return `${l.id} · charged to ${Math.abs(drop).toFixed(1)} V · no path through`;
  return `${l.id} · ${formatSI(r?.part?.ohms ?? 0, 'Ω')} · drops ${drop.toFixed(1)} V · ${formatSI(amps, 'A')}`;
}

// ---------------------------------------------------------------- input

interface Keys { f: number; b: number; l: number; r: number; tl: number; tr: number; sprint: boolean; crouch: boolean; scan: boolean }
const NO_KEYS: Keys = { f: 0, b: 0, l: 0, r: 0, tl: 0, tr: 0, sprint: false, crouch: false, scan: false };

function useKeys() {
  const k = useRef<Keys>({ ...NO_KEYS });
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const s = k.current;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': s.f = on ? 1 : 0; break;
        case 'KeyS': case 'ArrowDown': s.b = on ? 1 : 0; break;
        case 'KeyA': s.l = on ? 1 : 0; break;
        case 'KeyD': s.r = on ? 1 : 0; break;
        case 'ArrowLeft': s.tl = on ? 1 : 0; break;
        case 'ArrowRight': s.tr = on ? 1 : 0; break;
        case 'ShiftLeft': case 'ShiftRight': s.sprint = on; break;
        case 'KeyC': case 'ControlLeft': s.crouch = on; break;
        case 'KeyQ': s.scan = on; break;
        default: return;
      }
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    const blur = () => { Object.assign(k.current, NO_KEYS); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  return k;
}

// ---------------------------------------------------------------- the player

interface Shared {
  walker: Walker;
  keys: MutableRefObject<Keys>;
  /** Click-to-walk: points to walk through, in order. */
  route: [number, number][];
  mouseScan: boolean;
  onTarget: (t: Target | null) => void;
  /** Bumped into something blocked (a shut door, a gap): its id. */
  onBlockedNear: (id: string | null) => void;
}

function Player({ world, shared }: { world: World; shared: Shared }) {
  const { camera, gl } = useThree();
  const tgts = useMemo(() => targets(world), [world]);
  const lastTarget = useRef<string | null>(null);
  const bob = useRef(0);

  // A new world (after a fix): stand on whatever floor is under you now; drops are fallen.
  useEffect(() => {
    const s = shared.walker;
    if (standable(world, s.x, s.z, s.y) === undefined) {
      const fl = floorsAt(world, s.x, s.z);
      if (fl.length) s.y = fl[0]!;
    }
  }, [world, shared]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = shared.walker;
    const k = shared.keys.current;
    s.yaw += (k.tl - k.tr) * 2.2 * dt;
    let forward = k.f - k.b, strafe = k.r - k.l;
    // Click-to-walk steers until you touch a movement key.
    if (forward || strafe) shared.route = [];
    const wp = shared.route[0];
    if (wp) {
      const dx = wp[0] - s.x, dz = wp[1] - s.z;
      if (Math.hypot(dx, dz) < 0.6) shared.route.shift();
      else { s.yaw = Math.atan2(-dz, dx); forward = 1; strafe = 0; }
    }
    const bumped = step(world, s, { forward, strafe, sprint: k.sprint, crouch: k.crouch }, dt);
    if (bumped && shared.route.length) shared.route = [];

    const moving = Math.hypot(s.vx, s.vz) > 0.5;
    bob.current += moving && !reducedMotion() ? dt * 9 : 0;
    const eye = (s.crouch ? CROUCH_EYE : EYE) + (moving && !reducedMotion() ? Math.sin(bob.current) * 0.03 : 0);
    camera.position.set(s.x, s.y + eye, s.z);
    const dir = new THREE.Vector3(Math.cos(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.sin(s.yaw) * Math.cos(s.pitch));
    camera.lookAt(camera.position.clone().add(dir));

    // What's usable in front of you, within reach.
    let best: Target | null = null, bestD = 3.2;
    for (const t of tgts) {
      const to = t.pos.clone().sub(camera.position);
      const d = to.length();
      if (d < bestD && to.normalize().dot(dir) > 0.6) { best = t; bestD = d; }
    }
    if ((best?.id ?? null) !== lastTarget.current) { lastTarget.current = best?.id ?? null; shared.onTarget(best); }

    // Walking into something blocked: say what it is.
    if (bumped) {
      const here = new THREE.Vector3(s.x, s.y, s.z);
      const near = world.links.find((l) => !l.passable && linkPoint(l, l.at).setY(s.y).distanceTo(here) < 3.5);
      shared.onBlockedNear(near?.id ?? null);
    }
  });

  // Mouse look: pointer lock when granted; drag to look otherwise. Right button scans.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    const look = (dx: number, dy: number) => {
      const s = shared.walker;
      s.yaw -= dx * 0.0025;
      s.pitch = Math.max(-1.3, Math.min(1.3, s.pitch - dy * 0.0025));
    };
    const move = (e: MouseEvent) => { if (document.pointerLockElement === el || dragging) look(e.movementX, e.movementY); };
    const down = (e: MouseEvent) => {
      if (e.button === 2) { shared.mouseScan = true; return; }
      if (document.pointerLockElement !== el) {
        dragging = true;
        try { const p = el.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* drag to look instead */ }
      }
    };
    const up = (e: MouseEvent) => { if (e.button === 2) shared.mouseScan = false; dragging = false; };
    const menu = (e: Event) => e.preventDefault();
    el.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('mousemove', move); el.addEventListener('contextmenu', menu);
    return () => { el.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); el.removeEventListener('contextmenu', menu); };
  }, [gl, shared]);

  return null;
}

/** Scan tags: every place and part within range says what it's doing. */
function ScanTags({ world, shared, on }: { world: World; shared: Shared; on: boolean }) {
  if (!on) return null;
  const s = shared.walker;
  const near = (x: number, z: number) => Math.hypot(x - s.x, z - s.z) < 26;
  return (
    <>
      {world.plazas.filter((p) => near(p.center[0], p.center[1])).map((p) => (
        <Html key={`p${p.index}`} position={[p.center[0], p.height + 3.4, p.center[1]]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span className="scan-tag plaza">{p.volts === undefined ? '? V' : `${p.volts.toFixed(2)} V`}</span>
        </Html>
      ))}
      {world.links.map((l, i) => {
        const m = linkPoint(l, 0.5);
        if (!near(m.x, m.z)) return null;
        return (
          <Html key={`l${i}`} position={[m.x, Math.max(l.h0, l.h1) + 2.2, m.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <span className={`scan-tag ${l.passable ? '' : 'bad'}`}>{scanText(l)}</span>
          </Html>
        );
      })}
    </>
  );
}

function Fog({ clear }: { clear: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#cfe3f2');
    scene.fog = new THREE.FogExp2('#cfe3f2', 0.045);
  }, [scene]);
  useFrame((_, dt) => {
    const f = scene.fog as THREE.FogExp2 | null;
    if (f) f.density = THREE.MathUtils.damp(f.density, clear ? 0.012 : 0.045, 1.5, dt);
  });
  return null;
}

/** The power panel by the top of the stair: a big switch, lit pink when the loop is clear. */
function PanelProp({ world, armed }: { world: World; armed: boolean }) {
  const t = useMemo(() => targets(world).find((x) => x.kind === 'panel')!, [world]);
  const yaw = linkYaw(world.links[0]!, 1) + Math.PI;
  return (
    <group position={[t.pos.x, t.pos.y - 1.2, t.pos.z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[0.5, 1.2, 0.8]} /><meshStandardMaterial color="#2b2e31" /></mesh>
      <mesh position={[0, 1.25, 0]}><boxGeometry args={[0.35, 0.3, 0.5]} /><meshStandardMaterial color={armed ? '#ff48b0' : '#6b6450'} emissive="#ff48b0" emissiveIntensity={armed ? 0.8 : 0} /></mesh>
      {armed && <pointLight position={[0, 1.8, 0]} color="#ff48b0" intensity={6} distance={6} />}
    </group>
  );
}

// ---------------------------------------------------------------- the map (Tab)

function MapOverlay({ world, walker, onGo, onClose }: { world: World; walker: Walker; onGo: (plaza: number) => void; onClose: () => void }) {
  const xs = world.plazas.map((p) => p.center[0]), zs = world.plazas.map((p) => p.center[1]);
  const pad = 12;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const [fx, fz] = [Math.cos(walker.yaw), -Math.sin(walker.yaw)];
  return (
    <div className="cw-map-overlay" onClick={onClose}>
      <div className="cw-map-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="nb-kicker">Map · click a place to walk there · Tab to close</p>
        <svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} role="img" aria-label="Map of the circuit">
          {world.links.map((l, i) => {
            const m = linkPoint(l, 0.5);
            return (
              <g key={i}>
                <polyline points={l.path.map((p) => p.join(',')).join(' ')} fill="none" stroke={l.passable ? '#0078bf' : '#ff48b0'} strokeWidth={Math.max(1, l.width)} strokeDasharray={l.passable ? undefined : '2 1.5'} strokeLinecap="round" opacity="0.8" />
                <text x={m.x} y={m.z - 2.2} className="cw-map-label" textAnchor="middle">{l.id === 'GAP' ? 'no path' : l.id === 'SUPPLY' ? 'supply' : l.id}</text>
              </g>
            );
          })}
          {world.plazas.map((p) => (
            <g key={p.index} className="cw-map-place" onClick={() => onGo(p.index)}>
              <circle cx={p.center[0]} cy={p.center[1]} r={4.5} fill="#f1ece1" stroke="#1c0a3a" strokeWidth="0.5" />
              <text x={p.center[0]} y={p.center[1] + 1} textAnchor="middle" className="cw-map-volts">{p.volts === undefined ? '?' : `${p.volts.toFixed(1)} V`}</text>
            </g>
          ))}
          <g transform={`translate(${walker.x},${walker.z})`}>
            <circle r="1.6" fill="#ff48b0" />
            <line x1="0" y1="0" x2={fx * 4} y2={fz * 4} stroke="#ff48b0" strokeWidth="0.8" />
          </g>
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the mode

export function CircuitWorld({ onCleared, onGiveUp, rail }: {
  onCleared: () => void;
  /** Something here can only be fixed on the bench: check the level (it fails with the diagnosis) and go back. */
  onGiveUp: () => void;
  rail: ReactNode;
}) {
  const parts = useBench((s) => s.parts);
  const supply = useBench((s) => s.supply);
  const world = useMemo(() => { const b = { supply, parts }; return buildWorld(b, analyzeBoard(b)); }, [supply, parts]);
  const keys = useKeys();
  const shared = useRef<Shared>({ walker: spawnWalker(world), keys, route: [], mouseScan: false, onTarget: () => {}, onBlockedNear: () => {} }).current;
  const [target, setTarget] = useState<Target | null>(null);
  const [blockedNear, setBlockedNear] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [turning, setTurning] = useState<string | null>(null);
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [flowing, setFlowing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [intro, setIntro] = useState(!seen());
  const [landed, setLanded] = useState(false);
  shared.onTarget = setTarget;
  shared.onBlockedNear = setBlockedNear;
  // Dev only: browser tests steer the walker directly.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__signalPathWorld = { shared, world };
  }, [shared, world]);

  useEffect(() => { const t = setTimeout(() => setLanded(true), reducedMotion() ? 0 : 900); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onLock = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onLock);
    return () => { document.removeEventListener('pointerlockchange', onLock); if (document.pointerLockElement) document.exitPointerLock(); };
  }, []);
  // Scanning follows Q or the right mouse button.
  useEffect(() => {
    const id = setInterval(() => setScanning(keys.current.scan || shared.mouseScan), 80);
    return () => clearInterval(id);
  }, [keys, shared]);

  const clear = world.map.faults.length === 0 && world.closed;
  const benchOnly = !world.closed || world.map.loop.some((r) => r.fault === 'burnt');

  const use = (t: Target | null = target) => {
    if (!t || flowing) return;
    if (t.kind === 'door') {
      setTurning(t.id);
      setTimeout(() => { useBench.getState().flipPart(t.id); setTurning(null); }, reducedMotion() ? 0 : 1100);
    }
    if (t.kind === 'panel' && clear) {
      setFlowing(true);
      if (document.pointerLockElement) document.exitPointerLock();
      setTimeout(onCleared, reducedMotion() ? 800 : 4200);
    }
  };
  const hold = (t: Target | null, down: boolean) => {
    if (t?.kind !== 'bridge') return;
    // A toggle flips once per press and stays; a push button is held.
    const part = useBench.getState().parts.find((p) => p.id === t.id);
    if (part?.kind === 'toggle' || part?.kind === 'spdt') { if (down) useBench.getState().togglePress(t.id, !part.pressed); return; }
    useBench.getState().togglePress(t.id, down);
    setPressed((p) => { const n = new Set(p); if (down) n.add(t.id); else n.delete(t.id); return n; });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (intro) { setIntro(false); markSeen(); }
      if (e.code === 'KeyE' && !e.repeat) { use(); hold(target, true); }
      if (e.code === 'Tab') { e.preventDefault(); setShowMap((m) => !m); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'KeyE') hold(target, false); };
    const click = (e: MouseEvent) => { if (e.button === 0 && document.pointerLockElement) { use(); hold(target, true); } };
    const release = (e: MouseEvent) => { if (e.button === 0) hold(target, false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('mousedown', click); window.addEventListener('mouseup', release);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('mousedown', click); window.removeEventListener('mouseup', release); };
  });

  // One sentence: what to do now.
  const doorFault = world.links.find((l) => (l.kind === 'door' || l.kind === 'stair') && l.room?.fault === 'reversed');
  const shutDoor = world.links.find((l) => l.kind === 'door' && !l.passable && !l.room?.fault && l.id === blockedNear);
  const objective = flowing ? 'The current is going round: watch it flow downhill.'
    : clear ? 'The way is clear: switch the power on at the panel by the top of the stair.'
      : doorFault && blockedNear === doorFault.id ? `${doorFault.id}'s door faces you: it only opens the other way. Turn it round (E).`
        : shutDoor ? `${shutDoor.id} won't open: not enough voltage reaches it. Scan the way back to the source.`
        : benchOnly && blockedNear ? 'The way is broken here: this has to be fixed on the bench.'
          : benchOnly ? 'Find where the current can’t get round.'
            : 'Find why the current can’t get round. Hold Q to scan.';

  const prompt = target && !flowing
    ? target.kind === 'panel' && !clear ? 'The loop isn’t clear yet: nothing to switch on' : `E · ${target.label}`
    : null;

  return (
    <div className={`cw ${landed ? 'cw-in' : ''}`}>
      <Canvas className="cw-canvas" shadows camera={{ fov: 78, near: 0.05, far: 300 }} dpr={[1, 2]}>
        <Fog clear={flowing} />
        <ambientLight intensity={0.6} color="#fff6ea" />
        <hemisphereLight args={['#ffffff', '#6a8fb0', 0.55]} />
        <directionalLight position={[20, 40, 12]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
        <WorldView world={world} turning={turning} flowing={flowing} pressed={pressed} />
        <PanelProp world={world} armed={clear && !flowing} />
        <Player world={world} shared={shared} />
        <ScanTags world={world} shared={shared} on={scanning} />
      </Canvas>
      <div className="cw-halftone" aria-hidden />
      {!landed && <div className="cw-landing" aria-hidden />}
      {rail}
      <p className="cw-objective">{objective}</p>
      <div className="cw-crosshair" aria-hidden />
      {prompt && <p className="cw-prompt">{prompt}</p>}
      {!locked && !intro && landed && <p className="cw-hint">Click to look around · WASD move · Q scan · E use · Tab map</p>}
      {intro && landed && (
        <div className="cw-intro" role="dialog" aria-label="How to move">
          <h2>You're inside the circuit</h2>
          <p>Height is voltage. You start at the top of the supply's stair, and the current runs downhill from here.</p>
          <ul>
            <li><kbd>W A S D</kbd> move · <kbd>Shift</kbd> hurry · <kbd>C</kbd> crouch</li>
            <li><b>Mouse</b> look (click to capture it) · <kbd>← →</kbd> turn</li>
            <li><kbd>Q</kbd> or right button: <b>scan</b> voltages and currents</li>
            <li><kbd>E</kbd> or click: <b>use</b> · <kbd>Tab</kbd> map: click a place to walk there</li>
          </ul>
          <button className="desk-main" onClick={() => { setIntro(false); markSeen(); }}>Go</button>
        </div>
      )}
      {showMap && <MapOverlay world={world} walker={shared.walker} onClose={() => setShowMap(false)}
        onGo={(i) => { shared.route = routeTo(world, shared.walker, i); setShowMap(false); }} />}
      {!intro && !flowing && (clear
        ? <button className="desk-main" onClick={() => use({ kind: 'panel', id: 'PANEL', pos: new THREE.Vector3(), label: '' })}>⚡ Switch the power on</button>
        : benchOnly ? <button className="desk-main" onClick={onGiveUp}>‹ Back to the bench to fix it</button> : null)}
    </div>
  );
}
