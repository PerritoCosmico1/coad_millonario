/**
 * CRIMEWAVE balance — every tuning number lives here.
 *
 * Units: times in seconds, alarm / heat / suspicion / loyalty are 0–100 meters,
 * money in $, percentages written as fractions (0.4 = 40%).
 * "Mult" values multiply a base rate (0.7 = 30% slower / less).
 *
 * Data files (src/data) read their numbers from here, so tweak numbers here
 * and the descriptions shown in-game update with them.
 */

export interface HeatTier {
  id: 'cold' | 'warm' | 'hot' | 'manhunt';
  label: string;
  /** Lowest heat value in this tier. */
  min: number;
  /** Extra heist modifiers rolled at the start of an ante. */
  extraModifiers: number;
  hireFeeMult: number;
  /** Fraction of loot value the fence pays. */
  fenceRate: number;
  /** Loyalty checks fire for crew strictly below this loyalty. */
  loyaltyCheckBelow: number;
  /** Alarm every heist starts at. */
  startingAlarm: number;
}

export const BALANCE = {
  run: {
    startingCash: 200,
    /** Max people in the crew, including you. */
    maxCrew: 4,
    gearSlots: 6,
  },

  /** Skip rewards on the blind select screen. */
  blinds: {
    scoutingSkipReward: 50,
    prepSkipReward: 75,
  },

  /** Repeating the liquor store: ante n scales by factor^(n−1). */
  ante: {
    lootGrowth: 1.5,
    alarmGrowth: 1.2,
    /** Sweet spots, tolerances, timers, flash times. */
    windowShrink: 0.9,
    baseModifiers: 2,
    /** +1 modifier every N antes: base + floor((n−1)/N). */
    extraModifierEvery: 2,
  },

  heat: {
    max: 100,
    /** After a heist: heat += round(alarm at the end × this). */
    heistAlarmToHeat: 0.3,
    layLowCost: 100,
    layLowAmount: 15,
    /** Each tier is fully specified — tiers don't stack. Edit any column freely. */
    tiers: [
      { id: 'cold', label: 'Cold', min: 0, extraModifiers: 0, hireFeeMult: 1.0, fenceRate: 1.0, loyaltyCheckBelow: 30, startingAlarm: 0 },
      { id: 'warm', label: 'Warm', min: 30, extraModifiers: 1, hireFeeMult: 1.2, fenceRate: 0.9, loyaltyCheckBelow: 30, startingAlarm: 0 },
      { id: 'hot', label: 'Hot', min: 60, extraModifiers: 2, hireFeeMult: 1.2, fenceRate: 0.8, loyaltyCheckBelow: 40, startingAlarm: 0 },
      { id: 'manhunt', label: 'Manhunt', min: 85, extraModifiers: 2, hireFeeMult: 1.2, fenceRate: 0.6, loyaltyCheckBelow: 40, startingAlarm: 25 },
    ] as HeatTier[],
  },

  loyalty: {
    max: 100,
    paidFull: 10,
    shorted: -25,
    /** Shorting someone pays this fraction of their cut. */
    shortFraction: 0.5,
    /** Chance a disloyal member triggers an event at the loyalty check. */
    eventChance: 0.5,
    /** Of those events, the chance it's a snitch (otherwise they walk). */
    snitchChance: 0.5,
    snitchHeat: 15,
    /** Everyone left loses this much when you leave someone behind. */
    leftBehindPenalty: -15,
  },

  /** Crew: cut of the pot, starting loyalty, hire fee and perk numbers. */
  crew: {
    vera: { cut: 0.4, loyalty: 70, viewfinderSuspicionMult: 0.7, pickpocketAttentionMult: 0.7 },
    moose: { cut: 0.4, loyalty: 70, loudAlarmMult: 0.75 },
    ziggy: { cut: 0.4, loyalty: 70, keypadExtraFlash: 1, hotwireExtraTime: 4 },
    lefty: { fee: 120, cut: 0.15, loyalty: 50, forgivenWrongTurns: 1 },
    bigSal: { fee: 100, cut: 0.15, loyalty: 50, intimidateHeatMult: 0 },
    nina: { fee: 100, cut: 0.15, loyalty: 50, patrolFrequencyMult: 0.7 },
  },

  /** Role effects. "preferred" values apply when the member's preferred role matches. */
  roles: {
    lookout: { alarmMult: 0.8, preferredAlarmMult: 0.7, patrolWarning: 3, preferredPatrolWarning: 5 },
    muscle: { braveryMult: 0.6, preferredBraveryMult: 0.4 },
    driver: { chaseTimeMult: 1.4, preferredChaseTimeMult: 1.6 },
  },

  safehouse: {
    shopSize: 3,
    rerollCost: 20,
    hireBoardSize: 2,
  },

  gear: {
    stethoscope: { price: 80, safeTolerance: 5 },
    drill: { price: 150, crowbarTimeMult: 0.5 },
    skiMasks: { price: 60, heistHeatMult: 0.75 },
    policeScanner: { price: 100 },
    smokeBomb: { price: 40, freezeTime: 6 },
  },

  /** Scouting job (small blind). Suspicion is a local 0–100 meter. */
  scouting: {
    viewfinder: {
      timeLimit: 30,
      /** Seconds the viewfinder must frame a lit POI to snap it. */
      snapHold: 1.0,
      suspicionRise: 12,
      suspicionFall: 8,
      /** How long a POI stays lit (random between min and max). */
      poiLitMin: 2,
      poiLitMax: 4,
      askAroundHeat: 5,
    },
    pickpocket: {
      fillTime: 2.0,
      /** Caught if attention is above this while your hand is in the pocket. */
      catchThreshold: 60,
      caughtHeat: 5,
      grabHeat: 10,
    },
  },

  /** Prep job (big blind). */
  prep: {
    hotwire: {
      wires: 3,
      timer: 15,
      wrongPenalty: 2,
      /** Passerby suspicion per second. */
      passerbyRise: 5,
      failHeat: 5,
      smashHeat: 10,
    },
  },

  /** The heist (boss blind). Alarm amounts are base values before multipliers. */
  heist: {
    /** Passive alarm per second. */
    passiveAlarm: { night: 0.5, day: 0 },
    /** Seconds between alarm hitting 100 and the forced chase. */
    copsCountdown: 10,
    /** Night only. Seconds between patrols = interval ± jitter. During one, mistakes and loud actions cost alarmMult×. */
    patrol: { interval: 25, jitter: 5, duration: 4, alarmMult: 2 },
    lockpick: {
      pins: 3,
      /** Width of the green sweet spot, as a fraction of the bar. Shrinks with ante. */
      sweetSpot: 0.18,
      /** Marker speed in bar-widths per second (it bounces back and forth). */
      markerSpeed: 0.75,
      /** Each pin after the first moves this much faster. */
      speedUpPerPin: 1.2,
      missAlarm: 5,
      kickAlarm: 25,
    },
    keypad: { digits: 4, flashTime: 1.5, wrongAlarm: 8, pryHold: 3, pryAlarm: 20 },
    safe: {
      numbers: 3,
      /** The dial clicks within ± this many numbers of the target. Shrinks with ante. */
      tolerance: 3,
      wrongAlarm: 5,
      /** Each new target is at least this many numbers away from where the dial sits. */
      minTravel: 25,
      crowbarTime: 8,
      crowbarAlarmPerSec: 4,
    },
    loot: {
      register: { min: 150, max: 300 },
      safe: { min: 400, max: 800 },
    },
  },

  /** Crowd control overlay (day heists). */
  crowd: {
    civilians: 5,
    /** Seconds for a civilian's bravery to go 0 → 100 (random per civilian). */
    fillTimeMin: 8,
    fillTimeMax: 15,
    callCopsChance: 0.6,
    callCopsAlarm: 25,
    runAlarm: 15,
    runHeat: 5,
    intimidateHeat: 1,
  },

  chase: {
    intersections: 5,
    onFootIntersections: 7,
    decisionTime: 2.0,
    strikesToCatch: 2,
    escapeHeat: 10,
    /** Fraction of loot lost when you drop the bag. */
    dropBagLoss: 0.6,
  },

  /** Heist modifier numbers (see src/data/modifiers.ts). */
  modifiers: {
    shotgun: { braveryMult: 2, actAlarm: 40 },
    timeLock: { unlockAt: 45 },
    silentAlarm: { extraAlarm: 20 },
    offDutyCop: { braveryMult: 2 },
    extraCamera: { passiveAlarm: 0.5 },
    guardDog: { loudAlarmMult: 1.5 },
    dyePack: { registerLootMult: 0.5 },
    reinforcedSafe: { numbers: 4, crowbarTime: 12 },
    onEdge: { alarmMult: 1.15 },
  },
};

export const B = BALANCE;
