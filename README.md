# SIGNAL PATH

**You are an electron. Get from the source to the sink, and learn how to build everything in between.**

A browser game for learning electronics: from Ohm's law and logic gates (the Aalto Digital Systems and Design core) through Arduino/ESP32 firmware, FPGA, analog, power, PCB layout and EMC. Circuits are really simulated, so broken designs fail the way real ones do: a reversed diode is a wall, a radiating trace pulls you off course.

![Skill map](docs/img/skill-map.png)

## Status

Design phase. The full spec lives in [`docs/SPEC.md`](docs/SPEC.md):

- Concept, core loop and game modes (Electron Run, Breadboard Bench, Schematic Lab, HDL Forge, Firmware IDE, PCB Studio, Instrument Bench)
- Theory classes with curated video segments and 2D exam-style drills
- Learning map, placement test and skip system
- Six-tier fault library, from wiring mistakes to signal integrity
- Visual direction (black and phosphor green, Three.js + GSAP)
- Architecture and phased roadmap

## Style demos

[`docs/demos/`](docs/demos/) holds two standalone CRT oscilloscope demos (open in a browser): a CSS version and a WebGL phosphor shader version.

## Planned stack

Vite · React · TypeScript · React Three Fiber · GSAP · Web Workers running a real-time MNA solver, ngspice (WASM), avr8js / rp2040js and Yosys (YoWASP).

## Run it

Needs Node 20+.

```bash
npm install
npm run dev      # drills + solver bench at http://localhost:5173
npm test         # solver test suite
npm run build    # typecheck + production build
```

## What's built

**Circuit solver** (`src/sim/`): modified nodal analysis in TypeScript with ideal parts.

- Parts: resistors, voltage and current sources, wires, switches, diodes, LEDs (by colour), capacitors
- DC operating point and transient steps (backward Euler) via `Simulator.step(dt)`, fast enough to run every frame
- Fault detection: short circuits, source conflicts, LED overcurrent and reverse overvoltage, floating nodes
- SPICE-like netlist format, e.g.

  ```
  V1 vcc 0 9
  R1 vcc a 330
  LED1 a 0 red
  ```

- `tests/`: textbook circuits checked against hand-calculated answers (dividers, bridges, LEDs, RC charge/discharge, energy conservation)

**Schematics** (`src/schematic/`): 2D SVG circuit drawings with IEC symbols. Parts sit between grid points and connect where they meet; the netlist is derived from the drawing, so the picture and the simulation always agree.

**Exam drills** (`src/drills/`): nine question generators (Ohm's law, series and parallel, dividers, LED resistor sizing, RC charging, Wheatstone bridges, current sources) with random standard values, prefix-aware answer checking (`21.2m`, `4.7k`) and worked solutions. Tests check that the solver and each worked-solution formula agree on 60 random circuits per generator.

**Breadboard bench** (`src/breadboard/`): a 3D half-size breadboard in React Three Fiber. Place jumper wires, resistors (with correct colour bands), LEDs, push buttons and batteries hole by hole, probe with a multimeter, and watch strips glow with their voltage. Breadboard wiring is modelled the real way (a–e / f–j strips, separate top and bottom rails), so classic mistakes like a resistor with both legs in one column show up. Overloaded LEDs burn out and stay dead until replaced. Click a part to change its value or colour; right-click to move it on its own or together with everything connected to it (wires stay plugged into the rails).

**Electron flow and ride** (Breadboard tab, **F** / **R**): every current path fills with moving charge, coloured by the source driving it and moving at a speed that follows the current. Where two sources share a wire, the colours mix in proportion to each one's share (superposition, `src/sim/superposition.ts`). Ride mode puts the camera on a single electron that picks its way through junctions weighted by current, slowing in resistors and LEDs, with a caption telling you where the energy goes. Click any part (or place the multimeter probes) to see its current or voltage broken down by source. Toggle conventional current to see + → − instead of electron flow.

**Solver bench** (`src/app/`): edit a netlist, see node voltages, currents and faults live, with a placeholder electron-flow strip in Three.js.

## Next up (Phase 0)

Oscilloscope with the phosphor shader → five World 0 levels → theory classes → landing page.
