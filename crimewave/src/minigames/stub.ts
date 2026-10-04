/**
 * Placeholder minigame used until the real one is built. It honours the full
 * contract (live alarm, finish once, cleanup) so hosts can be wired up early.
 */

import { playSfx } from '../core/sfx';
import { button, placeholderNote } from '../ui/components';
import { h, render } from '../ui/dom';
import { shake } from '../ui/fx';
import type { MinigameDef, MinigameId } from './types';

export function stubMinigame(id: MinigameId, name: string, howTo: string, milestone: string): MinigameDef<Record<string, never>> {
  return {
    id,
    name,
    howTo,
    defaultParams: () => ({}),
    start(ctx) {
      let mistakes = 0;
      const status = h('p', { class: 'muted' }, 'No mistakes yet.');
      render(
        ctx.root,
        h(
          'div',
          { class: 'stub-minigame' },
          h('h2', null, name),
          placeholderNote(milestone, howTo),
          status,
          h(
            'div',
            { class: 'row' },
            button('Succeed', () => {
              playSfx('success');
              ctx.finish({ success: true, heatDelta: 0, loot: 0, flags: [] });
            }, { variant: 'primary' }),
            button('Make a mistake (+5 alarm)', () => {
              mistakes++;
              playSfx('mistake');
              shake(ctx.root);
              ctx.addAlarm(5, 'mistake');
              status.textContent = `${mistakes} mistake${mistakes === 1 ? '' : 's'}.`;
            }),
            button('Fail', () => {
              playSfx('fail');
              ctx.finish({ success: false, heatDelta: 0, loot: 0, flags: [] });
            }, { variant: 'danger' }),
          ),
        ),
      );
      return () => ctx.root.replaceChildren();
    },
  };
}
