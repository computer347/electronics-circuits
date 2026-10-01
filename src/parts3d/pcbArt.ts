/**
 * Draws a board's layout (pcbgen.ts) the way a real PCB looks from above, into a texture laid
 * on the board's top: the solder mask over bare fibreglass, lighter where copper lies under it
 * (the ground pour and the traces), clearance gaps round every trace and pad, vias, the exposed
 * pads (tinned or gold), and the white silkscreen: part outlines, pin-1 marks and reference
 * names, plus whatever the board prints itself (`BoardDef.silk`). A matching bump map lifts
 * the copper a touch.
 */
import * as THREE from 'three';
import type { BoardDef } from './boards';
import { footprint, layoutBoard, partBox, type PcbLayout } from './pcbgen';

const PX = 16; // pixels per millimetre

/** The mask colour over copper, and darker over bare board (FR4 shows through). */
function maskShades(color: string) {
  const over = new THREE.Color(color);
  const bare = over.clone().multiplyScalar(0.72);
  const pour = over.clone().lerp(new THREE.Color('#ffffff'), 0.06);
  return { over: `#${over.getHexString()}`, bare: `#${bare.getHexString()}`, pour: `#${pour.getHexString()}`, trace: `#${over.clone().lerp(new THREE.Color('#ffffff'), 0.14).getHexString()}` };
}

const cache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture; layout: PcbLayout }>();

export function pcbArt(def: BoardDef, finish: 'hasl' | 'enig' = 'hasl') {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const layout = layoutBoard(def);
  const W = Math.round(def.w * PX), H = Math.round(def.d * PX);
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')!] as const; };
  const [c, g] = make();
  const [bc, b] = make();
  const X = (x: number) => (x + def.w / 2) * PX, Z = (z: number) => (z + def.d / 2) * PX;
  const shade = maskShades(def.color);
  const r = Math.min(2.5, def.w / 10, def.d / 10) * PX;
  const outline = (ctx: CanvasRenderingContext2D) => { ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); };

  // 1. bare board under mask, clipped to the outline
  g.save(); outline(g); g.clip();
  g.fillStyle = shade.bare; g.fillRect(0, 0, W, H);
  b.fillStyle = '#000'; b.fillRect(0, 0, W, H);
  // 2. the ground pour: copper over most of the board, inset from the edge
  const inset = 0.8 * PX;
  g.fillStyle = shade.pour; g.beginPath(); g.roundRect(inset, inset, W - 2 * inset, H - 2 * inset, r); g.fill();
  b.fillStyle = '#555'; b.beginPath(); b.roundRect(inset, inset, W - 2 * inset, H - 2 * inset, r); b.fill();
  const top = layout.traces.filter((t) => t.layer === 'top');
  const nonGnd = (net: string) => net !== layout.gnd;
  // 3. clearances: the pour is cut back round every other net's traces and pads
  const clear = 0.35;
  g.strokeStyle = shade.bare; g.lineCap = 'round'; g.lineJoin = 'round';
  b.strokeStyle = '#000'; b.lineCap = 'round'; b.lineJoin = 'round';
  for (const t of top) if (nonGnd(t.net)) {
    for (const [ctx] of [[g], [b]] as const) {
      ctx.lineWidth = (t.width + 2 * clear) * PX;
      ctx.beginPath(); t.pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.stroke();
    }
  }
  const padNet = new Map<string, string>();
  for (const [net, ids] of Object.entries(layout.nets)) for (const id of ids) padNet.set(id, net);
  g.fillStyle = shade.bare; b.fillStyle = '#000';
  for (const p of layout.pads) if (padNet.get(p.id) !== layout.gnd) {
    for (const ctx of [g, b]) { ctx.beginPath(); ctx.roundRect(X(p.x - p.w / 2 - clear), Z(p.z - p.d / 2 - clear), (p.w + 2 * clear) * PX, (p.d + 2 * clear) * PX, p.round ? 999 : 0.2 * PX); ctx.fill(); }
  }
  // 4. traces (copper under mask shows lighter), and the ground's spokes to the pour
  g.strokeStyle = shade.trace; b.strokeStyle = '#999';
  for (const t of top) {
    for (const [ctx] of [[g], [b]] as const) {
      ctx.lineWidth = t.width * PX;
      ctx.beginPath(); t.pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.stroke();
    }
  }
  // vias: a copper ring (tented under mask) with its drill
  for (const v of layout.vias) {
    g.fillStyle = shade.trace; g.beginPath(); g.arc(X(v.x), Z(v.z), 0.45 * PX, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(X(v.x), Z(v.z), 0.17 * PX, 0, Math.PI * 2); g.fill();
    b.fillStyle = '#999'; b.beginPath(); b.arc(X(v.x), Z(v.z), 0.45 * PX, 0, Math.PI * 2); b.fill();
  }
  // 5. exposed pads, tinned or gold, with their drills
  const metal = finish === 'enig' ? '#d8b45a' : '#c9ccd2';
  for (const p of layout.pads) {
    g.fillStyle = metal; b.fillStyle = '#fff';
    for (const ctx of [g, b]) { ctx.beginPath(); ctx.roundRect(X(p.x - p.w / 2), Z(p.z - p.d / 2), p.w * PX, p.d * PX, p.round ? 999 : 0.12 * PX); ctx.fill(); }
    if (p.drill) { g.fillStyle = '#16120e'; g.beginPath(); g.arc(X(p.x), Z(p.z), (p.drill / 2) * PX, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();

  // 6. silkscreen: outlines with a pin-1 dot for chips, and reference names
  const designators = refDesignators(def);
  g.strokeStyle = '#f2f2ee'; g.fillStyle = '#f2f2ee'; g.lineWidth = 0.18 * PX;
  g.font = `bold ${1.15 * PX}px 'Space Mono', monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of def.parts) {
    if (p.kind === 'header' || p.kind === 'headerF' || p.kind === 'display' || p.kind === 'wroom') continue;
    if (!footprint(p).length) continue;
    const box = partBox(p);
    const pad = 0.5;
    if (p.kind !== 'chipR' && p.kind !== 'chipC' && p.kind !== 'chipLed') {
      g.strokeRect(X(box.x0 - pad), Z(box.z0 - pad), (box.x1 - box.x0 + 2 * pad) * PX, (box.z1 - box.z0 + 2 * pad) * PX);
    }
    if (p.kind === 'qfp' || p.kind === 'soic8') { g.beginPath(); g.arc(X(box.x0 - pad - 0.6), Z(box.z1 + pad + 0.6), 0.35 * PX, 0, Math.PI * 2); g.fill(); }
    // The reference name, beside the part where it fits on the board.
    const below = box.z1 + 1.2 < def.d / 2 - 1;
    g.fillText(designators.get(p.id) ?? p.id, X((box.x0 + box.x1) / 2), Z(below ? box.z1 + 1.1 : box.z0 - 1.1));
  }
  // the board's own printing (logos, pin names) on top
  if (def.silk) {
    g.save(); g.scale(PX / 12, PX / 12);
    g.fillStyle = '#f2f2ee'; g.strokeStyle = '#f2f2ee'; g.lineWidth = 0.25 * 12; g.textAlign = 'left';
    g.font = `bold ${2 * 12}px 'Space Mono', monospace`; g.textBaseline = 'middle';
    def.silk(g, 12, def.w, def.d);
    g.restore();
  }
  // mounting holes: plated rings are drawn by the 3D model; clear the art there
  g.globalCompositeOperation = 'destination-out';
  for (const [hx, hz] of def.holes ?? []) { g.beginPath(); g.arc(X(hx), Z(hz), 1.6 * PX, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'source-over';

  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(bc);
  const out = { map, bump, layout };
  cache.set(def.id, out);
  return out;
}

/** The letter a board prints before each part's number, by kind (IEEE 315 style). */
const PREFIX: Partial<Record<string, string>> = {
  chipR: 'R', chipC: 'C', elec: 'C', chipLed: 'D', sot23: 'Q', sot223: 'U', soic8: 'U', qfp: 'U', wroom: 'U', crystal: 'Y',
  usbB: 'J', microUsb: 'J', usbA: 'J', dcJack: 'J', header: 'J', headerF: 'J', button: 'SW', transducer: 'X', dhtBody: 'U',
};

/**
 * Reference designators as a real board prints them (R1, C3, U2, J1…). Ids already in that
 * form (R1, D3) are kept; descriptive ids (R_ON, U_MCU) get the next free number.
 */
export function refDesignators(def: BoardDef): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const p of def.parts) if (/^[A-Z]{1,2}\d+$/.test(p.id)) { out.set(p.id, p.id); used.add(p.id); }
  const next: Record<string, number> = {};
  for (const p of def.parts) {
    if (out.has(p.id)) continue;
    const pre = PREFIX[p.kind] ?? 'X';
    let n = next[pre] ?? 0;
    do { n++; } while (used.has(`${pre}${n}`));
    next[pre] = n; used.add(`${pre}${n}`); out.set(p.id, `${pre}${n}`);
  }
  return out;
}
