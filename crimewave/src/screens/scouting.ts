/**
 * Scouting job (small blind): Viewfinder, then Pickpocket.
 * M0: runs the stub minigames end to end. Rewards, loud options and
 * modifier reveals arrive in M3.
 */

import { completeBlind } from '../game/flow';
import { MINIGAMES } from '../minigames/registry';
import type { RunningMinigame } from '../minigames/runner';
import type { MinigameId } from '../minigames/types';
import { button, placeholderNote, screenTitle } from '../ui/components';
import { h, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { hostMinigame } from './common';

const STEPS: { id: MinigameId; loud: string }[] = [
  { id: 'viewfinder', loud: 'Ask around' },
  { id: 'pickpocket', loud: 'Grab and run' },
];

export const scoutingScreen: Screen = {
  mount(root) {
    let step = 0;
    let running: RunningMinigame | null = null;
    const results: string[] = [];
    const body = h('div', { class: 'stage-area' });

    const draw = () => {
      if (step >= STEPS.length) {
        render(
          body,
          h(
            'div',
            { class: 'card center-card' },
            h('div', { class: 'card-title' }, 'Scouting complete'),
            h('ul', null, results.map((t) => h('li', null, t))),
            button('Back to the safehouse →', completeBlind, { variant: 'primary' }),
          ),
        );
        return;
      }
      const s = STEPS[step];
      const def = MINIGAMES[s.id];
      render(
        body,
        h(
          'div',
          { class: 'card center-card' },
          h('div', { class: 'card-sub' }, `Step ${step + 1} of ${STEPS.length}`),
          h('div', { class: 'card-title' }, def.name),
          h('p', { class: 'card-text' }, def.howTo),
          h(
            'div',
            { class: 'row' },
            button('Quiet: play it', () => play(s.id), { variant: 'quiet' }),
            button(`Loud: ${s.loud}`, () => {}, { variant: 'loud', disabled: true, title: 'Arrives in M3' }),
          ),
        ),
      );
    };

    const play = (id: MinigameId) => {
      const area = h('div', { class: 'minigame-area' });
      render(body, area);
      running = hostMinigame(area, id, { rngKey: ['scouting', id] });
      running.done.then((res) => {
        running = null;
        results.push(`${MINIGAMES[id].name}: ${res.success ? 'success' : 'failed'}`);
        step++;
        draw();
      });
    };

    render(
      root,
      h(
        'div',
        { class: 'screen-pad' },
        screenTitle('Scouting job', 'Case the store before you hit it.'),
        placeholderNote('M3', 'Real viewfinder and pickpocket, modifier reveals, intel items and the loud options.'),
        body,
      ),
    );
    draw();
    return () => running?.abort();
  },
};
