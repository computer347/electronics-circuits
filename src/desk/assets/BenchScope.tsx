/**
 * Bench oscilloscope: a two-channel scope with a live LCD (yellow CH1, cyan CH2, like a real
 * one), a few knobs and two BNC sockets whose probe leads run to the holes you clip. The trace
 * comes from the live transient bench, redrawn every frame from the scope acquisition.
 */
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { bench } from '../../breadboard/live';
import { useBench } from '../../breadboard/store';
import { DIVS_X, DIVS_Y, measure, type ScopeCh } from '../../instruments/scope';
import { useScope } from '../../instruments/scopeStore';
import { formatSI } from '../../lib/units';
import { FONT_MONO } from './textures';

export const SCOPE = { w: 0.28, h: 0.15, d: 0.17 } as const;
/** BNC sockets on the front panel, in the scope's frame. */
export const BNC: Record<ScopeCh, THREE.Vector3> = {
  ch1: new THREE.Vector3(0.075, 0.03, SCOPE.d / 2 + 0.012),
  ch2: new THREE.Vector3(0.11, 0.03, SCOPE.d / 2 + 0.012),
};
export const TRACE: Record<ScopeCh, string> = { ch1: '#ffd21f', ch2: '#3ad7ff' };

const SW = 640, SH = 480;

function drawScreen(g: CanvasRenderingContext2D) {
  const sc = useScope.getState();
  g.fillStyle = '#0a0f14'; g.fillRect(0, 0, SW, SH);
  const top = 30, bottom = SH - 50, h = bottom - top, w = SW;
  const dx = w / DIVS_X, dy = h / DIVS_Y;
  g.strokeStyle = 'rgba(160,180,200,0.18)'; g.lineWidth = 1;
  for (let i = 0; i <= DIVS_X; i++) { g.beginPath(); g.moveTo(i * dx, top); g.lineTo(i * dx, bottom); g.stroke(); }
  for (let j = 0; j <= DIVS_Y; j++) { g.beginPath(); g.moveTo(0, top + j * dy); g.lineTo(w, top + j * dy); g.stroke(); }
  g.strokeStyle = 'rgba(160,180,200,0.35)';
  g.beginPath(); g.moveTo(w / 2, top); g.lineTo(w / 2, bottom); g.moveTo(0, top + h / 2); g.lineTo(w, top + h / 2); g.stroke();

  const samples = bench.scope.measured;
  const span = sc.tdiv * DIVS_X;
  const t0 = samples[0]?.t ?? 0;
  const probes = { ch1: !!useScopeProbes().ch1, ch2: !!useScopeProbes().ch2 };
  (['ch2', 'ch1'] as ScopeCh[]).forEach((ch) => {
    const set = sc[ch];
    if (!set.on || !probes[ch]) return;
    g.strokeStyle = TRACE[ch]; g.lineWidth = 3; g.beginPath();
    samples.forEach((s, i) => {
      const x = ((s.t - t0) / span) * w;
      const v = ch === 'ch1' ? s.v1 : s.v2;
      const y = top + h / 2 - (v / set.vdiv + set.pos) * dy;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
  });
  // Status line: timebase, volts per division, and what each channel measures.
  g.font = `bold 18px ${FONT_MONO}`; g.textBaseline = 'middle';
  g.fillStyle = '#9fb3c6'; g.fillText(`${formatSI(sc.tdiv, 's')}/div`, 10, 15);
  g.fillStyle = sc.running ? '#39d86a' : '#ff5a3c'; g.fillText(sc.running ? 'RUN' : 'STOP', SW - 70, 15);
  (['ch1', 'ch2'] as ScopeCh[]).forEach((ch, i) => {
    const set = sc[ch];
    const m = probes[ch] ? measure(bench.scope.measured, ch) : null;
    g.fillStyle = TRACE[ch];
    const x = 10 + i * 320;
    g.fillText(`${ch.toUpperCase()} ${formatSI(set.vdiv, 'V')}`, x, SH - 32);
    g.fillStyle = '#c9d6e2';
    g.fillText(m ? `${formatSI(m.vmax, 'V')} max · ${m.freq ? formatSI(m.freq, 'Hz') : `${formatSI(m.mean, 'V')} avg`}` : probes[ch] ? '…' : 'no probe', x, SH - 12);
  });
}

// The scope probes live in the bench store; read them without subscribing (this runs per frame).
const useScopeProbes = () => useBench.getState().scopeProbes;

export function BenchScope() {
  const screen = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = SW; c.height = SH;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { t, g: c.getContext('2d')! };
  }, []);
  const label = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2b2e31'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#d6d8d4'; g.font = `bold 26px ${FONT_MONO}`; g.textBaseline = 'middle';
    g.fillText('DIGITAL OSCILLOSCOPE · 2 CH', 16, 32);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(() => { drawScreen(screen.g); screen.t.needsUpdate = true; });

  const D = SCOPE.d / 2;
  return (
    <group>
      <RoundedBox args={[SCOPE.w, SCOPE.h, SCOPE.d]} radius={0.008} smoothness={3} position={[0, SCOPE.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d2d5d1" roughness={0.5} />
      </RoundedBox>
      {/* dark front panel */}
      <mesh position={[0, SCOPE.h / 2, D + 0.001]}><planeGeometry args={[SCOPE.w - 0.012, SCOPE.h - 0.012]} /><meshStandardMaterial color="#2b2e31" roughness={0.6} /></mesh>
      <mesh position={[-0.045, 0.085, D + 0.002]}><planeGeometry args={[0.17, 0.1275]} /><meshBasicMaterial map={screen.t} toneMapped={false} /></mesh>
      <mesh position={[-0.045, 0.012, D + 0.002]}><planeGeometry args={[0.17, 0.0213]} /><meshBasicMaterial map={label} toneMapped={false} /></mesh>
      {/* knobs: time/div, then a volts/div per channel, coloured like their trace */}
      {[[0.075, 0.115, '#1b1c1d'], [0.075, 0.07, TRACE.ch1], [0.11, 0.07, TRACE.ch2], [0.11, 0.115, '#1b1c1d']].map(([x, y, c], i) => (
        <group key={i} position={[x as number, y as number, D + 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.011, 0.012, 0.012, 24]} /><meshStandardMaterial color="#1b1c1d" roughness={0.45} /></mesh>
          <mesh position={[0, 0.0065, 0]}><cylinderGeometry args={[0.004, 0.004, 0.001, 12]} /><meshBasicMaterial color={c as string} /></mesh>
        </group>
      ))}
      {/* BNC sockets with coloured rings */}
      {(['ch1', 'ch2'] as ScopeCh[]).map((ch) => (
        <group key={ch} position={BNC[ch]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh><cylinderGeometry args={[0.007, 0.007, 0.012, 18]} /><meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.25} /></mesh>
          <mesh position={[0, -0.005, 0]}><cylinderGeometry args={[0.0095, 0.0095, 0.002, 20]} /><meshBasicMaterial color={TRACE[ch]} /></mesh>
        </group>
      ))}
      {/* feet */}
      {[-1, 1].map((k) => <mesh key={k} position={[k * (SCOPE.w / 2 - 0.03), -0.003, D - 0.02]}><boxGeometry args={[0.03, 0.008, 0.015]} /><meshStandardMaterial color="#1b1b1b" /></mesh>)}
    </group>
  );
}
