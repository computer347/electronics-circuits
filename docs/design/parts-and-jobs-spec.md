# Parts, boards and jobs: spec

Written 2026-10-01 from Mike's reference video (a repair-sim trailer: boards on a cutting mat, probing tiny SMD parts with tooltips that give their value range, a soldering station, a hotbar, a node-graph "Compile / Device" screen, story dialogue and an in-game clock). SIGNAL PATH takes the same ideas with its own twist: the riso UI, the four-step loop, and the circuit world where height is voltage.

Decisions (Mike): model **every part and board** the course needs, give **each part one test level** and **each activity one test level**, and bring over **board repair on the mat, a hotbar inventory, node-based coding, and story/client jobs**. Then carry on with the normal campaign.

## 1. The parts catalogue (models, all procedural)

One data file (`src/parts/catalogue.ts`) lists every part: name, family, package, value and tolerance, pins, the facts the notebook shows, and which 3D model draws it. Models live in `src/parts3d/`, one file per family, built in millimetres and scaled where they're placed.

| Family | Parts |
|---|---|
| Through-hole passives | resistor, ceramic capacitor, electrolytic capacitor, LED, signal diode (1N4148), rectifier diode (1N4007), potentiometer, push button, slide switch, AA cell, 9 V battery, piezo buzzer |
| Transistors and power | NPN transistor (BC547, TO-92), logic-level MOSFET (IRLZ44N, TO-220), 5 V regulator (LM7805, TO-220), 3.3 V LDO (AMS1117, SOT-223) |
| Surface mount | chip resistors (0402, 0603, 0805), chip capacitor (0603), chip LED (0603), SOT-23 transistor, SOIC-8 chip, QFP-32 and QFP-48 chips, crystal, USB-B and micro-USB sockets, pin headers, DC barrel jack |
| Boards and modules | Arduino Uno, ESP32 DevKit, ESP-01 (ESP8266), STM32 Blue Pill, RFID reader (RC522), 0.96" OLED, DHT11 sensor, HC-SR04 ultrasonic sensor, USB stick |

Every model gets a hover tooltip like the reference ("Resistor 0402 · 12 kΩ ±5 % · 11.4–12.6 kΩ"), a notebook close-up with callouts, and a place in the parts drawers.

## 2. Activities, each with one test level

| Activity | Where | Test level |
|---|---|---|
| Breadboard build | breadboard on the mat (exists) | (World 0) |
| **Board repair** | a real board on the mat: probe pads, read tooltips, find the part out of tolerance, desolder and replace it with the iron (hold E, progress bar), power on | "Dead power LED": an Arduino Uno whose power LED stays off; its 1 kΩ 0603 resistor has gone open |
| **Wiring job** | jumper wires from a module's pins to a board's headers, by pin name | "Hook up the sensor": DHT11 to the Arduino (VCC, DATA to pin 2, GND) |
| **Node coding** | a riso node graph for a microcontroller, then Compile and Upload to the board on the desk | "Blink": loop → pin 13 HIGH → wait 500 ms → LOW → wait, and the board's LED blinks |
| Circuit world | inside the circuit (exists) | (World 0) |
| **Client job** | a job card with a story ("my torch is dead"), an in-game clock, dialogue (hold E to continue), and payment in stars | "The dead torch": 0–8's circuit, framed as a job |

## 3. One test level per part: the Parts Lab

A short, templated level per catalogue part, in its own corkboard world ("Parts Lab"), so every model and simulation is exercised:
- **measure it** (resistors, capacitors, cells: read the value, compare with the tooltip range),
- **find its pins** (diodes, LEDs, transistors: diode mode on the meter finds the cathode, the base),
- **use it** (potentiometer: set 2.5 V; transistor and MOSFET: switch an LED; regulator: 9 V in, 5 V out),
- **repair it** (boards and modules: one fault each, found with the probes).

## 4. Hotbar inventory

A row of slots along the bottom of the screen replaces the parts tray: the level's parts and tools (probes, iron, wire), keys 1–8 to pick, the selected slot lit. It follows Hick's law: the level puts only what it needs in the bar, never more than eight slots.

## 5. What the simulator needs

- Potentiometer (two resistors with a wiper), slide switch (exists as a switch).
- NPN transistor and MOSFET: switch models first (off / saturated with Vbe 0.7 V and β for the transistor, a threshold and on-resistance for the MOSFET).
- Regulators: a voltage source with dropout, current-limited.
- Boards: each board model carries its own netlist (its power LED circuit, regulator, pin headers) so the probes read real voltages on its pads.
- Microcontrollers run the node program as a behaviour (pins driven high and low over time), not an instruction emulator; the spec's avr8js path stays for later.
- A diode mode on the meter.

## Build order (each batch committed on its own)

1. The catalogue data and every 3D model, with a parts gallery to test them (dev page).
2. Simulator additions: potentiometer, transistor, MOSFET, regulator, the meter's diode mode.
3. Hotbar inventory.
4. Board repair mode and its test level (Arduino Uno power LED).
5. Node coding, the board behaviour, and the Blink test level.
6. Wiring job test level (DHT11 to Arduino).
7. Client jobs: job cards, clock, dialogue; the torch job.
8. The Parts Lab: one templated level per part.
9. Back to the campaign: 0–10 transistor switch, then World 1.
