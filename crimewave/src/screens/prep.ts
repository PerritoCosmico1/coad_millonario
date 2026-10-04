/**
 * Prep job (big blind): hotwire a getaway car.
 * M0: stub minigame; success gives the car. Suspicion, heat and the loud
 * option arrive in M3.
 */

import { addGear, hasGear } from '../game/actions';
import { completeBlind } from '../game/flow';
import { MINIGAMES } from '../minigames/registry';
import type { RunningMinigame } from '../minigames/runner';
import { button, placeholderNote, screenTitle } from '../ui/components';
import { h, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { hostMinigame } from './common';

export const prepScreen: Screen = {
  mount(root) {
    let running: RunningMinigame | null = null;
    const body = h('div', { class: 'stage-area' });
    const def = MINIGAMES.hotwire;

    const intro = () =>
      render(
        body,
        h(
          'div',
          { class: 'card center-card' },
          h('div', { class: 'card-title' }, 'Steal the getaway car'),
          h('p', { class: 'card-text' }, def.howTo),
          h(
            'div',
            { class: 'row' },
            button('Quiet: hotwire it', play, { variant: 'quiet' }),
            button('Loud: Smash and grab', () => {}, { variant: 'loud', disabled: true, title: 'Arrives in M3' }),
          ),
        ),
      );

    const play = () => {
      const area = h('div', { class: 'minigame-area' });
      render(body, area);
      running = hostMinigame(area, 'hotwire', { rngKey: ['prep', 'hotwire'] });
      running.done.then((res) => {
        running = null;
        let text = 'No car this time.';
        if (res.success) {
          text = hasGear('getawayCar') ? 'You already have a car.' : addGear('getawayCar') ? 'Got the getaway car.' : 'No free gear slot for the car.';
        }
        render(
          body,
          h(
            'div',
            { class: 'card center-card' },
            h('div', { class: 'card-title' }, res.success ? 'Engine running' : 'Busted wiring'),
            h('p', { class: 'card-text' }, text),
            button('Back to the safehouse →', completeBlind, { variant: 'primary' }),
          ),
        );
      });
    };

    render(
      root,
      h(
        'div',
        { class: 'screen-pad' },
        screenTitle('Prep job', 'You need wheels for a clean getaway.'),
        placeholderNote('M3', 'Real hotwire minigame with the passerby meter, heat on failure and the loud option.'),
        body,
      ),
    );
    intro();
    return () => running?.abort();
  },
};
