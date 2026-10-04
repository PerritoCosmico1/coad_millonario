import { B } from '../config/balance';
import { playBlind, skipBlind } from '../game/flow';
import { currentBlind, run, type BlindId } from '../game/state';
import { button, screenTitle } from '../ui/components';
import { h, money, render } from '../ui/dom';
import type { Screen } from '../ui/router';
import { modifierChips } from './common';

interface BlindInfo {
  name: string;
  kind: string;
  text: string;
  reward: string;
  skip: number | null;
  skipText: string;
}

const BLINDS: Record<BlindId, BlindInfo> = {
  scouting: {
    name: 'Scouting job',
    kind: 'Small blind',
    text: 'Case the store: photograph the joint, then lift the manager\'s keys.',
    reward: 'Intel: reveals heist modifiers, can give intel items.',
    skip: B.blinds.scoutingSkipReward,
    skipText: 'modifiers stay hidden',
  },
  prep: {
    name: 'Prep job',
    kind: 'Big blind',
    text: 'Hotwire a getaway car.',
    reward: 'Getaway car.',
    skip: B.blinds.prepSkipReward,
    skipText: 'no car',
  },
  heist: {
    name: 'The heist',
    kind: 'Boss blind',
    text: 'Choose day or night, assign roles, pull the job, escape.',
    reward: 'Loot.',
    skip: null,
    skipText: '',
  },
};

export const blindSelectScreen: Screen = {
  mount(root) {
    const r = run();
    const cur = currentBlind(r.ante);
    render(
      root,
      h(
        'div',
        { class: 'screen-pad' },
        screenTitle(`Ante ${r.ante.n} — choose your next move`),
        h(
          'div',
          { class: 'card-row blinds' },
          (Object.keys(BLINDS) as BlindId[]).map((id) => {
            const info = BLINDS[id];
            const status = r.ante.blinds[id];
            const isCurrent = id === cur && status === 'pending';
            return h(
              'div',
              { class: `card blind-card ${isCurrent ? 'current' : ''} ${status}` },
              h('div', { class: 'card-sub' }, info.kind),
              h('div', { class: 'card-title' }, info.name),
              h('p', { class: 'card-text' }, info.text),
              h('div', { class: 'card-field' }, h('span', { class: 'muted' }, 'Reward '), info.reward),
              id === 'heist' ? modifierChips(r.ante) : null,
              h('div', { class: 'spacer' }),
              status === 'done' ? h('div', { class: 'blind-status' }, 'Done') : null,
              status === 'skipped' ? h('div', { class: 'blind-status' }, 'Skipped') : null,
              isCurrent
                ? h(
                    'div',
                    { class: 'blind-actions' },
                    button('Play', playBlind, { variant: 'primary' }),
                    info.skip !== null
                      ? button(`Skip: +${money(info.skip)}`, skipBlind, { title: `Skip reward: +${money(info.skip)}, ${info.skipText}` })
                      : null,
                    info.skip !== null ? h('div', { class: 'muted small' }, `Skipping: ${info.skipText}`) : null,
                  )
                : null,
              status === 'pending' && !isCurrent ? h('div', { class: 'blind-status muted' }, 'Upcoming') : null,
            );
          }),
        ),
      ),
    );
  },
};
