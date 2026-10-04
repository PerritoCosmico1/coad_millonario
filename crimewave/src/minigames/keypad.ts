/**
 * Register keypad (design doc 6.5, night). A code flashes briefly; click it in
 * on the keypad. A wrong code costs alarm and flashes the code again.
 */

import { frameLoop } from '../core/loop';
import { playSfx } from '../core/sfx';
import { h, render } from '../ui/dom';
import { shake } from '../ui/fx';
import { keypadParams, NEUTRAL_CONTEXT } from './params';
import type { MinigameDef } from './types';

export interface KeypadParams {
  digits: number;
  /** Seconds the code stays on screen each time it flashes. */
  flashTime: number;
  /** Keypad code intel: the code never hides. */
  alwaysShowCode: boolean;
  wrongAlarm: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'];

export const keypad: MinigameDef<KeypadParams> = {
  id: 'keypad',
  name: 'Keypad',
  howTo: 'Memorise the code while it flashes, then click it in. A wrong code raises the alarm and flashes it again.',
  defaultParams: () => keypadParams(NEUTRAL_CONTEXT),

  start(ctx) {
    const p = ctx.params;
    const code = Array.from({ length: p.digits }, () => String(ctx.rng.int(0, 9))).join('');
    let entry = '';
    let showFor = p.flashTime;
    let done = false;
    let finishTimer = 0;

    const codeCells = Array.from({ length: p.digits }, () => h('span', { class: 'code-cell' }));
    const entryCells = Array.from({ length: p.digits }, () => h('span', { class: 'code-cell entry' }));
    const flashFill = h('div', { class: 'flash-fill' });
    const status = h('p', { class: 'mg-status' }, p.alwaysShowCode ? 'You have the code from scouting.' : 'Watch closely.');
    const keyButtons = KEYS.map((k) =>
      h('button', { class: `btn key ${k === 'C' || k === '←' ? 'fn' : ''}`, onClick: () => press(k) }, k),
    );
    const codeBox = h('div', { class: 'code-display' }, codeCells);

    render(
      ctx.root,
      h(
        'div',
        { class: 'mg keypad' },
        h(
          'div',
          { class: 'keypad-left' },
          h('div', { class: 'mg-label' }, 'Code'),
          codeBox,
          h('div', { class: 'flash-track' }, flashFill),
          h('div', { class: 'mg-label' }, 'Entered'),
          h('div', { class: 'code-display' }, entryCells),
          status,
        ),
        h('div', { class: 'keypad-grid' }, keyButtons),
      ),
    );

    const drawEntry = () => entryCells.forEach((c, i) => (c.textContent = entry[i] ?? '_'));

    const press = (k: string) => {
      if (done) return;
      playSfx('click');
      if (k === 'C') entry = '';
      else if (k === '←') entry = entry.slice(0, -1);
      else if (entry.length < p.digits) entry += k;
      drawEntry();
      if (entry.length === p.digits) check();
    };

    const check = () => {
      if (entry === code) {
        done = true;
        status.textContent = 'Click. The drawer slides open.';
        codeBox.classList.add('good');
        playSfx('success');
        keyButtons.forEach((b) => (b.disabled = true));
        finishTimer = window.setTimeout(() => ctx.finish({ success: true, heatDelta: 0, loot: 0, flags: [] }), 450);
        return;
      }
      playSfx('mistake');
      shake(ctx.root);
      ctx.addAlarm(p.wrongAlarm, 'mistake');
      status.textContent = 'Wrong code. Watch again.';
      entry = '';
      showFor = p.flashTime;
      drawEntry();
    };

    const stop = frameLoop((dt) => {
      showFor = Math.max(0, showFor - dt);
      const visible = p.alwaysShowCode || showFor > 0 || done;
      codeCells.forEach((c, i) => (c.textContent = visible ? code[i] : '•'));
      codeBox.classList.toggle('hidden-code', !visible);
      flashFill.style.width = `${p.alwaysShowCode ? 100 : (showFor / p.flashTime) * 100}%`;
    });

    drawEntry();
    return () => {
      stop();
      clearTimeout(finishTimer);
    };
  },
};
