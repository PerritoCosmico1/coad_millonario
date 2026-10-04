/**
 * Persistent HUD (left sidebar): cash, heat + tier, ante + blind pips,
 * alarm (heists only), crew, gear, intel and a quit button.
 *
 * Built once; each section only rebuilds when its own data changes, and
 * meters update in place so their fills animate.
 */

import { B } from '../config/balance';
import { onEvent } from '../core/events';
import { CREW } from '../data/crew';
import { GEAR } from '../data/gear';
import { INTEL } from '../data/intel';
import { ROLES } from '../data/roles';
import { quitRun } from '../game/flow';
import { heatTier } from '../game/heat';
import { BLIND_IDS, currentBlind, game, subscribe, type ScreenId } from '../game/state';
import { button, meter } from './components';
import { h, money, render } from './dom';
import { floatText } from './fx';

/** Screens shown full-width, without the HUD. */
const NO_HUD: ScreenId[] = ['title', 'partnerSelect', 'runSummary'];

const BLIND_LABELS = { scouting: 'Scout', prep: 'Prep', heist: 'Heist' };

export function mountHud(root: HTMLElement, stage: HTMLElement): void {
  const cashValue = h('div', { class: 'hud-cash' });
  const heatMeter = meter({ color: 'var(--heat)', className: 'hud-meter' });
  const heatTierLabel = h('span', { class: 'tier' });
  const anteBox = h('div', { class: 'hud-ante' });
  const alarmMeter = meter({ color: 'var(--alarm)', className: 'hud-meter' });
  const alarmBox = h('div', { class: 'hud-block hud-alarm' }, h('div', { class: 'hud-label' }, 'Alarm'), alarmMeter.el);
  const crewBox = h('div', { class: 'hud-crew' });
  const gearBox = h('div', { class: 'gear-grid' });
  const intelBox = h('div', { class: 'hud-intel' });
  let quitArmed = false;
  const quitBtn = button('Quit run', () => {
    if (!quitArmed) {
      quitArmed = true;
      quitBtn.textContent = 'Really quit? Click again';
      setTimeout(() => {
        quitArmed = false;
        quitBtn.textContent = 'Quit run';
      }, 2500);
      return;
    }
    quitArmed = false;
    quitBtn.textContent = 'Quit run';
    quitRun();
  }, { variant: 'ghost', small: true });

  render(
    root,
    h('div', { class: 'hud-logo' }, 'CRIMEWAVE'),
    h('div', { class: 'hud-block' }, h('div', { class: 'hud-label' }, 'Cash'), cashValue),
    h('div', { class: 'hud-block' }, h('div', { class: 'hud-label' }, 'Heat ', heatTierLabel), heatMeter.el),
    h('div', { class: 'hud-block' }, anteBox),
    alarmBox,
    h('div', { class: 'hud-block grow' }, h('div', { class: 'hud-label' }, 'Crew'), crewBox),
    h('div', { class: 'hud-block' }, h('div', { class: 'hud-label' }, 'Gear'), gearBox),
    h('div', { class: 'hud-block' }, intelBox),
    h('div', { class: 'hud-footer' }, quitBtn),
  );

  const keys: Record<string, string> = {};
  /** Rebuild a section only when its key changes. */
  const section = (name: string, key: string, build: () => void) => {
    if (keys[name] === key) return;
    keys[name] = key;
    build();
  };

  const update = () => {
    const r = game.run;
    const visible = !!r && !r.ended && !NO_HUD.includes(game.screen);
    stage.classList.toggle('has-hud', visible);
    if (!r || !visible) return;

    section('cash', String(r.cash), () => (cashValue.textContent = money(r.cash)));

    const tier = heatTier(r.heat);
    heatMeter.set(r.heat, `${Math.round(r.heat)}`);
    section('tier', tier.id, () => {
      heatTierLabel.textContent = tier.label;
      heatTierLabel.className = `tier tier-${tier.id}`;
    });

    const cur = currentBlind(r.ante);
    section('ante', JSON.stringify([r.ante.n, r.ante.blinds, cur]), () =>
      render(
        anteBox,
        h('div', { class: 'hud-label' }, `Ante ${r.ante.n}`),
        h(
          'div',
          { class: 'pips' },
          BLIND_IDS.map((b) =>
            h('span', { class: `pip ${r.ante.blinds[b]} ${b === cur && r.ante.blinds[b] === 'pending' ? 'current' : ''}` }, BLIND_LABELS[b]),
          ),
        ),
      ),
    );

    const h_ = r.heist;
    const inHeist = !!h_ && (game.screen === 'heist' || game.screen === 'escape');
    alarmBox.style.display = inHeist ? '' : 'none';
    if (h_ && inHeist) {
      alarmMeter.set(h_.alarm, h_.copsCalled ? 'COPS' : `${Math.round(h_.alarm)}`);
      alarmBox.classList.toggle('cops', h_.copsCalled);
    }

    section('crew', JSON.stringify([r.crew, h_?.roles]), () =>
      render(
        crewBox,
        h('div', { class: 'crew-chip you' }, h('div', { class: 'crew-name' }, 'You'), h('div', { class: 'crew-role' }, 'Inside')),
        r.crew.map((m) => {
          const def = CREW[m.id];
          const role = h_?.roles[m.uid];
          return h(
            'div',
            { class: 'crew-chip', title: `${def.name}, ${def.title} — ${def.perkText}` },
            h('div', { class: 'crew-name' }, def.name),
            h('div', { class: 'crew-role' }, role ? ROLES[role].name : `prefers ${ROLES[def.preferredRole].name}`),
            h('div', { class: 'loyalty' }, h('div', { class: 'loyalty-fill', style: `width:${m.loyalty}%` }), h('span', null, `Loyalty ${m.loyalty}`)),
          );
        }),
      ),
    );

    section('gear', r.gear.join(','), () => {
      const slots = [];
      for (let i = 0; i < B.run.gearSlots; i++) {
        const g = r.gear[i];
        slots.push(g ? h('div', { class: 'gear-slot', title: `${GEAR[g].name} — ${GEAR[g].text}` }, GEAR[g].name) : h('div', { class: 'gear-slot empty' }));
      }
      render(gearBox, slots);
    });

    section('intel', r.ante.intel.join(','), () =>
      render(
        intelBox,
        r.ante.intel.length ? h('div', { class: 'hud-label' }, 'Intel') : null,
        r.ante.intel.map((i) => h('div', { class: 'intel-item', title: INTEL[i].text }, INTEL[i].name)),
      ),
    );
  };

  subscribe(update);
  update();

  onEvent((e) => {
    if (e.type !== 'stat' || !stage.classList.contains('has-hud')) return;
    const sign = e.delta > 0 ? '+' : '−';
    const abs = Math.abs(Math.round(e.delta));
    if (abs === 0) return;
    if (e.stat === 'cash') floatText(cashValue, `${sign}${money(abs)}`, e.delta > 0 ? 'good' : 'bad');
    if (e.stat === 'heat') floatText(heatMeter.el, `${sign}${abs} heat`, e.delta > 0 ? 'bad' : 'good');
    if (e.stat === 'alarm') floatText(alarmMeter.el, `${sign}${abs}`, e.delta > 0 ? 'bad' : 'good');
  });
}
