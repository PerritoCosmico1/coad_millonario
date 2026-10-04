import { B } from '../config/balance';
import type { CrewDef } from './types';

/** Hire pool. The safehouse hire board shows a few at random. */
export const HIRES = {
  lefty: {
    name: 'Lefty',
    title: 'the wheelman',
    preferredRole: 'driver',
    perkText: 'Chase: first wrong turn is forgiven.',
    cut: B.crew.lefty.cut,
    startingLoyalty: B.crew.lefty.loyalty,
    fee: B.crew.lefty.fee,
  },
  bigSal: {
    name: 'Big Sal',
    title: 'the muscle',
    preferredRole: 'muscle',
    perkText: 'Intimidating civilians adds no heat.',
    cut: B.crew.bigSal.cut,
    startingLoyalty: B.crew.bigSal.loyalty,
    fee: B.crew.bigSal.fee,
  },
  nina: {
    name: 'Nina',
    title: 'the lookout',
    preferredRole: 'lookout',
    perkText: `Night patrols pass ${Math.round((1 - B.crew.nina.patrolFrequencyMult) * 100)}% less often.`,
    cut: B.crew.nina.cut,
    startingLoyalty: B.crew.nina.loyalty,
    fee: B.crew.nina.fee,
  },
} satisfies Record<string, CrewDef>;

export type HireId = keyof typeof HIRES;
