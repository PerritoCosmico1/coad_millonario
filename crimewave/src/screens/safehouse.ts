/**
 * Safehouse (the shop). M0: layout placeholder with the crew list.
 * Shop, hire board and lay low arrive in M4.
 */

import { B } from '../config/balance';
import { CREW } from '../data/crew';
import { ROLES } from '../data/roles';
import { leaveSafehouse } from '../game/flow';
import { currentBlind, run } from '../game/state';
import { button, panel, placeholderNote, screenTitle } from '../ui/components';
import { h, money, pct, render } from '../ui/dom';
import type { Screen } from '../ui/router';

const NEXT_LABEL = { scouting: 'Scouting job', prep: 'Prep job', heist: 'The heist' };

export const safehouseScreen: Screen = {
  mount(root) {
    const r = run();
    const next = currentBlind(r.ante);
    render(
      root,
      h(
        'div',
        { class: 'screen-pad' },
        screenTitle('Safehouse', 'Gear up, hire help, or lay low.'),
        placeholderNote('M4', 'Shop (3 items + reroll), hire board (2 hires), and Lay low.'),
        h(
          'div',
          { class: 'columns three' },
          panel(
            'Shop',
            h('p', { class: 'muted' }, `${B.safehouse.shopSize} random items from the gear pool. Reroll: ${money(B.safehouse.rerollCost)}.`),
            Array.from({ length: B.safehouse.shopSize }, () => h('div', { class: 'slot-placeholder' }, 'item')),
          ),
          panel(
            'Hire board',
            h('p', { class: 'muted' }, `${B.safehouse.hireBoardSize} random hires. Max crew ${B.run.maxCrew} including you.`),
            Array.from({ length: B.safehouse.hireBoardSize }, () => h('div', { class: 'slot-placeholder' }, 'hire')),
          ),
          panel(
            'Lay low',
            h('p', { class: 'muted' }, `Pay ${money(B.heat.layLowCost)} → −${B.heat.layLowAmount} heat. Repeatable.`),
            button(`Lay low (${money(B.heat.layLowCost)})`, () => {}, { disabled: true, title: 'Arrives in M4' }),
          ),
        ),
        panel(
          'Your crew',
          h(
            'ul',
            { class: 'crew-list' },
            h('li', null, h('strong', null, 'You'), ' — always Inside'),
            r.crew.map((m) => {
              const d = CREW[m.id];
              return h('li', null, h('strong', null, `${d.name}, ${d.title}`), ` — prefers ${ROLES[d.preferredRole].name} · cut ${pct(d.cut)} · loyalty ${m.loyalty}`);
            }),
          ),
        ),
        h('div', { class: 'row end' }, button(`Continue → ${NEXT_LABEL[next]}`, leaveSafehouse, { variant: 'primary' })),
      ),
    );
  },
};
