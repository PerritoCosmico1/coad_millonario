/** Ante scaling (design doc section 10). Ante n scales by factor^(n−1). */

import { B } from '../config/balance';
import { MODIFIER_IDS } from '../data/modifiers';
import { heatTier } from './heat';

export function lootScale(ante: number): number {
  return B.ante.lootGrowth ** (ante - 1);
}

export function alarmScale(ante: number): number {
  return B.ante.alarmGrowth ** (ante - 1);
}

/** Sweet spots, tolerances, timers and flash times. */
export function windowScale(ante: number): number {
  return B.ante.windowShrink ** (ante - 1);
}

/** How many modifiers to roll for ante n at the given heat. */
export function modifierCount(ante: number, heat: number): number {
  const n = B.ante.baseModifiers + Math.floor((ante - 1) / B.ante.extraModifierEvery) + heatTier(heat).extraModifiers;
  return Math.min(n, MODIFIER_IDS.length);
}

/** Loot range for a loot table at ante n. */
export function lootRange(table: 'register' | 'safe', ante: number): { min: number; max: number } {
  const base = B.heist.loot[table];
  const s = lootScale(ante);
  return { min: Math.round(base.min * s), max: Math.round(base.max * s) };
}
