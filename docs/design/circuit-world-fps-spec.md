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
| Crouch (squeeze through high-ohm passages) | C / Ctrl | C | Crouch button |
| Scan | right mouse / Q (hold) | Q | Scan button |
| Use | left mouse / E | E | Use button |
| Map | Tab (hold) | Tab | Map button |
| Back to the bench | Esc (releases the pointer first) | Esc | Back |

- Click the view to capture the pointer; a first-time card shows the four verbs with pictures (Move, Look, Scan, Use). That's the whole vocabulary: **four verbs, no more** (Hick's law). Sprint and crouch are ways of moving, taught when you first meet a long corridor and a narrow passage.
- **Click-to-walk stays** as an option: click a room on the map (Tab) and the electron walks there on its own. It's the reduced-motion and "I don't play shooters" path.
- Settings (in the Esc menu later): mouse sensitivity, invert Y, field of view (70–90°), head bob on/off (off under reduced motion), snap turning.

## Movement feel

- Walk 4 m/s, sprint 7 m/s, crouch 1.6 m/s, acceleration over about 0.15 s, no jumping (drops are taken by walking off ledges, climbs only by lift or ramp: height must mean voltage, so no shortcuts).
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

## Challenge: what makes it a game

Finding the fault is a puzzle, but walking there should be a challenge too. Two layers, with one hard rule between them.

**The rule: the circuit is never wrong.** Heights, drops, currents and what the scan says always come from the solver. Nothing you do while walking changes them (only a real fix does). The challenge acts on *you*, the electron, never on the circuit, so the world keeps agreeing with the multimeter on the bench.

### 1. Resistance is a tight squeeze (physics you can feel)

A resistor isn't a smooth ramp any more: it's a **passage through the metal**, built from its value the way a real resistor is: R = ρ × length ÷ cross-section.

- **Narrower and longer for more ohms**, on a log scale so World 0's range fits: 100 Ω is a 3 m wide hall, 1 kΩ a 2 m corridor, 10 kΩ a 1.2 m passage you walk through sideways, 100 kΩ a 0.7 m crawlspace (**C** to crouch; crouching is slow).
- **The lattice is in the way.** The passage is full of atoms (big, softly glowing spheres in rows) that **vibrate**. You weave between them; bumping one knocks you back, slows you, and throws off an orange **heat spark**. That's exactly what resistance is: electrons colliding with the lattice, and the collisions turning into heat.
- **Hotter parts shake harder.** Vibration grows with the power the part dissipates (P = I² × R, from the solver): a resistor carrying lots of current is a rougher crossing than one that's barely working. Before the power is on the atoms only tremble.
- The **drop is still the drop**: you come out at the height the solver says (I × R lower), however well you dodged. Skill buys you time, not volts.

### 2. Your spark (the player's energy, a game layer)

You carry a **spark**: the pink glow round the electron, shown as a small meter by the crosshair. It's full when you step off the lift.

- **Heat wisps** hurt it. Heat sparks thrown off by collisions drift for a few seconds and chase you weakly; touching one dims your spark. So a clumsy crossing of a hot resistor costs you twice: knock-backs and wisps.
- **Gremlins** (World 0: one or two per level, later worlds more) are the enemies: small riso-printed creatures that patrol corridors and **drain your spark** on contact. In World 0 they stand for **stray static**: they come from the edges of the board and fizz blue. In later worlds the same enemies become interference (EMI) along long traces and ground bounce around switching parts, so the enemy list grows with the course.
- **Running out** isn't death: your spark gutters, the screen flashes, and you're back at the lift (charged again, the fog you cleared stays clear). It costs time, nothing else.
- **Recharge** at the lift, or at a **tap** (a charged capacitor, a battery): step into the glow.
- **Scan and Use cost nothing**, so learning is never punished; only moving carelessly is.

A spark isn't a real voltage, and the game never calls it one. One Theory page (0–1) says what's fiction and what's real: real electrons don't get eaten, but the heat is real (P = I² × R), and that's why resistors get warm.

### 3. Parts as set pieces

| Part | Challenge |
|---|---|
| Resistor | The squeeze: narrow passage, vibrating lattice, heat wisps |
| LED | The door; behind a working LED, a bright room you have to cross quickly (the light stings your spark) |
| Capacitor (0–5) | A **reservoir** that fills while you hold the drawbridge (the push button). Water rising at the RC rate lifts a floating platform: you need it high enough (63 %, one τ) to cross, and it drains back through the bleed resistor when you let go. Timing, taught by feel |
| Short circuit | A **flood** you outrun up the nearest ramp while every room goes dark |
| Burnt part | Smoke that hides the way and slowly dims your spark |
| Divider tap (0–4) | A ledge exactly 3 m up; stand on it and your meter says so |

### 4. How it's scored

The bench's three stars don't change (spec, no hints / nothing burnt, par). Inside, each level adds a **run badge** on the result card, not a star, so learning never locks progress:

- **Clean**: no knock-backs from the lattice.
- **Untouched**: no spark lost to wisps or gremlins.
- **Quick**: under the level's run time.

Badges are saved with the level and shown on its corkboard card as small stamps. Difficulty scales with the world: World 0 has slow gremlins, gentle lattices and generous run times.

### Accessibility and tone

- An **Easy passage** setting: atoms still move (it's the teaching) but can't knock you back, and gremlins don't drain. Reduced motion turns atom vibration down to a slow sway.
- Enemies are silly, not scary: riso creatures that fizz and blink, no gore, no jump scares.

## Stakes: parts have limits, and they fail like real ones

The challenge above is about getting through. This is about the circuit itself: a wrong part doesn't just fail the check, it **breaks things**, the way it would on a real bench, and one failure can take others with it.

### Every part has ratings

Shown on its datasheet card in the notebook and when you scan it:

| Part | Limit | What happens past it |
|---|---|---|
| LED | 30 mA forward, 5 V reverse | burns out almost at once and goes open (dark, no current) |
| Resistor | 0.25 W (the small breadboard kind) | overheats over a few seconds: glows, smokes, then **burns open** |
| Electrolytic capacitor | its voltage, and the right way round | reversed or over-voltage: bulges, hisses, then vents |
| Sensor input (0–4) | 3.6 V absolute maximum | fried: its room goes dark for good |
| Bench supply | its current limit | holds the current down and drops the voltage (see below) |

**What "wrong" looks like depends on the circuit, and the world shows the true version:**
- **A resistor in series with an LED** always takes the supply minus the LED's 2 V (7 V on 9 V), whatever its value, so its ramp always drops 7 m. What a too-small resistor changes is the **current**: its passage is wide and short, the water through it is a torrent, and the LED behind it gets far more than 30 mA. The height is the same, and the flood is the problem.
- **A divider** (0–4) has no fixed-drop part, so a wrong resistor really does move the voltage: the tap plaza sits too high, and the sensor room at the top of it is over its 3.6 V limit.

**Scanning before power shows the stakes.** At full power, each part's scan tag gets a stress bar, as a percentage of its rating (green, amber, red): "LED1 · would carry 70 mA · 233 % of its limit". The careful player sees the red bar, goes back to the bench and never fries anything. The notebook's Math pages already teach the sums; this is where they pay off.

### The moment of truth: power on

Switching the power on at the lift is where the consequences play out, inside the circuit, in front of you.

- **Overstressed parts heat up visibly**: their rooms glow orange to white, the lattice in a resistor passage shakes itself apart, smoke rolls out, a stress ring fills over the part.
- **Failure times follow real life, scaled so you can see them.** An LED dies almost instantly (under half a second: it's true, and it's why you check first). A resistor takes seconds (4–10 s at twice its wattage, less when worse). A reversed electrolytic takes a few seconds to vent.
- **Failures change the circuit, so they cascade.** Each failure is applied to the board, and the solver runs again:
  - a resistor that burns open is a new **broken bridge**, and everything downstream goes dark;
  - in parallel (0–3), when one LED fails open, its partner suddenly gets the whole current and goes next: a **domino** you watch happen;
  - a part that fails can also *save* another, by cutting the current before it reaches it.
- **The breaker.** A big red mushroom button on the lift's panel cuts the power (Use, or Space in this moment). Slow failures (resistors, capacitors) can be saved if you hit it in time; an LED can't, because it's too fast, as in real life. There's one main action on screen during a surge, "**Cut the power!**", with the time left as a bar.
- **What it costs.** A burnt LED uses one of the level's spare LEDs, and a burnt part costs the second star, as on the bench now. Resistors and capacitors are free to replace, but the result card lists them. Then it's back to the bench, with the fried parts on the board, blackened, to swap.

### Protecting the bench: the supply's current limit

A real bench supply has a **current limit** knob, and good practice is to set it low while building. The desk gets one:

- While you build and measure on the bench, the supply is limited (level default 30 mA; a knob on the supply). If the circuit tries to draw more, the supply's **CC** lamp lights, the current stays at the limit and the voltage sags. So a wrong resistor on the bench doesn't burn the LED while you're testing: the meter shows the sagging voltage and the lamp shows why.
- **Submit** switches the supply to full power (the OUTPUT button), and that's what you meet inside. So the consequences happen at the moment of truth, where you can watch them, not in the middle of building.
- The solver needs one addition for this: a supply that switches to a current source at its limit (solve once as a voltage source; if the current is over the limit, solve again with the supply as a current source of the limit value). It's a small, testable change to `src/sim/`.

This replaces today's "an overloaded LED burns the moment you place the resistor". Building gets friendlier, and the drama moves inside.

### Level by level

| Level | A wrong choice… | …and what you see inside |
|---|---|---|
| 0–1 First light | 100 Ω (or less) | torrent through a wide, short passage: LED1 flashes and dies at once; the resistor (0.49 W) starts smoking: the breaker saves the resistor, not the LED |
| 0–2 Wrong way round | (turning it round is the fix) | on a 9 V variant: 9 V in reverse is over the 5 V limit, and the door cracks and burns (a harder bonus level later) |
| 0–3 Side by side | parallel LEDs | over the 20 mA budget the supply's limit holds, and both LEDs sit dim; with small resistors and no limit, one LED fails first (real LEDs are never quite equal, and the game gives each a small spread), then its partner takes the whole current: the domino |
| 0–4 Split the difference | tap too high | the sensor room overheats past 3.6 V; too-small resistors also cook themselves (a 100 Ω / 47 Ω divider on 9 V is over 0.25 W) |
| 0–5 Slow blink | electrolytic in backwards | the reservoir bulges and vents after a few seconds of charging: the breaker saves it |

## Power on and the end of the level

At the lift's panel, **Use** switches the power on (and anything over its limit starts to fail: see Stakes). Water pours from the top of the lift, runs down every ramp in turn, through each door (the LED rooms light in their own colour), and pools at the floor, then back to the lift. Speed and width follow the real current. Then the level is checked (`checkLevel`), and the stars appear in the world before the camera rises back out of the board to the bench.

Stars stay as they are on the bench (spec, no hints / nothing burnt, par); the run badges (above) are the inside's own score. There's no fail state: running out of spark sends you back to the lift, nothing more.

## HUD (the only things on screen)

- The step rail, top centre (step 4 lit).
- A small crosshair with the spark meter as a ring round it; the Use prompt appears under it only when something is usable.
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
- Stakes: ratings per part; stress bars match the solver at full power; LED failure is near-instant and can't be saved, resistor and capacitor failures can be stopped by the breaker in time; a failure is applied to the board and re-solved (burnt resistor goes open, parallel domino); the current-limited supply switches to a current source at its limit and the voltage sags.
- Challenge: passage width falls as R rises; lattice vibration follows the solver's power; the height after a resistor is the solver's, whatever the collisions; running out of spark respawns at the lift without changing the board; Easy passage removes knock-back and drain.

## Build plan

1. **Controller on the current ring**: WASD, mouse look with pointer lock, keyboard look, collisions against today's corridor walls and door. Nothing else changes. (Proves the feel early.)
2. **Voltage-as-height world**: `buildWorld`, plazas, ramps, lift, doors, chasms, heights from the solver; the landscape settles when a fix changes the voltages.
3. **Verbs**: Scan cone and tags, Use prompts (door, drawbridge, power panel), the objective line.
4. **Power on**: the water, rooms lighting in order, the check and the stars in the world, rising back out to the bench.
5. **Map and onboarding**: Tab schematic map with click-to-walk, the first-time controls card, touch controls, settings.
6. **The challenge**: resistor passages sized by R with the vibrating lattice and heat wisps, the spark meter, gremlins, respawn at the lift, run badges.
7. **Stakes**: part ratings and stress bars in scans, the current-limited bench supply (solver change + CC lamp + knob), failures on power-on with heating, cascades and the breaker; bench keeps the blackened parts to swap.
8. **Set pieces for every level**: the flood, smoke in burnt rooms, the reservoir platform (0–5), the divider ledge (0–4), Easy passage.

Each step is playable and committed on its own.

## Open questions for Mike

1. **Voltage as height**: the core of this spec. Yes, or keep the flat world?
2. **Direction**: downhill conventional current (recommended, it matches the height), or electron flow (you'd climb every ramp)?
3. **Fixing from inside**: only the fixes that make sense in place (turn a door, hold a bridge), as specced, or also carry parts in (e.g. lay a resistor ramp across a chasm)? Carrying parts is fun, but it blurs "build on the bench, test inside".
4. **Touch**: first-class now, or after the desktop feel is right?
5. **Free bench**: the same free-roam world for your own circuits (no scoring), as now?
6. **Enemies**: stray static in World 0 growing into interference (EMI) and ground bounce later, as specced? And do they chase, or only patrol? (Recommended: patrol in World 0, chase from World 1.)
7. **Run badges**: separate from the stars as specced (recommended, so the challenge never blocks learning), or fold the run into the third star?
8. **Current limit on the bench**: move the burning from the bench to the moment of truth inside, as specced (recommended), or keep LEDs burning on the bench the moment a wrong resistor goes in?
9. **Failure timing**: real-life order (LED instant, resistor seconds, capacitor seconds) scaled so it's watchable, as specced, or slow everything down so every part can be saved?
