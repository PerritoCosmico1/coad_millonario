/**
 * Escape: a clean exit card, or the chase.
 * M0: the chase is a stub minigame; caught → Drop the bag / Leave someone behind.
 * The real chase arrives in M2.
 */

import { B } from '../config/balance';
import { CREW } from '../data/crew';
import { hasGear } from '../game/actions';
import { resolveEscape } from '../game/flow';
import { heist, run } from '../game/state';
import type { RunningMinigame } from '../minigames/runner';
import { button, placeholderNote, screenTitle } from '../ui/components';
import { h, money, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { hostMinigame } from './common';

export const escapeScreen: Screen = {
  mount(root) {
    const h_ = heist();
    const body = h('div', { class: 'stage-area' });
    let running: RunningMinigame | null = null;

    const clean = () =>
      render(
        body,
        h(
          'div',
          { class: 'card center-card' },
          h('div', { class: 'card-title' }, 'Clean exit'),
          h('p', { class: 'card-text' }, `Nobody saw a thing. You walk out with ${money(h_.loot)}.`),
          button('Count the money →', () => resolveEscape({ kind: 'clean' }), { variant: 'primary' }),
        ),
      );

    const chaseIntro = () => {
      const car = hasGear('getawayCar');
      const turns = car ? B.chase.intersections : B.chase.onFootIntersections;
      render(
        body,
        h(
          'div',
          { class: 'card center-card' },
          h('div', { class: 'card-title' }, 'Sirens!'),
          h(
            'p',
            { class: 'card-text' },
            car ? `You peel out in the getaway car. ${turns} intersections to lose them.` : `No car — you run for it. ${turns} intersections on foot.`,
          ),
          placeholderNote('M2', 'The real chase: pick a direction at each intersection from the scanner hint. 2 strikes and you’re caught.'),
          button('Run the chase', chase, { variant: 'primary' }),
        ),
      );
    };

    const chase = () => {
      const area = h('div', { class: 'minigame-area' });
      render(body, area);
      running = hostMinigame(area, 'chase', { rngKey: ['escape', 'chase'] });
      running.done.then((res) => {
        running = null;
        if (res.flags.includes('aborted')) return;
        if (res.success) escaped();
        else caught();
      });
    };

    const escaped = () =>
      render(
        body,
        h(
          'div',
          { class: 'card center-card' },
          h('div', { class: 'card-title' }, 'You lost them'),
          h('p', { class: 'card-text' }, `Escaped with ${money(h_.loot)}. A chase gets talked about: +${B.chase.escapeHeat} heat.`),
          button('Count the money →', () => resolveEscape({ kind: 'chaseEscaped' }), { variant: 'primary' }),
        ),
      );

    const caught = () => {
      const r = run();
      const kept = Math.round(h_.loot * (1 - B.chase.dropBagLoss));
      render(
        body,
        h(
          'div',
          { class: 'card center-card' },
          h('div', { class: 'card-title' }, 'Boxed in'),
          h('p', { class: 'card-text' }, 'The cops have you cornered. Somebody has to give.'),
          h(
            'div',
            { class: 'column' },
            button(`Drop the bag — keep ${money(kept)} of ${money(h_.loot)}`, () => resolveEscape({ kind: 'droppedBag' }), { variant: 'loud' }),
            r.crew.map((m) =>
              button(
                `Leave ${CREW[m.id].name} behind — keep the loot`,
                () => resolveEscape({ kind: 'leftBehind', name: CREW[m.id].name }, m.uid),
                { variant: 'danger', title: `${CREW[m.id].name} is arrested. Everyone else loses ${-B.loyalty.leftBehindPenalty} loyalty.` },
              ),
            ),
          ),
        ),
      );
    };

    render(root, h('div', { class: 'screen-pad' }, screenTitle('The getaway'), body));
    if (h_.copsCalled) chaseIntro();
    else clean();
    return () => running?.abort();
  },
};
