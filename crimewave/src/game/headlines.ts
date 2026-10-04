/** Picks the newspaper headline for a heist outcome from data/headlines.ts. */

import type { Rng } from '../core/rng';
import { HEADLINES, STREAK_HEADLINES } from '../data/headlines';
import type { HeadlineTag } from '../data/types';

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

export interface HeadlineContext {
  tags: HeadlineTag[];
  ante: number;
  /** People in the crew including you, for {crew}. */
  crewSize: number;
  target: string;
}

export function pickHeadline(ctx: HeadlineContext, rng: Rng): { headline: string; subhead: string | null } {
  const matches = HEADLINES.filter((t) => t.tags.every((tag) => ctx.tags.includes(tag)));
  const score = (t: (typeof HEADLINES)[number]) => t.priority * 100 + t.tags.length;
  const best = Math.max(...matches.map(score));
  const template = rng.pick(matches.filter((t) => score(t) === best));

  const streak = STREAK_HEADLINES.filter((s) => ctx.ante >= s.minAnte).sort((a, b) => b.minAnte - a.minAnte)[0];

  return {
    headline: fill(template.text, ctx),
    subhead: streak ? fill(streak.text, ctx) : null,
  };
}

function fill(text: string, ctx: HeadlineContext): string {
  const crew = ctx.crewSize <= 1 ? 'robber' : ctx.crewSize === 2 ? 'pair' : ctx.crewSize === 3 ? 'trio' : 'gang';
  const target = ctx.target;
  return text
    .replaceAll('{crew}', crew)
    .replaceAll('{target}', target)
    .replaceAll('{Target}', target[0].toUpperCase() + target.slice(1))
    .replaceAll('{Ordinal}', ORDINALS[ctx.ante - 1] ?? `${ctx.ante}th`)
    .replaceAll('{n}', String(ctx.ante));
}
