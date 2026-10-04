/** Headline: a newspaper card summarizing the job. The seed of the future lore system. */

import { playSfx } from '../core/sfx';
import { nextAnte, quitRun } from '../game/flow';
import { heatTier } from '../game/heat';
import { run } from '../game/state';
import { button } from '../ui/components';
import { h, render } from '../ui/dom';
import type { Screen } from '../ui/router';

export const headlineScreen: Screen = {
  mount(root) {
    const r = run();
    const news = r.headline ?? { headline: 'Quiet night in the city', subhead: null };
    playSfx('headline');
    render(
      root,
      h(
        'div',
        { class: 'screen-pad center' },
        h(
          'article',
          { class: 'newspaper' },
          h('div', { class: 'masthead' }, 'THE EVENING LEDGER'),
          h('div', { class: 'dateline' }, `Late edition · Job no. ${r.ante.n}`),
          h('h1', { class: 'news-headline' }, news.headline),
          news.subhead ? h('h2', { class: 'news-subhead' }, news.subhead) : null,
          h('p', { class: 'news-body' }, `Police are asking anyone with information to come forward. Heat on the street: ${heatTier(r.heat).label.toLowerCase()}.`),
        ),
        h('div', { class: 'row' }, button(`Next ante → (Ante ${r.ante.n + 1})`, nextAnte, { variant: 'primary' }), button('Retire (end run)', quitRun, { variant: 'ghost' })),
      ),
    );
  },
};
