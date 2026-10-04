/**
 * Run flow: what comes after what (design doc sections 3 and 11).
 * Screens call these instead of picking the next screen themselves.
 *
 * Ante loop:
 *   anteIntro → blindSelect → [scouting | skip] → safehouse
 *             → blindSelect → [prep | skip]     → safehouse
 *             → blindSelect → heistSetup → heist → escape → payout → headline
 *             → next ante (anteIntro) or run summary
 */

import { B } from '../config/balance';
import { CURRENT_TARGET, TARGETS } from '../data/targets';
import type { PartnerId } from '../data/partners';
import type { TimeOfDay } from '../data/types';
import { goTo } from '../ui/router';
import {
  clearRun,
  completeAnte,
  earnCash,
  endRun,
  finishHeist,
  setBlindStatus,
  setHeadline,
  setPartner,
  startAnte,
  startHeist,
  startRun,
} from './actions';
import { pickHeadline } from './headlines';
import { runRng } from './random';
import { currentBlind, run, type EscapeOutcome } from './state';

export function newRun(seed: string): void {
  startRun(seed);
  goTo('partnerSelect');
}

export function choosePartner(id: PartnerId): void {
  setPartner(id);
  beginAnte(1);
}

export function beginAnte(n: number): void {
  startAnte(n);
  goTo('anteIntro');
}

export function toBlindSelect(): void {
  goTo('blindSelect');
}

/** Play the current blind. */
export function playBlind(): void {
  const blind = currentBlind(run().ante);
  goTo(blind === 'scouting' ? 'scouting' : blind === 'prep' ? 'prep' : 'heistSetup');
}

/** Skip the current blind (scouting or prep) for its cash reward. */
export function skipBlind(): void {
  const blind = currentBlind(run().ante);
  if (blind === 'heist') return;
  earnCash(blind === 'scouting' ? B.blinds.scoutingSkipReward : B.blinds.prepSkipReward);
  setBlindStatus(blind, 'skipped');
  goTo('safehouse');
}

/** Scouting or prep finished (whatever the outcome). */
export function completeBlind(): void {
  setBlindStatus(currentBlind(run().ante), 'done');
  goTo('safehouse');
}

export function leaveSafehouse(): void {
  goTo('blindSelect');
}

export function beginHeist(time: TimeOfDay): void {
  startHeist(time);
  goTo('heist');
}

export function leaveHeist(): void {
  goTo('escape');
}

export function resolveEscape(outcome: EscapeOutcome, leftBehindUid?: number): void {
  finishHeist(outcome, leftBehindUid);
  goTo('payout');
}

/** After the payout is collected: write the headline and show it. */
export function finishPayout(): void {
  const r = run();
  setBlindStatus('heist', 'done');
  completeAnte();
  const tags = r.heist?.result?.tags ?? [];
  const { headline, subhead } = pickHeadline(
    { tags, ante: r.ante.n, crewSize: r.crew.length + 1, target: TARGETS[CURRENT_TARGET].short },
    runRng('headline'),
  );
  setHeadline(headline, subhead);
  goTo('headline');
}

export function nextAnte(): void {
  beginAnte(run().ante.n + 1);
}

export function quitRun(): void {
  endRun('quit');
  goTo('runSummary');
}

export function toTitle(): void {
  clearRun();
  goTo('title');
}
