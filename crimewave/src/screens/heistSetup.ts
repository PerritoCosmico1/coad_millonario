/**
 * Heist setup: day or night, roles, known modifiers, Go.
 * M0: time-of-day choice is real; role assignment and loyalty checks arrive in M4.
 */

import { CREW } from '../data/crew';
import { HEIST_PLANS } from '../data/heists';
import { OBSTACLES } from '../data/heists';
import { ROLES } from '../data/roles';
import type { TimeOfDay } from '../data/types';
import { beginHeist } from '../game/flow';
import { run } from '../game/state';
import { playSfx } from '../core/sfx';
import { button, panel, placeholderNote, screenTitle } from '../ui/components';
import { h, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { modifierList } from './common';

export const heistSetupScreen: Screen = {
  mount(root) {
    let time: TimeOfDay | null = null;

    const draw = () => {
      const r = run();
      render(
        root,
        h(
          'div',
          { class: 'screen-pad' },
          screenTitle('The heist — setup', 'When do you hit, and who does what?'),
          h(
            'div',
            { class: 'card-row' },
            (Object.keys(HEIST_PLANS) as TimeOfDay[]).map((t) => {
              const plan = HEIST_PLANS[t];
              return h(
                'button',
                {
                  class: `card pick-card time-card ${time === t ? 'selected' : ''}`,
                  onClick: () => {
                    playSfx('click');
                    time = t;
                    draw();
                  },
                },
                h('div', { class: 'card-title' }, plan.name),
                h('p', { class: 'card-text' }, plan.text),
                h('div', { class: 'card-field muted' }, [...plan.obstacles.map((o) => OBSTACLES[o].name), 'Exit'].join(' → ')),
              );
            }),
          ),
          h(
            'div',
            { class: 'columns two' },
            panel(
              'Roles',
              placeholderNote('M4', 'Click a crew member, then a role slot. Loyalty checks happen here.'),
              h(
                'ul',
                { class: 'crew-list' },
                h('li', null, h('strong', null, 'You'), ' — Inside'),
                r.crew.map((m) => h('li', null, h('strong', null, CREW[m.id].name), ` — prefers ${ROLES[CREW[m.id].preferredRole].name}`)),
              ),
            ),
            panel('Known modifiers', modifierList(r.ante)),
          ),
          h(
            'div',
            { class: 'row end' },
            button(time ? `Go — ${HEIST_PLANS[time].name.toLowerCase()} job` : 'Pick day or night', () => time && beginHeist(time), {
              variant: 'primary',
              disabled: !time,
            }),
          ),
        ),
      );
    };
    draw();
  },
};
