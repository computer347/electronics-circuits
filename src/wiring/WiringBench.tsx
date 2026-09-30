/**
 * The wiring bench: the board and a module on the mat. Click one of the module's pins, then a
 * pin on the board's header, and a jumper wire joins them (click a wire to take it out). The
 * panel on the left does the same with lists, for anyone who'd rather pick by name. Plug in
 * the USB to power it: the serial monitor shows what the sketch reads.
 */
import { Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import '../desk/desk.css';
import { Board } from '../parts3d/boards';
import { NETLISTS, type PadSpot } from '../repair/netlists';
import { powerUp, wireColor, wiringJobById, wiringSpots, DHT11_JOB, type Wire, type WiringJob, type WiringResult } from './wiring';

const TOP = 1.6;
const MODULE_PIN_Y = TOP + 7.5; // top of a male header pin
const BOARD_PIN_Y = TOP + 8.5; // top of a female header

function Jumper({ a, b, color, onClick }: { a: THREE.Vector3; b: THREE.Vector3; color: string; onClick: () => void }) {
  const geom = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = 10 + a.distanceTo(b) * 0.18;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().setY(a.y + 6), mid.clone().setY(mid.y + lift), b.clone().setY(b.y + 6), b]);
    return new THREE.TubeGeometry(curve, 64, 0.7, 10, false);
  }, [a, b]);
  return (
    <mesh geometry={geom} castShadow onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  );
}

function PinTarget({ s, y, picked, onPick, onHover }: { s: PadSpot; y: number; picked: boolean; onPick: () => void; onHover: (s: PadSpot | null) => void }) {
  const [hot, setHot] = useState(false);
  return (
    <mesh position={[s.at[0], y, s.at[1]]}
      onPointerOver={(e) => { e.stopPropagation(); setHot(true); onHover(s); }} onPointerOut={() => { setHot(false); onHover(null); }}
      onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <boxGeometry args={[2.2, 1.2, 2.2]} />
      <meshBasicMaterial color={picked ? '#ff48b0' : hot ? '#ffe800' : '#ffffff'} transparent opacity={picked ? 0.85 : hot ? 0.7 : 0.12} depthWrite={false} />
    </mesh>
  );
}

export function WiringBench({ jobId, onExit }: { jobId: string; onExit: () => void }) {
  const job: WiringJob = wiringJobById(jobId) ?? DHT11_JOB;
  const spots = useMemo(() => wiringSpots(job), [job]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<PadSpot | null>(null);
  const [mouse, setMouse] = useState<[number, number]>([0, 0]);
  const [power, setPower] = useState<WiringResult | null>(null);
  const [serial, setSerial] = useState<string[]>([]);
  const [dead, setDead] = useState(false);
  const [powerUps, setPowerUps] = useState(0);
  const [cooked, setCooked] = useState(false);
  const [hints, setHints] = useState(0);
  const [more, setMore] = useState(false);
  const [sketch, setSketch] = useState(false);
  const [result, setResult] = useState<{ stars: 1 | 2 | 3 } | null>(null);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (picked) setPicked(null); else onExit(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, picked]);
  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  const modDef = NETLISTS[job.module]!.def, boardDef = NETLISTS[job.board]!.def;
  const isModule = (id: string) => id.startsWith('m:');
  const spotOf = (id: string) => spots.module.find((s) => s.id === id) ?? spots.board.find((s) => s.id === id);
  const point = (id: string) => { const s = spotOf(id)!; return new THREE.Vector3(s.at[0], isModule(id) ? MODULE_PIN_Y : BOARD_PIN_Y, s.at[1]); };

  const unplug = () => { if (tick.current) clearInterval(tick.current); tick.current = null; setPower(null); setSerial([]); };
  const connect = (from: string, to: string) => {
    if (power) unplug();
    // One wire per pin: a new wire from a module pin replaces its old one; a board pin can take several.
    setWires((ws) => [...ws.filter((w) => w.from !== from), { from, to }]);
  };
  const pick = (id: string) => {
    if (!picked) { setPicked(id); return; }
    if (picked === id) { setPicked(null); return; }
    if (isModule(picked) === isModule(id)) { setPicked(id); return; }
    connect(isModule(picked) ? picked : id, isModule(picked) ? id : picked);
    setPicked(null);
  };
  const plugIn = () => {
    if (dead) return;
    const r = powerUp(job, wires);
    setPower(r);
    setPowerUps((n) => n + 1);
    setSerial([]);
    if (r.outcome === 'reversed') { setDead(true); setCooked(true); return; }
    let i = 0;
    // The sketch waits two seconds between readings; the monitor fills in the same rhythm.
    tick.current = window.setInterval(() => {
      setSerial((s) => [...s.slice(-8), r.serial[i % r.serial.length]!]);
      i++;
      if (r.outcome === 'ok' && i === 2) setResult({ stars: cooked ? 1 : powerUps === 0 ? 3 : 2 });
    }, 1100);
  };

  const label = (s: PadSpot | undefined) => (s ? s.label.replace(/ pin$/, '') : '');
  const boardOptions = spots.board.filter((s) => s.net !== 'NC');
  // Several pins share a name (three GNDs): say which header each is on.
  const headerName = (s: PadSpot) => boardDef.parts.find((p) => p.id === s.id.slice(2).split('.')[0])?.name?.toLowerCase() ?? '';

  return (
    <div className="repair wiring" onPointerMove={(e) => setMouse([e.clientX, e.clientY])}>
      <Canvas shadows camera={{ position: [4, 122, 98], fov: 38, near: 0.5, far: 2000 }} dpr={[1, 2]} onPointerMissed={() => setPicked(null)}>
        <color attach="background" args={['#4a5553']} />
        <ambientLight intensity={0.55} /><hemisphereLight args={['#ffffff', '#40505a', 0.45]} />
        <directionalLight position={[60, 140, 80]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-150} shadow-camera-right={150} shadow-camera-top={150} shadow-camera-bottom={-150} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow><planeGeometry args={[500, 500]} /><meshStandardMaterial color="#5d6a66" roughness={0.95} /></mesh>
        <Board def={boardDef} />
        <group position={[job.moduleAt[0], 0, job.moduleAt[1]]}><Board def={modDef} /></group>
        {dead && (
          <Html position={[job.moduleAt[0] - 4, 18, job.moduleAt[1]]} center style={{ pointerEvents: 'none' }}><span className="wiring-smoke">burnt</span></Html>
        )}
        {spots.module.map((s) => <PinTarget key={s.id} s={s} y={MODULE_PIN_Y} picked={picked === s.id} onPick={() => pick(s.id)} onHover={setHover} />)}
        {spots.board.map((s) => <PinTarget key={s.id} s={s} y={BOARD_PIN_Y} picked={picked === s.id} onPick={() => pick(s.id)} onHover={setHover} />)}
        {wires.map((w) => <Jumper key={w.from} a={point(w.from)} b={point(w.to)} color={wireColor(job, w.from)} onClick={() => { if (power) unplug(); setWires((ws) => ws.filter((x) => x !== w)); }} />)}
        <OrbitControls makeDefault target={[4, 0, 6]} maxPolarAngle={Math.PI / 2.3} minDistance={30} maxDistance={260} enablePan={false} />
      </Canvas>

      <button className="desk-back" onClick={onExit}>‹ Workshop <kbd>Esc</kbd></button>

      <section className="repair-card" aria-label="Job">
        <p className="nb-kicker">Wiring · {boardDef.name} + {modDef.name}</p>
        <h2>{job.title}</h2>
        <p className="repair-goal">{job.goal}</p>
        {more && (<><p className="repair-story">{job.story}</p><p className="desk-result-skill"><b>You’ll use this</b>{job.skill} {job.realLife}</p></>)}
        <div className="nb-row">
          <button className="nb-link" onClick={() => setMore(!more)}>{more ? 'Less' : 'The story, and why it matters'}</button>
          <button className="nb-link" onClick={() => setHints(Math.min(job.hints.length, hints + 1))} disabled={hints >= job.hints.length}>Hint {hints}/{job.hints.length}</button>
          <button className="nb-link" onClick={() => setSketch(!sketch)}>{sketch ? 'Hide the sketch' : 'Read the sketch'}</button>
        </div>
        {hints > 0 && <ol className="repair-hints">{job.hints.slice(0, hints).map((h) => <li key={h}>{h}</li>)}</ol>}
        {sketch && <pre className="coding-sketch small">{job.sketch}</pre>}
        <h3 className="wiring-h">Wires</h3>
        <ul className="wiring-list">
          {spots.module.map((m) => {
            const w = wires.find((x) => x.from === m.id);
            return (
              <li key={m.id}>
                <i style={{ background: wireColor(job, m.id) }} />
                <b>{label(m)}</b> →
                <select value={w?.to ?? ''} aria-label={`${label(m)} goes to`} onChange={(e) => (e.target.value ? connect(m.id, e.target.value) : setWires((ws) => ws.filter((x) => x.from !== m.id)))}>
                  <option value="">not wired</option>
                  {boardOptions.map((s) => <option key={s.id} value={s.id}>{label(s)}{s.net === 'GND' ? ` (${headerName(s)})` : ''}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="repair-power">
        <button className={`desk-chip ${power ? 'on' : ''}`} onClick={() => (power ? unplug() : plugIn())} disabled={dead && !power}>
          {power ? '⏻ Unplug USB' : '⏻ Plug in USB'}
        </button>
        <span className="repair-status">{power ? `Powered · ${power.supply.toFixed(1)} V across the module` : 'Unplugged: safe to rewire'}</span>
      </div>

      <div className="wiring-monitor" role="log" aria-live="polite" aria-label="Serial monitor">
        <p className="wiring-monitor-head">Serial monitor · 9600 baud</p>
        {serial.map((l, i) => <p key={i} className={l.startsWith('Failed') ? 'bad' : ''}>{l}</p>)}
        {power?.why && serial.length > 0 && <p className="why">{power.why}</p>}
        {power?.outcome === 'reversed' && <p className="why">{power.why}</p>}
        {dead && (
          <button className="desk-chip" onClick={() => { unplug(); setDead(false); }}>Fit a new module</button>
        )}
        {!power && !dead && <p className="dim">{picked ? `Now click a pin on the ${isModule(picked) ? 'Uno' : 'module'} (Esc to let go).` : 'Click a module pin, then a Uno pin. Click a wire to take it out.'}</p>}
      </div>

      {hover && <div className="desk-tag repair-tip" style={{ left: mouse[0], top: mouse[1] - 22 }}>{hover.id.startsWith('m:') ? `${modDef.name} · ` : ''}{hover.label}{hover.net === 'NC' ? ' · not connected' : ''}</div>}

      {result && (
        <div className="desk-result" role="dialog" aria-label="Job result">
          <h2>Reading the greenhouse</h2>
          <div className="desk-stars" aria-label={`${result.stars} of 3 stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= result.stars ? 'on' : ''}>★</span>)}</div>
          <p className="desk-result-sub">{job.okLine}</p>
          <ul className="star-rules">
            <li className="met"><span className="star-rule-stars">★</span><b>The sketch reads the sensor</b></li>
            <li className={result.stars >= 2 ? 'met' : ''}><span className="star-rule-stars">★★</span><b>Nothing cooked</b></li>
            <li className={result.stars >= 3 ? 'met' : ''}><span className="star-rule-stars">★★★</span><b>Right first time you powered it</b></li>
          </ul>
          <p className="desk-result-skill"><b>You can now</b>{job.skill.charAt(0).toLowerCase() + job.skill.slice(1)}</p>
          <button className="desk-main" autoFocus onClick={onExit}>Back to the workshop</button>
        </div>
      )}
    </div>
  );
}
