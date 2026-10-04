/**
 * Brute force (loud methods: pry the register, crowbar the safe). Hold the
 * mouse button until the bar fills. Alarm rises the whole time you hold;
 * letting go pauses both.
 */

import { frameLoop } from '../core/loop';
import { playSfx } from '../core/sfx';
import { meter } from '../ui/components';
import { h, render } from '../ui/dom';
import { holdParams, NEUTRAL_CONTEXT } from './params';
import type { MinigameDef } from './types';

export interface HoldParams {
  label: string;
  seconds: number;
  /** Base alarm per second while holding. */
  alarmPerSec: number;
}

/** Report alarm in chunks of at least this much, so pop-ups stay readable. */
const ALARM_CHUNK = 2;

export const hold: MinigameDef<HoldParams> = {
  id: 'hold',
  name: 'Brute force',
  howTo: 'Hold the mouse button on the big button until the bar fills. Alarm rises while you hold.',
  defaultParams: () => holdParams('crowbar', NEUTRAL_CONTEXT),

  start(ctx) {
    const p = ctx.params;
    let progress = 0;
    let holding = false;
    let pendingAlarm = 0;
    let done = false;
    let finishTimer = 0;

    const bar = meter({ color: 'var(--loud)', max: p.seconds });
    const btn = h('button', { class: 'btn loud hold-btn' }, `Hold to ${p.label.toLowerCase()}`);
    const note = h('p', { class: 'mg-status' }, `+${p.alarmPerSec.toFixed(1).replace(/\.0$/, '')} alarm per second while you hold (before modifiers).`);
    render(ctx.root, h('div', { class: 'mg hold' }, h('strong', null, p.label), btn, bar.el, note));

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || done) return;
      holding = true;
      btn.classList.add('holding');
    };
    const onUp = () => {
      holding = false;
      btn.classList.remove('holding');
    };
    btn.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    const flushAlarm = () => {
      if (pendingAlarm > 0) ctx.addAlarm(pendingAlarm, 'loud');
      pendingAlarm = 0;
    };

    const stop = frameLoop((dt) => {
      if (holding && !done) {
        const step = Math.min(dt, p.seconds - progress);
        progress += step;
        pendingAlarm += p.alarmPerSec * step;
        if (pendingAlarm >= ALARM_CHUNK) flushAlarm();
        if (progress >= p.seconds) {
          done = true;
          flushAlarm();
          onUp();
          btn.disabled = true;
          btn.textContent = 'Done';
          playSfx('success');
          finishTimer = window.setTimeout(() => ctx.finish({ success: true, heatDelta: 0, loot: 0, flags: [] }), 300);
        }
      }
      bar.set(progress, `${progress.toFixed(1)} / ${p.seconds.toFixed(1)}s`);
    });

    return () => {
      stop();
      clearTimeout(finishTimer);
      if (!done) flushAlarm();
      btn.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  },
};
