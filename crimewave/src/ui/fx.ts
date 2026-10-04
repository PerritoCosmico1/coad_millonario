/** Cheap juice: floating numbers, toasts, screen shake. */

import { onEvent } from '../core/events';
import { h } from './dom';
import { stageScale } from './stage';

let layer: HTMLElement | null = null;
let shakeTarget: HTMLElement | null = null;

export function initFx(fxLayer: HTMLElement, screen: HTMLElement): void {
  layer = fxLayer;
  shakeTarget = screen;
  onEvent((e) => {
    if (e.type === 'shake') shake();
    if (e.type === 'toast') toast(e.text, e.tone);
  });
}

/** Float a short text up from an element (e.g. "+$50" next to the cash readout). */
export function floatText(anchor: HTMLElement, text: string, cls: string): void {
  if (!layer || !anchor.isConnected) return;
  const a = anchor.getBoundingClientRect();
  const l = layer.getBoundingClientRect();
  const s = stageScale();
  const el = h('div', { class: `float-text ${cls}` }, text);
  el.style.left = `${(a.right - l.left) / s + 6}px`;
  el.style.top = `${(a.top - l.top) / s}px`;
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function toast(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
  if (!layer) return;
  const el = h('div', { class: `toast ${tone}` }, text);
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function shake(el: HTMLElement | null = shakeTarget): void {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
}
