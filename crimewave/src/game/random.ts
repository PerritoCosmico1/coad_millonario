import { rngFrom, type Rng } from '../core/rng';
import { run } from './state';

/**
 * A deterministic RNG stream for one purpose in the current run, e.g.
 * runRng('modifiers') or runRng('heist', 'safeDial', attempt).
 * Keys are scoped to the current ante automatically.
 */
export function runRng(...key: (string | number)[]): Rng {
  const r = run();
  return rngFrom(r.seed, 'ante', r.ante.n, ...key);
}
