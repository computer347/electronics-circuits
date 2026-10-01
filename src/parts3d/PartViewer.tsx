/**
 * Dev part viewer (open the app with ?parts, or ?parts=<id>): one model at a time, picked from
 * a dropdown grouped by family, fitted to the view. Every catalogue part, every board (some,
 * like the Nano, aren't in the catalogue) and a few generated PCBs. ←/→ step through the list.
 * Temporary: a checking tool for the models, not part of the game.
 */
import { Bounds, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../desk/desk.css';
import { formatSI } from '../lib/units';
import { CATALOGUE, type Family } from '../parts/catalogue';
import { BOARDS, Board, tooltip, type BoardDef, type Placed } from './boards';
import { StudioEnvironment } from './common';
import { generateBoard } from './pcbgen';
import { MODELS } from './registry';
// Boards with a real circuit (the Uno, the DHT11) draw their copper from it.
import '../repair/netlists';
import { DPR, SHADOW_MAP } from '../lib/gfx';

interface Item { id: string; group: string; name: string; note?: string; board?: BoardDef; render?: () => ReactNode }

const FAMILY_NAME: Record<Family, string> = {
  passive: 'Passives', semiconductor: 'Semiconductors', power: 'Power', smd: 'Surface mount', board: 'Boards', module: 'Modules',
};

function buildItems(): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  for (const fam of Object.keys(FAMILY_NAME) as Family[]) {
    for (const e of CATALOGUE.filter((c) => c.family === fam)) {
      const board = e.model.startsWith('board:') ? BOARDS.find((b) => `board:${b.id}` === e.model) : undefined;
      if (board) seen.add(board.id);
      out.push({ id: e.id, group: FAMILY_NAME[fam], name: e.name, note: `${e.package} · ${e.job}`, board, render: MODELS[e.model]?.render });
    }
  }
  for (const b of BOARDS.filter((x) => !seen.has(x.id))) out.push({ id: b.id, group: 'Boards (not in the catalogue)', name: b.name, board: b });
  for (const seed of [1, 2, 3, 7, 42]) {
    const b = generateBoard(seed);
    out.push({ id: `gen-${seed}`, group: 'Generated PCBs', name: `Seed ${seed} · ${b.w} × ${b.d} mm`, board: b });
  }
  return out;
}

const readId = () => new URLSearchParams(location.search).get('parts') || '';

export function PartViewer() {
  const items = useMemo(buildItems, []);
  const [id, setId] = useState(() => (items.some((i) => i.id === readId()) ? readId() : items[0]!.id));
  const [hover, setHover] = useState<Placed | null>(null);
  const idx = items.findIndex((i) => i.id === id);
  const item = items[idx]!;
  const groups = useMemo(() => [...new Set(items.map((i) => i.group))], [items]);

  // keep the pick in the URL, so a reload stays on it
  useEffect(() => { history.replaceState(null, '', `?parts=${encodeURIComponent(id)}`); setHover(null); }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') setId(items[(idx + 1) % items.length]!.id);
      if (e.key === 'ArrowLeft') setId(items[(idx - 1 + items.length) % items.length]!.id);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [idx, items]);

  return (
    <div className="gallery">
      <Canvas frameloop="demand" shadows camera={{ position: [0, 60, 60], fov: 35, near: 0.1, far: 2000 }} dpr={DPR}>
        <color attach="background" args={['#5a6570']} />
        <ambientLight intensity={0.6} />
        <StudioEnvironment />
        <hemisphereLight args={['#ffffff', '#40505a', 0.5]} />
        <directionalLight position={[60, 120, 80]} intensity={1.6} castShadow shadow-mapSize={SHADOW_MAP} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80} />
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[600, 600]} /><meshStandardMaterial color="#6d747a" roughness={0.95} /></mesh>
        <gridHelper args={[200, 20, '#808890', '#737a80']} position={[0, 0, 0]} />
        <Bounds key={id} fit clip margin={1.3}>
          <group>{item.board ? <Board def={item.board} onHover={setHover} /> : item.render?.()}</group>
        </Bounds>
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="viewer-bar">
        <button className="desk-chip" onClick={() => setId(items[(idx - 1 + items.length) % items.length]!.id)}>←</button>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {items.filter((i) => i.group === g).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="desk-chip" onClick={() => setId(items[(idx + 1) % items.length]!.id)}>→</button>
        <span className="viewer-count">{idx + 1} / {items.length}</span>
      </div>
      <p className="viewer-note">
        <b>{item.group}</b> · {item.note ?? (item.board ? `${item.board.w} × ${item.board.d} mm · ${item.board.parts.length} parts` : '')}
        {item.board && <><br />{hover ? tooltip(hover, (x, u) => formatSI(x, u)) : 'Point at a part on the board for its name'}</>}
        <br /><span className="viewer-hint">Grid: 10 mm · drag to orbit · ←/→ next part</span>
      </p>
    </div>
  );
}
