/** Bits shared by several screens. */

import { rngFrom } from '../core/rng';
import { MODIFIERS } from '../data/modifiers';
import { ON_EDGE } from '../data/modifiers';
import { runRng } from '../game/random';
import { game, type AnteState } from '../game/state';
import { MINIGAMES } from '../minigames/registry';
import { runMinigame, type RunningMinigame } from '../minigames/runner';
import type { AlarmCause, MinigameId } from '../minigames/types';
import { chip } from '../ui/components';
import { h } from '../ui/dom';

/** Known modifiers by name, unknown ones as "???". */
export function modifierChips(ante: AnteState): HTMLElement {
  const hidden = ante.modifiers.length - ante.revealed.length;
  return h(
    'div',
    { class: 'chips' },
    ante.revealed.map((id) => chip(MODIFIERS[id].name, 'modifier revealed')),
    Array.from({ length: hidden }, () => chip('???', 'modifier hidden')),
    ante.onEdge ? chip(ON_EDGE.name, 'modifier on-edge') : null,
  );
}

/** Revealed modifiers with their effect text. */
export function modifierList(ante: AnteState): HTMLElement {
  const hidden = ante.modifiers.length - ante.revealed.length;
  return h(
    'ul',
    { class: 'modifier-list' },
    ante.revealed.map((id) => h('li', null, h('strong', null, MODIFIERS[id].name), ' — ', MODIFIERS[id].text)),
    ante.onEdge ? h('li', null, h('strong', null, ON_EDGE.name), ' — ', ON_EDGE.text) : null,
    hidden > 0 ? h('li', { class: 'muted' }, `??? × ${hidden} — unknown. They'll show themselves during the heist.`) : null,
    ante.modifiers.length === 0 && !ante.onEdge ? h('li', { class: 'muted' }, 'No modifiers.') : null,
  );
}

let sandboxRuns = 0;

/**
 * Run a minigame from the registry inside `container`. Uses the run's seeded
 * RNG (keyed by `rngKey`), or a sandbox stream when there's no run.
 */
export function hostMinigame(
  container: HTMLElement,
  id: MinigameId,
  opts: { params?: unknown; rngKey: (string | number)[]; onAlarm?: (amount: number, cause: AlarmCause) => void },
): RunningMinigame {
  const def = MINIGAMES[id];
  const rng = game.run ? runRng(...opts.rngKey) : rngFrom(game.titleSeed, 'sandbox', id, sandboxRuns++);
  return runMinigame(def, { root: container, params: opts.params ?? def.defaultParams(), rng, onAlarm: opts.onAlarm });
}
