/**
 * Seeded RNG. Everything random in a run comes from here.
 *
 * Instead of one shared stream, each purpose gets its own stream derived from
 * the run seed plus a key (see `runRng` in game/random.ts). That way, what you
 * do in one minigame never changes what the shop rolls later — a seed replays
 * the same run.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Returns a shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** Up to n distinct items, in random order. */
  sample<T>(items: readonly T[], n: number): T[];
}

/** cyrb53-style string hash folded to 32 bits. */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** mulberry32 PRNG. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: (items, n) => rng.shuffle(items).slice(0, Math.max(0, n)),
  };
  return rng;
}

/** RNG seeded from any list of parts, e.g. rngFrom('K7QX2M9P', 'ante', 1, 'shop'). */
export function rngFrom(...parts: (string | number)[]): Rng {
  return createRng(hashString(parts.join('|')));
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A fresh human-friendly seed. The only place Math.random is used. */
export function randomSeed(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  return s;
}

/** Seeds are case-insensitive and ignore spaces/dashes. Returns '' if nothing usable. */
export function normalizeSeed(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

/** "K7QX2M9P" → "K7QX-2M9P" for display. */
export function formatSeed(seed: string): string {
  return seed.length > 4 ? `${seed.slice(0, 4)}-${seed.slice(4)}` : seed;
}
