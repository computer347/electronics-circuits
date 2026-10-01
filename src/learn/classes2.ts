/**
 * Theory for World 0 levels 11–25 and World 1 levels 10–24: one class per level, each step a
 * technical explanation, the same idea in plain words, and (where there's a sum) the sum worked
 * through. Every number here is checked against the solver in tests/classes2.test.ts.
 */
import type { LearnClass } from './types';

// ============================================================== World 0, 11–25

const c11: LearnClass = {
  id: 'c0-11-leds-in-series', world: 0, number: 11, title: 'LEDs in series', levelId: 'w0-11-two-in-a-row', minutes: 5,
  goals: ['Add up forward voltages round a loop', 'Size one resistor for a string of LEDs', 'Know why strips run LEDs in threes'],
  steps: [
    {
      title: 'Voltages stack up in series',
      body: [
        'In a series loop there is one path, so one current flows through every part. Going round the loop, the voltages each part takes add up to the supply (Kirchhoff’s voltage law): `V_supply = V_R + V_LED1 + V_LED2`.',
        'Each lit red LED holds about **2.0 V**, nearly independent of its current. Two in series hold 4.0 V, so on 9 V the resistor is left with **5 V**.',
      ],
      plain: 'The battery’s push gets shared out along the line. Each LED keeps the same 2 V slice for itself; the resistor gets whatever is left over.',
      lab: { kind: 'pair', ohms: 330, mode: 'series' },
      tryThis: 'Switch between series and parallel: in series both LEDs get one current, and less of it.',
    },
    {
      title: 'One resistor for the whole string',
      body: [
        'Because the current is the same everywhere in the loop, the resistor sets it for every LED at once: `I = (V_supply − n × V_f) ÷ R`.',
        'Pick the current, then solve for R. Round to a standard value and check the current again.',
      ],
      calc: [
        'Left for the resistor: `9 V − 2 × 2.0 V = 5 V`',
        'For 15 mA: `R = 5 V ÷ 0.015 A = 333 Ω`, buy **330 Ω**',
        'Check: `5 V ÷ 330 Ω = 15.2 mA` through both LEDs',
      ],
      plain: 'Work out what the LEDs leave over, then divide by the current you want. One resistor does the job for the whole chain.',
    },
    {
      title: 'Why strips use 12 V and threes',
      body: [
        'Three LEDs at 3.0 V (white or blue) take 9 V; on a 12 V strip only 3 V is left for the resistor, so most of the power goes into light instead of heat.',
        'The catch: if one LED in a series string fails open, the loop breaks and **every** LED in it goes dark. That’s why a section of a strip goes out together.',
      ],
      plain: 'Putting LEDs in a row wastes less energy, but they live and die together: one broken LED and the whole row goes dark.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'Two red LEDs (2.0 V each) and 270 Ω in series on 9 V. What current flows?', answer: 5 / 270, unit: 'A', tolerancePct: 3,
      explain: 'The resistor gets 9 − 2 − 2 = 5 V, so I = 5 V ÷ 270 Ω = 18.5 mA, through all three parts.' },
    { kind: 'number', prompt: 'Three red LEDs in series on 12 V. Which resistor gives 20 mA?', answer: 300, unit: 'Ω', tolerancePct: 2,
      explain: 'The LEDs take 3 × 2.0 = 6 V, leaving 6 V: R = 6 V ÷ 0.020 A = 300 Ω.' },
    { kind: 'choice', prompt: 'One LED in a series string burns out open. What happens to the others?', options: ['They get brighter', 'They all go dark', 'Nothing changes'], correct: 1,
      explain: 'In series there is only one path: break it anywhere and no current flows through any of them.' },
  ],
};

const c12: LearnClass = {
  id: 'c0-12-forward-voltages', world: 0, number: 12, title: 'Every colour has its own voltage', levelId: 'w0-12-mixed-colours', minutes: 5,
  goals: ['Know the forward voltage of each LED colour', 'Size a resistor per branch', 'Match brightness across colours'],
  steps: [
    {
      title: 'The colour sets the voltage',
      body: [
        'An LED’s colour comes from the energy each electron gives up crossing its junction, and that energy is its forward voltage. Bluer light carries more energy: **red 2.0 V, yellow 2.1 V, green 2.2 V, blue and white 3.0 V**.',
        'So for the same supply and resistor, a blue LED leaves less voltage for the resistor and gets less current.',
      ],
      plain: 'Blue light needs a bigger push than red light. A blue LED keeps more of the battery for itself, so less is left to drive current.',
      lab: { kind: 'led', volts: 9, ohms: 470 },
      tryThis: 'Note the current through the red LED with 470 Ω: the blue one would get 1 V less across the same resistor.',
    },
    {
      title: 'One resistor per branch',
      body: [
        'In parallel each branch sees the full supply, and each branch’s current is set by its own resistor: `R = (V_supply − V_f) ÷ I`.',
        'Never share one resistor between parallel LEDs of different colours: the lowest-voltage LED takes nearly all the current and the others stay dark.',
      ],
      calc: [
        'Red: `(9 − 2.0) V ÷ 470 Ω = 14.9 mA`',
        'Blue with the same 470 Ω: `(9 − 3.0) V ÷ 470 Ω = 12.8 mA`',
        'Blue with 390 Ω: `6 V ÷ 390 Ω = 15.4 mA`, a match',
      ],
      plain: 'Give every LED its own resistor, worked out for its own colour. Then they all get the current you chose.',
    },
    {
      title: 'Equal current isn’t quite equal brightness',
      body: [
        'Brightness follows current, but eyes are most sensitive to green: at the same current a green LED looks brightest and a red or blue one dimmer. Panels are tuned by eye after the sums, a few mA either way.',
      ],
      plain: 'Do the sums first, then trust your eyes: green looks brighter than red at the same current.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A blue LED (3.0 V) on 9 V should take 15 mA. Which resistor?', answer: 400, unit: 'Ω', tolerancePct: 2,
      explain: 'The resistor gets 9 − 3 = 6 V, and 6 V ÷ 0.015 A = 400 Ω (buy 390 Ω).' },
    { kind: 'number', prompt: 'A yellow LED (2.1 V) runs on 5 V through 150 Ω. What current flows?', answer: 2.9 / 150, unit: 'A', tolerancePct: 3,
      explain: '(5 − 2.1) V ÷ 150 Ω = 19.3 mA.' },
    { kind: 'choice', prompt: 'A red and a blue LED share one resistor, side by side. What happens?', options: ['Both light equally', 'The red one takes nearly all the current', 'The blue one takes nearly all the current'], correct: 1,
      explain: 'The red LED conducts at 2 V, so it holds the shared point at 2 V: too low for the blue one, which needs 3 V.' },
  ],
};

const c13: LearnClass = {
  id: 'c0-13-combining-resistors', world: 0, number: 13, title: 'Combining resistors', levelId: 'w0-13-make-do', minutes: 6,
  goals: ['Add resistors in series', 'Combine resistors in parallel', 'Make a value you don’t have'],
  steps: [
    {
      title: 'Series adds up',
      body: [
        'Resistors in a line carry the same current, and their voltages add, so their resistances add: `R = R₁ + R₂ + …`. The total is always **more** than the biggest one.',
      ],
      plain: 'Two resistors in a row are harder to get through than one: just add their values.',
      lab: { kind: 'pair', ohms: 470, mode: 'series' },
    },
    {
      title: 'Parallel gives less',
      body: [
        'Side by side, both see the same voltage and their currents add, so current gets through more easily: `1/R = 1/R₁ + 1/R₂`. For two, `R = R₁ × R₂ ÷ (R₁ + R₂)`. The total is always **less** than the smallest one.',
        'Two equal resistors in parallel give exactly half: 1 kΩ ∥ 1 kΩ = 500 Ω.',
      ],
      calc: [
        '`470 Ω ∥ 1 kΩ = 470 × 1000 ÷ (470 + 1000)`',
        '`= 470 000 ÷ 1470 = 320 Ω`',
        'LED current on 9 V: `7 V ÷ 320 Ω = 21.9 mA`',
      ],
      plain: 'Two resistors side by side are like two doors instead of one: more gets through, so together they count as a smaller resistor.',
      lab: { kind: 'pair', ohms: 470, mode: 'parallel' },
    },
    {
      title: 'Sharing the heat',
      body: [
        'Each resistor in a combination only carries part of the power, so two ¼ W resistors in parallel can take about ½ W. Repairers combine values both to hit a number and to handle more heat.',
      ],
      plain: 'Two small resistors working together can also cope with twice the heat of one.',
    },
  ],
  check: [
    { kind: 'number', prompt: '220 Ω and 330 Ω in series. Total?', answer: 550, unit: 'Ω', tolerancePct: 1, explain: 'Series adds: 220 + 330 = 550 Ω.' },
    { kind: 'number', prompt: 'Two 1 kΩ resistors in parallel. Total?', answer: 500, unit: 'Ω', tolerancePct: 1, explain: 'Equal resistors in parallel halve: 1000 × 1000 ÷ 2000 = 500 Ω.' },
    { kind: 'number', prompt: 'A red LED on 9 V through 470 Ω ∥ 1 kΩ. What current?', answer: 7 / (470000 / 1470), unit: 'A', tolerancePct: 3,
      explain: '470 ∥ 1000 = 320 Ω, and 7 V ÷ 320 Ω = 21.9 mA.' },
  ],
};

const c14: LearnClass = {
  id: 'c0-14-shorts', world: 0, number: 14, title: 'Short circuits', levelId: 'w0-14-bypassed', minutes: 5,
  goals: ['Say what a short circuit is', 'Spot one with the meter', 'Know what it does to the other parts'],
  steps: [
    {
      title: 'The path of least resistance',
      body: [
        'A **short** is a connection of (almost) zero resistance across a part. Current divides between parallel paths in inverse proportion to their resistance, so nearly all of it takes the short and the part gets nothing.',
        'The voltage across a shorted part is the current times the short’s resistance: practically **0 V**.',
      ],
      plain: 'If there’s a wire right next to a part, the electricity takes the easy road through the wire and skips the part completely.',
    },
    {
      title: 'Finding it with the meter',
      body: [
        'Measure across each part with the power on. A working LED shows about 2 V. **0 V across a part that should be working means its two ends are joined by something else.** Then follow the wires from each of its legs.',
      ],
      plain: 'Put the meter across the part. Zero volts on something that should be working means a sneaky wire is joining its two ends.',
      lab: { kind: 'led', volts: 9, ohms: 330, meter: true },
      tryThis: 'Read the voltage across the working LED: that’s what a healthy one shows.',
    },
    {
      title: 'What the short does upstream',
      body: [
        'With the LED shorted, the resistor gets all 9 V instead of 7 V, so more current flows and it runs hotter: `9 V ÷ 330 Ω = 27.3 mA`, about 0.25 W, right at a small resistor’s limit. Short the resistor too and the supply sees almost 0 Ω: that’s what blows fuses.',
      ],
      calc: ['Normal: `7 V ÷ 330 Ω = 21.2 mA`', 'LED shorted: `9 V ÷ 330 Ω = 27.3 mA`', 'Heat: `P = V × I = 9 V × 27.3 mA = 0.25 W`'],
      plain: 'A short doesn’t just switch one thing off. It makes everything else work harder, and sometimes that’s what starts a fire.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'The LED is dark and the meter reads 0 V across it, with the power on. What’s the likeliest fault?', options: ['The LED is backwards', 'Something shorts it out', 'The supply is off'], correct: 1,
      explain: 'A backwards LED would show the full voltage across it; 0 V means its legs are joined.' },
    { kind: 'number', prompt: 'With the LED shorted, what current flows through the 330 Ω resistor on 9 V?', answer: 9 / 330, unit: 'A', tolerancePct: 3,
      explain: 'All 9 V is across the resistor: 9 ÷ 330 = 27.3 mA.' },
    { kind: 'choice', prompt: 'Why is a short across the whole supply dangerous?', options: ['Almost nothing limits the current', 'The voltage goes up', 'It stores charge'], correct: 0,
      explain: 'I = V ÷ R with R near zero: the current is limited only by the battery itself, and it gets hot fast.' },
  ],
};

const c15: LearnClass = {
  id: 'c0-15-rails-continuity', world: 0, number: 15, title: 'Rails and broken loops', levelId: 'w0-15-dead-rail', minutes: 4,
  goals: ['Know which rails are connected to what', 'Trace a loop back to the supply', 'Find an open circuit with the meter'],
  steps: [
    {
      title: 'Current needs a complete loop',
      body: [
        'Current only flows round a **closed** loop from the supply’s + back to its −. Break the loop anywhere (a missing wire, a cracked joint) and the current is zero everywhere in it: an **open circuit**.',
        'In an open circuit no part drops any voltage, so the full supply appears across the break.',
      ],
      plain: 'Electricity has to get all the way round and back home. One gap anywhere, and nothing moves at all.',
    },
    {
      title: 'Rails are just long strips',
      body: [
        'A breadboard’s rails are long conductive strips. The top pair here is wired to the bench supply; the bottom pair (B+ and B−) is a **separate** strip until jumpers join it. On long boards each rail is even split in the middle.',
      ],
      plain: 'The long lines along the edges only carry power if something connects them to it. Don’t assume: check.',
    },
    {
      title: 'Finding the gap',
      body: [
        'Measure from the supply’s − to points along the return path. Wherever the meter suddenly shows the full supply voltage, you’ve crossed the gap: on one side is ground, on the other the circuit is floating up at +.',
      ],
      calc: [
        'No current flows, so every part drops `V = I × R = 0 × R = 0 V`',
        'So the far side of the gap sits at the full supply: `T− to B− = 9 V`',
        'Close the gap and the drops come back: `9 V = 6.9 V (R1) + 2.1 V (LED1)`',
      ],
      plain: 'Walk the meter along the path home. The spot where the reading jumps is where the gap is.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A loop is broken in one place. What current flows in the rest of it?', options: ['The usual current', 'Half the current', 'None'], correct: 2,
      explain: 'Current needs a complete loop: an open circuit anywhere stops it everywhere.' },
    { kind: 'choice', prompt: 'With the ground jumper missing, what does the meter show from T− to B−?', options: ['0 V', 'About the full 9 V', 'It depends on the LED colour'], correct: 1,
      explain: 'No current flows, so nothing drops any voltage: B− floats up at the + side, and the meter sees about 9 V across the gap.' },
    { kind: 'choice', prompt: 'Which rails does the bench supply power by itself here?', options: ['Only the top pair', 'Only the bottom pair', 'All four'], correct: 0,
      explain: 'The bottom rails are separate strips: they’re only live through jumpers.' },
  ],
};

const c16: LearnClass = {
  id: 'c0-16-power-budget', world: 0, number: 16, title: 'Power and supply limits', levelId: 'w0-16-power-budget', minutes: 5,
  goals: ['Add branch currents into a total', 'Use P = V × I', 'Design inside a supply’s rating'],
  steps: [
    {
      title: 'Branch currents add up at the supply',
      body: [
        'Parallel branches each draw their own current, and the supply provides the sum (Kirchhoff’s current law): `I_total = I₁ + I₂ + I₃`.',
        'Three LEDs at 21 mA each need 63 mA from the supply, even though each one alone is modest.',
      ],
      plain: 'Every light you add takes its own share. The supply has to feed all of them at once, so the total is what counts.',
      lab: { kind: 'pair', ohms: 330, mode: 'parallel', budget: 0.045 },
    },
    {
      title: 'Power is volts times amps',
      body: [
        'Power is the rate energy is used: `P = V × I`. A supply is rated for a maximum current (or power); exceed it and the voltage sags, it overheats, or it shuts down.',
      ],
      calc: ['Budget per LED: `45 mA ÷ 3 = 15 mA`', 'Resistor for 12.5 mA: `7 V ÷ 0.0125 A = 560 Ω`', 'Total: `3 × 12.5 mA ≈ 37 mA`, `P = 9 V × 37 mA = 0.34 W`'],
      plain: 'Power is how hard the supply is working. Add it all up and stay under what the label on the adapter says.',
    },
    {
      title: 'Designing for battery life',
      body: [
        'Battery capacity is in mA·h: a 500 mA·h battery runs a 37 mA panel for about 13 hours, and a 63 mA one for under 8. Every milliamp you save is battery life.',
      ],
      plain: 'Less current means the battery lasts longer. Dimmer lights can mean a whole extra day.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'Three branches take 21.2, 20.9 and 20.6 mA. What does the supply give?', answer: 0.0627, unit: 'A', tolerancePct: 2,
      explain: 'Parallel currents add at the supply: 21.2 + 20.9 + 20.6 = 62.7 mA.' },
    { kind: 'number', prompt: 'A red LED should take 12.5 mA from 9 V. Which resistor?', answer: 560, unit: 'Ω', tolerancePct: 2, explain: '(9 − 2) V ÷ 0.0125 A = 560 Ω.' },
    { kind: 'choice', prompt: 'A 500 mA·h battery feeds a 50 mA load. About how long does it last?', options: ['1 hour', '10 hours', '100 hours'], correct: 1,
      explain: '500 mA·h ÷ 50 mA = 10 hours.' },
  ],
};

const c17: LearnClass = {
  id: 'c0-17-diodes', world: 0, number: 17, title: 'Diodes: one-way valves', levelId: 'w0-17-one-way', minutes: 5,
  goals: ['Read a diode’s band', 'Use the 0.7 V forward drop', 'Protect a circuit from a reversed battery'],
  steps: [
    {
      title: 'Forwards it conducts, backwards it blocks',
      body: [
        'A silicon diode conducts from its **anode** to its **cathode** (the end with the band) once it has about **0.7 V** across it, and blocks current the other way, up to its reverse rating (75 V for a 1N4148, 1000 V for a 1N4007).',
        'An LED is a diode too, with a bigger forward voltage, and it glows.',
      ],
      plain: 'A diode is a one-way door for electricity. The stripe shows the way out.',
    },
    {
      title: 'The price is 0.7 V',
      body: [
        'In series, a conducting diode keeps 0.7 V, and the rest of the loop shares what’s left: `I = (V − 0.7 − V_LED) ÷ R`.',
      ],
      calc: ['Without the diode: `(9 − 2.0) V ÷ 330 Ω = 21.2 mA`', 'With it: `(9 − 0.7 − 2.0) V ÷ 330 Ω = 19.1 mA`'],
      plain: 'The diode keeps a small slice of the voltage for itself, so the rest of the circuit gets a bit less.',
    },
    {
      title: 'Reverse-polarity protection',
      body: [
        'A diode in series with the supply means a reversed battery meets a blocked door: no current, no damage. Many battery gadgets have exactly this, or a MOSFET doing the same job with less loss.',
      ],
      plain: 'Put the battery in wrong and the diode just says no. Nothing flows, so nothing breaks.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A diode, a red LED and 330 Ω in series on 9 V. What current?', answer: 6.3 / 330, unit: 'A', tolerancePct: 3, explain: '(9 − 0.7 − 2.0) V ÷ 330 Ω = 19.1 mA.' },
    { kind: 'number', prompt: 'What voltage does a conducting silicon diode keep?', answer: 0.7, unit: 'V', tolerancePct: 5, explain: 'About 0.7 V across a silicon junction.' },
    { kind: 'choice', prompt: 'Which end of a diode is the cathode?', options: ['The end with the band', 'The end without the band', 'Either'], correct: 0, explain: 'The band marks the cathode, where current comes out.' },
  ],
};

const c18: LearnClass = {
  id: 'c0-18-rheostat', world: 0, number: 18, title: 'The potentiometer as a variable resistor', levelId: 'w0-18-turn-it-down', minutes: 5,
  goals: ['Name a potentiometer’s three legs', 'Use one end and the wiper as a variable resistor', 'Keep a safety resistor in series'],
  steps: [
    {
      title: 'A track and a wiper',
      body: [
        'A potentiometer is a resistive track (here 10 kΩ) between legs 1 and 3, with a sliding contact, the **wiper**, on leg 2. Between leg 1 and the wiper the resistance is `R_track × position`.',
      ],
      plain: 'Inside the knob is a strip of resistor with a little slider on it. Turning the knob moves the slider.',
    },
    {
      title: 'Two legs: a rheostat',
      body: [
        'Wired from one end to the wiper, the pot is a variable resistor (a **rheostat**) in series with the load: turning it changes the loop’s resistance and so the current.',
        'At 0 % it’s 0 Ω, so a fixed resistor in series is what keeps the LED safe at the bottom of the knob.',
      ],
      calc: ['Want 5 mA: `7 V ÷ 0.005 A = 1.4 kΩ` total', 'Minus the fixed 330 Ω: track ≈ 1.07 kΩ', 'Knob at 10 %: `10 kΩ × 0.1 = 1 kΩ`, giving `7 ÷ 1330 = 5.3 mA`'],
      plain: 'Turn the knob up and the electricity has further to squeeze through, so less flows and the light dims.',
      lab: { kind: 'ohm', volts: 7, ohms: 1330 },
    },
    {
      title: 'Where you meet it',
      body: ['Dimmers, fan speed controls and old volume knobs were rheostats. Modern ones usually use the pot as a divider (next level) to set a voltage that a chip reads, wasting no power.'],
      plain: 'Old dimmers worked exactly like this. New gadgets read the knob’s position with a chip instead.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'Knob at 30 % on a 10 kΩ pot, plus 330 Ω, red LED on 9 V. What current?', answer: 7 / 3330, unit: 'A', tolerancePct: 3, explain: 'Track 3 kΩ + 330 Ω = 3.33 kΩ, and 7 V ÷ 3.33 kΩ = 2.1 mA.' },
    { kind: 'number', prompt: 'Same circuit with the knob at 0 %. What current?', answer: 7 / 330, unit: 'A', tolerancePct: 3, explain: 'Only the 330 Ω is left: 7 ÷ 330 = 21.2 mA. Without it, the LED would burn.' },
    { kind: 'choice', prompt: 'Why keep the fixed 330 Ω in series with the pot?', options: ['To make it louder', 'So the LED survives the knob at 0 Ω', 'Pots need it to turn'], correct: 1, explain: 'At the end of its travel the pot is 0 Ω: the fixed resistor still limits the current.' },
  ],
};

const c19: LearnClass = {
  id: 'c0-19-pot-divider', world: 0, number: 19, title: 'The potentiometer as a divider', levelId: 'w0-19-set-the-level', minutes: 5,
  goals: ['Use all three legs to make an adjustable voltage', 'Work out the wiper voltage from the position', 'Read a knob with a microcontroller'],
  steps: [
    {
      title: 'A divider you can turn',
      body: [
        'With leg 1 on + and leg 3 on −, the wiper splits the track into a top and a bottom resistor: a voltage divider. The wiper sits at `V = V_supply × R_bottom ÷ R_track`.',
        'Here the position counts from leg 1, so the bottom part is `(1 − position) × R_track`, and `V_wiper = 9 V × (1 − position)`.',
      ],
      plain: 'Across the battery, the slider can tap off any voltage you like, from all of it down to none.',
      lab: { kind: 'divider', rTop: 4000, rBottom: 6000, target: [5.2, 5.6] },
      tryThis: 'Change the top and bottom resistors (always 10 kΩ in total) until the output hits 5.4 V.',
    },
    {
      title: 'Find the position',
      body: ['Turn the formula round: `position = 1 − V_wanted ÷ V_supply`. The current through the track is the same whatever the knob says (`9 V ÷ 10 kΩ = 0.9 mA`), so only the split changes, and the output moves in a straight line with the knob (a “linear” pot; audio pots follow a log curve instead).'],
      calc: ['`5.4 V ÷ 9 V = 0.6` of the track below the wiper', 'Position: `1 − 0.6 = 0.4`, the knob at 40 %'],
      plain: 'Work out what fraction of the battery you want, and leave that much of the strip below the slider.',
    },
    {
      title: 'Knobs that computers read',
      body: ['A microcontroller’s analog input measures the wiper voltage, so the knob becomes a number: 0–1023 on an Arduino. Joysticks are two of these, one per axis.'],
      plain: 'That’s how a game controller knows where its stick is: it’s two of these knobs, read as voltages.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A 10 kΩ pot across 9 V, knob at 25 % from leg 1. Wiper voltage?', answer: 6.75, unit: 'V', tolerancePct: 2, explain: '9 V × (1 − 0.25) = 6.75 V.' },
    { kind: 'number', prompt: 'A pot across 5 V, knob at 60 % from leg 1. Wiper voltage?', answer: 2, unit: 'V', tolerancePct: 2, explain: '5 V × (1 − 0.6) = 2.0 V.' },
    { kind: 'choice', prompt: 'Which leg is the wiper?', options: ['Leg 1', 'Leg 2, the middle one', 'Leg 3'], correct: 1, explain: 'The wiper is the middle leg; the outer two are the ends of the track.' },
  ],
};

const c20: LearnClass = {
  id: 'c0-20-sensor-divider', world: 0, number: 20, title: 'Reading a sensor with a divider', levelId: 'w0-20-wrong-sensor', minutes: 5,
  goals: ['Turn a resistance into a voltage', 'Pick the fixed resistor for best sensitivity', 'Know how a thermistor behaves'],
  steps: [
    {
      title: 'Sensors that change resistance',
      body: [
        'Many sensors are resistors that change with the world: an **NTC thermistor** loses resistance as it warms (10 kΩ at 25 °C, about 5 kΩ at 45 °C), a light-dependent resistor as it gets brighter.',
        'Pair the sensor with a fixed resistor in a divider and its resistance becomes a voltage: `V = V_supply × R_sensor ÷ (R_fixed + R_sensor)`.',
      ],
      plain: 'The sensor is a resistor that changes with temperature. Team it up with a normal resistor and the change shows up as a voltage you can measure.',
      lab: { kind: 'divider', rTop: 10000, rBottom: 10000, target: [4.3, 4.7] },
    },
    {
      title: 'Match the partner to the middle',
      body: ['The output changes fastest when the fixed resistor equals the sensor’s resistance in the middle of its range. Then the output sits at half the supply and swings both ways.'],
      calc: ['Matched (10 kΩ): `9 × 10 ÷ (10 + 10) = 4.5 V`', 'Wrong partner (1 kΩ): `9 × 10 ÷ (1 + 10) = 8.18 V`', 'Warmer (5 kΩ, 10 kΩ partner): `9 × 5 ÷ 15 = 3.0 V`'],
      plain: 'Use a partner resistor the same size as the sensor at normal temperature. Then the reading sits in the middle with room to move both ways.',
    },
    {
      title: 'From voltage to degrees',
      body: ['A microcontroller reads the voltage, works back to the sensor’s resistance, and then uses the thermistor’s datasheet curve to get the temperature.'],
      plain: 'A chip reads the voltage and looks up what temperature that means.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A 10 kΩ thermistor (to ground) with a 10 kΩ partner on 9 V. Output?', answer: 4.5, unit: 'V', tolerancePct: 2, explain: '9 × 10 ÷ 20 = 4.5 V.' },
    { kind: 'number', prompt: 'It warms up and the thermistor reads 5 kΩ. Output now?', answer: 3, unit: 'V', tolerancePct: 2, explain: '9 × 5 ÷ (10 + 5) = 3.0 V.' },
    { kind: 'number', prompt: 'With a wrong 1 kΩ partner and the thermistor at 10 kΩ, what’s the output?', answer: 9 * 10 / 11, unit: 'V', tolerancePct: 2, explain: '9 × 10 ÷ 11 = 8.18 V: squeezed up near the top.' },
  ],
};

const c21: LearnClass = {
  id: 'c0-21-loaded-divider', world: 0, number: 21, title: 'Dividers under load', levelId: 'w0-21-under-load', minutes: 6,
  goals: ['See how a load pulls a divider down', 'Combine the load with the bottom resistor', 'Trade stiffness against wasted current'],
  steps: [
    {
      title: 'The load joins the bottom resistor',
      body: ['Whatever draws current from a divider’s output is **in parallel with the bottom resistor**. The bottom half becomes `R_bottom ∥ R_load`, smaller than before, so the output drops.'],
      calc: ['Bottom: `10 kΩ ∥ 10 kΩ = 5 kΩ`', 'Output: `9 V × 5 ÷ (10 + 5) = 3.0 V`, not 4.5 V'],
      plain: 'Plugging something into the middle of a divider is like adding a second bottom resistor beside the first. The middle voltage sinks.',
      lab: { kind: 'divider', rTop: 10000, rBottom: 5000 },
    },
    {
      title: 'Stiff dividers',
      body: ['Make the divider’s resistors much smaller than the load (ten times or more) and the load hardly matters. The cost is current wasted through the divider all the time: `I = V ÷ (R_top + R_bottom)`.'],
      calc: ['1 kΩ ∥ 10 kΩ = 909 Ω', 'Output: `9 × 909 ÷ 1909 = 4.29 V`', 'Current: `9 V ÷ 1909 Ω = 4.7 mA`'],
      plain: 'Small resistors hold the voltage steady when something is plugged in, but they burn through the battery all day.',
    },
    {
      title: 'Or count the load in',
      body: ['If the load is known, design around it: 4.7 kΩ on top and 10 kΩ ∥ 10 kΩ = 5 kΩ below gives 4.6 V at under 1 mA. When the load changes, neither trick holds: that’s the job of a buffer amplifier or a regulator.'],
      plain: 'If you know what’s going to be plugged in, include it in your sums from the start.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'Two 10 kΩ across 9 V, with a 10 kΩ load on the output. Output voltage?', answer: 3, unit: 'V', tolerancePct: 2, explain: 'The bottom becomes 5 kΩ: 9 × 5 ÷ 15 = 3.0 V.' },
    { kind: 'number', prompt: 'Two 1 kΩ across 9 V, with the same 10 kΩ load. Output voltage?', answer: 9 * (10000 / 11) / (1000 + 10000 / 11), unit: 'V', tolerancePct: 2, explain: '1 kΩ ∥ 10 kΩ = 909 Ω: 9 × 909 ÷ 1909 = 4.29 V.' },
    { kind: 'number', prompt: 'How much current does that 1 kΩ / 1 kΩ divider (with its load) take from 9 V?', answer: 9 / (1000 + 10000 / 11), unit: 'A', tolerancePct: 2, explain: '9 V ÷ (1000 + 909) Ω = 4.7 mA.' },
  ],
};

const c22: LearnClass = {
  id: 'c0-22-caps-parallel', world: 0, number: 22, title: 'Capacitors side by side', levelId: 'w0-22-double-up', minutes: 5,
  goals: ['Add capacitors in parallel', 'Know what series capacitors do', 'Scale a time constant'],
  steps: [
    {
      title: 'Parallel capacitors add',
      body: ['Side by side, capacitors share one voltage and each holds its own charge (`Q = C × V`), so the total charge, and the capacitance, add up: `C = C₁ + C₂`. The opposite of resistors.'],
      plain: 'Two buckets side by side hold twice as much water. Two capacitors side by side hold twice as much charge.',
      lab: { kind: 'rc', ohms: 4700, farads: 200e-6, window: [0.85, 1.1] },
      tryThis: 'Watch it cross 63 % at about 0.94 s with 200 µF.',
    },
    {
      title: 'Twice the C, twice the time',
      body: ['The time constant `τ = R × C` scales with C, so doubling the capacitance doubles every delay the circuit makes.'],
      calc: ['One: `4.7 kΩ × 100 µF = 0.47 s`', 'Two in parallel: `4.7 kΩ × 200 µF = 0.94 s`'],
      plain: 'A bigger bucket takes longer to fill through the same pipe.',
    },
    {
      title: 'Series goes the other way',
      body: ['In series capacitors combine like resistors in parallel: two equal ones give **half** the capacitance, but can stand twice the voltage. Power supplies bank capacitors in parallel for more capacity and lower resistance.'],
      plain: 'Capacitors in a row hold less, not more. That trick is only for handling higher voltages.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A 4.7 kΩ resistor charges two 100 µF capacitors in parallel. τ?', answer: 0.94, unit: 's', tolerancePct: 2, explain: '200 µF × 4.7 kΩ = 0.94 s.' },
    { kind: 'number', prompt: 'Two 47 µF in parallel through 10 kΩ. τ?', answer: 0.94, unit: 's', tolerancePct: 2, explain: '94 µF × 10 kΩ = 0.94 s.' },
    { kind: 'choice', prompt: 'Two 100 µF capacitors in series make…', options: ['200 µF', '100 µF', '50 µF'], correct: 2, explain: 'In series, equal capacitors halve: 50 µF.' },
  ],
};

const c23: LearnClass = {
  id: 'c0-23-regulators', world: 0, number: 23, title: 'Voltage regulators', levelId: 'w0-23-regulated', minutes: 5,
  goals: ['Wire a three-pin regulator', 'Design for the regulated rail', 'Know where the extra voltage goes'],
  steps: [
    {
      title: 'A steady 5 V from anything higher',
      body: ['An **LM7805** is a linear regulator: it compares its output with an internal reference and adjusts a pass transistor so OUT stays at **5.0 V**, as long as IN is at least about 2 V higher (its dropout). Its pins, facing the print: **IN · GND · OUT**.'],
      plain: 'The regulator is a smart tap: it lets through exactly 5 V, however high the input is.',
    },
    {
      title: 'Design for 5 V, not 9 V',
      body: ['Everything after the regulator sees 5 V, so resistors are sized for 5 V: `R = (5 − V_LED) ÷ I`.'],
      calc: ['`(5 − 2.0) V ÷ 220 Ω = 13.6 mA`', 'The same 220 Ω on 9 V: `7 V ÷ 220 Ω = 32 mA` (burns)'],
      plain: 'After the regulator, pretend the battery is 5 V. Work your resistors out from that.',
      lab: { kind: 'led', volts: 5, ohms: 220 },
    },
    {
      title: 'The difference becomes heat',
      body: ['A linear regulator burns `(V_in − V_out) × I`: here `4 V × 13.6 mA = 54 mW`, nothing. At 1 A from 12 V it would be 7 W and need a heatsink. Switching regulators avoid most of that loss.'],
      plain: 'The extra voltage doesn’t vanish: it turns into heat in the regulator. Small loads, fine; big loads, it gets hot.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A red LED on the 5 V rail should take 15 mA. Which resistor?', answer: 200, unit: 'Ω', tolerancePct: 2, explain: '(5 − 2) V ÷ 0.015 A = 200 Ω.' },
    { kind: 'number', prompt: 'With 220 Ω on the 5 V rail, what current does the red LED take?', answer: 3 / 220, unit: 'A', tolerancePct: 3, explain: '3 V ÷ 220 Ω = 13.6 mA.' },
    { kind: 'choice', prompt: 'An LM7805’s pins, facing its print, are…', options: ['IN · GND · OUT', 'GND · IN · OUT', 'OUT · GND · IN'], correct: 0, explain: 'IN on the left, GND in the middle (also the tab), OUT on the right.' },
  ],
};

const c24: LearnClass = {
  id: 'c0-24-transistor-gain', world: 0, number: 24, title: 'Gain and saturation', levelId: 'w0-24-enough-gain', minutes: 6,
  goals: ['Find the base current a load needs', 'Drive a transistor into saturation', 'Respect a pin’s current limit'],
  steps: [
    {
      title: 'β × I_B is a ceiling',
      body: ['An NPN transistor lets through up to `I_C = β × I_B` from collector to emitter (β ≈ 200 for a BC547). If the load wants more, the transistor limits it, and the load runs dim.'],
      plain: 'The little base current is the transistor’s permission slip. It can only let through so many times that amount.',
    },
    {
      title: 'Saturate it',
      body: ['As a switch, you want the **load** to set the current, not the transistor. Give it 5–10 times the minimum base current and it saturates: fully on, with about 0.2 V across it.'],
      calc: ['Load: `3 × 14.5 mA ≈ 43 mA`', 'Minimum base current: `43 mA ÷ 200 = 0.22 mA`', 'With 10 kΩ: `(9 − 0.7) V ÷ 10 kΩ = 0.83 mA`, room for `200 × 0.83 mA = 166 mA`'],
      plain: 'Give the transistor plenty more permission than it needs. Then it’s simply on, and the lights decide how much flows.',
    },
    {
      title: 'But not too much',
      body: ['The base current comes from somewhere: a microcontroller pin gives a few mA at most. 1 kΩ would take 8.3 mA from it. Choose the largest base resistor that still saturates comfortably.'],
      plain: 'Too much base current wastes power and can hurt whatever is driving it. Aim for enough, with a margin.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'Base resistor 10 kΩ from 9 V. Base current?', answer: 8.3 / 10000, unit: 'A', tolerancePct: 3, explain: '(9 − 0.7) V ÷ 10 kΩ = 0.83 mA.' },
    { kind: 'number', prompt: 'With β = 200, what collector current can that base current allow at most?', answer: 200 * 8.3 / 10000, unit: 'A', tolerancePct: 3, explain: '200 × 0.83 mA = 166 mA.' },
    { kind: 'choice', prompt: 'A 47 kΩ base resistor, three LEDs wanting 43 mA in all. What happens?', options: ['They light fully', 'They all run dim', 'The transistor burns'], correct: 1,
      explain: '8.3 V ÷ 47 kΩ = 0.18 mA, allowing only 35 mA: shared by three, each is dim.' },
  ],
};

const c25: LearnClass = {
  id: 'c0-25-mosfets', world: 0, number: 25, title: 'MOSFETs', levelId: 'w0-25-heavy-lifting', minutes: 6,
  goals: ['Tell a MOSFET from a BJT', 'Wire G · D · S the right way round', 'Use a gate pull-down'],
  steps: [
    {
      title: 'Switched by voltage',
      body: ['An N-channel MOSFET conducts from **drain** to **source** when its **gate** is a few volts above the source (about 2 V for a logic-level IRLZ44N). The gate is insulated, so once charged it draws **no current**. Fully on, the channel is about 0.03 Ω.'],
      plain: 'A MOSFET is a switch you flip with voltage alone. It takes almost no effort to hold it on.',
    },
    {
      title: 'Pins and the body diode',
      body: ['TO-220 pins, facing the print: **G · D · S**. Every power MOSFET has a built-in **body diode** from source to drain. Fitted backwards, that diode conducts and the load can’t be switched off.'],
      plain: 'Get the legs in the right order. Backwards, a hidden diode inside lets the current through all the time.',
    },
    {
      title: 'The pull-down',
      body: ['An insulated gate holds its charge, so a gate left floating can stay on, or drift on by itself. A 10 kΩ resistor from gate to source drains it whenever nothing drives it high.'],
      calc: ['Each white LED: `(9 − 3.0) V ÷ 330 Ω = 18.2 mA`', 'Through the switch: `3 × 18.2 = 55 mA` with no base current needed'],
      plain: 'Always give the gate a resistor to ground, so it switches off properly when you let go.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A white LED (3.0 V) and 330 Ω on 9 V, switched by a MOSFET. Current?', answer: 6 / 330, unit: 'A', tolerancePct: 3, explain: '(9 − 3) V ÷ 330 Ω = 18.2 mA.' },
    { kind: 'choice', prompt: 'How much current does a MOSFET’s gate draw once it’s on?', options: ['About β times less than the load', 'Practically none', 'The same as the load'], correct: 1, explain: 'The gate is insulated: it only takes a brief charge to switch.' },
    { kind: 'choice', prompt: 'An IRLZ44N fitted backwards (S where D should be). The load…', options: ['never lights', 'stays on all the time', 'works normally'], correct: 1, explain: 'The body diode from source to drain conducts, so the load is never switched off.' },
  ],
};

export const WORLD0_MORE: LearnClass[] = [c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23, c24, c25];

// ============================================================== World 1, 10–24

const d10: LearnClass = {
  id: 'c1-10-diode-logic', world: 1, number: 10, title: 'Diode logic', levelId: 'w1-10-diode-or', minutes: 5,
  goals: ['Build OR from diodes', 'Keep two signals from feeding each other', 'Account for the diode drop'],
  steps: [
    {
      title: 'Two one-way doors into one room',
      body: ['Each input reaches the output through a diode pointing into it. Any input that’s high lifts the output (minus 0.7 V), and the diodes stop the high input from feeding back into the low one. That’s an OR gate.'],
      plain: 'Each switch can send current into the shared line, but nothing can come back out. So either switch works, and they never mix.',
      lab: { kind: 'logic', gate: 'OR' },
    },
    {
      title: 'Why wires won’t do',
      body: ['Joining the inputs with plain wires makes them one node: switching A on drives B’s line high too, so B’s indicator lights. Diodes **isolate** the inputs from each other.'],
      plain: 'Wires connect both ways, so the two switches would end up talking to each other. Diodes only go one way.',
    },
    {
      title: 'The cost: 0.7 V per stage',
      body: ['Each diode drops 0.7 V, so diode logic loses voltage at every stage and can’t be chained far. Real logic chips restore full levels at every gate.'],
      calc: ['OUT LED: `(9 − 0.7 − 2.2) V ÷ 1 kΩ = 6.1 mA`'],
      plain: 'Each diode nibbles a little voltage. Fine for one step, but you can’t stack many.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'One input high at 9 V: diode, 1 kΩ and a green LED (2.2 V). OUT LED current?', answer: 6.1 / 1000, unit: 'A', tolerancePct: 3, explain: '(9 − 0.7 − 2.2) V ÷ 1 kΩ = 6.1 mA.' },
    { kind: 'choice', prompt: 'Which way do the diodes point?', options: ['From each input into the output', 'From the output into each input', 'One each way'], correct: 0, explain: 'Anode on the input, band (cathode) on the shared output line.' },
    { kind: 'choice', prompt: 'Diodes from two inputs into one output, with a pull-down: what gate is it?', options: ['AND', 'OR', 'XOR'], correct: 1, explain: 'Either high input pulls the output high: OR.' },
  ],
};

const d11: LearnClass = {
  id: 'c1-11-inverter-chip', world: 1, number: 11, title: 'The inverter chip', levelId: 'w1-11-chip-inverter', minutes: 4,
  goals: ['Read the 74HC04 pinout', 'Use an inverter on an active-low signal', 'Count pins from the notch'],
  steps: [
    {
      title: 'Six NOTs in one package',
      body: ['The 74HC04 holds six inverters: inputs on pins 1, 3, 5, 9, 11, 13 and outputs on pins 2, 4, 6, 8, 10, 12. VCC is pin 14, GND pin 7, like the other 74HC chips.'],
      plain: 'One little chip, six “opposite” machines. Feed one a 1 and it gives a 0.',
      lab: { kind: 'logic', gate: 'NOT' },
    },
    {
      title: 'Pin 1 by the notch',
      body: ['Seen from above with the notch on the left, pins 1–7 run left to right along the bottom row and 8–14 come back right to left along the top. Pin 2, gate 1’s output, is right next to pin 1.'],
      plain: 'Find the notch, start counting at 1 next to it, and go anticlockwise round the chip.',
    },
    {
      title: 'Active-low signals',
      body: ['Many chips have inputs that act when pulled **low** (shown with a bar: RESET̄, EN̄). An inverter turns your “1 means go” into their “0 means go”.'],
      calc: ['Output high (5 V) into 330 Ω and a red LED: `(5 − 2) V ÷ (330 + 50) Ω ≈ 7.9 mA` (50 Ω is the output’s own resistance)'],
      plain: 'Some chips do things when you send them a 0. The inverter swaps your signal round to suit them.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'On a 74HC04, which pin is gate 1’s output?', options: ['Pin 2', 'Pin 3', 'Pin 14'], correct: 0, explain: 'Gate 1 takes pin 1 in and gives pin 2 out.' },
    { kind: 'number', prompt: 'A 74HC output at 5 V (50 Ω inside) drives 330 Ω and a red LED. Current?', answer: 3 / 380, unit: 'A', tolerancePct: 5, explain: '(5 − 2) V ÷ (330 + 50) Ω = 7.9 mA.' },
    { kind: 'choice', prompt: 'Input high, what’s the inverter’s output?', options: ['High', 'Low', 'It floats'], correct: 1, explain: 'NOT 1 = 0.' },
  ],
};

const d12: LearnClass = {
  id: 'c1-12-universal-nand', world: 1, number: 12, title: 'NAND can do anything', levelId: 'w1-12-and-from-nand', minutes: 5,
  goals: ['Make NOT from NAND', 'Make AND from two NANDs', 'Know why NAND is called universal'],
  steps: [
    {
      title: 'NAND with its inputs tied is NOT',
      body: ['Tie both inputs together and a NAND sees A, A: `NAND(A, A) = NOT (A AND A) = NOT A`.'],
      plain: 'Give a NAND the same thing on both inputs and it simply flips it.',
      lab: { kind: 'logic', gate: 'NAND' },
    },
    {
      title: 'NOT after NAND is AND',
      body: ['`NOT (NAND(A, B)) = A AND B`: one NAND, then a second NAND wired as an inverter. Two of the chip’s four gates make one AND.'],
      plain: 'NAND is “not AND”. Flip it once more and you’re back to AND.',
    },
    {
      title: 'Universal',
      body: ['NOT, AND, OR, XOR and every other function can be built from NANDs alone (NOR too). Chip makers love it: one transistor arrangement, copied millions of times.'],
      plain: 'With enough NAND gates you can build any logic at all, even a whole computer.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A NAND with both inputs on A gives…', options: ['A', 'NOT A', 'Always 1'], correct: 1, explain: 'NAND(A, A) = NOT A.' },
    { kind: 'choice', prompt: 'How many NAND gates make one AND?', options: ['1', '2', '4'], correct: 1, explain: 'One NAND, then one NAND as an inverter.' },
    { kind: 'choice', prompt: 'SA on, SB off. What does the NAND–NOT chain (AND) show?', options: ['Lit', 'Dark'], correct: 1, explain: 'AND needs both: 1 AND 0 = 0.' },
  ],
};

const d13: LearnClass = {
  id: 'c1-13-de-morgan', world: 1, number: 13, title: 'De Morgan’s law', levelId: 'w1-13-or-from-nand', minutes: 5,
  goals: ['State De Morgan’s laws', 'Build OR from three NANDs', 'Move inverters around a circuit'],
  steps: [
    {
      title: 'Flip everything, swap AND and OR',
      body: ['De Morgan’s laws: `NOT (A AND B) = (NOT A) OR (NOT B)` and `NOT (A OR B) = (NOT A) AND (NOT B)`. Inverting the inputs and the output turns an AND into an OR.'],
      plain: '“Not both” means the same as “one of them isn’t”. Swapping AND for OR works as long as you flip everything.',
    },
    {
      title: 'OR from NANDs',
      body: ['`NAND(NOT A, NOT B) = NOT (NOT A AND NOT B) = A OR B`. Two NANDs as inverters on the inputs, one more to combine: three gates.'],
      plain: 'Flip both inputs, then feed them to a NAND: out comes OR.',
      lab: { kind: 'logic', gate: 'OR' },
    },
    {
      title: 'Bubble pushing',
      body: ['Engineers draw inverters as little circles (“bubbles”) and push them across gates using De Morgan, cancelling pairs. It’s how a design is squeezed onto fewer chips.'],
      plain: 'Two flips cancel out. Designers slide them around to use fewer parts.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'NOT (A AND B) equals…', options: ['NOT A AND NOT B', 'NOT A OR NOT B', 'A OR B'], correct: 1, explain: 'De Morgan: invert the inputs and swap AND for OR.' },
    { kind: 'choice', prompt: 'NAND(NOT A, NOT B) equals…', options: ['A AND B', 'A OR B', 'A XOR B'], correct: 1, explain: 'NOT(NOT A AND NOT B) = A OR B.' },
    { kind: 'choice', prompt: 'How many NAND gates make an OR?', options: ['2', '3', '4'], correct: 1, explain: 'Two to invert the inputs, one to combine.' },
  ],
};

const d14: LearnClass = {
  id: 'c1-14-xnor', world: 1, number: 14, title: 'Equality, and unused inputs', levelId: 'w1-14-same-or-different', minutes: 5,
  goals: ['Use XNOR as an equality test', 'Make a controllable inverter from XOR', 'Never leave a CMOS input floating'],
  steps: [
    {
      title: 'XNOR: 1 when they match',
      body: ['XNOR is NOT XOR: 1 when both inputs are equal (00 or 11). Comparing two numbers bit by bit with XNORs, then ANDing the results, tests whether they’re equal.'],
      plain: 'XNOR answers “are these the same?” with a 1.',
      lab: { kind: 'logic', gate: 'XOR' },
      tryThis: 'Read the XOR column, then flip every answer: that’s XNOR.',
    },
    {
      title: 'XOR as a switchable inverter',
      body: ['`x XOR 0 = x` and `x XOR 1 = NOT x`. One input of an XOR decides whether the other passes straight or inverted. CPUs subtract this way: flip every bit, then add.'],
      plain: 'Hold one side of an XOR at 1 and it flips whatever comes in the other side. Hold it at 0 and it doesn’t.',
    },
    {
      title: 'Floating inputs',
      body: ['A CMOS input has almost infinite resistance: unconnected, it picks up any stray charge and can read 0, 1, or oscillate, drawing extra current. **Tie every unused input to VCC or GND**, directly or through a resistor.'],
      plain: 'An unplugged input has no idea what it should be, so it guesses. Always connect it to something.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A XNOR B with A = 1, B = 1 is…', options: ['0', '1'], correct: 1, explain: 'They match, so XNOR gives 1.' },
    { kind: 'choice', prompt: 'x XOR 1 equals…', options: ['x', 'NOT x', 'Always 1'], correct: 1, explain: 'XOR with 1 inverts.' },
    { kind: 'choice', prompt: 'What should you do with an unused CMOS input?', options: ['Leave it unconnected', 'Tie it to VCC or GND', 'Connect it to the output'], correct: 1, explain: 'A floating input can read anything; tie it to a fixed level.' },
  ],
};

const d15: LearnClass = {
  id: 'c1-15-parity', world: 1, number: 15, title: 'Parity: catching a flipped bit', levelId: 'w1-15-odd-one-out', minutes: 5,
  goals: ['Compute parity with XOR', 'Explain what a parity bit catches', 'Know where parity is used'],
  steps: [
    {
      title: 'XOR counts odd',
      body: ['Each XOR flips its result once for every input that’s 1, so a chain `A ⊕ B ⊕ C ⊕ …` is 1 exactly when an **odd** number of inputs are 1.'],
      plain: 'Chained XORs answer one question: is the number of switches turned on odd?',
      lab: { kind: 'logic', gate: 'XOR' },
    },
    {
      title: 'The parity bit',
      body: ['A sender adds one extra bit so the total count of 1s is even (even parity). If any single bit flips on the way, the receiver counts an odd total and knows the data is damaged.'],
      calc: ['Data 1011: three 1s, odd', 'Even-parity bit: 1, sent as 1011 1', 'One bit flipped (1001 1): three 1s, odd: error spotted'],
      plain: 'Add one extra bit to make the number of 1s even. If it arrives odd, something got scrambled.',
    },
    {
      title: 'Its limit',
      body: ['Two flipped bits cancel out, so simple parity misses them. Memory with ECC and RAID disks use cleverer codes built from the same XORs to find and even fix errors.'],
      plain: 'One parity bit spots one mistake. Two mistakes cancel out and slip past.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A ⊕ B ⊕ C with A = 1, B = 1, C = 1 is…', options: ['0', '1'], correct: 1, explain: 'Three 1s is odd: 1.' },
    { kind: 'choice', prompt: 'Data 0110, even parity. What’s the parity bit?', options: ['0', '1'], correct: 0, explain: 'Two 1s is already even, so the bit is 0.' },
    { kind: 'choice', prompt: 'Two bits flip on the way. Does simple parity catch it?', options: ['Yes', 'No'], correct: 1, explain: 'The count changes by two, staying even: it slips through.' },
  ],
};

const d16: LearnClass = {
  id: 'c1-16-words-to-gates', world: 1, number: 16, title: 'From words to gates', levelId: 'w1-16-burglar-alarm', minutes: 5,
  goals: ['Turn a sentence into a logic expression', 'Use brackets to order gates', 'Fill in a truth table from the spec'],
  steps: [
    {
      title: '“And”, “or”, “not”',
      body: ['Specs are written in words. Map them: “and” → AND, “or” → OR, “unless”/“not” → NOT. Group with brackets the way the sentence means it: “armed, and the door or window open” is `ARM · (DOOR + WINDOW)`.'],
      plain: 'Read the sentence slowly. Each “and”, “or” and “not” is a gate. The commas tell you which goes first.',
      lab: { kind: 'logic', gate: 'AND' },
    },
    {
      title: 'Brackets decide the wiring',
      body: ['The innermost bracket is the first gate: an OR makes `DOOR + WINDOW`, and its output feeds the AND with ARM. `ARM · DOOR + WINDOW` (no brackets) would sound the siren on an open window even when disarmed.'],
      plain: 'Whatever is in brackets gets its own gate first, and the result goes into the next gate.',
    },
    {
      title: 'Check against the table',
      body: ['Write all 8 rows for three inputs and mark which should sound. Only 101, 110 and 111 (ARM with door, window or both) give 1. Compare the circuit row by row.'],
      plain: 'List every possibility and tick the ones that should trigger. Then test them all.',
    },
  ],
  check: [
    { kind: 'choice', prompt: '“The light is on when it’s dark and someone is home or the timer is set.” As logic?', options: ['DARK · (HOME + TIMER)', '(DARK · HOME) + TIMER', 'DARK + HOME + TIMER'], correct: 0, explain: 'Dark AND (home OR timer): the bracket follows the sentence.' },
    { kind: 'choice', prompt: 'ARM = 0, DOOR = 1, WINDOW = 1. Siren?', options: ['On', 'Off'], correct: 1, explain: 'ARM AND anything is 0 when ARM is 0.' },
    { kind: 'choice', prompt: 'How many rows does a 3-input truth table have?', options: ['3', '6', '8'], correct: 2, explain: '2³ = 8 combinations.' },
  ],
};

const d17: LearnClass = {
  id: 'c1-17-sum-of-products', world: 1, number: 17, title: 'Any truth table as gates', levelId: 'w1-17-majority-vote', minutes: 6,
  goals: ['Write a sum of products from a truth table', 'Simplify it by spotting pairs', 'Explain majority voting'],
  steps: [
    {
      title: 'One AND per true row',
      body: ['For every row where the output is 1, write an AND of the inputs (inverted where they’re 0), then OR all those terms. This **sum of products** always works for any table.'],
      plain: 'Find every situation that should give a 1, make a gate that spots each one, then join them with OR.',
      lab: { kind: 'logic', gate: 'AND' },
    },
    {
      title: 'Simplify',
      body: ['Majority of three is 1 in rows 011, 101, 110 and 111. Combining neighbouring rows shrinks it to `AB + BC + AC`: three ANDs and an OR with three inputs (built as two 2-input ORs).'],
      calc: ['True rows: 011, 101, 110, 111', '`AB` covers 110 and 111 · `BC` covers 011, 111 · `AC` covers 101, 111', 'Result: `AB + BC + AC`'],
      plain: '“Any two agree” is three pairs: A and B, B and C, or A and C. Check each pair, and if any pair agrees, trip.',
    },
    {
      title: 'Voting for safety',
      body: ['With three sensors and majority voting, one faulty sensor (stuck at 0 or at 1) can never trip or block the system on its own. Aircraft flight computers and reactor protection use 2-out-of-3 voting.'],
      plain: 'If one of three sensors lies, the other two outvote it.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'Majority vote with A = 1, B = 0, C = 1?', options: ['0', '1'], correct: 1, explain: 'Two of three are 1: AC is true.' },
    { kind: 'choice', prompt: 'How many AND terms does the simplified majority function have?', options: ['2', '3', '4'], correct: 1, explain: 'AB, BC and AC.' },
    { kind: 'choice', prompt: 'One sensor is stuck at 1. Can it trip the cut-out by itself?', options: ['Yes', 'No'], correct: 1, explain: 'It needs a second sensor to agree.' },
  ],
};

const d18: LearnClass = {
  id: 'c1-18-multiplexer', world: 1, number: 18, title: 'Multiplexers', levelId: 'w1-18-pick-one', minutes: 6,
  goals: ['Describe what a multiplexer does', 'Write its expression', 'Build it from four NANDs'],
  steps: [
    {
      title: 'A digital selector switch',
      body: ['A 2-to-1 multiplexer passes input A when the select line S is 0 and input B when S is 1: `OUT = A · NOT S + B · S`.'],
      plain: 'Like a TV remote’s input button: the select switch decides which source gets through.',
    },
    {
      title: 'Four NANDs',
      body: ['Using De Morgan, `A · S̄ + B · S = NAND(NAND(A, S̄), NAND(B, S))`, and S̄ is one more NAND with its inputs tied: four gates, one 74HC00.'],
      calc: ['S = 0: `NAND(A, 1) = NOT A`, `NAND(B, 0) = 1`', 'Out: `NAND(NOT A, 1) = A`'],
      plain: 'Two gates each let one input through when it’s chosen. A last gate joins them.',
      lab: { kind: 'logic', gate: 'NAND' },
    },
    {
      title: 'Everywhere in a computer',
      body: ['Inside a CPU, multiplexers choose which register feeds the adder. On boards, an 8-to-1 mux (74HC151) lets one pin read eight buttons in turn.'],
      plain: 'Computers are full of these, picking which piece of data goes where.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'S = 1, A = 1, B = 0. OUT?', options: ['0', '1'], correct: 0, explain: 'S = 1 selects B, which is 0.' },
    { kind: 'choice', prompt: 'OUT = …', options: ['A · S + B · S', 'A · NOT S + B · S', 'A + B'], correct: 1, explain: 'A when S is 0, B when S is 1.' },
    { kind: 'choice', prompt: 'How many select lines does a 4-to-1 mux need?', options: ['1', '2', '4'], correct: 1, explain: 'Two bits choose one of four.' },
  ],
};

const d19: LearnClass = {
  id: 'c1-19-decoder', world: 1, number: 19, title: 'Decoders', levelId: 'w1-19-one-of-four', minutes: 5,
  goals: ['Explain one-hot outputs', 'Write each decoder output', 'Use a decoder to select a chip'],
  steps: [
    {
      title: 'Binary in, one line out',
      body: ['A 2-to-4 decoder has one output per input combination, exactly one of which is 1 (one-hot): `Y0 = Ā·B̄`, `Y1 = A·B̄`, `Y2 = Ā·B`, `Y3 = A·B`.'],
      plain: 'Give it a number, and it lights up the one matching lamp out of four.',
      lab: { kind: 'binary' },
    },
    {
      title: 'Building it',
      body: ['Invert each input once (one inverter each), then give each output its own AND of the right true/inverted inputs. n inputs make 2ⁿ outputs.'],
      plain: 'Make the opposite of each input, then use one AND gate per lamp, picking the versions it needs.',
    },
    {
      title: 'Address decoding',
      body: ['A computer’s address lines go through a decoder so only one memory chip responds to each address. The 74HC138 is a 3-to-8 decoder on one chip.'],
      plain: 'That’s how a computer picks which memory chip to talk to: the address is decoded into one “you!” line.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A = 1, B = 1. Which output lights?', options: ['Y0', 'Y1', 'Y3'], correct: 2, explain: 'Y3 = A · B.' },
    { kind: 'choice', prompt: 'How many outputs does a 3-input decoder have?', options: ['3', '6', '8'], correct: 2, explain: '2³ = 8.' },
    { kind: 'choice', prompt: 'Y2 = …', options: ['A · NOT B', 'NOT A · B', 'A · B'], correct: 1, explain: 'Y2 is address 10 in B A order: B = 1, A = 0.' },
  ],
};

const d20: LearnClass = {
  id: 'c1-20-comparator', world: 1, number: 20, title: 'Matching a code', levelId: 'w1-20-crack-the-code', minutes: 5,
  goals: ['Compare inputs against a fixed code', 'Chain 2-input ANDs into a 4-input AND', 'Count combinations'],
  steps: [
    {
      title: 'One AND of every condition',
      body: ['To match 1010, every bit must agree: `D3 · D̄2 · D1 · D̄0`. Bits that must be 0 go through an inverter first.'],
      plain: 'Every switch has to be exactly right. The ones that should be off get flipped, so “right” always means 1.',
      lab: { kind: 'logic', gate: 'AND' },
    },
    {
      title: 'A tree of ANDs',
      body: ['2-input gates combine pairs: `(D3 · D1) · (D̄2 · D̄0)`. Four conditions take three ANDs; eight would take seven. The order doesn’t matter: AND is associative.'],
      plain: 'Check two at a time, then check the two answers together.',
    },
    {
      title: 'How strong is it?',
      body: ['4 bits allow 2⁴ = 16 codes, so a guesser has a 1 in 16 chance. Each extra bit doubles the possibilities; a 4-digit PIN is 10 000.'],
      calc: ['4 switches: `2⁴ = 16` codes', '8 switches: `2⁸ = 256` codes'],
      plain: 'Sixteen possible codes is easy to guess. Every extra switch doubles the number.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'How many 2-input ANDs combine four conditions?', options: ['2', '3', '4'], correct: 1, explain: 'Two pairs, then one to join them.' },
    { kind: 'choice', prompt: 'How many codes can 4 switches set?', options: ['8', '16', '4'], correct: 1, explain: '2⁴ = 16.' },
    { kind: 'choice', prompt: 'Code 1010: which bits need inverters?', options: ['D3 and D1', 'D2 and D0', 'All four'], correct: 1, explain: 'The bits that must be 0: D2 and D0.' },
  ],
};

const d21: LearnClass = {
  id: 'c1-21-logic-drivers', world: 1, number: 21, title: 'Driving loads from logic', levelId: 'w1-21-drive-it-harder', minutes: 6,
  goals: ['Know a logic pin’s current limit', 'Size a base resistor from a 5 V output', 'Drive a big load with a transistor'],
  steps: [
    {
      title: 'Outputs are signals, not power',
      body: ['A 74HC output is good for about **20–25 mA** before its voltage sags and it heats up (the whole chip about 50 mA). An Arduino pin is similar. Four LEDs at 9 mA, or a relay coil, is too much.'],
      plain: 'A chip’s output can light one LED, but not a whole row of them. It’s a messenger, not a muscle.',
    },
    {
      title: 'Let a transistor carry it',
      body: ['The output drives the transistor’s base through a resistor; the transistor sinks the load current from the supply. `I_B = (5 − 0.7) V ÷ R_B`, and it must be enough for `β × I_B` to cover the load.'],
      calc: ['Load: `4 × 9 mA ≈ 36 mA`, needs `I_B ≥ 36 mA ÷ 200 = 0.18 mA`', '10 kΩ: `(5 − 0.7) V ÷ 10 kΩ = 0.43 mA`, room for 86 mA', '100 Ω would take about 29 mA from the pin: too much'],
      plain: 'The chip just taps the transistor on the shoulder. The transistor does the heavy work, with power straight from the supply.',
    },
    {
      title: 'Relays and motors',
      body: ['Coils and motors also need a diode across them (a flyback diode) to soak up the voltage spike when switched off. MOSFETs are the modern choice for big loads: no base current at all.'],
      plain: 'Big moving loads need a transistor too, plus a little diode to protect it when they switch off.',
    },
  ],
  check: [
    { kind: 'number', prompt: 'A 5 V logic output drives a base through 10 kΩ. Base current (ignore the output’s own resistance)?', answer: 4.3 / 10000, unit: 'A', tolerancePct: 3, explain: '(5 − 0.7) V ÷ 10 kΩ = 0.43 mA.' },
    { kind: 'number', prompt: 'How much base current does a β = 200 transistor need for a 36 mA load?', answer: 0.036 / 200, unit: 'A', tolerancePct: 3, explain: '36 mA ÷ 200 = 0.18 mA.' },
    { kind: 'choice', prompt: 'Roughly how much can one 74HC output safely give?', options: ['2 mA', '20 mA', '200 mA'], correct: 1, explain: 'About 20–25 mA per pin.' },
  ],
};

const d22: LearnClass = {
  id: 'c1-22-full-adder', world: 1, number: 22, title: 'The full adder', levelId: 'w1-22-full-adder', minutes: 6,
  goals: ['Add three bits with sum and carry', 'Chain adders into a multi-bit adder', 'Read COUT as majority'],
  steps: [
    {
      title: 'Three bits in',
      body: ['A full adder adds A, B and a carry in from the column to the right: `SUM = A ⊕ B ⊕ Cin`, `COUT = A·B + Cin·(A ⊕ B)`. COUT is 1 whenever at least two inputs are 1: it’s the majority function again.'],
      plain: 'Adding in columns, you have two digits plus whatever was carried. The full adder handles all three.',
      lab: { kind: 'adder' },
    },
    {
      title: 'Built from two half adders',
      body: ['The first half adder makes `P = A ⊕ B` and `A·B`; the second adds Cin to P. The two carries can never both be 1, so an OR combines them.'],
      calc: ['1 + 1 + 1: `P = 1 ⊕ 1 = 0`, `SUM = 0 ⊕ 1 = 1`', '`COUT = 1·1 + 1·0 = 1`: binary 11 = 3'],
      plain: 'Add the first two bits, then add the carry to that. If either step carries, carry it on.',
    },
    {
      title: 'Ripple carry',
      body: ['Chain n full adders, each COUT into the next Cin, and you add two n-bit numbers. The carry ripples from right to left, which takes time: fast CPUs predict carries instead (carry look-ahead).'],
      plain: 'Line them up, one per digit, and pass the carry along. That’s how a computer adds big numbers.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'A = 1, B = 0, Cin = 1. SUM and COUT?', options: ['SUM 0, COUT 1', 'SUM 1, COUT 0', 'SUM 1, COUT 1'], correct: 0, explain: '1 + 0 + 1 = 2 = binary 10.' },
    { kind: 'choice', prompt: 'How many full adders add two 8-bit numbers?', options: ['4', '8', '16'], correct: 1, explain: 'One per bit column.' },
    { kind: 'choice', prompt: 'COUT is 1 when…', options: ['exactly one input is 1', 'at least two inputs are 1', 'all inputs are 1'], correct: 1, explain: 'It’s the majority of the three.' },
  ],
};

const d23: LearnClass = {
  id: 'c1-23-d-latch', world: 1, number: 23, title: 'The D latch', levelId: 'w1-23-hold-that-bit', minutes: 6,
  goals: ['Gate an SR latch with an enable', 'Store a data bit', 'Tell a latch from a flip-flop'],
  steps: [
    {
      title: 'An SR latch with a door',
      body: ['Two extra NANDs gate the set and reset inputs with an enable E: `S̄ = NAND(D, E)`, `R̄ = NAND(D̄, E)`. With E = 0 both are 1, and the latch holds. With E = 1, D sets or resets it.'],
      plain: 'The STORE button opens a door. While it’s open, the memory copies the data switch; close it and the memory keeps what it saw.',
    },
    {
      title: 'Transparent while enabled',
      body: ['While E is 1, Q follows D continuously (the latch is “transparent”). When E drops, Q freezes. Because D and D̄ go to opposite sides, S and R can never both be active: no forbidden state.'],
      calc: ['D = 1, E = 1: `S̄ = 0`, `R̄ = 1`, so Q = 1', 'E = 0: `S̄ = R̄ = 1`: Q holds 1 whatever D does'],
      plain: 'Hold the button and the light follows the switch. Let go and it stays put.',
    },
    {
      title: 'Latches, flip-flops, registers',
      body: ['A flip-flop captures D only at the instant the clock **changes** (an edge), not the whole time it’s high. Eight of them make a register; registers are where CPUs keep the numbers they’re working on.'],
      plain: 'Put eight of these side by side and you can store a whole byte. Computers are full of them.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'E = 0, D changes from 1 to 0. Q…', options: ['follows D to 0', 'stays at 1', 'goes undefined'], correct: 1, explain: 'With E low the latch holds.' },
    { kind: 'choice', prompt: 'E = 1, D = 0. Q becomes…', options: ['0', '1'], correct: 0, explain: 'Enabled, Q copies D.' },
    { kind: 'choice', prompt: 'What makes a latch remember?', options: ['A capacitor', 'Outputs fed back into inputs', 'The pull-down resistors'], correct: 1, explain: 'The cross-coupled feedback holds the state.' },
  ],
};

const d24: LearnClass = {
  id: 'c1-24-state-decoding', world: 1, number: 24, title: 'States and outputs', levelId: 'w1-24-traffic-lights', minutes: 6,
  goals: ['Encode states in bits', 'Derive each output from a state table', 'Describe a finite-state machine'],
  steps: [
    {
      title: 'States as numbers',
      body: ['A controller with four states needs two bits: 00, 01, 10, 11. Here: 00 red, 01 red + amber, 10 green, 11 amber (the UK sequence).'],
      plain: 'Give each step of the sequence a number. Two switches can count to four.',
      lab: { kind: 'binary' },
    },
    {
      title: 'One column per light',
      body: ['Write the table with one column per output and read each column as a function of S1 S0: red is on in 00 and 01, so `RED = NOT S1`; amber in 01 and 11, so `AMBER = S0`; green only in 10, so `GREEN = S1 · NOT S0`.'],
      calc: ['RED: rows 00, 01 → `S̄1`', 'AMBER: rows 01, 11 → `S0`', 'GREEN: row 10 → `S1 · S̄0`'],
      plain: 'For each light, look at when it’s on and find the simplest rule that matches.',
    },
    {
      title: 'Finite-state machines',
      body: ['Add a register holding the state, and logic that computes the next state (here: count up) on each clock tick, and you have a finite-state machine: the brain of traffic lights, washing machines and vending machines.'],
      plain: 'Remember the current step, work out the next one, and decode the lights. That’s how simple machines are controlled.',
    },
  ],
  check: [
    { kind: 'choice', prompt: 'State 10 (S1 = 1, S0 = 0). Which light?', options: ['Red', 'Green', 'Amber'], correct: 1, explain: 'GREEN = S1 · NOT S0 = 1.' },
    { kind: 'choice', prompt: 'RED = …', options: ['S0', 'NOT S1', 'S1 · S0'], correct: 1, explain: 'Red is on in states 00 and 01: whenever S1 is 0.' },
    { kind: 'choice', prompt: 'How many bits for eight states?', options: ['2', '3', '8'], correct: 1, explain: '2³ = 8.' },
  ],
};

export const WORLD1_MORE: LearnClass[] = [d10, d11, d12, d13, d14, d15, d16, d17, d18, d19, d20, d21, d22, d23, d24];
