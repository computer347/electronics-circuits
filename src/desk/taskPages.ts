/**
 * What the notebook says for each level: one big sentence, the picture of the target, then the
 * level's own goal and story, the datasheet and one tip. The numbers come from the level JSON;
 * the short sentence and the tip are written here.
 */
import type { LevelDef } from '../levels/types';

export type TaskPicture = 'led' | 'two-leds' | 'divider' | 'rc' | 'fork' | 'button' | 'cells' | 'bridge' | 'transistor'
  | 'binary' | 'and' | 'or' | 'not' | 'nand' | 'xor' | 'chip' | 'adder' | 'latch';

export interface TaskPage {
  label: string;
  title: string;
  /** One sentence, big: what to do. */
  headline: string;
  /** The level's goal with its numbers. */
  goal: string;
  story: string;
  tip: string;
  picture: TaskPicture;
  /** What you can do after this level, in one line. */
  skill: string;
  /** Where you'll meet it outside the game. */
  realLife: string;
  datasheet?: { title: string; rows: [string, string][] };
}

const EXTRA: Record<string, { headline: string; tip: string; picture: TaskPicture; skill: string; realLife: string }> = {
  'w0-01-first-light': {
    headline: 'Light the LED without burning it.',
    tip: 'The resistor sets the current. Too small and the LED burns, too big and it stays dark. Try R = (9 V − 2 V) ÷ the current you want.',
    picture: 'led',
    skill: 'Pick the resistor that keeps an LED safe, with Ohm’s law.',
    realLife: 'Every power light on a charger, router or TV has a resistor like R1 in front of it. It’s the first sum anyone building with LEDs does.',
  },
  'w0-02-wrong-way-round': {
    headline: 'Make the LED light up.',
    tip: 'Measure before you touch anything: black probe on the − rail, red on each LED leg. A lit LED has its long leg about 2 V above its short one.',
    picture: 'led',
    skill: 'Find a part that’s in backwards by measuring, not guessing.',
    realLife: 'LEDs, diodes, electrolytic capacitors and batteries all have a right way round. A reversed one is the most common mistake on a new board.',
  },
  'w0-03-side-by-side': {
    headline: 'Light both LEDs from a small supply.',
    tip: 'Side by side, the supply feeds each LED its own current. In a line (series), one current passes through both.',
    picture: 'two-leds',
    skill: 'Tell series from parallel, and give each LED its own current.',
    realLife: 'Indicator panels, LED strips and car dashboards wire their lights side by side, each with its own resistor, so one dead LED doesn’t take the rest out.',
  },
  'w0-04-split-the-difference': {
    headline: 'Make 3 volts out of 9.',
    tip: 'Two resistors in a line split the voltage: the middle sits at 9 V × R_bottom ÷ (R_top + R_bottom). Big values waste less current.',
    picture: 'divider',
    skill: 'Design a voltage divider for the voltage you need.',
    realLife: 'Dividers read sensors (light, temperature, a battery’s charge) and drop a 5 V signal to the 3.3 V an ESP32’s pin can take.',
  },
  'w0-05-slow-blink': {
    headline: 'Make the capacitor charge in about a second.',
    tip: 'The time constant is τ = R × C. C1 is 100 µF: which R makes R × C about 1 s?',
    picture: 'rc',
    skill: 'Set a delay with a resistor and a capacitor: τ = R × C.',
    realLife: 'RC delays debounce buttons, hold a chip in reset while its power settles, and set the blink rate of timers like the 555.',
  },
  'w0-06-fork-in-the-road': {
    headline: 'Get both LEDs properly lit.',
    tip: 'Each branch gets the full 9 V. Measure across each resistor: V ÷ R is its current, no need to break the circuit.',
    picture: 'fork',
    skill: 'Add up the currents where a circuit branches (Kirchhoff’s current law).',
    realLife: 'It’s how you budget current: an Arduino pin gives 20 mA, a USB port 500 mA. Add up your branches before you plug in.',
  },
  'w0-07-push-to-light': {
    headline: 'Light the LED only while the button is held.',
    tip: 'A column of five holes is one strip. The button goes across the gap between two columns, never along one.',
    picture: 'button',
    skill: 'Put a switch in series, across the breadboard’s strips.',
    realLife: 'Every button on a remote, keyboard or doorbell closes a gap in a loop like this. Later a microcontroller will read it.',
  },
  'w0-08-stack-them-up': {
    headline: 'Get the torch working on its batteries.',
    tip: 'Walk the stack with the meter: black on the − rail, red on each cell’s + end. It should climb 1.5 V per cell.',
    picture: 'cells',
    skill: 'Add cell voltages in series, and find the one put in backwards.',
    realLife: 'Torches, remotes and toys stack AA cells: two make 3 V, four make 6 V. One reversed cell is why a fresh set of batteries ’doesn’t work’.',
  },
  'w0-09-balance-the-bridge': {
    headline: 'Make the meter across the bridge read zero.',
    tip: 'Both taps match when both sides divide in the same ratio: R2 ÷ R1 = R4 ÷ R3.',
    picture: 'bridge',
    skill: 'Balance a bridge: matching ratios give zero volts across it.',
    realLife: 'Kitchen scales, pressure sensors and precise thermometers use a bridge, so a tiny change in one resistor shows up as a clear voltage.',
  },
  'w0-10-switch-it': {
    headline: 'Let a trickle switch the LED.',
    tip: 'Base current is (9 V − 0.7 V) ÷ R. Keep it under 2 mA, and remember Q1 lets through up to 200 times that.',
    picture: 'transistor',
    skill: 'Switch a big load from a small current with an NPN transistor and a base resistor.',
    realLife: 'Every Arduino project with a relay, a motor or an LED strip has this: the pin drives a base through a resistor, and the transistor carries the load.',
  },
  'w1-01-count-in-lights': {
    headline: 'Show 13 in binary.',
    tip: 'Each LED is worth twice the one to its right: 8, 4, 2, 1. Add up the lit ones. And if one won’t light, measure across its resistor.',
    picture: 'binary',
    skill: 'Read and write numbers in binary, and find a dead bit with the meter.',
    realLife: 'Address pins on I²C modules, DIP switches on boards and every register in a microcontroller are binary numbers you set or read like this.',
  },
  'w1-02-both': {
    headline: 'Light it only when both are on.',
    tip: 'AND means every switch on one path: in series. One open switch anywhere breaks it.',
    picture: 'and',
    skill: 'Build AND from switches in series and check it against its truth table.',
    realLife: 'Safety interlocks are ANDs: a machine runs only with the guard shut and the start pressed, and two-hand controls need both hands.',
  },
  'w1-03-either': {
    headline: 'Light it from either switch.',
    tip: 'OR means two separate paths side by side: in parallel. Either one closed is enough.',
    picture: 'or',
    skill: 'Build OR from switches in parallel and check it against its truth table.',
    realLife: 'Door chimes with two buttons, alarms with several sensors, any “this or that turns it on” is an OR.',
  },
  'w1-04-not': {
    headline: 'Make the light do the opposite.',
    tip: 'A pull-up resistor holds the output high. The transistor, when on, drags it low. Size the pull-up for the LED’s current.',
    picture: 'not',
    skill: 'Build an inverter from a transistor and a pull-up resistor, and size the pull-up.',
    realLife: 'Pull-ups are everywhere: on I²C lines, reset pins and buttons into a microcontroller. A night light that turns on in the dark is NOT logic.',
  },
  'w1-05-not-both': {
    headline: 'Dark only when both are on.',
    tip: 'Two transistors in series pull the output down only if both conduct. The pull-up does the rest.',
    picture: 'nand',
    skill: 'Build a NAND gate from two transistors and a pull-up, and test all four input cases.',
    realLife: 'NAND is the building block of chips: flash memory is literally NAND flash, and any logic can be made from NAND gates alone.',
  },
  'w1-06-stairwell': {
    headline: 'Either switch flips the light.',
    tip: 'A changeover switch joins its common to one side or the other. The light is on when both commons meet the same traveller.',
    picture: 'xor',
    skill: 'Wire two-way switching with changeover switches, and read XOR from it.',
    realLife: 'Every stairwell, hallway and long room with a switch at each end is wired like this, and XOR is how a computer adds two bits.',
  },
  'w1-07-power-the-chip': {
    headline: 'Wake the chip up.',
    tip: 'Every logic chip needs its own power: VCC on pin 14 (top left, by the notch) and GND on pin 7 (bottom right).',
    picture: 'chip',
    skill: 'Find a logic chip’s pins from its notch and power it through VCC and GND.',
    realLife: 'Every chip on every board, from a 74HC00 to an ESP32, has supply pins. A dead chip is so often just an unpowered one.',
  },
  'w1-08-half-adder': {
    headline: 'Add two bits: sum and carry.',
    tip: 'The sum is XOR, the carry is AND, of the same two inputs. IC2’s gate 1 takes its inputs on pins 1 and 2.',
    picture: 'adder',
    skill: 'Build a half adder from XOR and AND chips, and read sum and carry.',
    realLife: 'Adders are the heart of every calculator and CPU: chained, they add numbers of any size.',
  },
  'w1-09-remember': {
    headline: 'Make it remember.',
    tip: 'Feed each gate’s output into the other gate’s spare input. The loop holds whatever the last button said.',
    picture: 'latch',
    skill: 'Build a latch from two cross-coupled NANDs: a circuit that remembers.',
    realLife: 'Every machine’s START/STOP control works like this, and so does each bit of a computer’s registers and memory.',
  },
  'w0-11-two-in-a-row': {
    headline: 'Light two LEDs in a row with one resistor.',
    tip: 'The resistor gets what the LEDs leave: 9 V − 2 V − 2 V = 5 V. Then R = 5 V ÷ the current.',
    picture: 'two-leds',
    skill: 'Size one resistor for a string of LEDs in series.',
    realLife: 'LED strips, torches and car tail lights run their LEDs in series strings, with one resistor for each string.',
  },
  'w0-12-mixed-colours': {
    headline: 'Make a red and a blue LED equally bright.',
    tip: 'Blue drops 3.0 V, red 2.0 V: each resistor gets a different voltage, so each needs its own value.',
    picture: 'two-leds',
    skill: 'Pick a resistor for each LED colour from its forward voltage.',
    realLife: 'Status panels, RGB LEDs and traffic-light modules give every colour its own resistor so they match in brightness.',
  },
  'w0-13-make-do': {
    headline: 'Make 350 Ω from the resistors you have.',
    tip: 'Series adds; parallel gives less than the smallest: 470 × 1000 ÷ (470 + 1000) = 320 Ω.',
    picture: 'led',
    skill: 'Combine resistors in series and parallel to make any value.',
    realLife: 'Repair techs do this whenever the exact value isn’t in the drawer, and to share heat between two resistors.',
  },
  'w0-14-bypassed': {
    headline: 'Find what shorts the LED out.',
    tip: 'A working LED shows about 2 V across it. 0 V means its legs are joined by something else: follow the wires.',
    picture: 'led',
    skill: 'Find a short circuit by measuring 0 V across a part.',
    realLife: 'A stray wire or solder bridge across a part is the commonest fault on hand-built boards, and 0 V across it is the giveaway.',
  },
  'w0-15-dead-rail': {
    headline: 'Bring the bottom rails back to life.',
    tip: 'The bottom rails only work through jumpers from the top ones. Measure from T− to B−: 9 V there means no ground.',
    picture: 'led',
    skill: 'Trace a circuit’s loop and find where it’s open.',
    realLife: 'Split rails, broken wires and cracked joints all leave an open loop; checking continuity is the first step of any repair.',
  },
  'w0-16-power-budget': {
    headline: 'Fit the panel into a 45 mA budget.',
    tip: 'Add up the branch currents: 3 × 21 mA is too much. Each LED can have 10–15 mA.',
    picture: 'fork',
    skill: 'Add up a circuit’s current and keep it within the supply’s rating.',
    realLife: 'Every battery gadget is designed to a budget: total current sets how long the battery lasts and which adapter it needs.',
  },
  'w0-17-one-way': {
    headline: 'Protect the LED from a reversed battery.',
    tip: 'Anode in column 3, band (cathode) towards the LED. It keeps 0.7 V: (9 − 0.7 − 2) ÷ 330.',
    picture: 'led',
    skill: 'Use a diode to block reverse current, and allow for its 0.7 V.',
    realLife: 'Toys, remotes and battery packs have a diode or MOSFET in the feed so a battery fitted backwards can’t damage anything.',
  },
  'w0-18-turn-it-down': {
    headline: 'Dim the lamp with the knob.',
    tip: 'From leg 1 to the wiper the pot is 10 kΩ × the knob. You want about 1.4 kΩ in the loop for 5 mA.',
    picture: 'led',
    skill: 'Use a potentiometer as a variable resistor to set a current.',
    realLife: 'Dimmers, speed controls and old volume knobs used a potentiometer in series with the load like this.',
  },
  'w0-19-set-the-level': {
    headline: 'Set the knob’s output to 5.4 V.',
    tip: 'The wiper sits at 9 V × the share of the track below it. 5.4 V is 60 % of 9 V.',
    picture: 'divider',
    skill: 'Set an adjustable voltage with a potentiometer divider.',
    realLife: 'Thermostat set points, joysticks and volume knobs are pots read as a voltage by a chip.',
  },
  'w0-20-wrong-sensor': {
    headline: 'Get the thermometer reading mid-scale again.',
    tip: 'For mid-scale at 25 °C the fixed resistor should equal the thermistor’s 10 kΩ. Check R1’s bands.',
    picture: 'divider',
    skill: 'Read a resistive sensor with a correctly matched divider.',
    realLife: 'Thermostats, light sensors and battery monitors read a resistive sensor through a divider into a chip’s analog input.',
  },
  'w0-21-under-load': {
    headline: 'Hold 4.5 V up with a load attached.',
    tip: 'RL sits in parallel with your bottom resistor. Either make the divider small, or make its bottom bigger.',
    picture: 'divider',
    skill: 'Design a divider that stays on target when something draws from it.',
    realLife: 'Reference voltages and sensor biasing sag under load; engineers size dividers for it or add a buffer.',
  },
  'w0-22-double-up': {
    headline: 'Make the soft start take about a second.',
    tip: 'Capacitors in parallel add up: two 100 µF are 200 µF, and τ = R × C doubles.',
    picture: 'rc',
    skill: 'Combine capacitors to set a time constant.',
    realLife: 'Power supplies bank capacitors in parallel, and timers add capacitance to slow a delay down.',
  },
  'w0-23-regulated': {
    headline: 'Run the LED from a regulated 5 V.',
    tip: 'LM7805 pins facing you: IN, GND, OUT. Put IN on column 5 where the 9 V comes in.',
    picture: 'led',
    skill: 'Wire a voltage regulator and design a circuit for its output.',
    realLife: 'Arduinos, USB gadgets and sensor boards all have a regulator turning their supply into a steady 5 V or 3.3 V.',
  },
  'w0-24-enough-gain': {
    headline: 'Light three LEDs through one transistor.',
    tip: 'Q1 passes at most 200 × its base current. Three LEDs need about 43 mA: give it 0.5–1 mA.',
    picture: 'transistor',
    skill: 'Pick a base resistor that saturates a transistor for its load.',
    realLife: 'Microcontrollers switch relays, buzzers and LED strips through a transistor sized exactly like this.',
  },
  'w0-25-heavy-lifting': {
    headline: 'Switch the LED strip with a MOSFET.',
    tip: 'IRLZ44N pins facing you: G, D, S. The gate goes to column 10, the drain to the LEDs, the source to ground.',
    picture: 'transistor',
    skill: 'Wire a MOSFET switch, with its gate pull-down, the right way round.',
    realLife: 'LED strips, motors, heaters and e-bike controllers are switched by MOSFETs: no gate current, tiny losses.',
  },
  'w1-10-diode-or': {
    headline: 'Let either bell button ring the chime.',
    tip: 'A diode from each switch line into the chime line: band towards column 12.',
    picture: 'or',
    skill: 'Combine signals with diodes so they can’t feed each other.',
    realLife: 'Diode-OR feeds one circuit from USB or battery safely, and stops ghost key presses in keyboards.',
  },
  'w1-11-chip-inverter': {
    headline: 'Light the porch when the daylight switch is off.',
    tip: 'Gate 1 of the 74HC04: in on pin 1 (column 10), out on pin 2 (column 11).',
    picture: 'not',
    skill: 'Use a logic chip’s inverter, wiring it by pin number.',
    realLife: 'Inverters flip active-low enable and reset signals on almost every circuit board.',
  },
  'w1-12-and-from-nand': {
    headline: 'Make AND from two NAND gates.',
    tip: 'Gate 2 has its inputs tied: it’s an inverter. NAND then NOT is AND.',
    picture: 'nand',
    skill: 'Build any gate from NANDs, starting with AND.',
    realLife: 'Designers use one chip type for several jobs to save parts; whole computers have been built from NANDs alone.',
  },
  'w1-13-or-from-nand': {
    headline: 'Make OR from three NAND gates.',
    tip: 'NAND of the two inverted inputs is OR (De Morgan). Pins 9 and 10 are on the bottom row.',
    picture: 'or',
    skill: 'Use De Morgan’s law to swap AND and OR with inverters.',
    realLife: 'De Morgan’s law is how engineers rearrange logic onto fewer chips, and how active-low signals are combined.',
  },
  'w1-14-same-or-different': {
    headline: 'Light the LED when both switches match.',
    tip: 'XOR with a 1 is NOT. Tie pin 5 to + so gate 2 flips the XOR into XNOR.',
    picture: 'xor',
    skill: 'Make an equality test from XOR, and tie off unused inputs.',
    realLife: 'Comparators in CPUs and network chips test equality bit by bit with XNOR gates.',
  },
  'w1-15-odd-one-out': {
    headline: 'Light the LED for an odd number of switches.',
    tip: 'XOR is 1 when its inputs differ. Chain gate 1 into gate 2 to fold in the third switch.',
    picture: 'xor',
    skill: 'Compute a parity bit with chained XORs.',
    realLife: 'Serial links, ECC memory and RAID disks use parity to spot data that got flipped on the way.',
  },
  'w1-16-burglar-alarm': {
    headline: 'Sound the siren when armed and opened.',
    tip: 'Brackets first: the OR makes “door or window”, then the AND needs ARM too.',
    picture: 'and',
    skill: 'Turn a spec written in words into logic gates.',
    realLife: 'Alarm panels, lift interlocks and machine guards all start as a sentence like this, then become gates or code.',
  },
  'w1-17-majority-vote': {
    headline: 'Trip when two of three sensors agree.',
    tip: 'AB + BC + AC: three ANDs into ORs. C must reach gate 3 too.',
    picture: 'and',
    skill: 'Turn any truth table into ANDs and ORs (a sum of products).',
    realLife: 'Aircraft, rockets and safety systems vote 2-out-of-3 so one bad sensor can’t cause a trip or hide a fault.',
  },
  'w1-18-pick-one': {
    headline: 'Choose A or B with the select switch.',
    tip: 'Gates 2 and 3 each pass one input when it’s selected; gate 4 joins them.',
    picture: 'nand',
    skill: 'Build a multiplexer that selects one of two signals.',
    realLife: 'CPUs route data through multiplexers, and boards use them to read many sensors from one pin.',
  },
  'w1-19-one-of-four': {
    headline: 'Light exactly one LED for each address.',
    tip: 'Each output ANDs the inputs, plain or inverted. Y2 needs NOT A and B.',
    picture: 'binary',
    skill: 'Build a decoder that turns a binary address into one line.',
    realLife: 'Computers decode addresses to pick one memory chip, and controllers drive many outputs from a few pins this way.',
  },
  'w1-20-crack-the-code': {
    headline: 'Open the lock only for 1010.',
    tip: 'Bits that must be 0 go through inverters, then every condition is ANDed.',
    picture: 'and',
    skill: 'Compare inputs against a fixed code with inverters and ANDs.',
    realLife: 'Keypad locks, address matching and “is this packet for me” checks compare bits against a code like this.',
  },
  'w1-21-drive-it-harder': {
    headline: 'Light four LEDs from one logic output.',
    tip: 'A pin gives about 20 mA. Let Q1 carry the LEDs: base resistor from column 5 to column 21.',
    picture: 'chip',
    skill: 'Drive a load bigger than a logic pin can supply, with a transistor.',
    realLife: 'Relays, buzzers, motors and LED strips on Arduino projects are driven by a transistor from a pin.',
  },
  'w1-22-full-adder': {
    headline: 'Add three bits with sum and carry.',
    tip: 'COUT = A·B + Cin·(A ⊕ B): OR the two AND outputs together.',
    picture: 'adder',
    skill: 'Build a full adder and see how carries chain.',
    realLife: 'Every CPU adds numbers with chains of full adders, one per bit.',
  },
  'w1-23-hold-that-bit': {
    headline: 'Store one bit with a STORE button.',
    tip: 'Feedback makes memory: each NAND’s output into the other one’s input, on the bottom row.',
    picture: 'latch',
    skill: 'Build a D latch that stores a data bit when enabled.',
    realLife: 'Registers, buffers and memory in every computer are made of latches and flip-flops storing bits like this.',
  },
  'w1-24-traffic-lights': {
    headline: 'Show the right lights for each state.',
    tip: 'Green is on only in state 10: S1 AND NOT S0.',
    picture: 'binary',
    skill: 'Decode a state machine’s state into its outputs.',
    realLife: 'Traffic lights, washing machines and vending machines are state machines with output logic like this.',
  },
};

export function taskPage(l: LevelDef): TaskPage {
  const x = EXTRA[l.id] ?? { headline: l.brief.goal, tip: l.hints[0] ?? '', picture: 'led' as const, skill: '', realLife: '' };
  return {
    label: `LEVEL ${l.world}–${l.number}`,
    title: l.title.toUpperCase(),
    headline: x.headline,
    goal: l.brief.goal,
    story: l.brief.story,
    tip: x.tip,
    picture: x.picture,
    skill: x.skill,
    realLife: x.realLife,
    datasheet: l.brief.datasheet,
  };
}
