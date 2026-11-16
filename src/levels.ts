// Dungeon content: five hand-built introduction levels, then the Daily Dungeon,
// which is generated from the date so everyone gets the same layout each day.

import { ItemId, Rng, mulberry32 } from './econ';

export type Kind = 'bot' | 'drone' | 'slime' | 'guardian';
export interface Block { x: number; y: number; w: number; h: number }
export interface RoomDef {
  name: string;
  spawns: [Kind, number, number][];
  chest: ItemId[];
  bg: number;
  blocks: Block[];
}
export type Unlock = 'auto' | 'bow' | 'daily';
export interface LevelDef {
  title: string;
  blurb: string;
  unlock?: Unlock;
  rooms: RoomDef[];
}

export const UNLOCK_INFO: Record<Unlock, { name: string; text: string; emoji: string }> = {
  auto: { name: 'Auto attack', text: 'Your wrench now swings on its own when an enemy is in reach.', emoji: '🔧' },
  bow: { name: 'Pulse bow', text: 'Drag the bow button to aim, release to fire. Hits from across the room.', emoji: '🏹' },
  daily: { name: 'Daily Dungeon', text: 'A new layout every day, with Gold Chips and Prism Shards to sell.', emoji: '🌀' },
};

const room = (name: string, bg: number, spawns: [Kind, number, number][], chest: ItemId[]): RoomDef => ({ name, bg, spawns, chest, blocks: [] });

export const INTRO: LevelDef[] = [
  {
    title: 'First Steps', blurb: 'Two rusty Scrap Bots. Learn to swing and roll.', unlock: 'auto',
    rooms: [room('Scrap Bots', 0, [['bot', 110, 200], ['bot', 250, 200]], ['lens'])],
  },
  {
    title: 'The Server Floor', blurb: 'Zap Drones keep their distance. Roll through the shot.',
    rooms: [
      room('Patrol', 0, [['bot', 90, 200], ['bot', 270, 200]], ['cell']),
      room('Drone Nest', 1, [['bot', 180, 240], ['drone', 110, 130], ['drone', 250, 130]], ['lens']),
    ],
  },
  {
    title: 'Glitch Garden', blurb: 'Glitch Slimes split when you hit them.', unlock: 'bow',
    rooms: [
      room('Slime Pool', 1, [['slime', 180, 260], ['bot', 90, 180]], ['cell']),
      room('Crossfire', 0, [['drone', 90, 130], ['drone', 270, 130], ['bot', 180, 230], ['slime', 180, 330]], ['lens']),
    ],
  },
  {
    title: 'Deep Racks', blurb: 'Everything at once. Use the bow on the drones.',
    rooms: [
      room('Checkpoint', 0, [['bot', 90, 210], ['bot', 270, 210], ['drone', 180, 130]], ['cell']),
      room('Overgrowth', 1, [['slime', 120, 260], ['slime', 240, 260], ['drone', 180, 130]], ['lens']),
      room('Lockdown', 0, [['bot', 80, 230], ['bot', 280, 230], ['drone', 110, 130], ['drone', 250, 130], ['slime', 180, 320]], ['lens']),
    ],
  },
  {
    title: 'The Vault', blurb: 'The Vault Guardian is awake. Watch for its charge and its slam.', unlock: 'daily',
    rooms: [
      room('Antechamber', 1, [['bot', 90, 220], ['bot', 270, 220], ['drone', 180, 130]], ['cell']),
      room('Last Line', 0, [['slime', 180, 280], ['drone', 100, 130], ['drone', 260, 130]], ['lens']),
      room('Vault Guardian', 2, [['guardian', 180, 200]], ['lens', 'cell']),
    ],
  },
];

export const todaySeed = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

const ROOM_NAMES = ['Cold Aisle', 'Cable Run', 'Backup Hall', 'Fan Room', 'Patch Bay', 'Dead Rack Row', 'Coolant Deck', 'Ghost Cache'];

function pillars(rng: Rng, count: number): Block[] {
  const out: Block[] = [];
  for (let tries = 0; out.length < count && tries < 60; tries++) {
    const b = { x: 50 + Math.floor(rng() * 220), y: 130 + Math.floor(rng() * 290), w: 38, h: 26 };
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (Math.hypot(cx - 180, cy - 260) < 70) continue; // keep the chest clear
    if (out.some((o) => Math.abs(o.x - b.x) < 70 && Math.abs(o.y - b.y) < 60)) continue;
    out.push(b);
  }
  return out;
}

function place(rng: Rng, blocks: Block[], taken: [number, number][]): [number, number] {
  for (let tries = 0; tries < 80; tries++) {
    const x = 60 + rng() * 240;
    const y = 120 + rng() * 280;
    if (blocks.some((b) => x > b.x - 22 && x < b.x + b.w + 22 && y > b.y - 22 && y < b.y + b.h + 22)) continue;
    if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 46)) continue;
    taken.push([x, y]);
    return [Math.round(x), Math.round(y)];
  }
  return [180, 160];
}

/** Four procedurally generated rooms: random enemies, pillars for cover, and special loot. */
export function dailyDungeon(seed = todaySeed()): RoomDef[] {
  const rng = mulberry32(seed);
  const rooms: RoomDef[] = [];
  const names = [...ROOM_NAMES].sort(() => rng() - 0.5);
  for (let i = 0; i < 4; i++) {
    const last = i === 3;
    const blocks = pillars(rng, 2 + Math.floor(rng() * 3));
    const taken: [number, number][] = [];
    const spawns: [Kind, number, number][] = [];
    if (last) {
      spawns.push(['guardian', 180, 190]);
      taken.push([180, 190]);
      for (let k = 0; k < 2; k++) spawns.push(['drone', ...place(rng, blocks, taken)]);
    } else {
      for (let k = 0; k < 3 + i; k++) {
        const t = rng();
        spawns.push([t < 0.45 ? 'bot' : t < 0.75 ? 'drone' : 'slime', ...place(rng, blocks, taken)]);
      }
    }
    const chest: ItemId[] = last ? ['prism', 'chip'] : [rng() < 0.5 ? 'chip' : 'lens'];
    rooms.push({ name: last ? 'Vault Guardian' : names[i], bg: last ? 2 : Math.floor(rng() * 2), spawns, chest, blocks: last ? blocks.filter((b) => b.y > 300) : blocks });
  }
  return rooms;
}
