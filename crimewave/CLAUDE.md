# CRIMEWAVE — notes for Claude Code

Greybox prototype of a roguelike heist game. **Read [`docs/CRIMEWAVE_DESIGN.md`](docs/CRIMEWAVE_DESIGN.md) first** — it is the spec. Build milestone by milestone (doc section 13) and stop after each one for a playtest. If something in the doc is unclear or seems wrong, ask instead of improvising.

This folder is self-contained. The repo root holds an unrelated app (a quiz show server); don't touch it.

## Stack

Vite + TypeScript, no game framework. Plain DOM for screens and HUD; `<canvas>` only where it helps (dial, viewfinder, hotwire). Ask before adding any library.

- `npm run dev` — play at http://localhost:5173
- `npm run typecheck` — run after every change
- `npm run build` — typecheck + build

## Layout

```
src/
  main.ts              boot: stage → fx → router → HUD → debug → title
  styles.css           all styles; palette tokens at the top
  config/balance.ts    EVERY tuning number, grouped by system
  data/                content as data (ids derive from object keys)
    partners.ts hires.ts crew.ts   crew definitions
    gear.ts intel.ts pois.ts modifiers.ts
    heists.ts          obstacles + day/night plans
    headlines.ts       headline templates by outcome tags
    roles.ts targets.ts types.ts
  core/                generic, no game knowledge
    rng.ts             seeded RNG (mulberry32 + string hash)
    events.ts          event bus for pop-ups / shakes / toasts
    sfx.ts             playSfx('name') — no-op hook for future audio
  game/                game logic, no DOM
    state.ts           THE game state + subscribe/notify
    actions.ts         every state change (addHeat, addAlarm, addGear, …)
    flow.ts            what screen comes next (the run loop)
    heat.ts scaling.ts payout.ts headlines.ts random.ts
  minigames/
    types.ts           the minigame contract
    runner.ts          runs a minigame: alarm tally, finish-once, abort
    registry.ts        id → MinigameDef (stubs until each milestone lands)
    stub.ts            placeholder minigame
  screens/             one file per screen; index.ts registers them
  ui/
    stage.ts           1280×720 logical stage, scaled + letterboxed
    router.ts          goTo(screen); also ends the run when heat hits 100
    hud.ts debug.ts fx.ts components.ts dom.ts
```

## Conventions

- **Numbers live in `config/balance.ts`.** Data files and logic import them; descriptions in data are template strings built from balance so they stay in sync. Never hard-code a tuning number elsewhere.
- **Content lives in `src/data/`.** Each file exports a typed record (`GEAR`, `MODIFIERS`, …) and its id type (`GearId`, …) derived from the keys. Adding an entry should not need new code where possible.
- **One central state** (`game` in `game/state.ts`). Screens read it directly. All writes go through functions in `game/actions.ts`, which call `notify()` (batched per microtask). Don't mutate state from screens.
- **Flow** goes through `game/flow.ts` — screens call `playBlind()`, `resolveEscape()`, etc., not `goTo()` for run progression.
- **Minigame contract** (`minigames/types.ts`): a minigame gets `{ root, params, rng, addAlarm, finish }` and returns `{ success, alarmDelta, heatDelta, loot, flags }`. It never touches global state. Alarm is reported live via `ctx.addAlarm(base, cause)` and the host applies multipliers (patrols, On edge, lookout, ante scaling). `start()` returns a cleanup. Each real minigame goes in `src/minigames/<name>.ts` and replaces its stub in `registry.ts`.
- **Seeded RNG:** never use `Math.random` (only `randomSeed()` does). Use `runRng('purpose', …keys)`; it derives an independent stream from the run seed + ante + key, so one part of the game can't shift another's rolls.
- **Screens** export `{ mount(root) }` and return a cleanup if they start timers, listeners or minigames. Rebuild DOM only when visible data changed (see `hud.ts` keyed sections) so buttons aren't replaced mid-click.
- **Mouse only.** No action may require the keyboard (typing a seed is optional).
- **Audio:** call `playSfx('name')` at key moments; add names to `SfxName` as needed.
- **Juice:** emit `{ type: 'stat' | 'shake' | 'toast' }` on the event bus; actions already emit stat deltas for cash/heat/alarm.
- Placeholder UI for a later milestone uses `placeholderNote('M3', '…')` so it's obvious in playtests.
- Small, well-named files. Match the existing style: 2-space indent, single quotes, short doc comment at the top of each file.

## Interpretations of the design doc (confirm with the user if they matter)

- Heat tiers don't stack in the doc's table; `balance.ts` spells out every tier fully. Hot and Manhunt keep Warm's +20% hire fee; Manhunt keeps Hot's +2 modifiers and the loyalty-check threshold of 40.
- The Walks / Snitches split for loyalty events isn't specified: 50/50 (`loyalty.snitchChance`).
- The getaway car takes a gear slot.
- Payout uses the heat tier *after* the heist's heat is added.
