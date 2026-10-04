/**
 * Payout: loot → fence rate → pot → cuts → your take.
 * M0: everyone is paid in full. Pay full / Short and loyalty changes arrive in M4.
 */

import { earnCash } from '../game/actions';
import { finishPayout } from '../game/flow';
import { heatTier } from '../game/heat';
import { computePayout } from '../game/payout';
import { heist, run } from '../game/state';
import { button, placeholderNote, screenTitle } from '../ui/components';
import { h, money, pct, render } from '../ui/dom';
import type { Screen } from '../ui/router';

export const payoutScreen: Screen = {
  mount(root) {
    const r = run();
    const result = heist().result;
    if (!result) throw new Error('Payout without a finished heist');
    const p = computePayout(r, result.loot);
    const tier = heatTier(r.heat);

    const row = (label: string, value: string, cls = '') => h('div', { class: `ledger-row ${cls}` }, h('span', null, label), h('span', null, value));

    render(
      root,
      h(
        'div',
        { class: 'screen-pad center' },
        screenTitle('Payout', 'The fence takes the goods; the crew takes their cut.'),
        h(
          'div',
          { class: 'card ledger' },
          row('Loot in the bag', money(result.loot)),
          row(`Fence rate (${tier.label} heat)`, pct(p.fenceRate)),
          row('Pot', money(p.pot), 'total'),
          p.lines.map((l) => row(`${l.name}'s cut (${pct(l.cutPct)})`, `−${money(l.amount)}`)),
          row('You keep', money(p.yourTake), 'total good'),
          row('Heat from this job', `+${result.heatGained}`, 'bad'),
        ),
        placeholderNote('M4', 'Pay full or Short each member (half their cut), with loyalty changes.'),
        button(`Collect ${money(p.yourTake)}`, () => {
          earnCash(p.yourTake);
          finishPayout();
        }, { variant: 'primary' }),
      ),
    );
  },
};
