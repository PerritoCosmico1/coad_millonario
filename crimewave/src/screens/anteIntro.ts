import { CURRENT_TARGET, TARGETS } from '../data/targets';
import { toBlindSelect } from '../game/flow';
import { lootRange } from '../game/scaling';
import { run } from '../game/state';
import { button, screenTitle } from '../ui/components';
import { h, money, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { modifierChips } from './common';

export const anteIntroScreen: Screen = {
  mount(root) {
    const r = run();
    const target = TARGETS[CURRENT_TARGET];
    const reg = lootRange('register', r.ante.n);
    const safe = lootRange('safe', r.ante.n);
    render(
      root,
      h(
        'div',
        { class: 'screen-pad center' },
        screenTitle(`Ante ${r.ante.n}`, r.ante.n > 1 ? 'Same store, higher stakes. Everything carries over.' : 'Your first target.'),
        h(
          'div',
          { class: 'card target-card' },
          h('div', { class: 'card-title' }, target.name),
          h('p', { class: 'card-text' }, target.text),
          h(
            'div',
            { class: 'card-field' },
            h('span', { class: 'muted' }, 'Loot '),
            `Register ${money(reg.min)}–${money(reg.max)} · Safe ${money(safe.min)}–${money(safe.max)}`,
          ),
          h('div', { class: 'card-field' }, h('span', { class: 'muted' }, 'Modifiers ')),
          modifierChips(r.ante),
        ),
        button('Case the job →', toBlindSelect, { variant: 'primary' }),
      ),
    );
  },
};
