// The companion: a lucky cat or a shiba. It trails the shopkeeper everywhere and,
// in the dungeon, darts at enemies. Sprites are rendered from the 3D models
// (8 facing directions); it hops along rather than walking.

import Phaser from 'phaser';
import { S } from './state';

export const PET_INFO = {
  cat: { label: 'Lucky Cat', blurb: 'A beckoning cat. Good for business.', name: 'Mochi' },
  dog: { label: 'Shiba', blurb: 'Black and tan. Loyal and nosy.', name: 'Kuro' },
} as const;

export class Pet {
  readonly sp: Phaser.GameObjects.Sprite;
  private sh: Phaser.GameObjects.Image;
  x: number;
  y: number;
  private fx = 0;
  private fy = 1;
  private hop = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.sh = scene.add.image(x, y, 'shadow').setScale(0.4);
    this.sp = scene.add.sprite(x, y, `pet_${S.pet!.kind}`, 0).setScale(0.46);
    this.draw(false);
  }

  /** Create one only if the player has a companion. */
  static maybe(scene: Phaser.Scene, x: number, y: number): Pet | null {
    return S.pet ? new Pet(scene, x, y) : null;
  }

  /** Trail a little behind whoever it follows. */
  follow(dt: number, tx: number, ty: number, facingX: number, facingY: number) {
    this.moveTo(dt, tx - facingX * 24 + facingY * 10, ty - facingY * 20 + 4, 175, 7);
  }

  /** Move toward a point; returns true once it is there. */
  moveTo(dt: number, tx: number, ty: number, speed: number, stop = 4): boolean {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const moving = d > stop;
    if (moving) {
      const step = Math.min(d, Math.min(speed, d * 5 + 30) * dt);
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.fx = dx / d;
      this.fy = dy / d;
    }
    this.draw(moving);
    return !moving;
  }

  setVisible(v: boolean) {
    this.sp.setVisible(v);
    this.sh.setVisible(v);
  }

  private draw(moving: boolean) {
    this.hop = moving ? this.hop + this.scene.game.loop.delta / 1000 : 0;
    const lift = moving ? Math.abs(Math.sin(this.hop * 11)) * 5 : 0;
    const dir = (Math.round(Math.atan2(-this.fx, this.fy) / (Math.PI / 4)) + 8) % 8;
    this.sp.setFrame(dir).setPosition(this.x, this.y - 12 - lift).setDepth(this.y);
    this.sh.setPosition(this.x, this.y + 3).setDepth(this.y - 1).setScale(0.4 - lift * 0.012);
  }

  destroy() {
    this.sp.destroy();
    this.sh.destroy();
  }
}
