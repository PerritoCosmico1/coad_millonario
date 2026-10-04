import { B } from '../config/balance';
import type { ModifierDef } from './types';

/**
 * Heist modifiers — the boss blind "curses". A few are rolled each ante and stay
 * "???" until scouting reveals them. Effects are wired up in game logic by id.
 */
const MODIFIERS_DATA = {
  shotgun: {
    name: 'Shotgun under the counter',
    text: `Day: the clerk joins the crowd panel with ${B.modifiers.shotgun.braveryMult}× bravery growth; if he acts: +${B.modifiers.shotgun.actAlarm} alarm.`,
    poi: 'counter',
    only: 'day',
  },
  timeLock: {
    name: 'Time-lock safe',
    text: `The safe can't be opened until ${B.modifiers.timeLock.unlockAt}s into the heist.`,
    poi: 'safe',
  },
  silentAlarm: {
    name: 'Silent alarm',
    text: `The first mistake or loud action in the heist adds +${B.modifiers.silentAlarm.extraAlarm} extra alarm.`,
    poi: 'alarmPanel',
  },
  offDutyCop: {
    name: 'Off-duty cop in line',
    text: `Day: one civilian is a cop with ${B.modifiers.offDutyCop.braveryMult}× bravery growth; if he acts: alarm jumps to 100.`,
    poi: 'customers',
    only: 'day',
  },
  extraCamera: {
    name: 'Extra camera',
    text: `Passive alarm +${B.modifiers.extraCamera.passiveAlarm}/s (day and night). Ziggy cancels it.`,
    poi: 'camera',
  },
  guardDog: {
    name: 'Guard dog out back',
    text: `Night: loud methods cost ${B.modifiers.guardDog.loudAlarmMult}× alarm.`,
    poi: 'backDoor',
    only: 'night',
  },
  dyePack: {
    name: 'Dye pack',
    text: `Register loot −${Math.round((1 - B.modifiers.dyePack.registerLootMult) * 100)}%. If revealed beforehand, you avoid it — no loss.`,
    poi: 'register',
  },
  reinforcedSafe: {
    name: 'Reinforced safe',
    text: `Safe needs ${B.modifiers.reinforcedSafe.numbers} numbers; crowbar takes ${B.modifiers.reinforcedSafe.crowbarTime}s.`,
    poi: 'safe',
  },
} satisfies Record<string, ModifierDef>;

export type ModifierId = keyof typeof MODIFIERS_DATA;
export const MODIFIERS: Record<ModifierId, ModifierDef> = MODIFIERS_DATA;
export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[];

/** Not part of the random pool — added when scouting goes wrong. */
export const ON_EDGE = {
  name: 'On edge',
  text: `Alarm gains +${Math.round((B.modifiers.onEdge.alarmMult - 1) * 100)}% during the heist.`,
};
