/**
 * The stage: a fixed 1280×720 logical canvas, scaled to fit the window and
 * letterboxed. Everything renders inside it in logical pixels.
 */

import { h } from './dom';

export const STAGE_W = 1280;
export const STAGE_H = 720;

export interface StageParts {
  stage: HTMLElement;
  /** Left sidebar HUD. */
  hud: HTMLElement;
  /** Where screens mount. */
  screen: HTMLElement;
  /** Floating pop-ups, toasts. */
  fx: HTMLElement;
  /** Debug toggle + panel. */
  debug: HTMLElement;
}

let scale = 1;

export function createStage(host: HTMLElement): StageParts {
  const hud = h('aside', { id: 'hud' });
  const screen = h('main', { id: 'screen' });
  const fx = h('div', { id: 'fx' });
  const debug = h('div', { id: 'debug' });
  const stage = h('div', { id: 'stage' }, hud, screen, fx, debug);
  host.appendChild(stage);

  const fit = () => {
    scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };
  window.addEventListener('resize', fit);
  fit();

  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  return { stage, hud, screen, fx, debug };
}

/** Mouse position in an element's own (unscaled, logical) pixels. Use for canvases. */
export function localPoint(e: MouseEvent | PointerEvent, el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * el.offsetWidth,
    y: ((e.clientY - rect.top) / rect.height) * el.offsetHeight,
  };
}

export function stageScale(): number {
  return scale;
}
