// Pure game rules. No DOM, no Phaser: the game and the balance simulation both import this.

export type ItemId = 'gear' | 'cell' | 'gel' | 'lens' | 'core' | 'chip' | 'prism';
export type Rarity = 'Common' | 'Uncommon' | 'Rare';

export interface ItemDef {
  name: string;
  value: number; // hidden market value
  rarity: Rarity;
  source: string;
  sliderMax: number;
  step: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  gear: { name: 'Scrap Gear', value: 20, rarity: 'Common', source: 'Scrap Bot', sliderMax: 60, step: 1 },
  cell: { name: 'Power Cell', value: 30, rarity: 'Common', source: 'Zap Drone', sliderMax: 80, step: 1 },
  gel: { name: 'Glitch Gel', value: 55, rarity: 'Uncommon', source: 'Glitch Slime', sliderMax: 150, step: 5 },
  lens: { name: 'Neon Lens', value: 70, rarity: 'Uncommon', source: 'Loot chest', sliderMax: 200, step: 5 },
  core: { name: 'Rare Core', value: 160, rarity: 'Rare', source: 'Vault Guardian', sliderMax: 400, step: 5 },
  // special loot, only found in the Daily Dungeon
  chip: { name: 'Gold Chip', value: 220, rarity: 'Rare', source: 'Daily Dungeon', sliderMax: 520, step: 5 },
  prism: { name: 'Prism Shard', value: 320, rarity: 'Rare', source: 'Daily Dungeon', sliderMax: 760, step: 5 },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
/** What customers ask for by default; special loot is only asked for when it is in stock. */
export const BASE_IDS: ItemId[] = ['gear', 'cell', 'gel', 'lens', 'core'];

export type CType = 'hunter' | 'collector' | 'rusher';

export interface CTypeDef {
  name: string;
  limit: number; // pays up to this share of value
  patience: number; // barter rounds
  open: number; // opening offer as a share of what they would finally pay
  blurb: string;
}

export const CTYPES: Record<CType, CTypeDef> = {
  hunter: { name: 'Bargain Hunter', limit: 0.95, patience: 4, open: 0.65, blurb: 'Always barters, opens low' },
  collector: { name: 'Collector', limit: 1.4, patience: 2, open: 0.85, blurb: 'Pays well, walks quickly' },
  rusher: { name: 'Rusher', limit: 1.15, patience: 1, open: 0.9, blurb: 'Buys fast or leaves' },
};

export const RULES = {
  shelfSlots: 4,
  shelfSlotsUpgraded: 6,
  walkIns: 6,
  signBonus: 2,
  campaignMult: 3,
  cashback: 0.1,
  upgradeCost: 150,
  bagSlots: 6,
  hearts: 5,
  xpSale: 10,
  xpRoom: 20,
  xpLevel2: 100,
};

export type Reaction = 'delighted' | 'happy' | 'hesitant' | 'annoyed';

export function reaction(price: number, value: number): Reaction {
  const r = price / value;
  if (r < 0.8) return 'delighted';
  if (r <= 1.1) return 'happy';
  if (r <= 1.4) return 'hesitant';
  return 'annoyed';
}

export const defaultPrice = (id: ItemId) => {
  const it = ITEMS[id];
  // a touch above value: most customers buy outright, Bargain Hunters still barter
  return Math.round((it.value * 1.08) / it.step) * it.step;
};

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Customer {
  type: CType;
  wants: ItemId;
  /** VIPs pay up to 160% of value and never haggle. */
  vip?: boolean;
}

const pick = <T>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

export function makeCustomer(rng: Rng, pool: ItemId[] = BASE_IDS): Customer {
  const t = rng();
  const type: CType = t < 0.4 ? 'hunter' : t < 0.8 ? 'rusher' : 'collector';
  // Collectors only care about the scarcer finds.
  const wants = type === 'collector' ? pick(pool.filter((i) => ITEMS[i].rarity !== 'Common'), rng) : pick(pool, rng);
  return { type, wants };
}

// ---- Bartering ----

export interface Barter {
  type: CType;
  ask: number;
  limit: number; // hidden: the most this customer will pay
  open: number;
  offer: number; // the customer's current offer
  patience: number;
  patience0: number;
  round: number;
}

export function startBarter(type: CType, ask: number, value: number): Barter {
  const T = CTYPES[type];
  const limit = Math.round(T.limit * value);
  const open = Math.max(1, Math.round(Math.min(ask, limit) * T.open));
  return { type, ask, limit, open, offer: open, patience: T.patience, patience0: T.patience, round: 0 };
}

export type BarterResult =
  | { result: 'deal'; price: number }
  | { result: 'offer'; offer: number }
  | { result: 'leave' };

/**
 * The player counters at `counter` (Hold firm = counter at the asking price).
 * It costs one patience. The customer's willingness climbs toward their hidden
 * limit each round; they take the deal if the counter is within it.
 */
export function barterStep(b: Barter, counter: number): BarterResult {
  const willing = Math.round(b.open + ((b.limit - b.open) * (b.round + 1)) / b.patience0);
  b.round++;
  b.patience--;
  if (counter <= willing) return { result: 'deal', price: counter };
  if (b.patience <= 0) return { result: 'leave' };
  b.offer = Math.min(willing, b.ask);
  return { result: 'offer', offer: b.offer };
}

/** Does this customer open a barter, buy outright, or walk? */
export const VIP_LIMIT = 1.6;

export function approach(type: CType, ask: number, value: number, vip = false): 'buy' | 'barter' | 'leave' {
  if (vip) return ask <= value * VIP_LIMIT ? 'buy' : 'leave';
  const r = reaction(ask, value);
  if (r === 'annoyed') return 'leave';
  if (r === 'delighted') return 'buy';
  if (r === 'happy') return type === 'hunter' ? 'barter' : 'buy';
  return 'barter';
}

// ---- Shelves ----

/** Take the next item for an empty shelf slot: prefer a type not on display, then the most valuable. */
export function takeForShelf(shelf: (ItemId | null)[], back: ItemId[]): ItemId | null {
  if (!back.length) return null;
  const byValue = (a: ItemId, b: ItemId) => ITEMS[b].value - ITEMS[a].value;
  const fresh = back.filter((i) => !shelf.includes(i)).sort(byValue);
  const choice = fresh[0] ?? [...back].sort(byValue)[0];
  back.splice(back.indexOf(choice), 1);
  return choice;
}

// ---- Day simulation (used for the summary's "what if" figure and the balance script) ----

/** A plain, average player: holds firm until the customer's last round, then takes the offer. */
function autoSale(type: CType, ask: number, value: number): number | null {
  const a = approach(type, ask, value);
  if (a === 'leave') return null;
  if (a === 'buy') return ask;
  const b = startBarter(type, ask, value);
  for (;;) {
    if (b.patience <= 1) return b.offer;
    const res = barterStep(b, ask);
    if (res.result === 'deal') return res.price;
    if (res.result === 'leave') return null;
  }
}

export interface DayInput {
  stock: ItemId[];
  prices: Record<ItemId, number>;
  slots: number;
  customers: number;
  campaign: boolean;
}

export interface DayResult {
  revenue: number;
  cashback: number;
  profit: number;
  sales: number;
  left: number;
}

export function simulateDay(o: DayInput, rng: Rng): DayResult {
  const back = [...o.stock];
  const shelf: (ItemId | null)[] = [];
  for (let i = 0; i < o.slots; i++) shelf.push(takeForShelf(shelf, back));
  let revenue = 0;
  let cashback = 0;
  let sales = 0;
  for (let i = 0; i < o.customers; i++) {
    const c = makeCustomer(rng);
    const idx = shelf.indexOf(c.wants);
    if (idx < 0) continue;
    const price = autoSale(c.type, o.prices[c.wants], ITEMS[c.wants].value);
    if (price == null) continue;
    revenue += price;
    if (o.campaign) cashback += Math.round(price * RULES.cashback);
    sales++;
    shelf[idx] = null;
    shelf[idx] = takeForShelf(shelf, back);
  }
  const left = back.length + shelf.filter(Boolean).length;
  return { revenue, cashback, profit: revenue - cashback, sales, left };
}

export function estimateDay(o: DayInput, runs = 300, seed = 7): DayResult {
  const rng = mulberry32(seed);
  const acc: DayResult = { revenue: 0, cashback: 0, profit: 0, sales: 0, left: 0 };
  for (let i = 0; i < runs; i++) {
    const r = simulateDay(o, rng);
    (Object.keys(acc) as (keyof DayResult)[]).forEach((k) => (acc[k] += r[k]));
  }
  (Object.keys(acc) as (keyof DayResult)[]).forEach((k) => (acc[k] = Math.round(acc[k] / runs)));
  return acc;
}
