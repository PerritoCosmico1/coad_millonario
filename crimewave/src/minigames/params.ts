/**
 * Minigame params, built from balance + ante + crew + gear + intel + active
 * modifiers. Pure functions of a ParamContext, so minigames never read game
 * state themselves. game/heistRules.ts builds the context from the run.
 */

import { B } from '../config/balance';
import type { CrewId } from '../data/crew';
import type { GearId } from '../data/gear';
import type { IntelId } from '../data/intel';
import type { ModifierId } from '../data/modifiers';
import { windowScale } from '../game/scaling';
import type { HoldParams } from './hold';
import type { KeypadParams } from './keypad';
import type { LockpickParams } from './lockpick';
import type { SafeDialParams } from './safeDial';
import type { MinigameId } from './types';

export interface ParamContext {
  ante: number;
  gear: readonly GearId[];
  crew: readonly CrewId[];
  intel: readonly IntelId[];
  /** Active modifiers only (rolled and not cancelled). */
  modifiers: readonly ModifierId[];
}

/** Ante 1, starting gear, nobody special — used by the debug sandbox. */
export const NEUTRAL_CONTEXT: ParamContext = { ante: 1, gear: ['lockpickSet'], crew: [], intel: [], modifiers: [] };

export function lockpickParams(ctx: ParamContext): LockpickParams {
  const b = B.heist.lockpick;
  return {
    pins: b.pins,
    sweetSpot: b.sweetSpot * windowScale(ctx.ante),
    markerSpeed: b.markerSpeed,
    speedUpPerPin: b.speedUpPerPin,
    missAlarm: b.missAlarm,
  };
}

export function keypadParams(ctx: ParamContext): KeypadParams {
  const b = B.heist.keypad;
  const extra = ctx.crew.includes('ziggy') ? B.crew.ziggy.keypadExtraFlash : 0;
  return {
    digits: b.digits,
    flashTime: (b.flashTime + extra) * windowScale(ctx.ante),
    alwaysShowCode: ctx.intel.includes('keypadCode'),
    wrongAlarm: b.wrongAlarm,
  };
}

export function safeDialParams(ctx: ParamContext): SafeDialParams {
  const b = B.heist.safe;
  const stethoscope = ctx.gear.includes('stethoscope');
  return {
    numbers: ctx.modifiers.includes('reinforcedSafe') ? B.modifiers.reinforcedSafe.numbers : b.numbers,
    tolerance: (stethoscope ? B.gear.stethoscope.safeTolerance : b.tolerance) * windowScale(ctx.ante),
    bigPulse: stethoscope,
    wrongAlarm: b.wrongAlarm,
    minTravel: b.minTravel,
  };
}

/** Loud hold-to-force methods: prying the register, crowbarring the safe. */
export function holdParams(kind: 'pry' | 'crowbar', ctx: ParamContext): HoldParams {
  if (kind === 'pry') {
    const b = B.heist.keypad;
    return { label: 'Pry it open', seconds: b.pryHold, alarmPerSec: b.pryAlarm / b.pryHold };
  }
  const b = B.heist.safe;
  const base = ctx.modifiers.includes('reinforcedSafe') ? B.modifiers.reinforcedSafe.crowbarTime : b.crowbarTime;
  const drill = ctx.gear.includes('drill') ? B.gear.drill.crowbarTimeMult : 1;
  return { label: ctx.gear.includes('drill') ? 'Drill it' : 'Crowbar it', seconds: base * drill, alarmPerSec: b.crowbarAlarmPerSec };
}

/** Params for a minigame by id, or undefined to use its defaults. */
export function paramsFor(id: MinigameId, ctx: ParamContext): unknown {
  switch (id) {
    case 'lockpick':
      return lockpickParams(ctx);
    case 'keypad':
      return keypadParams(ctx);
    case 'safeDial':
      return safeDialParams(ctx);
    default:
      return undefined;
  }
}
