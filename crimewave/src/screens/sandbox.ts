/**
 * Debug sandbox: run any minigame on its own with default params. Alarm here is
 * local to the sandbox and never touches the run.
 */

import { game } from '../game/state';
import { MINIGAMES } from '../minigames/registry';
import type { RunningMinigame } from '../minigames/runner';
import { button, meter, screenTitle } from '../ui/components';
import { h, render } from '../ui/dom';
import { goTo, type Screen } from '../ui/router';
import { hostMinigame } from './common';

export const sandboxScreen: Screen = {
  mount(root) {
    const id = game.sandbox.minigame;
    const def = MINIGAMES[id];
    let running: RunningMinigame | null = null;
    let alarm = 0;
    const alarmMeter = meter({ color: 'var(--alarm)', label: 'Sandbox alarm' });
    const area = h('div', { class: 'minigame-area' });
    const output = h('pre', { class: 'result-output' }, 'Running…');

    const start = () => {
      running?.abort();
      alarm = 0;
      alarmMeter.set(0);
      output.textContent = 'Running…';
      running = hostMinigame(area, id, {
        rngKey: ['sandbox', id],
        onAlarm: (amount, cause) => {
          alarm = Math.min(100, alarm + amount);
          alarmMeter.set(alarm);
          output.textContent = `Alarm +${amount} (${cause})`;
        },
      });
      running.done.then((res) => {
        output.textContent = JSON.stringify(res, null, 2);
      });
    };

    render(
      root,
      h(
        'div',
        { class: 'screen-pad sandbox' },
        screenTitle(`Sandbox: ${def.name}`, def.howTo),
        h(
          'div',
          { class: 'row' },
          alarmMeter.el,
          button('Run again', start),
          button('← Back', () => goTo(game.sandbox.returnTo), { variant: 'ghost' }),
        ),
        area,
        output,
      ),
    );
    start();
    return () => running?.abort();
  },
};
