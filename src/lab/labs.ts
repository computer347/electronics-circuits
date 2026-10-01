/**
 * The Parts Lab: one short level for every part in the catalogue, each a real bench skill:
 * - sort: measure it and keep or bin it against its tolerance (or: is this cell flat?),
 * - read: read what's printed on it (codes, markings, pin 1),
 * - pins: the markings have worn off, so find its legs with the meter,
 * - use: put it to work and see what the solver does,
 * - identify: find it on a real board by pointing at parts.
 *
 * Parts under test are small circuits between leg nodes L1, L2, L3… so the same meter maths as
 * the desk reads them. Tests check every level against the solver and the 3D models.
 */
import { diodeAcross, ohmsAcross, scaled, type MeterMode, type Reading } from '../desk/meter';
import { formatSI } from '../lib/units';
import { solve, type Component } from '../sim';

interface Base {
  /** Catalogue id. */
  part: string;
  /** The task, in one line. */
  ask: string;
  /** What you can do after it. */
  skill: string;
  /** Why it matters outside the game. */
  why: string;
  /** One nudge, if you're stuck. */
  hint: string;
  /** What the answer means, shown after you answer. */
  explain: string;
}

export type LabSpec =
  /** Keep it if the reading is inside `range` (OL counts as infinite). */
  | Base & { kind: 'sort'; mode: 'Ω' | 'V'; circuit: Component[]; label: string; range: [number, number]; answer: 'keep' | 'bin' }
  | Base & { kind: 'pins'; legs: string[]; modes: MeterMode[]; circuit: Component[]; answer: number }
  | Base & { kind: 'read'; options: string[]; answer: number }
  | Base & { kind: 'use'; options: string[]; answer: number; /** What happens with each option, per the solver. */ outcome: (i: number) => { ok: boolean; says: string } }
  | Base & { kind: 'dial'; source: number; ohms: number; target: [number, number] }
  | Base & { kind: 'identify'; board: string; target: string };

const R = (id: string, a: string, b: string, ohms: number): Component => ({ kind: 'resistor', id, a, b, ohms });
const D = (id: string, a: string, b: string, vf: number): Component => ({ kind: 'diode', id, a, b, vf });
const W = (id: string, a: string, b: string): Component => ({ kind: 'wire', id, a, b });
const C = (id: string, a: string, b: string, farads: number): Component => ({ kind: 'capacitor', id, a, b, farads });
const V = (id: string, a: string, b: string, volts: number): Component => ({ kind: 'vsource', id, a, b, volts });
/** A source's own resistance, so a cell reads like a cell (and a meter across it is safe). */
const cell = (volts: number, ohms: number): Component[] => [V('EMF', 'X', 'L2', volts), R('RINT', 'X', 'L1', ohms)];

const SORT_SKILL = 'Measure a part and decide whether it’s within its tolerance before you fit it.';
const SORT_WHY = 'Parts drift and get mixed up in drawers. Checking before soldering is how you avoid chasing a “fault” that was a wrong part all along.';
const PINS_SKILL = 'Find a part’s legs with the meter’s diode test when the markings are gone.';
const PINS_WHY = 'Salvaged parts, worn bands and unfamiliar packages happen all the time; the meter never guesses.';
const ID_SKILL = 'Recognise parts on a real board and know what each one is for.';
const ID_WHY = 'Before you can repair or reuse a board you have to read it: which chip is the brain, where the power comes in, what sets the clock.';

/** Sometimes a part isn't what it says: this one is 2 % out, that one 12 %. */
const actual = (nominal: number, dev: number) => nominal * (1 + dev);

export const LABS: LabSpec[] = [
  // ------------------------------------------------------------ passives
  { part: 'resistor', kind: 'sort', mode: 'Ω', circuit: [R('R', 'L1', 'L2', actual(4700, 0.12))], label: '4.7 kΩ ±5 % (yellow violet red gold)', range: [4465, 4935], answer: 'bin',
    ask: 'The bands say 4.7 kΩ ±5 %. Measure it: keep it or bin it?', skill: SORT_SKILL, why: SORT_WHY,
    hint: '±5 % of 4.7 kΩ is 235 Ω, so it should read between 4.47 kΩ and 4.94 kΩ.', explain: 'It reads 5.26 kΩ: 12 % high, well outside ±5 %. Probably overheated at some point. Bin it.' },
  { part: 'ceramic-cap', kind: 'read', options: ['104 pF', '10 nF', '100 nF', '1 µF'], answer: 2,
    ask: 'It says “104”. What value is it?', skill: 'Read a capacitor’s three-digit code.', why: 'Every decoupling capacitor on every board is a 104. You’ll read that code a thousand times.',
    hint: 'Two digits, then how many zeros, in picofarads: 10 and 0000 pF.', explain: '10 followed by four zeros is 100 000 pF, which is 100 nF.' },
  { part: 'electrolytic', kind: 'pins', legs: ['left leg', 'right leg'], modes: [], circuit: [C('C', 'L1', 'L2', 470e-6)], answer: 1,
    ask: 'Which leg is the − one?', skill: 'Find an electrolytic’s negative leg from its markings.', why: 'Backwards on a supply, an electrolytic bulges and can vent. Checking the stripe takes a second.',
    hint: 'Look at the can: a light stripe runs down one side, printed with minus signs.', explain: 'The stripe runs down the right-hand side, so the right leg is −. On a new part it’s also the shorter leg.' },
  { part: 'led', kind: 'pins', legs: ['leg 1', 'leg 2'], modes: ['diode', 'Ω'], circuit: [D('LED', 'L1', 'L2', 1.8)], answer: 1,
    ask: 'Its legs were cut to the same length. Which is the cathode (−)?', skill: PINS_SKILL, why: PINS_WHY,
    hint: 'On ▶| the meter conducts from red to black. Red on the anode, black on the cathode: it reads about 1.8 V (and the LED glows faintly).', explain: 'Red on leg 1, black on leg 2 reads 1.8 V and the LED glows: leg 1 is the anode, leg 2 the cathode. (The flat on the rim is on the cathode side too.)' },
  { part: 'potentiometer', kind: 'dial', source: 5, ohms: 10000, target: [2.45, 2.55],
    ask: 'Ends on 5 V and GND. Turn the knob until the wiper reads 2.5 V.', skill: 'Use a potentiometer as an adjustable voltage divider.', why: 'Volume knobs, contrast pots on LCDs and trimmers that set a reference are all this: a divider you turn by hand.',
    hint: 'Halfway round, both halves are 5 kΩ: the wiper sits at half the voltage.', explain: 'At the middle the two halves are equal, so the wiper is at 5 V × ½ = 2.5 V.' },
  { part: 'tactile-button', kind: 'pins', legs: ['front left', 'front right', 'back left', 'back right'], modes: ['Ω'], circuit: [W('A', 'L1', 'L2'), W('B', 'L3', 'L4')], answer: 1,
    ask: 'Four legs, one switch. Which leg is always joined to the front-left one, pressed or not?', skill: 'Find which legs of a 4-leg button are one contact.', why: 'Put a 4-leg button in the wrong way and it’s “always on”. This is the classic breadboard button mistake.',
    hint: 'On Ω, joined legs read about 0 Ω. Not pressed, the two sides read OL.', explain: 'Front left and front right read 0 Ω without pressing: the legs 6.5 mm apart are one contact. Pressing joins the front pair to the back pair.' },
  { part: 'slide-switch', kind: 'pins', legs: ['left', 'middle', 'right'], modes: ['Ω'], circuit: [W('S', 'L2', 'L1')], answer: 1,
    ask: 'Which leg is common, the one the slider joins to either side?', skill: 'Find a changeover switch’s common leg.', why: 'Power switches on toys and dev boards are SPDT slides: the supply goes on the common leg.',
    hint: 'Measure each pair on Ω. The slider is at the left: which leg is joined to the left one?', explain: 'Middle to left reads 0 Ω: the middle leg is common. Slide it and it joins middle to right instead.' },
  { part: 'buzzer', kind: 'read', options: ['50 Hz', '2.3 kHz', '40 kHz'], answer: 1,
    ask: 'A 12 mm piezo buzzer. At which frequency is it loudest?', skill: 'Drive a piezo at its resonant frequency.', why: 'Every beep from a microwave or a smoke alarm is a piezo driven near its resonance, a couple of kHz.',
    hint: 'Its datasheet gives a resonant frequency; small piezos resonate at a few kHz. And 40 kHz is above anyone’s hearing.', explain: 'Around 2.3 kHz the disc resonates and is loudest. 50 Hz barely moves it; 40 kHz is ultrasound (that’s the HC-SR04’s frequency).' },

  // ------------------------------------------------------------ diodes and transistors
  { part: 'diode-1n4148', kind: 'pins', legs: ['leg 1', 'leg 2'], modes: ['diode', 'Ω'], circuit: [D('D', 'L1', 'L2', 0.62)], answer: 1,
    ask: 'The black band’s rubbed off. Which leg is the cathode?', skill: PINS_SKILL, why: PINS_WHY,
    hint: 'Red on one leg, black on the other, on ▶|. A silicon diode reads about 0.6 V forwards and OL backwards.', explain: 'Red on leg 1, black on leg 2 reads 0.62 V: leg 2 is the cathode (where the band was).' },
  { part: 'diode-1n4007', kind: 'pins', legs: ['leg 1', 'leg 2'], modes: ['diode', 'Ω'], circuit: [D('D', 'L1', 'L2', 0.55)], answer: 1,
    ask: 'Which leg is the cathode? The grey band is under a blob of glue.', skill: PINS_SKILL, why: PINS_WHY,
    hint: 'Forwards, a rectifier diode reads around 0.5 V on ▶|; backwards, OL.', explain: 'Red on leg 1, black on leg 2 reads 0.55 V: leg 2 is the cathode. Scrape the glue off and the grey band is there.' },
  { part: 'npn-bc547', kind: 'pins', legs: ['leg 1', 'leg 2', 'leg 3'], modes: ['diode', 'Ω'], circuit: [D('BE', 'L2', 'L3', 0.68), D('BC', 'L2', 'L1', 0.66)], answer: 1,
    ask: 'An NPN transistor with its print worn off. Which leg is the base?', skill: 'Find a transistor’s base with the diode test.', why: 'A transistor is two diodes back to back. Finding the base is the first step to working out any unknown transistor.',
    hint: 'Red on the base reads about 0.7 V to both of the other legs. No other leg does that.', explain: 'Red on leg 2 reads ~0.7 V to leg 1 and to leg 3: leg 2 is the base. (The slightly higher reading, to leg 3, is the emitter.)' },
  { part: 'mosfet-irlz44n', kind: 'use', options: ['No: it needs 10 V on the gate', 'Yes: it’s a logic-level MOSFET', 'Only with a resistor in series'], answer: 1,
    outcome: (i) => {
      const r = solve({ components: [V('PIN', 'G', '0', 3.3), V('SUP', 'S12', '0', 12), R('LOAD', 'S12', 'D', 12), { kind: 'nmos', id: 'M', a: 'D', b: '0', gate: 'G', vth: 2, ron: 0.022 }] });
      const amps = r.currents['M'] ?? 0;
      return { ok: i === 1 && amps > 0.9, says: `With 3.3 V on the gate it passes ${formatSI(amps, 'A')} into a 12 Ω load.` };
    },
    ask: 'An ESP32 pin gives 3.3 V. Can it switch an IRLZ44N on to run a 1 A LED strip?', skill: 'Pick a MOSFET a microcontroller can switch directly.', why: 'Driving motors, strips and heaters from an Arduino or ESP32 is almost always a logic-level MOSFET like this one.',
    hint: 'The L in IRLZ44N means logic level: its gate threshold is 1–2 V.', explain: 'Its threshold is about 2 V, and at 3.3 V it’s well on: nearly the full 1 A flows. (Its cousin the IRFZ44N, no L, would barely turn on.)' },
  { part: 'reg-7805', kind: 'use', options: ['5 V', '6 V', '9 V'], answer: 2,
    outcome: (i) => {
      const vin = [5, 6, 9][i]!;
      const r = solve({ components: [V('IN', 'I', '0', vin), { kind: 'regulator', id: 'U', a: 'I', b: '0', out: 'O', vout: 5, dropout: 2 }, R('LOAD', 'O', '0', 100)] });
      const vout = r.nodeVoltages['O'] ?? 0;
      return { ok: Math.abs(vout - 5) < 0.05, says: `${vin} V in gives ${vout.toFixed(2)} V out.` };
    },
    ask: 'You need a steady 5.00 V from an LM7805. Which input will do it?', skill: 'Give a linear regulator enough headroom (its dropout).', why: 'A regulator can only take voltage away. The 7805 needs about 2 V more in than out, which is why Arduino boards want 7–12 V on the barrel jack.',
    hint: 'Out = in − 2 V at best. What’s the least input that leaves 5 V?', explain: 'It needs about 7 V or more. 5 V in gives about 3 V out; 6 V gives 4 V; 9 V gives a solid 5.00 V.' },
  { part: 'ldo-ams1117', kind: 'use', options: ['3.3 V', '5 V', '12 V'], answer: 1,
    outcome: (i) => {
      const vin = [3.3, 5, 12][i]!;
      const r = solve({ components: [V('IN', 'I', '0', vin), { kind: 'regulator', id: 'U', a: 'I', b: '0', out: 'O', vout: 3.3, dropout: 1.1 }, R('LOAD', 'O', '0', 16.5)] });
      const vout = r.nodeVoltages['O'] ?? 0;
      const watts = (vin - vout) * (vout / 16.5);
      const ok = Math.abs(vout - 3.3) < 0.05 && watts < 1;
      return { ok, says: `${vin} V in gives ${vout.toFixed(2)} V out, and the regulator turns ${watts.toFixed(2)} W into heat${watts >= 1 ? ': too hot for a SOT-223 without a heatsink' : ''}.` };
    },
    ask: 'An AMS1117-3.3 feeding an ESP32 (200 mA). Which input is right?', skill: 'Pick a regulator’s input: enough headroom, not too much heat.', why: 'This exact chip powers most ESP32 boards from USB’s 5 V. Feed it 12 V and it cooks, because a linear regulator burns off the difference as heat.',
    hint: 'It needs about 1.1 V of headroom. The rest, (Vin − 3.3 V) × 0.2 A, becomes heat in a tiny package.', explain: '5 V gives 3.3 V with 0.34 W of heat. 3.3 V in can’t make 3.3 V out; 12 V works but burns 1.7 W, too much for a SOT-223.' },

  // ------------------------------------------------------------ power
  { part: 'cell-aa', kind: 'sort', mode: 'V', circuit: cell(1.08, 0.4), label: 'AA alkaline · 1.5 V new, done below about 1.2 V', range: [1.2, 1.7], answer: 'bin',
    ask: 'Measure the AA cell: keep it or bin it?', skill: 'Test a cell with a voltmeter and know when it’s flat.', why: '“Dead” gadgets are very often just tired batteries. A meter tells you in a second.',
    hint: 'A new alkaline cell reads 1.5–1.6 V. Under about 1.2 V it’s spent.', explain: 'It reads 1.08 V: flat. Bin it (in the battery recycling, not the bin bin).' },
  { part: 'battery-9v', kind: 'sort', mode: 'V', circuit: cell(9.35, 1.5), label: '9 V alkaline · 9.0–9.6 V new, done below about 7.2 V', range: [7.2, 9.8], answer: 'keep',
    ask: 'Measure the 9 V battery: keep it or bin it?', skill: 'Test a cell with a voltmeter and know when it’s flat.', why: 'Smoke alarms chirp when their 9 V is low. You’ll know what the number on the meter means.',
    hint: 'A fresh 9 V reads a little over 9 V. Below about 7.2 V it’s done.', explain: 'It reads 9.35 V: good as new. Keep it.' },

  // ------------------------------------------------------------ surface mount
  { part: 'chip-r-0402', kind: 'sort', mode: 'Ω', circuit: [R('R', 'L1', 'L2', actual(10000, -0.02))], label: '10 kΩ ±5 % (from the reel label: 0402s have no print)', range: [9500, 10500], answer: 'keep',
    ask: '0402s are too small to print on. Measure it against the reel label: keep or bin?', skill: SORT_SKILL, why: 'Stray 0402s are impossible to identify by eye. Measure, or don’t fit it.',
    hint: '10 kΩ ±5 % is 9.5–10.5 kΩ.', explain: 'It reads 9.80 kΩ: 2 % low, inside ±5 %. Keep it.' },
  { part: 'chip-r-0603', kind: 'read', options: ['47 Ω', '470 Ω', '4.7 kΩ', '47 kΩ'], answer: 2,
    ask: 'The chip says “472”. What value is it?', skill: 'Read a three-digit SMD resistor code.', why: 'Board repair means reading these through a loupe: the Uno’s own resistors are 102, 103, 220.',
    hint: 'Two digits, then a count of zeros: 47 and 00.', explain: '47 followed by two zeros is 4700 Ω = 4.7 kΩ.' },
  { part: 'chip-r-0805', kind: 'read', options: ['100 Ω', '1 kΩ', '10 kΩ', '100 kΩ'], answer: 2,
    ask: 'This one says “1002”. What value?', skill: 'Read a four-digit (1 %) SMD resistor code.', why: 'Precision resistors use four digits. Misread one and your sensor divider is 10× out.',
    hint: 'Three digits, then a count of zeros: 100 and 00.', explain: '100 followed by two zeros is 10 000 Ω = 10 kΩ, a 1 % part.' },
  { part: 'chip-c-0603', kind: 'sort', mode: 'Ω', circuit: [R('SHORT', 'L1', 'L2', 0.4)], label: '100 nF 0603 · a good capacitor reads OL on Ω (after a moment)', range: [1e6, Infinity], answer: 'bin',
    ask: 'A decoupling capacitor off a dead board. Healthy or shorted?', skill: 'Spot a shorted capacitor with the Ω range.', why: 'A shorted decoupling capacitor pulls a whole supply rail down: one of the most common reasons a board is dead.',
    hint: 'A capacitor blocks DC, so a good one reads OL. Near 0 Ω means it’s cracked and shorted.', explain: 'It reads 0.4 Ω: shorted. That’s what was dragging the board’s 3.3 V down. Bin it.' },
  { part: 'chip-led-0603', kind: 'pins', legs: ['pad 1', 'pad 2'], modes: ['diode'], circuit: [D('LED', 'L1', 'L2', 2.0)], answer: 1,
    ask: 'Which end of this tiny LED is the cathode?', skill: PINS_SKILL, why: 'SMD LED markings are a green dot or a notch you need a loupe for. The diode test lights it: you can’t miss that.',
    hint: 'On ▶| the LED lights faintly when red is on its anode.', explain: 'Red on pad 1, black on pad 2 reads 2.0 V and it glows: pad 2 is the cathode.' },
  { part: 'sot23', kind: 'identify', board: 'arduino-uno', target: 'Q1',
    ask: 'Find the SOT-23 transistor on the Uno: it switches the board between USB and barrel-jack power.', skill: ID_SKILL, why: ID_WHY,
    hint: 'SOT-23 is a tiny black package with three legs, two on one side, one on the other. Look near the power jack.', explain: 'Q1 is a small MOSFET: when the barrel jack is powered it cuts off USB, so the two supplies never fight.' },
  { part: 'soic8', kind: 'read', options: ['pin 4', 'pin 5', 'pin 8'], answer: 2,
    ask: 'An SOIC-8 chip, dot at the top left for pin 1. Which pin is straight across from pin 1?', skill: 'Number a chip’s pins from its pin-1 mark.', why: 'Every chip datasheet numbers pins this way. Get it wrong and you probe, or solder, the wrong pin.',
    hint: 'Pins count down the left side from the dot (1–4), then back up the right side (5–8).', explain: 'Down the left 1, 2, 3, 4, up the right 5, 6, 7, 8: pin 8 is opposite pin 1.' },
  { part: 'qfp32', kind: 'identify', board: 'arduino-uno', target: 'U_MCU',
    ask: 'Find the ATmega328P, the Uno’s brain, in its QFP-32 package.', skill: ID_SKILL, why: ID_WHY,
    hint: 'The biggest square chip with legs on all four sides, set at 45°.', explain: 'The ATmega328P runs your sketch: 32 KB of flash, 2 KB of RAM, 16 MHz.' },
  { part: 'qfp48', kind: 'identify', board: 'blue-pill', target: 'U_MCU',
    ask: 'Find the STM32 on the Blue Pill: an ARM chip in a 48-pin QFP.', skill: ID_SKILL, why: ID_WHY,
    hint: 'The big square chip in the middle, turned 45°.', explain: 'The STM32F103 is a 72 MHz ARM Cortex-M3: far quicker than the Uno’s ATmega, for about the same money.' },
  { part: 'crystal', kind: 'read', options: ['16 Hz', '16 kHz', '16 MHz', '16 GHz'], answer: 2,
    ask: 'The crystal on the Uno reads “16.000”. What frequency is it?', skill: 'Read a crystal’s marking.', why: 'The crystal sets the chip’s clock: every delay() and baud rate depends on it being right.',
    hint: 'Crystals are marked in MHz.', explain: '16.000 MHz: sixteen million ticks a second. That’s the Uno’s clock.' },
  { part: 'usb-b', kind: 'identify', board: 'arduino-uno', target: 'J_USB',
    ask: 'Find the USB-B socket: power and programming both come in here.', skill: ID_SKILL, why: ID_WHY,
    hint: 'The big square metal socket on the left edge.', explain: 'USB-B: chunky and hard to break, which is why classroom boards still use it.' },
  { part: 'micro-usb', kind: 'identify', board: 'esp32-devkit', target: 'J_USB',
    ask: 'Find the micro-USB socket on the ESP32 DevKit.', skill: ID_SKILL, why: ID_WHY,
    hint: 'The small silver socket on the short edge.', explain: 'Micro-USB: small and cheap, but the first thing to break on a dev board, so learn to spot a wobbly one.' },
  { part: 'dc-jack', kind: 'identify', board: 'arduino-uno', target: 'J_PWR',
    ask: 'Find the barrel jack, where 7–12 V from a wall adapter comes in.', skill: ID_SKILL, why: ID_WHY,
    hint: 'Black, round opening, on the left edge next to the USB socket.', explain: 'Centre pin positive. Power from here goes through the regulator down to 5 V.' },
  { part: 'header', kind: 'identify', board: 'arduino-uno', target: 'H_PWR',
    ask: 'Find the power header: 5V, 3.3V and GND for your modules.', skill: ID_SKILL, why: ID_WHY,
    hint: 'A black female header along the bottom edge, labelled POWER.', explain: 'IOREF, RESET, 3.3V, 5V, GND, GND, VIN: the pins you wired the DHT11 to.' },

  // ------------------------------------------------------------ boards and modules
  { part: 'arduino-uno', kind: 'identify', board: 'arduino-uno', target: 'U_REG',
    ask: 'Find the regulator that turns the barrel jack’s 7–12 V into the board’s 5 V.', skill: ID_SKILL, why: ID_WHY,
    hint: 'A small three-legged SOT-223 with a big tab, near the barrel jack.', explain: 'The NCP1117 is a linear regulator: feed it 12 V and it gets warm, turning the extra 7 V into heat.' },
  { part: 'esp32-devkit', kind: 'identify', board: 'esp32-devkit', target: 'U_UART',
    ask: 'Find the chip that lets your computer talk to the ESP32 over USB.', skill: ID_SKILL, why: ID_WHY,
    hint: 'A small square chip between the USB socket and the big metal can.', explain: 'The CP2102 turns USB into serial. If your computer can’t see the board, this chip’s driver is usually why.' },
  { part: 'esp-01', kind: 'identify', board: 'esp-01', target: 'Y1',
    ask: 'Find the crystal that clocks the ESP8266’s Wi-Fi.', skill: ID_SKILL, why: ID_WHY,
    hint: 'A small metal can next to the main chip.', explain: '26 MHz: the Wi-Fi radio’s timing is built from it, so a cracked crystal means no Wi-Fi at all.' },
  { part: 'blue-pill', kind: 'identify', board: 'blue-pill', target: 'LED_C13',
    ask: 'Find the LED wired to pin PC13, the one your first program blinks.', skill: ID_SKILL, why: ID_WHY,
    hint: 'There are two small LEDs near the USB end. One is power; the other is marked PC13.', explain: 'PC13’s LED is the Blue Pill’s “L” LED. It lights when the pin is LOW, the opposite of the Uno.' },
  { part: 'rc522', kind: 'identify', board: 'rc522', target: 'Y1',
    ask: 'Find the crystal: it runs at 27.12 MHz, twice the 13.56 MHz RFID tags talk at.', skill: ID_SKILL, why: ID_WHY,
    hint: 'A small metal can near the reader chip, away from the big antenna loop.', explain: 'Every card and key fob on a 13.56 MHz reader is timed off this crystal.' },
  { part: 'oled-096', kind: 'identify', board: 'oled-096', target: 'H1',
    ask: 'Find the four-pin header you’d wire to a microcontroller.', skill: ID_SKILL, why: ID_WHY,
    hint: 'Along the top edge: GND, VCC, SCL, SDA.', explain: 'I²C needs only SCL and SDA for data, plus power: four wires for a whole screen.' },
  { part: 'dht11', kind: 'identify', board: 'dht11', target: 'R_PULL',
    ask: 'Find the pull-up resistor the DHT11’s data line needs.', skill: ID_SKILL, why: ID_WHY,
    hint: 'A tiny 0603 resistor marked 103 between the sensor and the pins.', explain: 'The data line is only ever pulled low by the sensor; this 10 kΩ pulls it back high. The module has it built in, a bare sensor doesn’t.' },
  { part: 'hc-sr04', kind: 'identify', board: 'hc-sr04', target: 'TX',
    ask: 'Find the transmitter: it sends the 40 kHz ping.', skill: ID_SKILL, why: ID_WHY,
    hint: 'Two silver cans: the one marked T sends, R listens.', explain: 'T sends eight 40 kHz pulses; R hears the echo. Time there and back ÷ 2 × the speed of sound is the distance.' },
  { part: 'usb-stick', kind: 'identify', board: 'usb-stick', target: 'U_FLASH',
    ask: 'Find the chip your files actually live on.', skill: ID_SKILL, why: ID_WHY,
    hint: 'Two chips: a controller near the plug, and the bigger flash chip behind it.', explain: 'NAND flash holds the data; the controller next to it talks USB and spreads the wear across the flash.' },
];

export const labByPart = (id: string) => LABS.find((l) => l.part === id);

// ---------------------------------------------------------------- the meter in the lab

/** Leg node for leg i (0-based). */
export const leg = (i: number) => `L${i + 1}`;

/** What the meter shows with its probes on two legs of the part under test. */
export function labReading(spec: LabSpec, mode: MeterMode, red: number | null, black: number | null): Reading {
  if (spec.kind !== 'sort' && spec.kind !== 'pins') return { text: '', unit: '' };
  if (mode === 'off') return { text: '', unit: '' };
  if (red === null || black === null) return { text: '- - - -', unit: mode === 'diode' ? 'V' : mode === 'A' ? 'mA' : mode };
  const comps = spec.circuit;
  const a = leg(red), b = leg(black);
  if (mode === 'V') {
    const r = solve({ components: comps });
    const v = (r.nodeVoltages[a] ?? 0) - (r.nodeVoltages[b] ?? 0);
    return { ...scaled(v, 'V'), value: v };
  }
  if (mode === 'A') return { text: '- - - -', unit: 'mA', note: 'Current needs the part in a circuit. Here, use V, Ω or ▶|.' };
  const powered = comps.some((c) => c.kind === 'vsource');
  if (powered) return { text: 'Err', unit: mode === 'diode' ? 'V' : 'Ω', note: 'Never put Ω or ▶| across a battery: it has its own voltage. Use V.' };
  if (mode === 'Ω') {
    const ohms = ohmsAcross(comps, a, b);
    return ohms === null ? { text: 'OL', unit: 'Ω' } : { ...scaled(ohms, 'Ω'), value: ohms };
  }
  const v = diodeAcross(comps, a, b);
  return v === null ? { text: 'OL', unit: 'V' } : { text: v.toFixed(3), unit: 'V', value: v };
}

/** The dial level: the wiper's voltage with the knob at `position` (0–1). */
export function dialVolts(spec: Extract<LabSpec, { kind: 'dial' }>, position: number): number {
  const k = Math.min(1, Math.max(0, position));
  const r = solve({ components: [V('S', 'TOP', '0', spec.source), R('A', 'TOP', 'W', Math.max(1, spec.ohms * k)), R('B', 'W', '0', Math.max(1, spec.ohms * (1 - k)))] });
  return r.nodeVoltages['W'] ?? 0;
}
