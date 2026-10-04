/**
 * Every change to game state goes through a function in here. Each one
 * mutates `game` and calls notify() so the UI re-renders. Pop-up feedback
 * (floating numbers) is emitted on the event bus.
 */

import { B } from '../config/balance';
import { emit } from '../core/events';
import { rngFrom } from '../core/rng';
import { playSfx } from '../core/sfx';
import { CREW, type CrewId } from '../data/crew';
import { GEAR, STARTING_GEAR, type GearId } from '../data/gear';
import type { IntelId } from '../data/intel';
import { MODIFIER_IDS, type ModifierId } from '../data/modifiers';
import type { PartnerId } from '../data/partners';
import type { HeadlineTag, RoleId, TimeOfDay } from '../data/types';
import { heatTier } from './heat';
import { runRng } from './random';
import { lootRange, modifierCount } from './scaling';
import {
  game,
  heist,
  notify,
  run,
  type BlindId,
  type BlindStatus,
  type CrewMember,
  type EscapeOutcome,
  type RunState,
} from './state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// --- run ------------------------------------------------------------------

export function startRun(seed: string): void {
  const fresh: RunState = {
    seed,
    partner: null,
    cash: B.run.startingCash,
    heat: 0,
    crew: [],
    nextUid: 1,
    gear: [...STARTING_GEAR],
    ante: { n: 1, blinds: { scouting: 'pending', prep: 'pending', heist: 'pending' }, modifiers: [], revealed: [], onEdge: false, intel: [] },
    heist: null,
    headline: null,
    stats: { antesCleared: 0, cashEarned: 0, crewLost: [] },
    ended: null,
  };
  game.run = fresh;
  notify();
}

export function endRun(reason: 'busted' | 'quit'): void {
  run().ended = reason;
  notify();
}

export function clearRun(): void {
  game.run = null;
  notify();
}

export function setTitleSeed(seed: string): void {
  game.titleSeed = seed;
  notify();
}

// --- cash -----------------------------------------------------------------

export function addCash(amount: number): void {
  if (amount === 0) return;
  run().cash += amount;
  emit({ type: 'stat', stat: 'cash', delta: amount });
  if (amount > 0) playSfx('cash');
  notify();
}

/** Cash that counts toward "total cash earned" on the run summary. */
export function earnCash(amount: number): void {
  run().stats.cashEarned += amount;
  addCash(amount);
}

/** Pays if you can afford it. Returns whether it went through. */
export function spendCash(amount: number): boolean {
  if (run().cash < amount) return false;
  addCash(-amount);
  return true;
}

// --- heat -----------------------------------------------------------------

export function addHeat(amount: number): void {
  const r = run();
  const next = clamp(r.heat + amount, 0, B.heat.max);
  const delta = next - r.heat;
  if (delta === 0) return;
  r.heat = next;
  emit({ type: 'stat', stat: 'heat', delta });
  if (delta > 0) playSfx('heat');
  notify();
}

export function setHeat(value: number): void {
  addHeat(value - run().heat);
}

// --- crew -----------------------------------------------------------------

export function crewMember(uid: number): CrewMember | undefined {
  return run().crew.find((m) => m.uid === uid);
}

/** Room for one more? (Max crew counts you.) */
export function crewHasRoom(): boolean {
  return run().crew.length + 1 < B.run.maxCrew;
}

export function addCrew(id: CrewId): CrewMember | null {
  const r = run();
  if (!crewHasRoom()) return null;
  const member: CrewMember = { uid: r.nextUid++, id, loyalty: CREW[id].startingLoyalty };
  r.crew.push(member);
  notify();
  return member;
}

export function setPartner(id: PartnerId): void {
  run().partner = id;
  addCrew(id);
}

/** Removes a member. With a reason ("Arrested", "Walked"…), they're logged as lost. */
export function removeCrew(uid: number, reason?: string): void {
  const r = run();
  const member = crewMember(uid);
  if (!member) return;
  r.crew = r.crew.filter((m) => m.uid !== uid);
  if (r.heist) delete r.heist.roles[uid];
  if (reason) r.stats.crewLost.push({ name: CREW[member.id].name, reason });
  notify();
}

export function changeLoyalty(uid: number, delta: number): void {
  const member = crewMember(uid);
  if (!member) return;
  member.loyalty = clamp(member.loyalty + delta, 0, B.loyalty.max);
  notify();
}

// --- gear -----------------------------------------------------------------

export function hasGear(id: GearId): boolean {
  return run().gear.includes(id);
}

export function addGear(id: GearId): boolean {
  const r = run();
  if (r.gear.length >= B.run.gearSlots) return false;
  r.gear.push(id);
  notify();
  return true;
}

/** Removes one copy. */
export function removeGear(id: GearId): boolean {
  const r = run();
  const i = r.gear.indexOf(id);
  if (i < 0) return false;
  r.gear.splice(i, 1);
  notify();
  return true;
}

/** Drops everything that burns after a heist (the getaway car). */
export function burnGear(): void {
  const r = run();
  r.gear = r.gear.filter((g) => !GEAR[g].burnsAfterHeist);
  notify();
}

// --- ante, blinds, modifiers, intel ------------------------------------------

/** Starts ante n: fresh blinds, intel and heist, and rolls this ante's modifiers. */
export function startAnte(n: number): void {
  const r = run();
  const count = modifierCount(n, r.heat);
  const modifiers = rngFrom(r.seed, 'ante', n, 'modifiers').sample(MODIFIER_IDS, count);
  r.ante = { n, blinds: { scouting: 'pending', prep: 'pending', heist: 'pending' }, modifiers, revealed: [], onEdge: false, intel: [] };
  r.heist = null;
  r.headline = null;
  notify();
}

export function setBlindStatus(blind: BlindId, status: BlindStatus): void {
  run().ante.blinds[blind] = status;
  notify();
}

export function revealModifier(id: ModifierId): void {
  const a = run().ante;
  if (a.modifiers.includes(id) && !a.revealed.includes(id)) a.revealed.push(id);
  notify();
}

export function revealAllModifiers(): void {
  const a = run().ante;
  a.revealed = [...a.modifiers];
  notify();
}

/** Debug: force a modifier in or out of this ante's roll. */
export function setModifierRolled(id: ModifierId, rolled: boolean): void {
  const a = run().ante;
  if (rolled && !a.modifiers.includes(id)) a.modifiers.push(id);
  if (!rolled) {
    a.modifiers = a.modifiers.filter((m) => m !== id);
    a.revealed = a.revealed.filter((m) => m !== id);
  }
  notify();
}

export function setOnEdge(on: boolean): void {
  run().ante.onEdge = on;
  notify();
}

export function hasIntel(id: IntelId): boolean {
  return run().ante.intel.includes(id);
}

export function addIntel(id: IntelId): void {
  const a = run().ante;
  if (!a.intel.includes(id)) a.intel.push(id);
  notify();
}

export function removeIntel(id: IntelId): void {
  const a = run().ante;
  a.intel = a.intel.filter((i) => i !== id);
  notify();
}

// --- heist ----------------------------------------------------------------

export function startHeist(time: TimeOfDay): void {
  const r = run();
  r.heist = {
    time,
    roles: r.heist?.roles ?? {},
    alarm: heatTier(r.heat).startingAlarm,
    loot: 0,
    flatHeat: 0,
    step: 0,
    copsCalled: false,
    usedLoud: false,
    result: null,
  };
  notify();
}

export function assignRole(uid: number, role: RoleId | null): void {
  const r = run();
  if (!r.heist) return;
  if (role) r.heist.roles[uid] = role;
  else delete r.heist.roles[uid];
  notify();
}

/** Raises alarm (already multiplied by the caller). Hitting 100 calls the cops. */
export function addAlarm(amount: number): void {
  const h = heist();
  const next = clamp(h.alarm + amount, 0, 100);
  const delta = next - h.alarm;
  if (delta === 0) return;
  h.alarm = next;
  emit({ type: 'stat', stat: 'alarm', delta });
  if (delta >= 10) playSfx('alarmSpike');
  if (h.alarm >= 100 && !h.copsCalled) {
    h.copsCalled = true;
    playSfx('copsCalled');
    emit({ type: 'toast', text: 'COPS CALLED', tone: 'bad' });
  }
  notify();
}

export function setAlarm(value: number): void {
  const h = heist();
  addAlarm(value - h.alarm);
  if (h.alarm < 100) h.copsCalled = false;
  notify();
}

export function markLoud(): void {
  heist().usedLoud = true;
  notify();
}

/** Rolls loot from a loot table (scaled by ante) and puts it in the bag. Returns the amount. */
export function grabLoot(table: 'register' | 'safe'): number {
  const range = lootRange(table, run().ante.n);
  const amount = runRng('loot', table).int(range.min, range.max);
  const h = heist();
  h.loot += amount;
  emit({ type: 'stat', stat: 'loot', delta: amount });
  notify();
  return amount;
}

export function addHeistHeat(amount: number): void {
  heist().flatHeat += amount;
  notify();
}

export function nextObstacle(): void {
  heist().step += 1;
  notify();
}

/**
 * Ends the heist after the escape: settles the bag, arrests whoever was left
 * behind, burns the car, and applies heist heat (design doc section 7).
 */
export function finishHeist(escape: EscapeOutcome, leftBehindUid?: number): void {
  const r = run();
  const h = heist();

  let loot = h.loot;
  if (escape.kind === 'droppedBag') loot = Math.round(loot * (1 - B.chase.dropBagLoss));

  if (escape.kind === 'leftBehind' && leftBehindUid !== undefined) {
    removeCrew(leftBehindUid, 'Arrested');
    for (const m of r.crew) changeLoyalty(m.uid, B.loyalty.leftBehindPenalty);
  }

  let heat = h.alarm * B.heat.heistAlarmToHeat + h.flatHeat;
  if (escape.kind === 'chaseEscaped') heat += B.chase.escapeHeat;
  if (hasGear('skiMasks')) heat *= B.gear.skiMasks.heistHeatMult;
  const heatGained = Math.round(heat);

  const tags: HeadlineTag[] = [h.time, h.usedLoud || h.copsCalled ? 'loud' : 'quiet'];
  if (escape.kind === 'clean') tags.push('clean');
  else tags.push('chase');
  if (escape.kind === 'droppedBag') tags.push('droppedBag');
  if (escape.kind === 'leftBehind') tags.push('leftBehind');

  h.result = { escape, loot, heatGained, tags };
  burnGear();
  addHeat(heatGained);
  notify();
}

/** Payout bookkeeping once the player collects. */
export function completeAnte(): void {
  run().stats.antesCleared += 1;
  notify();
}

export function setHeadline(headline: string, subhead: string | null): void {
  run().headline = { headline, subhead };
  notify();
}
