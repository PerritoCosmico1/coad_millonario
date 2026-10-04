/**
 * Heist rules: what alarm really costs, passive alarm, patrols, roles and the
 * modifiers that change a heist (design doc sections 5, 6 and 8).
 *
 * Minigames report a base alarm amount; raiseAlarm() runs it through every
 * multiplier here. Unrevealed modifiers announce themselves when they kick in.
 */

import { B } from '../config/balance';
import { CREW, type CrewId } from '../data/crew';
import type { ModifierId } from '../data/modifiers';
import type { RoleId } from '../data/types';
import type { ParamContext } from '../minigames/params';
import type { AlarmCause } from '../minigames/types';
import { addAlarm, announceModifier, grabLoot, hasGear, markLoud } from './actions';
import { runRng } from './random';
import { alarmScale } from './scaling';
import { heist, run, type CrewMember } from './state';

export type AlarmSource = AlarmCause | 'passive';

// --- crew and roles ---------------------------------------------------------------

export function hasCrew(id: CrewId): boolean {
  return run().crew.some((m) => m.id === id);
}

/** Who holds a role in the current heist, if anyone. */
export function roleHolder(role: RoleId): CrewMember | undefined {
  const h = run().heist;
  if (!h) return undefined;
  return run().crew.find((m) => h.roles[m.uid] === role);
}

export function inPreferredRole(member: CrewMember, role: RoleId): boolean {
  return CREW[member.id].preferredRole === role;
}

/** Driver needs the getaway car. */
export function roleAvailable(role: RoleId): boolean {
  return role !== 'driver' || hasGear('getawayCar');
}

/** Everyone in their preferred role where it's free and available. */
export function defaultRoles(): Record<number, RoleId> {
  const roles: Record<number, RoleId> = {};
  const taken = new Set<RoleId>();
  for (const m of run().crew) {
    const pref = CREW[m.id].preferredRole;
    if (taken.has(pref) || !roleAvailable(pref)) continue;
    roles[m.uid] = pref;
    taken.add(pref);
  }
  return roles;
}

// --- modifiers -------------------------------------------------------------------

/** Rolled this ante and not cancelled by someone in the crew. */
export function modifierActive(id: ModifierId): boolean {
  if (!run().ante.modifiers.includes(id)) return false;
  if (id === 'extraCamera' && hasCrew('ziggy')) return false;
  return true;
}

/** What minigame param builders need to know about the run. */
export function paramContext(): ParamContext {
  const r = run();
  return {
    ante: r.ante.n,
    gear: r.gear,
    crew: r.crew.map((m) => m.id),
    intel: r.ante.intel,
    modifiers: r.ante.modifiers.filter(modifierActive),
  };
}

/** Called once when the heist begins. */
export function onHeistStart(): void {
  if (modifierActive('extraCamera')) announceModifier('extraCamera');
}

/** Called when an obstacle comes up. */
export function onObstacleReached(obstacle: string): void {
  if (obstacle !== 'safe') return;
  if (modifierActive('reinforcedSafe')) announceModifier('reinforcedSafe');
  if (safeLockedFor() > 0) announceModifier('timeLock');
}

/** Seconds until the time-lock safe opens (0 if it's open or there's no time-lock). */
export function safeLockedFor(): number {
  if (!modifierActive('timeLock')) return 0;
  return Math.max(0, B.modifiers.timeLock.unlockAt - heist().elapsed);
}

/** Bag the loot for a cleared obstacle. The dye pack ruins half the register unless you knew about it. */
export function bagLoot(table: 'register' | 'safe'): { amount: number; dyed: boolean } {
  let mult = 1;
  let dyed = false;
  if (table === 'register' && modifierActive('dyePack') && !run().ante.revealed.includes('dyePack')) {
    announceModifier('dyePack');
    mult = B.modifiers.dyePack.registerLootMult;
    dyed = true;
  }
  return { amount: grabLoot(table, mult), dyed };
}

// --- alarm -----------------------------------------------------------------------

/** Everything that scales an alarm gain right now. */
export function alarmGainMult(source: AlarmSource): number {
  const r = run();
  const h = heist();
  let m = alarmScale(r.ante.n);
  if (r.ante.onEdge) m *= B.modifiers.onEdge.alarmMult;

  const lookout = roleHolder('lookout');
  if (lookout) m *= inPreferredRole(lookout, 'lookout') ? B.roles.lookout.preferredAlarmMult : B.roles.lookout.alarmMult;

  if (source === 'loud') {
    if (hasCrew('moose')) m *= B.crew.moose.loudAlarmMult;
    if (h.time === 'night' && modifierActive('guardDog')) m *= B.modifiers.guardDog.loudAlarmMult;
  }
  if (source !== 'passive' && h.patrol.active) m *= B.heist.patrol.alarmMult;
  return m;
}

/** Applies a base alarm amount through every multiplier and modifier. Returns what was added. */
export function raiseAlarm(base: number, source: AlarmSource): number {
  const h = heist();
  if (source === 'loud') {
    markLoud();
    if (h.time === 'night' && modifierActive('guardDog')) announceModifier('guardDog');
  }
  let amount = base * alarmGainMult(source);
  if (source !== 'passive' && !h.silentAlarmTripped && modifierActive('silentAlarm')) {
    h.silentAlarmTripped = true;
    amount += B.modifiers.silentAlarm.extraAlarm;
    announceModifier('silentAlarm');
  }
  addAlarm(amount, source !== 'passive');
  return amount;
}

/** Passive alarm per second (before multipliers). */
export function passiveAlarmRate(): number {
  const h = heist();
  let rate = B.heist.passiveAlarm[h.time];
  if (modifierActive('extraCamera')) rate += B.modifiers.extraCamera.passiveAlarm;
  return rate;
}

// --- patrols ---------------------------------------------------------------------

/** Seconds from the start of patrol n to the start of patrol n+1 (or from the heist start for n = 0). */
export function patrolGap(n: number): number {
  const p = B.heist.patrol;
  const gap = p.interval + runRng('patrol', n).float(-p.jitter, p.jitter);
  return hasCrew('nina') ? gap / B.crew.nina.patrolFrequencyMult : gap;
}

/** How early the lookout warns about a patrol (0 = no lookout, no warning). */
export function patrolWarningTime(): number {
  const lookout = roleHolder('lookout');
  if (!lookout) return 0;
  return inPreferredRole(lookout, 'lookout') ? B.roles.lookout.preferredPatrolWarning : B.roles.lookout.patrolWarning;
}

/** Seconds until the next patrol if the lookout is warning about it right now, else null. */
export function patrolIncoming(): number | null {
  const h = heist();
  if (h.time !== 'night' || h.patrol.active) return null;
  const left = h.patrol.nextAt - h.elapsed;
  const warning = patrolWarningTime();
  return warning > 0 && left <= warning ? Math.max(0, left) : null;
}
