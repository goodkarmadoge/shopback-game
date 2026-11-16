// Shared UI panels used by both the flow controller and the shop scene.

import { ITEMS, ItemId, Reaction } from './econ';
import { S, save } from './state';
import { btn, card, h, icon } from './ui';
import { sfx } from './audio';

export const BRAND = 'ShopBack'; // swap for a stand-in name here if needed

export const EMOTE: Record<Reaction, { face: string; word: string }> = {
  delighted: { face: '🤩', word: 'Delighted' },
  happy: { face: '😊', word: 'Happy' },
  hesitant: { face: '🤔', word: 'Hesitant' },
  annoyed: { face: '😠', word: 'Annoyed' },
};

export function noteText(id: ItemId): string {
  const n = S.notebook[id];
  const parts: string[] = [];
  if (n.cheap != null) parts.push(`🤩 Delighted at ${n.cheap}`);
  if (n.sold != null) parts.push(`😊 Happy at ${n.sold}`);
  if (n.haggle != null) parts.push(`🤔 Hesitant at ${n.haggle}`);
  if (n.tooHigh != null) parts.push(`😠 Annoyed at ${n.tooHigh}`);
  return parts.length ? parts.join(' · ') : 'No notes yet. Guess, then watch how customers react.';
}

/** Price sliders for every item type in stock, with the notebook beside each. */
export function pricingPanel(title: string, sub: string, cta: string, onDone: () => void): HTMLElement {
  const types = [...new Set(S.stock)].sort((a, b) => ITEMS[a].value - ITEMS[b].value);
  const rows = types.map((id) => {
    const it = ITEMS[id];
    const count = S.stock.filter((s) => s === id).length;
    const out = h('b', { class: 'price' }, S.prices[id]);
    const slider = h('input', {
      type: 'range', min: it.step, max: it.sliderMax, step: it.step, value: S.prices[id],
      'aria-label': `Price for ${it.name}`,
      oninput: () => {
        S.prices[id] = Number(slider.value);
        out.textContent = slider.value;
      },
    });
    return h('div', { class: 'prow' },
      icon(`item_${id}`),
      h('div', { class: 'pmain' },
        h('div', { class: 'pname' }, h('span', {}, `${it.name} ×${count}`), h('span', { class: `rar ${it.rarity}` }, it.rarity)),
        h('div', { class: 'pslide' }, slider, icon('coin', 'ico s'), out),
        h('div', { class: 'pnote' }, h('b', {}, 'Notebook: '), noteText(id)),
      ),
    );
  });
  return card(title, h('p', {}, sub), h('div', { class: 'prows' }, ...rows),
    btn(cta, () => { sfx('tap'); save(); onDone(); }, 'primary'));
}
