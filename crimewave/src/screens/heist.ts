/**
 * The heist: obstacle sequence with a Quiet / Loud choice before each one.
 * The heist clock runs the whole time: passive alarm, night patrols, and a
 * countdown once the cops are called. When it hits zero you're forced into a
 * chase. Crowd control (day heists) arrives in M2.
 */

import { B } from '../config/balance';
import { emit } from '../core/events';
import { frameLoop } from '../core/loop';
import { GEAR } from '../data/gear';
import { HEIST_PLANS, OBSTACLES, type ObstacleId } from '../data/heists';
import { INTEL } from '../data/intel';
import { hasGear, hasIntel, nextObstacle } from '../game/actions';
import { leaveHeist } from '../game/flow';
import { tickHeist } from '../game/heistClock';
import {
  alarmGainMult,
  bagLoot,
  onObstacleReached,
  paramContext,
  passiveAlarmRate,
  patrolIncoming,
  raiseAlarm,
  safeLockedFor,
} from '../game/heistRules';
import { heist } from '../game/state';
import { holdParams, paramsFor } from '../minigames/params';
import type { RunningMinigame } from '../minigames/runner';
import type { MinigameId } from '../minigames/types';
import { playSfx } from '../core/sfx';
import { button, placeholderNote } from '../ui/components';
import { h, money, render } from '../ui/dom';
import { shake } from '../ui/fx';
import type { Screen } from '../ui/router';
import { hostMinigame } from './common';

/** Base alarm per mistake for each quiet minigame (shown as an estimate on the card). */
const MISTAKE_ALARM: Partial<Record<MinigameId, number>> = {
  lockpick: B.heist.lockpick.missAlarm,
  keypad: B.heist.keypad.wrongAlarm,
  safeDial: B.heist.safe.wrongAlarm,
};

const clockText = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const heistScreen: Screen = {
  mount(root) {
    const plan = HEIST_PLANS[heist().time];
    let running: RunningMinigame | null = null;
    let attempt = 0;
    let note = '';
    let leaving = false;

    const clock = h('div', { class: 'heist-clock' });
    const statusText = h('span');
    const statusExtra = h('span', { class: 'muted' });
    const statusBar = h('div', { class: 'heist-status' }, statusText, statusExtra);
    const sequence = h('div', { class: 'sequence' });
    const main = h('div', { class: 'stage-area' });
    const bag = h('div', { class: 'bag' });
    const footer = h('div', { class: 'heist-footer' });
    let timeLockSpan: HTMLElement | null = null;

    // --- drawing --------------------------------------------------------------

    const drawSequence = () => {
      const step = heist().step;
      render(
        sequence,
        [...plan.obstacles, 'exit' as const].map((o, i) =>
          h('div', { class: `seq-item ${i < step ? 'done' : i === step ? 'current' : ''}` }, o === 'exit' ? 'Exit' : OBSTACLES[o].name),
        ),
      );
    };

    let footerKey = '';
    const drawFooter = () => {
      const h_ = heist();
      const canBail = h_.step > 0 && h_.step < plan.obstacles.length;
      // Only rebuild when something visible changed, so buttons don't swap mid-click.
      const key = `${h_.loot}|${canBail}|${!!running}`;
      if (key === footerKey) return;
      footerKey = key;
      bag.textContent = `Bag: ${money(h_.loot)}`;
      render(
        footer,
        bag,
        running ? button('Back off (choose again)', backOff, { variant: 'ghost', title: 'Abandon this attempt and pick Quiet or Loud again' }) : null,
        canBail ? button('Grab what you have and go', bail, { variant: 'ghost' }) : null,
      );
    };

    let statusKey = '';
    const drawStatus = () => {
      const h_ = heist();
      let text = '';
      let cls = '';
      const incoming = patrolIncoming();
      if (h_.copsTimer !== null) {
        text = `COPS CALLED — they arrive in ${h_.copsTimer.toFixed(1)}s. Grab what you can.`;
        cls = 'danger';
      } else if (h_.patrol.active) {
        text = 'PATROL PASSING — mistakes and loud moves cost double alarm.';
        cls = 'warn';
      } else if (incoming !== null) {
        text = `Lookout: patrol coming in ${Math.ceil(incoming)}s.`;
        cls = 'info';
      } else {
        text = h_.time === 'night' ? 'Quiet out there.' : 'Day job. (Crowd control arrives in M2.)';
      }
      const passive = passiveAlarmRate() * alarmGainMult('passive');
      const extra = passive > 0 ? `Passive alarm +${passive.toFixed(2)}/s` : '';
      const key = `${cls}|${text}|${extra}`;
      clock.textContent = clockText(h_.elapsed);
      if (key === statusKey) return;
      statusKey = key;
      statusText.textContent = text;
      statusExtra.textContent = extra;
      statusBar.className = `heist-status ${cls}`;
    };

    const alarmEstimate = (base: number, cause: 'mistake' | 'loud') => Math.round(base * alarmGainMult(cause));

    const obstacleCard = (id: ObstacleId) => {
      const def = OBSTACLES[id];
      const ctx = paramContext();
      const lockedFor = id === 'safe' ? safeLockedFor() : 0;
      const hasKeys = !!def.skippedBy && hasIntel(def.skippedBy);
      const missingGear = def.quietNeeds && !hasGear(def.quietNeeds) ? def.quietNeeds : null;

      let loudText = '';
      let loudLabel = def.loud?.label ?? '';
      if (def.loud?.alarm !== undefined) loudText = `≈ +${alarmEstimate(def.loud.alarm, 'loud')} alarm`;
      else if (def.loud?.hold) {
        const hp = holdParams(def.loud.hold, ctx);
        loudLabel = hp.label;
        loudText = `hold ${hp.seconds}s, ≈ +${alarmEstimate(hp.alarmPerSec * hp.seconds, 'loud')} alarm`;
      }
      const mistake = def.quiet ? MISTAKE_ALARM[def.quiet] : undefined;

      timeLockSpan = lockedFor > 0 ? h('strong', null, '') : null;
      return h(
        'div',
        { class: 'card center-card obstacle' },
        h('div', { class: 'card-title' }, def.name),
        h('p', { class: 'card-text' }, def.text),
        timeLockSpan ? h('p', { class: 'timelock' }, 'Time-locked. Opens in ', timeLockSpan, '.') : null,
        h(
          'div',
          { class: 'choice-row' },
          hasKeys && def.skippedBy
            ? button(`Use the ${INTEL[def.skippedBy].name}`, () => clearObstacle(id, 'unlocked with the keys'), { variant: 'primary' })
            : null,
          def.quiet
            ? h(
                'div',
                { class: 'choice' },
                button(missingGear ? `Quiet: needs ${GEAR[missingGear].name}` : `Quiet: ${def.quietLabel ?? 'play it'}`, () => play(id, def.quiet!, paramsFor(def.quiet!, ctx)), {
                  variant: 'quiet',
                  disabled: !!missingGear || lockedFor > 0,
                }),
                h('span', { class: 'muted small' }, mistake !== undefined ? `Takes time. ≈ +${alarmEstimate(mistake, 'mistake')} alarm per mistake.` : 'Takes time.'),
              )
            : null,
          def.loud
            ? h(
                'div',
                { class: 'choice' },
                button(`Loud: ${loudLabel}`, () => goLoud(id), { variant: 'loud', disabled: lockedFor > 0 }),
                h('span', { class: 'muted small' }, `Fast. ${loudText}.`),
              )
            : null,
          !def.quiet && !def.loud ? button('Stick it up', () => clearObstacle(id, 'the clerk opened up'), { variant: 'primary' }) : null,
        ),
      );
    };

    let cardKey = '';
    const draw = () => {
      const h_ = heist();
      drawSequence();
      drawFooter();
      if (running) return;
      cardKey = currentCardKey();
      if (h_.step >= plan.obstacles.length) {
        timeLockSpan = null;
        render(
          main,
          note ? h('p', { class: 'note' }, note) : null,
          h(
            'div',
            { class: 'card center-card' },
            h('div', { class: 'card-title' }, 'Exit'),
            h('p', { class: 'card-text' }, 'Everything worth taking is in the bag. Time to go.'),
            button('Get out →', bail, { variant: 'primary' }),
          ),
        );
        return;
      }
      render(main, note ? h('p', { class: 'note' }, note) : null, obstacleCard(plan.obstacles[h_.step]));
    };

    /** Redraw the obstacle card when patrols change the estimates or the time-lock opens. */
    const currentCardKey = () => {
      const h_ = heist();
      return `${h_.step}|${h_.patrol.active}|${safeLockedFor() > 0}`;
    };

    // --- actions ----------------------------------------------------------------

    const clearObstacle = (id: ObstacleId, how: string) => {
      const def = OBSTACLES[id];
      note = `${def.name}: ${how}.`;
      if (def.loot) {
        const { amount, dyed } = bagLoot(def.loot);
        note += ` Bagged ${money(amount)}${dyed ? ' — the dye pack ruined half of it' : ''}.`;
      }
      nextObstacle();
      const next = plan.obstacles[heist().step];
      if (next) onObstacleReached(next);
      draw();
    };

    const play = (id: ObstacleId, minigame: MinigameId, params: unknown, loud = false) => {
      const area = h('div', { class: 'minigame-area' });
      timeLockSpan = null;
      render(main, area);
      running = hostMinigame(area, minigame, {
        params,
        rngKey: ['heist', id, minigame, attempt++],
        onAlarm: (amount, cause) => raiseAlarm(amount, cause),
      });
      const mine = running;
      drawFooter();
      mine.done.then((res) => {
        if (running !== mine) return;
        running = null;
        if (res.flags.includes('aborted')) {
          draw();
          return;
        }
        if (res.success) clearObstacle(id, loud ? 'forced open' : 'done quietly');
        else {
          note = `${OBSTACLES[id].name}: no luck. Try again or go loud.`;
          draw();
        }
      });
    };

    const goLoud = (id: ObstacleId) => {
      const loud = OBSTACLES[id].loud;
      if (!loud) return;
      if (loud.hold) {
        play(id, 'hold', holdParams(loud.hold, paramContext()), true);
        return;
      }
      raiseAlarm(loud.alarm ?? 0, 'loud');
      playSfx('alarmSpike');
      shake();
      clearObstacle(id, loud.label.toLowerCase());
    };

    const backOff = () => {
      running?.abort();
      note = 'You back off. Choose again.';
    };

    const bail = () => {
      if (leaving) return;
      leaving = true;
      running?.abort();
      leaveHeist();
    };

    // --- mount ------------------------------------------------------------------

    render(
      root,
      h(
        'div',
        { class: 'screen-pad heist' },
        h('div', { class: 'heist-head' }, h('h1', null, `The heist — ${plan.name}`), clock),
        statusBar,
        sequence,
        main,
        footer,
        heist().time === 'day' ? placeholderNote('M2', 'Day heists get the crowd control panel and the real stick-up next milestone.') : null,
      ),
    );
    const first = plan.obstacles[heist().step];
    if (first) onObstacleReached(first);
    draw();
    drawStatus();

    const stop = frameLoop((dt) => {
      if (leaving) return;
      const { forcedOut } = tickHeist(dt);
      drawStatus();
      drawFooter();
      if (timeLockSpan) timeLockSpan.textContent = `${Math.ceil(safeLockedFor())}s`;
      if (!running && currentCardKey() !== cardKey) draw();
      if (forcedOut) {
        emit({ type: 'toast', text: 'THE COPS ARE HERE', tone: 'bad' });
        bail();
      }
    });

    return () => {
      stop();
      running?.abort();
    };
  },
};
