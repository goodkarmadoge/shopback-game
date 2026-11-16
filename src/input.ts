// Dungeon controls: a virtual stick and two buttons on touch, keys and mouse on desktop.

import { h } from './ui';

const keys = new Set<string>();
const stick = { x: 0, y: 0 };
const pressed = { attack: false, dodge: false };

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!keys.has(k)) {
    if (k === 'j') pressed.attack = true;
    if (k === 'k' || k === ' ') pressed.dodge = true;
  }
  keys.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

export function axis(): { x: number; y: number } {
  let x = stick.x;
  let y = stick.y;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}

export function consume(k: 'attack' | 'dodge'): boolean {
  const v = pressed[k];
  pressed[k] = false;
  return v;
}
export const press = (k: 'attack' | 'dodge') => (pressed[k] = true);
export const resetInput = () => {
  stick.x = stick.y = 0;
  pressed.attack = pressed.dodge = false;
};

export function buildControls(): HTMLElement {
  const knob = h('div', { class: 'knob' });
  const base = h('div', { class: 'stick', 'aria-label': 'Move' }, knob);
  const move = (e: PointerEvent) => {
    const r = base.getBoundingClientRect();
    const max = r.width / 2;
    let dx = (e.clientX - (r.left + max)) / max;
    let dy = (e.clientY - (r.top + max)) / max;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    stick.x = Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15 ? 0 : dx;
    stick.y = Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15 ? 0 : dy;
    knob.style.transform = `translate(${dx * 38}%, ${dy * 38}%)`;
  };
  const end = () => {
    stick.x = stick.y = 0;
    knob.style.transform = '';
  };
  base.addEventListener('pointerdown', (e) => { base.setPointerCapture(e.pointerId); move(e); });
  base.addEventListener('pointermove', (e) => { if (base.hasPointerCapture(e.pointerId)) move(e); });
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);

  const action = (k: 'attack' | 'dodge', label: string, hint: string) => {
    const b = h('button', { class: `act ${k}`, type: 'button' }, h('b', {}, label), h('small', {}, hint));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); });
    return b;
  };
  return h('div', { class: 'controls' }, base, h('div', { class: 'acts' }, action('dodge', 'Dodge', 'K'), action('attack', 'Attack', 'J')));
}
