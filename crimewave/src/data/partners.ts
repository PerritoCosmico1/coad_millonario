import { B } from '../config/balance';
import type { CrewDef } from './types';

/** Starting partners, chosen at the start of a run (like Balatro's decks). Placeholder names. */
export const PARTNERS = {
  vera: {
    name: 'Vera',
    title: 'the Charmer',
    preferredRole: 'lookout',
    perkText: `Pickpocket: attention rises ${slower(B.crew.vera.pickpocketAttentionMult)} slower. Viewfinder: suspicion rises ${slower(B.crew.vera.viewfinderSuspicionMult)} slower.`,
    cut: B.crew.vera.cut,
    startingLoyalty: B.crew.vera.loyalty,
  },
  moose: {
    name: 'Moose',
    title: 'the Brute',
    preferredRole: 'muscle',
    perkText: `All loud methods cost ${slower(B.crew.moose.loudAlarmMult)} less alarm.`,
    cut: B.crew.moose.cut,
    startingLoyalty: B.crew.moose.loyalty,
  },
  ziggy: {
    name: 'Ziggy',
    title: 'the Tech',
    preferredRole: 'lookout',
    perkText: `Cancels the "Extra camera" modifier. Keypad code stays on screen ${B.crew.ziggy.keypadExtraFlash}s longer. Hotwire timer +${B.crew.ziggy.hotwireExtraTime}s.`,
    cut: B.crew.ziggy.cut,
    startingLoyalty: B.crew.ziggy.loyalty,
  },
} satisfies Record<string, CrewDef>;

function slower(mult: number): string {
  return `${Math.round((1 - mult) * 100)}%`;
}

export type PartnerId = keyof typeof PARTNERS;
