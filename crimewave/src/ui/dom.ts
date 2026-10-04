/** Minimal DOM helpers. No framework — screens build plain elements with h(). */

export type Child = Node | string | number | null | undefined | false | Child[];

export interface Props {
  class?: string;
  style?: string;
  title?: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  [attr: string]: unknown;
}

/** h('div', { class: 'card', onClick }, 'text', child, [more children]) */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'style') el.style.cssText = String(value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key in el) (el as unknown as Record<string, unknown>)[key] = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace all children of `el`. */
export function render(el: HTMLElement, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

export const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
export const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;
