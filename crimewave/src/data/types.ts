/** Shapes of content entries. The ids themselves are derived from the data objects. */

import type { MinigameId } from '../minigames/types';
import type { GearId } from './gear';
import type { IntelId } from './intel';
import type { ObstacleId } from './heists';
import type { PoiId } from './pois';

export type RoleId = 'lookout' | 'muscle' | 'driver';
export type TimeOfDay = 'day' | 'night';

export interface RoleDef {
  name: string;
  text: string;
  preferredText: string;
}

export interface CrewDef {
  name: string;
  /** Epithet shown after the name, e.g. "the Charmer". */
  title: string;
  preferredRole: RoleId;
  perkText: string;
  /** Fraction of the pot they take at payout. */
  cut: number;
  startingLoyalty: number;
  /** Hires only: one-time fee on the hire board. */
  fee?: number;
}

export interface GearDef {
  name: string;
  /** Tiny label for HUD slots. */
  short: string;
  text: string;
  /** Shop price, or null if it never appears in the shop. */
  price: number | null;
  consumable?: boolean;
  /** Removed from inventory after every heist. */
  burnsAfterHeist?: boolean;
}

export interface PoiDef {
  name: string;
  /** Intel item you get for photographing this POI, if any. */
  intel?: IntelId;
}

export interface IntelDef {
  name: string;
  text: string;
}

export interface ModifierDef {
  name: string;
  text: string;
  /** Viewfinder POI that reveals this modifier. */
  poi: PoiId;
  /** Only does something at this time of day. */
  only?: TimeOfDay;
}

export interface LoudOption {
  label: string;
  text: string;
  /** Loud methods that are themselves a (hold-to-do) minigame. */
  minigame?: MinigameId;
  /** Instant loud methods: base alarm added. */
  alarm?: number;
}

export interface ObstacleDef {
  name: string;
  text: string;
  /** Quiet minigame, or null if the obstacle has no quiet minigame (stick-up). */
  quiet: MinigameId | null;
  loud: LoudOption | null;
  /** Loot table rolled when the obstacle is cleared. */
  loot?: 'register' | 'safe';
  /** Owning this intel item skips the obstacle entirely. */
  skippedBy?: IntelId;
  /** Quiet method needs this gear; without it only Loud is available. */
  quietNeeds?: GearId;
}

export interface HeistPlanDef {
  name: string;
  text: string;
  obstacles: ObstacleId[];
}

export type HeadlineTag = 'night' | 'day' | 'quiet' | 'loud' | 'clean' | 'chase' | 'droppedBag' | 'leftBehind';

export interface HeadlineTemplate {
  /** All of these tags must be present in the outcome. */
  tags: HeadlineTag[];
  /** Higher wins; ties go to the template with more tags, then random. */
  priority: number;
  /** Variables: {crew} (pair/trio/gang), {target}. */
  text: string;
}

export interface StreakTemplate {
  minAnte: number;
  /** Variables: {Ordinal} (Second, Third…), {n}, {target}. */
  text: string;
}
