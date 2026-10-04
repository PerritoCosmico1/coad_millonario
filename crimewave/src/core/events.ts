/**
 * Tiny event bus for one-shot feedback (number pop-ups, shakes) that isn't
 * game state. Game logic emits; the UI listens.
 */

export type GameEvent =
  | { type: 'stat'; stat: 'cash' | 'heat' | 'alarm' | 'loot'; delta: number }
  | { type: 'shake' }
  | { type: 'toast'; text: string; tone?: 'info' | 'good' | 'bad' };

type Listener = (event: GameEvent) => void;

const listeners = new Set<Listener>();

export function onEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(event: GameEvent): void {
  for (const fn of listeners) fn(event);
}
