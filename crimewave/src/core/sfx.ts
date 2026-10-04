/**
 * Audio hook. No sounds yet — call playSfx('name') at key moments so audio
 * can be dropped in later without touching game code.
 */

export type SfxName =
  | 'click'
  | 'success'
  | 'fail'
  | 'mistake'
  | 'cash'
  | 'heat'
  | 'alarmSpike'
  | 'copsCalled'
  | 'dialClick'
  | 'snap'
  | 'spark'
  | 'pinSet'
  | 'patrol'
  | 'headline';

let logSfx = false;

/** Debug: print each sfx call to the console. */
export function setSfxLogging(on: boolean): void {
  logSfx = on;
}

export function isSfxLogging(): boolean {
  return logSfx;
}

export function playSfx(name: SfxName): void {
  if (logSfx) console.debug(`[sfx] ${name}`);
}
