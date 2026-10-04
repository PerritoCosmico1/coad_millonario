/**
 * Heist setup: day or night, roles, known modifiers, Go.
 * Roles start on everyone's preferred role; click to change. Loyalty checks
 * arrive in M4.
 */

import { playSfx } from '../core/sfx';
import { CREW } from '../data/crew';
import { HEIST_PLANS, OBSTACLES } from '../data/heists';
import { ROLES, ROLE_IDS } from '../data/roles';
import type { RoleId, TimeOfDay } from '../data/types';
import { beginHeist } from '../game/flow';
import { defaultRoles, inPreferredRole, roleAvailable } from '../game/heistRules';
import { run } from '../game/state';
import { button, panel, placeholderNote, screenTitle } from '../ui/components';
import { h, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { modifierList } from './common';

/** Role effects that don't do anything yet. */
const LATER: Partial<Record<RoleId, string>> = { muscle: 'M2', driver: 'M2' };

export const heistSetupScreen: Screen = {
  mount(root) {
    let time: TimeOfDay | null = null;
    const roles: Record<number, RoleId> = defaultRoles();

    const setRole = (uid: number, role: RoleId | null) => {
      playSfx('click');
      for (const [other, r] of Object.entries(roles)) if (r === role) delete roles[Number(other)];
      if (role) roles[uid] = role;
      else delete roles[uid];
      draw();
    };

    const roleRows = () => {
      const r = run();
      return h(
        'div',
        { class: 'role-rows' },
        h('div', { class: 'role-row' }, h('div', { class: 'role-name' }, h('strong', null, 'You'), h('span', { class: 'muted small' }, 'always')), h('span', { class: 'chip' }, 'Inside')),
        r.crew.map((m) => {
          const def = CREW[m.id];
          const current = roles[m.uid] ?? null;
          return h(
            'div',
            { class: 'role-row' },
            h('div', { class: 'role-name' }, h('strong', null, def.name), h('span', { class: 'muted small' }, `prefers ${ROLES[def.preferredRole].name}`)),
            h(
              'div',
              { class: 'role-buttons' },
              ROLE_IDS.map((role) =>
                h(
                  'button',
                  {
                    class: `btn small role-btn ${current === role ? 'selected' : ''} ${def.preferredRole === role ? 'preferred' : ''}`,
                    disabled: !roleAvailable(role),
                    title: roleAvailable(role) ? ROLES[role].text : 'Needs the getaway car',
                    onClick: () => setRole(m.uid, current === role ? null : role),
                  },
                  ROLES[role].name,
                ),
              ),
            ),
          );
        }),
      );
    };

    const roleEffects = () => {
      const r = run();
      const assigned = r.crew.filter((m) => roles[m.uid]);
      if (!assigned.length) return h('p', { class: 'muted small' }, r.crew.length ? 'No roles assigned.' : 'Nobody to assign. You go in alone.');
      return h(
        'ul',
        { class: 'role-effects' },
        assigned.map((m) => {
          const role = roles[m.uid];
          const pref = inPreferredRole(m, role);
          return h(
            'li',
            null,
            h('strong', null, `${CREW[m.id].name} · ${ROLES[role].name}`),
            ' — ',
            ROLES[role].text,
            pref ? h('span', { class: 'good' }, ` Preferred role: ${ROLES[role].preferredText}.`) : null,
            LATER[role] ? h('span', { class: 'muted' }, ` (takes effect in ${LATER[role]})`) : null,
          );
        }),
      );
    };

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
            panel('Roles', roleRows(), roleEffects(), placeholderNote('M4', 'Loyalty checks happen here.')),
            panel('Known modifiers', modifierList(r.ante)),
          ),
          h(
            'div',
            { class: 'row end' },
            button(time ? `Go — ${HEIST_PLANS[time].name.toLowerCase()} job` : 'Pick day or night', () => time && beginHeist(time, roles), {
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
