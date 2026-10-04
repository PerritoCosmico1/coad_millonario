import { B } from '../config/balance';
import type { HeistPlanDef, ObstacleDef, TimeOfDay } from './types';

/** Heist obstacles. Each one can be done quiet (minigame) or loud. */
const OBSTACLES_DATA = {
  backDoor: {
    name: 'Back door',
    text: 'A locked steel door off the alley.',
    quiet: 'lockpick',
    loud: { label: 'Kick the door', text: 'Instant.', alarm: B.heist.lockpick.kickAlarm },
    skippedBy: 'managersKeys',
    quietNeeds: 'lockpickSet',
  },
  registerKeypad: {
    name: 'Register',
    text: 'Locked behind a 4-digit keypad.',
    quiet: 'keypad',
    loud: { label: 'Pry it open', text: `Hold for ${B.heist.keypad.pryHold}s.`, minigame: 'hold', alarm: B.heist.keypad.pryAlarm },
    loot: 'register',
  },
  registerStickUp: {
    name: 'Register',
    text: 'Stick-up: the clerk opens the register when threatened. Crowd control starts now.',
    quiet: null,
    loud: null,
    loot: 'register',
  },
  officeDoor: {
    name: 'Office door',
    text: 'The back office, where the safe is.',
    quiet: 'lockpick',
    loud: { label: 'Kick the door', text: 'Instant.', alarm: B.heist.lockpick.kickAlarm },
    skippedBy: 'managersKeys',
    quietNeeds: 'lockpickSet',
  },
  safe: {
    name: 'Safe',
    text: 'The back office safe. A big dial, 0–99.',
    quiet: 'safeDial',
    loud: {
      label: 'Crowbar',
      text: `Hold for ${B.heist.safe.crowbarTime}s, +${B.heist.safe.crowbarAlarmPerSec} alarm/s.`,
      minigame: 'hold',
    },
    loot: 'safe',
  },
} satisfies Record<string, ObstacleDef>;

export type ObstacleId = keyof typeof OBSTACLES_DATA;
export const OBSTACLES: Record<ObstacleId, ObstacleDef> = OBSTACLES_DATA;

/** Day / night plans: what the player sees on heist setup and the obstacle order. */
export const HEIST_PLANS: Record<TimeOfDay, HeistPlanDef> = {
  night: {
    name: 'Night',
    text: 'Quiet-friendly. Store closed, no crowd — but locked doors, a keypad and patrols outside.',
    obstacles: ['backDoor', 'registerKeypad', 'safe'],
  },
  day: {
    name: 'Day',
    text: 'Loud-friendly. A stick-up in open hours: the clerk opens the register, but the crowd needs controlling.',
    obstacles: ['registerStickUp', 'officeDoor', 'safe'],
  },
};
