import type { Rng } from '../core/rng';
import type { AlarmCause, MinigameDef, MinigameResult } from './types';

export interface RunMinigameOptions<P> {
  root: HTMLElement;
  params: P;
  rng: Rng;
  /** Called for every live alarm report. Defaults to ignoring it. */
  onAlarm?: (amount: number, cause: AlarmCause) => void;
}

export interface RunningMinigame {
  /** Resolves once the minigame finishes (or is aborted). */
  done: Promise<MinigameResult>;
  /** Stop early, e.g. when the cops arrive. Resolves `done` with a failed, 'aborted' result. */
  abort(): void;
}

/** Starts a minigame and wraps its lifecycle: alarm tally, single finish, cleanup. */
export function runMinigame<P>(def: MinigameDef<P>, opts: RunMinigameOptions<P>): RunningMinigame {
  let alarmTally = 0;
  let finished = false;
  let cleanup: (() => void) | null = null;
  let resolve!: (result: MinigameResult) => void;
  const done = new Promise<MinigameResult>((r) => (resolve = r));

  const end = (result: MinigameResult) => {
    if (finished) return;
    finished = true;
    // finish() may be called from inside start() before cleanup exists; defer.
    queueMicrotask(() => {
      cleanup?.();
      cleanup = null;
      resolve(result);
    });
  };

  cleanup = def.start({
    root: opts.root,
    params: opts.params,
    rng: opts.rng,
    addAlarm: (amount, cause) => {
      if (finished) return;
      alarmTally += amount;
      opts.onAlarm?.(amount, cause);
    },
    finish: (outcome) => end({ ...outcome, alarmDelta: alarmTally }),
  });

  return {
    done,
    abort: () => end({ success: false, alarmDelta: alarmTally, heatDelta: 0, loot: 0, flags: ['aborted'] }),
  };
}
