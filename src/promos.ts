// The promotion calendar. Every day of the week has a theme that makes some loot worth
// more for that day only. Knowing tomorrow's theme tells you what to bring back tonight.

import { ITEMS, ItemId } from './econ';

export interface Promo {
  day: string;
  name: string;
  emoji: string;
  /** Shown on the calendar and the pricing screen. */
  text: string;
  bonus: number;
  applies: (id: ItemId) => boolean;
}

/** Any word of the item's name starting with one of these letters. */
const startsWith = (...letters: string[]) => (id: ItemId) =>
  ITEMS[id].name.split(' ').some((w) => letters.includes(w[0].toUpperCase()));
const named = (...ids: ItemId[]) => (id: ItemId) => ids.includes(id);
const rarity = (r: string) => (id: ItemId) => ITEMS[id].rarity === r;

export const WEEK: Promo[] = [
  { day: 'Mon', name: 'Gear Up Monday', emoji: '⚙️', bonus: 0.1, applies: named('gear'), text: 'Gears and cogs are worth 10% more.' },
  { day: 'Tue', name: 'Charge-It Tuesday', emoji: '🔋', bonus: 0.25, applies: named('cell'), text: 'Everyone’s battery is flat. Power Cells are worth 25% more.' },
  { day: 'Wed', name: 'Wobbly Wednesday', emoji: '🫧', bonus: 0.2, applies: named('gel'), text: 'If it jiggles, it sells. Glitch Gel is worth 20% more.' },
  { day: 'Thu', name: 'Throwback Thursday', emoji: '📼', bonus: 0.15, applies: rarity('Common'), text: 'Retro junk is in. Common loot is worth 15% more.' },
  { day: 'Fri', name: 'Flashy Friday', emoji: '💎', bonus: 0.15, applies: rarity('Rare'), text: 'Payday splurge. Rare loot is worth 15% more.' },
  { day: 'Sat', name: 'S-Day Saturday', emoji: '🅂', bonus: 0.2, applies: startsWith('S'), text: 'Anything with an S-word in its name sells for 20% more.' },
  { day: 'Sun', name: 'Sparkle Sunday', emoji: '✨', bonus: 0.15, applies: named('lens', 'chip', 'prism'), text: 'Shiny things only. Lenses, chips and shards are worth 15% more.' },
];

/** Shop day 1 is the tutorial and has no promotion; day 2 is the first Monday. */
export const promoFor = (shopDay: number): Promo | null => (shopDay < 2 ? null : WEEK[(shopDay - 2) % 7]);

export const promoBonus = (shopDay: number, id: ItemId): number => {
  const p = promoFor(shopDay);
  return p && p.applies(id) ? p.bonus : 0;
};

export const promoItems = (p: Promo): ItemId[] => (Object.keys(ITEMS) as ItemId[]).filter(p.applies);
