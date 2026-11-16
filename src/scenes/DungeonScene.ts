import Phaser from 'phaser';
import { ITEMS, ItemId, RULES } from '../econ';
import { S, hooks, log, save } from '../state';
import { btn, card, floatAt, floatLayer, h, icon, place, setHud, setModal, setSheet } from '../ui';
import { axis, buildControls, consume, press, resetInput } from '../input';
import { music, sfx } from '../audio';

type Kind = 'bot' | 'drone' | 'slime' | 'guardian';

interface Enemy {
  kind: Kind;
  sp: Phaser.GameObjects.Sprite;
  sh: Phaser.GameObjects.Image;
  x: number;
  y: number;
  hp: number;
  r: number;
  t: number;
  st: string;
  dx: number;
  dy: number;
  kx: number;
  ky: number;
  flash: number;
  small?: boolean;
  gel?: boolean;
}

interface Pickup {
  id: ItemId;
  sp: Phaser.GameObjects.Image;
  x: number;
  y: number;
  ready: boolean;
  asked: boolean;
}

interface Bullet {
  sp: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const B = { x0: 34, x1: 326, y0: 88, y1: 594 };
const ROOMS: { name: string; spawns: [Kind, number, number][]; chest: ItemId[] }[] = [
  { name: 'Room 1 · Scrap Bots', spawns: [['bot', 110, 200], ['bot', 250, 200]], chest: ['lens'] },
  { name: 'Room 2 · The Server Floor', spawns: [['bot', 80, 220], ['bot', 280, 220], ['drone', 180, 130], ['slime', 180, 300]], chest: ['lens'] },
  { name: 'Room 3 · Vault Guardian', spawns: [['guardian', 180, 200]], chest: ['lens', 'cell'] },
];
const STATS: Record<Kind, { hp: number; r: number }> = {
  bot: { hp: 3, r: 12 }, drone: { hp: 2, r: 10 }, slime: { hp: 4, r: 12 }, guardian: { hp: 12, r: 22 },
};
const DROPS: Partial<Record<Kind, ItemId>> = { bot: 'gear', drone: 'cell', guardian: 'core' };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class DungeonScene extends Phaser.Scene {
  private room = 0;
  private cleared = 0;
  private bag: ItemId[] = [];
  private hp = RULES.hearts;
  private paused = false;
  private ended = false;
  private bg!: Phaser.GameObjects.Image;
  private gfx!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private p = { x: 180, y: 520, fx: 0, fy: -1, atk: 0, combo: 0, comboT: 0, roll: 0, rollCd: 0, inv: 0, rdx: 0, rdy: 0, kx: 0, ky: 0 };
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private bullets: Bullet[] = [];
  private chest: { sp: Phaser.GameObjects.Image; open: boolean } | null = null;
  private choice?: HTMLElement;
  private bossMax = STATS.guardian.hp;

  constructor() {
    super('dungeon');
  }

  create() {
    music('dungeon');
    this.room = 0;
    this.cleared = 0;
    this.bag = [];
    this.hp = RULES.hearts;
    this.paused = this.ended = false;
    this.enemies = [];
    this.pickups = [];
    this.bullets = [];
    this.chest = null;
    resetInput();

    this.cameras.main.setZoom(2).centerOn(180, 320);
    this.bg = this.add.image(0, 0, 'dungeon_bg_0').setOrigin(0).setScale(0.5).setDepth(-10);
    this.gfx = this.add.graphics().setDepth(-5);
    this.shadow = this.add.image(0, 0, 'shadow').setScale(0.5);
    this.hero = this.add.sprite(180, 520, `av_${S.avatar}`, 0).setScale(0.6);
    this.input.on('pointerdown', () => press('attack'));
    setSheet(buildControls());
    this.events.once('shutdown', () => {
      this.choice?.remove();
      setSheet(null);
    });
    this.enterRoom(0);
    log('run_start', { day: S.day });
  }

  // ---- rooms ----

  private enterRoom(i: number) {
    this.room = i;
    this.bg.setTexture(`dungeon_bg_${i}`);
    this.pickups.forEach((k) => k.sp.destroy());
    this.bullets.forEach((k) => k.sp.destroy());
    this.pickups = [];
    this.bullets = [];
    this.chest?.sp.destroy();
    this.chest = null;
    this.choice?.remove();
    Object.assign(this.p, { x: 180, y: 520, fx: 0, fy: -1, atk: 0, roll: 0, kx: 0, ky: 0, inv: 0.6 });
    for (const [kind, x, y] of ROOMS[i].spawns) this.spawn(kind, x, y);
    floatAt(180, 330, ROOMS[i].name, 'banner dark', 1800);
    this.renderHud();
  }

  private spawn(kind: Kind, x: number, y: number, small = false): Enemy {
    const sp = this.add.sprite(x, y, `${kind}_0`).play(kind);
    if (small) sp.setScale(0.65);
    const sh = this.add.image(x, y, 'shadow').setScale(kind === 'guardian' ? 1 : small ? 0.35 : 0.55);
    const e: Enemy = { kind, sp, sh, x, y, hp: STATS[kind].hp, r: small ? 8 : STATS[kind].r, t: -rnd(0.3, 0.9), st: 'idle', dx: 0, dy: 1, kx: 0, ky: 0, flash: 0, small };
    this.enemies.push(e);
    return e;
  }

  private roomCleared() {
    this.cleared++;
    S.xp += RULES.xpRoom;
    save();
    sfx('deal');
    log('room_cleared', { room: this.room + 1, hearts: this.hp });
    floatAt(180, 150, `Room clear! +${RULES.xpRoom} XP`, 'banner dark', 1600);
    const sp = this.add.image(180, 260, 'chest_0').setDepth(200);
    this.tweens.add({ targets: sp, scale: { from: 0, to: 1 }, duration: 300, ease: 'Back.out' });
    this.chest = { sp, open: false };
    floatAt(180, 236, 'Open the chest', 'hint', 2500);
  }

  private openChest() {
    const c = this.chest!;
    c.open = true;
    c.sp.setTexture('chest_1');
    sfx('chest');
    ROOMS[this.room].chest.forEach((id, i, arr) => this.drop(id, 180, 260, 180 + (i - (arr.length - 1) / 2) * 44, 308));
    const last = this.room === ROOMS.length - 1;
    this.choice = h('div', { class: 'choice' },
      btn(last ? 'Leave with your loot ▶' : 'Leave with loot', () => this.endRun(false), last ? 'primary' : ''),
      !last && btn('Go deeper ▶', () => { sfx('tap'); this.enterRoom(this.room + 1); }, 'primary'),
    );
    floatLayer.append(this.choice);
  }

  private drop(id: ItemId, fx: number, fy: number, tx: number, ty: number) {
    tx = Phaser.Math.Clamp(tx, B.x0 + 8, B.x1 - 8);
    ty = Phaser.Math.Clamp(ty, B.y0 + 8, B.y1 - 8);
    const sp = this.add.image(fx, fy, `item_${id}`).setScale(0.75);
    const k: Pickup = { id, sp, x: tx, y: ty, ready: false, asked: false };
    this.pickups.push(k);
    this.tweens.add({ targets: sp, x: tx, duration: 380 });
    this.tweens.add({ targets: sp, y: { from: fy, to: ty }, duration: 380, ease: 'Bounce.out', onComplete: () => (k.ready = true) });
  }

  // ---- HUD ----

  private renderHud() {
    const hearts = h('div', { class: 'hearts', 'aria-label': `${this.hp} of ${RULES.hearts} hearts` });
    for (let i = 0; i < RULES.hearts; i++) hearts.append(icon(i < this.hp ? 'heart' : 'heart_empty', 'ico s'));
    const bag = h('div', { class: 'bag', 'aria-label': `Loot bag ${this.bag.length} of ${RULES.bagSlots}` });
    for (let i = 0; i < RULES.bagSlots; i++) bag.append(h('span', { class: 'slot' }, this.bag[i] ? icon(`item_${this.bag[i]}`, 'ico s') : null));
    const boss = this.enemies.find((e) => e.kind === 'guardian');
    setHud(h('div', { class: 'dhud' },
      h('div', { class: 'drow' }, hearts, h('span', { class: 'roomno' }, `Room ${this.room + 1}/3`)),
      h('div', { class: 'drow' }, h('small', {}, `Bag ${this.bag.length}/${RULES.bagSlots}`), bag),
      boss ? h('div', { class: 'boss' }, h('small', {}, `Vault Guardian ${boss.hp}/${this.bossMax}`), h('div', { class: 'bar' }, h('i', { style: `width:${(boss.hp / this.bossMax) * 100}%` }))) : null,
    ));
  }

  // ---- loop ----

  update(_: number, dms: number) {
    if (this.paused || this.ended) return;
    const dt = Math.min(dms, 50) / 1000;
    this.gfx.clear();
    this.updPlayer(dt);
    for (const e of [...this.enemies]) this.updEnemy(e, dt);
    this.updBullets(dt);
    this.updPickups();
    if (this.chest && !this.chest.open && Math.hypot(this.p.x - 180, this.p.y - 260) < 30) this.openChest();
  }

  private updPlayer(dt: number) {
    const p = this.p;
    const a = axis();
    const moving = Math.hypot(a.x, a.y) > 0.1;
    p.atk -= dt; p.comboT -= dt; p.rollCd -= dt; p.inv -= dt;

    if (p.roll > 0) {
      p.roll -= dt;
      p.x += p.rdx * 290 * dt;
      p.y += p.rdy * 290 * dt;
    } else {
      const sp = p.atk > 0 ? 50 : 125;
      p.x += a.x * sp * dt;
      p.y += a.y * sp * dt;
      if (moving) {
        const m = Math.hypot(a.x, a.y);
        p.fx = a.x / m;
        p.fy = a.y / m;
      }
    }
    p.x += p.kx * dt;
    p.y += p.ky * dt;
    const decay = Math.pow(0.002, dt);
    p.kx *= decay;
    p.ky *= decay;

    if (consume('dodge') && p.rollCd <= 0 && p.roll <= 0) {
      p.roll = 0.26;
      p.rollCd = 0.7;
      p.rdx = p.fx;
      p.rdy = p.fy;
      sfx('roll');
    }
    if (consume('attack') && p.atk <= 0 && p.roll <= 0) this.attack();

    p.x = Phaser.Math.Clamp(p.x, B.x0, B.x1);
    p.y = Phaser.Math.Clamp(p.y, B.y0, B.y1);
    // the avatar sheet has 8 facing rows (0 = toward the camera, turning clockwise) x 6 walk frames
    const dir = (Math.round(Math.atan2(-p.fx, p.fy) / (Math.PI / 4)) + 8) % 8;
    const step = moving && p.roll <= 0 ? Math.floor(this.time.now / 90) % 6 : 0;
    this.hero.setFrame(dir * 6 + step).setPosition(p.x, p.y - 20).setDepth(p.y);
    this.hero.setAngle(p.roll > 0 ? (1 - p.roll / 0.26) * 360 * (p.fx < 0 ? -1 : 1) : 0);
    this.hero.setAlpha(p.inv > 0 && p.roll <= 0 ? 0.55 : 1);
    this.shadow.setPosition(p.x, p.y + 6).setDepth(p.y - 1);
  }

  private attack() {
    const p = this.p;
    p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
    p.comboT = 0.6;
    p.atk = 0.2;
    // aim assist: face the nearest enemy in reach
    let best: Enemy | null = null;
    let bd = 78;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
      p.fx = (best.x - p.x) / d;
      p.fy = (best.y - p.y) / d;
    }
    const heavy = p.combo === 3;
    const range = heavy ? 54 : 44;
    const dmg = 1 + (S.upgrades.wrench ? 1 : 0) + (heavy ? 1 : 0);
    sfx('swing');
    p.kx += p.fx * 60;
    p.ky += p.fy * 60;
    const slash = this.add.image(p.x + p.fx * 16, p.y - 12 + p.fy * 16, 'slash').setDepth(999).setRotation(Math.atan2(p.fy, p.fx)).setScale(heavy ? 1.25 : 0.9);
    if (heavy) slash.setTint(0xffe14d);
    this.tweens.add({ targets: slash, alpha: 0, duration: 170, onComplete: () => slash.destroy() });
    for (const e of [...this.enemies]) {
      const ex = e.x - p.x;
      const ey = e.y - p.y;
      const d = Math.hypot(ex, ey) || 1;
      if (d - e.r < range && (ex * p.fx + ey * p.fy) / d > (heavy ? -0.3 : 0.15)) this.hitEnemy(e, dmg, ex / d, ey / d, heavy);
    }
  }

  private hitEnemy(e: Enemy, dmg: number, nx: number, ny: number, heavy: boolean) {
    e.hp -= dmg;
    e.flash = 0.1;
    e.sp.setTintFill(0xffffff);
    const k = (e.kind === 'guardian' ? 40 : 170) * (heavy ? 1.5 : 1);
    e.kx = nx * k;
    e.ky = ny * k;
    sfx('hit');
    floatAt(e.x, e.y - 26, `-${dmg}`, 'dmg', 600);

    if (e.kind === 'slime' && !e.small) {
      // the big slime splits into two small ones on the first hit
      this.remove(e);
      this.puff(e.x, e.y, 0xc63fd9);
      const left = Math.max(1, 2 - (dmg - 1));
      const a = this.spawn('slime', e.x - 16, e.y, true);
      const b = this.spawn('slime', e.x + 16, e.y, true);
      a.hp = b.hp = left;
      a.kx = -140; b.kx = 140;
      a.t = b.t = -0.4;
      b.gel = true;
      return;
    }
    if (e.hp <= 0) {
      this.remove(e);
      this.puff(e.x, e.y, e.kind === 'slime' ? 0xc63fd9 : 0x9aa7b8);
      const drop = e.kind === 'slime' ? (e.gel ? 'gel' : null) : DROPS[e.kind];
      if (drop) this.drop(drop, e.x, e.y, e.x + rnd(-10, 10), e.y + 14);
      if (e.kind === 'guardian') this.cameras.main.shake(200, 0.008);
      if (!this.enemies.length) this.roomCleared();
    }
    if (e.kind === 'guardian') this.renderHud();
  }

  private remove(e: Enemy) {
    e.sp.destroy();
    e.sh.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  private puff(x: number, y: number, tint: number) {
    for (let i = 0; i < 8; i++) {
      const s = this.add.image(x, y, 'spark').setTint(tint).setDepth(998).setScale(rnd(1, 2));
      const a = (i / 8) * Math.PI * 2;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26, alpha: 0, duration: 320, onComplete: () => s.destroy() });
    }
  }

  private hurt(fromX: number, fromY: number) {
    const p = this.p;
    if (p.inv > 0 || p.roll > 0 || this.ended) return;
    this.hp--;
    p.inv = 1;
    const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
    p.kx = ((p.x - fromX) / d) * 220;
    p.ky = ((p.y - fromY) / d) * 220;
    sfx('hurt');
    this.cameras.main.shake(120, 0.006);
    this.renderHud();
    if (this.hp <= 0) this.endRun(true);
  }

  private updEnemy(e: Enemy, dt: number) {
    const p = this.p;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const go = (vx: number, vy: number, sp: number) => { e.x += vx * sp * dt; e.y += vy * sp * dt; };
    e.t += dt;
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    const decay = Math.pow(0.002, dt);
    e.kx *= decay;
    e.ky *= decay;
    if (e.flash > 0 && (e.flash -= dt) <= 0) e.sp.clearTint();
    const g = this.gfx;

    if (e.kind === 'bot') {
      if (e.st === 'idle') {
        if (e.t > 0) go(nx, ny, 46);
        if (d < 36 && e.t > 0) { e.st = 'wind'; e.t = 0; }
      } else if (e.st === 'wind') {
        g.fillStyle(0xff5470, 0.18).fillCircle(e.x, e.y, 44);
        g.lineStyle(2, 0xff5470, 0.9).strokeCircle(e.x, e.y, 44 * Math.min(1, e.t / 0.55));
        if (e.t > 0.55) {
          if (d < 46) this.hurt(e.x, e.y);
          e.st = 'rest'; e.t = 0;
        }
      } else if (e.t > 0.9) { e.st = 'idle'; e.t = 0; }
    } else if (e.kind === 'drone') {
      if (e.st === 'idle') {
        if (d < 110) go(-nx, -ny, 60);
        else if (d > 165) go(nx, ny, 50);
        go(-ny, nx, 28 * Math.sin(this.time.now / 700));
        if (e.t > 2.2) { e.st = 'aim'; e.t = 0; }
      } else {
        if (e.t < 0.45) { e.dx = nx; e.dy = ny; }
        g.lineStyle(2, 0xffe14d, 0.75).lineBetween(e.x, e.y, e.x + e.dx * 320, e.y + e.dy * 320);
        if (e.t > 0.8) {
          this.bullets.push({ sp: this.add.image(e.x, e.y, 'bullet').setDepth(997), x: e.x, y: e.y, vx: e.dx * 210, vy: e.dy * 210 });
          sfx('swing');
          e.st = 'idle'; e.t = 0;
        }
      }
    } else if (e.kind === 'slime') {
      if (e.st === 'idle') {
        if (e.t > (e.small ? 0.6 : 0.9)) { e.st = 'hop'; e.t = 0; e.dx = nx; e.dy = ny; }
      } else {
        go(e.dx, e.dy, e.small ? 125 : 100);
        if (e.t > 0.35) { e.st = 'idle'; e.t = 0; }
      }
      if (d < e.r + 9) this.hurt(e.x, e.y);
    } else {
      // Vault Guardian: a charge and a ground slam, each with a clear wind-up
      if (e.st === 'idle') {
        if (e.t > 0) go(nx, ny, 28);
        if (e.t > 1.1) { e.st = d < 95 ? 'slamW' : 'chargeW'; e.t = 0; e.dx = nx; e.dy = ny; }
      } else if (e.st === 'chargeW') {
        if (e.t < 0.6) { e.dx = nx; e.dy = ny; }
        g.lineStyle(26, 0xff5470, 0.22).lineBetween(e.x, e.y, e.x + e.dx * 400, e.y + e.dy * 400);
        g.lineStyle(2, 0xff5470, 0.9).lineBetween(e.x, e.y, e.x + e.dx * 400, e.y + e.dy * 400);
        if (e.t > 0.9) { e.st = 'charge'; e.t = 0; }
      } else if (e.st === 'charge') {
        go(e.dx, e.dy, 330);
        if (d < e.r + 12) this.hurt(e.x, e.y);
        const wall = e.x < B.x0 + e.r || e.x > B.x1 - e.r || e.y < B.y0 + e.r || e.y > B.y1 - e.r;
        if (wall || e.t > 0.8) {
          if (wall) this.cameras.main.shake(140, 0.006);
          e.st = 'stun'; e.t = 0;
        }
      } else if (e.st === 'stun') {
        if (e.t > 1.2) { e.st = 'idle'; e.t = 0; }
      } else if (e.st === 'slamW') {
        g.fillStyle(0xff5470, 0.16).fillCircle(e.x, e.y, 80);
        g.lineStyle(2, 0xff5470, 0.9).strokeCircle(e.x, e.y, 80);
        g.lineStyle(2, 0xffe14d, 0.9).strokeCircle(e.x, e.y, 80 * Math.min(1, e.t / 0.9));
        if (e.t > 0.9) {
          if (d < 80) this.hurt(e.x, e.y);
          this.cameras.main.shake(160, 0.008);
          sfx('hit');
          e.st = 'rest'; e.t = 0;
        }
      } else if (e.t > 0.8) { e.st = 'idle'; e.t = 0; }
    }

    // keep enemies apart and inside the room
    for (const o of this.enemies) {
      if (o === e) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = Math.hypot(ox, oy) || 1;
      const min = e.r + o.r;
      if (od < min) { e.x += (ox / od) * (min - od) * 0.5; e.y += (oy / od) * (min - od) * 0.5; }
    }
    e.x = Phaser.Math.Clamp(e.x, B.x0 + e.r - 8, B.x1 - e.r + 8);
    e.y = Phaser.Math.Clamp(e.y, B.y0 + e.r - 8, B.y1 - e.r + 8);
    e.sp.setPosition(e.x, e.y - (e.kind === 'drone' ? 14 : 6)).setDepth(e.y).setFlipX(dx < 0);
    e.sh.setPosition(e.x, e.y + (e.kind === 'guardian' ? 20 : 9)).setDepth(e.y - 1);
    if (e.kind === 'guardian') e.sp.setAngle(e.st === 'stun' ? Math.sin(this.time.now / 90) * 6 : 0);
  }

  private updBullets(dt: number) {
    for (const b of [...this.bullets]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.sp.setPosition(b.x, b.y);
      const hit = Math.hypot(b.x - this.p.x, b.y - this.p.y) < 12;
      if (hit) this.hurt(b.x - b.vx, b.y - b.vy);
      if (hit || b.x < B.x0 - 10 || b.x > B.x1 + 10 || b.y < B.y0 - 10 || b.y > B.y1 + 10) {
        b.sp.destroy();
        this.bullets.splice(this.bullets.indexOf(b), 1);
      }
    }
  }

  private updPickups() {
    for (const k of [...this.pickups]) {
      k.sp.setDepth(k.y - 2);
      const d = Math.hypot(k.x - this.p.x, k.y - this.p.y);
      if (d > 38) k.asked = false;
      if (!k.ready || d > 20) continue;
      if (this.bag.length < RULES.bagSlots) {
        this.bag.push(k.id);
        this.takePickup(k);
        sfx('coin');
        floatAt(k.x, k.y - 20, `+ ${ITEMS[k.id].name}`, 'gain', 900);
        this.renderHud();
      } else if (!k.asked) {
        k.asked = true;
        this.swapPrompt(k);
      }
    }
  }

  private takePickup(k: Pickup) {
    k.sp.destroy();
    this.pickups.splice(this.pickups.indexOf(k), 1);
  }

  /** A full bag forces a choice about what to keep. */
  private swapPrompt(k: Pickup) {
    this.paused = true;
    resetInput();
    const close = () => {
      this.paused = false;
      resetInput();
      setModal(null);
    };
    const opts = this.bag.map((id, i) =>
      btn([icon(`item_${id}`, 'ico s'), h('span', {}, ITEMS[id].name), h('small', {}, ITEMS[id].rarity)], () => {
        const old = this.bag[i];
        this.bag[i] = k.id;
        const { x, y } = k;
        this.takePickup(k);
        const sp = this.add.image(x, y, `item_${old}`).setScale(0.75);
        this.pickups.push({ id: old, sp, x, y, ready: true, asked: true });
        sfx('tap');
        this.renderHud();
        close();
      }, 'swap'));
    setModal(card('Bag full',
      h('p', {}, 'You found a ', h('b', {}, ITEMS[k.id].name), ` (${ITEMS[k.id].rarity}). Tap an item to drop it and make room.`),
      h('div', { class: 'swapgrid' }, ...opts),
      btn(`Leave the ${ITEMS[k.id].name}`, close)));
  }

  // ---- end of run ----

  private endRun(defeated: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.choice?.remove();
    const lost: ItemId[] = [];
    if (defeated) {
      // defeated: keep half the bag, rounded down
      const keep = Math.floor(this.bag.length / 2);
      while (this.bag.length > keep) lost.push(...this.bag.splice(Math.floor(Math.random() * this.bag.length), 1));
    }
    log('run_end', { rooms: this.cleared, defeated, bag: this.bag, hearts: this.hp });
    this.time.delayedCall(defeated ? 700 : 150, () => hooks.runEnded({ bag: this.bag, lost, rooms: this.cleared, defeated }));
  }
}
