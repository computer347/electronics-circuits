/**
 * Repair jobs: a real board with a fault, and the spares to fix it. One per board to begin
 * with, each a test level for the board repair activity.
 */
import type { RepairJob, Spare } from './repair';

/** A reel of 0603 resistors. The code is the value: two digits and a count of zeros ("102" = 10 and 00 = 1 kΩ). */
const chipR = (ohms: number, code: string): Spare => ({ id: `R${code}`, code, name: `Resistor 0603 · code ${code}`, fits: 'resistor', ohms });

export const DEAD_POWER_LED: RepairJob = {
  id: 'repair-dead-power-led',
  title: 'Dead power LED',
  board: 'arduino-uno',
  story: 'A student’s Arduino Uno came back from a robotics club. It still uploads sketches, they say, but the green ON light never comes on, so nobody trusts it.',
  goal: 'Find why the ON LED stays dark, replace the bad part, and get it lit at a normal 2–5 mA.',
  skill: 'Fault-find a dead indicator: check the supply, find the open part by the voltage across it, confirm it with Ω, and read SMD resistor codes.',
  realLife: 'A dead power light is one of the commonest faults on any board, from routers to 3D printers. The same checks find it: is there power, where does the voltage stop, which part is open.',
  hints: [
    'Plug in the USB and put the meter on V. Black on a GND pin, red on the 5V pin: is the board getting its 5 V?',
    'Follow the power LED’s loop: 5 V → R_ON → LED_ON → GND. Red on each pad in turn. In a broken loop, the whole 5 V appears across the part that’s open.',
    'Unplug it, turn to Ω and measure R_ON across its two pads. Its tooltip says what it should read. Then take it off with the iron and fit a 102 (1 kΩ).',
  ],
  faults: [{ part: 'R_ON', kind: 'open' }],
  spares: [
    chipR(100, '101'),
    chipR(1000, '102'),
    chipR(10000, '103'),
    { id: 'LED-G', code: 'green', name: 'LED 0603 · green', fits: 'led' },
  ],
  check: { led: 'LED_ON', min: 0.002, max: 0.005 },
};

export const REPAIR_JOBS: RepairJob[] = [DEAD_POWER_LED];
export const repairJobById = (id: string) => REPAIR_JOBS.find((j) => j.id === id);
