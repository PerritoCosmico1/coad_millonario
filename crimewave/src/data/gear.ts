import { B } from '../config/balance';
import type { GearDef } from './types';

/** Gear. Permanent unless marked consumable. The shop offers anything with a price. */
const GEAR_DATA = {
  lockpickSet: {
    name: 'Lockpick set',
    short: 'Pick',
    text: 'Starting gear. Required for quiet lockpicking.',
    price: null,
  },
  stethoscope: {
    name: 'Stethoscope',
    short: 'Steth',
    text: `Safe dial tolerance ±${B.gear.stethoscope.safeTolerance} and a bigger pulse.`,
    price: B.gear.stethoscope.price,
  },
  drill: {
    name: 'Drill',
    short: 'Drill',
    text: 'Loud safe method takes half the time.',
    price: B.gear.drill.price,
  },
  skiMasks: {
    name: 'Ski masks',
    short: 'Masks',
    text: `Heat from heists −${Math.round((1 - B.gear.skiMasks.heistHeatMult) * 100)}%.`,
    price: B.gear.skiMasks.price,
  },
  policeScanner: {
    name: 'Police scanner',
    short: 'Scan',
    text: 'Chase hints are always exact.',
    price: B.gear.policeScanner.price,
  },
  smokeBomb: {
    name: 'Smoke bomb',
    short: 'Smoke',
    text: `Consumable. During crowd control: click to freeze all bravery for ${B.gear.smokeBomb.freezeTime}s.`,
    price: B.gear.smokeBomb.price,
    consumable: true,
  },
  getawayCar: {
    name: 'Getaway car',
    short: 'Car',
    text: 'Only from the prep job. Needed for a Driver and the shorter chase. Burned after each heist.',
    price: null,
    burnsAfterHeist: true,
  },
} satisfies Record<string, GearDef>;

export type GearId = keyof typeof GEAR_DATA;
export const GEAR: Record<GearId, GearDef> = GEAR_DATA;
export const GEAR_IDS = Object.keys(GEAR) as GearId[];

/** Gear every run starts with. */
export const STARTING_GEAR: GearId[] = ['lockpickSet'];
