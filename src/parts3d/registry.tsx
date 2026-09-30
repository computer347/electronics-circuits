/**
 * Model registry: a catalogue part's `model` key → its 3D model, and the size of its
 * footprint (for framing it in the gallery, a close-up or a tray slot).
 */
import type { ReactNode } from 'react';
import { BOARDS, Board } from './boards';
import { HeaderRow } from './common';
import { ChipCap, ChipLed, ChipResistor, Crystal, DcJack, MicroUsb, QFP, SOIC8, SOT223, SOT23, UsbB } from './smd';
import {
  Battery9V, Buzzer, CellAA, CeramicCap, DiodeTHT, Electrolytic, LedTHT, Potentiometer, ResistorTHT, SlideSwitch, TactileButton, TO220, TO92,
} from './tht';

/** Model and its rough size in millimetres (width, depth, height). */
export interface ModelEntry { render: () => ReactNode; size: [number, number, number] }

export const MODELS: Record<string, ModelEntry> = {
  resistor: { render: () => <ResistorTHT ohms={330} />, size: [12, 3, 4] },
  'ceramic-cap': { render: () => <CeramicCap />, size: [6, 2, 9] },
  electrolytic: { render: () => <Electrolytic />, size: [6, 6, 13] },
  led: { render: () => <LedTHT color="red" lit />, size: [6, 6, 11] },
  'diode-1n4148': { render: () => <DiodeTHT kind="1N4148" />, size: [9, 2, 3] },
  'diode-1n4007': { render: () => <DiodeTHT kind="1N4007" />, size: [12, 3, 4] },
  potentiometer: { render: () => <Potentiometer />, size: [10, 10, 16] },
  'tactile-button': { render: () => <TactileButton />, size: [7, 7, 6] },
  'slide-switch': { render: () => <SlideSwitch />, size: [9, 4, 8] },
  'cell-aa': { render: () => <CellAA />, size: [51, 15, 15] },
  'battery-9v': { render: () => <Battery9V />, size: [27, 49, 21] },
  buzzer: { render: () => <Buzzer />, size: [12, 12, 10] },
  'npn-bc547': { render: () => <TO92 marking="BC547" />, size: [5, 4, 8] },
  'mosfet-irlz44n': { render: () => <TO220 marking="IRLZ44N" />, size: [10, 5, 26] },
  'reg-7805': { render: () => <TO220 marking="LM7805" />, size: [10, 5, 26] },
  'ldo-ams1117': { render: () => <SOT223 marking="AMS1117" />, size: [7, 7, 2] },
  'chip-r-0402': { render: () => <ChipResistor size="0402" />, size: [1, 0.5, 0.4] },
  'chip-r-0603': { render: () => <ChipResistor size="0603" code="102" />, size: [1.6, 0.8, 0.5] },
  'chip-r-0805': { render: () => <ChipResistor size="0805" code="472" />, size: [2, 1.25, 0.5] },
  'chip-c-0603': { render: () => <ChipCap size="0603" />, size: [1.6, 0.8, 0.5] },
  'chip-led-0603': { render: () => <ChipLed size="0603" lit />, size: [1.6, 0.8, 0.5] },
  sot23: { render: () => <SOT23 />, size: [3, 2.5, 1.1] },
  soic8: { render: () => <SOIC8 />, size: [5, 6, 1.6] },
  qfp32: { render: () => <QFP n={32} size={7} />, size: [9, 9, 1.6] },
  qfp48: { render: () => <QFP n={48} size={7} marking={['STM32', 'F103C8T6']} />, size: [9, 9, 1.6] },
  crystal: { render: () => <Crystal />, size: [11, 5, 4] },
  'usb-b': { render: () => <UsbB />, size: [16, 12, 11] },
  'micro-usb': { render: () => <MicroUsb />, size: [6, 8, 3] },
  'dc-jack': { render: () => <DcJack />, size: [14, 9, 11] },
  header: { render: () => <HeaderRow n={6} at={[-6.35, 0, 0]} />, size: [16, 3, 8] },
};

for (const b of BOARDS) MODELS[`board:${b.id}`] = { render: () => <Board def={b} />, size: [b.w, b.d, 12] };

export const modelFor = (key: string): ModelEntry | undefined => MODELS[key];
