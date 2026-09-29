# SIGNAL PATH — notes for Claude

A browser game for learning electronics: the player is an electron. Black and phosphor-green look.
Read `README.md` (what's built) and `docs/SPEC.md` (the full design) before starting.

## Stack and commands

Vite + React 19 + TypeScript + React Three Fiber + GSAP + Zustand. Tests with Vitest (`tests/*.test.ts`, no DOM).

```
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # typecheck + production build
```

## Where things are

- `src/sim/` MNA circuit solver (DC + backward-Euler transient). R_WIRE = 1e-3, GMIN = 1e-11: don't lower them, series-LED islands go singular.
- `src/breadboard/` 3D breadboard sandbox, flow and ride modes (`rideStops.ts`), live transient bench (`live.ts`).
- `src/instruments/` oscilloscope (WebGL phosphor shader in `phosphor.ts`).
- `src/levels/` campaign: JSON levels in `world0/`, fault injection, `check.ts` (spec checks + diagnoses like `explainDivider`), stars, session, progress (localStorage `signal-path.progress.v1`).
- `src/learn/` Learn tab: one class per level (`classes.ts`), live labs (`Labs.tsx`) built on `physics.ts`, progress in `signal-path.learn.v1`.
- `src/drills/` exam drill generators with worked solutions.
- `src/app/` App shell, title screen (option C boot terminal), `Crt.tsx` power-on effect (clip-path, never transform: R3F/WebGL canvases must measure their real size), `nav.ts` tab store.
- Dev only: `window.__signalPath` exposes stores, `window.__signalPathProject(hole)` for click tests.

## Working rules (Mike's)

- Run `npm test` and `npm run build`, and check the change in a browser, before handing over.
- Commit with clear messages. Commits are authored by Mike, with Claude as Co-Authored-By.
- Push to the private repo by default: remote `mike` = computer347/electronics-mike (`main` tracks it).
- Remote `origin` = computer347/electronics-circuits is **shared with a friend**. Push there only when Mike asks, and first check tests, build and `git log origin/main..main` / diff vs `origin/main`.
- Every number a Learn class states is tested against the solver (`tests/learn.test.ts`). Keep it that way when editing classes.
- Levels are never locked behind classes: classes are suggested, linked from each level's brief.

## Status (2026-09-29)

Both repos at `8e9c941` (Learn tab). World 0 is complete: 5 levels, 5 classes, title screen, 190 tests.

## Next steps, in order

1. **Play-test World 0**: Mike takes each class, then its level, and notes what's confusing, too easy or badly worded.
2. **Fix what that turns up**: wording in classes, hints and par values.
3. **World 1**: bigger networks: Kirchhoff's laws, superposition, Thevenin/Norton, bridges. Same pattern as World 0: levels + a class each + drills (superposition/Thevenin drill generators don't exist yet).
4. **Polish**: settings menu (Esc: CRT effects on/off, sound), ride mode choosing the branch at junctions and a wall at reversed diodes, oscilloscope-style title screen (design option A, kept for later).
