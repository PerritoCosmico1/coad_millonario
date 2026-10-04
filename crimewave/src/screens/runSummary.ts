import { formatSeed, randomSeed } from '../core/rng';
import { CREW } from '../data/crew';
import { setTitleSeed } from '../game/actions';
import { newRun, toTitle } from '../game/flow';
import { run } from '../game/state';
import { button, panel } from '../ui/components';
import { h, money, render } from '../ui/dom';
import type { Screen } from '../ui/router';

export const runSummaryScreen: Screen = {
  mount(root) {
    const r = run();
    const busted = r.ended === 'busted';
    const row = (label: string, value: string) => h('div', { class: 'ledger-row' }, h('span', null, label), h('span', null, value));
    render(
      root,
      h(
        'div',
        { class: 'screen-pad center summary' },
        h('h1', { class: `summary-title ${busted ? 'bad' : ''}` }, busted ? 'BUSTED' : 'Run over'),
        h('p', { class: 'muted' }, busted ? 'Heat hit 100. The cops kicked the door in.' : 'You walked away. Smart, maybe.'),
        h(
          'div',
          { class: 'card ledger' },
          row('Antes cleared', String(r.stats.antesCleared)),
          row('Total cash earned', money(r.stats.cashEarned)),
          row('Cash on hand', money(r.cash)),
          row('Final heat', String(r.heat)),
          row('Partner', r.partner ? CREW[r.partner].name : '—'),
          row('Seed', formatSeed(r.seed)),
        ),
        panel(
          'Crew lost',
          r.stats.crewLost.length
            ? h('ul', null, r.stats.crewLost.map((c) => h('li', null, `${c.name} — ${c.reason}`)))
            : h('p', { class: 'muted' }, 'Nobody. Loyal bunch.'),
        ),
        h(
          'div',
          { class: 'row' },
          button('Replay this seed', () => newRun(r.seed)),
          button('New run', () => newRun(randomSeed()), { variant: 'primary' }),
          button('Title', () => {
            setTitleSeed(randomSeed());
            toTitle();
          }, { variant: 'ghost' }),
        ),
      ),
    );
  },
};
