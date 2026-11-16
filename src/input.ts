// Dungeon controls: a virtual stick and two buttons on touch, keys and mouse on desktop.

import { h } from './ui';

const keys = new Set<string>();
const stick = { x: 0, y: 0 };
const pressed = { attack: false, dodge: false };
// bow: drag from the button to aim, release to fire
const bowAim = { on: false, x: 0, y: 0 };
let bowShot: { x: number; y: number } | null = null;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!keys.has(k)) {
    if (k === 'j') pressed.attack = true;
    if (k === 'k' || k === ' ') pressed.dodge = true;
    if (k === 'l') bowShot = { x: 0, y: 0 };
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
/** Where the bow is being aimed while the button is held; x and y are 0 until dragged. */
export const aiming = () => bowAim;
/** A released shot. A zero vector means "no drag": aim at the nearest enemy. */
export function takeShot() {
  const s = bowShot;
  bowShot = null;
  return s;
}
export const resetInput = () => {
  stick.x = stick.y = 0;
  pressed.attack = pressed.dodge = false;
  bowAim.on = false;
  bowAim.x = bowAim.y = 0;
  bowShot = null;
};

export function buildControls(withBow = false): HTMLElement {
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
  const acts = h('div', { class: 'acts' }, action('dodge', 'Dodge', 'K'), action('attack', 'Attack', 'J'));
  if (withBow) {
    const bow = h('button', { class: 'act bow', type: 'button' }, h('b', {}, 'Bow'), h('small', {}, 'drag · L'));
    let sx = 0;
    let sy = 0;
    const drag = (e: PointerEvent) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const m = Math.hypot(dx, dy);
      bowAim.x = m > 14 ? dx / m : 0;
      bowAim.y = m > 14 ? dy / m : 0;
    };
    bow.addEventListener('pointerdown', (e) => { e.preventDefault(); bow.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; bowAim.on = true; bowAim.x = bowAim.y = 0; });
    bow.addEventListener('pointermove', (e) => { if (bowAim.on) drag(e); });
    const release = () => { if (!bowAim.on) return; bowShot = { x: bowAim.x, y: bowAim.y }; bowAim.on = false; };
    bow.addEventListener('pointerup', release);
    bow.addEventListener('pointercancel', () => { bowAim.on = false; });
    acts.prepend(bow);
  }
  return h('div', { class: 'controls' }, base, acts);
}
