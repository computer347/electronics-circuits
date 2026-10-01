/**
 * The coding bench: a node editor on the left (setup runs once, loop runs forever; every node
 * shows its line of Arduino code), the board on its mat on the right, and a console under it.
 * Compile checks the program; Upload sends it and the board starts running it: the L LED
 * blinks for real, and on the screen jobs the OLED beside the Uno (wired on I²C) shows what the
 * program draws, magnified in the corner so the pixels can be read.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import '../desk/desk.css';
import { useWallet } from '../jobs/wallet';
import { H, W } from '../oled/gfx';
import { ARDUINO_UNO, Board, OLED_096, type BoardDef } from '../parts3d/boards';
import { StudioEnvironment } from '../parts3d/common';
import { BOARD_PIN_Y, Jumper, MODULE_PIN_Y } from '../wiring/Jumper';
import { correctWires, OLED_WIRING_JOB, wireColor, wiringSpots } from '../wiring/wiring';
import { BLINK, checkCoding, codingJobById, type CodingJob } from './jobs';
import {
  codeOf, compile, framePixels, GROUP_NAME, newNode, NODE_INFO, Runner, sketch, WAITS,
  type CompileResult, type NodeKind, type ParamSpec, type Program, type ProgramNode,
} from './program';
import { DPR } from '../lib/gfx';

type Lane = 'setup' | 'loop';
const KINDS = Object.keys(NODE_INFO) as NodeKind[];
const UPLOAD_MS = 1600;

// ---------------------------------------------------------------- the editor

function Param({ spec, n, onChange }: { spec: ParamSpec; n: ProgramNode; onChange: (n: ProgramNode) => void }) {
  const value = (n as unknown as Record<string, unknown>)[spec.key];
  const set = (v: unknown) => onChange({ ...n, [spec.key]: v } as ProgramNode);
  const label = <span className="node-label">{spec.label}</span>;
  switch (spec.type) {
    case 'pin':
      return <label>{label}<select value={value as number} onChange={(e) => set(Number(e.target.value))}>{Array.from({ length: 14 }, (_, p) => <option key={p} value={p}>{p}{p === 13 ? ' (L LED)' : ''}</option>)}</select></label>;
    case 'wait':
      return <label><select value={value as number} onChange={(e) => set(Number(e.target.value))}>{WAITS.map((w) => <option key={w} value={w}>{w}</option>)}</select> ms</label>;
    case 'bool':
      return <label className="node-check"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />{spec.label}</label>;
    case 'text':
      return <label className="node-text">{label}<input type="text" value={value as string} maxLength={40} onChange={(e) => set(e.target.value)} /></label>;
    case 'int':
      return <label>{label}<input type="number" value={value as number} min={spec.min} max={spec.max} onChange={(e) => set(Math.round(Number(e.target.value) || 0))} /></label>;
    case 'num':
      return (
        <label>{label}
          {value === 'count'
            ? <button className="node-count on" onClick={() => set(0)} title="Use a number instead">count ×</button>
            : <><input type="number" value={value as number} min={spec.min} max={spec.max} onChange={(e) => set(Math.round(Number(e.target.value) || 0))} />
              <button className="node-count" onClick={() => set('count')} title="Use the count variable">count</button></>}
        </label>
      );
    case 'choice': {
      const opts = spec.options ?? [];
      const name = (o: string | number, i: number) => String(spec.names?.[i] ?? o);
      if (opts.length <= 3 && !spec.names) {
        return <span className="node-seg" aria-label={spec.label}>{opts.map((o, i) => <button key={String(o)} className={value === o ? 'on' : ''} onClick={() => set(o)}>{name(o, i)}</button>)}</span>;
      }
      return <label>{label}<select value={String(value)} onChange={(e) => set(typeof opts[0] === 'number' ? Number(e.target.value) : e.target.value)}>{opts.map((o, i) => <option key={String(o)} value={String(o)}>{name(o, i)}</option>)}</select></label>;
    }
  }
}

function NodeCard({ n, lane, i, count, problem, onChange, onMove, onRemove }: {
  n: ProgramNode; lane: Lane; i: number; count: number; problem?: string;
  onChange: (n: ProgramNode) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const info = NODE_INFO[n.kind];
  // The Print node only needs its text box when it prints text.
  const params = info.params.filter((p) => !(n.kind === 'oledPrint' && p.key === 'text' && n.what !== 'text'));
  return (
    <li className={`node ${n.kind} g-${info.group} ${problem ? 'warn' : ''}`}>
      <div className="node-head">
        <b>{info.title}</b>
        <span className="node-tools">
          <button onClick={() => onMove(-1)} disabled={i === 0} aria-label="Move up">↑</button>
          <button onClick={() => onMove(1)} disabled={i === count - 1} aria-label="Move down">↓</button>
          <button onClick={onRemove} aria-label={`Remove from ${lane}`}>×</button>
        </span>
      </div>
      {params.length > 0 && <div className="node-params">{params.map((p) => <Param key={p.key} spec={p} n={n} onChange={onChange} />)}</div>}
      <code>{codeOf(n)}</code>
      {problem && <p className="node-problem">{problem}</p>}
    </li>
  );
}

function AddNode({ job, onAdd }: { job: CodingJob; onAdd: (k: NodeKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="node-add">
      <button className="node-plus" onClick={() => setOpen(!open)} aria-expanded={open}>+ add a node</button>
      {open && (
        <div className="node-palette">
          {job.palette.map((g) => (
            <section key={g} aria-label={GROUP_NAME[g]}>
              {job.palette.length > 1 && <h4>{GROUP_NAME[g]}</h4>}
              {KINDS.filter((k) => NODE_INFO[k].group === g).map((k) => (
                <button key={k} onClick={() => { onAdd(k); setOpen(false); }}>
                  <b>{NODE_INFO[k].title}</b><span>{NODE_INFO[k].what}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LaneView({ job, lane, nodes, problems, onChange }: { job: CodingJob; lane: Lane; nodes: ProgramNode[]; problems: Map<string, string>; onChange: (ns: ProgramNode[]) => void }) {
  const set = (i: number, n: ProgramNode) => onChange(nodes.map((x, j) => (j === i ? n : x)));
  const move = (i: number, d: -1 | 1) => { const ns = [...nodes]; const [x] = ns.splice(i, 1); ns.splice(i + d, 0, x!); onChange(ns); };
  return (
    <section className={`lane ${lane}`} aria-label={lane}>
      <h3>{lane === 'setup' ? 'SETUP' : 'LOOP'} <small>{lane === 'setup' ? 'runs once, at power-up' : 'runs forever, top to bottom, round and round'}</small></h3>
      <ol>
        {nodes.map((n, i) => (
          <NodeCard key={n.id} n={n} lane={lane} i={i} count={nodes.length} problem={problems.get(n.id)}
            onChange={(x) => set(i, x)} onMove={(d) => move(i, d)} onRemove={() => onChange(nodes.filter((_, j) => j !== i))} />
        ))}
      </ol>
      {lane === 'loop' && nodes.length > 0 && <p className="lane-back" aria-hidden>↺ back to the top</p>}
      <AddNode job={job} onAdd={(k) => onChange([...nodes, newNode(k)])} />
    </section>
  );
}

// ---------------------------------------------------------------- the board and its screen

/** The OLED's pixels: a white-blue glow when lit, near black when not, dimmer when dimmed. */
function paintScreen(px: Uint8Array | null, dim: boolean, tex: THREE.DataTexture, canvas: HTMLCanvasElement | null) {
  const on = [214, 238, 255].map((c) => Math.round(c * (dim ? 0.45 : 1)));
  const off = [6, 8, 10];
  const data = tex.image.data as Uint8Array;
  const ctx = canvas?.getContext('2d');
  const img = ctx ? ctx.createImageData(W, H) : null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = px && px[y * W + x] ? on : off;
      // The texture's first row is the bottom of the screen; the screen's y counts down.
      const t = ((H - 1 - y) * W + x) * 4, i = (y * W + x) * 4;
      data[t] = c[0]!; data[t + 1] = c[1]!; data[t + 2] = c[2]!; data[t + 3] = 255;
      if (img) { img.data[i] = c[0]!; img.data[i + 1] = c[1]!; img.data[i + 2] = c[2]!; img.data[i + 3] = 255; }
    }
  }
  tex.needsUpdate = true;
  if (ctx && img) ctx.putImageData(img, 0, 0);
}

function RunningBoard({ job, program, since, preview }: { job: CodingJob; program: Program | null; since: number; preview: RefObject<HTMLCanvasElement | null> }) {
  const [lit, setLit] = useState(false);
  const runner = useMemo(() => (program ? new Runner(program, false) : null), [program]);
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(W * H * 4), W, H, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const drawn = useRef(-1);
  // Upload resets the screen: dark until the new program starts it.
  useEffect(() => { drawn.current = -1; paintScreen(null, false, tex, preview.current); }, [runner, tex, preview]);
  // With no wait, a loop that flips pin 13 flickers too fast to see: it just looks lit.
  const flicker = !!program && program.loop.some((n) => (n.kind === 'write' || n.kind === 'toggle') && n.pin === 13);
  useFrame(() => {
    if (!runner) { if (lit) setLit(false); return; }
    const t = performance.now() - since;
    runner.advanceTo(t);
    const on = runner.output.has(13) && (runner.stalled && flicker ? true : runner.level[13] === 1);
    if (on !== lit) setLit(on);
    if (job.module && (runner.version !== drawn.current || runner.panel.scroll)) {
      drawn.current = runner.version;
      paintScreen(framePixels(runner.panel, t), runner.panel.dim, tex, preview.current);
    }
  });
  const def: BoardDef = useMemo(() => ({
    ...ARDUINO_UNO,
    parts: ARDUINO_UNO.parts.map((p) => (p.id === 'LED_L' ? { ...p, props: { ...p.props, lit } } : p)),
  }), [lit]);
  const oled: BoardDef = useMemo(() => ({ ...OLED_096, parts: OLED_096.parts.map((p) => (p.id === 'DISP' ? { ...p, props: { ...p.props, screen: tex } } : p)) }), [tex]);
  const wires = useMemo(() => {
    if (!job.module) return [];
    const spots = wiringSpots(OLED_WIRING_JOB);
    const at = (id: string) => { const s = [...spots.module, ...spots.board].find((x) => x.id === id)!; return new THREE.Vector3(s.at[0], id.startsWith('m:') ? MODULE_PIN_Y : BOARD_PIN_Y, s.at[1]); };
    return correctWires(OLED_WIRING_JOB).map((w) => ({ a: at(w.from), b: at(w.to), color: wireColor(OLED_WIRING_JOB, w.from), key: w.from }));
  }, [job.module]);
  const led = ARDUINO_UNO.parts.find((p) => p.id === 'LED_L')!;
  return (
    <>
      <Board def={def} />
      {job.module && (
        <>
          <group position={[OLED_WIRING_JOB.moduleAt[0], 0, OLED_WIRING_JOB.moduleAt[1]]}><Board def={oled} /></group>
          {wires.map((w) => <Jumper key={w.key} a={w.a} b={w.b} color={w.color} />)}
        </>
      )}
      {/* The real LED is 1.6 mm long: a soft glow makes its blink readable from here. */}
      {lit && (
        <mesh position={[led.at[0], 2.6, led.at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3.2, 24]} />
          <meshBasicMaterial color="#ffb000" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

// ---------------------------------------------------------------- the screen

export function CodingBench({ jobId, onExit }: { jobId: string; onExit: () => void }) {
  const job: CodingJob = codingJobById(jobId) ?? BLINK;
  const [program, setProgram] = useState<Program>(job.start);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [uploaded, setUploaded] = useState<Program | null>(null);
  const [since, setSince] = useState(0);
  const [uploading, setUploading] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([job.module ? 'Arduino Uno on USB, with the OLED on I²C (SDA A4, SCL A5). Write a program, then Compile and Upload.' : 'Arduino Uno on USB. Write a program, then Compile and Upload.']);
  const [hints, setHints] = useState(0);
  const [more, setMore] = useState(false);
  const [code, setCode] = useState(false);
  const [failed, setFailed] = useState(0);
  const [result, setResult] = useState<{ stars: 1 | 2 | 3; message: string } | null>(null);
  const timer = useRef<number | null>(null);
  const preview = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (timer.current) clearTimeout(timer.current); };
  }, [onExit]);

  const problems = useMemo(() => new Map((compiled?.problems ?? []).filter((p) => p.node).map((p) => [p.node!, p.message])), [compiled]);
  const edit = (lane: Lane, ns: ProgramNode[]) => { setProgram((p) => ({ ...p, [lane]: ns })); setCompiled(null); };

  const doCompile = () => {
    const c = compile(program);
    setCompiled(c);
    setLog((l) => [...l.slice(-12), `Compiling…`, ...c.problems.map((p) => `${p.level === 'error' ? 'error' : 'warning'}: ${p.message}`),
      ...(c.ok ? [`Sketch uses ${c.bytes.toLocaleString('en')} bytes (${((c.bytes / 32256) * 100).toFixed(0)}%) of program storage space.`, ...c.notes] : ['Compilation failed.'])]);
    return c;
  };
  const doUpload = () => {
    const c = doCompile();
    if (!c.ok) { setFailed((f) => f + 1); return; }
    const sent = structuredClone(program);
    setUploading(performance.now());
    setLog((l) => [...l, 'Uploading…']);
    timer.current = window.setTimeout(() => {
      setUploading(null);
      setUploaded(sent);
      setSince(performance.now());
      setLog((l) => [...l, 'Done uploading. The board is running your program.']);
      if (job.free) return;
      // Give it a few seconds, then judge it the way the club would: by looking.
      timer.current = window.setTimeout(() => {
        const r = checkCoding(job, sent);
        setLog((l) => [...l, r.pass ? `✓ ${r.message}` : `✗ ${r.message}`]);
        if (r.pass) {
          const stars = failed === 0 && c.problems.length === 0 ? 3 : failed <= 2 ? 2 : 1;
          setResult({ stars, message: r.message });
          useWallet.getState().complete(job.id, stars);
        }
        else setFailed((f) => f + 1);
      }, job.module ? 3200 : 2400);
    }, UPLOAD_MS);
  };

  return (
    <div className="coding">
      <div className="coding-left">
        <section className="repair-card coding-card" aria-label="Job">
          <p className="nb-kicker">Node coding · Arduino Uno{job.module ? ' + 0.96" OLED' : ''}</p>
          <h2>{job.title}</h2>
          <p className="repair-goal">{job.goal}</p>
          {more && (<><p className="repair-story">{job.story}</p><p className="desk-result-skill"><b>You’ll use this</b>{job.skill} {job.realLife}</p></>)}
          <div className="nb-row">
            <button className="nb-link" onClick={() => setMore(!more)}>{more ? 'Less' : 'The story, and why it matters'}</button>
            <button className="nb-link" onClick={() => setHints(Math.min(job.hints.length, hints + 1))} disabled={hints >= job.hints.length}>Hint {hints}/{job.hints.length}</button>
            <button className="nb-link" onClick={() => setCode(!code)}>{code ? 'Show the nodes' : 'Show the code'}</button>
          </div>
          {hints > 0 && <ol className="repair-hints">{job.hints.slice(0, hints).map((h) => <li key={h}>{h}</li>)}</ol>}
        </section>
        {code ? <pre className="coding-sketch" aria-label="Arduino sketch">{sketch(program)}</pre> : (
          <div className="lanes">
            <LaneView job={job} lane="setup" nodes={program.setup} problems={problems} onChange={(ns) => edit('setup', ns)} />
            <LaneView job={job} lane="loop" nodes={program.loop} problems={problems} onChange={(ns) => edit('loop', ns)} />
          </div>
        )}
      </div>
      <div className="coding-right">
        <div className="coding-board">
          <Canvas shadows camera={job.module ? { position: [24, 92, 74], fov: 40, near: 0.5, far: 1000 } : { position: [-2, 78, 52], fov: 38, near: 0.5, far: 1000 }} dpr={DPR}>
            <color attach="background" args={['#4a5553']} />
            <ambientLight intensity={0.55} /><hemisphereLight args={['#ffffff', '#40505a', 0.45]} />
            <StudioEnvironment />
            <directionalLight position={[60, 140, 80]} intensity={1.4} castShadow />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#5d6a66" roughness={0.95} /></mesh>
            <RunningBoard job={job} program={uploaded} since={since} preview={preview} />
            <OrbitControls makeDefault target={job.module ? [22, 0, -2] : [-2, 0, -4]} maxPolarAngle={Math.PI / 2.3} minDistance={30} maxDistance={220} enablePan={false} />
          </Canvas>
          {job.module && (
            <figure className="coding-screen" aria-label="The OLED, magnified">
              <canvas ref={preview} width={W} height={H} />
              <figcaption>OLED · 128 × 64, magnified</figcaption>
            </figure>
          )}
        </div>
        <div className="coding-console" role="log" aria-live="polite">
          {uploading !== null && <div className="coding-progress"><i style={{ animationDuration: `${UPLOAD_MS}ms` }} /></div>}
          {log.map((l, i) => <p key={i} className={l.startsWith('error') || l.startsWith('✗') ? 'bad' : l.startsWith('warning') ? 'warn' : l.startsWith('✓') ? 'good' : ''}>{l}</p>)}
        </div>
        <div className="coding-actions">
          <button className="desk-chip" onClick={doCompile}>✓ Compile</button>
          <button className="desk-main coding-upload" onClick={doUpload} disabled={uploading !== null}>→ Upload</button>
        </div>
      </div>
      <button className="desk-back" onClick={onExit}>‹ Workshop <kbd>Esc</kbd></button>
      {result && (
        <div className="desk-result" role="dialog" aria-label="Job result">
          <h2>{job.done.title}</h2>
          <div className="desk-stars" aria-label={`${result.stars} of 3 stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= result.stars ? 'on' : ''}>★</span>)}</div>
          <p className="desk-result-sub">{result.message}</p>
          <ul className="star-rules">
            <li className="met"><span className="star-rule-stars">★</span><b>{job.done.rule}</b></li>
            <li className={result.stars >= 2 ? 'met' : ''}><span className="star-rule-stars">★★</span><b>At most two failed uploads</b></li>
            <li className={result.stars >= 3 ? 'met' : ''}><span className="star-rule-stars">★★★</span><b>First upload, no warnings</b></li>
          </ul>
          <p className="desk-result-skill"><b>You can now</b>{job.skill.charAt(0).toLowerCase() + job.skill.slice(1)}</p>
          <pre className="coding-sketch small">{sketch(program)}</pre>
          <button className="desk-main" autoFocus onClick={onExit}>Back to the workshop</button>
        </div>
      )}
    </div>
  );
}
