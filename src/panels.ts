// Shared UI panels used by both the flow controller and the shop scene.

import { ITEMS, ItemId, Reaction } from './econ';
import { S, save } from './state';
import { btn, card, h, icon } from './ui';
import { sfx } from './audio';
import { WEEK, promoBonus, promoFor, promoItems } from './promos';

export const BRAND = 'ShopBack'; // swap for a stand-in name here if needed

export const EMOTE: Record<Reaction, { face: string; word: string }> = {
  delighted: { face: '🤩', word: 'Delighted' },
  happy: { face: '😊', word: 'Happy' },
  hesitant: { face: '🤔', word: 'Hesitant' },
  annoyed: { face: '😠', word: 'Annoyed' },
};

/** Green (safe) through yellow to red (risky) for t in 0..1. */
export function heat(t: number): string {
  return `hsl(${Math.round(130 - 130 * Math.max(0, Math.min(1, t)))} 72% 42%)`;
}

/**
 * Colours a price slider from what the notebook knows: green where customers were
 * happy, yellow where they hesitated, red where they walked. Unknown stretches stay grey.
 */
function priceTrack(id: ItemId): string {
  const it = ITEMS[id];
  const n = S.notebook[id];
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - it.step) / (it.sliderMax - it.step)) * 100));
  const grey = '#d5d9e2';
  const good = Math.max(n.cheap ?? -1, n.sold ?? -1);
  const stops: string[] = [];
  if (good >= 0) stops.push(`${heat(0)} 0%`, `${heat(0)} ${pct(good)}%`);
  else stops.push(`${grey} 0%`);
  if (n.haggle != null) stops.push(`${heat(0.5)} ${pct(n.haggle)}%`);
  if (n.tooHigh != null) stops.push(`${heat(1)} ${pct(n.tooHigh)}%`, `${heat(1)} 100%`);
  else stops.push(`${grey} ${Math.min(100, pct(n.haggle ?? good) + 22)}%`, `${grey} 100%`);
  return stops.length > 2 ? `linear-gradient(90deg, ${stops.join(', ')})` : grey;
}

export function noteText(id: ItemId): string {
  const n = S.notebook[id];
  const parts: string[] = [];
  if (n.cheap != null) parts.push(`🤩 Delighted at ${n.cheap}`);
  if (n.sold != null) parts.push(`😊 Happy at ${n.sold}`);
  if (n.haggle != null) parts.push(`🤔 Hesitant at ${n.haggle}`);
  if (n.tooHigh != null) parts.push(`😠 Annoyed at ${n.tooHigh}`);
  return parts.length ? parts.join('  ·  ') : 'No notes yet';
}

/** The week's promotions as seven chips; today is lit, tapping any day shows its deal. */
export function weekStrip(shopDay: number): HTMLElement {
  const today = promoFor(shopDay);
  const detail = h('div', { class: 'promoline' });
  const show = (i: number) => {
    const p = WEEK[i];
    const isToday = p === today;
    detail.replaceChildren(
      h('b', {}, `${p.emoji} ${p.name}`), h('span', { class: 'when' }, isToday ? 'Today' : p.day),
      h('small', {}, p.text),
      h('div', { class: 'promoicons' }, ...promoItems(p).map((id) => icon(`item_${id}`, 'ico s')), h('i', {}, `+${Math.round(p.bonus * 100)}%`)));
    chips.forEach((c, k) => c.classList.toggle('sel', k === i));
  };
  const chips = WEEK.map((p, i) => {
    const c = h('button', { class: `daychip ${p === today ? 'today' : ''}`, type: 'button', 'aria-label': `${p.name}: ${p.text}` }, h('small', {}, p.day), h('span', {}, p.emoji));
    c.addEventListener('click', () => { sfx('tap'); show(i); });
    return c;
  });
  show(today ? WEEK.indexOf(today) : 0);
  return h('div', { class: 'calendar' }, h('div', { class: 'week' }, ...chips), detail);
}

/** Price sliders for every item type in stock, with the notebook beside each. */
export function pricingPanel(title: string, sub: string, cta: string, onDone: () => void, shopDay = 1): HTMLElement {
  const types = [...new Set(S.stock)].sort((a, b) => ITEMS[a].value - ITEMS[b].value);
  const rows = types.map((id) => {
    const it = ITEMS[id];
    const count = S.stock.filter((s) => s === id).length;
    const out = h('b', { class: 'price' }, S.prices[id]);
    const slider = h('input', {
      type: 'range', class: 'heat', style: `--track:${priceTrack(id)}`, min: it.step, max: it.sliderMax, step: it.step, value: S.prices[id],
      'aria-label': `Price for ${it.name}`,
      oninput: () => {
        S.prices[id] = Number(slider.value);
        out.textContent = slider.value;
      },
    });
    return h('div', { class: 'prow' },
      icon(`item_${id}`),
      h('div', { class: 'pmain' },
        h('div', { class: 'pname' }, h('span', {}, `${it.name} ×${count}`),
          promoBonus(shopDay, id) ? h('span', { class: 'rar hot' }, `▲ ${Math.round(promoBonus(shopDay, id) * 100)}% today`) : h('span', { class: `rar ${it.rarity}` }, it.rarity)),
        h('div', { class: 'pslide' }, slider, icon('coin', 'ico s'), out),
        h('div', { class: 'pnote' }, noteText(id)),
      ),
    );
  });
  return card(title, h('p', {}, sub), shopDay >= 2 ? weekStrip(shopDay) : null, h('div', { class: 'prows' }, ...rows),
    h('div', { class: 'legend' }, h('span', { class: 'g' }, 'Sells'), h('span', { class: 'y' }, 'They haggle'), h('span', { class: 'r' }, 'They leave'), h('span', { class: 'u' }, 'Unknown')),
    btn(cta, () => { sfx('tap'); save(); onDone(); }, 'primary'));
}
