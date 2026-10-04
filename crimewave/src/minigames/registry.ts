/** Every minigame by id. Real implementations replace the stubs milestone by milestone. */

import { hold } from './hold';
import { keypad } from './keypad';
import { lockpick } from './lockpick';
import { safeDial } from './safeDial';
import { stubMinigame } from './stub';
import type { MinigameDef, MinigameId } from './types';

/** Params differ per minigame, so the registry is loosely typed; each module types its own. */
export const MINIGAMES: Record<MinigameId, MinigameDef<any>> = {
  viewfinder: stubMinigame('viewfinder', 'Case the joint', 'Frame lit points of interest with the viewfinder and hold to snap them. Holding the camera up raises suspicion.', 'M3'),
  pickpocket: stubMinigame('pickpocket', 'Pickpocket', "Drag your hand into the manager's pocket and hold it there while their attention is low.", 'M3'),
  hotwire: stubMinigame('hotwire', 'Hotwire', 'Drag each left wire to its matching right wire before time runs out.', 'M3'),
  lockpick,
  keypad,
  safeDial,
  hold,
  chase: stubMinigame('chase', 'Chase', 'At each intersection, pick the direction the scanner says is clear before time runs out.', 'M2'),
};

export const MINIGAME_IDS = Object.keys(MINIGAMES) as MinigameId[];
