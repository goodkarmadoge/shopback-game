import Phaser from 'phaser';
import { S, hooks, log, save } from '../state';
import { btn, card, floatLayer, h, place, setModal, setSheet, toast } from '../ui';
import { axis, buildControls, resetInput } from '../input';
import { BRAND } from '../panels';
import { music, sfx } from '../audio';
import { CITY_H } from '../scenery';
import { Pet } from '../pet';
import { person } from '../sprites';
import { INTRO } from '../levels';

/** Local businesses the shopkeeper can partner with. Names are invented. */
export const PARTNERS = [
  { id: 'kopi', name: 'Ah Seng Kopi', what: 'Coffee stall', house: 'pink', x: 45 },
  { id: 'tailor', name: 'Lucky Tailor', what: 'Tailor', house: 'peach', x: 225 },
  { id: 'books', name: 'Bayside Books', what: 'Bookshop', house: 'blue', x: 315 },
] as const;
export const PARTNER_BONUS = 2;

/** Sprites rendered from the 3D city models; loaded by the boot scene. */
export const CITY_SPRITES = [
  'shophouse_pink', 'shophouse_mint', 'shophouse_peach', 'shophouse_blue', 'hdb_a', 'office_a', 'palm', 'round_tree',
  'bush', 'flowers', 'lamp', 'crate', 'barrel', 'traffic_cone', 'merlion', 'mbs', 'supertree',
];

interface Spot {
  x: number;
  y: number;
  r: number;
  label: string;
  act: () => void;
}

const SHOP_X = 135;
const HOUSE_BASE = 468;

export class CityScene extends Phaser.Scene {
  private p = { x: SHOP_X, y: 492, fx: 0, fy: 1 };
  private hero!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private solids: { x: number; y: number; w: number; h: number }[] = [];
  private spots: Spot[] = [];
  private near: Spot | null = null;
  private promptEl!: HTMLElement;
  private labels: { el: HTMLElement; x: number; y: number }[] = [];
  private busy = false;
  private pet: Pet | null = null;

  constructor() {
    super('city');
  }

  private idle = false;
  /** Evening is the walk to the dungeon; night is after the run, when everything is shut. */
  private when: 'day' | 'evening' | 'night' = 'evening';

  init(data: { idle?: boolean; time?: 'evening' | 'night' }) {
    this.idle = !!data.idle;
    this.when = this.idle ? 'day' : data.time ?? 'evening';
  }

  create() {
    music('shop');
    resetInput();
    this.solids = [];
    this.spots = [];
    this.labels = [];
    this.near = null;
    this.busy = false;
    this.p = { x: SHOP_X, y: 492, fx: 0, fy: 1 };

    this.add.image(0, 0, 'city_bg').setOrigin(0).setScale(0.5).setDepth(-10);
    const prop = (key: string, x: number, baseY: number, solid?: [number, number], shade = 0) => {
      const img = this.add.image(x, baseY, `city_${key}`).setOrigin(0.5, 1).setScale(0.5).setDepth(baseY);
      if (shade) this.add.image(x, baseY - 2, 'shadow').setScale(shade, shade * 0.5).setDepth(baseY - 1).setAlpha(0.8);
      if (solid) this.solids.push({ x: x - solid[0] / 2, y: baseY - solid[1], w: solid[0], h: solid[1] });
      return img;
    };

    // skyline and waterfront plaza
    prop('mbs', 180, 196).setDepth(-5);
    prop('supertree', 34, 232, [16, 12], 1.2);
    prop('supertree', 326, 232, [16, 12], 1.2);
    prop('merlion', 180, 300, [50, 34], 1.6);
    prop('palm', 78, 306, [10, 8], 1.1);
    prop('palm', 282, 306, [10, 8], 1.1);
    prop('flowers', 126, 300);
    prop('flowers', 234, 300);
    this.solids.push({ x: 0, y: 0, w: 360, h: 184 });

    // shophouse row
    const houses: [string, number][] = [['pink', 45], ['mint', SHOP_X], ['peach', 225], ['blue', 315]];
    for (const [colour, x] of houses) prop(`shophouse_${colour}`, x, HOUSE_BASE, [84, 124]);
    for (const x of [90, 180, 270]) prop('lamp', x, 474, [6, 5], 0.5);

    // park and the way down to the dungeon
    prop('round_tree', 50, 640, [14, 10], 1.3);
    prop('round_tree', 300, 620, [14, 10], 1.3);
    prop('round_tree', 262, 716, [14, 10], 1.3);
    prop('round_tree', 70, 760, [14, 10], 1.3);
    prop('bush', 320, 700, [30, 12], 0.9);
    prop('bush', 30, 690, [30, 12], 0.9);
    prop('flowers', 230, 600);
    prop('flowers', 96, 596);
    prop('flowers', 312, 770);
    prop('crate', 250, 838, [24, 16], 0.8);
    prop('barrel', 276, 846, [18, 12], 0.7);
    prop('traffic_cone', 116, 800, undefined, 0.5);
    prop('traffic_cone', 246, 800, undefined, 0.5);
    prop('hdb_a', 6, CITY_H + 10, [150, 60]);
    prop('office_a', 356, CITY_H + 14, [90, 60]);

    if (this.idle) {
      // backdrop for the welcome screen: both shopkeepers outside the shop, camera drifting over the city
      for (const [a, x] of [['male', 118], ['female', 152]] as const) {
        this.add.image(x, 497, 'shadow').setScale(0.5).setDepth(490);
        this.add.sprite(x, 472, `av_${a}`, 0).setScale(0.6).setDepth(492);
      }
      const cam = this.cameras.main;
      cam.setZoom(2);
      cam.setBounds(0, 0, 360, CITY_H);
      cam.setScroll(-180, -250);
      this.tweens.add({ targets: cam, scrollY: -90, duration: 9000, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
      cam.fadeIn(500);
      this.time.addEvent({ delay: 1500, loop: true, callback: () => this.pedestrian() });
      for (let i = 0; i < 6; i++) this.pedestrian(Math.random() * 360);
      return;
    }

    // the sun is down: dusk on the way to the dungeon, full night once the run is over
    const night = this.when === 'night';
    this.add.rectangle(180, CITY_H / 2, 360, CITY_H, night ? 0x070b2e : 0x2b1d5c, night ? 0.66 : 0.4).setDepth(4000);
    if (!night) this.add.rectangle(180, CITY_H / 2, 360, CITY_H, 0xff7a3c, 0.12).setDepth(4000);
    const glow = (x: number, y: number, sc: number, tint: number, a = 0.6) => this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(a).setScale(sc).setDepth(4001);
    for (const x of [90, 180, 270]) glow(x, 446, 1.5, 0xffd27a);
    glow(SHOP_X, 420, 1.3, 0xffc46b, night ? 0.6 : 0.4);
    if (!night) for (const pt of PARTNERS) glow(pt.x, 420, 1.2, 0xffc46b, 0.35);
    glow(180, 770, night ? 1.4 : 2, night ? 0xff5470 : 0x35e0ff, 0.45);
    if (night) this.add.image(180, 800, 'gate_locked').setOrigin(0.5, 1).setScale(0.36).setDepth(800);

    // things to do
    this.spots.push(night
      ? { x: SHOP_X, y: 480, r: 26, label: 'Go back inside', act: () => { this.busy = true; hooks.cityHome(); } }
      : { x: SHOP_X, y: 480, r: 26, label: 'Your shop', act: () => toast('Closed for the evening. Stock up in the dungeon first.') });
    for (const pt of PARTNERS) {
      this.spots.push(night
        ? { x: pt.x, y: 480, r: 26, label: `${pt.name} · closed`, act: () => toast(`${pt.name} is closed. Come back tomorrow!`) }
        : { x: pt.x, y: 480, r: 26, label: S.partners.includes(pt.id) ? `${pt.name} · partner` : `Visit ${pt.name}`, act: () => this.visit(pt) });
      this.label(pt.name, pt.x, 342, S.partners.includes(pt.id));
    }
    this.label('Your shop', SHOP_X, 342, true);
    this.spots.push({ x: 180, y: 300, r: 44, label: 'The Merlion', act: () => toast('The Merlion keeps watch over the bay.') });
    const rooms = S.dungeonLevel >= INTRO.length ? 4 : INTRO[S.dungeonLevel].rooms.length;
    this.spots.push(night
      ? { x: 180, y: 806, r: 40, label: '🔒 Techno Dungeon · closed', act: () => toast('The Techno Dungeon is closed. Come back tomorrow!') }
      : { x: 180, y: 792, r: 40, label: S.dungeonLevel >= INTRO.length ? `Enter the Daily Dungeon · ${rooms} rooms ▶` : `Enter the dungeon · Level ${S.dungeonLevel + 1} · ${rooms} room${rooms > 1 ? 's' : ''} ▶`, act: () => this.leave() });
    this.label(night ? 'Techno Dungeon · closed' : 'Techno Dungeon', 180, 776, !night);

    this.shadow = this.add.image(0, 0, 'shadow').setScale(0.5);
    this.hero = this.add.sprite(0, 0, `av_${S.avatar}`, 0).setScale(0.6);
    this.pet = Pet.maybe(this, this.p.x - 22, this.p.y + 6);

    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.setBounds(0, 0, 360, CITY_H);
    cam.startFollow(this.hero, true, 0.15, 0.15);

    if (this.when !== 'night') {
      this.time.addEvent({ delay: 2400, loop: true, callback: () => this.pedestrian() });
      for (let i = 0; i < 4; i++) this.pedestrian(Math.random() * 360);
    }

    this.promptEl = h('div', { class: 'cityprompt' });
    setSheet(h('div', { class: 'cityui' }, this.promptEl, buildControls()));
    this.events.once('shutdown', () => {
      this.labels.forEach((l) => l.el.remove());
      setSheet(null);
    });
    if (night) this.time.delayedCall(400, () => toast('The street is quiet. Everything is shut until morning.'));
    log('city_enter', { day: S.day, time: this.when });
  }

  private label(text: string, x: number, y: number, on: boolean) {
    const el = h('div', { class: `citylabel ${on ? 'on' : ''}` }, text);
    floatLayer.append(el);
    this.labels.push({ el, x, y });
  }

  private pedestrian(startX?: number) {
    const left = Math.random() < 0.5;
    const key = ['ped_a', 'ped_b', 'cust_hunter', 'cust_rusher', 'cust_collector'][Math.floor(Math.random() * 5)];
    const y = Math.random() < 0.5 ? 478 + Math.random() * 6 : 556 + Math.random() * 8;
    const sp = person(this, startX ?? (left ? -20 : 380), y, key).setDepth(y).setFlipX(!left);
    this.tweens.add({ targets: sp, x: left ? 380 : -20, duration: 9000 + Math.random() * 5000, onComplete: () => sp.destroy() });
  }

  update(_: number, dms: number) {
    if (this.idle) return;
    const dt = Math.min(dms, 50) / 1000;
    const p = this.p;
    const a = this.busy ? { x: 0, y: 0 } : axis();
    const moving = Math.hypot(a.x, a.y) > 0.1;
    if (moving) {
      const m = Math.hypot(a.x, a.y);
      p.fx = a.x / m;
      p.fy = a.y / m;
      const nx = p.x + a.x * 130 * dt;
      const ny = p.y + a.y * 130 * dt;
      // slide along obstacles: try each axis on its own
      if (!this.blocked(nx, p.y)) p.x = nx;
      if (!this.blocked(p.x, ny)) p.y = ny;
      p.x = Phaser.Math.Clamp(p.x, 12, 348);
      p.y = Phaser.Math.Clamp(p.y, 190, CITY_H - 70);
    }
    const dir = (Math.round(Math.atan2(-p.fx, p.fy) / (Math.PI / 4)) + 8) % 8;
    this.hero.setFrame(dir * 6 + (moving ? Math.floor(this.time.now / 90) % 6 : 0)).setPosition(p.x, p.y - 20).setDepth(p.y);
    this.shadow.setPosition(p.x, p.y + 5).setDepth(p.y - 1);
    this.pet?.follow(dt, p.x, p.y, p.fx, p.fy);

    const near = this.spots.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < s.r) ?? null;
    if (near !== this.near) {
      this.near = near;
      this.promptEl.replaceChildren();
      if (near) this.promptEl.append(btn(near.label, () => { sfx('tap'); near.act(); }, 'primary'));
    }
    const view = this.cameras.main.worldView;
    for (const l of this.labels) {
      place(l.el, l.x - view.x, l.y - view.y);
      l.el.style.visibility = l.y > view.y + 40 && l.y < view.y + 640 ? 'visible' : 'hidden';
    }
  }

  private blocked(x: number, y: number) {
    return this.solids.some((s) => x > s.x - 7 && x < s.x + s.w + 7 && y > s.y - 4 && y < s.y + s.h + 4);
  }

  private visit(pt: (typeof PARTNERS)[number]) {
    this.busy = true;
    resetInput();
    const close = () => {
      this.busy = false;
      setModal(null);
    };
    const already = S.partners.includes(pt.id);
    setModal(card(pt.name,
      h('p', {}, `${pt.what} on your street.`),
      h('p', {}, already
        ? `You are partners. They tell their regulars whenever you run a ${BRAND} campaign.`
        : `Partner up and they will tell their regulars whenever you run a ${BRAND} campaign: ${PARTNER_BONUS} more campaign customers a day.`),
      !already && btn(`Partner with ${pt.name}`, () => {
        S.partners.push(pt.id);
        save();
        sfx('deal');
        log('partner', { id: pt.id });
        toast(`Partnered with ${pt.name}.`);
        const spot = this.spots.find((s) => s.x === pt.x && s.y === 480);
        if (spot) spot.label = `${pt.name} · partner`;
        this.labels.find((l) => l.x === pt.x)?.el.classList.add('on');
        this.near = null;
        close();
      }, 'primary'),
      btn(already ? 'Back to the street' : 'Not now', close, 'ghost')));
  }

  private leave() {
    if (this.busy) return;
    this.busy = true;
    log('city_exit', { partners: S.partners.length });
    hooks.cityExit();
  }
}
