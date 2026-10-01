/**
 * Desk lamp: weighted base, two arms and a shade whose opening faces the desk. The warm
 * spotlight lives in the shade and aims at `aim`, so the light comes from where the bulb is.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SHADOW_MAP } from '../../lib/gfx';

const METAL = { color: '#2d2a27', roughness: 0.38, metalness: 0.55 } as const;

function Rod({ from, to, r = 0.007 }: { from: THREE.Vector3; to: THREE.Vector3; r?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const d = to.clone().sub(from);
    return { pos: from.clone().add(to).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), len: d.length() };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 12]} />
      <meshStandardMaterial {...METAL} />
    </mesh>
  );
}

export function Lamp({ base, head, aim, intensity }: { base: THREE.Vector3; head: THREE.Vector3; aim: THREE.Vector3; intensity: number }) {
  const elbow = useMemo(() => new THREE.Vector3(base.x + 0.06, base.y + 0.36, base.z - 0.08), [base]);
  const shade = useRef<THREE.Group>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    // Point the shade's opening (its local −y) at the aim point.
    const dir = aim.clone().sub(head).normalize();
    shade.current?.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    target.position.copy(aim);
    target.updateMatrixWorld();
    if (spot.current) spot.current.target = target;
  }, [aim, head, target]);

  return (
    <group>
      <mesh position={[base.x, base.y + 0.012, base.z]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.078, 0.024, 40]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[base.x, base.y + 0.03, base.z]}><sphereGeometry args={[0.014, 16, 12]} /><meshStandardMaterial {...METAL} /></mesh>
      <Rod from={new THREE.Vector3(base.x, base.y + 0.03, base.z)} to={elbow} />
      <mesh position={elbow}><sphereGeometry args={[0.013, 16, 12]} /><meshStandardMaterial {...METAL} /></mesh>
      <Rod from={elbow} to={head} />
      {/* a spring along the lower arm, for the look of a real balanced-arm lamp */}
      <Rod from={new THREE.Vector3(base.x + 0.02, base.y + 0.06, base.z)} to={elbow.clone().add(new THREE.Vector3(0.018, -0.06, 0))} r={0.003} />
      <group position={head} ref={shade}>
        <mesh position={[0, -0.04, 0]} castShadow>
          <coneGeometry args={[0.065, 0.1, 40, 1, true]} />
          <meshStandardMaterial {...METAL} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.012, 0]}><sphereGeometry args={[0.02, 16, 12]} /><meshStandardMaterial {...METAL} /></mesh>
        <mesh position={[0, -0.07, 0]}>
          <sphereGeometry args={[0.024, 20, 14]} />
          <meshBasicMaterial color="#fff1d0" toneMapped={false} />
        </mesh>
      </group>
      <spotLight
        ref={spot}
        position={head.clone().add(aim.clone().sub(head).normalize().multiplyScalar(0.07))}
        color="#ffd9a0"
        intensity={intensity}
        angle={0.72}
        penumbra={0.75}
        distance={3}
        decay={1.2}
        castShadow
        shadow-mapSize={SHADOW_MAP}
        shadow-bias={-0.0004}
        shadow-radius={6}
        shadow-camera-near={0.05}
        shadow-camera-far={2.5}
      />
    </group>
  );
}
