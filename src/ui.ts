// DOM overlay on top of the Phaser canvas. The canvas draws the pixel-art world;
// every word and control is HTML, so text stays crisp and controls are native.

import { artUrl } from './art';

type Kid = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

const root = document.getElementById('ui')!;
const layer = (id: string) => root.appendChild(h('div', { id, class: 'layer' }));
export const floatLayer = layer('float');
const hudLayer = layer('hud');
const sheetLayer = layer('sheet');
const modalLayer = layer('modal');
const toastLayer = layer('toast');

const swap = (l: HTMLElement, node: Node | null) => {
  l.replaceChildren();
  if (node) l.append(node);
  l.classList.toggle('on', !!node);
};
export const setHud = (n: Node | null) => swap(hudLayer, n);
export const setSheet = (n: Node | null) => swap(sheetLayer, n);
export const setModal = (n: Node | null) => swap(modalLayer, n);

/** Place an element using world coordinates (the 360x640 stage). */
export function place(el: HTMLElement, x: number, y: number) {
  el.style.left = `${x / 3.6}%`;
  el.style.top = `${y / 6.4}%`;
}

export function floatAt(x: number, y: number, content: Kid, cls = '', ms = 1100) {
  const el = h('div', { class: `float ${cls}` }, content);
  place(el, x, y);
  floatLayer.append(el);
  window.setTimeout(() => el.remove(), ms);
  return el;
}

export function toast(text: string, ms = 2200) {
  const el = h('div', { class: 'toastmsg' }, text);
  toastLayer.replaceChildren(el);
  window.setTimeout(() => el.remove(), ms);
}

export const icon = (key: string, cls = 'ico') => h('img', { src: artUrl(key), class: cls, alt: '', draggable: 'false' });

export const btn = (label: Kid | Kid[], onclick: () => void, cls = '') =>
  h('button', { class: `btn ${cls}`, type: 'button', onclick }, ...(Array.isArray(label) ? label : [label]));

export function card(title: string, ...body: Kid[]) {
  return h('div', { class: 'card' }, h('h2', {}, title), ...body);
}
