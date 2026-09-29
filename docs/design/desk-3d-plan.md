# Desk 3D: session plan

Branch `desk-3d`. Source of truth: [`desk-3d-brief.md`](desk-3d-brief.md).

## Slice: level 0–2 "Wrong way round", end to end

Front page (riso poster) → Continue → desk → notebook (task) → breadboard (look, fix if you can) → multimeter (measure; Submit unlocks after one measurement) → power switch flips → dive into the hole → Clear the circuit (walk, scan, turn the one-way door round) → current flows → stars → back at the desk.

## Layout

- `src/desk/steps.ts`: pure step rules (which step is current, what glows, when Submit is enabled). Unit-tested.
- `src/desk/store.ts`: desk store (focus, step, dive / clear phases), built on the existing `useSession` and `useBench`.
- `src/desk/DeskView.tsx`: full-screen canvas + HUD (step rail top, Back top-left, one blue main button bottom-right, hover tag).
- `src/desk/DeskScene.tsx`: room, lighting, camera rig (time-based easing, reduced motion cuts).
- `src/desk/assets/`: one file per object (desk, wall + corkboard + poster, lamp, notebook, multimeter, parts box, power switch, mug).
- The breadboard is the existing one: `src/breadboard/Scene.tsx` now exports `BreadboardContents` (everything inside the canvas), which the desk mounts scaled onto the desk top.
- `src/circuitworld/map.ts`: the loop from the level's solved board (rooms = parts, corridors = nets, faults from the solve). Unit-tested. `CircuitWorld.tsx` plays it **in first person** (Mike's call during the session, replacing the brief's top-down map).
- `src/app/FrontPage.tsx`: the riso front page.

## Status (end of session 1, 2026-09-29)

### Done

- **Front page** (`src/app/FrontPage.tsx`): riso poster (paper, pink/blue overprint with multiply, yellow sun, pink sine, grain), Continue + Play / Learn / Practice, keys Enter and 1–3. It replaces the boot-terminal title as `home` (`TitleScreen.tsx` is still in the repo, unused).
- **Desk** (`src/desk/`): wood desk with a worn edge, wall, corkboard level map, riso poster, balanced-arm lamp with a warm shadowed spotlight, notebook with a spiral and a hinged cover, multimeter (LCD with the solver's reading and rolling digits, dial, jacks, leads that follow the probes), parts box, power unit with the pink submit rocker, mug. Seated camera at about 60°, time-based focus in/out (0.7 s), a pink glow under the one next object, hover tags, the room dims around the focus, reduced motion cuts.
- **Level loop for 0–2**: notebook task page (target circuit drawn, one sentence, the four steps), breadboard in focus (the real `BreadboardContents` with a new `look="desk"`; click LED1 → "↻ Turn LED1 round"), meter view (probe the board, Submit locked until a measurement), submit → rocker flips → the camera dives into LED1's hole with nested frames → inside.
- **Clear the circuit, first person**: corridors with blue floors and chevrons (+ → −), rooms for the supply (battery cell), R1 (colour-band arches), LED1 (inside the LED's dome, with a one-way door and a diode arrow on the floor). Blue fog plus a riso halftone at the edges of your view. Walk (↑ / W, ↓ turns round, or click a room / the main button), the door blocks you and shakes the view, scan shows in/out voltages and whether anything flows, "Turn the door round" swings it and flips LED1 on the real board, "Switch the current on" sends pink charge round and lights each room in turn, then `checkLevel` scores it and the stars card leads back to the desk (corkboard glows, all steps ticked).
- **Tests**: `tests/desk.test.ts` (step rules, map for 0–2 before/after the fix, burnt and open loops, the whole loop through the stores). 198 tests pass, `npm run build` passes.

### Screenshots

`docs/design/shots/01–11` (front page to the first step inside), from headless Chrome driven over CDP (neither connected Chrome extension could reach this PC's dev server). 03 shows the notebook's left page upside down and burnt out by the lamp: both fixed after the shot. The run stopped at 11 because the walk was slower than the script waited (the loop is now smaller and faster). Then the dev server was stopped for low memory, so shots 12–19 (scan, door, fix, flow, stars, back at the desk) still need taking.

### Next

1. Finish the screenshots 12–19 and look at the inside for real: door facing, dome, room lighting, how the flow reads.
2. Desk polish: probe leads are straight sticks in the meter view (give them slack), the breadboard is small in the desk view, the corkboard is only just in frame, lamp head is off-screen.
3. Breadboard step for build levels: parts box with the level's parts, parts lifting out and snapping in, valid holes and the whole strip lighting while carrying a part.
4. Clear the circuit for other faults: open wire = broken bridge, short = flood, burnt = scorched room (the map already reports `burnt` and open loops); side rooms for parallel branches.
5. The rest of World 0 on the desk (level picked from the corkboard), then retire the old tabs.
6. Code-split three.js (the bundle is 1.4 MB) and sound.
