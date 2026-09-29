/** The desk top, the floor, the back wall with the corkboard (the level map) and the riso poster. */
import { RoundedBox } from '@react-three/drei';
import { WORLD0_PLAN } from '../../levels';
import { corkTexture, levelCardTexture, posterTexture, wallTexture, woodTexture } from './textures';

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

/** The level map: a corkboard with one card per World 0 level, the current one ringed. */
export function Corkboard({ current, passed, unlocked, onPick }: {
  current: number; passed: Set<number>; unlocked: Set<number>;
  /** Set while the map is in focus: a click on an open card plays it. */
  onPick?: (n: number) => void;
}) {
  return (
    <group>
      <RoundedBox args={[0.66, 0.3, 0.02]} radius={0.006} castShadow receiveShadow>
        <meshStandardMaterial color="#6b4a2c" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0105]}>
        <planeGeometry args={[0.62, 0.26]} />
        <meshStandardMaterial map={corkTexture()} roughness={1} />
      </mesh>
      {WORLD0_PLAN.map((l, i) => {
        const state = l.number === current ? 'here' : passed.has(l.number) ? 'done' : unlocked.has(l.number) ? 'open' : 'later';
        const x = -0.24 + i * 0.12, y = i % 2 ? -0.03 : 0.03;
        const canPick = !!onPick && unlocked.has(l.number);
        return (
          <group key={l.number} position={[x, y, 0.012]} rotation={[0, 0, (i % 3 - 1) * 0.05]}
            onClick={canPick ? (e) => { e.stopPropagation(); onPick!(l.number); } : undefined}
            onPointerOver={canPick ? () => { document.body.style.cursor = 'pointer'; } : undefined}
            onPointerOut={canPick ? () => { document.body.style.cursor = ''; } : undefined}>
            <mesh castShadow>
              <planeGeometry args={[0.1, 0.078]} />
              <meshStandardMaterial map={levelCardTexture(l.number, l.title, state)} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.03, 0.006]}>
              <sphereGeometry args={[0.006, 12, 8]} />
              <meshStandardMaterial color={state === 'here' ? '#ff48b0' : '#0078bf'} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
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
