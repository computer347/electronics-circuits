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

- `src/app/` screens: `FrontPage.tsx` (riso poster: Continue, Play, Learn, Practice, Workshop), `Workshop.tsx` (activity jobs + Parts Lab index), `App.tsx`; `nav.ts` (home / desk / workshop / repair / coding / wiring / client / lab); `base.css`.
- `src/desk/` the lab bench, where everything is played: `DeskView.tsx` (HUD: step rail, one main button, hints, trays), `DeskScene.tsx` (camera rig, focus, lights, the objects), `assets/` (one file per object: desk, lamp, notebook, meter, bench supply, scope, mat, soldering, clutter), `layout.ts` (where everything sits), `steps.ts` (the four-step loop rules), `store.ts` (focus, phase, mode level/sandbox, meter dial, notebook section, tour, zoom), `meter.ts` (V / Ω / A readings), `notebook.ts` + `NotebookPages.tsx` (Task, Theory, Math), `PartModel.tsx` (part close-ups), `tour.ts`, `starRules.ts`, `desk.css`.
- `src/circuitworld/` Clear the circuit: `map.ts` (the loop from the solved board, faults), `CircuitWorld.tsx` (first person).
- `src/breadboard/` the board: layout, model (board → circuit), store (tools, parts, probes), `Scene.tsx` (`BreadboardContents`, mounted by the desk), `PartMotion.tsx` (part animations), `live.ts` (live transient bench), `paths.ts`, `move.ts`.
- `src/sim/` MNA circuit solver (DC + backward-Euler transient). R_WIRE = 1e-3, GMIN = 1e-11: don't lower them, series-LED islands go singular. Piecewise parts (diodes, NPN, NMOS, regulator, logic `gate`) settle by state iteration; `activeGuess` carries states between solves (the bench's `benchMemory`, needed for latches).
- `src/instruments/` scope acquisition and knob store (the desk scope draws from them).
- `src/levels/` campaign: JSON levels in `world0/` and `world1/` (`WORLDS` in `index.ts`), fault injection, `check.ts` (spec checks incl. truth-table, led-pattern, part-current, sequence), stars, session, progress (localStorage `signal-path.progress.v1`).
- `src/breadboard/chips.ts` 74HC DIP chips (pinouts); `model.ts` maps parts (incl. three-legged `h3` parts and `pins` for chips) to solver components.
- `src/parts/catalogue.ts` + `src/parts3d/` every part and board as a procedural 3D model (`?gallery` shows them all).
- `src/oled/` SSD1306 + Adafruit GFX emulator (same pixels as the real library), font and icons.
- Workshop activities: `src/repair/` (board netlists, repair mat), `src/coding/` (node programs run by a `Runner`: Blink, and OLED jobs: hello, uptime, loading bar, status screen, sandbox), `src/wiring/` (module wiring: DHT11, OLED on I²C with a scanner), `src/jobs/` (client jobs: dialogue, clock, pay, wallet), `src/lab/` (Parts Lab: one level per catalogue part; `looks.tsx` ties answers to the models).
- `src/learn/` lesson content per level (`classes.ts`), live labs (`Labs.tsx`) on `physics.ts`, `check.tsx` (lesson markup and answer grading), progress in `signal-path.learn.v1`.
- `src/drills/` exam drill generators with worked solutions (the notebook's Math pages).
- `src/schematic/` 2D schematics (used by labs and drills).
- Animate with `clip-path`, never `transform`, on anything that contains an R3F canvas: canvases measure their real size.
- Performance:
  - Every screen except the front page is `React.lazy` (`App.tsx`), and the desk is prefetched when the front page is idle.
  - Vendor chunks are set in `vite.config.ts` (`advancedChunks`: react+zustand / three / r3f / gsap). Keep zustand out of the 3D chunks, or the front page pulls in three.js.
  - Canvases take `DPR` and `SHADOW_MAP` from `src/lib/gfx.ts`, which are lower on touch devices.
  - Scenes that never animate use `frameloop="demand"`.
- PWA: `public/manifest.webmanifest` and `public/sw.js`. The build writes `precache.json`, and the service worker is registered as `/sw.js?v=<build id>` (production only). It caches everything for offline play.
- Dev only: `window.__signalPath` exposes the stores (`useBench`, `useDesk`, `useSession`, `useScope`, `bench`, `useLive`).

## Working rules (Mike's)

- Run `npm test` and `npm run build`, and check the change in a browser, before handing over.
- Commit with clear messages. Commits are authored by Mike, with Claude as Co-Authored-By.
- Push to the private repo by default: remote `mike` = computer347/electronics-mike (`main` tracks it).
- Remote `origin` = computer347/electronics-circuits is **shared with a friend**. Push there only when Mike asks, and first check tests, build and `git log origin/main..main` / diff vs `origin/main`.
- Every number a Learn class states is tested against the solver (`tests/learn.test.ts`). Keep it that way when editing classes.
- Levels are never locked behind classes: classes are suggested, linked from each level's brief.

## Status (2026-10-01)

Branch `desk-3d`: everything plays on the 3D bench. World 0 (25 levels: LEDs, resistors, dividers, RC, diodes, pots, sensors, regulators, transistors, MOSFETs) and World 1 (24 levels: binary, gates, NAND universality, De Morgan, parity, mux, decoder, full adder, latches, a traffic-light state decoder). Level files load by file name (`import.meta.glob`); `tests/expansion.test.ts` holds each new level's fix. Every class step has a technical `body`, a `plain` note in simple words and, where there's a sum, a `calc` worked calculation (`src/learn/classes2.ts` for levels 0-11+ and 1-10+). The Workshop has board repair, node coding, wiring and a client job, plus the 39+1-level Parts Lab. See `docs/design/parts-and-jobs-spec.md` for status and next steps.

Content rules (Mike's): every level, job and lab states a real-life skill (`skill`/`realLife`, enforced by tests), and every answer is checked against the solver or the 3D models in tests.
