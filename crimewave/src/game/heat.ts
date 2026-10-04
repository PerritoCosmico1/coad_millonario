import { B, type HeatTier } from '../config/balance';

export function heatTier(heat: number): HeatTier {
  let tier = B.heat.tiers[0];
  for (const t of B.heat.tiers) if (heat >= t.min) tier = t;
  return tier;
}

export function isBusted(heat: number): boolean {
  return heat >= B.heat.max;
}
