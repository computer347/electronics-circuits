/**
 * Rendering settings by device. Phones and tablets (a coarse pointer) get a lower pixel ratio
 * and smaller shadow maps: on a 3× phone screen, full resolution costs nine times the pixels
 * for detail nobody can see, and drains the battery.
 */
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** The canvas pixel ratio range: [min, max]. */
export const DPR: [number, number] = coarse ? [1, 1.5] : [1, 2];
/** Shadow map size for the key light. */
export const SHADOW_MAP: [number, number] = coarse ? [1024, 1024] : [2048, 2048];
