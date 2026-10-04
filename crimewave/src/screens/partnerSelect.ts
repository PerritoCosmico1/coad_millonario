import { CREW, PARTNER_IDS } from '../data/crew';
import { ROLES } from '../data/roles';
import { choosePartner } from '../game/flow';
import { screenTitle } from '../ui/components';
import { h, pct, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { playSfx } from '../core/sfx';

export const partnerSelectScreen: Screen = {
  mount(root) {
    render(
      root,
      h(
        'div',
        { class: 'screen-pad' },
        screenTitle('Pick your partner', 'Every job starts as a duo. Your partner covers one role in the heist and takes a cut.'),
        h(
          'div',
          { class: 'card-row' },
          PARTNER_IDS.map((id) => {
            const p = CREW[id];
            return h(
              'button',
              {
                class: 'card pick-card',
                onClick: () => {
                  playSfx('click');
                  choosePartner(id);
                },
              },
              h('div', { class: 'card-title' }, p.name),
              h('div', { class: 'card-sub' }, p.title),
              h('div', { class: 'card-field' }, h('span', { class: 'muted' }, 'Prefers '), ROLES[p.preferredRole].name),
              h('p', { class: 'card-text' }, p.perkText),
              h(
                'div',
                { class: 'card-stats' },
                h('span', null, `Cut ${pct(p.cut)}`),
                h('span', null, `Loyalty ${p.startingLoyalty}`),
              ),
            );
          }),
        ),
      ),
    );
  },
};
