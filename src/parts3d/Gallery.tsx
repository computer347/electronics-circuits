/**
 * The parts gallery (open the app with ?gallery): every catalogue part on a cutting mat, one
 * row per family, small parts magnified (the factor is on their label). Click a part to bring
 * it up close with its catalogue card; on a board, point at a part for its tooltip.
 * A testing page for the models; players meet the parts in the Parts Lab.
 */
import { Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import '../desk/desk.css';
import { formatSI } from '../lib/units';
import { CATALOGUE, type CatalogueEntry, type Family } from '../parts/catalogue';
import { BOARDS, Board, tooltip, type Placed } from './boards';
import { generateBoard } from './pcbgen';
import { MODELS } from './registry';
// Boards with a real circuit (the Uno, the DHT11) draw their copper from it.
import '../repair/netlists';
import { StudioEnvironment } from './common';

const FAMILIES: { id: Family; name: string }[] = [
  { id: 'passive', name: 'Passives' }, { id: 'semiconductor', name: 'Semiconductors' }, { id: 'power', name: 'Power' },
  { id: 'smd', name: 'Surface mount' }, { id: 'board', name: 'Boards' }, { id: 'module', name: 'Modules' },
];
const CELL = 76;

/** How much to magnify a part so it fills about 40 mm of its cell. */
const zoomOf = (e: CatalogueEntry) => {
  const s = MODELS[e.model]?.size ?? [10, 10, 10];
  return Math.max(0.6, Math.min(24, 40 / Math.max(s[0], s[1]), 26 / s[2]));
};

function Cell({ e, at, onPick, picked }: { e: CatalogueEntry; at: [number, number]; onPick: (e: CatalogueEntry) => void; picked: boolean }) {
  const m = MODELS[e.model];
  const z = e.family === 'board' || e.family === 'module' ? Math.min(1, 55 / Math.max(m?.size[0] ?? 50, m?.size[1] ?? 50)) : zoomOf(e);
  return (
    <group position={[at[0], 0, at[1]]} onClick={(ev) => { ev.stopPropagation(); onPick(e); }}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CELL - 4, CELL - 4]} />
        <meshStandardMaterial color={picked ? '#ffe800' : '#e9ecef'} roughness={0.9} transparent opacity={picked ? 0.5 : 0.18} />
      </mesh>
      <group scale={z}>{m?.render()}</group>
      <Html position={[0, 0, CELL / 2 - 8]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <span className="part-tag">{e.name}{z > 1.5 ? ` · ×${z.toFixed(0)}` : ''}</span>
      </Html>
    </group>
  );
}

export function Gallery() {
  const [picked, setPicked] = useState<CatalogueEntry | null>(null);
  const [hover, setHover] = useState<Placed | null>(null);
  const board = picked && (picked.family === 'board' || picked.family === 'module') ? BOARDS.find((b) => `board:${b.id}` === picked.model) : undefined;
  const rows = FAMILIES.map((f) => CATALOGUE.filter((e) => e.family === f.id));
  const width = Math.max(...rows.map((r) => r.length)) * CELL;
  return (
    <div className="gallery">
      <Canvas shadows camera={{ position: [-60, 820, 520], fov: 40, near: 1, far: 4000 }} dpr={[1, 2]} onPointerMissed={() => setPicked(null)}>
        <color attach="background" args={['#5a6570']} />
        <ambientLight intensity={0.6} />
        <StudioEnvironment />
        <hemisphereLight args={['#ffffff', '#40505a', 0.5]} />
        <directionalLight position={[200, 500, 300]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-600} shadow-camera-right={600} shadow-camera-top={600} shadow-camera-bottom={-600} />
        {/* the grey cutting mat */}
        <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width + 200, FAMILIES.length * CELL + 200]} /><meshStandardMaterial color="#6d747a" roughness={0.95} /></mesh>
        {rows.map((r, j) => r.map((e, i) => (
          <Cell key={e.id} e={e} picked={picked?.id === e.id} onPick={setPicked}
            at={[-width / 2 + CELL / 2 + i * CELL, -((FAMILIES.length - 1) * CELL) / 2 + j * CELL]} />
        )))}
        {rows.map((r, j) => r.length > 0 && (
          <Html key={j} position={[-width / 2 - 40, 0, -((FAMILIES.length - 1) * CELL) / 2 + j * CELL]} center style={{ pointerEvents: 'none' }}>
            <span className="scan-tag plaza">{FAMILIES[j]!.name}</span>
          </Html>
        ))}
        <OrbitControls makeDefault target={[-60, 0, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={1500} />
      </Canvas>
      {picked && (
        <div className="gallery-card">
          <p className="nb-kicker">{picked.family} · {picked.package}</p>
          <h2>{picked.name}</h2>
          <p>{picked.job}</p>
          <ul>{picked.facts.map((f) => <li key={f.label}><b>{f.label}</b> {f.text}</li>)}</ul>
          {picked.pins.length > 0 && <p className="gallery-pins">Pins: {picked.pins.join(' · ')}</p>}
          {board && (
            <div className="gallery-board">
              <Canvas camera={{ position: [0, 70, 55], fov: 40 }} dpr={[1, 2]}>
                <color attach="background" args={['#6d747a']} />
                <ambientLight intensity={0.7} /><directionalLight position={[30, 80, 40]} intensity={1.4} />
                <group scale={Math.min(1.2, 70 / board.w)}><Board def={board} onHover={setHover} /></group>
                <OrbitControls makeDefault />
              </Canvas>
              <p className="gallery-tip">{hover ? tooltip(hover, (x, u) => formatSI(x, u)) : 'Point at a part on the board'}</p>
            </div>
          )}
        </div>
      )}
      <p className="gallery-head">Parts gallery · {CATALOGUE.length} parts · drag to orbit, click a part</p>
      <GeneratedBoard />
    </div>
  );
}

/** A procedurally generated PCB: a new believable board for every seed. */
function GeneratedBoard() {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const def = useMemo(() => generateBoard(seed), [seed]);
  const [hover, setHover] = useState<Placed | null>(null);
  return (
    <div className="gallery-gen">
      <p className="nb-kicker">Procedural PCB · seed {seed}</p>
      <div className="gallery-board">
        <Canvas camera={{ position: [0, 70, 50], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={['#6d747a']} />
          <ambientLight intensity={0.6} /><directionalLight position={[30, 80, 40]} intensity={1.3} />
          <StudioEnvironment />
          <group scale={Math.min(1.4, 70 / def.w)}><Board def={def} onHover={setHover} /></group>
          <OrbitControls makeDefault />
        </Canvas>
      </div>
      <p className="gallery-tip">{hover ? tooltip(hover, (x, u) => formatSI(x, u)) : `${def.w} × ${def.d} mm · ${def.parts.length} parts`}</p>
      <button className="desk-chip" onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))}>New board</button>
    </div>
  );
}
