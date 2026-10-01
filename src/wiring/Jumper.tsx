/**
 * A jumper wire between two pin tops, arched like a real one, and the heights it plugs in at.
 * Shared by the wiring bench and the coding bench (where the module comes pre-wired).
 */
import { useMemo } from 'react';
import * as THREE from 'three';

const TOP = 1.6;
/** Top of a male header pin (the module's). */
export const MODULE_PIN_Y = TOP + 7.5;
/** Top of a female header (the board's). */
export const BOARD_PIN_Y = TOP + 8.5;

export function Jumper({ a, b, color, onClick }: { a: THREE.Vector3; b: THREE.Vector3; color: string; onClick?: () => void }) {
  const geom = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = 10 + a.distanceTo(b) * 0.18;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().setY(a.y + 6), mid.clone().setY(mid.y + lift), b.clone().setY(b.y + 6), b]);
    return new THREE.TubeGeometry(curve, 64, 0.7, 10, false);
  }, [a, b]);
  return (
    <mesh geometry={geom} castShadow
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onPointerOver={onClick ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
      onPointerOut={onClick ? () => { document.body.style.cursor = ''; } : undefined}>
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  );
}
