/**
 * Debug panel (toggle in the bottom-right corner). Cheats and jumps for
 * playtesting: cash, heat, alarm, modifiers, intel, gear, crew, any screen,
 * any minigame, and a seed to start a run from.
 */

import { formatSeed, normalizeSeed } from '../core/rng';
import { isSfxLogging, setSfxLogging } from '../core/sfx';
import { CREW, CREW_IDS } from '../data/crew';
import { GEAR, GEAR_IDS } from '../data/gear';
import { INTEL, INTEL_IDS } from '../data/intel';
import { MODIFIERS, MODIFIER_IDS } from '../data/modifiers';
import type { TimeOfDay } from '../data/types';
import {
  addCash,
  addCrew,
  addGear,
  addIntel,
  changeLoyalty,
  endRun,
  finishHeist,
  removeCrew,
  removeGear,
  removeIntel,
  revealAllModifiers,
  revealModifier,
  setAlarm,
  setHeat,
  setModifierRolled,
  setOnEdge,
  setPartner,
  setTitleSeed,
  startAnte,
  startHeist,
  startRun,
} from '../game/actions';
import { heatTier } from '../game/heat';
import { game, subscribe, type ScreenId } from '../game/state';
import { MINIGAMES, MINIGAME_IDS } from '../minigames/registry';
import { SCREEN_IDS } from '../screens';
import { button } from './components';
import { h, money, render, type Child } from './dom';
import { goTo } from './router';

let open = false;
let panelEl: HTMLElement;
let pointerDown = false;
let drawTimer: number | null = null;
let drawAfterPointer = false;

export function mountDebug(root: HTMLElement): void {
  panelEl = h('div', { class: 'debug-panel' });
  const toggle = h(
    'button',
    {
      class: 'debug-toggle',
      title: 'Debug panel',
      onClick: () => {
        open = !open;
        panelEl.style.display = open ? '' : 'none';
        if (open) draw();
      },
    },
    'DEBUG',
  );
  panelEl.style.display = 'none';
  render(root, panelEl, toggle);

  // Don't rebuild while a click is in progress (it would swallow the click).
  window.addEventListener('pointerdown', () => (pointerDown = true), true);
  window.addEventListener('pointerup', () => {
    pointerDown = false;
    if (drawAfterPointer) {
      drawAfterPointer = false;
      queueDraw();
    }
  });
  subscribe(queueDraw);
}

/** Redraw soon (throttled), but never in the middle of a click. */
function queueDraw(): void {
  if (!open || drawTimer !== null) return;
  drawTimer = window.setTimeout(() => {
    drawTimer = null;
    if (pointerDown) drawAfterPointer = true;
    else draw();
  }, 120);
}

// --- helpers ----------------------------------------------------------------

/** Make sure there's a live run to poke at. */
function ensureRun(): void {
  if (game.run && !game.run.ended) return;
  startRun(game.titleSeed);
  setPartner('vera');
  startAnte(1);
}

function ensureHeist(time: TimeOfDay = 'night'): void {
  ensureRun();
  if (!game.run!.heist) startHeist(time);
}

function jump(id: ScreenId): void {
  switch (id) {
    case 'title':
      break;
    case 'partnerSelect':
      startRun(game.titleSeed);
      break;
    case 'runSummary':
      ensureRun();
      if (!game.run!.ended) endRun('quit');
      break;
    case 'heist':
    case 'escape':
      ensureHeist();
      break;
    case 'payout':
    case 'headline':
      ensureHeist();
      if (!game.run!.heist!.result) finishHeist({ kind: 'clean' });
      break;
    default:
      ensureRun();
  }
  goTo(id);
}

function section(title: string, ...children: Child[]): HTMLElement {
  return h('div', { class: 'debug-section' }, h('div', { class: 'debug-title' }, title), ...children);
}

const btn = (label: string, fn: () => void, title?: string) => button(label, fn, { small: true, title });

// --- render -------------------------------------------------------------------

function draw(): void {
  const scroll = panelEl.scrollTop;
  const r = game.run;
  const live = !!r && !r.ended;

  const seedInput = h('input', { class: 'seed-input small', value: formatSeed(game.titleSeed), spellcheck: false });

  render(
    panelEl,
    h('div', { class: 'debug-header' }, 'Debug', h('span', { class: 'muted' }, ` · screen: ${game.screen}`)),

    section(
      'Run',
      h('div', null, r ? `Seed ${formatSeed(r.seed)}${r.ended ? ` (ended: ${r.ended})` : ''}` : 'No run'),
      h(
        'div',
        { class: 'debug-row' },
        seedInput,
        btn('New run with seed', () => {
          const s = normalizeSeed(seedInput.value);
          if (s) setTitleSeed(s);
          jump('partnerSelect');
        }),
      ),
    ),

    live && r
      ? [
          section(
            `Cash ${money(r.cash)}`,
            h('div', { class: 'debug-row' }, btn('−$100', () => addCash(-100)), btn('+$100', () => addCash(100)), btn('+$1000', () => addCash(1000))),
          ),
          section(
            `Heat ${r.heat} (${heatTier(r.heat).label})`,
            h(
              'div',
              { class: 'debug-row' },
              btn('−10', () => setHeat(r.heat - 10)),
              btn('+10', () => setHeat(r.heat + 10)),
              [0, 30, 60, 85, 99, 100].map((v) => btn(`=${v}`, () => setHeat(v))),
            ),
          ),
          section(
            r.heist ? `Alarm ${Math.round(r.heist.alarm)}${r.heist.copsCalled ? ' (cops called)' : ''}` : 'Alarm (no heist)',
            r.heist
              ? h(
                  'div',
                  { class: 'debug-row' },
                  btn('+10', () => setAlarm(r.heist!.alarm + 10)),
                  [0, 50, 90, 100].map((v) => btn(`=${v}`, () => setAlarm(v))),
                )
              : h('div', { class: 'muted' }, 'Start a heist to set alarm.'),
          ),
          section(
            `Modifiers (ante ${r.ante.n})`,
            h('div', { class: 'muted small' }, 'Click: off → rolled (hidden) → revealed → off'),
            h(
              'div',
              { class: 'debug-row wrap' },
              MODIFIER_IDS.map((id) => {
                const rolled = r.ante.modifiers.includes(id);
                const revealed = r.ante.revealed.includes(id);
                const state = revealed ? 'revealed' : rolled ? 'hidden' : 'off';
                return h(
                  'button',
                  {
                    class: `btn small toggle ${state}`,
                    title: MODIFIERS[id].text,
                    onClick: () => {
                      if (state === 'off') setModifierRolled(id, true);
                      else if (state === 'hidden') revealModifier(id);
                      else setModifierRolled(id, false);
                    },
                  },
                  MODIFIERS[id].name,
                );
              }),
            ),
            h(
              'div',
              { class: 'debug-row' },
              btn('Reveal all', revealAllModifiers),
              btn(r.ante.onEdge ? 'On edge: ON' : 'On edge: off', () => setOnEdge(!r.ante.onEdge)),
            ),
          ),
          section(
            'Intel',
            h(
              'div',
              { class: 'debug-row wrap' },
              INTEL_IDS.map((id) => {
                const has = r.ante.intel.includes(id);
                return h(
                  'button',
                  { class: `btn small toggle ${has ? 'revealed' : 'off'}`, onClick: () => (has ? removeIntel(id) : addIntel(id)) },
                  INTEL[id].name,
                );
              }),
            ),
          ),
          section(
            `Gear (${r.gear.length})`,
            h('div', { class: 'debug-row wrap' }, r.gear.map((g) => btn(`× ${GEAR[g].name}`, () => removeGear(g), 'Remove'))),
            h('div', { class: 'debug-row wrap' }, GEAR_IDS.map((g) => btn(`+ ${GEAR[g].name}`, () => addGear(g)))),
          ),
          section(
            `Crew (${r.crew.length + 1} incl. you)`,
            r.crew.map((m) =>
              h(
                'div',
                { class: 'debug-row' },
                h('span', { class: 'debug-name' }, `${CREW[m.id].name} (${m.loyalty})`),
                btn('−10', () => changeLoyalty(m.uid, -10)),
                btn('+10', () => changeLoyalty(m.uid, 10)),
                btn('×', () => removeCrew(m.uid), 'Remove (not logged as lost)'),
              ),
            ),
            h('div', { class: 'debug-row wrap' }, CREW_IDS.map((id) => btn(`+ ${CREW[id].name}`, () => addCrew(id)))),
          ),
        ]
      : null,

    section('Quick heist', h('div', { class: 'debug-row' }, btn('Night heist', () => quickHeist('night')), btn('Day heist', () => quickHeist('day')))),

    section('Jump to screen', h('div', { class: 'debug-row wrap' }, SCREEN_IDS.filter((s) => s !== 'sandbox').map((s) => btn(s, () => jump(s))))),

    section(
      'Minigame sandbox',
      h(
        'div',
        { class: 'debug-row wrap' },
        MINIGAME_IDS.map((id) =>
          btn(MINIGAMES[id].name, () => {
            game.sandbox = { minigame: id, returnTo: game.screen === 'sandbox' ? game.sandbox.returnTo : game.screen };
            goTo('sandbox');
          }),
        ),
      ),
    ),

    section(
      'Audio hooks',
      btn(isSfxLogging() ? 'Log playSfx calls: ON' : 'Log playSfx calls: off', () => {
        setSfxLogging(!isSfxLogging());
        draw();
      }),
    ),
  );
  panelEl.scrollTop = scroll;
}

function quickHeist(time: TimeOfDay): void {
  ensureRun();
  startHeist(time);
  goTo('heist');
}
