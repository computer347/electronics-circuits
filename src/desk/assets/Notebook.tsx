/**
 * Spiral lab book. The origin is the spine; closed, the cover lies over the pages to the
 * right, and opening swings it over to the left so the two-page spread shows the task.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { coverTexture, taskPagesTexture } from './textures';

export const NOTEBOOK = { w: 0.2, d: 0.27, pages: 0.012, cover: 0.003 } as const;

function half(t: THREE.Texture, right: boolean) {
  const c = t.clone();
  c.repeat.set(0.5, 1);
  c.offset.set(right ? 0.5 : 0, 0);
  c.needsUpdate = true;
  return c;
}

export function Notebook({ open, goal, level }: { open: { value: number }; goal: string; level: string }) {
  const { W, D, P, C } = { W: NOTEBOOK.w, D: NOTEBOOK.d, P: NOTEBOOK.pages, C: NOTEBOOK.cover };
  const pivot = useRef<THREE.Group>(null);
  const under = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const full = taskPagesTexture(goal, level);
    const left = half(full, false);
    // The cover's underside ends up turned half round once it's flipped over: turn the texture back.
    left.repeat.set(-0.5, -1); left.offset.set(0.5, 1);
    return { left, right: half(full, true), cover: coverTexture() };
  }, [goal, level]);

  const paperSide = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.95 }), []);
  const blue = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f3a66', roughness: 0.75 }), []);
  const pageMats = useMemo(() => [paperSide, paperSide, new THREE.MeshStandardMaterial({ map: tex.right, roughness: 0.9 }), blue, paperSide, paperSide], [paperSide, blue, tex]);
  const coverMats = useMemo(() => [blue, blue, new THREE.MeshStandardMaterial({ map: tex.cover, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: tex.left, roughness: 0.9 }), blue, blue], [blue, tex]);

  useFrame(() => {
    // The cover rises over the spine and lands flat on the left, at pages height.
    if (pivot.current) pivot.current.rotation.z = open.value * Math.PI;
    if (under.current) under.current.visible = open.value > 0.5;
  });

  return (
    <group>
      <mesh position={[W / 2, P / 2, 0]} geometry={useMemo(() => new THREE.BoxGeometry(W, P, D), [W, P, D])} material={pageMats} castShadow receiveShadow />
      <group ref={pivot} position={[0, P + C / 2, 0]}>
        <mesh position={[W / 2 + 0.002, 0, 0]} material={coverMats} castShadow receiveShadow>
          <boxGeometry args={[W + 0.004, C, D + 0.004]} />
        </mesh>
      </group>
      {/* the pages under the left half once open */}
      <mesh ref={under} position={[-W / 2, (P - C) / 2, 0]} visible={false}>
        <boxGeometry args={[W, P - C, D]} />
        <meshStandardMaterial color="#efe8d8" roughness={0.95} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0, P / 2 + 0.002, -D / 2 + 0.02 + i * ((D - 0.04) / 11)]} rotation={[0, 0, 0]} castShadow>
          <torusGeometry args={[0.009, 0.0014, 8, 18]} />
          <meshStandardMaterial color="#c9ccd2" metalness={0.85} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}
