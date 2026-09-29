/**
 * Antistatic (ESD) mat: grey-blue rubber with a printed grid and ruler, the yellow ESD mark,
 * and a snap stud in the corner with its green-yellow ground lead running to the back.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { MAT_T } from '../layout';
import { FONT_MONO } from './textures';

let tex: THREE.CanvasTexture | null = null;
function matTexture() {
  if (tex) return tex;
  const W = 1280, H = 880;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4b6272'; g.fillRect(0, 0, W, H);
  // a faint rubbery mottle
  for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
  // 1 cm grid, heavier every 5 cm (the mat is 64 × 44 cm: 20 px per cm)
  for (let x = 0; x <= W; x += 20) { g.strokeStyle = x % 100 ? 'rgba(210,225,235,0.08)' : 'rgba(210,225,235,0.2)'; g.lineWidth = x % 100 ? 1 : 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 20) { g.strokeStyle = y % 100 ? 'rgba(210,225,235,0.08)' : 'rgba(210,225,235,0.2)'; g.lineWidth = y % 100 ? 1 : 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // ruler along the front edge
  g.fillStyle = 'rgba(230,238,244,0.75)'; g.font = `bold 16px ${FONT_MONO}`;
  for (let cm = 0; cm <= 60; cm += 5) g.fillText(String(cm), 40 + cm * 20 - 6, H - 14);
  for (let cm = 0; cm <= 60; cm++) { g.fillRect(40 + cm * 20, H - 44, 2, cm % 5 ? 8 : 14); }
  // ESD mark: yellow triangle with a hand
  g.save(); g.translate(W - 120, 60);
  g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(0, 60); g.lineTo(35, 0); g.lineTo(70, 60); g.closePath(); g.fill();
  g.fillStyle = '#1b1b1b'; g.font = `bold 14px ${FONT_MONO}`; g.fillText('ESD', 20, 50);
  g.restore();
  g.fillStyle = 'rgba(230,238,244,0.55)'; g.font = `bold 18px ${FONT_MONO}`; g.fillText('ANTISTATIC · GROUND BEFORE USE', 40, 40);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function AntistaticMat({ w, d, cordTo }: { w: number; d: number; cordTo: THREE.Vector3 }) {
  const stud = new THREE.Vector3(-w / 2 + 0.025, MAT_T, -d / 2 + 0.025);
  const cord = useMemo(() => {
    const to = cordTo.clone();
    const mid = stud.clone().lerp(to, 0.5).setY(0.004);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([stud.clone().setY(MAT_T + 0.006), stud.clone().add(new THREE.Vector3(-0.02, 0.01, -0.03)), mid, to]), 48, 0.0022, 8, false);
  }, [cordTo]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <mesh position={[0, MAT_T / 2, 0]} receiveShadow>
        <boxGeometry args={[w, MAT_T, d]} />
        <meshStandardMaterial map={matTexture()} roughness={0.92} metalness={0} />
      </mesh>
      <mesh position={stud.clone().setY(MAT_T + 0.002)} castShadow>
        <cylinderGeometry args={[0.006, 0.007, 0.004, 20]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh geometry={cord} castShadow>
        <meshStandardMaterial color="#3faa4f" roughness={0.5} />
      </mesh>
      {/* the yellow tracer on the green-yellow lead */}
      <mesh geometry={cord} scale={[1.001, 1.001, 1.001]}>
        <meshStandardMaterial color="#e8d23a" roughness={0.5} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
