# SIGNAL PATH

**You are an electron. Get from the source to the sink, and learn how to build everything in between.**

A browser game for learning electronics: from Ohm's law and logic gates (the Aalto Digital Systems and Design core) through Arduino/ESP32 firmware, FPGA, analog, power, PCB layout and EMC. Circuits are really simulated, so broken designs fail the way real ones do: a reversed diode is a wall, a radiating trace pulls you off course.

![Skill map](docs/img/skill-map.png)

## Status

World 0 is playable on the 3D lab bench (below). The full spec lives in [`docs/SPEC.md`](docs/SPEC.md):

- Concept, core loop and game modes (Electron Run, Breadboard Bench, Schematic Lab, HDL Forge, Firmware IDE, PCB Studio, Instrument Bench)
- Theory classes with curated video segments and 2D exam-style drills
- Learning map, placement test and skip system
- Six-tier fault library, from wiring mistakes to signal integrity
- Visual direction (the spec's original black and phosphor green, since replaced by the riso front page and the 3D lab bench: see [`docs/design/desk-3d-brief.md`](docs/design/desk-3d-brief.md))
- Architecture and phased roadmap

## Style demos

[`docs/demos/`](docs/demos/) holds two standalone CRT oscilloscope demos (open in a browser): a CSS version and a WebGL phosphor shader version.

## Planned stack

Vite · React · TypeScript · React Three Fiber · GSAP · Web Workers running a real-time MNA solver, ngspice (WASM), avr8js / rp2040js and Yosys (YoWASP).

## Run it

Needs Node 20+.

```bash
npm install
npm run dev      # the game at http://localhost:5173
npm test         # solver test suite
npm run build    # typecheck + production build
```

## What's built

**Front page** (`src/app/FrontPage.tsx`): a risograph poster (paper, fluoro pink, blue and riso yellow overprinted, Anton + Space Mono). **Continue** sits you at the bench on the next level you haven't passed; **Play**, **Learn** and **Practice** open the bench on the level map, the notebook's Theory, or its practice page.

**The lab bench** (`src/desk/`): a warm 3D desk seen from your chair, lit by a desk lamp: antistatic mat and breadboard, bench power supply, multimeter, oscilloscope, soldering station, helping hands, parts drawers and spares, the lab book, and the level map on a corkboard. Whatever you pick comes into focus and the room dims; Esc or Back returns. A bench tour explains each object on your first visit.

**The level loop** (the same for every level): the notebook glows first (the task, drawn as the target circuit with one sentence), then the breadboard (build or fix, with a parts tray holding only the level's parts), then the meter (probe the board; Submit only unlocks after a measurement), then the bench supply's OUTPUT button and a dive into the board. A four-icon step rail shows where you are, and one blue button always says what's next. Hints cost the second star; spare LEDs are rationed; the result card spells out each star.

**Clear the circuit** (`src/circuitworld/`): inside the board, in first person. Corridors are the wires, rooms are the parts, under a blue fog. Walk, scan a room for the voltage on each side and whether anything flows, and fix what can be fixed from inside: a backwards LED is a one-way door facing you, turned round with a click. A missing part is a broken bridge (back to the bench), a burnt LED is a scorched room, branches sit in alcoves. Then the current runs round and each room lights up.

**Notebook** (Task, Theory, Math): Theory opens with part close-ups (a turning 3D model with numbered callouts: long leg, flat side, colour bands, stripe), then the level's lesson with live labs drawn in ink, then a check. Math has the formulas with every symbol explained, worked examples from the exam drills and practice questions with prefix-aware checking. Every number a lesson states is tested against the solver (`tests/learn.test.ts`).

**Instruments**: the multimeter's dial twists between OFF, V, Ω and A (A puts the meter in the circuit as a wire, so a short across the supply blows its fuse; Ω takes the sources out). The oscilloscope draws the live transient simulation (capacitors charge, generators swing) with time and volts knobs.

**Free bench**: the blue card on the corkboard. Every part (resistors, LEDs, wires, buttons, batteries, capacitors, a signal generator), example circuits, the scope, and a walk inside your own circuit. Nothing is scored.

**Circuit solver** (`src/sim/`): modified nodal analysis with ideal parts (resistors, sources with waveforms, wires, switches, diodes and LEDs, capacitors), DC and backward-Euler transient, fault detection (shorts, source conflicts, LED overcurrent and reverse voltage, floating nodes). Levels are JSON (`src/levels/world0/`) checked by the solver.

## Next up

Scripted replays in the lessons → World 1 (Kirchhoff, superposition, Thevenin/Norton, bridges) on the same bench → sound and settings. Details in [`docs/design/desk-3d-plan.md`](docs/design/desk-3d-plan.md).
