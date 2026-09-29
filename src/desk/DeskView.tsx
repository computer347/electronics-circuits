/**
 * The desk mode: the 3D bench plus the only HUD it has: the step rail at the top, Back at the
 * top left, one blue main button at the bottom right, and a riso tag over whatever you point
 * at. After a submit it dives into the board and hands over to Clear the circuit.
 */
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeBoard } from '../breadboard/model';
import { useBench } from '../breadboard/store';
import { CircuitWorld } from '../circuitworld/CircuitWorld';
import { WORLD0_CLASSES } from '../learn/classes';
import { levelById, startingBoard, WORLD0 } from '../levels';
import { useProgress } from '../levels/progress';
import { useSession, type Attempt } from '../levels/session';
import type { LevelDef } from '../levels/types';
import { reducedMotion } from './anim';
import { bench as liveBench, startLiveBench, useLive } from '../breadboard/live';
import { isDynamicBoard } from '../breadboard/model';
import { SandboxTray } from './SandboxTray';
import { ScopeControls } from './ScopeControls';
import { isUnlocked, followingLevel, nextLevel } from './levelPick';
import { DIAL, meteredBoard, readMeter } from './meter';
import { spreads } from './notebook';
import { NotebookPages } from './NotebookPages';
import { PartsTray } from './PartsTray';
import { taskPage } from './taskPages';
import { HintNote, SpareLeds } from './HintNote';
import { starRules } from './starRules';
import { markTourSeen, TOUR, tourSeen } from './tour';
import type { BoxItem } from './assets/PartsBox';
import { DeskScene, LabelLayer } from './DeskScene';
import { TAGS, useHover } from './hover';
import { currentStep, mainAction, railStates, STEP_OBJECT, STEPS, glowing, type StepId } from './steps';
import { useDesk, useLoop } from './store';
import './desk.css';

/** What the 3D parts box can hold. */
const BOX: BoxItem[] = ['resistor', 'led', 'capacitor', 'wire'];

function StepIcon({ step }: { step: StepId }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (step === 'task') return <svg viewBox="0 0 32 32" aria-hidden><rect x="7" y="4" width="19" height="24" {...common} /><path d="M11 11h11M11 16h11M11 21h7" {...common} /><path d="M4 8h5M4 14h5M4 20h5" {...common} /></svg>;
  if (step === 'build') return <svg viewBox="0 0 32 32" aria-hidden><rect x="3" y="7" width="26" height="18" rx="2" {...common} />{[9, 14, 19, 24].map((x) => [12, 20].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}</svg>;
  if (step === 'test') return <svg viewBox="0 0 32 32" aria-hidden><rect x="8" y="3" width="16" height="26" rx="3" {...common} /><rect x="11" y="6" width="10" height="6" {...common} /><circle cx="16" cy="19" r="4" {...common} /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="5" fill="currentColor" /><circle cx="17.5" cy="17.5" r="9" {...common} /></svg>;
}

const STEP_NAMES: Record<StepId, string> = { task: 'Task', build: 'Build', test: 'Test', clear: 'Clear' };

export function StepRail({ interactive = true }: { interactive?: boolean }) {
  const loop = useLoop();
  const states = railStates(loop);
  const focus = useDesk((s) => s.focus);
  return (
    <nav className="step-rail" aria-label="Level steps">
      {STEPS.map((st, i) => (
        <button key={st} className={`step ${states[st]} ${focus === STEP_OBJECT[st] && st !== 'clear' ? 'looking' : ''}`}
          disabled={!interactive || st === 'clear'} title={STEP_NAMES[st]}
          onClick={() => { const d = useDesk.getState(); if (d.phase === 'desk') d.focusOn(STEP_OBJECT[st]); }}>
          <StepIcon step={st} />
          {states[st] === 'done' && <span className="tick" aria-label="done">✓</span>}
          <span className="step-n">{i + 1}</span>
        </button>
      ))}
    </nav>
  );
}

function HoverTag() {
  const { object, x, y } = useHover();
  if (!object) return null;
  const [name, verb] = TAGS[object];
  return <div className="desk-tag" style={{ left: x, top: y - 18 }}><b>{name}</b>{verb}</div>;
}

/** What each star takes, and which ones this run got. */
function StarList({ level, r }: { level: LevelDef; r: Attempt }) {
  return (
    <ul className="star-rules">
      {starRules(level, r.stats, r.check.pass).map((x) => (
        <li key={x.stars} className={x.met ? 'met' : ''}>
          <span className="star-rule-stars" aria-label={`${x.stars} stars`}>{'★'.repeat(x.stars)}</span>
          <b>{x.label}</b> <small>{x.detail}</small>
        </li>
      ))}
    </ul>
  );
}

function Stars({ n }: { n: number }) {
  return <div className="desk-stars" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}</div>;
}

export function DeskView({ onMenu }: { onMenu: () => void }) {
  const desk = useDesk();
  const loop = useLoop();
  const parts = useBench((s) => s.parts);
  const supply = useBench((s) => s.supply);
  const probes = useBench((s) => s.probes);
  const notice = useBench((s) => s.notice);
  const tool = useBench((s) => s.tool);
  const records = useProgress((s) => s.levels);
  const level = levelById(desk.levelId ?? '') ?? WORLD0[0]!;
  const board = useMemo(() => ({ supply, parts }), [supply, parts]);
  const meterMode = useDesk((s) => s.meterMode);
  // With the dial on A the meter is part of the circuit (a wire between the probes), so solve it in.
  const analysis = useMemo(() => analyzeBoard(meteredBoard(board, meterMode, probes)), [board, meterMode, probes]);
  // Boards that change over time (capacitors, generators) run the live transient bench: the
  // scope draws it, LEDs follow it, and the meter's volts come from it.
  const dynamic = isDynamicBoard(board);
  const live = useLive((st) => (dynamic ? st.result : null));
  const sandbox = desk.mode === 'sandbox';
  useEffect(() => startLiveBench(), []);
  const [fonts, setFonts] = useState(false);
  const labelLayer = useRef<HTMLDivElement>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    // A fresh visit starts a level: the one you were on, else the next one not passed yet.
    // Play (or a finished World 0) opens on the level map; Learn and Practice open the notebook.
    const d = useDesk.getState();
    const recs = useProgress.getState().levels;
    const id = d.levelId ?? nextLevel(recs) ?? WORLD0[0]!.id;
    const startOn = d.startOn;
    if (d.mode !== 'sandbox' && useSession.getState().levelId !== id) d.enter(id);
    useDesk.setState({ startOn: null });
    if (startOn === 'theory') useDesk.getState().openNotebook('theory');
    else if (startOn === 'practice') useDesk.getState().openNotebook('math', spreads(levelById(id)!, 'math').length - 1);
    else if (startOn === 'map' || !nextLevel(recs)) useDesk.getState().focusOn('corkboard');
    // Canvas textures draw text, so wait for the riso fonts (but never for long).
    const t = setTimeout(() => setFonts(true), 1500);
    void Promise.all([document.fonts.load("64px 'Anton'"), document.fonts.load("bold 20px 'Space Mono'"), document.fonts.load("20px 'Space Mono'"), document.fonts.load("italic 20px 'Space Mono'")]).finally(() => setFonts(true));
    const p = setTimeout(() => {
      setPrinted(true);
      // First time at the bench: show what everything is.
      if (!tourSeen() && !useDesk.getState().focus) useDesk.getState().setTour(0);
    }, reducedMotion() ? 0 : 1300);
    return () => { clearTimeout(t); clearTimeout(p); };
  }, []);

  // LEDs that get overloaded stay burnt, as on the bench.
  useEffect(() => {
    const fresh = analysis.newlyBurnt.filter((id) => parts.some((p) => p.id === id && !p.burnt));
    if (fresh.length) useBench.getState().markBurnt(fresh);
  }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submit → the switch flips and the board powers → the camera dives into the hole → inside.
  useEffect(() => {
    const fast = reducedMotion();
    if (desk.phase === 'power') { const t = setTimeout(() => desk.setPhase('dive'), fast ? 300 : 1200); return () => clearTimeout(t); }
    if (desk.phase === 'dive') { const t = setTimeout(() => desk.setPhase('clear'), fast ? 300 : 1700); return () => clearTimeout(t); }
  }, [desk.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    const bench = useBench.getState();
    // Esc first puts down whatever you're holding, then leaves the object.
    if (desk.focus === 'breadboard' && (bench.tool !== 'select' || bench.pending || bench.moving)) { bench.cancelMove(); bench.setTool('select'); return; }
    if (desk.focus) desk.focusOn(null);
  };
  const reading = useMemo(() => {
    const useLiveVolts = dynamic && meterMode === 'V' && live?.ok;
    const solved = useLiveVolts
      ? { ok: true, voltageAt: (h: string) => liveBench.voltageAt(live, h), currents: live!.currents }
      : { ok: analysis.result.ok, voltageAt: analysis.voltageAt, currents: analysis.result.currents };
    return readMeter(board, meterMode, probes, solved);
  }, [board, meterMode, probes, analysis, dynamic, live]);

  // The suggested level on the map: the next one after this, once this one's passed.
  const suggested = records[level.id] ? followingLevel(level.id, records) ?? nextLevel(records) ?? level.id : level.id;
  const suggestedLevel = levelById(suggested)!;
  const playLevel = (id: string) => { desk.enter(id); };

  const main: ReturnType<typeof mainAction> = sandbox
    ? (desk.focus ? { kind: 'back', label: 'Back to the desk' } : { kind: 'focus', object: 'breadboard', label: 'Go to the breadboard' })
    : mainAction(loop, desk.focus);
  const mainLabel = main.kind === 'pick-level' ? `Play ${suggestedLevel.world}–${suggestedLevel.number} ${suggestedLevel.title}` : main.label;
  function runMain() {
    switch (main.kind) {
      case 'focus': desk.focusOn(main.object); break;
      case 'close-notebook': desk.closeNotebook(); break;
      case 'done-building': desk.doneBuilding(); break;
      case 'submit': if (main.enabled) desk.submit(); break;
      case 'pick-level': playLevel(suggested); break;
      case 'back': back(); break;
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (desk.phase !== 'desk') return;
      if (desk.tour !== null) {
        if (e.key === 'Escape') endTour();
        if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); tourStep(1); }
        if (e.key === 'ArrowLeft') tourStep(-1);
        return;
      }
      if (e.key === 'Escape') back();
      if ((e.key === 'm' || e.key === 'M') && desk.focus === 'meter') desk.turnDial(e.shiftKey ? -1 : 1);
      if ((e.key === 'Delete' || e.key === 'Backspace') && desk.focus === 'breadboard') useBench.getState().removeSelected();
      if ((e.key === '+' || e.key === '=') && (desk.focus === 'breadboard' || desk.focus === 'meter')) desk.setZoom(desk.zoom * 1.4);
      if ((e.key === '-' || e.key === '_') && (desk.focus === 'breadboard' || desk.focus === 'meter')) desk.setZoom(desk.zoom / 1.4);
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); runMain(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const endTour = () => { markTourSeen(); desk.setTour(null); };
  const tourStep = (d: number) => {
    const i = (desk.tour ?? 0) + d;
    if (i >= TOUR.length) endTour(); else desk.setTour(Math.max(0, i));
  };
  const stop = desk.tour !== null ? TOUR[desk.tour] : undefined;

  const page = useMemo(() => taskPage(level), [level]);
  const cls = WORLD0_CLASSES.find((c) => c.levelId === level.id);
  const passed = useMemo(() => new Set(Object.keys(records).map((id) => levelById(id)?.number ?? 0)), [records]);
  const unlocked = useMemo(() => new Set(WORLD0.filter((l) => isUnlocked(l.number, records)).map((l) => l.number)), [records]);
  const spares = useBench((s) => s.spares);
  // The box holds the level's parts, plus one LED per spare.
  const boxItems: BoxItem[] = [...BOX.filter((k) => level.tools.includes(k)), ...Array.from({ length: spares ?? 0 }, () => 'led' as const)];
  const start = startingBoard(level);
  const diveHole = sandbox ? (parts.find((p) => p.kind === 'led' || p.kind === 'capacitor') ?? parts[0])?.h1 ?? 'e15' : (start.parts.find((p) => level.pinned?.includes(p.id)) ?? start.parts.find((p) => p.kind === 'led' || p.kind === 'capacitor') ?? start.parts[0])?.h1 ?? 'e15';
  const step = currentStep(loop);

  if (desk.phase === 'clear') {
    const r = desk.result;
    return (
      <div className="desk">
        <CircuitWorld rail={sandbox ? null : <StepRail interactive={false} />}
          onCleared={() => (sandbox ? desk.returnToDesk() : desk.finishClear())} onGiveUp={() => (sandbox ? desk.returnToDesk() : desk.finishClear())} />
        {r && (
          <div className="desk-result" role="dialog" aria-label="Level result">
            {r.check.pass ? (
              <>
                <h2>Circuit clear</h2>
                <Stars n={r.stars ?? 1} />
                <p className="desk-result-sub">{r.stats.measurements} {r.stats.measurements === 1 ? 'measurement' : 'measurements'} · {r.stats.checks} {r.stats.checks === 1 ? 'try' : 'tries'} · {r.stats.seconds} s{r.improved ? ' · new best' : ''}</p>
                <StarList level={level} r={r} />
                <p>{level.debrief}</p>
              </>
            ) : (
              <>
                <h2>Not yet</h2>
                <p>{r.check.diagnosis?.message ?? r.check.lines.find((x) => !x.ok)?.label}</p>
                <StarList level={level} r={r} />
              </>
            )}
            <button className="desk-main" autoFocus onClick={() => {
              // A miss sends you back to the bench to fix it, then test and submit again.
              if (!r.check.pass) useDesk.setState((s) => ({ flags: { ...s.flags, built: false, submitted: false } }));
              desk.returnToDesk();
            }}>
              {r.check.pass ? 'Back to the desk' : 'Back to the bench'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`desk ${desk.focus || desk.phase !== 'desk' ? 'dimmed' : ''}`}>
      {fonts && (
        <Canvas className="desk-canvas" shadows camera={{ fov: 42, near: 0.005, far: 20, position: [0, 0.7, 0.4] }} dpr={[1, 2]}
          onPointerMissed={() => useHover.getState().set(null)}>
          <LabelLayer.Provider value={labelLayer}>
          <DeskScene
            analysis={analysis}
            reading={reading}
            glow={!sandbox && desk.phase === 'desk' && desk.focus === null && desk.tour === null ? glowing(loop) : null}
            dynamic={dynamic}
            onFreeBench={() => desk.enterSandbox()}
            page={page}
            levelNumber={level.number}
            passed={passed}
            unlocked={unlocked}
            onPickLevel={(n) => { const l = WORLD0.find((x) => x.number === n); if (l && unlocked.has(n)) playLevel(l.id); }}
            boxItems={boxItems}
            diveHole={diveHole}
          />
          </LabelLayer.Provider>
        </Canvas>
      )}
      <div ref={labelLayer} className="desk-label-layer" />
      <div className="desk-vignette" aria-hidden />
      {!printed && <div className="desk-print" aria-hidden><i /><i /><i /></div>}
      {desk.phase === 'dive' && <div className="desk-dive" aria-hidden><i /><i /><i /><i /><span>1 : 1 000 000 000</span></div>}

      {!sandbox && <StepRail interactive={desk.phase === 'desk'} />}
      <p className="desk-level">{sandbox ? 'Free bench' : `${level.world}–${level.number} ${level.title}`}
        {desk.phase === 'desk' && desk.tour === null && <button className="desk-tour-btn" onClick={() => desk.setTour(0)}>Tour</button>}
      </p>
      {!sandbox && desk.phase === 'desk' && desk.tour === null && (
        <div className="desk-extras"><SpareLeds />{step !== 'done' && <HintNote key={level.id} level={level} />}</div>
      )}
      {stop && (
        <div className="desk-tourcard" role="dialog" aria-label="Bench tour">
          <p className="nb-kicker">Bench tour · {desk.tour! + 1} / {TOUR.length}</p>
          <h2>{stop.title}</h2>
          <p>{stop.text}</p>
          <div className="desk-tourdots" aria-hidden>{TOUR.map((t, i) => <i key={t.id} className={i === desk.tour ? 'on' : i < desk.tour! ? 'seen' : ''} />)}</div>
          <div className="nb-row">
            {desk.tour! > 0 && <button className="nb-link" onClick={() => tourStep(-1)}>‹ Back</button>}
            <button className="nb-link" onClick={endTour}>Skip the tour</button>
          </div>
        </div>
      )}
      <button className="desk-back" onClick={() => (desk.focus ? back() : onMenu())}>
        ‹ {desk.focus ? 'Back' : 'Menu'} <kbd>Esc</kbd>
      </button>
      <HoverTag />

      {desk.phase === 'desk' && desk.focus === 'notebook' && <NotebookPages level={level} />}
      {desk.phase === 'desk' && desk.focus === 'notebook' && desk.nbSection === 'task' && cls && (
        <button className="desk-link" onClick={() => desk.openNotebook('theory')}>
          Learn this first: {cls.title} →
        </button>
      )}
      {desk.phase === 'desk' && desk.focus === 'breadboard' && (sandbox ? <SandboxTray /> : <PartsTray level={level} />)}
      {desk.phase === 'desk' && desk.focus === 'scope' && <ScopeControls />}
      {sandbox && desk.phase === 'desk' && desk.focus === 'breadboard' && parts.length > 0 && (
        <button className="desk-link" onClick={() => { useBench.getState().setTool('select'); desk.setPhase('dive'); }}>Go inside your circuit →</button>
      )}
      {desk.phase === 'desk' && (desk.focus === 'breadboard' || desk.focus === 'meter' || desk.focus === 'scope') && (
        <div className="desk-zoom" aria-label="Zoom">
          <button onClick={() => desk.setZoom(desk.zoom * 1.4)} aria-label="Zoom in">+</button>
          <button onClick={() => desk.setZoom(desk.zoom / 1.4)} disabled={desk.zoom <= 1} aria-label="Zoom out">−</button>
        </div>
      )}
      {desk.phase === 'desk' && desk.focus === 'meter' && (
        <div className="desk-hint">
          <span className="desk-pict"><span className="dot red" /> a point <span className="dot black" /> − rail</span>
          <span className={`desk-reading ${meterMode}`}>{meterMode === 'off' ? 'OFF' : `${reading.text} ${reading.unit}`}</span>
          <span className="meter-modes" role="radiogroup" aria-label="Meter dial">
            {DIAL.map((m) => (
              <button key={m} role="radio" aria-checked={meterMode === m} className={meterMode === m ? 'on' : ''} onClick={() => desk.setMeterMode(m)}>
                {m === 'off' ? 'OFF' : m}
              </button>
            ))}
          </span>
        </div>
      )}
      {desk.phase === 'desk' && desk.focus === 'corkboard' && (
        <div className="desk-hint"><span className="desk-pict"><span className="dot pink" /> click a card to play it</span></div>
      )}
      {desk.phase === 'desk' && notice && desk.focus === 'breadboard' && tool !== 'probe' && <p className="desk-notice">{notice}</p>}
      {desk.phase === 'desk' && desk.focus === 'meter' && reading.note && <p className="desk-notice">{reading.note}</p>}
      {desk.phase === 'desk' && step === 'done' && desk.focus === null && <div className="desk-done"><Stars n={records[level.id]?.stars ?? 0} /></div>}

      {desk.phase === 'desk' && stop && (
        <button className="desk-main" onClick={() => tourStep(1)}>{desk.tour === TOUR.length - 1 ? 'Start: read the task' : 'Next'}</button>
      )}
      {desk.phase === 'desk' && !stop && (
        <button className={`desk-main ${main.kind === 'submit' && !main.enabled ? 'locked' : ''}`} onClick={runMain}
          disabled={main.kind === 'submit' && !main.enabled} aria-disabled={main.kind === 'submit' && !main.enabled}>
          {main.kind === 'submit' && !main.enabled && <span aria-hidden>🔒 </span>}{mainLabel}
        </button>
      )}
    </div>
  );
}
