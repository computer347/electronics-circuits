# SIGNAL PATH — notes for Claude

A browser game for learning electronics: the player is an electron. A riso-poster front page, then a 3D lab bench where every level is played.
Read `README.md` (what's built), `docs/SPEC.md` (the full design) and `docs/design/desk-3d-brief.md` + `desk-3d-plan.md` (the desk) before starting.

## Stack and commands

Vite + React 19 + TypeScript + React Three Fiber + GSAP + Zustand. Tests with Vitest (`tests/*.test.ts`, no DOM).

```
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # typecheck + production build
```

## Where things are

- `src/app/` the two screens: `FrontPage.tsx` (riso poster: Continue, Play, Learn, Practice) and `App.tsx`; `nav.ts` (home / desk); `base.css` (reset + the ink-on-paper styles of labs and schematics).
- `src/desk/` the lab bench, where everything is played: `DeskView.tsx` (HUD: step rail, one main button, hints, trays), `DeskScene.tsx` (camera rig, focus, lights, the objects), `assets/` (one file per object: desk, lamp, notebook, meter, bench supply, scope, mat, soldering, clutter), `layout.ts` (where everything sits), `steps.ts` (the four-step loop rules), `store.ts` (focus, phase, mode level/sandbox, meter dial, notebook section, tour, zoom), `meter.ts` (V / Ω / A readings), `notebook.ts` + `NotebookPages.tsx` (Task, Theory, Math), `PartModel.tsx` (part close-ups), `tour.ts`, `starRules.ts`, `desk.css`.
- `src/circuitworld/` Clear the circuit: `map.ts` (the loop from the solved board, faults), `CircuitWorld.tsx` (first person).
- `src/breadboard/` the board: layout, model (board → circuit), store (tools, parts, probes), `Scene.tsx` (`BreadboardContents`, mounted by the desk), `PartMotion.tsx` (part animations), `live.ts` (live transient bench), `paths.ts`, `move.ts`.
- `src/sim/` MNA circuit solver (DC + backward-Euler transient). R_WIRE = 1e-3, GMIN = 1e-11: don't lower them, series-LED islands go singular.
- `src/instruments/` scope acquisition and knob store (the desk scope draws from them).
- `src/levels/` campaign: JSON levels in `world0/`, fault injection, `check.ts` (spec checks + diagnoses), stars, session, progress (localStorage `signal-path.progress.v1`).
- `src/learn/` lesson content per level (`classes.ts`), live labs (`Labs.tsx`) on `physics.ts`, `check.tsx` (lesson markup and answer grading), progress in `signal-path.learn.v1`.
- `src/drills/` exam drill generators with worked solutions (the notebook's Math pages).
- `src/schematic/` 2D schematics (used by labs and drills).
- Animate with `clip-path`, never `transform`, on anything that contains an R3F canvas: canvases measure their real size.
- Dev only: `window.__signalPath` exposes the stores (`useBench`, `useDesk`, `useSession`, `useScope`, `bench`, `useLive`).

## Working rules (Mike's)

- Run `npm test` and `npm run build`, and check the change in a browser, before handing over.
- Commit with clear messages. Commits are authored by Mike, with Claude as Co-Authored-By.
- Push to the private repo by default: remote `mike` = computer347/electronics-mike (`main` tracks it).
- Remote `origin` = computer347/electronics-circuits is **shared with a friend**. Push there only when Mike asks, and first check tests, build and `git log origin/main..main` / diff vs `origin/main`.
- Every number a Learn class states is tested against the solver (`tests/learn.test.ts`). Keep it that way when editing classes.
- Levels are never locked behind classes: classes are suggested, linked from each level's brief.

## Status (2026-09-29)

Branch `desk-3d`: the desk replaces the old tabbed app. All of World 0 plays on the bench, with the notebook (Task, Theory, Math), meter, scope, free bench and Clear the circuit. See `docs/design/desk-3d-plan.md` for what's done and next.
