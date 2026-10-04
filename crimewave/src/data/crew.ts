import { HIRES, type HireId } from './hires';
import { PARTNERS, type PartnerId } from './partners';
import type { CrewDef } from './types';

/** Every crew member definition (partners + hires), keyed by id. */
export const CREW: Record<CrewId, CrewDef> = { ...PARTNERS, ...HIRES };

export type CrewId = PartnerId | HireId;

export const PARTNER_IDS = Object.keys(PARTNERS) as PartnerId[];
export const HIRE_IDS = Object.keys(HIRES) as HireId[];
export const CREW_IDS = [...PARTNER_IDS, ...HIRE_IDS] as CrewId[];

export function fullName(id: CrewId): string {
  const def = CREW[id];
  return `${def.name}, ${def.title}`;
}
