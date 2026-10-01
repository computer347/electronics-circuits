# The workshop tycoon

Started 2026-10-01. The campaign stays, as **training**; the main motivation becomes running a
small electronics workshop: customers bring repairs and design requests, you do them on the
bench, get paid, and spend the money on tools and stock that let you take on harder work.

## The loop

**Job board → take a job → bench → deliver → paid → shop → harder jobs**

1. **Job board** (the corkboard): 3–5 requests each in-game day, generated from templates
   within your skill and tools, plus one *stretch* job above them for bonus pay.
2. **Bench**: the existing breadboard, meter and scope. Level specs judge the result.
3. **Deliver**: pay (below), reputation, and a returning customer now and then.
4. **Shop**: tools, part stock, bench upgrades.

## Money: pay follows cost

No job should set you up for life. Every price is tied to what the work costs:

- **Parts** are priced at about real hobby prices, in credits (1 credit ≈ €0.10): a resistor 1,
  an LED 2, a transistor 3, a 74HC chip 6, a regulator 8, a MOSFET 10.
- **Pay** for a job = `parts cost × 1.5 + labour`, where labour is the tier’s hourly rate × the
  job’s difficulty, × the stars (quality), + an on-time bonus. A tier-1 job pays ~20–40, a
  tier-4 one ~150–300.
- **Tools** cost about **6–10 jobs of the tier below** the tier they open. Buying the scope
  takes a few days of good work, not one lucky job.
- **Stock is consumed**: design jobs use parts from your stock; repairs use the replacements.
  A burnt LED or a cooked chip is money. Higher tiers use dearer parts, so the money keeps
  moving: you earn more, and you spend more to earn it.
- **No debt, no game over**: at worst you take a cheap job to restock.

`src/business/economy.ts` holds the numbers; `tests/business.test.ts` checks the invariants
(every tool costs 6–10 jobs of the tier below; pay always covers the parts; nothing pays
more than a tier’s top tool).

## Tools open tiers

| Tier | You buy | It opens |
|---|---|---|
| 0 | (start) basic meter (volts), bench supply, resistor and LED kit | LED and divider jobs |
| 1 | autoranging meter (Ω, diode test, mA) | finding reversed and wrong-value parts |
| 2 | semiconductor stock (diodes, transistors, pots) | switching, sensor and protection jobs |
| 3 | oscilloscope | timing (RC) jobs |
| 4 | logic chip stock, logic probe | logic design jobs |
| 5 | soldering station | board repairs (Uno, modules), screen jobs |

## The end goal: a career

There is an end: **Master Engineer**, and your own lab. The ladder:

| Rank | Needs |
|---|---|
| Hobbyist | (start) |
| Apprentice | 2 certificates |
| Technician | 5 certificates, 3 jobs, the autoranging meter |
| Engineer | 8 certificates, 5 jobs, the scope, reputation 40 |
| Senior Engineer | 10 certificates, 7 jobs, the soldering station, reputation 70 |
| Master Engineer | all 11 certificates, and every one with distinction or reputation 120 |

The job counts are low while the workshop has nine hand-made jobs; they rise once the job
board generates work (phase 2). The numbers live in `src/business/career.ts`.

**Certificates** are earned in training: each one is a group of campaign levels (pass them
all; three stars on every one earns it *with distinction*). They also open job templates of
their kind. **Achievements** reward ways of playing (no burns, on time, repeat customers,
full toolbox…). After Master Engineer the job board keeps going: endless mode, with records.

## Phases

1. **Business core** *(done)*: economy numbers (`src/business/economy.ts`), a business store
   (tools, stock, achievements; credits stay in the wallet), the shop, 11 certificates over all
   49 levels, 16 achievements with a toast, and the career page (`?` → Career, or key 5).
2. **Job generator**: 10–15 templates from existing levels, with parameters, fault injection,
   generated specs and a reference solution; the job board on the corkboard. Tests run
   thousands of seeds and check every generated job passes with its solution.
3. **Progression**: tier gating by tools and certificates, stretch jobs, returning customers.
4. **Balance**: a simulated player over 30 days, to tune pay against prices.
5. **Product line** (optional): batch-build a design you’ve sold, for income over time.

The circuit walk becomes optional: a “trace the fault” view rather than a step in every job.
