/**
 * The heist: obstacle sequence with a Quiet / Loud choice before each one.
 * M0: steps through the plan with stub minigames and flat loud alarm. Real
 * minigames, patrols, passive alarm and the cops countdown arrive in M1;
 * crowd control in M2.
 */

import { B } from '../config/balance';
import { GEAR } from '../data/gear';
import { HEIST_PLANS, OBSTACLES, type ObstacleId } from '../data/heists';
import { INTEL } from '../data/intel';
import { addAlarm, grabLoot, hasGear, hasIntel, markLoud, nextObstacle } from '../game/actions';
import { leaveHeist } from '../game/flow';
import { heist, subscribe } from '../game/state';
import type { RunningMinigame } from '../minigames/runner';
import type { MinigameId } from '../minigames/types';
import { button, placeholderNote, screenTitle } from '../ui/components';
import { h, money, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { hostMinigame } from './common';

export const heistScreen: Screen = {
  mount(root) {
    const plan = HEIST_PLANS[heist().time];
    let running: RunningMinigame | null = null;
    let note = '';

    const sequence = h('div', { class: 'sequence' });
    const main = h('div', { class: 'stage-area' });
    const bag = h('div', { class: 'bag' });
    const footer = h('div', { class: 'heist-footer' });

    const drawSequence = () => {
      const step = heist().step;
      render(
        sequence,
        [...plan.obstacles, 'exit' as const].map((o, i) =>
          h('div', { class: `seq-item ${i < step ? 'done' : i === step ? 'current' : ''}` }, o === 'exit' ? 'Exit' : OBSTACLES[o].name),
        ),
      );
    };

    let footerKey = '';
    const drawFooter = () => {
      const h_ = heist();
      const canBail = h_.step > 0 && h_.step < plan.obstacles.length && !running;
      // Only rebuild when something visible changed, so buttons don't swap mid-click.
      const key = `${h_.loot}|${h_.copsCalled}|${canBail}`;
      if (key === footerKey) return;
      footerKey = key;
      bag.textContent = `Bag: ${money(h_.loot)}`;
      render(
        footer,
        bag,
        h_.copsCalled ? h('div', { class: 'cops-banner' }, 'Cops called! (The 10s countdown arrives in M1.)') : null,
        canBail ? button('Grab what you have and go', leaveHeist, { variant: 'ghost' }) : null,
      );
    };

    const clearObstacle = (id: ObstacleId, how: string) => {
      const def = OBSTACLES[id];
      note = `${def.name}: ${how}.`;
      if (def.loot) note += ` Grabbed ${money(grabLoot(def.loot))}.`;
      nextObstacle();
      draw();
    };

    const play = (id: ObstacleId, minigame: MinigameId, loud: boolean) => {
      const area = h('div', { class: 'minigame-area' });
      render(main, area);
      running = hostMinigame(area, minigame, {
        rngKey: ['heist', id, minigame],
        onAlarm: (amount) => addAlarm(amount),
      });
      drawFooter();
      running.done.then((res) => {
        running = null;
        if (res.flags.includes('aborted')) return;
        if (res.success) clearObstacle(id, loud ? 'forced' : 'done quietly');
        else {
          note = `${OBSTACLES[id].name}: failed. Try again or go loud.`;
          draw();
        }
      });
    };

    const goLoud = (id: ObstacleId) => {
      const def = OBSTACLES[id];
      if (!def.loud) return;
      markLoud();
      // M0 placeholder: hold-to-force methods are instant with their full alarm cost.
      const alarm = def.loud.alarm ?? B.heist.safe.crowbarTime * B.heist.safe.crowbarAlarmPerSec;
      addAlarm(alarm);
      clearObstacle(id, def.loud.label.toLowerCase());
    };

    const obstacleCard = (id: ObstacleId) => {
      const def = OBSTACLES[id];
      const keys = def.skippedBy && hasIntel(def.skippedBy);
      const missingGear = def.quietNeeds && !hasGear(def.quietNeeds) ? def.quietNeeds : null;
      const loudAlarm = def.loud ? def.loud.alarm ?? B.heist.safe.crowbarTime * B.heist.safe.crowbarAlarmPerSec : 0;
      return h(
        'div',
        { class: 'card center-card' },
        h('div', { class: 'card-title' }, def.name),
        h('p', { class: 'card-text' }, def.text),
        h(
          'div',
          { class: 'row' },
          keys && def.skippedBy ? button(`Use the ${INTEL[def.skippedBy].name}`, () => clearObstacle(id, 'unlocked with the keys'), { variant: 'primary' }) : null,
          def.quiet
            ? button(missingGear ? `Quiet: needs ${GEAR[missingGear].name}` : 'Quiet: play it', () => play(id, def.quiet!, false), {
                variant: 'quiet',
                disabled: !!missingGear,
              })
            : null,
          def.loud ? button(`Loud: ${def.loud.label} (+${loudAlarm} alarm)`, () => goLoud(id), { variant: 'loud' }) : null,
          !def.quiet && !def.loud ? button('Stick it up', () => clearObstacle(id, 'the clerk opened up'), { variant: 'primary' }) : null,
        ),
      );
    };

    const draw = () => {
      const step = heist().step;
      drawSequence();
      drawFooter();
      if (step >= plan.obstacles.length) {
        render(
          main,
          h(
            'div',
            { class: 'card center-card' },
            note ? h('p', { class: 'muted' }, note) : null,
            h('div', { class: 'card-title' }, 'Exit'),
            h('p', { class: 'card-text' }, 'Everything worth taking is in the bag. Time to go.'),
            button('Get out →', leaveHeist, { variant: 'primary' }),
          ),
        );
        return;
      }
      render(main, note ? h('p', { class: 'note' }, note) : null, obstacleCard(plan.obstacles[step]));
    };

    render(
      root,
      h(
        'div',
        { class: 'screen-pad heist' },
        screenTitle(`The heist — ${plan.name}`),
        placeholderNote('M1', 'Stub minigames. Real lockpick, keypad and safe dial, passive alarm, patrols and the cops countdown come next.'),
        sequence,
        main,
        footer,
      ),
    );
    draw();

    const unsubscribe = subscribe(drawFooter);
    return () => {
      unsubscribe();
      running?.abort();
    };
  },
};
