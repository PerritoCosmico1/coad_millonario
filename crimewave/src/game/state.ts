/**
 * The one central game state. Screens read it directly; changes go through the
 * small named functions in game/actions.ts, which call notify().
 */

import { randomSeed } from '../core/rng';
import type { CrewId } from '../data/crew';
import type { GearId } from '../data/gear';
import type { IntelId } from '../data/intel';
import type { ModifierId } from '../data/modifiers';
import type { PartnerId } from '../data/partners';
import type { HeadlineTag, RoleId, TimeOfDay } from '../data/types';
import type { MinigameId } from '../minigames/types';

export type ScreenId =
  | 'title'
  | 'partnerSelect'
  | 'anteIntro'
  | 'blindSelect'
  | 'scouting'
  | 'prep'
  | 'safehouse'
  | 'heistSetup'
  | 'heist'
  | 'escape'
  | 'payout'
  | 'headline'
  | 'runSummary'
  | 'sandbox';

export type BlindId = 'scouting' | 'prep' | 'heist';
export const BLIND_IDS: BlindId[] = ['scouting', 'prep', 'heist'];
export type BlindStatus = 'pending' | 'done' | 'skipped';

export interface CrewMember {
  /** Unique within the run. */
  uid: number;
  id: CrewId;
  loyalty: number;
}

export interface AnteState {
  n: number;
  blinds: Record<BlindId, BlindStatus>;
  /** Modifiers rolled for this ante's heist. */
  modifiers: ModifierId[];
  /** The subset of `modifiers` the player knows about. */
  revealed: ModifierId[];
  onEdge: boolean;
  intel: IntelId[];
}

export type EscapeOutcome =
  | { kind: 'clean' }
  | { kind: 'chaseEscaped' }
  | { kind: 'droppedBag' }
  | { kind: 'leftBehind'; name: string };

/** Filled in when the heist ends (after the escape). */
export interface HeistResult {
  escape: EscapeOutcome;
  /** Loot actually carried home. */
  loot: number;
  heatGained: number;
  tags: HeadlineTag[];
}

export interface HeistState {
  time: TimeOfDay;
  /** Role per crew member uid. Unassigned members aren't listed. */
  roles: Record<number, RoleId>;
  alarm: number;
  /** Loot in the bag so far. */
  loot: number;
  /** Flat heat from heist events (crowd running out, etc.), applied at the end. */
  flatHeat: number;
  /** Index of the current obstacle in the plan. */
  step: number;
  copsCalled: boolean;
  usedLoud: boolean;
  result: HeistResult | null;
}

export interface RunStats {
  antesCleared: number;
  /** Cash that came into your pocket: your share of payouts plus skip rewards. */
  cashEarned: number;
  crewLost: { name: string; reason: string }[];
}

export interface RunState {
  seed: string;
  partner: PartnerId | null;
  cash: number;
  heat: number;
  crew: CrewMember[];
  nextUid: number;
  /** Inventory, one entry per slot. */
  gear: GearId[];
  ante: AnteState;
  heist: HeistState | null;
  headline: { headline: string; subhead: string | null } | null;
  stats: RunStats;
  ended: 'busted' | 'quit' | null;
}

export interface GameState {
  /** Seed shown on the title screen, used for the next new run. */
  titleSeed: string;
  screen: ScreenId;
  run: RunState | null;
  /** Debug sandbox: which minigame to run and where to go back to. */
  sandbox: { minigame: MinigameId; returnTo: ScreenId };
}

export const game: GameState = {
  titleSeed: randomSeed(),
  screen: 'title',
  run: null,
  sandbox: { minigame: 'lockpick', returnTo: 'title' },
};

/** The active run. Throws if there isn't one — screens that need a run use this. */
export function run(): RunState {
  if (!game.run) throw new Error('No active run');
  return game.run;
}

/** The active heist. Throws if there isn't one. */
export function heist(): HeistState {
  const h = run().heist;
  if (!h) throw new Error('No active heist');
  return h;
}

/** The blind the player is on: the first one not done or skipped. */
export function currentBlind(ante: AnteState): BlindId {
  return BLIND_IDS.find((b) => ante.blinds[b] === 'pending') ?? 'heist';
}

// --- change notification -------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();
let scheduled = false;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tell the UI the state changed. Batched: listeners run once per microtask. */
export function notify(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const fn of listeners) fn();
  });
}
