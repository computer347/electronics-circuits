/**
 * The Parts Lab bench: one part on the mat, its catalogue card, and one task. Probes go on legs
 * by name (the legs are numbered left to right as the part faces you), the meter shows what
 * the solver says, and the answer explains itself. Right first time, without the hint, is
 * three stars.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import '../desk/desk.css';
import { DIAL_LABEL, type MeterMode } from '../desk/meter';
import { useWallet } from '../jobs/wallet';
import { formatSI } from '../lib/units';
import { CATALOGUE } from '../parts/catalogue';
import { BOARDS, Board, tooltip, type Placed } from '../parts3d/boards';
import { MODELS } from '../parts3d/registry';
import { dialVolts, LABS, labByPart, labReading, type LabSpec } from './labs';
import { LOOKS } from './looks';

/**
 * Magnify a part so it fills about 60 mm of the view (an 0402 is a millimetre long), and no
 * more than 45 mm tall counting its legs.
 */
export const zoomOf = (part: string, model: string) => {
  const s = MODELS[model]?.size ?? [10, 10, 10];
  return Math.max(0.8, Math.min(40, 60 / Math.max(s[0], s[1]), 45 / (s[2] + (LOOKS[part]?.lift ?? 0))));
};
/** Height of the part on the mat, for aiming the camera at its middle. */
const heightOf = (part: string, model: string) => ((MODELS[model]?.size[2] ?? 10) + (LOOKS[part]?.lift ?? 0)) * zoomOf(part, model);

function PartOnMat({ part, model }: { part: string; model: string }) {
  const z = zoomOf(part, model);
  const look = LOOKS[part];
  return (
    <group scale={z} position={[0, (look?.lift ?? 0) * z, 0]} rotation={[0, look?.rotY ?? 0, 0]}>
      {look ? look.render() : MODELS[model]?.render()}
    </group>
  );
}

/** A board you can point at; a click picks the part under the pointer. */
function PickBoard({ board, onPick, onHover, picked }: { board: string; onPick: (p: Placed) => void; onHover: (p: Placed | null) => void; picked: string | null }) {
  const def = BOARDS.find((b) => b.id === board)!;
  const hovered = useRef<Placed | null>(null);
  const scale = Math.min(1.3, 72 / Math.max(def.w, def.d));
  const p = picked ? def.parts.find((x) => x.id === picked) : undefined;
  return (
    <group scale={scale} position={[22, 0, 0]} onClick={(e) => { e.stopPropagation(); if (hovered.current) onPick(hovered.current); }}>
      <Board def={def} onHover={(x) => { hovered.current = x; onHover(x); }} />
      {p && (
        <mesh position={[p.at[0], 2, p.at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4, 5, 32]} />
          <meshBasicMaterial color="#ff48b0" />
        </mesh>
      )}
    </group>
  );
}

type Answer = { right: boolean; text: string };
const SPOILERS: LabSpec['kind'][] = ['pins', 'read', 'identify'];

export function LabBench({ part, onExit, onNext }: { part: string; onExit: () => void; onNext: (part: string) => void }) {
  const spec = labByPart(part)!;
  const entry = CATALOGUE.find((c) => c.id === part)!;
  const [red, setRed] = useState<number | null>(null);
  const [black, setBlack] = useState<number | null>(null);
  const [mode, setMode] = useState<MeterMode>(spec.kind === 'sort' ? spec.mode : spec.kind === 'pins' ? spec.modes[0] ?? 'off' : 'off');
  const [pos, setPos] = useState(0.15);
  const [tries, setTries] = useState(0);
  const [hinted, setHinted] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [hover, setHover] = useState<Placed | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [mouse, setMouse] = useState<[number, number]>([0, 0]);
  const done = answer?.right ?? false;

  // (Each part gets a fresh bench: App keys this component by part.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const stars: 1 | 2 | 3 = tries <= 1 && !hinted ? 3 : tries <= 2 ? 2 : 1;
  const settle = (right: boolean, text: string) => {
    const n = tries + 1;
    setTries(n);
    setAnswer({ right, text });
    if (right) useWallet.getState().complete(`lab:${part}`, n <= 1 && !hinted ? 3 : n <= 2 ? 2 : 1);
  };

  const reading = labReading(spec, mode, red, black);
  const legs = spec.kind === 'pins' ? spec.legs : spec.kind === 'sort' ? ['leg 1', 'leg 2'] : [];
  const meterModes: MeterMode[] = spec.kind === 'sort' ? ['off', 'V', 'Ω', 'diode'] : spec.kind === 'pins' ? ['off', ...spec.modes] : [];
  const index = LABS.findIndex((l) => l.part === part);
  const next = LABS[index + 1]?.part;
  const volts = spec.kind === 'dial' ? dialVolts(spec, pos) : 0;

  const answers = useMemo(() => {
    switch (spec.kind) {
      case 'sort': return (['keep', 'bin'] as const).map((k) => ({ label: k === 'keep' ? 'Keep it' : 'Bin it', go: () => settle(k === spec.answer, k === spec.answer ? spec.explain : `Not quite. ${spec.hint}`) }));
      case 'pins': return spec.legs.map((l, i) => ({ label: l, go: () => settle(i === spec.answer, i === spec.answer ? spec.explain : `Not ${l}. ${spec.hint}`) }));
      case 'read': return spec.options.map((o, i) => ({ label: o, go: () => settle(i === spec.answer, i === spec.answer ? spec.explain : `Not ${o}. ${spec.hint}`) }));
      case 'use': return spec.options.map((o, i) => ({ label: o, go: () => { const r = spec.outcome(i); settle(r.ok, `${r.says} ${r.ok ? spec.explain : spec.hint}`); } }));
      default: return [];
    }
  }, [spec, tries, hinted]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="repair lab" onPointerMove={(e) => setMouse([e.clientX, e.clientY])}>
      <Canvas shadows camera={{ position: [0, 90, 110], fov: 36, near: 0.5, far: 2000 }} dpr={[1, 2]}>
        <color attach="background" args={['#4a5553']} />
        <ambientLight intensity={0.6} /><hemisphereLight args={['#ffffff', '#40505a', 0.45]} />
        <directionalLight position={[60, 140, 80]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow><planeGeometry args={[500, 500]} /><meshStandardMaterial color="#5d6a66" roughness={0.95} /></mesh>
        {spec.kind === 'identify'
          ? <PickBoard board={spec.board} picked={picked} onHover={setHover} onPick={(p) => {
              if (done) return;
              setPicked(p.id);
              settle(p.id === spec.target, p.id === spec.target ? spec.explain : `That’s the ${p.name ?? p.id}. ${spec.hint}`);
            }} />
          : <PartOnMat part={part} model={entry.model} />}
        <OrbitControls makeDefault target={[spec.kind === 'identify' ? 22 : 0, spec.kind === 'identify' ? -12 : -heightOf(part, entry.model) * 0.18 - 4, 0]} maxPolarAngle={Math.PI / 2.2} minDistance={30} maxDistance={300} enablePan={false} />
      </Canvas>

      <button className="desk-back" onClick={onExit}>‹ Parts Lab <kbd>Esc</kbd></button>

      <section className="repair-card lab-card" aria-label="Part">
        <p className="nb-kicker">Parts Lab · {index + 1} of {LABS.length} · {entry.package}</p>
        <h2>{entry.name}</h2>
        <p>{entry.job}</p>
        {/* For finding pins, reading markings and spotting parts, the datasheet would give it away: it opens once you've answered. */}
        {done || !SPOILERS.includes(spec.kind)
          ? <ul className="lab-facts">{entry.facts.map((f) => <li key={f.label}><b>{f.label}</b> {f.text}</li>)}</ul>
          : <p className="lab-facts-later">The datasheet notes open once you’ve answered.</p>}
        {spec.kind === 'sort' && <p className="lab-label">{spec.label}</p>}
        <p className="desk-result-skill"><b>You’ll learn to</b>{spec.skill.charAt(0).toLowerCase() + spec.skill.slice(1)} {spec.why}</p>
      </section>

      <div className="tray lab-tray">
        <p className="lab-ask">{spec.ask}</p>
        {spec.kind !== 'identify' && zoomOf(part, entry.model) >= 2 && <span className="lab-legs">shown ×{Math.round(zoomOf(part, entry.model))} · real size {entry.package.match(/\(([^)]*)\)/)?.[1] ?? `${MODELS[entry.model]?.size[0]} mm across`}</span>}
        {legs.length > 0 && meterModes.length <= 1 && <span className="lab-legs">{legs.join('  ·  ')} <small>look at the can</small></span>}
        {meterModes.length > 1 && (
          <div className="tray-context lab-meter">
            <span className="lab-probe">
              <span className="dot red" />
              {legs.map((l, i) => <button key={l} className={red === i ? 'on' : ''} onClick={() => setRed(i)}>{l}</button>)}
            </span>
            <span className="lab-probe">
              <span className="dot black" />
              {legs.map((l, i) => <button key={l} className={black === i ? 'on' : ''} onClick={() => setBlack(i)}>{l}</button>)}
            </span>
            <small className="lab-legs-note">legs left to right, as it faces you</small>
            <span className={`desk-reading ${mode}`}>{mode === 'off' ? 'OFF' : `${reading.text} ${reading.unit}`}</span>
            <span className="meter-modes" role="radiogroup" aria-label="Meter dial">
              {meterModes.map((m) => <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{DIAL_LABEL[m]}</button>)}
            </span>
          </div>
        )}
        {reading.note && <p className="repair-note">{reading.note}</p>}
        {spec.kind === 'dial' && (
          <div className="tray-context">
            <label className="lab-dial">knob <input type="range" min={0} max={1} step={0.01} value={pos} onChange={(e) => setPos(Number(e.target.value))} disabled={done} /></label>
            <span className="desk-reading V">{volts.toFixed(3)} V</span>
            <button className="desk-chip" disabled={done} onClick={() => settle(volts >= spec.target[0] && volts <= spec.target[1], volts >= spec.target[0] && volts <= spec.target[1] ? spec.explain : `${volts.toFixed(2)} V. ${spec.hint}`)}>That’s it</button>
          </div>
        )}
        {answers.length > 0 && (
          <div className="lab-answers" role="group" aria-label="Your answer">
            {answers.map((a) => <button key={a.label} className="desk-chip" disabled={done} onClick={a.go}>{a.label}</button>)}
          </div>
        )}
        {spec.kind === 'identify' && !done && <p className="repair-note">Point at parts for their names; click the one you mean.</p>}
        {answer && <p className={`lab-verdict ${answer.right ? 'right' : 'wrong'}`} role="status"><b>{answer.right ? `Right · ${'★'.repeat(stars)}` : 'Not quite'}</b> {answer.text}</p>}
        <div className="nb-row lab-row">
          {!done && <button className="nb-link" onClick={() => setHinted(true)} disabled={hinted}>{hinted ? spec.hint : 'Hint'}</button>}
          {done && next && <button className="desk-main lab-next" autoFocus onClick={() => onNext(next)}>Next part: {CATALOGUE.find((c) => c.id === next)?.name} →</button>}
          {done && !next && <button className="desk-main lab-next" autoFocus onClick={onExit}>Back to the Parts Lab</button>}
        </div>
      </div>

      {hover && spec.kind === 'identify' && <div className="desk-tag repair-tip" style={{ left: mouse[0], top: mouse[1] - 22 }}>{tooltip(hover, (x, u) => formatSI(x, u))}</div>}
    </div>
  );
}

/** Group the lab's levels by family for the workshop page. */
export const LAB_FAMILIES: { id: string; name: string }[] = [
  { id: 'passive', name: 'Passives' }, { id: 'semiconductor', name: 'Semiconductors' }, { id: 'power', name: 'Power' },
  { id: 'smd', name: 'Surface mount' }, { id: 'board', name: 'Boards' }, { id: 'module', name: 'Modules' },
];

export const KIND_WORD: Record<LabSpec['kind'], string> = { sort: 'measure', pins: 'find the pins', read: 'read it', use: 'use it', dial: 'use it', identify: 'find it' };
