import { B } from '../config/balance';
import type { RoleDef, RoleId } from './types';

const pct = (mult: number) => Math.round(Math.abs(1 - mult) * 100);

export const ROLES: Record<RoleId, RoleDef> = {
  lookout: {
    name: 'Lookout',
    text: `Alarm gains −${pct(B.roles.lookout.alarmMult)}%. Warns ${B.roles.lookout.patrolWarning}s before night patrols.`,
    preferredText: `−${pct(B.roles.lookout.preferredAlarmMult)}% alarm, ${B.roles.lookout.preferredPatrolWarning}s warning`,
  },
  muscle: {
    name: 'Muscle',
    text: `Crowd bravery grows ${pct(B.roles.muscle.braveryMult)}% slower (day heists).`,
    preferredText: `${pct(B.roles.muscle.preferredBraveryMult)}% slower`,
  },
  driver: {
    name: 'Driver',
    text: `Requires the getaway car. Chase decision time +${pct(B.roles.driver.chaseTimeMult)}%.`,
    preferredText: `+${pct(B.roles.driver.preferredChaseTimeMult)}%`,
  },
};

export const ROLE_IDS = Object.keys(ROLES) as RoleId[];
