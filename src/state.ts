import { ITEM_IDS, ItemId, defaultPrice } from './econ';

/** What the player has learned about an item's price, from customer reactions. */
export interface Note {
  cheap?: number; // highest price that delighted (too low)
  sold?: number; // highest price a customer was happy with
  haggle?: number; // lowest price that made a customer hesitate
  tooHigh?: number; // lowest price that annoyed a customer
}

export type Phase = 'new' | 'tutorial' | 'dungeon' | 'morning' | 'upgrade' | 'done';

export interface State {
  phase: Phase;
  day: number;
  coins: number;
  xp: number;
  level: number;
  stock: ItemId[];
  prices: Record<ItemId, number>;
  notebook: Record<ItemId, Note>;
  /** Upgrade tree: node id -> level owned. See upgrades.ts. */
  up: Record<string, number>;
  pet: { kind: 'cat' | 'dog'; name: string } | null;
  /** Customers won over by cashback who come back as extra walk-ins tomorrow. */
  regulars: number;
  interests: string[];
  shopList: string[];
  muted: boolean;
  avatar: 'male' | 'female';
  partners: string[];
  /** Introduction levels cleared, 0 to 5. After 5 the Daily Dungeon opens. */
  dungeonLevel: number;
  unlocks: { auto: boolean; bow: boolean };
}

const SAVE_KEY = 'shopkeeper-save-v3';
const LOG_KEY = 'shopkeeper-log-v1';

const byItem = <T>(f: (id: ItemId) => T) => Object.fromEntries(ITEM_IDS.map((id) => [id, f(id)])) as Record<ItemId, T>;

export function fresh(): State {
  return {
    phase: 'new',
    day: 1,
    coins: 0,
    xp: 0,
    level: 1,
    stock: ['gear', 'gear', 'cell'],
    prices: byItem(defaultPrice),
    notebook: byItem(() => ({})),
    up: {},
    pet: null,
    regulars: 0,
    interests: [],
    shopList: [],
    muted: false,
    avatar: 'male',
    partners: [],
    dungeonLevel: 0,
    unlocks: { auto: false, bow: false },
  };
}

function load(): State | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...fresh(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export const hasSave = () => {
  const s = load();
  return !!s && s.phase !== 'new';
};

export const S: State = load() ?? fresh();

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function resetState() {
  const { muted, avatar } = S;
  Object.assign(S, fresh(), { muted, avatar });
  save();
}

// ---- Local analytics: an event log kept in the browser only ----

interface LogEvent {
  t: number;
  ev: string;
  [k: string]: unknown;
}

const sessionStart = Date.now();
let events: LogEvent[] = [];
try {
  events = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
} catch {
  events = [];
}

export function log(ev: string, data: Record<string, unknown> = {}) {
  events.push({ t: Date.now(), ev, sessionSec: Math.round((Date.now() - sessionStart) / 1000), ...data });
  if (events.length > 1000) events = events.slice(-1000);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}

export const getLog = () => events;

// Scenes report back to the flow controller through these hooks.
export interface DaySummary {
  tutorial: boolean;
  revenue: number;
  cashback: number;
  sales: number;
  campaignUsed: boolean;
  /** Sales made before opening, through pre-orders. */
  preorders: { item: ItemId; price: number }[];
  /** Customers who received cashback, and how many of them will return tomorrow. */
  happy: number;
  regulars: number;
  customers: number;
  startStock: ItemId[];
}
export interface RunSummary {
  bag: ItemId[];
  lost: ItemId[];
  /** Loot the pet already ran home: safe even on defeat. */
  banked: ItemId[];
  rooms: number;
  total: number;
  defeated: boolean;
  /** Every room cleared and the player walked out. */
  complete: boolean;
  daily: boolean;
}
export const hooks = {
  dayEnded: (_: DaySummary) => {},
  runEnded: (_: RunSummary) => {},
  hud: () => {},
  cityExit: () => {},
};
