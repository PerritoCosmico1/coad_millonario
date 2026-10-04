/**
 * The minigame contract.
 *
 * A minigame is a self-contained module. Its host (a screen) gives it a root
 * element, its params and an RNG, and gets back a MinigameResult. Minigames
 * never touch global game state: they report alarm live through
 * `ctx.addAlarm` (the host applies multipliers like patrols, On edge and ante
 * scaling) and hand everything else back in the result.
 */

import type { Rng } from '../core/rng';

export type MinigameId =
  | 'viewfinder'
  | 'pickpocket'
  | 'hotwire'
  | 'lockpick'
  | 'keypad'
  | 'safeDial'
  | 'hold'
  | 'chase';

/** Why alarm was raised — hosts treat these differently (e.g. silent alarm, patrols). */
export type AlarmCause = 'mistake' | 'loud';

export interface MinigameResult {
  success: boolean;
  /** Raw alarm the minigame reported via ctx.addAlarm (a tally — the host already applied it). */
  alarmDelta: number;
  /** Flat heat for the host to apply. */
  heatDelta: number;
  /** Cash value of loot grabbed. */
  loot: number;
  /** Free-form outcome flags, e.g. 'onEdge', 'intel:keypadCode', 'poi:safe', 'aborted'. */
  flags: string[];
}

/** What a minigame passes to ctx.finish — the runner fills in the alarm tally. */
export type MinigameOutcome = Omit<MinigameResult, 'alarmDelta'>;

export interface MinigameContext<P> {
  /** Element to render into. The host owns it and clears it afterwards. */
  root: HTMLElement;
  params: P;
  rng: Rng;
  /** Report alarm live (base amount, before the host's multipliers). */
  addAlarm(amount: number, cause: AlarmCause): void;
  /** End the minigame. Only the first call counts. */
  finish(outcome: MinigameOutcome): void;
}

export interface MinigameDef<P = unknown> {
  id: MinigameId;
  name: string;
  /** One-line "how to play", shown by hosts before starting. */
  howTo: string;
  /** Params used when launched from the debug sandbox. */
  defaultParams(): P;
  /** Start playing. Return a cleanup that stops timers and removes listeners. */
  start(ctx: MinigameContext<P>): () => void;
}
