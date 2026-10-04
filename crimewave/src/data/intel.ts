import type { IntelDef } from './types';

/** Intel items: one-ante advantages earned while scouting. */
const INTEL_DATA = {
  keypadCode: {
    name: 'Keypad code',
    text: 'The register keypad code stays on screen the whole time.',
  },
  managersKeys: {
    name: "Manager's keys",
    text: 'Skips the lockpick on the back door (night) or the office door (day).',
  },
} satisfies Record<string, IntelDef>;

export type IntelId = keyof typeof INTEL_DATA;
export const INTEL: Record<IntelId, IntelDef> = INTEL_DATA;
export const INTEL_IDS = Object.keys(INTEL) as IntelId[];
