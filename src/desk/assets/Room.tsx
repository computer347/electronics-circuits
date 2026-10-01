/** The desk top, the floor, the back wall with the corkboard (the level map) and the riso poster. */
import { RoundedBox } from '@react-three/drei';
import { WORLDS } from '../../levels';
import { corkTexture, freeBenchCardTexture, levelCardTexture, worldTabTexture, posterTexture, wallTexture, woodTexture } from './textures';

export const DESK = { width: 1.7, depth: 0.86, thickness: 0.04, frontZ: 0.4, wallZ: -0.46 } as const;

export function Desk() {
  const cz = DESK.frontZ - DESK.depth / 2;
  return (
    <group>
      <mesh position={[0, -DESK.thickness / 2, cz]} receiveShadow>
        <boxGeometry args={[DESK.width, DESK.thickness, DESK.depth]} />
        <meshStandardMaterial map={woodTexture()} roughness={0.62} metalness={0} />
      </mesh>
      {/* the rounded, worn front edge */}
      <mesh position={[0, -DESK.thickness / 2, DESK.frontZ]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
        <cylinderGeometry args={[DESK.thickness / 2, DESK.thickness / 2, DESK.width, 20]} />
        <meshStandardMaterial color="#b88a5c" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#241c15" roughness={1} />
      </mesh>
    </group>
  );
}

export function Wall() {
  return (
    <mesh position={[0, 0.6, DESK.wallZ]} receiveShadow>
      <planeGeometry args={[4, 2]} />
      <meshStandardMaterial map={wallTexture()} roughness={0.95} />
    </mesh>
  );
}


/**
 * The corkboard holds a world's levels and the free bench card in even rows: two for small
 * worlds, three once a world has more than 17 levels (sized for the biggest world, so cards
 * don't jump about when you switch tabs).
 */
const MOST = Math.max(...WORLDS.map((w) => w.plan.length)) + 1;
const ROWS = MOST > 18 ? 3 : 2;
const PER_ROW = Math.ceil(MOST / ROWS);
const PITCH = 0.6 / PER_ROW;
const CARD_W = Math.min(0.1, PITCH * 0.9);
const ROW_Y = ROWS === 3 ? [0.064, -0.002, -0.068] : [0.05, -0.068];
const slot = (i: number): [number, number] => [-0.3 + PITCH / 2 + (i % PER_ROW) * PITCH, ROW_Y[Math.floor(i / PER_ROW)] ?? -0.068];

/** The level map: a corkboard with a tab per world, and a card per level of the world on show. */
export function Corkboard({ world, current, passed, unlocked, onPick, onFreeBench, onWorld }: {
  /** The world on show, and the current level's number in it (0 if it's in another world). */
  world: number; current: number; passed: Set<number>; unlocked: Set<number>;
  /** Set while the map is in focus: a click on a tab shows that world. */
  onWorld?: (n: number) => void;
  /** Set while the map is in focus: a click on an open card plays it. */
  onPick?: (n: number) => void;
  /** The last card: the free bench, always open. */
  onFreeBench?: () => void;
}) {
  const plan = WORLDS.find((w) => w.number === world)?.plan ?? [];
  return (
    <group>
      <RoundedBox args={[0.66, 0.3, 0.02]} radius={0.006} castShadow receiveShadow>
        <meshStandardMaterial color="#6b4a2c" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0105]}>
        <planeGeometry args={[0.62, 0.26]} />
        <meshStandardMaterial map={corkTexture()} roughness={1} />
      </mesh>
      {WORLDS.map((w, i) => (
        <group key={w.number} position={[-0.24 + i * 0.13, 0.118, 0.012]}
          onClick={onWorld ? (e) => { e.stopPropagation(); onWorld(w.number); } : undefined}
          onPointerOver={onWorld ? () => { document.body.style.cursor = 'pointer'; } : undefined}
          onPointerOut={onWorld ? () => { document.body.style.cursor = ''; } : undefined}>
          <mesh><planeGeometry args={[0.12, 0.034]} /><meshStandardMaterial map={worldTabTexture(w.number, w.name, w.number === world)} roughness={0.9} /></mesh>
        </group>
      ))}
      {plan.map((l, i) => {
        const state = l.number === current ? 'here' : passed.has(l.number) ? 'done' : unlocked.has(l.number) ? 'open' : 'later';
        // Two rows: levels in order, the free bench last.
        const [x, y0] = slot(i);
        const y = y0 + (i % 2 ? -0.006 : 0.006);
        const canPick = !!onPick && unlocked.has(l.number);
        return (
          <group key={l.number} position={[x, y, 0.012]} rotation={[0, 0, (i % 3 - 1) * 0.05]}
            onClick={canPick ? (e) => { e.stopPropagation(); onPick!(l.number); } : undefined}
            onPointerOver={canPick ? () => { document.body.style.cursor = 'pointer'; } : undefined}
            onPointerOut={canPick ? () => { document.body.style.cursor = ''; } : undefined}>
            <mesh castShadow>
              <planeGeometry args={[CARD_W, CARD_W * 0.78]} />
              <meshStandardMaterial map={levelCardTexture(l.number, l.title, state, world)} roughness={0.9} />
            </mesh>
            <mesh position={[0, CARD_W * 0.3, 0.006]}>
              <sphereGeometry args={[0.006, 12, 8]} />
              <meshStandardMaterial color={state === 'here' ? '#ff48b0' : '#0078bf'} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
      {/* the free bench: a blue card at the end, always open */}
      <group position={[...slot(plan.length), 0.012]} rotation={[0, 0, 0.06]}
        onClick={onFreeBench ? (e) => { e.stopPropagation(); onFreeBench(); } : undefined}
        onPointerOver={onFreeBench ? () => { document.body.style.cursor = 'pointer'; } : undefined}
        onPointerOut={onFreeBench ? () => { document.body.style.cursor = ''; } : undefined}>
        <mesh castShadow>
          <planeGeometry args={[CARD_W, CARD_W * 0.78]} />
          <meshStandardMaterial map={freeBenchCardTexture()} roughness={0.9} />
        </mesh>
        <mesh position={[0, CARD_W * 0.3, 0.006]}><sphereGeometry args={[0.006, 12, 8]} /><meshStandardMaterial color="#ffe800" roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

export function Poster() {
  return (
    <mesh castShadow>
      <planeGeometry args={[0.2, 0.28]} />
      <meshStandardMaterial map={posterTexture()} roughness={0.9} />
    </mesh>
  );
}

export function Mug() {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.036, 0.1, 32, 1, true]} />
        <meshStandardMaterial color="#e9e2d2" roughness={0.35} side={2} />
      </mesh>
      <mesh position={[0, 0.002, 0]}><cylinderGeometry args={[0.036, 0.036, 0.004, 32]} /><meshStandardMaterial color="#e9e2d2" /></mesh>
      <mesh position={[0, 0.082, 0]}><cylinderGeometry args={[0.038, 0.038, 0.004, 32]} /><meshStandardMaterial color="#3b2415" roughness={0.15} /></mesh>
      <mesh position={[0.045, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <torusGeometry args={[0.024, 0.006, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#e9e2d2" roughness={0.35} />
      </mesh>
      {/* a riso pink stripe */}
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.0405, 0.0395, 0.012, 32, 1, true]} /><meshStandardMaterial color="#ff48b0" roughness={0.4} /></mesh>
    </group>
  );
}
