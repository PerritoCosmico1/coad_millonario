import './styles.css';
import { SCREENS } from './screens';
import { mountDebug } from './ui/debug';
import { initFx } from './ui/fx';
import { mountHud } from './ui/hud';
import { goTo, initRouter } from './ui/router';
import { createStage } from './ui/stage';

const parts = createStage(document.getElementById('app')!);
initFx(parts.fx, parts.screen);
initRouter(parts.screen, SCREENS);
mountHud(parts.hud, parts.stage);
mountDebug(parts.debug);
goTo('title');
