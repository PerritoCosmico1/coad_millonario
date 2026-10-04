import type { ScreenId } from '../game/state';
import type { Screen } from '../ui/router';
import { anteIntroScreen } from './anteIntro';
import { blindSelectScreen } from './blindSelect';
import { escapeScreen } from './escape';
import { headlineScreen } from './headline';
import { heistScreen } from './heist';
import { heistSetupScreen } from './heistSetup';
import { partnerSelectScreen } from './partnerSelect';
import { payoutScreen } from './payout';
import { prepScreen } from './prep';
import { runSummaryScreen } from './runSummary';
import { safehouseScreen } from './safehouse';
import { sandboxScreen } from './sandbox';
import { scoutingScreen } from './scouting';
import { titleScreen } from './title';

export const SCREENS: Record<ScreenId, Screen> = {
  title: titleScreen,
  partnerSelect: partnerSelectScreen,
  anteIntro: anteIntroScreen,
  blindSelect: blindSelectScreen,
  scouting: scoutingScreen,
  prep: prepScreen,
  safehouse: safehouseScreen,
  heistSetup: heistSetupScreen,
  heist: heistScreen,
  escape: escapeScreen,
  payout: payoutScreen,
  headline: headlineScreen,
  runSummary: runSummaryScreen,
  sandbox: sandboxScreen,
};

export const SCREEN_IDS = Object.keys(SCREENS) as ScreenId[];
