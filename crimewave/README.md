# CRIMEWAVE

A mouse-only 2D roguelike about pulling off a spree of heists. This is a **greybox prototype** of ante 1 (the liquor store), built to find out whether the core loop is fun.

Design doc: [`docs/CRIMEWAVE_DESIGN.md`](docs/CRIMEWAVE_DESIGN.md).

## Run it

Needs Node 20.19+ (or 22.12+).

```bash
cd crimewave
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Other scripts:

- `npm run typecheck` — TypeScript check only
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — serve the production build

## Playtesting

- **DEBUG** button (bottom-right corner) opens the debug panel: add cash, set heat and alarm, toggle and reveal modifiers, give intel, gear or crew, jump to any screen, run any minigame in a sandbox, or start a quick day or night heist.
- **Seeds:** the title screen shows the run seed. Type one to replay a run. The run summary has a "Replay this seed" button.
- **Tuning:** every number is in `src/config/balance.ts`.

## Milestones

| | Milestone | Status |
|---|---|---|
| M0 | Skeleton: state, every screen clickable end to end, HUD, debug panel, seeded RNG | ✅ |
| M1 | Night heist: lockpick, keypad, safe dial, alarm, patrols, cops countdown | — |
| M2 | Day heist and escape: crowd control, stick-up, chase | — |
| M3 | Scouting and prep: viewfinder, pickpocket, hotwire, modifiers, intel | — |
| M4 | The run: safehouse, roles, payout cuts, loyalty, heat tiers, scaling | — |
| M5 | Feel pass | — |
