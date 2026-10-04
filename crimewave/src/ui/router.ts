/**
 * Screen router. One screen is mounted at a time; goTo() swaps it.
 * Screens are registered from main.ts so this module doesn't import them.
 */

import { isBusted } from '../game/heat';
import { endRun } from '../game/actions';
import { game, notify, type ScreenId } from '../game/state';

export interface Screen {
  /** Build the screen into `root`. Return a cleanup if it starts timers or listeners. */
  mount(root: HTMLElement): void | (() => void);
}

let screens: Partial<Record<ScreenId, Screen>> = {};
let root: HTMLElement | null = null;
let cleanup: void | (() => void);

export function initRouter(screenRoot: HTMLElement, registry: Record<ScreenId, Screen>): void {
  root = screenRoot;
  screens = registry;
}

/** Screens that still make sense once heat hits 100. */
const BUSTED_OK: ScreenId[] = ['title', 'runSummary', 'sandbox'];

export function goTo(id: ScreenId): void {
  if (!root) throw new Error('Router not initialised');

  // Busted: heat at 100 ends the run at the next screen change.
  let target = id;
  if (game.run && !game.run.ended && isBusted(game.run.heat) && !BUSTED_OK.includes(id)) {
    endRun('busted');
    target = 'runSummary';
  }

  cleanup?.();
  cleanup = undefined;
  root.replaceChildren();
  root.scrollTop = 0;
  game.screen = target;
  const screen = screens[target];
  if (!screen) throw new Error(`Unknown screen: ${target}`);
  cleanup = screen.mount(root);
  notify();
}

/** Re-mount the current screen (used by the debug panel after big state changes). */
export function refreshScreen(): void {
  goTo(game.screen);
}
