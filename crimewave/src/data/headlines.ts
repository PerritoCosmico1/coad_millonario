import type { HeadlineTemplate, StreakTemplate } from './types';

/**
 * Newspaper headlines after each heist, chosen by outcome tags.
 * Tags: night, day, quiet, loud, clean, chase, droppedBag, leftBehind.
 */
export const HEADLINES: HeadlineTemplate[] = [
  { tags: ['leftBehind'], priority: 3, text: 'One suspect arrested after {target} heist — partner escapes' },
  { tags: ['droppedBag'], priority: 3, text: 'Robbers flee empty-handed after police chase' },
  { tags: ['chase'], priority: 2, text: 'High-speed chase follows {target} robbery; suspects still at large' },
  { tags: ['night', 'quiet', 'clean'], priority: 1, text: '{Target} robbed overnight — police baffled' },
  { tags: ['day', 'loud', 'clean'], priority: 1, text: 'Masked {crew} hold up downtown {target} in broad daylight' },
  { tags: ['night', 'loud', 'clean'], priority: 1, text: 'Smash-and-grab at {target} wakes the whole block' },
  { tags: ['day', 'quiet', 'clean'], priority: 1, text: 'Cool customers: {crew} walk out of {target} with the till' },
  { tags: ['night'], priority: 0, text: 'Late-night break-in at corner {target}' },
  { tags: ['day'], priority: 0, text: 'Daylight robbery rattles {target} regulars' },
  { tags: [], priority: 0, text: '{Target} hit; police ask for witnesses' },
];

/** Subheads for ante 2+, referencing the streak. The highest minAnte that applies wins. */
export const STREAK_HEADLINES: StreakTemplate[] = [
  { minAnte: 2, text: '{Ordinal} hit in a week: is a new crew working the city?' },
  { minAnte: 4, text: '{Ordinal} robbery this month — the mayor promises a crackdown' },
  { minAnte: 6, text: 'Crime wave! {n} jobs and counting — who is behind it?' },
];
