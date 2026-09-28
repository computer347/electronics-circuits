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

- Parts: resistors, voltage and current sources (DC or square / sine / triangle waveforms), wires, switches, diodes, LEDs (by colour), capacitors
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

**Campaign** (Play tab, `src/levels/`): World 0, five levels, each unlocked by passing the one before.

| Level | Format | What you do |
| --- | --- | --- |
| 0–1 First light | Build | Pick the resistor that lights an LED at 10–25 mA without burning it |
| 0–2 Wrong way round | Find the fault | An LED that stays dark: measure it (par 2 measurements), find it's backwards, flip it |
| 0–3 Side by side | Build | Light two LEDs at ≥ 12 mA each on a 20 mA supply budget: only series fits |
| 0–4 Split the difference | Build | A 3.0 V ± 0.2 V reference from 9 V with a divider drawing ≤ 1 mA |
| 0–5 Slow blink | Build | Set an RC time constant of about 1 s and watch the charge curve on the scope |

Levels are plain JSON (`src/levels/world0/`): a starting board, faults injected into it (`reverse`, `value`, `move-leg`, `remove`), locked and pinned parts, a brief with a datasheet card, three hints, a spec the simulator checks (`led-current`, `voltage`, `supply-current`, `charge-time` from a transient run, `no-burnt`), and a par. **Check** either passes the spec or says what's actually wrong ("LED1 is in backwards…", "the supply is delivering 29.8 mA, over the 20 mA budget…", "C1 reaches 63 % after 450 ms… too fast: τ = R × C"). Burnt LEDs cost a spare. Stars: ★ meet the spec, ★★ no hints and nothing burnt, ★★★ within par (checks, parts added, measurements). After a pass you can ride your circuit, then the Level Complete screen shows the score and leads to the next level or back to the map. Best stars and times are saved in the browser.

**Breadboard bench** (`src/breadboard/`, Sandbox tab): a 3D half-size breadboard in React Three Fiber. Place jumper wires, resistors (with correct colour bands), LEDs, push buttons and batteries hole by hole, probe with a multimeter, and watch strips glow with their voltage. Breadboard wiring is modelled the real way (a–e / f–j strips, separate top and bottom rails), so classic mistakes like a resistor with both legs in one column show up. Overloaded LEDs burn out and stay dead until replaced. Click a part to change its value or colour; right-click to move it on its own or together with everything connected to it (wires stay plugged into the rails).

**Electron flow and ride** (Sandbox tab, **F** / **R**): every current path fills with moving charge, coloured by the source driving it and moving at a speed that follows the current. Where two sources share a wire, the colours mix in proportion to each one's share (superposition, `src/sim/superposition.ts`). Ride mode puts the camera on a single electron that picks its way through junctions weighted by current. By default it stops at each component (the source, every resistor, LED and button) and waits for **Space**: a card explains what happens there with the real numbers ("loses 7 V as heat · 21.2 mA × 330 Ω = 7 V"), and back at the source it closes the lap with Kirchhoff's voltage law ("gained 9 V, spent LED1 2 V + R1 7 V = 9 V"). **A** switches to a continuous ride without stops (`src/breadboard/rideStops.ts`). Click any part (or place the multimeter probes) to see its current or voltage broken down by source. Toggle conventional current to see + → − instead of electron flow.

**Oscilloscope and live bench** (Sandbox tab, **O**; `src/instruments/`, `src/breadboard/live.ts`): the bench now runs a real-time transient simulation, so capacitors charge and function generators swing. New parts: **capacitors** (ceramic below 1 µF, polarised electrolytics from 1 µF, flagged if put in backwards) and a **function generator** (square, sine or triangle, 1 Hz–20 kHz, amplitude and offset). The two-channel scope clips onto any breadboard hole (**Scope probes**, key **0**), with its ground on board ground, and draws the trace live on the WebGL phosphor shader from `docs/demos/`: afterglow, bloom, curved glass and a graticule that catches the glow. It has V/div and position per channel, time/div from 10 µs to 500 ms, edge trigger on either channel with Auto / Normal / Single modes, Run/Stop, and Vpp / mean / max / min / frequency readouts. The whole bench runs on the scope's timebase: 50 ms/div and slower is real time, faster timebases put the bench in slow motion so a 1 kHz square wave is watchable (the HUD shows the factor). LEDs on a changing board glow with their average current and burn out on their peak current. Presets **RC filter** (1 kHz into 1 kΩ / 100 nF) and **RC charge** (hold the button, 100 µF through 10 kΩ) come with the probes already clipped on.

**Solver bench** (`src/app/`): edit a netlist, see node voltages, currents and faults live, with a placeholder electron-flow strip in Three.js.

## Next up (Phase 0)

World 0 levels 2–5 (reversed diode, series vs parallel, divider, RC timing) with "find the fault" → theory classes and superposition/Thevenin drills → landing page → ride extras (pick the branch at junctions, diode walls).
