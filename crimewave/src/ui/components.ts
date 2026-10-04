/** Reusable greybox UI pieces. */

import { playSfx } from '../core/sfx';
import { h, type Child } from './dom';

export interface ButtonOptions {
  variant?: 'primary' | 'danger' | 'ghost' | 'loud' | 'quiet';
  disabled?: boolean;
  title?: string;
  small?: boolean;
}

export function button(label: Child, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const cls = ['btn', opts.variant ?? '', opts.small ? 'small' : ''].filter(Boolean).join(' ');
  return h(
    'button',
    {
      class: cls,
      disabled: opts.disabled,
      title: opts.title,
      onClick: () => {
        playSfx('click');
        onClick();
      },
    },
    label,
  );
}

export interface Meter {
  el: HTMLElement;
  /** value in [0, max]; text replaces the default "value" readout. */
  set(value: number, text?: string): void;
}

/** A horizontal bar meter whose fill animates when it changes. */
export function meter(opts: { color: string; max?: number; label?: string; className?: string }): Meter {
  const max = opts.max ?? 100;
  const fill = h('div', { class: 'meter-fill', style: `background:${opts.color}` });
  const readout = h('span', { class: 'meter-readout' });
  const el = h(
    'div',
    { class: `meter ${opts.className ?? ''}` },
    opts.label ? h('span', { class: 'meter-label' }, opts.label) : null,
    h('div', { class: 'meter-track' }, fill),
    readout,
  );
  return {
    el,
    set(value, text) {
      fill.style.width = `${Math.max(0, Math.min(1, value / max)) * 100}%`;
      readout.textContent = text ?? String(Math.round(value));
    },
  };
}

/** Section heading + content, used on most screens. */
export function panel(title: Child, ...children: Child[]): HTMLElement {
  return h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, title), ...children);
}

export function screenTitle(title: Child, subtitle?: Child): HTMLElement {
  return h('header', { class: 'screen-title' }, h('h1', null, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null);
}

/** "Coming in M2" style note on placeholder screens. */
export function placeholderNote(milestone: string, text: Child): HTMLElement {
  return h('div', { class: 'placeholder-note' }, h('span', { class: 'tag' }, `Placeholder · ${milestone}`), ' ', text);
}

export function chip(text: Child, cls = ''): HTMLElement {
  return h('span', { class: `chip ${cls}` }, text);
}
