/**
 * Development boards and modules, built from data: a PCB blank, its silkscreen, and a list
 * of placed parts. Each placed part has an id, a name and (for passives) a value with its
 * tolerance, so repair levels can give every tiny part a tooltip, probe its pads and swap it.
 *
 * Boards: Arduino Uno, ESP32 DevKit, ESP-01, STM32 Blue Pill, RC522 RFID reader, 0.96" OLED,
 * DHT11, HC-SR04 and a USB stick. Millimetres; origin at the board's centre, top at y = 1.6.
 */
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { HeaderRow, Pcb, printTexture, SHIELD, silkTexture } from './common';
import { ChipCap, ChipLed, ChipResistor, Crystal, DcJack, MicroUsb, QFP, SmdButton, SOIC8, SOT223, SOT23, UsbB, type ChipSize } from './smd';
import { Electrolytic } from './tht';
import { pcbArt } from './pcbArt';
import { ElecSmd, JumperCap, QFN, Resonator, TSOP48, Xtal3225 } from './smd';

export type PlacedKind =
  | 'chipR' | 'chipC' | 'chipLed' | 'sot23' | 'sot223' | 'soic8' | 'qfp' | 'crystal' | 'usbB' | 'microUsb' | 'dcJack'
  | 'button' | 'header' | 'headerF' | 'elec' | 'wroom' | 'display' | 'transducer' | 'dhtBody' | 'usbA' | 'qfn' | 'xtal3225' | 'jumper' | 'tsop48' | 'dip28' | 'resonator' | 'elecSmd';

export interface Placed {
  id: string;
  kind: PlacedKind;
  at: [number, number];
  /** Degrees about y. */
  rot?: number;
  /** What the tooltip calls it: "Resistor 0603", "Power LED"… */
  name?: string;
  /** Nominal value and tolerance (fraction), for passives: 1000 Ω ± 0.05. */
  value?: { amount: number; unit: 'Ω' | 'F' | 'V' | 'Hz'; tol?: number };
  props?: Record<string, unknown>;
}

export interface BoardDef {
  id: string;
  name: string;
  w: number;
  d: number;
  color: string;
  holes?: [number, number][];
  silk?: (g: CanvasRenderingContext2D, px: number, w: number, d: number) => void;
  parts: Placed[];
  /** Which pads are joined, by name: "GND": ["C1.2", "U1.5"…]. Left out, plausible nets are made (pcbgen.autoNets). */
  nets?: Record<string, string[]>;
  /** Pad plating: tinned (hasl, silver) or gold (enig). */
  finish?: 'hasl' | 'enig';
  /** Copper the board draws itself, under the mask (antenna loops and meanders), in mm via `px`. */
  copper?: (g: CanvasRenderingContext2D, px: number, w: number, d: number) => void;
}

function PlacedModel({ p, onHover }: { p: Placed; onHover?: (p: Placed | null) => void }) {
  const q = (p.props ?? {}) as Record<string, never>;
  let m: ReactNode = null;
  switch (p.kind) {
    case 'chipR': m = <ChipResistor size={(q.size ?? '0603') as ChipSize} code={q.code ?? '102'} />; break;
    case 'chipC': m = <ChipCap size={(q.size ?? '0603') as ChipSize} />; break;
    case 'chipLed': m = <ChipLed size={(q.size ?? '0603') as ChipSize} color={q.color ?? '#39d86a'} lit={!!q.lit} />; break;
    case 'sot23': m = <SOT23 marking={q.marking} />; break;
    case 'sot223': m = <SOT223 marking={q.marking} volts={q.volts} />; break;
    case 'soic8': m = <SOIC8 marking={q.marking} />; break;
    case 'qfp': m = <QFP n={q.n} size={q.size} marking={q.marking} />; break;
    case 'crystal': m = <Crystal mhz={q.mhz} />; break;
    case 'usbB': m = <UsbB />; break;
    // a mini-USB socket is the same idea, a size up: wider, taller, deeper
    case 'microUsb': m = q.mini ? <group scale={[1.35, 1.45, 1.05]}><MicroUsb /></group> : <MicroUsb />; break;
    case 'dcJack': m = <DcJack />; break;
    case 'button': m = <SmdButton w={q.w} color={q.color} />; break;
    case 'header': m = <HeaderRow n={q.n ?? 8} at={[0, 0, 0]} />; break;
    case 'qfn': m = <QFN n={q.n} size={q.size} marking={q.marking} />; break;
    case 'xtal3225': m = <Xtal3225 mhz={q.mhz} />; break;
    case 'jumper': m = <JumperCap color={q.color} />; break;
    case 'tsop48': m = <TSOP48 marking={q.marking} />; break;
    case 'dip28': m = <SocketedDip marking={q.marking} />; break;
    case 'resonator': m = <Resonator />; break;
    case 'elecSmd': m = <ElecSmd uF={q.uF} volts={q.volts} />; break;
    case 'headerF': m = <HeaderRow n={q.n ?? 8} at={[0, 0, 0]} female />; break;
    case 'elec': m = <group scale={q.scale ?? 0.8}><Electrolytic uF={q.uF} volts={q.volts} /></group>; break;
    case 'wroom': m = <Wroom />; break;
    case 'display': m = <Display w={q.w ?? 26} d={q.d ?? 15} flex={q.flex} screen={q.screen} />; break;
    case 'transducer': m = <Transducer />; break;
    case 'dhtBody': m = <DhtBody />; break;
    case 'usbA': m = <UsbA />; break;
  }
  return (
    <group position={[p.at[0], 0, p.at[1]]} rotation={[0, ((p.rot ?? 0) * Math.PI) / 180, 0]}
      onPointerOver={onHover ? (e) => { e.stopPropagation(); onHover(p); } : undefined}
      onPointerOut={onHover ? () => onHover(null) : undefined}>
      {m}
    </group>
  );
}

/** A board with its parts. `onHover` reports the placed part under the pointer (for tooltips). */
export function Board({ def, onHover }: { def: BoardDef; onHover?: (p: Placed | null) => void }) {
  // The board's copper, pads and silkscreen, laid out from its parts (cached per board).
  const art = typeof document === 'undefined' ? undefined : pcbArt(def, def.finish ?? 'hasl');
  const silk = !art && def.silk ? silkTexture(def.id, def.w, def.d, (g, px) => def.silk!(g, px, def.w, def.d)) : undefined;
  return (
    <Pcb w={def.w} d={def.d} color={def.color} holes={def.holes} silk={silk} art={art}>
      {def.parts.map((p) => <PlacedModel key={p.id} p={p} onHover={onHover} />)}
    </Pcb>
  );
}

// ---------------------------------------------------------------- module bodies

/** ESP32-WROOM module: a shielded can on its own small PCB, with the antenna end bare. */
function Wroom() {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[18, 0.8, 25.5]} /><meshStandardMaterial color="#1a1a1a" roughness={0.6} /></mesh>
      <mesh position={[0, 1.9, 2.5]} castShadow><boxGeometry args={[16.5, 2.2, 17.5]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[0, 3.01, 2.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[14, 8]} /><meshBasicMaterial map={printTexture(['ESP32-WROOM-32', 'FCC ID', 'CE'], { size: 22, w: 256, h: 150, fg: '#444' })} transparent /></mesh>
      {/* the meandering antenna trace */}
      <mesh position={[0, 0.81, -9.8]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[16, 5]} /><meshBasicMaterial map={antennaTexture()} transparent /></mesh>
    </group>
  );
}

let antTex: THREE.CanvasTexture | null = null;
function antennaTexture() {
  if (antTex) return antTex;
  const c = document.createElement('canvas');
  c.width = 320; c.height = 100;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#c8b27a'; g.lineWidth = 7; g.beginPath();
  g.moveTo(10, 90);
  for (let i = 0; i < 7; i++) { const x = 20 + i * 42; g.lineTo(x, 90); g.lineTo(x, 12); g.lineTo(x + 21, 12); g.lineTo(x + 21, 90); }
  g.stroke();
  antTex = new THREE.CanvasTexture(c);
  antTex.colorSpace = THREE.SRGBColorSpace;
  return antTex;
}

/**
 * A small OLED panel as it sits on its module: two sheets of glass (the top one a little
 * shorter, so the driver chip's ledge shows), a grey-black active area nearer the far edge,
 * and, with `flex`, the amber ribbon that leaves the glass and folds round the board's edge
 * to its back, where it's soldered. Bend that ribbon too sharply and the screen dies.
 */
function Display({ w, d, flex, screen }: { w: number; d: number; flex?: number; screen?: THREE.Texture }) {
  const glass = { color: '#101418', roughness: 0.05, metalness: 0.4 } as const;
  return (
    <group>
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[w, 0.5, d]} /><meshStandardMaterial color="#e8e2c8" roughness={0.6} /></mesh>
      <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[w, 0.7, d]} /><meshStandardMaterial {...glass} /></mesh>
      <mesh position={[0, 1.45, -1.2]} castShadow><boxGeometry args={[w, 0.5, d - 2.4]} /><meshStandardMaterial {...glass} transparent opacity={0.92} /></mesh>
      {/* the active pixels: 128 × 64 in a 21.7 × 10.9 mm window */}
      <mesh position={[0, 1.71, -2.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[21.7, 10.9]} />
        {/* with a picture (a 128 × 64 texture from the coding bench) the pixels glow by themselves */}
        {screen ? <meshBasicMaterial map={screen} toneMapped={false} /> : <meshStandardMaterial color="#1a1d22" roughness={0.2} metalness={0.2} />}
      </mesh>
      {/* the driver chip (SSD1306) bonded on the ledge */}
      <mesh position={[0, 1.3, d / 2 - 1.2]}><boxGeometry args={[12, 0.3, 0.9]} /><meshStandardMaterial color="#202226" roughness={0.4} /></mesh>
      {flex !== undefined && (
        <group position={[0, 0, d / 2]}>
          <mesh position={[0, 0.9, flex / 2]}><boxGeometry args={[12, 0.08, flex]} /><meshStandardMaterial color="#c97a1c" roughness={0.4} transparent opacity={0.9} /></mesh>
          <mesh position={[0, -0.25, flex]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[1.2, 1.2, 12, 20, 1, true, 0, Math.PI]} /><meshStandardMaterial color="#c97a1c" roughness={0.4} side={THREE.DoubleSide} /></mesh>
          {Array.from({ length: 13 }, (_, i) => <mesh key={i} position={[-5.4 + i * 0.9, 0.95, flex / 2]}><boxGeometry args={[0.3, 0.02, flex]} /><meshStandardMaterial color="#d9a54a" metalness={0.7} roughness={0.3} /></mesh>)}
        </group>
      )}
    </group>
  );
}

function Transducer() {
  return (
    <group>
      <mesh position={[0, 6, 0]} castShadow><cylinderGeometry args={[8, 8, 12, 36, 1, true]} /><meshStandardMaterial {...SHIELD} side={THREE.DoubleSide} /></mesh>
      {/* a rolled lip, and the fine woven mesh that protects the piezo disc behind it */}
      <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[7.6, 0.4, 8, 40]} /><meshStandardMaterial {...SHIELD} /></mesh>
      <mesh position={[0, 11.4, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[7.9, 36]} /><meshStandardMaterial map={meshTexture()} roughness={0.95} /></mesh>
    </group>
  );
}

/**
 * A DIP-28 chip pressed into a turned-pin socket, as on the Uno: the socket's black frame with
 * its open middle, the chip sitting on top, and the half-moon notch at +x. Pin 1 is next to the
 * notch on the −z side; the pins count along −z to the far end, then back along +z.
 */
function SocketedDip({ marking = ['ATMEGA328P-PU'] }: { marking?: string[] }) {
  const L = 35.6, W = 7.4;
  const xs = Array.from({ length: 14 }, (_, i) => 16.51 - i * 2.54);
  return (
    <group>
      {[-1, 1].map((k) => <mesh key={k} position={[0, 1.5, k * 3.81]} castShadow><boxGeometry args={[L + 1.6, 3, 2.4]} /><meshStandardMaterial color="#141414" roughness={0.7} /></mesh>)}
      {[-1, 1].map((k) => <mesh key={`e${k}`} position={[k * (L / 2 + 0.3), 1.5, 0]}><boxGeometry args={[1.6, 3, 7.6]} /><meshStandardMaterial color="#141414" roughness={0.7} /></mesh>)}
      {xs.flatMap((x) => [-1, 1].map((k) => <mesh key={`${x}${k}`} position={[x, 3.02, k * 3.81]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.35, 0.6, 12]} /><meshStandardMaterial color="#c9a54a" metalness={0.8} roughness={0.3} /></mesh>))}
      <mesh position={[0, 4.9, 0]} castShadow><boxGeometry args={[L, 3.4, W]} /><meshStandardMaterial color="#17181a" roughness={0.6} /></mesh>
      <mesh position={[L / 2 + 0.01, 6.61, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.1, 20, Math.PI / 2, Math.PI]} /><meshBasicMaterial color="#050505" /></mesh>
      <mesh position={[L / 2 - 2.2, 6.62, -2.2]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.5, 16]} /><meshBasicMaterial color="#2a2c2e" /></mesh>
      <mesh position={[-1, 6.62, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[24, 4.4]} /><meshBasicMaterial map={printTexture(marking, { size: 40, w: 640, h: 120, fg: '#c8c8c8' })} transparent /></mesh>
      {xs.flatMap((x) => [-1, 1].map((k) => <mesh key={`l${x}${k}`} position={[x, 3.6, k * 3.95]}><boxGeometry args={[0.5, 1.4, 0.3]} /><meshStandardMaterial {...SHIELD} /></mesh>))}
    </group>
  );
}

let meshTex: THREE.CanvasTexture | null = null;
function meshTexture() {
  if (meshTex) return meshTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#4a4a4e'; g.lineWidth = 1.2;
  for (let i = 0; i < 256; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  meshTex = new THREE.CanvasTexture(c);
  meshTex.colorSpace = THREE.SRGBColorSpace;
  return meshTex;
}

function DhtBody() {
  return (
    <group>
      <mesh position={[0, 3.9, 0]} castShadow><boxGeometry args={[12, 7.8, 15.5]} /><meshStandardMaterial color="#3a8bd8" roughness={0.5} /></mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-4.5 + (i % 4) * 3, 7.81, -5 + Math.floor(i / 4) * 4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.8, 2.6]} /><meshBasicMaterial color="#0d2a4a" /></mesh>
      ))}
    </group>
  );
}

function UsbA() {
  return (
    <group>
      <mesh position={[0, 2.25, 0]} castShadow><boxGeometry args={[14, 4.5, 12]} /><meshStandardMaterial {...SHIELD} /></mesh>
      {[-2.2, 2.2].map((z) => <mesh key={z} position={[1, 4.51, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.5, 2.5]} /><meshBasicMaterial color="#303030" /></mesh>)}
    </group>
  );
}

// ---------------------------------------------------------------- silkscreen helpers

const pinLabels = (g: CanvasRenderingContext2D, px: number, labels: string[], x0: number, z: number, pitch = 2.54, size = 1.3, rotate = false) => {
  g.save(); g.font = `bold ${size * px}px 'Space Mono', monospace`; g.textAlign = 'center';
  labels.forEach((l, i) => {
    const x = (x0 + i * pitch) * px, y = z * px;
    if (rotate) { g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.fillText(l, 0, 0); g.restore(); } else g.fillText(l, x, y);
  });
  g.restore();
};
const toCanvas = (w: number, d: number) => ({ x: (x: number) => x + w / 2, z: (z: number) => z + d / 2 });

// ---------------------------------------------------------------- the boards

const r0603 = (id: string, at: [number, number], ohms: number, code: string, rot = 0, name = 'Resistor 0603'): Placed =>
  ({ id, kind: 'chipR', at, rot, name, value: { amount: ohms, unit: 'Ω', tol: 0.05 }, props: { size: '0603', code } });
const c0603 = (id: string, at: [number, number], farads: number, rot = 0): Placed =>
  ({ id, kind: 'chipC', at, rot, name: 'Capacitor 0603', value: { amount: farads, unit: 'F', tol: 0.1 }, props: { size: '0603' } });

export const ARDUINO_UNO: BoardDef = {
  // Arduino Uno R3, laid out from Arduino's top-view drawing (≈10.6 px/mm): the ATmega328P in
  // a DIP-28 socket above the power and analog headers (notch towards the ICSP end, so pin 1 is
  // top right and A0–A5 sit by their header), the 16U2 QFN by the USB socket with its own 16 MHz
  // crystal, the regulator's tab towards the left edge, two SMD electrolytics by the barrel jack.
  id: 'arduino-uno', name: 'Arduino Uno R3', w: 68.6, d: 53.3, color: '#00879a',
  holes: [[-20.3, 24.2], [-19, -24], [31.8, 19.1], [31.8, -8.8]],
  silk: (g, px, w, d) => {
    const T = toCanvas(w, d);
    g.save(); g.font = `${4.2 * px}px 'Space Mono', monospace`; g.textAlign = 'center';
    g.lineWidth = 0.35 * px; g.strokeRect(T.x(9.5) * px, T.z(-15.4) * px, 12.6 * px, 5.6 * px);
    g.fillText('UNO', T.x(15.8) * px, T.z(-12.4) * px);
    // the infinity logo with − and +, and the name under it
    g.lineWidth = 0.9 * px;
    for (const cx of [-3.4, 2.4]) { g.beginPath(); g.arc(T.x(cx) * px, T.z(-13.2) * px, 2.6 * px, 0, Math.PI * 2); g.stroke(); }
    g.font = `bold ${2.2 * px}px 'Space Mono', monospace`; g.fillText('−', T.x(-3.4) * px, T.z(-12.6) * px); g.fillText('+', T.x(2.4) * px, T.z(-12.6) * px);
    g.font = `bold ${2 * px}px 'Space Mono', monospace`; g.fillText('Arduino', T.x(-0.5) * px, T.z(-8.2) * px);
    g.restore();
    g.font = `bold ${1.4 * px}px 'Space Mono', monospace`;
    g.fillText('DIGITAL (PWM~)', T.x(17.7) * px, T.z(-17.6) * px);
    g.fillText('POWER', T.x(10.2) * px, T.z(18.9) * px);
    g.fillText('ANALOG IN', T.x(25.8) * px, T.z(18.9) * px);
    g.fillText('ON', T.x(28.3) * px, T.z(-10) * px);
    g.fillText('L', T.x(-9.3) * px, T.z(-14.7) * px);
    g.fillText('TX', T.x(-9.6) * px, T.z(-10) * px); g.fillText('RX', T.x(-9.6) * px, T.z(-7.7) * px);
    g.fillText('ICSP', T.x(27) * px, T.z(-1.4) * px); g.fillText('ICSP2', T.x(-16.3) * px, T.z(-15.6) * px);
    g.fillText('RESET', T.x(-29) * px, T.z(-19.6) * px);
    pinLabels(g, px, ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'], T.x(-15.5), T.z(-21.2), 2.54, 1.1, true);
    pinLabels(g, px, ['7', '~6', '~5', '4', '~3', '2', 'TX1', 'RX0'], T.x(11.4), T.z(-21.2), 2.54, 1.1, true);
    pinLabels(g, px, ['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN'], T.x(-6.35), T.z(21.4), 2.54, 1.0, true);
    pinLabels(g, px, ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], T.x(16.5), T.z(21.4), 2.54, 1.1, true);
  },
  parts: [
    { id: 'J_USB', kind: 'usbB', at: [-28.5, -11.1], rot: 180, name: 'USB-B socket' },
    { id: 'J_PWR', kind: 'dcJack', at: [-29.5, 18.5], rot: 180, name: 'DC barrel jack (7–12 V)' },
    { id: 'U_MCU', kind: 'dip28', at: [12, 10.1], name: 'ATmega328P microcontroller (DIP-28, in a socket)', props: { marking: ['ATMEGA328P-PU', '1352'] } },
    { id: 'X_RES', kind: 'resonator', at: [6.5, 3.2], name: 'Ceramic resonator 16 MHz (the 328P’s clock)', value: { amount: 16e6, unit: 'Hz' } },
    { id: 'U_USB', kind: 'qfn', at: [-14.4, -8.3], name: 'ATmega16U2 (USB to serial)', props: { n: 32, size: 5, marking: ['MEGA16U2', '-MU'] } },
    { id: 'Y1', kind: 'crystal', at: [-14, 1], name: 'Crystal 16 MHz (the 16U2’s clock)', value: { amount: 16e6, unit: 'Hz' }, props: { mhz: '16.000' } },
    { id: 'U_REG', kind: 'sot223', at: [-25.7, 9.1], rot: 90, name: '5 V regulator', props: { marking: 'NCP1117', volts: '5.0' } },
    { id: 'C_IN', kind: 'elecSmd', at: [-17, 18.6], name: 'Electrolytic 47 µF (SMD can)', value: { amount: 47e-6, unit: 'F', tol: 0.2 }, props: { uF: 47, volts: 25 } },
    { id: 'C_OUT', kind: 'elecSmd', at: [-9.6, 18.6], name: 'Electrolytic 47 µF (SMD can)', value: { amount: 47e-6, unit: 'F', tol: 0.2 }, props: { uF: 47, volts: 25 } },
    { id: 'SW_RST', kind: 'button', at: [-29, -23.5], name: 'Reset button', props: { color: '#b3261e' } },
    { id: 'LED_ON', kind: 'chipLed', at: [25, -10], name: 'Power LED (ON)', props: { color: '#39d86a', lit: true } },
    r0603('R_ON', [25, -7.4], 1000, '102', 0, 'Resistor 0603 · power LED'),
    { id: 'LED_L', kind: 'chipLed', at: [-6.3, -14.7], name: 'Pin 13 LED (L)', props: { color: '#ffb000' } },
    r0603('R_L', [-3.4, -14.7], 1000, '102'),
    { id: 'LED_TX', kind: 'chipLed', at: [-6.3, -10], name: 'TX LED', props: { color: '#ffb000' } },
    { id: 'LED_RX', kind: 'chipLed', at: [-6.3, -7.7], name: 'RX LED', props: { color: '#ffb000' } },
    r0603('R_TX', [-3.4, -10], 1000, '102'), r0603('R_RX', [-3.4, -7.7], 1000, '102'),
    r0603('R_RST', [-23, -19.5], 10000, '103'),
    r0603('R_USB1', [-19.6, -12.6], 22, '220'), r0603('R_USB2', [-19.6, -10.4], 22, '220'),
    c0603('C1', [8, -5.5], 100e-9), c0603('C2', [11.5, 3], 100e-9, 90), c0603('C3', [-6, -0.4], 22e-12), c0603('C4', [-6, 2.4], 22e-12),
    c0603('C5', [-10, -8.3], 100e-9, 90), c0603('C6', [-20, 12], 100e-9, 90),
    { id: 'Q1', kind: 'sot23', at: [-22, 1], name: 'Power switch MOSFET', props: { marking: 'FDN' } },
    { id: 'H_DIG1', kind: 'headerF', at: [-15.5, -24.13], name: 'Digital pins 8–13', props: { n: 10 } },
    { id: 'H_DIG2', kind: 'headerF', at: [11.4, -24.13], name: 'Digital pins 0–7', props: { n: 8 } },
    { id: 'H_PWR', kind: 'headerF', at: [-6.35, 24.13], name: 'Power pins', props: { n: 8 } },
    { id: 'H_AN', kind: 'headerF', at: [16.5, 24.13], name: 'Analog in A0–A5', props: { n: 6 } },
    { id: 'H_ICSP', kind: 'header', at: [31.7, 1.1], rot: 90, name: 'ICSP header (programs the 328P)', props: { n: 3 } },
    { id: 'H_ICSP2', kind: 'header', at: [29.2, 1.1], rot: 90, name: 'ICSP header (programs the 328P)', props: { n: 3 } },
    { id: 'H_U2A', kind: 'header', at: [-18.8, -21], name: 'ICSP2 header (programs the 16U2)', props: { n: 3 } },
    { id: 'H_U2B', kind: 'header', at: [-18.8, -18.4], name: 'ICSP2 header (programs the 16U2)', props: { n: 3 } },
  ],
};

/**
 * Arduino Nano (a common clone), laid out from a photo of its top: the ATmega328P here IS a
 * TQFP-32, turned 45°, with a small 16 MHz crystal beside it, the reset button in the middle,
 * RX / TX / POW / L LEDs with their 1 kΩ resistors, and a mini-USB socket at one end. The
 * USB-serial chip (CH340) and the regulator are on the underside. Pins: two rows of 15,
 * 0.6" apart, to straddle a breadboard's centre channel.
 */
export const ARDUINO_NANO: BoardDef = {
  id: 'arduino-nano', name: 'Arduino Nano', w: 43.2, d: 18, color: '#1d3f9c',
  holes: [[-20, -7.4], [-20, 7.4], [20, -7.4], [20, 7.4]],
  silk: (g, px, w, d) => {
    const T = toCanvas(w, d);
    pinLabels(g, px, ['TX1', 'RX0', 'RST', 'GND', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'], T.x(-17.78), T.z(-5.2), 2.54, 0.9, true);
    pinLabels(g, px, ['VIN', 'GND', 'RST', '5V', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'REF', '3V3', 'D13'], T.x(-17.78), T.z(5.6), 2.54, 0.9, true);
    g.save(); g.font = `bold ${1.8 * px}px 'Space Mono', monospace`; g.translate(T.x(-0.6) * px, T.z(0.3) * px); g.rotate(Math.PI / 2); g.fillText('NANO', 0, 0); g.restore();
    g.font = `bold ${0.9 * px}px 'Space Mono', monospace`;
    [['RX', -3.2], ['TX', -1.1], ['POW', 1.1], ['L', 3.4]].forEach(([l, z]) => g.fillText(l as string, T.x(-14) * px, T.z(z as number) * px));
  },
  parts: [
    { id: 'U_MCU', kind: 'qfp', at: [6.3, 0.3], rot: 45, name: 'ATmega328P microcontroller (TQFP-32)', props: { n: 32, size: 7, marking: ['MEGA328P', 'AU 1716'] } },
    { id: 'Y1', kind: 'xtal3225', at: [0.5, -4.1], rot: 45, name: 'Crystal 16 MHz', value: { amount: 16e6, unit: 'Hz' }, props: { mhz: '16.000' } },
    { id: 'SW_RST', kind: 'button', at: [-4.1, 0.3], name: 'Reset button', props: { w: 4 } },
    { id: 'LED_RX', kind: 'chipLed', at: [-11.7, -3.2], name: 'RX LED', props: { color: '#ff3b30' } },
    { id: 'LED_TX', kind: 'chipLed', at: [-11.7, -1.1], name: 'TX LED', props: { color: '#39d86a' } },
    { id: 'LED_PWR', kind: 'chipLed', at: [-11.7, 1.1], name: 'Power LED (POW)', props: { color: '#39d86a', lit: true } },
    { id: 'LED_L', kind: 'chipLed', at: [-11.7, 3.4], name: 'Pin 13 LED (L)', props: { color: '#ff3b30' } },
    r0603('R1', [-8.5, -3.2], 1000, '102'), r0603('R2', [-8.5, -1.1], 1000, '102'), r0603('R3', [-8.5, 1.1], 1000, '102'), r0603('R4', [-8.5, 3.4], 1000, '102'),
    c0603('C1', [11.6, -3.6], 100e-9, 90), c0603('C2', [1.2, 4.4], 100e-9, 45),
    { id: 'J_USB', kind: 'microUsb', at: [20.4, 0], rot: 90, name: 'Mini-USB socket', props: { mini: true } },
    { id: 'H_ICSP', kind: 'header', at: [-19.6, 2.54], rot: 90, name: 'ICSP header', props: { n: 3 } },
    { id: 'H_L', kind: 'header', at: [-17.78, -7.62], name: 'Pins D0–D12', props: { n: 15 } },
    { id: 'H_R', kind: 'header', at: [-17.78, 7.62], name: 'Pins VIN, 5V, A0–A7, D13', props: { n: 15 } },
  ],
};

export const ESP32_DEVKIT: BoardDef = {
  id: 'esp32-devkit', name: 'ESP32 DevKit', w: 55, d: 28, color: '#141414',
  holes: [[-25, -11.5], [-25, 11.5], [25, -11.5], [25, 11.5]],
  silk: (g, px, w, d) => {
    const T = toCanvas(w, d);
    pinLabels(g, px, ['3V3', 'EN', 'VP', 'VN', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13'], T.x(-17.8), T.z(-9.8), 2.54, 1.0, true);
    pinLabels(g, px, ['GND', '23', '22', 'TX', 'RX', '21', 'GND', '19', '18', '5', '17', '16', '4', '0', '2'], T.x(-17.8), T.z(9.8), 2.54, 1.0, true);
    g.fillText('EN', T.x(21) * px, T.z(-6) * px); g.fillText('BOOT', T.x(21) * px, T.z(6.5) * px);
  },
  parts: [
    { id: 'U_WROOM', kind: 'wroom', at: [-5, 0], rot: 90, name: 'ESP32-WROOM-32 module (Wi-Fi + Bluetooth)' },
    { id: 'J_USB', kind: 'microUsb', at: [25.5, 0], rot: 90, name: 'Micro-USB socket' },
    { id: 'U_UART', kind: 'qfn', at: [17, 0], name: 'CP2102 USB to serial (QFN-28)', props: { n: 28, size: 5, marking: ['CP2102', 'SILABS'] } },
    { id: 'U_REG', kind: 'sot223', at: [11, 8], name: '3.3 V regulator', props: { marking: 'AMS1117', volts: '3.3' } },
    { id: 'Q1', kind: 'sot23', at: [15.4, -5], name: 'S8050 transistor (auto-reset: pulls EN)', props: { marking: 'J3Y' } },
    { id: 'Q2', kind: 'sot23', at: [15.4, 5], rot: 180, name: 'S8050 transistor (auto-reset: pulls IO0)', props: { marking: 'J3Y' } },
    { id: 'LED_IO2', kind: 'chipLed', at: [11, -1.5], name: 'GPIO2 LED (blue)', props: { color: '#3a8bff' } },
    { id: 'SW_EN', kind: 'button', at: [21, -8.5], name: 'EN (reset) button', props: { w: 4 } },
    { id: 'SW_BOOT', kind: 'button', at: [21, 9], name: 'BOOT button', props: { w: 4 } },
    { id: 'LED_PWR', kind: 'chipLed', at: [11, -4], name: 'Power LED', props: { color: '#ff3b30', lit: true } },
    r0603('R_PWR', [11, -6.5], 2200, '222'),
    c0603('C1', [8, 3], 10e-6), c0603('C2', [8, -1], 100e-9),
    { id: 'H_L', kind: 'header', at: [-17.8, -12.7], name: 'Pin header (left)', props: { n: 15 } },
    { id: 'H_R', kind: 'header', at: [-17.8, 12.7], name: 'Pin header (right)', props: { n: 15 } },
  ],
};

export const ESP01: BoardDef = {
  id: 'esp-01', name: 'ESP-01 (ESP8266)', w: 24.8, d: 14.3, color: '#141414',
  silk: (g, px, w, d) => { const T = toCanvas(w, d); g.font = `bold ${1.2 * px}px 'Space Mono', monospace`; g.fillText('ESP-01', T.x(-2) * px, T.z(5.8) * px); },
  // The Wi-Fi antenna is a zig-zag of copper at the far end of the board, no part at all.
  copper: (g, px, w, d) => {
    const T = toCanvas(w, d);
    g.lineWidth = 0.5 * px; g.beginPath();
    let x = -11.5;
    g.moveTo(T.x(x) * px, T.z(5.5) * px);
    for (let i = 0; i < 5; i++) { g.lineTo(T.x(x) * px, T.z(-5.5) * px); g.lineTo(T.x(x + 0.9) * px, T.z(-5.5) * px); g.lineTo(T.x(x + 0.9) * px, T.z(5) * px); g.lineTo(T.x(x + 1.8) * px, T.z(5) * px); x += 1.8; }
    g.stroke();
  },
  parts: [
    { id: 'U_ESP', kind: 'qfn', at: [0, -1.5], name: 'ESP8266EX (Wi-Fi SoC, QFN)', props: { n: 32, size: 5, marking: ['ESP8266EX'] } },
    { id: 'U_FLASH', kind: 'soic8', at: [0, 4.5], name: 'SPI flash (1 MB)', props: { marking: '25Q80' } },
    { id: 'Y1', kind: 'xtal3225', at: [-4.5, -4], name: 'Crystal 26 MHz', value: { amount: 26e6, unit: 'Hz' }, props: { mhz: '26.0' } },
    { id: 'LED_PWR', kind: 'chipLed', at: [-3.5, 3.5], name: 'Power LED', props: { color: '#ff3b30', lit: true } },
    { id: 'LED_TX', kind: 'chipLed', at: [-3.5, 5.3], name: 'TX LED', props: { color: '#3a8bff' } },
    { id: 'H1', kind: 'header', at: [8.5, -3.8], rot: -90, name: 'Pins GND, IO2, IO0, RX', props: { n: 4 } },
    { id: 'H2', kind: 'header', at: [11, -3.8], rot: -90, name: 'Pins TX, EN, RST, 3V3', props: { n: 4 } },
  ],
};

export const BLUE_PILL: BoardDef = {
  id: 'blue-pill', name: 'STM32 Blue Pill', w: 53, d: 22.5, color: '#1d4fb3',
  silk: (g, px, w, d) => {
    const T = toCanvas(w, d);
    pinLabels(g, px, ['B12', 'B13', 'B14', 'B15', 'A8', 'A9', 'A10', 'A11', 'A12', 'A15', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', '5V', 'G', '3.3'], T.x(-24.1), T.z(-8.3), 2.54, 0.9, true);
    pinLabels(g, px, ['G', 'G', '3.3', 'R', 'C13', 'C14', 'C15', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B0', 'B1', 'B10', 'B11', 'VB'], T.x(-24.1), T.z(8.3), 2.54, 0.9, true);
    g.fillText('BOOT0 BOOT1', T.x(-14) * px, T.z(-1) * px);
  },
  parts: [
    { id: 'U_MCU', kind: 'qfp', at: [3, 0], rot: 45, name: 'STM32F103C8T6 (ARM Cortex-M3)', props: { n: 48, size: 7, marking: ['STM32', 'F103C8T6'] } },
    { id: 'J_USB', kind: 'microUsb', at: [25, 0], rot: 90, name: 'Micro-USB socket' },
    { id: 'Y1', kind: 'crystal', at: [12.5, 0], rot: 90, name: 'Crystal 8 MHz', value: { amount: 8e6, unit: 'Hz' }, props: { mhz: '8.000' } },
    { id: 'U_REG', kind: 'sot223', at: [17.5, -5.5], name: '3.3 V regulator', props: { marking: 'RT9193' } },
    { id: 'SW_RST', kind: 'button', at: [-8, 4.5], name: 'Reset button', props: { w: 4 } },
    { id: 'H_BOOT', kind: 'header', at: [-17.5, 3], rot: 90, name: 'BOOT jumpers', props: { n: 3 } },
    { id: 'J_BOOT0', kind: 'jumper', at: [-17.5, 3], rot: 90, name: 'BOOT0 jumper (on 0: run your program)', props: { color: '#e8c228' } },
    { id: 'LED_PWR', kind: 'chipLed', at: [17, 4], name: 'Power LED', props: { color: '#ff3b30', lit: true } },
    { id: 'LED_C13', kind: 'chipLed', at: [19.5, 4], name: 'PC13 LED', props: { color: '#39d86a' } },
    r0603('R_PWR', [17, 6.3], 1000, '102', 90),
    r0603('R_USB', [21.5, -6], 4700, '472', 90),
    c0603('C1', [8.5, -5.5], 100e-9), c0603('C2', [8.5, 5.5], 100e-9),
    { id: 'H_T', kind: 'header', at: [-24.1, -10], name: 'Pin header', props: { n: 20 } },
    { id: 'H_B', kind: 'header', at: [-24.1, 10], name: 'Pin header', props: { n: 20 } },
  ],
};

export const RC522: BoardDef = {
  id: 'rc522', name: 'RFID reader RC522', w: 60, d: 39.5, color: '#1d4fb3',
  holes: [[-26, -16], [-26, 16], [18, -16], [18, 16]],
  // The antenna is the coil of copper round most of the board: the card is read through it.
  copper: (g, px, w, d) => {
    const T = toCanvas(w, d);
    g.lineWidth = 0.8 * px;
    for (let i = 0; i < 4; i++) { const m = 3 + i * 1.6; g.beginPath(); g.roundRect((T.x(-28) + m) * px, (T.z(-17) + m) * px, (40 - 2 * m) * px, (34 - 2 * m) * px, 2 * px); g.stroke(); }
  },
  silk: (g, px, w, d) => {
    const T = toCanvas(w, d);
    g.font = `bold ${2 * px}px 'Space Mono', monospace`;
    g.save(); g.translate(T.x(-22) * px, T.z(0) * px); g.rotate(-Math.PI / 2); g.fillText('RFID-RC522', -10 * px, 0); g.restore();
    pinLabels(g, px, ['SDA', 'SCK', 'MOSI', 'MISO', 'IRQ', 'GND', 'RST', '3.3V'], T.x(27), T.z(-8.9), 2.54, 1.0, false);
  },
  parts: [
    { id: 'U_RC522', kind: 'qfp', at: [14, 0], name: 'MFRC522 reader chip', props: { n: 32, size: 5, marking: ['MFRC522'] } },
    { id: 'Y1', kind: 'crystal', at: [14, 11], name: 'Crystal 27.12 MHz', value: { amount: 27.12e6, unit: 'Hz' }, props: { mhz: '27.12' } },
    r0603('R1', [9, -8], 1000, '102', 90), r0603('R2', [11, -8], 1000, '102', 90), c0603('C1', [18, -8], 100e-9, 90), c0603('C2', [20, -8], 100e-9, 90),
    { id: 'H1', kind: 'header', at: [27.5, -8.9], rot: -90, name: 'Pins SDA … 3.3V', props: { n: 8 } },
  ],
};

export const OLED_096: BoardDef = {
  id: 'oled-096', name: '0.96" OLED (I²C)', w: 27, d: 27, color: '#1d4fb3',
  holes: [[-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5]],
  silk: (g, px, w, d) => { const T = toCanvas(w, d); pinLabels(g, px, ['GND', 'VCC', 'SCL', 'SDA'], T.x(-3.8), T.z(-9.5), 2.54, 1.0, false); },
  parts: [
    { id: 'DISP', kind: 'display', at: [0, 2.5], name: 'OLED panel 128 × 64 (SSD1306 driver)', props: { w: 26.5, d: 19, flex: 1.5 } },
    { id: 'H1', kind: 'header', at: [-3.8, -12], name: 'Pins GND, VCC, SCL, SDA', props: { n: 4 } },
  ],
};

export const DHT11: BoardDef = {
  id: 'dht11', name: 'DHT11 temperature & humidity', w: 28, d: 14, color: '#1d4fb3',
  // The pins stick out of the short edge: + (VCC), OUT (data), − (GND), each labelled beside it.
  silk: (g, px, w, d) => {
    const T = toCanvas(w, d);
    g.font = `bold ${1.5 * px}px 'Space Mono', monospace`; g.textAlign = 'right'; g.textBaseline = 'middle';
    [['+', -2.54], ['OUT', 0], ['−', 2.54]].forEach(([l, z]) => g.fillText(l as string, T.x(9.6) * px, T.z(z as number) * px));
  },
  parts: [
    { id: 'SENSOR', kind: 'dhtBody', at: [-4, 0], rot: 90, name: 'DHT11 sensor' },
    r0603('R_PULL', [3.5, 5], 10000, '103', 0, 'Pull-up resistor 0603 · DATA to +'),
    { id: 'H1', kind: 'header', at: [11.5, -2.54], rot: -90, name: 'Pins +, OUT, −', props: { n: 3 } },
  ],
};

export const HCSR04: BoardDef = {
  id: 'hc-sr04', name: 'HC-SR04 ultrasonic', w: 45, d: 20, color: '#1d4fb3',
  holes: [[-20.5, -8], [20.5, -8], [-20.5, 8], [20.5, 8]],
  silk: (g, px, w, d) => { const T = toCanvas(w, d); g.font = `bold ${1.2 * px}px 'Space Mono', monospace`; pinLabels(g, px, ['Vcc', 'Trig', 'Echo', 'Gnd'], T.x(-3.8), T.z(8.3), 2.54, 1.0, false); g.fillText('T', T.x(-13) * px, T.z(-8.5) * px); g.fillText('R', T.x(13) * px, T.z(-8.5) * px); },
  parts: [
    { id: 'TX', kind: 'transducer', at: [-13, 0], name: 'Ultrasonic transmitter' },
    { id: 'RX', kind: 'transducer', at: [13, 0], name: 'Ultrasonic receiver' },
    { id: 'Y1', kind: 'crystal', at: [0, -6], name: 'Crystal 4 MHz', value: { amount: 4e6, unit: 'Hz' }, props: { mhz: '4.000' } },
    { id: 'H1', kind: 'header', at: [-3.8, 9], name: 'Pins Vcc, Trig, Echo, Gnd', props: { n: 4 } },
  ],
};

export const USB_STICK: BoardDef = {
  id: 'usb-stick', name: 'USB stick (opened)', w: 44, d: 15, color: '#2e7d3a',
  silk: (g, px, w, d) => { const T = toCanvas(w, d); g.font = `bold ${1 * px}px 'Space Mono', monospace`; g.fillText('SD-C08G', T.x(-4) * px, T.z(6.9) * px); },
  parts: [
    { id: 'J_USB', kind: 'usbA', at: [-19, 0], name: 'USB-A plug' },
    { id: 'U_CTRL', kind: 'qfp', at: [-4, 0], name: 'USB flash controller', props: { n: 48, size: 7, marking: ['PS2251', '-09'] } },
    { id: 'U_FLASH', kind: 'tsop48', at: [11.8, 0], name: 'NAND flash 8 GB (TSOP-48)', props: { marking: ['29F64G08', 'NAND'] } },
    { id: 'Y1', kind: 'xtal3225', at: [-11.2, 4.6], name: 'Crystal 12 MHz', value: { amount: 12e6, unit: 'Hz' }, props: { mhz: '12.000' } },
    c0603('C1', [-11.2, 1], 1e-6, 90), c0603('C2', [-11.2, -1.8], 100e-9, 90),
    { id: 'LED1', kind: 'chipLed', at: [-11.2, -5], name: 'Activity LED', props: { color: '#3a8bff' } },
  ],
};

export const BOARDS: BoardDef[] = [ARDUINO_UNO, ARDUINO_NANO, ESP32_DEVKIT, ESP01, BLUE_PILL, RC522, OLED_096, DHT11, HCSR04, USB_STICK];

/** A placed part's tooltip, like the reference: "Resistor 0603 · 1 kΩ ±5 % · 0.95–1.05 kΩ". */
export function tooltip(p: Placed, fmt: (x: number, unit: string) => string): string {
  const name = p.name ?? p.id;
  if (!p.value) return name;
  const { amount, unit, tol } = p.value;
  if (!tol) return `${name} · ${fmt(amount, unit)}`;
  return `${name} · ${fmt(amount, unit)} ±${Math.round(tol * 100)} % · ${fmt(amount * (1 - tol), unit)}–${fmt(amount * (1 + tol), unit)}`;
}
