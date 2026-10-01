/**
 * The repair mat: a real board on a grey cutting mat, like the reference. Point at a part for
 * its tooltip (value, tolerance and the range it should measure in). With the meter, click a
 * pad for the red probe (right-click for the black, which starts on a GND pin). With the iron,
 * hold the mouse (or E) on a part to take it off, or on a part sitting on its pads to solder
 * it. Pick a spare from the bar and click the empty pads to put it there. The USB plug powers
 * the board; powering up is the test.
 */
import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { DIAL, DIAL_LABEL } from '../desk/meter';
import { HotbarRow, type RowSlot } from '../desk/Hotbar';
import { ToolIcon } from '../desk/PartsTray';
import '../desk/desk.css';
import { formatSI } from '../lib/units';
import { Board, tooltip, type BoardDef, type Placed } from '../parts3d/boards';
import { repairJobById } from './jobs';
import { NETLISTS, type PadSpot } from './netlists';
import { repairReading, spotsOf, solveRepair, type Fitted, type RepairJob, type RepairState } from './repair';
import { useRepair, type RepairTool } from './store';
import { StudioEnvironment } from '../parts3d/common';

const TOP = 1.6; // the PCB's top face
const HOLD_MS = 900;

/** The board as it looks right now: parts taken off are gone, loose ones sit crooked, LEDs lit by the solver. */
function shownBoard(def: BoardDef, job: RepairJob, s: RepairState): BoardDef {
  const sol = solveRepair(job, s);
  const parts: Placed[] = [];
  for (const p of def.parts) {
    const f = s.fitted[p.id];
    if (f && !f.present) continue;
    let q: Placed = p;
    if (p.kind === 'chipLed') {
      const lit = !!f && !f.burnt && (sol.currents[p.id] ?? 0) > 2e-4;
      q = { ...q, props: { ...q.props, lit, color: f?.burnt ? '#3a3a36' : q.props?.color } };
    }
    if (f?.spare) {
      const spare = job.spares.find((x) => x.id === f.spare);
      if (spare && p.kind === 'chipR') q = { ...q, props: { ...q.props, code: spare.code } };
    }
    if (f && !f.soldered) q = { ...q, rot: (q.rot ?? 0) + 9 };
    parts.push(q);
  }
  return { ...def, parts };
}

function matTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5d6a66'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i <= 40; i++) {
    g.strokeStyle = i % 5 === 0 ? 'rgba(230,240,235,0.35)' : 'rgba(230,240,235,0.14)';
    g.lineWidth = i % 5 === 0 ? 2 : 1;
    const x = (i / 40) * 1024;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, x); g.lineTo(1024, x); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Mat() {
  const tex = useMemo(matTexture, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}

/** A meter probe standing on a pad: needle tip on the copper, handle leaning towards you. */
function Probe({ at, color }: { at: [number, number]; color: string }) {
  return (
    <group position={[at[0], TOP, at[1]]} rotation={[-0.45, 0, color === '#222' ? 0.25 : -0.25]}>
      <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.12, 0.02, 6, 10]} /><meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 14, 0]} castShadow><cylinderGeometry args={[1.6, 1.3, 16, 16]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
      <mesh position={[0, 6.6, 0]}><cylinderGeometry args={[2.2, 2.2, 0.8, 16]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
    </group>
  );
}

/** The USB lead: a plug in the socket and a cable off the edge of the mat. */
function UsbLead({ def, plugged }: { def: BoardDef; plugged: boolean }) {
  const j = def.parts.find((p) => p.id === 'J_USB');
  if (!j) return null;
  const x = j.at[0] - (plugged ? 13 : 40);
  return (
    <group position={[x, TOP + 5.5, j.at[1]]}>
      <mesh castShadow><boxGeometry args={[14, 11, 12.5]} /><meshStandardMaterial color="#2a2a2c" roughness={0.5} /></mesh>
      <mesh position={[-7, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[4.5, 5, 6, 16]} /><meshStandardMaterial color="#2a2a2c" roughness={0.5} /></mesh>
      <mesh position={[-80, -3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[2, 2, 150, 10]} /><meshStandardMaterial color="#1c1c1e" roughness={0.6} /></mesh>
    </group>
  );
}

/** Eases the orbit target (and distance) towards the part you clicked. */
function CameraRig() {
  const look = useRepair((s) => s.look);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    if (!controls) return;
    goal.current.set(look?.[0] ?? 0, TOP, look?.[1] ?? 0);
    const k = 1 - Math.exp(-dt * 5);
    const before = controls.target.clone();
    controls.target.lerp(goal.current, k);
    camera.position.add(controls.target.clone().sub(before));
    // Close in on a part, stand back for the whole board.
    const want = look ? 34 : 150;
    const off = camera.position.clone().sub(controls.target);
    const d = off.length();
    if (Math.abs(d - want) > 0.5 && (look || d < want)) camera.position.copy(controls.target).add(off.setLength(d + (want - d) * k));
    controls.update();
  });
  return null;
}

/** Status of a board part in plain words, for its tooltip. */
function partState(f: Fitted | undefined): string {
  if (!f) return '';
  if (f.burnt) return ' · burnt out';
  if (!f.soldered) return ' · sitting on its pads, not soldered';
  return '';
}

function Scene({ job, state, onHover, onHoverSpot }: {
  job: RepairJob; state: RepairState;
  onHover: (t: string | null) => void; onHoverSpot: (s: PadSpot | null) => void;
}) {
  const b = NETLISTS[job.board]!;
  const tool = useRepair((s) => s.tool);
  const red = useRepair((s) => s.red), black = useRepair((s) => s.black);
  const shown = useMemo(() => shownBoard(b.def, job, state), [b.def, job, state]);
  const spots = useMemo(() => spotsOf(job), [job]);
  const spotAt = (id: string | null) => spots.find((x) => x.id === id)?.at;
  const [hot, setHot] = useState<string | null>(null);
  const hold = useHold(state);

  const onPart = (p: Placed | null) => onHover(p ? `${tooltip(p, (x, u) => formatSI(x, u))}${partState(state.fitted[p.id])}` : null);
  // Footprints you can act on with the iron or a spare: every part in the netlist that has two pads.
  const footprints = Object.keys(b.net.parts).map((id) => b.def.parts.find((p) => p.id === id)!).filter(Boolean);

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#40505a', 0.45]} />
        <StudioEnvironment />
      <directionalLight position={[60, 140, 80]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} />
      <Mat />
      <group onPointerLeave={() => onPart(null)}>
        <Board def={shown} onHover={tool === 'hand' || tool === 'iron' ? onPart : undefined} />
      </group>
      <UsbLead def={b.def} plugged={state.power} />
      {tool === 'meter' && spots.map((s) => (
        <mesh key={s.id} position={[s.at[0], TOP + 0.35, s.at[1]]}
          onPointerOver={(e) => { e.stopPropagation(); setHot(s.id); onHoverSpot(s); }}
          onPointerOut={() => { setHot(null); onHoverSpot(null); }}
          onClick={(e) => { e.stopPropagation(); useRepair.getState().probe(s.id, e.shiftKey ? 'black' : 'red'); }}
          onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); useRepair.getState().probe(s.id, 'black'); }}>
          <cylinderGeometry args={[0.75, 0.75, 0.5, 16]} />
          <meshBasicMaterial color={hot === s.id ? '#ffe800' : '#ff48b0'} transparent opacity={hot === s.id ? 0.85 : 0.28} depthWrite={false} />
        </mesh>
      ))}
      {(tool === 'iron' || tool.startsWith('spare:')) && footprints.map((p) => {
        const f = state.fitted[p.id];
        const empty = !!f && !f.present;
        const size = p.kind === 'elec' ? 8 : 2.6;
        return (
          <mesh key={p.id} position={[p.at[0], TOP + 0.4, p.at[1]]} rotation={[0, ((p.rot ?? 0) * Math.PI) / 180, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHot(p.id); onHover(empty ? `${p.id} · empty pads${tool.startsWith('spare:') ? ': click to put the spare here' : ''}` : `${tooltip(p, (x, u) => formatSI(x, u))}${partState(f)}${tool === 'iron' ? ' · hold to ' + (f?.soldered ? 'take it off' : 'solder it') : ''}`); }}
            onPointerOut={() => { setHot(null); onHover(null); hold.cancel(); }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => { if (e.button !== 0) return; e.stopPropagation(); if (tool === 'iron') hold.begin(p.id); }}
            onPointerUp={() => hold.cancel()}
            onClick={(e) => {
              e.stopPropagation();
              if (tool.startsWith('spare:')) useRepair.getState().apply({ kind: 'place', part: p.id, spare: tool.slice(6) });
            }}>
            <boxGeometry args={[size, 0.8, size * 0.65]} />
            <meshBasicMaterial color={hot === p.id ? '#ffe800' : empty ? '#0078bf' : '#ffffff'} transparent opacity={hot === p.id ? 0.55 : empty ? 0.35 : 0.08} depthWrite={false} />
          </mesh>
        );
      })}
      {hold.part && (() => {
        const p = b.def.parts.find((x) => x.id === hold.part)!;
        return (
          <Html position={[p.at[0], TOP + 3, p.at[1]]} center style={{ pointerEvents: 'none' }}>
            <div className="repair-hold"><i style={{ width: `${Math.round(hold.progress * 100)}%` }} /></div>
          </Html>
        );
      })()}
      {spotAt(red) && <Probe at={spotAt(red)!} color="#e8413c" />}
      {spotAt(black) && <Probe at={spotAt(black)!} color="#222" />}
      <HoldKey hot={tool === 'iron' ? hot : null} hold={hold} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.3} minDistance={8} maxDistance={180} enablePan={false} />
      <CameraRig />
    </>
  );
}

/** Holding the iron on a part: after HOLD_MS it comes off (or, if it's loose, gets soldered). */
function useHold(state: RepairState) {
  const [part, setPart] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const t0 = useRef(0);
  useFrame(() => {
    if (!part) return;
    const k = Math.min(1, (performance.now() - t0.current) / HOLD_MS);
    setProgress(k);
    if (k >= 1) {
      const f = state.fitted[part];
      const st = useRepair.getState();
      if (f?.present && f.soldered) st.apply({ kind: 'desolder', part });
      else if (f?.present) st.apply({ kind: 'solder', part });
      else useRepair.setState({ notice: `Nothing on ${part}’s pads to heat: pick a spare from the bar and click the pads.` });
      setPart(null); setProgress(0);
    }
  });
  return {
    part, progress,
    begin: (id: string) => { t0.current = performance.now(); setPart(id); setProgress(0); },
    cancel: () => { setPart(null); setProgress(0); },
  };
}

/** E does what holding the mouse does, on the part under the pointer. */
function HoldKey({ hot, hold }: { hot: string | null; hold: ReturnType<typeof useHold> }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if ((e.key === 'e' || e.key === 'E') && !e.repeat && hot) hold.begin(hot); };
    const up = (e: KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') hold.cancel(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [hot, hold]);
  return null;
}

// ---------------------------------------------------------------- the screen

const IronIcon = () => <svg viewBox="0 0 32 20" aria-hidden><path d="M3 17 L13 9" stroke="#b9c2bd" strokeWidth="2" strokeLinecap="round" /><rect x="12" y="4" width="17" height="7" rx="3" transform="rotate(-38 20 8)" fill="#0078bf" /></svg>;
function SpareIcon({ code, led }: { code: string; led: boolean }) {
  return led
    ? <svg viewBox="0 0 32 20" aria-hidden><rect x="10" y="6" width="12" height="8" fill="#f4f4f0" stroke="#999" /><rect x="12" y="8" width="8" height="4" fill="#39d86a" /></svg>
    : <svg viewBox="0 0 32 20" aria-hidden><rect x="6" y="5" width="20" height="10" fill="#141414" /><rect x="6" y="5" width="3" height="10" fill="#c9ccd2" /><rect x="23" y="5" width="3" height="10" fill="#c9ccd2" /><text x="16" y="13" fontSize="6" fill="#eee" textAnchor="middle" fontFamily="monospace">{code}</text></svg>;
}

export function RepairBench({ jobId, onExit }: { jobId: string; onExit: () => void }) {
  const r = useRepair();
  const [hover, setHover] = useState<string | null>(null);
  const [spot, setSpot] = useState<PadSpot | null>(null);
  const [mouse, setMouse] = useState<[number, number]>([0, 0]);
  const [more, setMore] = useState(false);

  useEffect(() => { useRepair.getState().start(jobId, groundPin(jobId)); }, [jobId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (useRepair.getState().look) useRepair.getState().lookAt(null); else onExit(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const slots: RowSlot[] = useMemo(() => {
    if (!r.job) return [];
    const base: RowSlot[] = [
      { id: 'hand', key: 1, label: 'Hand', icon: <ToolIcon tool="select" /> },
      { id: 'meter', key: 2, label: 'Meter', icon: <ToolIcon tool="probe" /> },
      { id: 'iron', key: 3, label: 'Iron', icon: <IronIcon /> },
    ];
    return [...base, ...r.job.spares.slice(0, 5).map((s, i) => ({ id: `spare:${s.id}`, key: 4 + i, label: s.fits === 'led' ? 'LED' : s.code, icon: <SpareIcon code={s.code} led={s.fits === 'led'} /> }))];
  }, [r.job]);

  if (!r.job || !r.state) return null;
  const job = r.job, state = r.state;
  const reading = repairReading(job, state, r.mode, r.red, r.black);
  const spots = spotsOf(job);
  const name = (id: string | null) => spots.find((x) => x.id === id)?.label ?? 'nothing';
  const spareInHand = r.tool.startsWith('spare:') ? job.spares.find((s) => `spare:${s.id}` === r.tool) : undefined;
  const toolHint: Record<string, string> = {
    hand: 'Point at a part to read it. Click one to look closer (Esc to stand back).',
    meter: 'Click a pad for the red probe. Right-click (or shift-click) for the black one.',
    iron: 'Hold the mouse, or E, on a part: it comes off. Hold on a loose part to solder it.',
  };

  return (
    <div className="repair" onPointerMove={(e) => setMouse([e.clientX, e.clientY])}>
      <Canvas shadows camera={{ position: [0, 125, 82], fov: 38, near: 0.5, far: 2000 }} dpr={[1, 2]} onPointerMissed={() => r.tool === 'hand' && r.lookAt(null)}>
        <color attach="background" args={['#4a5553']} />
        <Scene job={job} state={state} onHover={setHover} onHoverSpot={setSpot} />
        <HandPicker />
      </Canvas>

      <button className="desk-back" onClick={onExit}>‹ Workshop <kbd>Esc</kbd></button>

      <section className="repair-card" aria-label="Job">
        <p className="nb-kicker">Board repair · {NETLISTS[job.board]!.def.name}</p>
        <h2>{job.title}</h2>
        <p className="repair-goal">{job.goal}</p>
        {more && (
          <>
            <p className="repair-story">{job.story}</p>
            <p className="desk-result-skill"><b>You’ll use this</b>{job.skill} {job.realLife}</p>
          </>
        )}
        <div className="nb-row">
          <button className="nb-link" onClick={() => setMore(!more)}>{more ? 'Less' : 'The story, and why it matters'}</button>
          <button className="nb-link" onClick={r.hint} disabled={r.hints >= job.hints.length}>Hint {r.hints}/{job.hints.length}</button>
        </div>
        {r.hints > 0 && <ol className="repair-hints">{job.hints.slice(0, r.hints).map((h) => <li key={h}>{h}</li>)}</ol>}
      </section>

      <div className="repair-power">
        <button className={`desk-chip ${state.power ? 'on' : ''}`} onClick={() => r.apply({ kind: 'power', on: !state.power })}>
          {state.power ? '⏻ Unplug USB' : '⏻ Plug in USB'}
        </button>
        <span className="repair-status">{state.power ? 'Powered from USB · 5 V' : 'Unpowered: safe to solder'}</span>
      </div>

      {hover && <div className="desk-tag repair-tip" style={{ left: mouse[0], top: mouse[1] - 22 }}>{hover}</div>}
      {spot && !hover && <div className="desk-tag repair-tip" style={{ left: mouse[0], top: mouse[1] - 22 }}>{spot.label} · {spot.net === 'GND' ? 'ground' : `net ${spot.net}`}</div>}

      <div className="tray">
        {r.notice && <p className="repair-notice" role="status">{r.notice}</p>}
        {r.tool === 'meter' ? (
          <div className="tray-context">
            <span className="desk-pict"><span className="dot red" /> {name(r.red)} <span className="dot black" /> {name(r.black)}</span>
            <span className={`desk-reading ${r.mode}`}>{r.mode === 'off' ? 'OFF' : `${reading.text} ${reading.unit}`}</span>
            <span className="meter-modes" role="radiogroup" aria-label="Meter dial">
              {DIAL.map((m) => <button key={m} role="radio" aria-checked={r.mode === m} className={r.mode === m ? 'on' : ''} onClick={() => r.setMode(m)}>{DIAL_LABEL[m]}</button>)}
            </span>
          </div>
        ) : (
          <div className="tray-context"><span className="desk-pict"><span className="dot pink" /> {spareInHand ? `${spareInHand.name}: click the empty pads to put it there, then solder it with the iron.` : toolHint[r.tool]}</span></div>
        )}
        {r.tool === 'meter' && reading.note && <p className="repair-note">{reading.note}</p>}
        <HotbarRow slots={slots} lit={r.tool} onPick={(id) => r.setTool(id as RepairTool)} />
      </div>

      {r.result && (
        <div className="desk-result" role="dialog" aria-label="Job result">
          <h2>Board fixed</h2>
          <div className="desk-stars" aria-label={`${r.result.stars} of 3 stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= r.result!.stars ? 'on' : ''}>★</span>)}</div>
          <p className="desk-result-sub">{r.result.message}</p>
          <ul className="star-rules">{r.result.rules.map((x, i) => <li key={x.text} className={x.met ? 'met' : ''}><span className="star-rule-stars">{'★'.repeat(i + 1)}</span><b>{x.text}</b></li>)}</ul>
          <p className="desk-result-skill"><b>You can now</b>{job.skill.charAt(0).toLowerCase() + job.skill.slice(1)}</p>
          <button className="desk-main" autoFocus onClick={onExit}>Back to the workshop</button>
        </div>
      )}
    </div>
  );
}

/** With the hand, clicking a part looks closer at it. */
function HandPicker() {
  const tool = useRepair((s) => s.tool);
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    if (tool !== 'hand') return;
    const ray = new THREE.Raycaster();
    const onClick = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(scene.children, true).find((h) => h.point.y > TOP + 0.05 && h.point.y < 40);
      if (hit) useRepair.getState().lookAt([hit.point.x, hit.point.z]);
    };
    gl.domElement.addEventListener('click', onClick);
    return () => gl.domElement.removeEventListener('click', onClick);
  }, [tool, gl, camera, scene]);
  return null;
}

/** The first GND pin on the job's board: where the black probe starts. */
function groundPin(jobId: string): string {
  const job = repairJobById(jobId);
  const spots = job ? spotsOf(job) : [];
  return spots.find((s) => s.net === 'GND' && !s.part)?.id ?? '';
}
