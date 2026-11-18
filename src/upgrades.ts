// The upgrade tree. Four branches; every node has levels, a rising cost and, for some,
// a prerequisite. Other modules read the derived numbers at the bottom of this file
// rather than poking at levels directly.

import { S, save, log } from './state';

export type Branch = 'store' | 'room' | 'combat' | 'pack' | 'pet';

export interface Node {
  id: string;
  branch: Branch;
  name: string;
  emoji: string;
  /** What each level does, shown on the card. Index 0 is level 1. */
  levels: string[];
  /** Cost of level 1; each further level costs this much more again. */
  cost: number;
  /** Must own at least one level of this node first. */
  needs?: string;
  /** Extra gate that is not another node, with the reason shown while locked. */
  gate?: () => string | null;
}

export const BRANCHES: { id: Branch; name: string; emoji: string; blurb: string }[] = [
  { id: 'store', name: 'Store', emoji: '🏪', blurb: 'More shelves, better customers, a shop people want to linger in.' },
  { id: 'room', name: 'Room', emoji: '🛋️', blurb: 'Make the place your own. Furniture is for you, not the customers.' },
  { id: 'combat', name: 'Combat', emoji: '⚔️', blurb: 'Hit harder, last longer, roll more often.' },
  { id: 'pack', name: 'Backpack', emoji: '🎒', blurb: 'Carry more loot out of every run.' },
  { id: 'pet', name: 'Pet', emoji: '🐾', blurb: 'Your companion fights, carries and runs loot home.' },
];

export const NODES: Node[] = [
  // ---- store ----
  { id: 'shelves', branch: 'store', name: 'Display shelves', emoji: '🗄️', cost: 120, levels: ['6 shelves on display (from 4)'] },
  { id: 'room', branch: 'store', name: 'Expanded room', emoji: '🚪', cost: 260, needs: 'shelves', levels: ['Knock through to the back: 9 shelves on display'] },
  { id: 'storage', branch: 'store', name: 'Extra storage', emoji: '📦', cost: 90, levels: ['Stock room holds 16 items (from 10)', 'Stock room holds 24 items'] },
  { id: 'sign', branch: 'store', name: 'Shop sign', emoji: '🪧', cost: 110, levels: ['2 more walk-in customers a day', '4 more walk-in customers a day'] },
  { id: 'preorder', branch: 'store', name: 'Pre-orders', emoji: '📝', cost: 140, needs: 'sign', levels: ['One item a day is sold before you open, at 120% of its value', 'Two pre-orders a day'] },
  { id: 'vip', branch: 'store', name: 'VIP customers', emoji: '👑', cost: 220, needs: 'preorder', levels: ['One VIP a day: pays up to 160% and never haggles', 'Two VIPs a day'] },
  { id: 'curtains', branch: 'store', name: 'Curtains', emoji: '🪟', cost: 70, levels: ['Cosy: customers tolerate prices 3% higher'] },
  { id: 'lights', branch: 'store', name: 'String lights', emoji: '💡', cost: 70, levels: ['Inviting: customers tolerate prices 3% higher'] },
  { id: 'carpet', branch: 'store', name: 'Fine carpet', emoji: '🧶', cost: 90, needs: 'curtains', levels: ['Plush: customers tolerate prices 3% higher'] },
  { id: 'wood', branch: 'store', name: 'Wood finish', emoji: '🪵', cost: 90, needs: 'lights', levels: ['Polished: customers tolerate prices 3% higher'] },

  // ---- personal room: cosmetic ----
  { id: 'bed', branch: 'room', name: 'Proper bed', emoji: '🛏️', cost: 80, levels: ['Swap the futon for a real bed with a quilt'] },
  { id: 'rug', branch: 'room', name: 'Woven rug', emoji: '🧶', cost: 50, levels: ['A rug by the counter'] },
  { id: 'armchair', branch: 'room', name: 'Armchair', emoji: '💺', cost: 70, levels: ['A reading chair by the wall'] },
  { id: 'posters', branch: 'room', name: 'Posters', emoji: '🖼️', cost: 40, levels: ['Two framed posters for the back wall'] },
  { id: 'lamp', branch: 'room', name: 'Floor lamp', emoji: '🛋️', cost: 60, levels: ['Warm light for late nights'] },

  // ---- combat ----
  { id: 'melee', branch: 'combat', name: 'Charged wrench', emoji: '🔧', cost: 120, levels: ['+1 melee damage', '+2 melee damage', '+3 melee damage'] },
  { id: 'health', branch: 'combat', name: 'Tough apron', emoji: '❤️', cost: 100, levels: ['6 hearts (from 5)', '7 hearts', '8 hearts'] },
  { id: 'shield', branch: 'combat', name: 'Energy shield', emoji: '🛡️', cost: 150, needs: 'health', levels: ['Blocks the first hit in every room', 'Blocks the first two hits in every room'] },
  { id: 'regen', branch: 'combat', name: 'Second wind', emoji: '💗', cost: 160, needs: 'health', levels: ['Heal 1 heart when you clear a room', 'Heal 2 hearts when you clear a room'] },
  { id: 'roll', branch: 'combat', name: 'Quick feet', emoji: '💨', cost: 90, levels: ['Dodge roll recharges 25% faster', 'Dodge roll recharges 45% faster'] },
  { id: 'ranged', branch: 'combat', name: 'Tuned bow', emoji: '🏹', cost: 130, gate: () => (S.unlocks.bow ? null : 'Unlock the bow by clearing dungeon Level 3'),
    levels: ['+1 bow damage', '+2 bow damage and faster reload'] },
  { id: 'focus', branch: 'combat', name: 'Steady aim', emoji: '🎯', cost: 110, needs: 'ranged', levels: ['Hold your aim for 3 seconds (from 2)', 'Hold your aim for 4 seconds'] },

  // ---- backpack ----
  { id: 'bag', branch: 'pack', name: 'Bigger backpack', emoji: '🎒', cost: 100, levels: ['8 loot slots (from 6)', '10 loot slots', '12 loot slots'] },

  // ---- pet ----
  { id: 'petDmg', branch: 'pet', name: 'Sharp claws', emoji: '🐾', cost: 90, levels: ['Pet deals 2 damage (from 1)', 'Pet deals 3 damage', 'Pet deals 4 damage'] },
  { id: 'petSpeed', branch: 'pet', name: 'Zoomies', emoji: '⚡', cost: 90, levels: ['Pet attacks 25% faster', 'Pet attacks 45% faster', 'Pet attacks 60% faster'] },
  { id: 'petBag', branch: 'pet', name: 'Pet saddlebag', emoji: '👜', cost: 110, levels: ['Pet carries 2 extra loot', 'Pet carries 4 extra loot'] },
  { id: 'courier', branch: 'pet', name: 'Homing run', emoji: '🏠', cost: 180, needs: 'petBag', levels: ['Send your pet back to the store mid-run. That loot is safe even if you fall.'] },
];

const byId = new Map(NODES.map((n) => [n.id, n]));

export const lvl = (id: string): number => S.up[id] ?? 0;
export const maxed = (id: string) => lvl(id) >= byId.get(id)!.levels.length;
export const costOf = (id: string) => byId.get(id)!.cost * (lvl(id) + 1);

/** Why a node cannot be bought right now, or null when it can. */
export function lockReason(id: string): string | null {
  const n = byId.get(id)!;
  if (n.branch === 'pet' && !S.pet) return 'Choose a companion first';
  if (n.needs && lvl(n.needs) < 1) return `Needs ${byId.get(n.needs)!.name}`;
  return n.gate ? n.gate() : null;
}

export function buy(id: string): boolean {
  if (maxed(id) || lockReason(id) || S.coins < costOf(id)) return false;
  S.coins -= costOf(id);
  S.up[id] = lvl(id) + 1;
  save();
  log('upgrade', { id, level: S.up[id] });
  return true;
}

/** Can the player afford anything at all? Used to nudge them toward the tree. */
export const anyAffordable = () => NODES.some((n) => !maxed(n.id) && !lockReason(n.id) && S.coins >= costOf(n.id));

// ---- derived numbers the rest of the game reads ----

export const shelfCount = () => (lvl('room') ? 9 : lvl('shelves') ? 6 : 4);
export const storageCap = () => [10, 16, 24][lvl('storage')];
export const walkInCount = () => 6 + 2 * lvl('sign');
export const preorders = () => lvl('preorder');
export const vipCount = () => lvl('vip');
/** Each cosmetic makes customers a little more forgiving about price. */
export const charm = () => 0.03 * (lvl('curtains') + lvl('lights') + lvl('carpet') + lvl('wood'));

export const meleeBonus = () => lvl('melee');
export const maxHearts = () => 5 + lvl('health');
export const shieldHits = () => lvl('shield');
export const regenHearts = () => lvl('regen');
export const rollCooldown = () => 0.7 * [1, 0.75, 0.55][lvl('roll')];
export const bowDamage = () => 2 + lvl('ranged');
export const bowReload = () => (lvl('ranged') >= 2 ? 0.45 : 0.65);
export const bagSlots = () => 6 + 2 * lvl('bag');

export const petDamage = () => 1 + lvl('petDmg') + (S.petFed ? 1 : 0);
/** How long the bow can be held drawn, in seconds. */
export const aimTime = () => 2 + lvl('focus');
export const petAttackGap = () => 1.6 * [1, 0.75, 0.55, 0.4][lvl('petSpeed')];
export const petBagSlots = () => (S.pet ? 2 * lvl('petBag') : 0);
export const hasCourier = () => !!S.pet && lvl('courier') > 0;
