# Desk 3D: design and build brief

Written 2026-09-29 from Mike's design sessions. Read this, `CLAUDE.md` and `README.md` before starting.
Open `docs/design/desk-prototype.html` in a browser for a rough reference of the desk scene (known issues: animations use frame time and crawl on slow machines, lamp head is wrong, camera is too low and too side-on).

## The idea in one paragraph

The game stops being a set of tabs. After the front page you sit at an electronics bench (3D, lit by a desk lamp) and every level is played with the same four real objects on the desk, always in the same order: the **notebook** tells you the task, the **breadboard** is where you build or fix, the **multimeter** is where you test before submitting, and then you **shrink into the circuit** and clear it from the inside like a game (the "Clear the circuit" idea). A player should know what to do next without reading.

## Decisions already made (keep these)

- **Front page**: the risograph poster look. Paper `#f1ece1`, fluoro pink `#ff48b0`, blue `#0078bf`, riso yellow `#ffe800`, ink `#1c0a3a`, overprinted with multiply, fine grain, Anton (display) + Space Mono (body). Big "SIGNAL PATH", Continue, then Play / Learn / Practice only (Hick's law). Continue goes straight to the desk.
- **The desk**: natural, warm, real materials (wood, cork, paper, plastic, metal), one warm lamp. The riso inks are used only for UI and highlights, so the brand carries through without turning the room into a poster.
- **Camera**: seated, looking down over the desk at about 55–65° (more overhead than the prototype, not from the side). **No hands** are ever visible.
- **Focus**: whatever you choose becomes the focus of the screen. The object comes to the camera (or the camera to it), fills most of the screen, and everything else dims and blurs slightly. One way back: Esc, a Back control, or clicking the dimmed desk.
- **Hick's law everywhere**: one obvious next thing at any moment, at most 3–4 choices on screen. Plain words first, numbers second.
- **Inside the circuit**: Idea B, "Clear the circuit". The circuit is a top-down map: rooms are parts, corridors are wires, unexplored areas are blue halftone fog. Faults look like what they do: an open wire is a broken bridge, a backwards LED is a one-way door facing the wrong way, a short is a flood that skips everything, a burnt part is a scorched room. You walk, scan (voltage on both sides, is anything flowing), fix, and the current flows and rooms light up. Drawn in the riso three-ink style. Pick one current direction (conventional + to −, or electron flow) and label it in the world.
- **Part colours** are consistent everywhere: battery/power pink-red, wires copper (blue in the circuit world), resistors amber/yellow, LEDs glow in their own colour only when lit, capacitors blue, meter violet. Green is not the default colour of everything any more.

## The level loop (the same for every level)

| Step | Object | What the player does | How they know it's next |
|---|---|---|---|
| 1 Task | Notebook | Reads the goal as ONE sentence plus a picture of the target (for example the LED lit, or "3 V here"). Optional "learn this first" page opens the existing Learn class. | On entering a level, only the notebook glows and gently lifts; the step rail shows step 1 lit. |
| 2 Build | Breadboard | Places and moves parts, wires into holes. The parts tray is a real parts box holding only this level's parts. | After closing the notebook, the breadboard glows. Valid holes light up while carrying a part; the whole connected strip lights, which teaches how a breadboard works. |
| 3 Test | Multimeter | Probes points on the board; the meter reads out. Then Submit (flip the bench power switch or a big Submit on the meter view). | Meter glows once something is on the board. Submit is only enabled after at least one measurement. |
| 4 Clear | Shrink into the circuit | Plays the circuit as a map: explore, scan, fix faults, get the current round. | After a submit, the camera dives into a breadboard hole (1 : 1 000 000 000 scale transition). |

A **step rail** (4 small icons: notebook, breadboard, meter, electron) sits at the top and is the only persistent HUD. The current step is lit, finished steps get a tick, and future steps are dim but clickable to look at. This is how players know where they are without reading.

Level map (Play) is the corkboard on the wall. Learn is the notebook's lesson pages. Practice is the meter's quiz mode. The same objects serve the menus, so the world has one vocabulary.

## UX rules (so players don't have to read)

- Exactly one object glows at a time: the next step. Hover on any object lifts it slightly and shows a small riso tag with a name and one verb ("Notebook · read the task").
- Icons and pictures before text: the notebook's goal page shows the target state drawn, not described.
- Feedback is physical: LEDs glow, wires sag, the meter needle or digits move, a burnt LED smokes and goes grey, a wrong fix shakes.
- One main button per moment, always bottom-right in the same place, in blue. Secondary actions are text links. Back is always Esc and top-left.
- Errors say what happened in one line and point at the place ("No current: the LED is blocking. Look at its legs."), and the thing they're about glows.
- Respect `prefers-reduced-motion`: cut instead of fly, no idle bobbing.

## Assets to model (procedural, in code)

Build everything in code with React Three Fiber and three.js: no downloaded models or textures (no licensing questions, small bundle). Use canvas textures for paper, labels and wood grain. Keep each asset in its own component so it can be improved later.

- Desk (wood top with grain and a worn edge), back wall, corkboard with the pinned level map, riso poster on the wall, desk lamp (base, two arms, head with the opening facing the desk, warm spotlight with soft shadows)
- Notebook: pages block + cover on a hinge, spiral rings; open and turn-page animations; page content drawn to canvas (goal page, lesson pages)
- Breadboard: reuse the existing one in `src/breadboard/` (it already simulates). Only restyle it to match the desk lighting.
- Parts box with compartments that only holds the level's parts; resistor, LED, capacitor, wire, push button, battery meshes (reuse existing where possible)
- Multimeter: yellow body, LCD with real readings from the solver, rotary dial, red and black leads that follow the probes
- Bench power switch for Submit
- Mug and small clutter (optional, last)
- Clear the circuit: the map generated from the level's actual netlist (rooms from components, corridors from nets), fog, the electron (pink dot with a slightly misprinted blue ring), scanner cone, fault props (broken bridge, one-way door, flood, scorch), the flow of current once cleared

## Animations

- Front page → desk: the poster's inks "print" the desk into place, camera settles.
- Focus in and out for each object (about 0.7 s, ease-out, time-based not frame-based).
- Notebook: slides to centre, opens, turns pages.
- Breadboard: camera leans over; parts lift out of the box, snap into holes with a small bounce and a click sound (sound can come later).
- Meter: slides to centre; digits roll to the new value; probe leads follow.
- Submit: power switch flips, LED fades up (or fails visibly).
- Shrink: camera dives into the hole through nested frames; the circuit map fades in from fog.
- Inside: walk along corridors, fog clears around you, the scanner sweeps, the fix animation (the door swings round, the bridge rebuilds), then current flows round the loop and rooms light in order.

## How it fits the existing code

- Levels, faults, checks and stars already exist in `src/levels/` (`checkLevel`, `useSession`, level JSON). The desk is a new way to play the same levels. Don't rewrite that logic.
- The solver (`src/sim/`) gives every reading: meter values, room voltages inside the circuit, whether current flows.
- Suggested layout: `src/desk/` (scene, camera rig, stations, desk store with the current step), `src/desk/assets/` (one file per object), `src/circuitworld/` (map from netlist, renderer, scanner, fault props). Unit-test the map generation and the step rules like the rest of `tests/`.
- Add the desk as a new mode reached from the title screen's Continue, behind the existing views. Remove the old tabs only once the desk plays all of World 0.

## Plan for a 40-minute session (vertical slice first)

1. (5 min) Read the code and this brief. Write a short plan into `docs/design/desk-3d-plan.md`. Create a branch `desk-3d`.
2. (10 min) Desk scene: room, desk, lamp lighting with shadows, the four objects as simple but good-looking models, the overhead camera, hover tags, focus-in and focus-out for each object, step rail. Commit.
3. (10 min) Level loop for level 0–2 "Wrong way round" on the desk: notebook goal page, existing breadboard in focus, meter readings from the solver, Submit gated on a measurement. Commit.
4. (10 min) Clear the circuit for level 0–2: map generated from its netlist, fog, walk, scan, the backwards-LED door, fix, current flows, stars, back to the desk. Commit.
5. (5 min) Polish the transitions (front page → desk, shrink), reduced motion, then `npm test`, `npm run build`, screenshots of each step in the browser. Commit, then summarise what's done and what's next.

If time runs short, cut from the end: a solid desk and loop beats a half-built circuit world.

## Definition of done for this session

- From the front page, Continue leads to the desk, and level 0–2 can be played end to end: notebook → breadboard → meter → submit → clear the circuit → stars → back at the desk.
- The next step is always obvious from the glow and the step rail, without reading.
- `npm test` and `npm run build` pass, and there are screenshots of each step.
- Commits on the `desk-3d` branch with clear messages. Push only to the private repo, and only when asked.
