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
- `src/circuitworld/map.ts`: map from the level's solved board (rooms = parts, corridors = nets, faults from the solve). Unit-tested. `CircuitWorld.tsx` draws it.
- `src/app/FrontPage.tsx`: the riso front page.

## Status

See the end of this file (filled in at the end of the session).
