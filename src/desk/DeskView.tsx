/**
 * The desk mode: the 3D bench plus the only HUD it has: the step rail at the top, Back at the
 * top left, one blue main button at the bottom right, and a riso tag over whatever you point
 * at. After a submit it dives into the board and hands over to Clear the circuit.
 */
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { analyzeBoard } from '../breadboard/model';
import { useBench } from '../breadboard/store';
import { CircuitWorld } from '../circuitworld/CircuitWorld';
import { WORLD0_CLASSES } from '../learn/classes';
import { levelById, startingBoard, WORLD0 } from '../levels';
import { useProgress } from '../levels/progress';
import { useSession } from '../levels/session';
import { reducedMotion } from './anim';
import { isUnlocked, followingLevel, nextLevel } from './levelPick';
import { meteredBoard, readMeter } from './meter';
import { PartsTray } from './PartsTray';
import { taskPage } from './taskPages';
import type { BoxItem } from './assets/PartsBox';
import { DeskScene } from './DeskScene';
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

function Stars({ n }: { n: number }) {
  return <div className="desk-stars" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}</div>;
}

export function DeskView({ onMenu, onLearn }: { onMenu: () => void; onLearn: (classId: string) => void }) {
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
  const [fonts, setFonts] = useState(false);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    // A fresh visit starts a level: the one you were on, else the next one not passed yet.
    // Play on the front page (or a finished World 0) opens on the level map instead.
    const d = useDesk.getState();
    const recs = useProgress.getState().levels;
    const id = d.levelId ?? nextLevel(recs) ?? WORLD0[0]!.id;
    if (useSession.getState().levelId !== id) d.enter(id);
    if (d.startOnMap || !nextLevel(recs)) { useDesk.setState({ startOnMap: false }); useDesk.getState().focusOn('corkboard'); }
    // Canvas textures draw text, so wait for the riso fonts (but never for long).
    const t = setTimeout(() => setFonts(true), 1500);
    void Promise.all([document.fonts.load("64px 'Anton'"), document.fonts.load("bold 20px 'Space Mono'"), document.fonts.load("20px 'Space Mono'"), document.fonts.load("italic 20px 'Space Mono'")]).finally(() => setFonts(true));
    const p = setTimeout(() => setPrinted(true), reducedMotion() ? 0 : 1300);
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
  const reading = useMemo(
    () => readMeter(board, meterMode, probes, { ok: analysis.result.ok, voltageAt: analysis.voltageAt, currents: analysis.result.currents }),
    [board, meterMode, probes, analysis],
  );

  // The suggested level on the map: the next one after this, once this one's passed.
  const suggested = records[level.id] ? followingLevel(level.id, records) ?? nextLevel(records) ?? level.id : level.id;
  const suggestedLevel = levelById(suggested)!;
  const playLevel = (id: string) => { desk.enter(id); };

  const main = mainAction(loop, desk.focus);
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
      if (e.key === 'Escape') back();
      if ((e.key === 'm' || e.key === 'M') && desk.focus === 'meter') desk.turnDial(desk.meterMode === 'A' ? -1 : 1);
      if ((e.key === 'Delete' || e.key === 'Backspace') && desk.focus === 'breadboard') useBench.getState().removeSelected();
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); runMain(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const page = useMemo(() => taskPage(level), [level]);
  const cls = WORLD0_CLASSES.find((c) => c.levelId === level.id);
  const passed = useMemo(() => new Set(Object.keys(records).map((id) => levelById(id)?.number ?? 0)), [records]);
  const unlocked = useMemo(() => new Set(WORLD0.filter((l) => isUnlocked(l.number, records)).map((l) => l.number)), [records]);
  const boxItems: BoxItem[] = BOX.filter((k) => level.tools.includes(k));
  const start = startingBoard(level);
  const diveHole = (start.parts.find((p) => level.pinned?.includes(p.id)) ?? start.parts.find((p) => p.kind === 'led' || p.kind === 'capacitor') ?? start.parts[0])?.h1 ?? 'e15';
  const step = currentStep(loop);

  if (desk.phase === 'clear') {
    const r = desk.result;
    return (
      <div className="desk">
        <CircuitWorld rail={<StepRail interactive={false} />} onCleared={() => desk.finishClear()} onGiveUp={() => desk.finishClear()} />
        {r && (
          <div className="desk-result" role="dialog" aria-label="Level result">
            {r.check.pass ? (
              <>
                <h2>Circuit clear</h2>
                <Stars n={r.stars ?? 1} />
                <p className="desk-result-sub">{r.stats.measurements} measurements · {r.stats.seconds} s{r.improved ? ' · new best' : ''}</p>
                <p>{level.debrief}</p>
              </>
            ) : (
              <>
                <h2>Not yet</h2>
                <p>{r.check.diagnosis?.message ?? r.check.lines.find((x) => !x.ok)?.label}</p>
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
          <DeskScene
            analysis={analysis}
            reading={reading}
            glow={desk.phase === 'desk' && desk.focus === null ? glowing(loop) : null}
            page={page}
            levelNumber={level.number}
            passed={passed}
            unlocked={unlocked}
            onPickLevel={(n) => { const l = WORLD0.find((x) => x.number === n); if (l && unlocked.has(n)) playLevel(l.id); }}
            boxItems={boxItems}
            diveHole={diveHole}
          />
        </Canvas>
      )}
      <div className="desk-vignette" aria-hidden />
      {!printed && <div className="desk-print" aria-hidden><i /><i /><i /></div>}
      {desk.phase === 'dive' && <div className="desk-dive" aria-hidden><i /><i /><i /><i /><span>1 : 1 000 000 000</span></div>}

      <StepRail interactive={desk.phase === 'desk'} />
      <p className="desk-level">{level.world}–{level.number} {level.title}</p>
      <button className="desk-back" onClick={() => (desk.focus ? back() : onMenu())}>
        ‹ {desk.focus ? 'Back' : 'Menu'} <kbd>Esc</kbd>
      </button>
      <HoverTag />

      {desk.phase === 'desk' && desk.focus === 'notebook' && cls && (
        <button className="desk-link" onClick={() => onLearn(cls.id)}>
          Learn this first: {cls.title}
        </button>
      )}
      {desk.phase === 'desk' && desk.focus === 'breadboard' && <PartsTray level={level} />}
      {desk.phase === 'desk' && desk.focus === 'meter' && (
        <div className="desk-hint">
          <span className="desk-pict"><span className="dot red" /> a point <span className="dot black" /> − rail</span>
          <span className={`desk-reading ${meterMode}`}>{meterMode === 'off' ? 'OFF' : `${reading.text} ${reading.unit}`}</span>
          <span className="desk-pict">twist the dial <kbd>M</kbd></span>
        </div>
      )}
      {desk.phase === 'desk' && desk.focus === 'corkboard' && (
        <div className="desk-hint"><span className="desk-pict"><span className="dot pink" /> click a card to play it</span></div>
      )}
      {desk.phase === 'desk' && notice && desk.focus === 'breadboard' && tool !== 'probe' && <p className="desk-notice">{notice}</p>}
      {desk.phase === 'desk' && desk.focus === 'meter' && reading.note && <p className="desk-notice">{reading.note}</p>}
      {desk.phase === 'desk' && step === 'done' && desk.focus === null && <div className="desk-done"><Stars n={records[level.id]?.stars ?? 0} /></div>}

      {desk.phase === 'desk' && (
        <button className={`desk-main ${main.kind === 'submit' && !main.enabled ? 'locked' : ''}`} onClick={runMain}
          disabled={main.kind === 'submit' && !main.enabled} aria-disabled={main.kind === 'submit' && !main.enabled}>
          {main.kind === 'submit' && !main.enabled && <span aria-hidden>🔒 </span>}{mainLabel}
        </button>
      )}
    </div>
  );
}
