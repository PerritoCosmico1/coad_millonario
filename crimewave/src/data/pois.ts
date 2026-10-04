import type { PoiDef } from './types';

/** Points of interest in the store, photographed with the viewfinder while scouting. */
const POIS_DATA = {
  counter: { name: 'Counter' },
  register: { name: 'Register' },
  keypad: { name: 'Keypad', intel: 'keypadCode' },
  backDoor: { name: 'Back door' },
  safe: { name: 'Safe (office window)' },
  camera: { name: 'Ceiling camera' },
  alarmPanel: { name: 'Alarm panel' },
  customers: { name: 'Customers in line' },
} satisfies Record<string, PoiDef>;

export type PoiId = keyof typeof POIS_DATA;
export const POIS: Record<PoiId, PoiDef> = POIS_DATA;
export const POI_IDS = Object.keys(POIS) as PoiId[];
