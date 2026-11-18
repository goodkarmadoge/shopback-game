// Rendered sprites (public/sprites, built by scripts/build-sprites.py from assets-src/gen).
// People are 4-frame strips: front step A/B, back step A/B. Enemies are 2-frame strips.

import Phaser from 'phaser';
import { setArtUrl } from './art';
import type { ItemId } from './econ';

export const PEOPLE = ['cust_hunter', 'cust_collector', 'cust_rusher', 'ped_a', 'ped_b'] as const;
export const ITEM_KEYS: ItemId[] = ['gear', 'cell', 'gel', 'lens', 'core', 'chip', 'prism'];
/** Enemy sprite cell size and on-screen scale. */
export const MOB = {
  bot: { cell: 128, scale: 0.32 },
  drone: { cell: 128, scale: 0.29 },
  slime: { cell: 128, scale: 0.3 },
  guardian: { cell: 192, scale: 0.37 },
} as const;

/** Furniture for the shopkeeper's own corner of the shop, and the dungeon's night gate. */
export const ROOM = ['room_futon', 'room_bed', 'room_couch', 'room_armchair', 'room_rug', 'room_posters', 'room_lamp', 'room_bowl', 'room_bench', 'gate_locked'];

/** Loot on a display table; pickups in the dungeon are a little smaller. */
export const ITEM_SCALE = 0.3;
export const COIN_SCALE = 0.36;
export const CHEST_SCALE = 0.34;
const PERSON_SCALE = 0.39;

export function preloadSprites(scene: Phaser.Scene) {
  for (const k of PEOPLE) scene.load.spritesheet(k, `sprites/${k}.png`, { frameWidth: 128, frameHeight: 128 });
  for (const [k, m] of Object.entries(MOB)) scene.load.spritesheet(k, `sprites/${k}.png`, { frameWidth: m.cell, frameHeight: m.cell });
  for (const id of ITEM_KEYS) scene.load.image(`item_${id}`, `sprites/item_${id}.png`);
  for (const k of ['chest_0', 'chest_1', 'coin', 'cbcoin', 'table']) scene.load.image(k === 'table' ? 'table_hd' : k, `sprites/${k}.png`);
  for (const k of ROOM) scene.load.image(k, `sprites/${k}.png`);
}

const heart = (fill: string, hi: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30"><path d="M16 28C5 20 1 14.5 1 9.3 1 4.6 4.6 1.5 8.7 1.5c2.9 0 5.6 1.5 7.3 4 1.7-2.5 4.4-4 7.3-4C27.4 1.5 31 4.6 31 9.3 31 14.5 27 20 16 28z" fill="${fill}" stroke="#2b1b2e" stroke-width="2" stroke-linejoin="round"/><path d="M7 8.5c.4-2 2-3.200 3.8-3.2" fill="none" stroke="${hi}" stroke-width="2.4" stroke-linecap="round"/></svg>`)}`;

export function registerSprites(scene: Phaser.Scene) {
  const smooth: string[] = [...PEOPLE, ...Object.keys(MOB), ...ITEM_KEYS.map((i) => `item_${i}`), 'chest_0', 'chest_1', 'coin', 'cbcoin', 'table_hd', 'spark', 'bullet', 'glow', 'vignette', 'slash', ...ROOM];
  for (const k of smooth) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (const k of PEOPLE) {
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { frames: [0, 1] }), frameRate: 5, repeat: -1 });
    scene.anims.create({ key: `${k}_back`, frames: scene.anims.generateFrameNumbers(k, { frames: [2, 3] }), frameRate: 5, repeat: -1 });
    setArtUrl(`${k}_0`, `sprites/${k}_face.png`);
  }
  for (const k of Object.keys(MOB)) {
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { frames: [0, 1] }), frameRate: k === 'drone' ? 7 : k === 'slime' ? 3.5 : 5, repeat: -1 });
  }
  for (const id of ITEM_KEYS) setArtUrl(`item_${id}`, `sprites/item_${id}.png`);
  setArtUrl('coin', 'sprites/coin.png');
  setArtUrl('heart', heart('#ff4d6d', '#ffd0d8'));
  setArtUrl('heart_empty', heart('#3a3f5c', '#565c80'));
}

/**
 * A walking person. The sprite's position is its waist, as it was for the old pixel
 * sprites, so shadows and speech bubbles keep their offsets: feet land 14 below.
 */
export function person(scene: Phaser.Scene, x: number, y: number, key: string) {
  return scene.add.sprite(x, y, key, 0).setScale(PERSON_SCALE).setOrigin(0.5, 0.69).play(key);
}

/** Face toward or away from the camera depending on which way the person is heading. */
export function facePerson(sp: Phaser.GameObjects.Sprite, dx: number, dy: number) {
  const key = sp.texture.key;
  const want = dy < -Math.abs(dx) * 0.6 ? `${key}_back` : key;
  if (sp.anims.currentAnim?.key !== want) sp.play(want);
  sp.setFlipX(dx < 0);
}
