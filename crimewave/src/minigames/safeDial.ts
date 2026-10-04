/**
 * Safe dial (design doc 6.6). Drag in a circle to turn the 0–99 dial. When the
 * number under the marker passes within ± tolerance of the target, the dial
 * pulses. Release and Confirm to lock that number in. A wrong confirm costs
 * alarm and you keep hunting for the same number.
 */

import { frameLoop } from '../core/loop';
import { playSfx } from '../core/sfx';
import { h, render } from '../ui/dom';
import { shake } from '../ui/fx';
import { PALETTE } from '../ui/palette';
import { localPoint } from '../ui/stage';
import { NEUTRAL_CONTEXT, safeDialParams } from './params';
import type { MinigameDef } from './types';

export interface SafeDialParams {
  numbers: number;
  /** Dial clicks within ± this many numbers of the target. */
  tolerance: number;
  /** Stethoscope: a bigger, brighter pulse. */
  bigPulse: boolean;
  wrongAlarm: number;
  /** New targets are at least this far (in numbers) from the dial's position. */
  minTravel: number;
}

const SIZE = 420;
const C = SIZE / 2;
const R = 165;
const TAU = Math.PI * 2;
const PULSE_TIME = 0.45;

/** Distance between two dial numbers, going the short way round. */
function dialDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 100) + 100) % 100);
  return Math.min(d, 100 - d);
}

export const safeDial: MinigameDef<SafeDialParams> = {
  id: 'safeDial',
  name: 'Safe dial',
  howTo: 'Drag in a circle to turn the dial. When it pulses, you are on a number: release and Confirm. A wrong number raises the alarm.',
  defaultParams: () => safeDialParams(NEUTRAL_CONTEXT),

  start(ctx) {
    const p = ctx.params;
    const canvas = h('canvas', { class: 'mg-canvas dial', width: SIZE, height: SIZE });
    const readout = h('div', { class: 'dial-readout' });
    const combo = h('div', { class: 'combo' });
    const status = h('p', { class: 'mg-status' }, 'Turn the dial slowly and watch for the pulse.');
    const confirmBtn = h('button', { class: 'btn primary confirm', onClick: () => confirm() }, 'Confirm number');

    render(
      ctx.root,
      h(
        'div',
        { class: 'mg safe' },
        canvas,
        h(
          'div',
          { class: 'safe-side' },
          h('div', { class: 'mg-label' }, 'Combination'),
          combo,
          h('div', { class: 'mg-label' }, 'Dial'),
          readout,
          confirmBtn,
          status,
        ),
      ),
    );
    const g = canvas.getContext('2d')!;

    let rot = ctx.rng.float(0, TAU);
    const locked: number[] = [];
    let target = pickTarget();
    let wasIn = false;
    let pulse = Infinity;
    let dragging = false;
    let prevAngle = 0;
    let done = false;
    let finishTimer = 0;

    /** The (fractional) number under the marker at the top. */
    function current(): number {
      return (((-rot / TAU) * 100) % 100 + 100) % 100;
    }

    function pickTarget(): number {
      for (let i = 0; i < 50; i++) {
        const t = ctx.rng.int(0, 99);
        if (dialDistance(t, current()) >= p.minTravel && !locked.includes(t)) return t;
      }
      return (Math.round(current()) + 50) % 100;
    }

    const inWindow = () => dialDistance(current(), target) <= p.tolerance;

    const drawCombo = () => {
      const cells = [];
      for (let i = 0; i < p.numbers; i++) {
        cells.push(h('span', { class: `code-cell ${i < locked.length ? 'set' : i === locked.length ? 'current' : ''}` }, i < locked.length ? String(locked[i]).padStart(2, '0') : '__'));
      }
      render(combo, cells);
    };

    const angleOf = (e: PointerEvent) => {
      const pt = localPoint(e, canvas);
      return Math.atan2(pt.y - C, pt.x - C);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || done) return;
      dragging = true;
      prevAngle = angleOf(e);
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const a = angleOf(e);
      let d = a - prevAngle;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      rot += d;
      prevAngle = a;
      const inside = inWindow();
      if (inside && !wasIn) {
        pulse = 0;
        playSfx('dialClick');
      }
      wasIn = inside;
    };
    const onUp = () => {
      dragging = false;
      canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    function confirm(): void {
      if (done) return;
      if (inWindow()) {
        locked.push(target);
        pulse = Infinity;
        drawCombo();
        if (locked.length >= p.numbers) {
          done = true;
          confirmBtn.disabled = true;
          status.textContent = 'The handle turns. You\'re in.';
          playSfx('success');
          finishTimer = window.setTimeout(() => ctx.finish({ success: true, heatDelta: 0, loot: 0, flags: [] }), 500);
          return;
        }
        playSfx('pinSet');
        status.textContent = `Got it. ${p.numbers - locked.length} to go.`;
        target = pickTarget();
        wasIn = false;
        return;
      }
      playSfx('mistake');
      shake(ctx.root);
      ctx.addAlarm(p.wrongAlarm, 'mistake');
      status.textContent = 'Wrong number. Keep feeling for it.';
    }

    const draw = () => {
      g.clearRect(0, 0, SIZE, SIZE);

      // Pulse ring.
      if (pulse < PULSE_TIME) {
        const k = pulse / PULSE_TIME;
        g.strokeStyle = `rgba(232, 177, 74, ${(1 - k) * (p.bigPulse ? 0.95 : 0.6)})`;
        g.lineWidth = p.bigPulse ? 7 : 3;
        g.beginPath();
        g.arc(C, C, R + 4 + k * (p.bigPulse ? 34 : 18), 0, TAU);
        g.stroke();
      }

      // Dial face.
      g.fillStyle = PALETTE.panel;
      g.beginPath();
      g.arc(C, C, R, 0, TAU);
      g.fill();
      g.strokeStyle = PALETTE.line;
      g.lineWidth = 2;
      g.stroke();

      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '600 15px system-ui, sans-serif';
      for (let k = 0; k < 100; k++) {
        const a = rot + (k / 100) * TAU - Math.PI / 2;
        const len = k % 10 === 0 ? 18 : k % 5 === 0 ? 12 : 6;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        g.strokeStyle = k % 10 === 0 ? PALETTE.text : PALETTE.muted;
        g.lineWidth = k % 10 === 0 ? 2 : 1;
        g.beginPath();
        g.moveTo(C + cos * (R - len), C + sin * (R - len));
        g.lineTo(C + cos * (R - 2), C + sin * (R - 2));
        g.stroke();
        if (k % 10 === 0) {
          g.fillStyle = PALETTE.text;
          g.fillText(String(k), C + cos * (R - 34), C + sin * (R - 34));
        }
      }

      // Knob with grip line.
      g.fillStyle = '#2c323d';
      g.beginPath();
      g.arc(C, C, 58, 0, TAU);
      g.fill();
      g.strokeStyle = PALETTE.line;
      g.stroke();
      const ga = rot - Math.PI / 2;
      g.strokeStyle = PALETTE.muted;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(C - Math.cos(ga) * 40, C - Math.sin(ga) * 40);
      g.lineTo(C + Math.cos(ga) * 40, C + Math.sin(ga) * 40);
      g.stroke();

      // Fixed marker at the top.
      const lit = pulse < PULSE_TIME;
      g.fillStyle = lit ? PALETTE.accent : PALETTE.text;
      g.beginPath();
      g.moveTo(C - 10, C - R - 14);
      g.lineTo(C + 10, C - R - 14);
      g.lineTo(C, C - R + 2);
      g.closePath();
      g.fill();
    };

    drawCombo();
    const stop = frameLoop((dt) => {
      pulse += dt;
      readout.textContent = String(Math.round(current()) % 100).padStart(2, '0');
      draw();
    });

    return () => {
      stop();
      clearTimeout(finishTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  },
};
