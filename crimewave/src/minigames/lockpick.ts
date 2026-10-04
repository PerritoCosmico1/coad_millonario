/**
 * Lockpick (design doc 6.4). One bar per pin; a marker slides back and forth.
 * Click when it's inside the green sweet spot. A miss costs alarm and moves
 * that pin's sweet spot.
 */

import { frameLoop } from '../core/loop';
import { playSfx } from '../core/sfx';
import { h, render } from '../ui/dom';
import { shake } from '../ui/fx';
import { PALETTE } from '../ui/palette';
import { lockpickParams, NEUTRAL_CONTEXT } from './params';
import type { MinigameDef } from './types';

export interface LockpickParams {
  pins: number;
  /** Sweet spot width as a fraction of the bar. */
  sweetSpot: number;
  /** Bar-widths per second for the first pin. */
  markerSpeed: number;
  speedUpPerPin: number;
  missAlarm: number;
}

const W = 760;
const BAR_X = 90;
const BAR_W = W - BAR_X - 30;
const BAR_H = 36;
const GAP = 26;
const FLASH_TIME = 0.35;

export const lockpick: MinigameDef<LockpickParams> = {
  id: 'lockpick',
  name: 'Lockpick',
  howTo: 'Click when the sliding marker is inside the green sweet spot — once per pin. A miss raises the alarm.',
  defaultParams: () => lockpickParams(NEUTRAL_CONTEXT),

  start(ctx) {
    const p = ctx.params;
    const H = p.pins * (BAR_H + GAP) + GAP;
    const canvas = h('canvas', { class: 'mg-canvas', width: W, height: H });
    const status = h('span', { class: 'mg-status' });
    render(
      ctx.root,
      h(
        'div',
        { class: 'mg lockpick' },
        h('div', { class: 'mg-head' }, h('strong', null, 'Lockpick'), status),
        canvas,
        h('p', { class: 'muted small' }, 'Click anywhere in this panel when the marker is in the green.'),
      ),
    );
    const g = canvas.getContext('2d')!;

    let pin = 0;
    let pos = 0;
    let dir = 1;
    let spot = newSpot();
    let flash: { pin: number; good: boolean; t: number } | null = null;
    let done = false;
    let finishTimer = 0;

    function newSpot(): number {
      return ctx.rng.float(p.sweetSpot / 2, 1 - p.sweetSpot / 2);
    }

    const updateStatus = () => (status.textContent = done ? 'Open!' : `Pin ${pin + 1} of ${p.pins}`);

    const attempt = () => {
      if (Math.abs(pos - spot) <= p.sweetSpot / 2) {
        flash = { pin, good: true, t: 0 };
        pin++;
        if (pin >= p.pins) {
          done = true;
          playSfx('success');
          finishTimer = window.setTimeout(() => ctx.finish({ success: true, heatDelta: 0, loot: 0, flags: [] }), 450);
        } else {
          playSfx('pinSet');
          pos = 0;
          dir = 1;
          spot = newSpot();
        }
      } else {
        flash = { pin, good: false, t: 0 };
        playSfx('mistake');
        shake(ctx.root);
        ctx.addAlarm(p.missAlarm, 'mistake');
        spot = newSpot();
      }
      updateStatus();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || done) return;
      attempt();
    };
    ctx.root.addEventListener('pointerdown', onDown);

    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.font = '600 14px system-ui, sans-serif';
      g.textBaseline = 'middle';
      for (let i = 0; i < p.pins; i++) {
        const y = GAP + i * (BAR_H + GAP);
        const set = i < pin;
        const current = i === pin && !done;
        g.fillStyle = current ? PALETTE.text : PALETTE.muted;
        g.fillText(`Pin ${i + 1}`, 20, y + BAR_H / 2);

        g.fillStyle = set ? 'rgba(76, 195, 138, 0.25)' : PALETTE.track;
        g.fillRect(BAR_X, y, BAR_W, BAR_H);
        g.strokeStyle = current ? PALETTE.accent : PALETTE.line;
        g.lineWidth = current ? 2 : 1;
        g.strokeRect(BAR_X + 0.5, y + 0.5, BAR_W - 1, BAR_H - 1);

        if (set) {
          g.fillStyle = PALETTE.good;
          g.fillText('SET', BAR_X + BAR_W / 2 - 12, y + BAR_H / 2);
        } else if (current) {
          g.fillStyle = 'rgba(76, 195, 138, 0.55)';
          g.fillRect(BAR_X + (spot - p.sweetSpot / 2) * BAR_W, y + 2, p.sweetSpot * BAR_W, BAR_H - 4);
          const mx = BAR_X + pos * BAR_W;
          g.fillStyle = PALETTE.text;
          g.fillRect(mx - 2, y - 6, 4, BAR_H + 12);
        }

        if (flash && flash.pin === i && flash.t < FLASH_TIME) {
          const a = 1 - flash.t / FLASH_TIME;
          g.fillStyle = flash.good ? `rgba(76, 195, 138, ${0.5 * a})` : `rgba(255, 59, 59, ${0.5 * a})`;
          g.fillRect(BAR_X, y, BAR_W, BAR_H);
        }
      }
    };

    updateStatus();
    const stop = frameLoop((dt) => {
      if (flash) flash.t += dt;
      if (!done) {
        pos += dir * p.markerSpeed * p.speedUpPerPin ** pin * dt;
        if (pos > 1) {
          pos = 2 - pos;
          dir = -1;
        } else if (pos < 0) {
          pos = -pos;
          dir = 1;
        }
      }
      draw();
    });

    return () => {
      stop();
      clearTimeout(finishTimer);
      ctx.root.removeEventListener('pointerdown', onDown);
    };
  },
};
