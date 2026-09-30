/**
 * The coding bench: a node editor on the left (setup runs once, loop runs forever; every node
 * shows its line of Arduino code), the board on its mat on the right, and a console under it.
 * Compile checks the program; Upload sends it and the board starts running it, so the L LED
 * blinks for real. When it does what the job asks, the job's done.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import '../desk/desk.css';
import { useWallet } from '../jobs/wallet';
import { ARDUINO_UNO, Board, type BoardDef } from '../parts3d/boards';
import { BLINK, checkCoding, codingJobById, type CodingJob } from './jobs';
import { codeOf, compile, levelAt, newNode, NODE_INFO, run, sketch, type CompileResult, type NodeKind, type Program, type ProgramNode } from './program';

type Lane = 'setup' | 'loop';
const KINDS: NodeKind[] = ['pinMode', 'write', 'toggle', 'wait'];
const WAITS = [10, 50, 100, 200, 250, 500, 750, 1000, 2000];
const UPLOAD_MS = 1600;

// ---------------------------------------------------------------- the editor

function NodeCard({ n, lane, i, count, problem, onChange, onMove, onRemove }: {
  n: ProgramNode; lane: Lane; i: number; count: number; problem?: string;
  onChange: (n: ProgramNode) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const pinPick = 'pin' in n && (
    <label>pin <select value={n.pin} onChange={(e) => onChange({ ...n, pin: Number(e.target.value) } as ProgramNode)}>{Array.from({ length: 14 }, (_, p) => <option key={p} value={p}>{p}{p === 13 ? ' (L LED)' : ''}</option>)}</select></label>
  );
  return (
    <li className={`node ${n.kind} ${problem ? 'warn' : ''}`}>
      <div className="node-head">
        <b>{NODE_INFO[n.kind].title}</b>
        <span className="node-tools">
          <button onClick={() => onMove(-1)} disabled={i === 0} aria-label="Move up">↑</button>
          <button onClick={() => onMove(1)} disabled={i === count - 1} aria-label="Move down">↓</button>
          <button onClick={onRemove} aria-label={`Remove from ${lane}`}>×</button>
        </span>
      </div>
      <div className="node-params">
        {pinPick}
        {n.kind === 'pinMode' && (
          <span className="node-seg">{(['OUTPUT', 'INPUT'] as const).map((m) => <button key={m} className={n.mode === m ? 'on' : ''} onClick={() => onChange({ ...n, mode: m })}>{m}</button>)}</span>
        )}
        {n.kind === 'write' && (
          <span className="node-seg">{(['HIGH', 'LOW'] as const).map((l) => <button key={l} className={n.level === l ? 'on' : ''} onClick={() => onChange({ ...n, level: l })}>{l}</button>)}</span>
        )}
        {n.kind === 'wait' && (
          <label><select value={n.ms} onChange={(e) => onChange({ ...n, ms: Number(e.target.value) })}>{WAITS.map((w) => <option key={w} value={w}>{w}</option>)}</select> ms</label>
        )}
      </div>
      <code>{codeOf(n)}</code>
      {problem && <p className="node-problem">{problem}</p>}
    </li>
  );
}

function AddNode({ onAdd }: { onAdd: (k: NodeKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="node-add">
      <button className="node-plus" onClick={() => setOpen(!open)} aria-expanded={open}>+ add a node</button>
      {open && (
        <div className="node-palette">
          {KINDS.map((k) => (
            <button key={k} onClick={() => { onAdd(k); setOpen(false); }}>
              <b>{NODE_INFO[k].title}</b><span>{NODE_INFO[k].what}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LaneView({ lane, nodes, problems, onChange }: { lane: Lane; nodes: ProgramNode[]; problems: Map<string, string>; onChange: (ns: ProgramNode[]) => void }) {
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
      <AddNode onAdd={(k) => onChange([...nodes, newNode(k)])} />
    </section>
  );
}

// ---------------------------------------------------------------- the board

function RunningBoard({ program, since }: { program: Program | null; since: number }) {
  const [lit, setLit] = useState(false);
  const r = useMemo(() => (program ? run(program, 20000) : null), [program]);
  useFrame(() => {
    if (!r || !program) { if (lit) setLit(false); return; }
    let t = performance.now() - since;
    // After the precomputed stretch the loop just repeats.
    if (t > 20000 && r.loopMs > 0) t = 10000 + ((t - 10000) % r.loopMs);
    const on = r.loopMs === 0 ? r.changes.some((c) => c.pin === 13 && c.level === 1) : levelAt(r, 13, t) === 1;
    if (on !== lit) setLit(on);
  });
  const def: BoardDef = useMemo(() => ({
    ...ARDUINO_UNO,
    parts: ARDUINO_UNO.parts.map((p) => (p.id === 'LED_L' ? { ...p, props: { ...p.props, lit } } : p)),
  }), [lit]);
  const led = ARDUINO_UNO.parts.find((p) => p.id === 'LED_L')!;
  return (
    <>
      <Board def={def} />
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
  const [log, setLog] = useState<string[]>(['Arduino Uno on USB. Write a program, then Compile and Upload.']);
  const [hints, setHints] = useState(0);
  const [more, setMore] = useState(false);
  const [code, setCode] = useState(false);
  const [failed, setFailed] = useState(0);
  const [result, setResult] = useState<{ stars: 1 | 2 | 3; message: string } | null>(null);
  const timer = useRef<number | null>(null);

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
      c.ok ? `Sketch uses ${c.bytes} bytes (${((c.bytes / 32256) * 100).toFixed(0)}%) of program storage space.` : 'Compilation failed.']);
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
      // Give it a couple of blinks, then judge it the way the club would: by looking.
      timer.current = window.setTimeout(() => {
        const r = checkCoding(job, sent);
        setLog((l) => [...l, r.pass ? `✓ ${r.message}` : `✗ ${r.message}`]);
        if (r.pass) {
          const stars = failed === 0 && c.problems.length === 0 ? 3 : failed <= 2 ? 2 : 1;
          setResult({ stars, message: r.message });
          useWallet.getState().complete(job.id, stars);
        }
        else setFailed((f) => f + 1);
      }, 2400);
    }, UPLOAD_MS);
  };

  return (
    <div className="coding">
      <div className="coding-left">
        <section className="repair-card coding-card" aria-label="Job">
          <p className="nb-kicker">Node coding · Arduino Uno</p>
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
            <LaneView lane="setup" nodes={program.setup} problems={problems} onChange={(ns) => edit('setup', ns)} />
            <LaneView lane="loop" nodes={program.loop} problems={problems} onChange={(ns) => edit('loop', ns)} />
          </div>
        )}
      </div>
      <div className="coding-right">
        <div className="coding-board">
          <Canvas shadows camera={{ position: [-2, 78, 52], fov: 38, near: 0.5, far: 1000 }} dpr={[1, 2]}>
            <color attach="background" args={['#4a5553']} />
            <ambientLight intensity={0.55} /><hemisphereLight args={['#ffffff', '#40505a', 0.45]} />
            <directionalLight position={[60, 140, 80]} intensity={1.4} castShadow />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#5d6a66" roughness={0.95} /></mesh>
            <RunningBoard program={uploaded} since={since} />
            <OrbitControls makeDefault target={[-2, 0, -4]} maxPolarAngle={Math.PI / 2.3} minDistance={30} maxDistance={200} enablePan={false} />
          </Canvas>
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
          <h2>It’s alive</h2>
          <div className="desk-stars" aria-label={`${result.stars} of 3 stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= result.stars ? 'on' : ''}>★</span>)}</div>
          <p className="desk-result-sub">{result.message}</p>
          <ul className="star-rules">
            <li className="met"><span className="star-rule-stars">★</span><b>Blinks once a second</b></li>
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
