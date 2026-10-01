/**
 * How each part looks on the Parts Lab mat: the model with this level's values on it (the
 * resistor's real bands, a worn-off print, legs cut short), turned so its face is towards you,
 * and where its legs are so "leg 1, leg 2, leg 3, left to right" is true of what you see.
 * tests/lab.test.ts checks these against the levels' answers.
 */
import type { ReactNode } from 'react';
import { ChipLed, ChipResistor, Crystal, SOT223 } from '../parts3d/smd';
import { CeramicCap, DiodeTHT, Electrolytic, LedTHT, Potentiometer, ResistorTHT, SlideSwitch, TactileButton, TO220, TO92 } from '../parts3d/tht';

export interface Look {
  render: () => ReactNode;
  /** Turn about y, radians (π: the model's back was towards you). */
  rotY?: number;
  /** Lift so legs that go below the model's base stand on the mat, mm. */
  lift?: number;
  /** Leg positions along the model's x axis, in the level's leg order. */
  legsX?: number[];
  /** Model x of the leg its markings point to (cathode band, LED flat, − stripe). */
  markX?: number;
}

export const LOOKS: Record<string, Look> = {
  resistor: { render: () => <ResistorTHT ohms={4700} /> },
  'ceramic-cap': { render: () => <CeramicCap code="104" /> },
  electrolytic: { render: () => <Electrolytic uF={470} volts={16} loose />, rotY: -0.6, lift: 14, legsX: [-1, 1], markX: 1 },
  led: { render: () => <LedTHT color="red" trimmed />, lift: 2, legsX: [-1.27, 1.27], markX: 1.27 },
  'diode-1n4148': { render: () => <DiodeTHT kind="1N4148" band={false} />, legsX: [-3.81, 3.81], markX: 3.81 },
  'diode-1n4007': { render: () => <DiodeTHT kind="1N4007" band={false} />, legsX: [-5.08, 5.08], markX: 5.08 },
  'npn-bc547': { render: () => <TO92 marking="" />, rotY: Math.PI, lift: 2, legsX: [1.27, 0, -1.27] },
  'mosfet-irlz44n': { render: () => <TO220 marking="IRLZ44N" />, rotY: Math.PI, lift: 3 },
  'reg-7805': { render: () => <TO220 marking="LM7805" />, rotY: Math.PI, lift: 3 },
  'ldo-ams1117': { render: () => <SOT223 marking="AMS1117" /> },
  'chip-r-0402': { render: () => <ChipResistor size="0402" /> },
  'chip-r-0603': { render: () => <ChipResistor size="0603" code="472" /> },
  'chip-r-0805': { render: () => <ChipResistor size="0805" code="1002" /> },
  'chip-led-0603': { render: () => <ChipLed size="0603" />, legsX: [-0.67, 0.67] },
  crystal: { render: () => <Crystal mhz="16.000" /> },
  'tactile-button': { render: () => <TactileButton />, lift: 3 },
  'slide-switch': { render: () => <SlideSwitch />, lift: 3 },
  potentiometer: { render: () => <Potentiometer />, lift: 3 },
};

/** Where a leg appears from the camera: x after the turn (the camera looks along −z). */
export const seenX = (look: Look, x: number) => x * Math.cos(look.rotY ?? 0);
