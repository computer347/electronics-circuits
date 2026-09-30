/**
 * World 0 theory: one class per level, teaching exactly what that level needs.
 * Every number in here is checked against the solver in tests/learn.test.ts.
 */
import type { LearnClass } from './types';

const c1: LearnClass = {
  id: 'c0-01-volts-amps-ohms',
  world: 0, number: 1,
  title: 'Voltage, current and resistance',
  levelId: 'w0-01-first-light',
  minutes: 6,
  goals: ['Tell voltage, current and resistance apart', "Use Ohm's law in all three forms", 'Size the resistor that keeps an LED alive'],
  steps: [
    {
      title: 'Three numbers describe every circuit',
      body: [
        "You're an electron. **Voltage** is how hard you're pushed round the loop, measured in volts (V). A 9 V battery lifts every electron that passes through it by 9 V, and the parts in the loop spend that 9 V on the way back.",
        '**Current** is how many electrons pass a point each second, in amps (A). Circuits on a breadboard run on milliamps: 20 mA is 0.020 A.',
        '**Resistance** is how hard a part makes it to get through, in ohms (Ω). More resistance means less current for the same push.',
      ],
      lab: { kind: 'ohm', volts: 9, ohms: 1000 },
      tryThis: 'Double the voltage and watch the current double. Then double the resistance and watch it halve.',
    },
    {
      title: "Ohm's law",
      body: [
        'Those three numbers are tied together by one rule: `V = I × R`. Rearranged, it answers whichever one you are missing: `I = V / R` and `R = V / I`.',
        'Example: 9 V across 330 Ω gives `I = 9 V / 330 Ω = 27.3 mA`.',
        'A resistor turns what it spends into heat: `P = I × V`. At 27.3 mA and 9 V that is about 0.25 W, which is exactly what a small breadboard resistor is rated for.',
      ],
      lab: { kind: 'ohm', volts: 9, ohms: 330 },
      tryThis: 'Find a resistor that lets exactly 9 mA through at 9 V.',
    },
    {
      title: 'What an LED does',
      body: [
        'An LED is a diode that glows. Once it conducts, it keeps a fixed slice of the voltage for itself, its **forward voltage** (Vf). For a red LED that is about **2.0 V**, whatever the current.',
        "Past that point the LED has almost no resistance of its own. Put it straight on 9 V and nothing limits the current: it flashes and burns out. That's why an LED always comes with a resistor in series.",
        'Red LEDs like about 20 mA. This one is rated for 25 mA continuous and burns above 30 mA.',
      ],
      lab: { kind: 'led', volts: 9, ohms: 100 },
      tryThis: 'Start at 100 Ω and work up until the LED survives. Where does it look right?',
    },
    {
      title: 'Sizing the resistor',
      body: [
        'The LED takes its 2.0 V, so the resistor gets the rest: `V_R = 9 V − 2.0 V = 7 V`.',
        'The resistor and the LED are in the same loop, so the same current passes through both. Pick the current you want and use Ohm\'s law on the resistor: `R = 7 V / 0.020 A = 350 Ω`.',
        "350 Ω isn't a value you can buy. Round to a real one: 330 Ω gives 21.2 mA and 390 Ω gives 17.9 mA. Both are inside the 10–25 mA that level 0–1 asks for.",
      ],
      lab: { kind: 'led', volts: 9, ohms: 330 },
      tryThis: 'Check 330 Ω and 390 Ω. Then try 1 kΩ: still safe, but is it bright enough?',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A red LED (2.0 V) runs from 12 V. Which resistor gives it 20 mA?', answer: 500, unit: 'Ω', tolerancePct: 2,
      explain: 'The resistor gets 12 − 2 = 10 V, and R = 10 V / 0.020 A = 500 Ω.' },
    { kind: 'number', prompt: 'A red LED and a 470 Ω resistor are on 9 V. What current flows?', answer: 7 / 470, unit: 'A', tolerancePct: 3,
      explain: 'The resistor gets 9 − 2 = 7 V, so I = 7 V / 470 Ω = 14.9 mA.' },
    { kind: 'choice', prompt: 'You put a 100 Ω resistor in front of a red LED on 9 V. What happens?',
      options: ['It glows normally at about 20 mA', 'It is dim, about 7 mA', 'About 70 mA flows and the LED burns out', 'No current flows'], correct: 2,
      explain: '7 V / 100 Ω = 70 mA, more than twice what the LED can take.' },
  ],
};

const c2: LearnClass = {
  id: 'c0-02-diodes-and-meters',
  world: 0, number: 2,
  title: 'Diodes and the multimeter',
  levelId: 'w0-02-wrong-way-round',
  minutes: 6,
  goals: ['Find the anode and the cathode', 'Measure voltages with the black probe on ground', 'Tell a blocking part from a working one by measuring'],
  steps: [
    {
      title: 'A one-way valve',
      body: [
        'A diode lets current through in one direction only: from the **anode** (+) to the **cathode** (−). On an LED the anode is the **long leg**. The cathode is the short leg, on the flat side of the rim.',
        'The right way round, it conducts once the anode is about Vf above the cathode. The wrong way round, it blocks completely: no current, no light, and nothing gets hot.',
      ],
      lab: { kind: 'led', volts: 5, ohms: 150, reversed: true, flip: true },
      tryThis: 'Flip the LED. Same parts, same wires, only the direction changed.',
    },
    {
      title: 'Measuring voltage',
      body: [
        'A multimeter on DC V shows the difference in voltage between its red probe and its black probe.',
        'Put the black probe on **ground** and leave it there. The red probe then reads the voltage at each point you touch, measured from ground. On the bench, ground is the blue top rail.',
        'A lit red LED fed through 150 Ω from 5 V: the resistor-side leg reads 2.0 V and the ground-side leg reads 0 V. The LED keeps 2.0 V and the resistor gets the other 3.0 V: `I = 3 V / 150 Ω = 20 mA`.',
      ],
      lab: { kind: 'led', volts: 5, ohms: 150, meter: true },
      tryThis: 'Read both LED legs. Their difference is the LED\'s own voltage.',
    },
    {
      title: 'Reading a dark LED',
      body: [
        'Now reverse it. No current flows anywhere in the loop. A resistor with no current through it has no voltage across it (`V = I × R = 0`), so the resistor-side leg sits at the **full 5 V**.',
        'The ground-side leg still reads 0 V. The whole supply is across the LED, and it passes nothing. That pattern means the part is **blocking**: it is in backwards, or the circuit is open inside it.',
        'Same idea anywhere: a part with the full supply across it and no current is the break in the loop.',
      ],
      lab: { kind: 'led', volts: 5, ohms: 150, reversed: true, meter: true, flip: true },
      tryThis: 'Compare the two meter readings reversed and forward.',
    },
    {
      title: 'Measure before you touch',
      body: [
        "In a find-the-fault level the board is someone else's. Resist rebuilding it. Two measurements, one on each leg of the suspect part, usually tell you what is wrong, and level 0–2's par is exactly 2 measurements.",
        'Then fix only that. On the bench you can flip an LED by right-clicking it and choosing Flip polarity.',
      ],
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A red LED is in backwards, fed through 150 Ω from 5 V. Black probe on ground, red probe on the leg joined to the resistor. What does the meter read?',
      options: ['0 V', '2.0 V', '3.0 V', '5.0 V'], correct: 3,
      explain: 'No current flows, so the resistor drops nothing and that leg sits at the full 5 V.' },
    { kind: 'choice', prompt: 'Which leg of an LED is the cathode?',
      options: ['The long leg', 'The short leg, on the flat side', 'Either, an LED works both ways', 'The one nearer the resistor'], correct: 1,
      explain: 'Anode is the long leg (+); cathode is the short leg on the flat side (−). Current flows anode → cathode.' },
    { kind: 'choice', prompt: 'You measure 0 V across a resistor in a loop that should be working. What does that tell you?',
      options: ['The resistor is shorted', 'No current is flowing through it', 'The supply is too high', 'Nothing, 0 V is normal'], correct: 1,
      explain: 'V = I × R. With R fixed, 0 V across it means I = 0: something else in the loop is blocking.' },
  ],
};

const c3: LearnClass = {
  id: 'c0-03-series-parallel',
  world: 0, number: 3,
  title: 'Series and parallel',
  levelId: 'w0-03-side-by-side',
  minutes: 7,
  goals: ['Know what series and parallel each share', 'Add up voltages round a loop and currents at a junction', 'Choose the layout that fits a current budget'],
  steps: [
    {
      title: 'Series: one path',
      body: [
        'In series, parts sit one after another on a single path. Every electron passes through all of them, so they all carry the **same current**.',
        'The voltages add up. Going round the loop, what the supply gives is what the parts spend (Kirchhoff\'s voltage law): `9 V = V_R + 2.0 V + 2.0 V` for a resistor and two red LEDs.',
      ],
      lab: { kind: 'pair', mode: 'series', ohms: 330 },
      tryThis: 'Notice LED1 and LED2 always show the same current in series.',
    },
    {
      title: 'Parallel: side by side',
      body: [
        'In parallel, each part has its own path between the same two rails. Each gets the **full voltage**, and each draws its own current.',
        'At the junction the currents add (Kirchhoff\'s current law): the supply delivers `I_1 + I_2`. Two LEDs at 15 mA each cost the supply 30 mA.',
        'Give every parallel LED its own resistor. If two LEDs share one resistor, the one with the slightly lower Vf takes most of the current.',
      ],
      lab: { kind: 'pair', mode: 'parallel', ohms: 470 },
      tryThis: 'Compare the supply current with the two LED currents.',
    },
    {
      title: 'Fitting a budget',
      body: [
        'Level 0–3 gives you 9 V and a 20 mA budget, and both LEDs need at least 12 mA. In parallel that is 24 mA or more: over budget, whatever resistors you pick.',
        'In series one current serves both LEDs, so 15 mA through both costs the supply only 15 mA. The price is voltage: two LEDs take 4.0 V, leaving 5 V for the resistor. `R = 5 V / 0.015 A ≈ 330 Ω`.',
        "Series only works while the voltages fit: three red LEDs on 5 V can't light, because they want 6 V before any current flows.",
      ],
      lab: { kind: 'pair', mode: 'series', ohms: 330, budget: 0.02 },
      tryThis: 'Switch between series and parallel and watch the budget bar.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'Two red LEDs in series with 330 Ω on 9 V. What current flows?', answer: 5 / 330, unit: 'A', tolerancePct: 3,
      explain: 'The LEDs take 2 × 2.0 = 4 V, the resistor gets 5 V: I = 5 V / 330 Ω = 15.2 mA through everything.' },
    { kind: 'choice', prompt: 'Two LED branches in parallel draw 15 mA each. How much does the supply deliver?',
      options: ['7.5 mA', '15 mA', '30 mA', 'It depends on the order'], correct: 2,
      explain: 'Currents add at a junction: 15 + 15 = 30 mA.' },
    { kind: 'choice', prompt: 'From a 5 V supply, what is the most red LEDs (2.0 V each) you can run in series with a resistor?',
      options: ['1', '2', '3', 'As many as you like'], correct: 1,
      explain: 'Two take 4 V and leave 1 V for the resistor. Three would need 6 V before any current flows.' },
  ],
};

const c4: LearnClass = {
  id: 'c0-04-dividers',
  world: 0, number: 4,
  title: 'Voltage dividers',
  levelId: 'w0-04-split-the-difference',
  minutes: 7,
  goals: ['Make any voltage below the supply with two resistors', 'Work out the current a divider wastes', 'Spot the wiring mistakes that break one'],
  steps: [
    {
      title: 'Two resistors share the voltage',
      body: [
        'Put two resistors in series from 9 V to ground. The same current flows through both, `I = 9 V / (R_top + R_bottom)`, and each takes `I × R` of the voltage. The bigger resistor takes the bigger share.',
        'The point between them, the **tap**, sits at whatever voltage the bottom resistor holds up. That is your new supply.',
      ],
      lab: { kind: 'divider', rTop: 1000, rBottom: 1000 },
      tryThis: 'Equal resistors split 9 V in half. Now make the bottom one smaller.',
    },
    {
      title: 'The divider formula',
      body: [
        'Combine the two lines above and you get `V_out = V × R_bottom / (R_top + R_bottom)`.',
        'For 3 V out of 9 V you want a third: `R_bottom / (R_top + R_bottom) = 1/3`, which means the top resistor is **twice** the bottom one.',
        'Only the ratio sets the voltage. 2 kΩ over 1 kΩ and 20 kΩ over 10 kΩ give the same 3 V.',
      ],
      lab: { kind: 'divider', rTop: 2200, rBottom: 1000, target: [2.8, 3.2] },
      tryThis: 'Get the tap inside 2.8–3.2 V with two different pairs.',
    },
    {
      title: 'What it costs',
      body: [
        'A divider draws current all the time, and all of it turns into heat. `I = 9 V / (R_top + R_bottom)`: 2.2 kΩ + 1 kΩ burns 2.8 mA.',
        'Level 0–4 allows 1 mA, so the total has to be at least 9 kΩ. 6.8 kΩ over 3.3 kΩ gives 2.94 V at 0.89 mA.',
        'Why not 6.8 MΩ over 3.3 MΩ? Anything you connect to the tap draws a little current and pulls the voltage down; the bigger the resistors, the more it sags. The sensor here is high-impedance (it draws almost nothing), so tens of kΩ is fine.',
      ],
      lab: { kind: 'divider', rTop: 6800, rBottom: 3300, target: [2.8, 3.2], maxAmps: 0.001 },
      tryThis: 'Keep the tap at 3 V and push the current under 1 mA.',
    },
    {
      title: 'Shapes that fail',
      body: [
        "If your tap reads a voltage you didn't expect, check the shape before the values:",
        '**Tap reads 9 V.** Something joins the tap straight to the supply (a stray jumper), or the tap is above both resistors.',
        '**Tap reads 6 V instead of 3 V.** The resistors are the right values but swapped: the big one is at the bottom.',
        '**Both resistors run rail to rail.** Each goes from 9 V to ground on its own: they are in parallel, and there is no point between them to tap.',
      ],
      lab: { kind: 'divider', rTop: 3300, rBottom: 6800, target: [2.8, 3.2] },
      tryThis: 'These are swapped. Fix them.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A divider on 9 V has R_top = 10 kΩ and R_bottom = 4.7 kΩ. What is V_out?', answer: 9 * 4700 / 14700, unit: 'V', tolerancePct: 1,
      explain: 'V_out = 9 V × 4.7k / (10k + 4.7k) = 2.88 V.' },
    { kind: 'number', prompt: 'And how much current does that divider draw?', answer: 9 / 14700, unit: 'A', tolerancePct: 2,
      explain: 'I = 9 V / 14.7 kΩ = 0.612 mA.' },
    { kind: 'choice', prompt: 'You wanted 3 V from 9 V but measure 6 V at the tap. Most likely?',
      options: ['A resistor is burnt', 'The two resistors are swapped', 'The supply is 18 V', 'The meter is on the wrong range'], correct: 1,
      explain: 'Swapping them gives V × 2/3 = 6 V instead of V × 1/3.' },
  ],
};

const c5: LearnClass = {
  id: 'c0-05-rc-timing',
  world: 0, number: 5,
  title: 'Capacitors and RC timing',
  levelId: 'w0-05-slow-blink',
  minutes: 7,
  goals: ['Describe how a capacitor charges', 'Use τ = R × C to set a delay', 'Read a charge curve on the scope'],
  steps: [
    {
      title: 'A capacitor fills up',
      body: [
        'A capacitor is two plates with a gap between them. Current flows onto one plate and off the other, but never across. As charge builds, so does the voltage across it.',
        'Charging through a resistor, it starts fast and slows down. At first the capacitor is empty and the resistor gets the whole supply, so the current is big. As the capacitor fills, less voltage is left for the resistor, so less current flows and it fills more slowly.',
      ],
      lab: { kind: 'rc', ohms: 10000, farads: 100e-6 },
      tryThis: 'Change R and C and watch the curve stretch or shrink.',
    },
    {
      title: 'The time constant',
      body: [
        'The shape of the curve never changes, only its width. That width is the **time constant**: `τ = R × C`. Ohms times farads gives seconds.',
        'After one τ the capacitor is at **63 %** of the way. After 2τ it is at 86 %, after 3τ at 95 %, and after 5τ it is as good as full.',
        'So a delay of about a second with 100 µF needs `R = 1 s / 0.0001 F = 10 kΩ`.',
      ],
      lab: { kind: 'rc', ohms: 10000, farads: 100e-6, window: [0.8, 1.2] },
      tryThis: 'Get the 63 % point inside the 0.8–1.2 s window with a different R and C.',
    },
    {
      title: 'The bleed resistor',
      body: [
        "Level 0–5 has a 100 kΩ **bleed** resistor across C1, so the capacitor empties when you let go of the button. While charging, it quietly takes some current too.",
        "Two effects, both small with 10 kΩ: C1 ends a little below the supply (`9 V × 100k / 110k = 8.2 V`), and it gets there a bit sooner, as if R were 10k ∥ 100k = 9.1 kΩ. τ = 0.91 s: still inside the window. The 63 % the level measures is of that final 8.2 V.",
      ],
      lab: { kind: 'rc', ohms: 10000, farads: 100e-6, bleed: true, window: [0.8, 1.2] },
      tryThis: 'Toggle the bleed resistor. Then try 47 kΩ with it on: the final voltage drops a lot.',
    },
    {
      title: 'Watching it on the scope',
      body: [
        "In the level, the scope's CH1 is already clipped to C1 at 500 ms per division. Hold SW1 and the trace climbs: one τ is where it crosses 63 % of its final height, about two divisions in for 1 s.",
        'Let go and it falls back through the bleed resistor, much more slowly, with τ = 100k × 100 µF = 10 s.',
      ],
    },
  ],
  check: [
    { kind: 'number', prompt: 'What is τ for 47 kΩ and 22 µF?', answer: 47000 * 22e-6, unit: 's', tolerancePct: 2,
      explain: 'τ = R × C = 47 000 Ω × 0.000022 F = 1.03 s.' },
    { kind: 'number', prompt: 'You want τ = 0.5 s with a 100 µF capacitor. Which R?', answer: 5000, unit: 'Ω', tolerancePct: 2,
      explain: 'R = τ / C = 0.5 s / 0.0001 F = 5 kΩ.' },
    { kind: 'choice', prompt: 'Roughly how full is a charging capacitor after 3τ?',
      options: ['33 %', '63 %', '86 %', '95 %'], correct: 3,
      explain: '63 % at 1τ, 86 % at 2τ, 95 % at 3τ.' },
  ],
};

const c6: LearnClass = {
  id: 'c0-06-currents-split',
  world: 0, number: 6,
  title: 'Currents split and join',
  levelId: 'w0-06-fork-in-the-road',
  minutes: 6,
  goals: ["Use Kirchhoff's current law at a junction", 'Work out each parallel branch on its own', 'Find a current from the voltage across a resistor'],
  steps: [
    {
      title: 'What flows in flows out',
      body: [
        'Current can\'t pile up anywhere or vanish, so at every junction **the current in equals the current out** (Kirchhoff\'s current law).',
        'In level 0–6 the supply\'s current splits at column 3: part of it through R1 and LED1, the rest through R2 and LED2. The two join again at the − rail and go back to the supply together.',
      ],
      lab: { kind: 'pair', mode: 'parallel', ohms: 330 },
      tryThis: 'Watch the supply current: it\'s always LED1\'s current plus LED2\'s.',
    },
    {
      title: 'Each branch on its own',
      body: [
        'Every parallel branch sees the whole 9 V, so you can work each one out as if the other weren\'t there.',
        'LED1 is red (2.0 V): `I_1 = (9 V − 2.0 V) / 330 Ω = 21.2 mA`. LED2 is green (2.2 V): `I_2 = (9 V − 2.2 V) / 330 Ω = 20.6 mA`.',
        'The supply delivers the sum: `21.2 mA + 20.6 mA = 41.8 mA`.',
      ],
    },
    {
      title: 'Current, measured as a voltage',
      body: [
        'A meter on A has to go **in series**, so you\'d have to break the loop to put it in. For a resistor there\'s a shortcut: measure the voltage across it and use Ohm\'s law.',
        'R2 drops 6.8 V either way. Across 330 Ω that\'s `6.8 V / 330 Ω = 20.6 mA`; across 3.3 kΩ it\'s only `6.8 V / 3300 Ω = 2.06 mA`. Same voltage, a tenth of the current: the value is wrong.',
        'Colour codes are easy to misread: **orange orange brown** is 330 Ω, **orange orange red** is 3.3 kΩ.',
      ],
    },
  ],
  check: [
    { kind: 'number', prompt: 'Two parallel branches carry 12 mA and 18 mA. How much current does the supply deliver?', answer: 0.03, unit: 'A', tolerancePct: 1,
      explain: 'Currents add at a junction: 12 + 18 = 30 mA.' },
    { kind: 'number', prompt: 'You measure 5 V across a 1 kΩ resistor. What current flows through it?', answer: 0.005, unit: 'A', tolerancePct: 1,
      explain: 'I = V / R = 5 V / 1000 Ω = 5 mA.' },
    { kind: 'choice', prompt: 'Which colours are a 3.3 kΩ resistor?', options: ['orange orange brown', 'orange orange red', 'red red orange', 'brown black red'], correct: 1,
      explain: 'Orange = 3, orange = 3, red = two zeros: 3300 Ω. Orange orange brown has one zero: 330 Ω.' },
  ],
};

const c7: LearnClass = {
  id: 'c0-07-switches',
  world: 0, number: 7,
  title: 'Switches and complete loops',
  levelId: 'w0-07-push-to-light',
  minutes: 5,
  goals: ['Explain why current needs a complete loop', 'Place a switch so it controls the whole series loop', 'Avoid the same-column mistake on a breadboard'],
  steps: [
    {
      title: 'No loop, no current',
      body: [
        'Current only flows round a **complete loop**, from the supply\'s + back to its −. A switch is a gap you control: closed, the loop is complete; open, it\'s broken.',
        'A push button is a switch you hold: closed while pressed, open when you let go. Held, the LED in level 0–7 gets `(9 V − 2.0 V) / 330 Ω = 21.2 mA`.',
      ],
      lab: { kind: 'led', volts: 9, ohms: 330 },
      tryThis: 'Every part of the loop matters: take the resistor to its extremes and see the current follow.',
    },
    {
      title: 'One gap stops everything',
      body: [
        'A series loop has only one path, so it doesn\'t matter where the switch sits: before the resistor or after the LED, opening it stops the current **everywhere** in the loop.',
        'That\'s why one switch can turn off a whole circuit, and why a single broken wire can too.',
      ],
    },
    {
      title: 'Across the gap, not along it',
      body: [
        'On a breadboard, the five holes of a column are one strip. Two legs in the same column are already joined, so a button placed that way joins nothing and pressing it does nothing.',
        'A switch, like any two-legged part, goes **across two different columns**: one leg each side of the gap it controls. And nothing else may bridge that gap, or the LED stays on whatever the button does.',
      ],
    },
  ],
  check: [
    { kind: 'choice', prompt: 'Where in a single series loop does a switch have to go to turn the LED off?', options: ['Next to the + supply', 'Right after the LED', 'Anywhere in the loop', 'In parallel with the LED'], correct: 2,
      explain: 'A series loop has one path: a gap anywhere in it stops the current everywhere.' },
    { kind: 'number', prompt: 'A red LED (2.0 V) and 330 Ω on 9 V, switched by a button. What current flows while it\'s held?', answer: 7 / 330, unit: 'A', tolerancePct: 2,
      explain: '(9 V − 2.0 V) / 330 Ω = 21.2 mA, the same as with no switch at all: a closed switch is just a wire.' },
    { kind: 'choice', prompt: 'A button is pushed in with both legs in the same column. What happens when you press it?', options: ['The LED lights', 'Nothing: the button joins nothing new', 'The LED burns out', 'The supply shorts'], correct: 1,
      explain: 'The column already joins its holes. The button has to span the gap between two columns.' },
  ],
};

const c8: LearnClass = {
  id: 'c0-08-cells-in-series',
  world: 0, number: 8,
  title: 'Cells in series',
  levelId: 'w0-08-stack-them-up',
  minutes: 5,
  goals: ['Add up cells in series', 'Spot a backwards cell with the meter', "Use Kirchhoff's voltage law round a battery-powered loop"],
  steps: [
    {
      title: 'Voltages stack up',
      body: [
        'Cells in series, each + to the next one\'s −, add their voltages: three 1.5 V AA cells make `1.5 + 1.5 + 1.5 = 4.5 V`.',
        'That\'s how a torch gets enough push for a blue or white LED, which needs about **3.0 V** just to start conducting. One AA cell (1.5 V) can\'t light it at all.',
      ],
    },
    {
      title: 'One backwards cell subtracts',
      body: [
        'A cell put in the wrong way round pushes against the others: `1.5 − 1.5 + 1.5 = 1.5 V`. Three new cells, and only half what the LED needs.',
        'Going round the loop, the pushes and the drops always balance (Kirchhoff\'s voltage law). With all three cells the right way: `4.5 V = 3.0 V (LED) + 1.5 V (resistor)`.',
      ],
    },
    {
      title: 'Walking the stack with the meter',
      body: [
        'Black probe on the − rail, red probe on each cell\'s + end in turn. A good stack climbs one cell at a time: **1.5 V, 3.0 V, 4.5 V**. A reading that falls back marks the backwards cell.',
        'Turned round, the resistor gets 1.5 V and sets the current: `(4.5 V − 3.0 V) / 100 Ω = 15 mA`.',
      ],
    },
  ],
  check: [
    { kind: 'number', prompt: 'Four 1.5 V cells in series, all the right way round. What voltage do they give?', answer: 6, unit: 'V', tolerancePct: 1,
      explain: '1.5 × 4 = 6 V.' },
    { kind: 'number', prompt: 'Three 1.5 V cells in series with one backwards. What voltage is left?', answer: 1.5, unit: 'V', tolerancePct: 1,
      explain: '1.5 + 1.5 − 1.5 = 1.5 V: the backwards cell cancels one of the others.' },
    { kind: 'choice', prompt: 'Can two AA cells (3.0 V) run a blue LED (3.0 V) through a resistor?', options: ['Yes, brightly', 'Barely, if at all: nothing is left for the resistor', 'Only without the resistor', 'Only in parallel'], correct: 1,
      explain: 'The LED takes the whole 3.0 V before any current flows, leaving nothing to push current through the resistor.' },
  ],
};

const c9: LearnClass = {
  id: 'c0-09-bridges',
  world: 0, number: 9,
  title: 'Bridges',
  levelId: 'w0-09-balance-the-bridge',
  minutes: 6,
  goals: ['See a bridge as two dividers', 'Balance it with equal ratios', 'Explain why sensors sit in bridges'],
  steps: [
    {
      title: 'Two dividers side by side',
      body: [
        'Each side of a Wheatstone bridge is a divider across the same supply. The left tap in level 0–9: `9 V × 2.2 kΩ / (1 kΩ + 2.2 kΩ) = 6.19 V`.',
        'The meter sits **between the two taps**, not from a tap to ground: it reads the difference between the two sides.',
      ],
      lab: { kind: 'divider', rTop: 1000, rBottom: 2200 },
      tryThis: 'Note the tap voltage: the other side of the bridge has to match it.',
    },
    {
      title: 'Balanced means equal ratios',
      body: [
        'The two taps sit at the same voltage when both sides divide the supply in the same ratio: `R2 / R1 = R4 / R3`.',
        'Here `R2 / R1 = 2.2`, and R3 is 10 kΩ, so `R4 = 2.2 × 10 kΩ = 22 kΩ`. Then both taps are at 6.19 V and the meter reads 0 V.',
      ],
      lab: { kind: 'divider', rTop: 10000, rBottom: 22000 },
      tryThis: 'Same tap voltage as the left side, from ten times bigger resistors.',
    },
    {
      title: 'Why sensors use bridges',
      body: [
        'Swap one resistor for a sensor whose resistance changes with something real (a strain gauge, a thermistor). At balance the meter reads zero, so the smallest change shows up as a small voltage starting from zero, easy to amplify.',
        'A lone divider would hide the same change as a tiny wobble on top of a 6 V reading.',
      ],
    },
  ],
  check: [
    { kind: 'number', prompt: 'A divider of two equal resistors across 9 V. What does its tap read?', answer: 4.5, unit: 'V', tolerancePct: 1,
      explain: 'Equal resistors split the supply in half: 9 V × 1 / 2 = 4.5 V.' },
    { kind: 'number', prompt: 'A bridge has R1 = 2 kΩ, R2 = 6 kΩ and R3 = 5 kΩ. What R4 balances it?', answer: 15000, unit: 'Ω', tolerancePct: 1,
      explain: 'R4 = R3 × R2 / R1 = 5 kΩ × 3 = 15 kΩ.' },
    { kind: 'choice', prompt: 'What does the meter across a balanced bridge read?', options: ['The supply voltage', 'Half the supply', '0 V', 'It depends on the meter'], correct: 2,
      explain: 'Balanced, both taps sit at the same voltage, so the difference between them is zero.' },
  ],
};

export const WORLD0_CLASSES: LearnClass[] = [c1, c2, c3, c4, c5, c6, c7, c8, c9];

export const classById = (id: string) => WORLD0_CLASSES.find((c) => c.id === id);
export const classForLevel = (levelId: string) => WORLD0_CLASSES.find((c) => c.levelId === levelId);
