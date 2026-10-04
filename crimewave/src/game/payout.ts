/** Payout math (design doc sections 5 and 7). Pure — no state changes. */

import { CREW } from '../data/crew';
import { heatTier } from './heat';
import type { RunState } from './state';

export interface PayoutLine {
  uid: number;
  name: string;
  cutPct: number;
  /** Their full cut in $. */
  amount: number;
}

export interface PayoutBreakdown {
  loot: number;
  fenceRate: number;
  pot: number;
  lines: PayoutLine[];
  /** What you keep if everyone is paid in full. */
  yourTake: number;
}

export function computePayout(r: RunState, loot: number): PayoutBreakdown {
  const fenceRate = heatTier(r.heat).fenceRate;
  const pot = Math.round(loot * fenceRate);
  const lines = r.crew.map((m) => {
    const def = CREW[m.id];
    return { uid: m.uid, name: def.name, cutPct: def.cut, amount: Math.round(pot * def.cut) };
  });
  const yourTake = Math.max(0, pot - lines.reduce((sum, l) => sum + l.amount, 0));
  return { loot, fenceRate, pot, lines, yourTake };
}
