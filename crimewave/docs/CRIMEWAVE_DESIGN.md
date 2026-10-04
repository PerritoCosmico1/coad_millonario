# CRIMEWAVE — Ante 1 Prototype Design Doc

> **For Claude Code:** Read this whole document before writing any code. You are building a **greybox prototype** of a roguelike heist game. The only goal right now is to find out whether the core loop is fun. Build it milestone by milestone (section 13) and stop after each one so I can playtest. Names and numbers here are starting points meant to be tuned. If something is unclear or seems wrong, ask me before improvising.

---

## 1. The pitch

CRIMEWAVE is a mouse-only, 2D roguelike about pulling off a spree of heists. You start as a duo — you and a partner in crime, Bonnie & Clyde style — hitting a small liquor store, and work your way up to the biggest, safest bank in the city.

Every target is cased, prepped and robbed through short minigames, solved with whatever gear and crew you have. Every obstacle can be done **quiet** (skill and time) or **loud** (fast, but it draws attention). Heat carries across the whole run: going loud now makes everything after harder. Crew take a cut of the money and have loyalty you can keep — or betray.

The run structure borrows Balatro's progression: **antes** made of a small blind, a big blind and a boss blind. Here, each ante is one target.

**This prototype covers ante 1 only: the liquor store.** After clearing it, the player can replay the liquor store as the next ante with higher difficulty and everything carried over, so we can test how heat, cash and crew evolve across a run. No art, no audio.

---

## 2. Design pillars

Use these to settle any decision this doc doesn't cover.

1. **A heist movie in every ante.** Case it, prep it, pull it.
2. **Every obstacle has a quiet way and a loud way.** Quiet = play the minigame (time + skill). Loud = fast, but costs alarm and heat.
3. **Heat is your health bar.** Loud now means harder later.
4. **Who you have and what you carry change how minigames play.** Crew and gear *modify* minigames; they rarely skip them.
5. **Crew is a tradeoff.** More people cover more roles, but everyone takes a cut and has loyalty.
6. **Short and punchy.** Every minigame lasts roughly 10–30 seconds.

---

## 3. Run structure

**Run** = a sequence of antes. **Ante** = one target.
Future ladder (not in prototype): liquor store → pawn shop → jewelry store → armored truck → casino → bank.

Each ante:

| Step | Balatro equivalent | What happens | Reward | Skippable? |
|---|---|---|---|---|
| **Scouting job** | Small blind | Case the store with 2 minigames | Intel: reveals heist modifiers, can give intel items | Yes. Skip reward: +$50, modifiers stay hidden |
| **Safehouse** | Shop | Buy gear, hire crew, lay low | — | — |
| **Prep job** | Big blind | Steal a getaway car | Getaway car | Yes. Skip reward: +$75, no car |
| **Safehouse** | Shop | Same as above | — | — |
| **The heist** | Boss blind | Choose day or night, assign roles, pull the job, escape | Loot | No |
| **Payout** | — | Fence the loot, pay cuts, loyalty changes | Cash | — |
| **Headline** | — | Newspaper headline summarizing the job | Flavor / lore seed | — |

**Run ends** when heat reaches 100 (Busted). There's no win condition in the prototype — keep going ante after ante to see how far the numbers hold up. Show a run summary on Busted or when the player quits (antes cleared, total cash earned, crew lost).

---

## 4. Resources and meters

- **Cash ($)** — starts at $200.
- **Heat (0–100, run-wide)** — persists across jobs and antes. Tiers in section 7.
- **Alarm (0–100, per heist)** — resets every heist. Fills from loud methods, mistakes, the crowd and passive ticks. At 100 the cops are called.
- **Suspicion (0–100, per scouting/prep minigame)** — local meter used by scouting and prep minigames instead of alarm.
- **Intel** — the list of revealed heist modifiers, plus intel items (Keypad code, Manager's keys).
- **Gear** — inventory with 6 slots. Permanent unless marked consumable.
- **Crew** — you + your partner + hires. Max 4 people total in the prototype.
- **Loot** — collected during the heist; converted to cash at payout through the fence.

---

## 5. Crew and roles

### Roles in a heist

Before each heist, every crew member except you is assigned one role. Uncovered roles simply don't apply. As a duo you can only cover **one** role — that's the intended tension.

| Role | Effect | In preferred role |
|---|---|---|
| **Inside** | Always you. You play the minigames. | — |
| **Lookout** | Alarm gains −20%. Warns before night patrols (3s warning). | −30% alarm, 5s warning |
| **Muscle** | Crowd bravery grows 40% slower (day heists). | 60% slower |
| **Driver** | Requires the getaway car. Chase decision time +40%. | +60% |

If you have the getaway car but no Driver, you drive yourself: normal chase, no bonus. No car at all = escape on foot (longer chase).

Every crew member has: **name, preferred role, perk, cut %, loyalty (0–100)**, and for hires, a **hire fee**.

### Starting partner (chosen at the start of the run, like Balatro's decks)

Placeholder names — final names and lore are TBD.

| Partner | Preferred role | Perk | Cut | Starting loyalty |
|---|---|---|---|---|
| **Vera, the Charmer** | Lookout | Pickpocket: target's attention rises 30% slower. Viewfinder: suspicion rises 30% slower. | 40% | 70 |
| **Moose, the Brute** | Muscle | All loud methods cost 25% less alarm. | 40% | 70 |
| **Ziggy, the Tech** | Lookout | Cancels the "Extra camera" modifier. Keypad code stays on screen 1s longer. Hotwire timer +4s. | 40% | 70 |

### Hires (safehouse hire board shows 2 random from this pool)

| Hire | Preferred role | Perk | Fee | Cut | Starting loyalty |
|---|---|---|---|---|---|
| **Lefty, the wheelman** | Driver | Chase: first wrong turn is forgiven. | $120 | 15% | 50 |
| **Big Sal, the muscle** | Muscle | Intimidating civilians adds no heat. | $100 | 15% | 50 |
| **Nina, the lookout** | Lookout | Night patrols pass 30% less often. | $100 | 15% | 50 |

### Cuts and payout

- At payout, total loot × fence rate (section 7) = the **pot**.
- Each crew member's cut is a % of the pot. You keep the rest (that's your cash).
- For each crew member, the player chooses **Pay full** or **Short them** (pay half their cut).

### Loyalty

- Paid full: **+10** loyalty.
- Shorted: **−25** loyalty.
- **Loyalty check:** at the start of each heist (on the role screen), any member below **30** loyalty (below **40** at Hot heat or higher) has a 50% chance of an event, shown as a short text card:
  - **Walks** — leaves the crew, taking nothing.
  - **Snitches** — leaves the crew and +15 heat.
- **Leave them behind:** if you get caught in a chase, you can leave a crew member behind to escape with the loot (section 6.8). They're removed from the crew and logged as "Arrested". Every remaining crew member loses 15 loyalty — they saw that.

---

## 6. Minigames

All mouse-only. Each minigame is a self-contained module (see section 12). Before each obstacle, show two buttons: **Quiet** (play the minigame) and **Loud** (fast, costs alarm/heat). All numbers below are starting values and live in the config file.

### Scouting job (small blind)

Order: Viewfinder first, then Pickpocket.

#### 6.1 Case the joint — Viewfinder

- **Screen:** a static side view of the store interior made of placeholder boxes (counter, register, keypad, back door, safe through the office window, ceiling camera, alarm panel, customers in line).
- **Play:** the mouse is a camera viewfinder (a rectangle). Points of interest (POIs) light up in different spots for a few seconds at a time. Hold the left mouse button while the viewfinder frames a lit POI for **1s** to snap it.
- **Suspicion:** rises **12/s** while the mouse button is held (camera up), drops **8/s** when released. At 100 you're spotted: scouting ends early and the heist gets the **On edge** modifier.
- **Time limit:** 30s.
- **Result:** each POI is tied to one modifier (section 8). Snapping it reveals that modifier if it was rolled, or shows "Nothing unusual" if not. Snapping the **keypad** gives the **Keypad code** intel item.
- **Loud — "Ask around":** reveals 1 random rolled modifier instantly, +5 heat, adds **On edge**.
- **Mods:** Vera: suspicion rises 30% slower.

#### 6.2 Pickpocket — Lift the manager's keys

- **Screen:** the store manager standing, with an attention meter over their head that rises and falls in a semi-random pattern (looking around, getting distracted).
- **Play:** drag your hand in from the edge of the screen into the pocket zone and hold it there. A progress bar fills only while your hand is inside; **2.0s** total fills it. If attention goes above **60%** while your hand is in the pocket, you're caught.
- **Success:** get the **Manager's keys** intel item (skips the lockpick on the back door at night or the office door during the day).
- **Caught:** +5 heat and the heist gets **On edge**.
- **Loud — "Grab and run":** always succeeds (you get the keys), +10 heat, adds **On edge**.
- **Mods:** Vera: attention rises 30% slower.

### Prep job (big blind)

#### 6.3 Hotwire — Steal the getaway car

- **Screen:** a steering column panel with 3 colored wires on the left and 3 on the right, shuffled.
- **Play:** drag from each left wire to its matching right wire. **15s** timer. A wrong connection sparks and costs 2s.
- **Suspicion:** a passerby meter rises slowly over time. At 100, or when time runs out: fail — no car, +5 heat.
- **Success:** get the **Getaway car** item.
- **Loud — "Smash and grab":** break the window, auto-success, +10 heat.
- **Mods:** Ziggy: +4s.

### The heist (boss blind)

#### Heist setup: day or night

Before the heist, the player chooses when to hit:

- **Night (quiet-friendly):** store closed. No crowd. Locked doors, register locked behind a keypad, patrols pass by outside. Passive alarm +0.5/s.
- **Day (loud-friendly):** a stick-up during open hours. Register is opened by the clerk, but there's a crowd to control the whole time. No passive alarm (the crowd is the pressure).

Obstacle sequences:

- **Night:** Back door → Register (keypad) → Safe → Exit
- **Day:** Register (stick-up, starts crowd control) → Office door → Safe → Exit

After the first obstacle, a **"Grab what you have and go"** button is always available between obstacles — push your luck or leave with what you've got.

**Night patrols:** every ~25s (±5s) a patrol car passes outside for 4s. During a patrol, loud actions and minigame mistakes cost double alarm. A Lookout shows a "PATROL" warning before it arrives.

**Cops called:** when alarm hits 100, a **10s countdown** starts. You can keep working (to grab more) until it runs out, then you're forced into a chase. Leaving any time after alarm hits 100 also means a chase.

#### 6.4 Lockpick — Doors (back door at night, office door during the day)

- **Play:** one horizontal bar per pin. A marker slides back and forth; click when it's inside the green sweet spot. **3 pins.** A miss costs +5 alarm and resets that pin.
- **Loud — "Kick the door":** instant, +25 alarm.
- **Mods:** Manager's keys skip this obstacle entirely. Without the Lockpick set, only Loud is available.

#### 6.5 Register

- **Night — keypad:** a 4-digit code flashes for **1.5s**, then the player clicks the digits on a keypad. Wrong code: +8 alarm and the code flashes again. With the **Keypad code** intel item, the code stays on screen the whole time.
  - **Loud — "Pry it open":** hold the mouse button for 3s, +20 alarm.
  - **Mods:** Ziggy: code shows 1s longer.
- **Day — stick-up:** no minigame. The clerk opens the register when threatened. This is the moment crowd control starts.
- **Loot:** $150–300.

#### 6.6 Safe dial — The back office safe

- **Screen:** a big dial numbered 0–99.
- **Play:** drag in a circle around the dial to rotate it. When the dial passes within **±3** of the current target number, the dial "clicks" (a visual pulse; sound later). Release and click **Confirm** to lock in that number. **3 numbers.** A wrong confirm costs +5 alarm and restarts the current number.
- **Loud — "Crowbar":** hold the mouse button for **8s** (4s with the Drill). Alarm rises +4/s while holding.
- **Mods:** Stethoscope: tolerance ±5 and a bigger pulse.
- **Loot:** $400–800.

#### 6.7 Crowd control — overlay (day heists only)

This runs **at the same time** as the other day-heist obstacles, in a side panel. Splitting attention between the minigame and the crowd is the core Bonnie & Clyde test.

- **Panel:** 5 civilians, each a box with a bravery bar.
- **Bravery** grows over time; each civilian takes a random 8–15s to fill from 0 to 100.
- **At 100 the civilian acts**, then disappears from the panel:
  - 60%: **calls the cops** — +25 alarm.
  - 40%: **runs out the door** — +15 alarm, +5 heat.
- **Click a civilian to intimidate them:** bravery resets to 0. Each intimidation adds +1 heat (witnesses remember you).
- **Mods:** Muscle role slows bravery growth (section 5). Big Sal: intimidation adds no heat. Smoke bomb: freezes all bravery for 6s.

#### 6.8 Escape

- **Clean exit** (alarm below 100 when you leave): no minigame.
- **Chase** (alarm reached 100): a sequence of **5 intersections** (**7** on foot without the getaway car). At each one, three arrows: left / straight / right. One or two directions are blocked by cops.
  - **Hint:** a police scanner line says which way is blocked. With a Driver or the Police scanner gear, the hint is exact ("Units blocking LEFT"). Without, it's vague ("Units heading somewhere west…").
  - **Time:** 2.0s per intersection (Driver bonus applies). A wrong turn or a timeout is a **strike**. **2 strikes = caught.**
  - Successfully escaping a chase: +10 heat.
- **Caught:** the player chooses:
  - **Drop the bag** — lose 60% of the loot, escape.
  - **Leave [crew member] behind** — keep the loot; that member is arrested (section 5).

---

## 7. Heat

- **After the heist:** heat += round(alarm at the end × 0.3), plus any flat heat from events during the heist.
- **Scouting and prep** don't use alarm; they only add the flat heat listed in their minigames.
- **Ski masks** reduce heat gained from a heist by 25%.
- **Lay low** (safehouse): pay $100 → −15 heat. Repeatable.
- **No passive heat decay** in the prototype — cooling off costs money.

| Heat | Tier | Effects |
|---|---|---|
| 0–29 | **Cold** | Fence pays 100%. |
| 30–59 | **Warm** | Heist rolls +1 modifier. Hire fees +20%. Fence pays 90%. |
| 60–84 | **Hot** | Heist rolls +2 modifiers. Fence pays 80%. Loyalty checks trigger below 40. |
| 85–99 | **Manhunt** | Every heist starts with alarm at 25. Fence pays 60%. |
| 100 | **Busted** | Run over. |

---

## 8. Heist modifiers (the boss blind "curses")

At the start of each ante, roll **2 modifiers** (plus heat tier extras) from this pool. They show as **"???"** until revealed by scouting. Any unrevealed modifier is a surprise that appears during the heist (show a short banner when it kicks in).

| Modifier | Effect | Revealed by photographing |
|---|---|---|
| **Shotgun under the counter** | Day: the clerk joins the crowd panel with 2× bravery growth; if he acts: +40 alarm. | Counter |
| **Time-lock safe** | The safe can't be opened until 45s into the heist. | Safe |
| **Silent alarm** | The first mistake or loud action in the heist adds +20 extra alarm. | Alarm panel |
| **Off-duty cop in line** | Day: one civilian is a cop with 2× bravery growth; if he acts: alarm jumps to 100. | Customers |
| **Extra camera** | Passive alarm +0.5/s (day and night). Ziggy cancels it. | Ceiling camera |
| **Guard dog out back** | Night: loud methods cost 1.5× alarm. | Back door |
| **Dye pack** | Register loot −50%. If revealed beforehand, you avoid it — no loss. | Register |
| **Reinforced safe** | Safe needs 4 numbers; crowbar takes 12s (6s with Drill). | Safe |

**On edge** (from scouting going wrong): alarm gains +15% during the heist. Not part of the random pool.

If two rolled modifiers share a POI (e.g. both safe modifiers), one photo reveals both.

---

## 9. Gear (safehouse shop)

The shop shows **3 random items** from the pool each visit (excluding permanent items you already own). Reroll: $20.

| Item | Effect | Price |
|---|---|---|
| **Lockpick set** | Starting gear. Required for quiet lockpicking. | Start |
| **Stethoscope** | Safe dial tolerance ±5 and a bigger pulse. | $80 |
| **Drill** | Loud safe method takes half the time. | $150 |
| **Ski masks** | Heat from heists −25%. | $60 |
| **Police scanner** | Chase hints are always exact. | $100 |
| **Smoke bomb** *(consumable)* | During crowd control: click to freeze all bravery for 6s. | $40 |
| **Getaway car** | Only from the prep job. Needed for a Driver and the shorter chase. Burned after each heist — steal a new one in the next prep job. | — |

---

## 10. Economy and scaling

- Starting cash: **$200**.
- Loot: register **$150–300**, safe **$400–800**.
- Skip rewards: scouting **+$50**, prep **+$75**.
- **Ante scaling** for ante *n* (repeating the liquor store):
  - Loot × 1.5^(n−1)
  - Alarm gains × 1.2^(n−1)
  - Minigame windows (sweet spots, tolerances, timers, flash times) × 0.9^(n−1)
  - Modifiers rolled: 2 + floor((n−1)/2), plus heat tier extras
- Shop prices and hire fees stay fixed for now (except the Warm heat surcharge).

---

## 11. Screens and flow

1. **Title** — "CRIMEWAVE", New run button, seed shown.
2. **Pick your partner** — 3 cards (Vera, Moose, Ziggy) with role, perk and cut.
3. **Ante intro** — target card: Liquor store, loot range, modifiers shown as "???" × N.
4. **Blind select** — 3 cards in a row (Scouting / Prep / Heist), current one highlighted. Play or Skip on the first two, showing the skip reward. Layout inspired by Balatro's blind select.
5. **Scouting / prep minigame screens** (section 6).
6. **Safehouse** — shop (3 items + reroll), hire board (2 hires), Lay low button, crew list with loyalty, Continue.
7. **Heist setup** — Day or Night choice (one line describing each), role assignment (click a crew member, then a role slot), revealed modifiers list, loyalty check events, Go.
8. **Heist** — obstacle sequence with Quiet/Loud choice before each obstacle, alarm meter always visible, crowd panel on the side during day heists, "Grab what you have and go" between obstacles.
9. **Escape** — clean exit card, or the chase.
10. **Payout** — loot → fence rate → pot; per-member cut with Pay full / Short buttons; loyalty changes shown.
11. **Headline** — a newspaper-style card with a templated headline chosen by outcome tags (see below). This is the seed of the future lore system.
12. **Next ante** or **Run summary**.

**Persistent HUD:** cash, heat meter with tier label, ante number + blind progress pips, crew chips (name, role, loyalty), gear slots. The alarm meter shows only during heists.

**Headline templates** (store in data; tags: `night`, `day`, `quiet`, `loud`, `clean`, `chase`, `droppedBag`, `leftBehind`). Starting examples:
- night + quiet + clean: "Liquor store robbed overnight — police baffled"
- day + loud + clean: "Masked pair hold up downtown liquor store in broad daylight"
- chase: "High-speed chase follows liquor store robbery; suspects still at large"
- droppedBag: "Robbers flee empty-handed after police chase"
- leftBehind: "One suspect arrested after liquor store heist — partner escapes"
- Ante 2+: reference the streak ("Second hit in a week: is a new crew working the city?")

---

## 12. Technical requirements

- **Stack:** web prototype with **Vite + TypeScript**. No game framework needed — plain DOM for screens and HUD, HTML canvas only where it helps (dial, viewfinder, hotwire). If you strongly think a small library would make this simpler, propose it and wait for my approval.
- **Running it:** `npm install`, then `npm run dev`, then play in the browser.
- **Mouse only.** No action should require the keyboard.
- **Resolution:** logical 1280×720, scaled to fit the window, letterboxed.
- **All tuning numbers in one file:** `src/config/balance.ts`, grouped by system with short comments, so I can tweak numbers without touching game logic.
- **All content as data:** `src/data/` for partners, hires, gear, modifiers, POIs and headlines. Adding a new gear item or modifier should mean adding a data entry, not writing new code, as much as possible.
- **Minigame contract:** each minigame lives in `src/minigames/<name>.ts` with a common interface. It receives its params (from balance + active modifiers + crew + gear) and returns a result like `{ success, alarmDelta, heatDelta, loot, flags }`. Minigames never edit global game state directly.
- **One central game state.** Screens read from it; changes go through small, clearly named functions (`addHeat`, `addAlarm`, `payCrew`, `addGear`, etc.).
- **Seeded RNG** for everything random. Show the seed on the title screen and in the debug panel; allow entering a seed to replay a run.
- **Debug panel:** a small toggle button in a corner. Add cash, set heat, set alarm, reveal all modifiers, give any gear, add/remove crew, jump to any screen or minigame. Essential for playtesting.
- **Greybox visuals:** flat colored rectangles, readable text, one simple dark palette, clear hover states. No images and no sounds yet — but add a no-op `playSfx('name')` hook at key moments (clicks, dial clicks, alarm spikes) so audio can be added later.
- **Cheap juice is welcome:** floating number pop-ups for alarm/heat/cash, a small shake on mistakes, meters that animate when they change.
- **Docs:** a short `README.md` (how to run) and a `CLAUDE.md` (project structure, conventions, where things live) that points to this design doc.
- **Code style:** small, well-named files. I'll be editing this with Claude Code across many sessions.

---

## 13. Milestones

Stop after each milestone, tell me how to test it, and wait for my feedback before continuing.

- **M0 — Skeleton.** Project setup, central game state, every screen in the flow as a placeholder you can click through end to end, HUD, debug panel, seeded RNG.
- **M1 — Night heist.** Lockpick, register keypad, safe dial, Quiet/Loud per obstacle, alarm, patrols, cops-called countdown, clean exit, loot. Playable on its own from the debug panel.
- **M2 — Day heist and escape.** Crowd control overlay, stick-up flow, chase, Drop the bag / Leave someone behind.
- **M3 — Scouting and prep.** Viewfinder, pickpocket, hotwire, modifier rolling and revealing, intel items, skips with rewards, surprise banners for unrevealed modifiers.
- **M4 — The run.** Partner select, safehouse (shop, hires, lay low), role assignment, payout with cuts and loyalty, loyalty events, heat tiers, headline, next-ante scaling, run summary.
- **M5 — Feel pass.** Tune numbers based on my playtest notes, add juice, improve readability.

---

## 14. What I'm testing (playtest questions)

- Is a single heist fun even as grey boxes?
- Do quiet and loud feel like real choices, or is one always better?
- Does crowd control running alongside a minigame create good tension, or just stress?
- Is scouting worth it, or do I always skip it?
- Does each starting partner make the run feel different?
- Does heat make me play differently on the second and third ante?
- Do I ever actually want to short someone or leave them behind?

---

## 15. Out of scope for now

- Multiplayer of any kind.
- Art, animation, music, sound effects.
- Any target other than the liquor store.
- A city map or route planning between targets; armored truck events.
- The detective / case file system beyond the headline stub.
- Meta-progression between runs; saving.

---

## 16. Parking lot (future ideas — don't build yet)

- Target ladder: pawn shop, jewelry store, armored truck, casino, bank — each with its own minigames and modifiers.
- A city map between antes with optional opportunity nodes (e.g. an armored truck passing for only two turns).
- A detective who studies your habits and adapts (always loud → armed guards; always through the back → sensors on the back doors), building a case file that becomes the story of your run.
- Arrested crew members coming back later as informants or out for revenge.
- Pixel art and a move to a proper engine (likely Godot) once the loop is proven.
- Multiplayer as asynchronous sabotage (moles, leaked plans, rival crews) — only after single-player is great.
