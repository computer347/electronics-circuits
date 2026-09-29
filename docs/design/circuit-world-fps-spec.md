# Clear the circuit: free-movement spec

Written 2026-09-29. Replaces the "walk along a ring" version in `src/circuitworld/`. Read with [`desk-3d-brief.md`](desk-3d-brief.md) (the level loop this is step 4 of) and [`desk-3d-plan.md`](desk-3d-plan.md).

## Why change it

Today you slide along a fixed ring: ↑ walks, ↓ turns round, and the camera follows the track. It works, but it's a guided tour, not a place. The goal is a small first-person level you move through freely, where **the shape of the place is the circuit's physics**. A player who has walked it should be able to say where the voltage drops and why the current can't get round, because they felt it with their feet.

## The one big idea: voltage is height

Every point in the circuit world stands at a height equal to its voltage. 1 V is 1 m.

| Circuit | World |
|---|---|
| Net (a set of connected holes, all at one voltage) | A flat **plaza** at that height; the wires that make the net are flat **corridors** at the same height |
| Supply / battery | A **lift** (or a spiral stair) that raises you from 0 m to V_supply |
| Resistor | A **ramp** down from one plaza to the next. The drop is I × R; with no current both ends sit at the same height and the ramp is flat |
| LED / diode | A **one-way door** with a short drop (≈ 2 m for red) behind it. Lit from inside when current flows. Backwards: the door faces you and won't open |
| Capacitor | A **reservoir**: two walls with a gap you can't cross. Its water level is its voltage and rises while it charges |
| Push button / switch | A **drawbridge**: down (passable) while pressed / closed |
| Ground (the − rail) | The floor of the world, 0 m |
| Current | Water (pink, riso-printed) running downhill along the floors once the power is on: its width and speed follow the current |

What this teaches, for free:
- **Kirchhoff's voltage law** is "you come back to where you started": everything the lift raises you, the ramps and doors take back down. The world can't be built any other way.
- **A reversed LED** makes the full supply voltage stand in front of its door: the plaza before it is high, the one after it is low, and nothing flows. The same picture the multimeter gave on the bench (5 V on one leg, 0 V on the other).
- **A divider tap** (level 0–4) is a plaza exactly 3 m up the side of a hill: you can see the ratio.
- **An RC charge** (0–5) is a reservoir filling while you hold the drawbridge down.

**Direction.** Current is shown conventionally: it runs *downhill* from + to −, like water. The world says so on a sign at the lift ("current flows downhill, + to −"). The player is still "an electron": the lift is how a battery pushes you up, and one Theory page explains that real electrons go the other way round the loop (uphill). *Open question 2.*

## Controls

| Action | Mouse + keyboard | Keyboard only | Touch |
|---|---|---|---|
| Move | W A S D | ↑ ↓ + strafe on , . | left thumb stick |
| Look | mouse (pointer lock) | ← → turn, PgUp/PgDn look | right half drag |
| Sprint | Shift | Shift | double-tap stick |
| Scan | right mouse / Q (hold) | Q | Scan button |
| Use | left mouse / E | E | Use button |
| Map | Tab (hold) | Tab | Map button |
| Back to the bench | Esc (releases the pointer first) | Esc | Back |

- Click the view to capture the pointer; a first-time card shows the four verbs with pictures (Move, Look, Scan, Use). That's the whole vocabulary: **four verbs, no more** (Hick's law).
- **Click-to-walk stays** as an option: click a room on the map (Tab) and the electron walks there on its own. It's the reduced-motion and "I don't play shooters" path.
- Settings (in the Esc menu later): mouse sensitivity, invert Y, field of view (70–90°), head bob on/off (off under reduced motion), snap turning.

## Movement feel

- Walk 4 m/s, sprint 7 m/s, acceleration over about 0.15 s, no jumping (drops are taken by walking off ledges, climbs only by lift or ramp: height must mean voltage, so no shortcuts).
- Eye height 1.6 m, field of view 78°, gentle head bob (1.5 cm) only while walking.
- Ramps are walkable up and down, but walking *up* a ramp is slow and the ramp glows "against the current": you can go against the flow, it's just visibly uphill work.
- Drops: walking off a ledge lands you on the plaza below with a short camera dip. You can't climb back up except the way the circuit allows (lift, ramp).
- Collisions are simple and predictable: you slide along walls, you can't pass closed doors, raised drawbridges or chasms.

## The world, generated from the solved board

`buildWorld(board, analysis) → World` in `src/circuitworld/world.ts`, pure and tested, replaces `buildMap`.

```
World {
  plazas:  { net, volts, center: [x, z], size: [w, d], height }   // height = volts × SCALE
  links:   { part, kind: 'lift' | 'ramp' | 'door' | 'reservoir' | 'bridge' | 'wire',
             from: plaza, to: plaza, path: [x, z][], drop, amps, fault? }
  walkable: polygons with a height function (the navigation surface)
  blockers: segments you can't pass (walls, closed doors, raised bridges, chasm edges)
  spawn:   position and facing (at the top of the lift, looking downhill)
}
```

**Layout.** Walk the loop from the supply's + terminal, as `buildMap` does now, and place plazas round a rough circle. Branches (parallel parts, bleed resistors) peel off as side paths between the same two plazas, spaced sideways so they read as a fork. Plazas are about 8 × 8 m, links 10–14 m long, so a World 0 level is about 40 × 40 m: a minute to walk round, never a maze.

**Heights** come straight from the solver's node voltages. A net the solver can't reach (a floating strip, an open loop) has no voltage: it's drawn at 0 m under heavy fog, and the link that would reach it is a chasm.

**Before the power is on** the heights are the DC solution of the circuit *as built*, so the landscape already tells the truth: the reversed-LED level has a tall plaza before the door and a low one after. Nothing flows yet (no water), rooms are dark, fog is thick beyond 12 m and lifts as you explore (explored areas stay clear).

## Verbs

**Scan** (hold): a yellow cone from your hands' position, no hands drawn. Whatever is in the cone gets a riso tag: plazas show their voltage ("5.0 V"), links show their drop and current ("R1 · drops 3.0 V · 20 mA", "LED1 · blocking · 5.0 V across it"). Scanning a part for the first time logs it on the map. This is the inside view of the multimeter.

**Use** (press, when looking at something usable within 2.5 m; a prompt appears under the crosshair, "E · turn the door round"):
- a reversed door: turn it round (the fix is applied to the real board, as now);
- a drawbridge (push button): hold to keep it down;
- the lift's control panel: switch the power on (the end of the level, once the loop is clear);
- anything else: nothing, and the prompt doesn't appear.

**Map** (hold Tab): the level's schematic, drawn in ink on paper like the notebook, with a pink dot where you stand and the parts you've scanned ticked. Clicking a part on it walks you there. This ties the place back to the circuit diagram the notebook teaches.

## Faults, shown as what they do

| Fault | Inside | Fix inside? |
|---|---|---|
| Reversed LED | door facing you, blocked, all the voltage stacked before it | Yes: Use turns it round |
| Missing part / open wire | the corridor ends in a chasm, fog below | No: back to the bench (the result card says what's missing) |
| Wrong resistor value | a ramp too steep (too much drop) or too shallow; on power-on the LED room is dim or burns | No: back to the bench, and the card names the value |
| Burnt LED | scorched room, the door fused shut, smoke | No: bench (fit a spare) |
| Short circuit | a flood: a flat corridor straight from the top of the lift to the floor, all the water pours through it, every other room dark | No: bench |
| Part both legs on one strip | a ramp that starts and ends on the same plaza: a flat pointless loop with a sign | No: bench |

Things you can't fix inside still count as progress: finding them is the point. The way back ("Back to the bench to fix it") appears once you've seen the fault, and the result card on the bench points at the part, as now.

## Power on and the end of the level

At the lift's panel, **Use** switches the power on. Water pours from the top of the lift, runs down every ramp in turn, through each door (the LED rooms light in their own colour), and pools at the floor, then back to the lift. Speed and width follow the real current. Then the level is checked (`checkLevel`), and the stars appear in the world before the camera rises back out of the board to the bench.

Stars stay as they are on the bench (spec, no hints / nothing burnt, par). Inside the circuit there's no timer and no fail state. You can't die; the worst that happens is a door that won't open.

## HUD (the only things on screen)

- The step rail, top centre (step 4 lit).
- A small crosshair; the Use prompt appears under it only when something is usable.
- The scan tags, in the world, only while scanning.
- The objective line, top left, one sentence: "Get the current round: find why LED1 is dark." It changes as you go ("Now switch the power on at the lift").
- Bottom right: the one main button, as on the bench (Back to the bench / Switch on).

## Tech notes

- **Controller**: a small kinematic character controller of our own, no physics engine. The world is 2.5D (floors are polygons with a height, walls are vertical), so movement is: move in x/z, slide along blocker segments, take the floor height from the walkable polygon under you, and fall to a lower one when you step off an edge. It's deterministic and unit-testable without WebGL. (A physics engine like Rapier would add about 1 MB and solve problems we don't have.)
- **Pointer lock** through the browser's Pointer Lock API with a fallback to drag-to-look when it's refused (some embedded browsers).
- **Rendering**: instanced floor and wall pieces as now, canvas-texture signs, fog, and one light per lit room. Water is a scrolling riso-halftone texture on thin ribbons along the floor paths. Budget: 60 fps on integrated graphics, under 150 draw calls.
- **Time-based** everywhere; reduced motion: no head bob, no camera dip, snap turns, click-to-walk offered first.
- The world is rebuilt only when the board changes (a fix inside changes the board: doors re-solve, heights move smoothly to the new voltages over 1 s, a lovely moment when the reversed LED is turned round and the whole landscape settles).

## Tests

- `buildWorld`: heights equal node voltages; around every closed loop the lift's rise equals the sum of drops (KVL); a reversed LED gives a blocking door with the supply voltage across it; an open loop gives a chasm; branches become forks between the right two plazas.
- Controller: can walk the whole loop of a clear circuit; can't pass a closed door, a raised bridge or a chasm; walking off a ledge lands on the lower plaza; can't climb a ledge; sliding along walls never lets you through a corner.
- Level scripts: each World 0 level can be cleared from spawn by a scripted walker (walk to the fault, Use, walk to the lift, Use).

## Build plan

1. **Controller on the current ring**: WASD, mouse look with pointer lock, keyboard look, collisions against today's corridor walls and door. Nothing else changes. (Proves the feel early.)
2. **Voltage-as-height world**: `buildWorld`, plazas, ramps, lift, doors, chasms, heights from the solver; the landscape settles when a fix changes the voltages.
3. **Verbs**: Scan cone and tags, Use prompts (door, drawbridge, power panel), the objective line.
4. **Power on**: the water, rooms lighting in order, the check and the stars in the world, rising back out to the bench.
5. **Map and onboarding**: Tab schematic map with click-to-walk, the first-time controls card, touch controls, settings.
6. **Faults for every level**: flood, steep ramp, scorched room, reservoir filling (0–5), divider tap plaza (0–4).

Each step is playable and committed on its own.

## Open questions for Mike

1. **Voltage as height**: the core of this spec. Yes, or keep the flat world?
2. **Direction**: downhill conventional current (recommended, it matches the height), or electron flow (you'd climb every ramp)?
3. **Fixing from inside**: only the fixes that make sense in place (turn a door, hold a bridge), as specced, or also carry parts in (e.g. lay a resistor ramp across a chasm)? Carrying parts is fun, but it blurs "build on the bench, test inside".
4. **Touch**: first-class now, or after the desktop feel is right?
5. **Free bench**: the same free-roam world for your own circuits (no scoring), as now?
