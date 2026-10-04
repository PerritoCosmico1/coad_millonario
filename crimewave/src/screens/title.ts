import { formatSeed, normalizeSeed, randomSeed } from '../core/rng';
import { setTitleSeed } from '../game/actions';
import { newRun } from '../game/flow';
import { game } from '../game/state';
import { button } from '../ui/components';
import { h, render } from '../ui/dom';
import type { Screen } from '../ui/router';

export const titleScreen: Screen = {
  mount(root) {
    const seedInput = h('input', {
      class: 'seed-input',
      value: formatSeed(game.titleSeed),
      maxLength: 20,
      spellcheck: false,
      title: 'Optional: type a seed to replay a run',
    });
    const commitSeed = () => {
      const s = normalizeSeed(seedInput.value);
      if (s) setTitleSeed(s);
      seedInput.value = formatSeed(game.titleSeed);
    };
    seedInput.addEventListener('change', commitSeed);

    render(
      root,
      h(
        'div',
        { class: 'title-screen' },
        h('h1', { class: 'logo' }, 'CRIMEWAVE'),
        h('p', { class: 'tagline' }, 'Case it. Prep it. Pull it. A roguelike heist spree.'),
        h('p', { class: 'muted' }, 'Ante 1 prototype — the liquor store.'),
        button('New run', () => {
          commitSeed();
          newRun(game.titleSeed);
        }, { variant: 'primary' }),
        h(
          'div',
          { class: 'seed-row' },
          h('span', { class: 'muted' }, 'Seed'),
          seedInput,
          button('New seed', () => {
            setTitleSeed(randomSeed());
            seedInput.value = formatSeed(game.titleSeed);
          }, { variant: 'ghost', small: true }),
        ),
        h('p', { class: 'muted small' }, 'Mouse only. Typing a seed is optional — use it to replay a run.'),
      ),
    );
  },
};
