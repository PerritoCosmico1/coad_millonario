/**
 * The heist clock. The heist screen calls tickHeist(dt) every frame: it adds
 * passive alarm, runs night patrols and counts down once the cops are called.
 */

import { B } from '../config/balance';
import { emit } from '../core/events';
import { playSfx } from '../core/sfx';
import { patrolGap, passiveAlarmRate, raiseAlarm } from './heistRules';
import { heist, notify } from './state';

export interface TickResult {
  /** The cops arrived: the heist is over and it's a chase. */
  forcedOut: boolean;
}

export function tickHeist(dt: number): TickResult {
  const h = heist();
  h.elapsed += dt;

  const rate = passiveAlarmRate();
  if (rate > 0 && !h.copsCalled) raiseAlarm(rate * dt, 'passive');

  if (h.time === 'night') {
    const p = h.patrol;
    if (!p.active && h.elapsed >= p.nextAt) {
      p.active = true;
      p.endsAt = h.elapsed + B.heist.patrol.duration;
      playSfx('patrol');
      emit({ type: 'toast', text: 'PATROL PASSING' });
    } else if (p.active && h.elapsed >= p.endsAt) {
      p.active = false;
      p.n += 1;
      p.nextAt = Math.max(h.elapsed + 1, p.nextAt + patrolGap(p.n));
    }
  }

  if (h.copsTimer !== null) h.copsTimer = Math.max(0, h.copsTimer - dt);

  notify();
  return { forcedOut: h.copsTimer === 0 };
}

/** Debug: start the next patrol right away. */
export function debugPatrolNow(): void {
  const h = heist();
  if (!h.patrol.active) h.patrol.nextAt = h.elapsed;
  notify();
}

/** Debug: jump the heist clock forward (no passive alarm for the skipped time). */
export function debugAdvanceClock(seconds: number): void {
  heist().elapsed += seconds;
  notify();
}
