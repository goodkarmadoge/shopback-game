import Phaser from 'phaser';
import {
  BASE_IDS, Barter, CTYPES, Customer, ITEMS, VIP_LIMIT, ItemId, RULES, approach, barterStep, makeCustomer, reaction, startBarter, takeForShelf,
} from '../econ';
import { S, hooks, log, save } from '../state';
import { btn, card, floatAt, floatLayer, h, icon, place, setModal, setSheet, toast } from '../ui';
import { BRAND, EMOTE, heat, pricingPanel } from '../panels';
import { axis, buildControls, consume, resetInput } from '../input';
import { music, sfx } from '../audio';
import lines from '../lines.json';
import { PARTNER_BONUS } from './CityScene';
import { Pet } from '../pet';
import { charm, lvl, preorders, shelfCount, vipCount, walkInCount } from '../upgrades';
import { PET_INFO } from '../pet';
import { promoBonus, promoFor } from '../promos';
import { COIN_SCALE, ITEM_SCALE, facePerson, person } from '../sprites';

interface Slot {
  x: number;
  y: number;
  item: ItemId | null;
  reserved: boolean;
  icon: Phaser.GameObjects.Image;
  tag: HTMLElement;
}

interface Cust {
  c: Customer;
  sp: Phaser.GameObjects.Sprite;
  sh: Phaser.GameObjects.Image;
  bubble?: HTMLElement;
}

interface Haggle {
  cu: Cust;
  item: ItemId;
  b: Barter;
  line: string;
  res: (price: number | null) => void;
  /** Set once the deal is struck or lost, while the closing animation plays. */
  done?: boolean;
  /** The player's most recent counter, which the slider stays on after a "no". */
  last?: number;
}

const DOOR = { x: 180, y: 500 };
const COUNTER = { x: 94, y: 108, w: 172, h: 46 };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function say(type: Customer['type'], kind: 'open' | 'raise' | 'deal' | 'leave', item: ItemId, offer: number) {
  return pickOne(lines[type][kind]).replace('{item}', ITEMS[item].name).replace('{offer}', String(offer));
}

export class ShopScene extends Phaser.Scene {
  private tutorial = false;
  private idle = false;
  private slots: Slot[] = [];
  private back: ItemId[] = [];
  private custs: Cust[] = [];
  private queue: Customer[] = [];
  private total = 0;
  private arrived = 0;
  private campaign = false;
  private revenue = 0;
  private cashback = 0;
  private sales = 0;
  private startStock: ItemId[] = [];
  private haggles: Haggle[] = [];
  private cur: Haggle | null = null;
  private dom: HTMLElement[] = [];
  private over = false;
  private toldRestock = false;
  // the shopkeeper, walked around the shop by the player
  private p = { x: 180, y: 104, fx: 0, fy: 1 };
  private hero!: Phaser.GameObjects.Sprite;
  private heroShadow!: Phaser.GameObjects.Image;
  // top-of-screen day UI
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private fab?: HTMLButtonElement;
  private pet: Pet | null = null;
  private preorderSales: { item: ItemId; price: number }[] = [];
  private happy = 0;
  private regularsToday = 0;
  private shopDay = 1;
  /** After hours: no customers, the shopkeeper is at home. */
  private home = false;
  private solids: { x: number; y: number; w: number; h: number }[] = [];
  private spots: { x: number; y: number; r: number; label: () => string; act: () => void }[] = [];
  private nearSpot: ShopScene['spots'][number] | null = null;
  private closeAt = 0;
  private dayLen = 1;
  private clockEl: HTMLElement | null = null;
  private hg: { sheet: HTMLElement; say: HTMLElement; hearts: HTMLElement; num: HTMLElement; word: HTMLElement; slider: HTMLInputElement; go: HTMLButtonElement; low: HTMLElement; mine: HTMLElement } | null = null;
  private promptEl: HTMLElement | null = null;
  private near: Slot | null = null;
  private picking: Slot | null = null;

  constructor() {
    super('shop');
  }

  init(data: { tutorial?: boolean; idle?: boolean; home?: boolean }) {
    this.home = !!data.home;
    this.solids = [];
    this.spots = [];
    this.nearSpot = null;
    this.clockEl = null;
    this.tutorial = !!data.tutorial;
    this.idle = !!data.idle;
    this.slots = [];
    this.custs = [];
    this.queue = [];
    this.haggles = [];
    this.cur = null;
    this.dom = [];
    this.campaign = false;
    this.over = false;
    this.toldRestock = false;
    this.revenue = this.cashback = this.sales = this.arrived = 0;
    this.p = { x: 180, y: 104, fx: 0, fy: 1 };
  }

  create() {
    music('shop');
    resetInput();
    this.cameras.main.setZoom(2).centerOn(180, 320);
    this.add.image(0, 0, 'shop_bg').setOrigin(0).setScale(0.5).setDepth(-10);
    // cosmetic upgrades change how the shop looks
    ['wood', 'carpet', 'curtains', 'lights'].forEach((id, i) => {
      if (lvl(id)) this.add.image(0, 0, `deco_${id}`).setOrigin(0).setScale(0.5).setDepth(-9.9 + i * 0.1);
    });
    this.preorderSales = [];
    this.happy = 0;
    this.shopDay = S.day;
    this.heroShadow = this.add.image(0, 0, 'shadow').setScale(0.5);
    this.hero = this.add.sprite(180, 84, `av_${S.avatar}`, 0).setScale(0.6);
    this.placeHero(false);
    this.pet = Pet.maybe(this, 150, 108);

    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.pedestrian() });
    this.pedestrian();

    this.events.once('shutdown', () => {
      this.dom.forEach((d) => d.remove());
      setSheet(null);
    });
    if (this.idle) {
      // window dressing behind menus: stocked tables and a browsing customer or two
      const wares: ItemId[] = ['core', 'lens', 'gel', 'prism'];
      [[120, 262], [240, 262], [120, 346], [240, 346]].forEach(([x, y], i) => {
        this.add.image(x, y + 7, 'table_hd').setScale(0.3).setDepth(y - 6);
        this.add.image(x, y - 12, `item_${wares[i]}`).setScale(ITEM_SCALE).setDepth(y - 5);
      });
      for (const [key, x, y] of [['cust_collector', 104, 296], ['cust_rusher', 256, 380], ['cust_hunter', 200, 440]] as const) {
        this.add.image(x, y + 14, 'shadow').setScale(0.5).setDepth(y - 1);
        person(this, x, y, key).setDepth(y);
      }
      this.cameras.main.fadeIn(500);
      return;
    }

    // shelves
    const n = shelfCount();
    const xs = n === 4 ? [120, 240] : [90, 180, 270];
    this.startStock = [...S.stock];
    this.back = [...S.stock];
    // pre-orders are collected before the doors open, at 120% of value
    for (let i = 0; i < preorders() && !this.tutorial && !this.home && this.back.length > 1; i++) {
      const item = this.back.splice(Math.floor(Math.random() * this.back.length), 1)[0];
      const price = Math.round(ITEMS[item].value * 1.2);
      S.stock.splice(S.stock.indexOf(item), 1);
      S.coins += price;
      S.xp += RULES.xpSale;
      this.revenue += price;
      this.sales++;
      this.preorderSales.push({ item, price });
      log('preorder', { item, price });
    }
    for (const y of n === 9 ? [262, 346, 430] : [262, 346]) {
      for (const x of xs) {
        this.add.image(x, y + 7, 'table_hd').setScale(0.3).setDepth(y - 6);
        const tag = h('div', { class: 'tag' });
        place(tag, x, y + 13);
        floatLayer.append(tag);
        this.dom.push(tag);
        this.slots.push({ x, y, item: null, reserved: false, icon: this.add.image(x, y - 12, 'item_gear').setScale(ITEM_SCALE).setDepth(y - 5).setVisible(false), tag });
      }
    }
    for (const s of this.slots) {
      this.stockSlot(s, false);
      // wares float a little so the shelves feel alive
      this.tweens.add({ targets: s.icon, y: s.y - 14.5, duration: rnd(800, 1100), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    this.furnish();
    if (this.home) return this.atHome();
    // day status, coach line and the campaign button live at the top of the screen
    this.statusEl = h('div', { class: 'daystrip' });
    this.coachEl = h('div', { class: 'coachtop' });
    floatLayer.append(this.statusEl, this.coachEl);
    this.dom.push(this.statusEl, this.coachEl);
    if (!this.tutorial) {
      this.fab = h('button', { class: 'fab', type: 'button', 'aria-label': `Start ${BRAND} campaign: three times the customers, and Cashback magic on every sale` },
        h('span', { class: 'bolt' }, '⚡'), h('b', {}, BRAND), h('small', {}, 'Campaign'));
      this.fab.addEventListener('click', () => this.startCampaign());
      floatLayer.append(this.fab);
      this.dom.push(this.fab);
    }
    this.coach(this.tutorial
      ? 'Customers are coming! Watch how they react to your prices.'
      : promoFor(this.shopDay) ? `${promoFor(this.shopDay)!.emoji} ${promoFor(this.shopDay)!.name}! Tap the ${BRAND} button to pull in a crowd.` : `Tap the ${BRAND} button to pull in a crowd.`);
    if (this.regularsToday) this.time.delayedCall(4000, () => this.coach(`${this.regularsToday} regular${this.regularsToday > 1 ? 's are' : ' is'} back today, thanks to yesterday’s Cashback.`));
    if (this.preorderSales.length) {
      this.coach(`Pre-order${this.preorderSales.length > 1 ? 's' : ''} collected: ${this.preorderSales.map((o) => `${ITEMS[o.item].name} for ${o.price}`).join(', ')}.`);
      hooks.hud();
    }
    this.showControls();
    this.refresh();
    void this.runDay();
  }

  update(_: number, dms: number) {
    const dt = Math.min(dms, 50) / 1000;
    this.tick();
    if (!this.idle && !this.over) this.moveHero(dt);
    if (!this.idle) this.pet?.follow(dt, this.p.x, this.p.y, this.p.fx, this.p.fy);
    for (const cu of this.custs) {
      cu.sp.setDepth(cu.sp.y);
      cu.sh.setPosition(cu.sp.x, cu.sp.y + 14).setDepth(cu.sp.y - 1);
      if (cu.bubble) place(cu.bubble, cu.sp.x, cu.sp.y - 44);
    }
    for (const s of this.slots) {
      const need = !s.item && this.back.length > 0;
      const text = s.item ? String(S.prices[s.item]) : need ? '+ Stock' : '';
      if (s.tag.textContent !== text) s.tag.textContent = text;
      s.tag.classList.toggle('off', !text);
      s.tag.classList.toggle('need', need);
      s.tag.classList.toggle('promo', !!s.item && promoBonus(this.shopDay, s.item) > 0);
    }
  }

  // ---- the shopkeeper ----

  private blocked(x: number, y: number) {
    if (x > COUNTER.x - 8 && x < COUNTER.x + COUNTER.w + 8 && y > COUNTER.y && y < COUNTER.y + COUNTER.h + 6) return true;
    if (this.solids.some((o) => x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 4 && y < o.y + o.h + 4)) return true;
    return this.slots.some((s) => Math.abs(x - s.x) < 30 && y > s.y - 12 && y < s.y + 22);
  }

  private moveHero(dt: number) {
    const p = this.p;
    const a = axis();
    const moving = Math.hypot(a.x, a.y) > 0.1;
    if (moving) {
      const m = Math.hypot(a.x, a.y);
      p.fx = a.x / m;
      p.fy = a.y / m;
      const nx = Phaser.Math.Clamp(p.x + a.x * 125 * dt, 26, 334);
      const ny = Phaser.Math.Clamp(p.y + a.y * 125 * dt, 104, 494);
      if (!this.blocked(nx, p.y)) p.x = nx;
      if (!this.blocked(p.x, ny)) p.y = ny;
    }
    this.placeHero(moving);

    // standing at a display case offers to change what is on it
    let near: Slot | null = null;
    let best = 44;
    for (const s of this.slots) {
      const d = Math.hypot(p.x - s.x, p.y - (s.y + 6));
      if (d < best) { best = d; near = s; }
    }
    const tapped = consume('attack');
    if (near !== this.near || this.promptEl?.dataset.k !== this.promptKey(near)) {
      this.near = near;
      this.paintPrompt();
    }
    // at home, furniture you can use takes priority over the display beside it
    const spot = this.spots.find((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.r) ?? null;
    if (spot !== this.nearSpot) {
      this.nearSpot = spot;
      this.paintPrompt();
    }
    if (tapped && spot) spot.act();
    else if (tapped && near && !this.cur && !this.picking) this.openPicker(near);
  }

  private promptKey(s: Slot | null) {
    return s ? `${s.item ?? ''}|${s.reserved}|${this.back.length > 0}` : '';
  }

  private paintPrompt() {
    const el = this.promptEl;
    if (!el) return;
    const s = this.near;
    el.dataset.k = this.promptKey(s);
    el.replaceChildren();
    const spot = this.nearSpot;
    if (spot) {
      el.append(btn(spot.label(), () => { sfx('tap'); spot.act(); }, 'primary'));
      return;
    }
    if (!s || (!s.item && !this.back.length)) return;
    el.append(btn(s.item ? [icon(`item_${s.item}`, 'ico s'), ' Change display'] : '+ Stock this display', () => this.openPicker(s), 'primary'));
  }

  /** Pick what goes on this display case from the stock room. */
  private openPicker(s: Slot) {
    if (s.reserved) return toast('A customer is looking at this one.');
    if (!this.back.length && !s.item) return;
    sfx('tap');
    resetInput();
    this.picking = s;
    const close = () => {
      this.picking = null;
      setModal(null);
    };
    const put = (id: ItemId | null) => {
      if (s.reserved) {
        toast('A customer got there first.');
        return close();
      }
      if (id) this.back.splice(this.back.indexOf(id), 1);
      if (s.item) this.back.push(s.item);
      s.item = id;
      s.icon.setVisible(!!id);
      if (id) {
        s.icon.setTexture(`item_${id}`);
        this.tweens.add({ targets: s.icon, scale: { from: 0.06, to: ITEM_SCALE }, duration: 260, ease: 'Back.out' });
        floatAt(s.x, s.y - 26, 'On display!', 'gain', 800);
      }
      sfx('coin');
      log('display', { item: id });
      this.refresh();
      close();
    };
    const kinds = [...new Set(this.back)].sort((a, b) => ITEMS[b].value - ITEMS[a].value);
    const wanted = new Set(this.custs.filter((cu) => cu.bubble?.classList.contains('wait')).map((cu) => cu.c.wants));
    setModal(card(s.item ? 'Change display' : 'Stock display',
      s.item ? h('p', { class: 'pickcur' }, icon(`item_${s.item}`, 'ico s'), ` Showing ${ITEMS[s.item].name}`) : null,
      kinds.length
        ? h('div', { class: 'picklist' }, ...kinds.map((id) => {
          const b = h('button', { class: `pick ${wanted.has(id) ? 'hot' : ''}`, type: 'button' },
            icon(`item_${id}`), h('b', {}, ITEMS[id].name),
            h('small', {}, `×${this.back.filter((i) => i === id).length} · ${S.prices[id]}`),
            wanted.has(id) ? h('em', {}, 'Wanted!') : null);
          b.addEventListener('click', () => put(id));
          return b;
        }))
        : h('p', {}, 'The stock room is empty.'),
      s.item ? btn('Take it off display', () => put(null), 'ghost') : null,
      btn('Cancel', close, 'ghost')));
  }

  private placeHero(moving: boolean) {
    const p = this.p;
    const dir = (Math.round(Math.atan2(-p.fx, p.fy) / (Math.PI / 4)) + 8) % 8;
    this.hero.setFrame(dir * 6 + (moving ? Math.floor(this.time.now / 90) % 6 : 0)).setPosition(p.x, p.y - 20).setDepth(p.y);
    this.heroShadow.setPosition(p.x, p.y + 5).setDepth(p.y - 1);
  }

  // ---- the business day clock ----

  /** Customers arrive on a fixed beat, so the time left follows from how many are still to come. */
  private retime(reset = false) {
    const gap = this.campaign ? 1.5 : 3.8;
    const left = this.tutorial ? 0 : this.queue.length * gap + 6;
    this.closeAt = this.time.now + left * 1000;
    if (reset) this.dayLen = Math.max(1, left);
  }

  private tick() {
    if (!this.clockEl || this.over || this.tutorial) return;
    const left = Math.max(0, (this.closeAt - this.time.now) / 1000);
    const text = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    if (this.clockEl.textContent !== text) this.clockEl.textContent = text;
    const bar = this.statusEl.querySelector<HTMLElement>('.daybar > i');
    if (bar) bar.style.width = `${Math.min(100, (left / this.dayLen) * 100)}%`;
    this.statusEl.classList.toggle('closing', left < 10);
  }

  // ---- furniture and the after-hours shop ----

  private furnish() {
    const put = (key: string, x: number, baseY: number, scale: number, solid?: [number, number], depth?: number) => {
      this.add.image(x, baseY, `room_${key}`).setOrigin(0.5, 1).setScale(scale).setDepth(depth ?? baseY);
      if (solid) this.solids.push({ x: x - solid[0] / 2, y: baseY - solid[1], w: solid[0], h: solid[1] });
    };
    if (lvl('posters')) put('posters', 54, 92, 0.36, undefined, -9.4);
    if (lvl('rug')) put('rug', 180, 226, 0.42, undefined, -9.3);
    put(lvl('bed') ? 'bed' : 'futon', 50, 234, 0.42, [38, 58]);
    put('bench', 308, 152, 0.3, [40, 30]);
    put('couch', 304, 228, 0.34, [52, 26]);
    if (lvl('lamp')) put('lamp', 344, 182, 0.42);
    if (lvl('armchair')) put('armchair', 36, 322, 0.34, [28, 22]);
    if (S.pet) put('bowl', 104, 228, 0.3);
  }

  /** Night in the shop: nothing to sell, plenty to potter about with. */
  private atHome() {
    const night = this.add.rectangle(180, 320, 360, 640, 0x0b1040, 0.52).setDepth(880);
    void night;
    for (const [x, y, sc, tint] of [[180, 96, 2.6, 0xffc46b], [304, 150, 1.4, 0xffd9a0], [344, 130, 1.6, 0xffd27a], [50, 190, 1.2, 0xffe6c0]] as const) {
      this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0.55).setScale(sc).setDepth(881);
    }
    this.statusEl = h('div', {});
    this.coachEl = h('div', { class: 'coachtop' });
    floatLayer.append(this.coachEl);
    this.dom.push(this.coachEl);
    this.coach('Closed for the night. Potter about, then head to bed.');
    const pet = S.pet;
    this.spots.push(
      { x: 50, y: 240, r: 30, label: () => '💤 Go to sleep', act: () => hooks.home('sleep') },
      { x: 304, y: 236, r: 30, label: () => '🛋️ Rest on the couch', act: () => this.rest() },
      { x: 306, y: 166, r: 28, label: () => '⬆ Upgrades', act: () => hooks.home('upgrades') },
      { x: 180, y: 104, r: 26, label: () => (S.offerSeen ? '🎁 Personal Offers' : '🎁 Personal Offers · new'), act: () => hooks.home('offers') },
      { x: 180, y: 488, r: 24, label: () => '🚪 Step outside', act: () => hooks.home('door') },
    );
    if (pet) this.spots.push({ x: 104, y: 232, r: 20, label: () => (S.petFed ? `${pet.name} is full` : `🍖 Feed ${pet.name} · 5 coins`), act: () => this.feed() });
    this.p = { x: 180, y: 190, fx: 0, fy: 1 };
    this.showControls();
  }

  private rest() {
    this.p.x = 304;
    this.p.y = 234;
    this.p.fx = 0;
    this.p.fy = 1;
    floatAt(304, 190, '♪', 'gain', 1200);
    this.coach(pickOne(['Feet up. The till is counted and the street is quiet.', 'A good day’s trade. The couch has earned its keep.', 'You could get used to this.']));
  }

  private feed() {
    const pet = S.pet;
    if (!pet || S.petFed) return;
    if (S.coins < 5) return toast('Not enough coins for pet food.');
    S.coins -= 5;
    S.petFed = true;
    save();
    hooks.hud();
    sfx('coin');
    floatAt(104, 200, '💖', 'sparkle', 1100);
    this.coach(`${pet.name} the ${PET_INFO[pet.kind].label} tucks in. +1 damage on tomorrow’s dungeon run.`);
    this.nearSpot = null;
  }

  // ---- helpers ----

  /** Customers ask for the usual items, plus any special loot that is in stock today. */
  private pool(): ItemId[] {
    return [...new Set([...BASE_IDS, ...this.startStock])];
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()));
  }

  private walk(sp: Phaser.GameObjects.Sprite, x: number, y: number, speed = 95) {
    const d = Phaser.Math.Distance.Between(sp.x, sp.y, x, y);
    facePerson(sp, x - sp.x, y - sp.y);
    return new Promise<void>((res) => this.tweens.add({ targets: sp, x, y, duration: (d / speed) * 1000, onComplete: () => res() }));
  }

  private coach(text: string) {
    this.coachEl.textContent = text;
    this.coachEl.classList.remove('pop');
    void this.coachEl.offsetWidth;
    this.coachEl.classList.add('pop');
  }

  private bubble(cu: Cust, face: string, word: string, cls = '') {
    cu.bubble?.remove();
    cu.bubble = h('div', { class: `bubble ${cls}` }, h('span', { class: 'face' }, face), word);
    place(cu.bubble, cu.sp.x, cu.sp.y - 44);
    floatLayer.append(cu.bubble);
    this.dom.push(cu.bubble);
  }

  private stockSlot(s: Slot, pop = true) {
    const shelf = this.slots.map((x) => x.item);
    s.item = takeForShelf(shelf, this.back);
    s.icon.setVisible(!!s.item);
    if (s.item) {
      s.icon.setTexture(`item_${s.item}`);
      if (pop) this.tweens.add({ targets: s.icon, scale: { from: 0.06, to: ITEM_SCALE }, duration: 260, ease: 'Back.out' });
    }
  }

  private pedestrian(y = rnd(556, 624)) {
    const left = Math.random() < 0.5;
    const key = pickOne(['ped_a', 'ped_b', 'cust_hunter', 'cust_rusher', 'cust_collector']);
    const sp = person(this, left ? -20 : 380, y, key).setDepth(y).setFlipX(!left);
    this.tweens.add({ targets: sp, x: left ? 380 : -20, duration: rnd(5000, 8000), onComplete: () => sp.destroy() });
  }

  private flyCoin(key: string, fx: number, fy: number, tx: number, ty: number, delay = 0) {
    const c = this.add.image(fx, fy, key).setScale(COIN_SCALE).setDepth(900).setVisible(false);
    this.tweens.add({
      targets: c, x: tx, y: ty, duration: 480, delay, ease: 'Quad.in',
      onStart: () => c.setVisible(true), onComplete: () => c.destroy(),
    });
  }

  // ---- the day ----

  private async runDay() {
    // yesterday's cashback customers come back as regulars
    this.regularsToday = this.tutorial ? 0 : S.regulars;
    S.regulars = 0;
    const walkIns = walkInCount() + this.regularsToday;
    this.queue = this.tutorial
      ? [{ type: 'rusher', wants: 'gear' }, { type: 'hunter', wants: 'cell' }]
      : Array.from({ length: walkIns }, () => makeCustomer(Math.random, this.pool()));
    // VIPs come for the best thing in the shop, pay up to 160% and never haggle
    for (let i = 0; i < vipCount() && !this.tutorial && S.stock.length; i++) {
      const best = [...S.stock].sort((a, b) => ITEMS[b].value - ITEMS[a].value)[Math.min(i, S.stock.length - 1)];
      this.queue.splice(1 + Math.floor(Math.random() * this.queue.length), 0, { type: 'collector', wants: best, vip: true });
    }
    this.total = this.queue.length;
    this.retime(true);
    this.refresh();
    await this.wait(1200);

    while (this.queue.length) {
      void this.visit(this.queue.shift()!);
      this.arrived++;
      this.refresh();
      if (this.tutorial) {
        while (this.custs.length) await this.wait(300);
        await this.wait(600);
      } else {
        await this.wait(this.campaign ? 1500 : 3800);
      }
      if (!S.stock.length && !this.custs.length) {
        this.queue = [];
        this.coach('SOLD OUT! Closing up for the day.');
      }
    }
    while (this.custs.length) await this.wait(300);
    await this.wait(700);
    // one in three customers who got cashback comes back tomorrow
    if (!this.tutorial) S.regulars = Math.min(4, Math.floor(this.happy / 3));
    this.over = true;
    if (this.picking) setModal(null);
    this.statusEl.remove();
    this.coachEl.remove();
    this.fab?.remove();
    setSheet(null);
    log('day_end', { tutorial: this.tutorial, revenue: this.revenue, cashback: this.cashback, sales: this.sales, campaign: this.campaign });
    hooks.dayEnded({
      tutorial: this.tutorial, revenue: this.revenue, cashback: this.cashback, sales: this.sales,
      campaignUsed: this.campaign, customers: this.total, startStock: this.startStock, preorders: this.preorderSales,
      happy: this.happy, regulars: S.regulars,
    });
  }

  private async visit(c: Customer) {
    const key = `cust_${c.type}`;
    const left = Math.random() < 0.5;
    const sp = person(this, left ? -20 : 380, rnd(565, 600), key);
    if (c.vip) sp.setTint(0xffe9a0);
    const cu: Cust = { c, sp, sh: this.add.image(sp.x, sp.y + 14, 'shadow').setScale(0.5) };
    this.custs.push(cu);
    const it = ITEMS[c.wants];

    await this.walk(sp, DOOR.x + rnd(-8, 8), sp.y);
    await this.walk(sp, DOOR.x, DOOR.y);

    // Find a free shelf with the item they want. They wait a little if someone else is
    // looking at it, or if it is in the back room and the shelf needs restocking.
    let slot: Slot | undefined;
    for (let tries = 0; tries < 5; tries++) {
      slot = this.slots.find((s) => s.item === c.wants && !s.reserved);
      if (slot || !(this.slots.some((s) => s.item === c.wants) || this.back.includes(c.wants))) break;
      if (tries === 0 && this.back.includes(c.wants)) {
        this.bubble(cu, '👀', `Any ${it.name}?`, 'wait');
        if (!this.toldRestock) {
          this.toldRestock = true;
          this.coach('A display is empty! Walk over and stock it.');
        }
      }
      await this.walk(sp, rnd(140, 220), rnd(440, 465));
      await this.wait(1100);
    }

    if (!slot) {
      await this.walk(sp, DOOR.x + rnd(-30, 30), 455);
      this.bubble(cu, '😕', `No ${it.name}?`);
      if (this.tutorial) this.coach(`They wanted a ${it.name}, and there is none on the shelf.`);
      await this.wait(1100);
    } else {
      slot.reserved = true;
      await this.walk(sp, slot.x + (sp.x < slot.x ? -15 : 15), slot.y + 30);
      await this.wait(350);
      const ask = S.prices[c.wants];
      // a charming shop makes every price feel a little fairer
      // today's promotion lifts what this item is worth, and cashback puts everyone in a better mood
      const worth = it.value * (1 + charm()) * (1 + promoBonus(this.shopDay, c.wants)) * (this.campaign ? 1.05 : 1);
      const r = reaction(ask, worth);
      this.takeNote(c.wants, r, ask);
      if (c.vip) this.bubble(cu, '👑', ask <= worth * VIP_LIMIT ? 'VIP: I’ll take it!' : 'VIP: too much', ask <= worth * VIP_LIMIT ? 'happy' : 'annoyed');
      else this.bubble(cu, EMOTE[r].face, EMOTE[r].word, r);
      if (r === 'delighted' || r === 'happy' || c.vip) this.tweens.add({ targets: sp, y: sp.y - (r === 'delighted' ? 9 : 5), duration: 130, yoyo: true, repeat: r === 'delighted' ? 1 : 0, ease: 'Quad.out' });
      await this.wait(800);

      const a = approach(c.type, ask, worth, c.vip);
      let price: number | null = null;
      if (a === 'buy') {
        price = ask;
        if (this.tutorial) this.coach(r === 'delighted' ? 'Sold in a flash! Delighted means you could have asked for more.' : 'Sold at full price! Happy customers pay what you ask.');
      } else if (a === 'barter') {
        this.bubble(cu, '💬', 'Wants to barter', 'wait');
        price = await this.barter(cu, c.wants, ask, worth);
      } else {
        sfx('leave');
        if (this.tutorial) this.coach('Annoyed! That price was far too high, so they left. Tap Prices to lower it.');
      }
      if (price != null && slot.item === c.wants) this.sell(cu, slot, price);
      else slot.reserved = false;
      await this.wait(650);
    }

    cu.bubble?.remove();
    cu.bubble = undefined;
    await this.walk(sp, DOOR.x, DOOR.y);
    await this.walk(sp, DOOR.x, 580);
    this.custs.splice(this.custs.indexOf(cu), 1);
    this.refresh();
    cu.sh.destroy();
    await this.walk(sp, left ? 380 : -20, sp.y);
    sp.destroy();
  }

  private takeNote(id: ItemId, r: keyof typeof EMOTE, ask: number) {
    const n = S.notebook[id];
    if (r === 'delighted') n.cheap = Math.max(n.cheap ?? 0, ask);
    if (r === 'happy') n.sold = Math.max(n.sold ?? 0, ask);
    if (r === 'hesitant') n.haggle = Math.min(n.haggle ?? Infinity, ask);
    if (r === 'annoyed') n.tooHigh = Math.min(n.tooHigh ?? Infinity, ask);
  }

  private sell(cu: Cust, slot: Slot, price: number) {
    const id = slot.item!;
    slot.item = null;
    slot.reserved = false;
    slot.icon.setVisible(false);
    S.stock.splice(S.stock.indexOf(id), 1);
    S.coins += price;
    S.xp += RULES.xpSale;
    this.revenue += price;
    this.sales++;
    sfx('coin');
    floatAt(slot.x, slot.y - 26, `+${price}`, 'gain big');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = this.add.image(slot.x, slot.y - 12, 'spark').setTint(0xffe14d).setDepth(940).setBlendMode(Phaser.BlendModes.ADD).setScale(rnd(0.8, 1.5));
      this.tweens.add({ targets: s, x: slot.x + Math.cos(a) * 24, y: slot.y - 12 + Math.sin(a) * 18, alpha: 0, scale: 0.2, duration: 380, ease: 'Quad.out', onComplete: () => s.destroy() });
    }
    for (let i = 0; i < 4; i++) this.flyCoin('coin', slot.x + rnd(-8, 8), slot.y - 10, 40, 24, i * 70);

    if (this.campaign) {
      // cashback: a little magic that sends the customer home delighted
      const cb = Math.max(1, Math.round(price * RULES.cashback));
      S.coins -= cb;
      this.cashback += cb;
      this.happy++;
      this.time.delayedCall(380, () => {
        sfx('cashback');
        this.bubble(cu, '💖', `+${cb} Cashback!`, 'magic');
        floatAt(cu.sp.x, cu.sp.y - 46, '✨', 'sparkle', 900);
        for (let i = 0; i < 3; i++) this.flyCoin('cbcoin', 180, 120, cu.sp.x + rnd(-6, 6), cu.sp.y - 8, i * 90);
        for (let i = 0; i < 6; i++) {
          const sp = this.add.image(cu.sp.x, cu.sp.y - 10, 'spark').setTint(i % 2 ? 0xff6ad5 : 0xffe14d).setDepth(950).setScale(rnd(1, 2)).setBlendMode(Phaser.BlendModes.ADD);
          const a = (i / 6) * Math.PI * 2;
          this.tweens.add({ targets: sp, x: cu.sp.x + Math.cos(a) * 22, y: cu.sp.y - 10 + Math.sin(a) * 22, alpha: 0, duration: 520, onComplete: () => sp.destroy() });
        }
      });
    }
    log('sale', { item: id, price, type: cu.c.type, campaign: this.campaign });
    hooks.hud();
    save();
    this.refresh();
  }

  // ---- bartering ----

  private barter(cu: Cust, item: ItemId, ask: number, worth: number) {
    return new Promise<number | null>((res) => {
      this.haggles.push({ cu, item, b: startBarter(cu.c.type, ask, worth), line: '', res });
      this.pump();
    });
  }

  private pump() {
    if (this.cur) return; // a barter is on screen: leave its panel alone
    if (this.haggles.length) {
      this.cur = this.haggles.shift()!;
      this.cur.line = say(this.cur.cu.c.type, 'open', this.cur.item, this.cur.b.offer);
      this.bubble(this.cur.cu, '💬', 'Bartering', 'wait');
      sfx('tap');
      this.showBarter();
    } else {
      this.hg = null;
      this.showControls();
    }
  }

  /** One control decides everything: where the slider sits when the button is pressed. */
  private act(value: number) {
    const cur = this.cur;
    if (!cur || cur.done) return;
    if (value <= cur.b.offer) return this.finish(cur.b.offer);
    cur.last = value;
    const res = barterStep(cur.b, value);
    if (res.result === 'deal') this.finish(res.price);
    else if (res.result === 'leave') this.finish(null);
    else {
      cur.line = say(cur.cu.c.type, 'raise', cur.item, res.offer);
      sfx('tap');
      navigator.vibrate?.(15);
      this.updateBarter();
    }
  }

  private finish(price: number | null) {
    const cur = this.cur!;
    cur.done = true;
    const type = cur.cu.c.type;
    const text = say(type, price != null ? 'deal' : 'leave', cur.item, price ?? 0);
    this.bubble(cur.cu, price != null ? '🤝' : '🚪', text, price != null ? 'happy' : 'annoyed');
    sfx(price != null ? 'deal' : 'leave');
    navigator.vibrate?.(price != null ? [20, 40, 20] : 60);
    log('barter', { type, item: cur.item, outcome: price != null ? 'deal' : 'left', price, rounds: cur.b.round, ask: cur.b.ask });
    if (this.tutorial) {
      this.coach(price != null
        ? 'Deal! Bargain Hunters never pay full value, but they nearly always buy.'
        : 'Out of patience, so they walked. Take an offer before the hearts run out.');
    }
    // a stamp lands on the sheet, then it slides away
    const hg = this.hg;
    if (hg) {
      hg.say.textContent = `“${text}”`;
      hg.sheet.classList.add(price != null ? 'won' : 'lost');
      const stamp = h('div', { class: 'stamp' }, price != null ? h('b', {}, 'DEAL!') : h('b', {}, 'Walked out'), price != null ? h('span', {}, icon('coin', 'ico s'), `+${price}`) : null);
      if (price != null) for (let i = 0; i < 10; i++) stamp.append(h('i', { class: 'burst', style: `--a:${i * 36}deg;animation-delay:${i * 0.015}s` }));
      hg.sheet.append(stamp);
    }
    this.time.delayedCall(price != null ? 780 : 900, () => {
      cur.res(price);
      this.cur = null;
      this.pump();
    });
  }

  // ---- UI: top strip, campaign button, bottom sheet ----

  private startCampaign() {
    if (this.campaign || this.tutorial || !this.queue.length) return;
    this.campaign = true;
    // partner businesses send their regulars too
    const extra = this.queue.length * (RULES.campaignMult - 1) + S.partners.length * PARTNER_BONUS;
    for (let i = 0; i < extra; i++) this.queue.push(makeCustomer(Math.random, this.pool()));
    this.total += extra;
    this.retime(true);
    sfx('campaign');
    log('campaign_start', { arrived: this.arrived, extra });
    this.coach(`Here they come! +${extra} customers, drawn in by Cashback. They leave happier, and some come back tomorrow.`);
    floatAt(180, 300, `${BRAND} campaign live!`, 'banner', 2200);
    this.cameras.main.flash(260, 255, 120, 90);
    for (let i = 0; i < 18; i++) this.time.delayedCall(i * 140, () => this.pedestrian(rnd(540, 628)));
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.pedestrian() });
    this.refresh();
  }

  /** Cheap to call: only touches the top strip and the campaign button, never the barter panel. */
  private refresh() {
    if (this.over || this.idle || this.home) return;
    const left = this.queue.length;
    this.clockEl = h('b', {}, '');
    this.statusEl.replaceChildren(
      this.tutorial ? '' : h('span', { class: 'clock' }, h('small', {}, 'Closes in'), this.clockEl, h('i', { class: 'daybar' }, h('i', {}))),
      h('span', {}, h('small', {}, 'Customers'), h('b', {}, `${this.arrived}/${this.total}`), h('small', { class: 'more' }, left ? `${left} to come` : 'last ones in')),
      h('span', {}, h('small', {}, 'Stock'), h('b', {}, S.stock.length)),
      btn('Prices', () => this.openPrices(), 'small'),
    );
    if (this.fab) {
      this.fab.classList.toggle('live', this.campaign);
      this.fab.disabled = this.campaign || !this.queue.length;
      if (this.campaign) this.fab.replaceChildren(h('span', { class: 'bolt' }, '⚡'), h('b', {}, 'LIVE'), h('small', {}, '3× crowd'));
    }
  }

  private showControls() {
    if (this.over || this.idle) return;
    resetInput();
    this.promptEl = h('div', { class: 'cityprompt' });
    setSheet(h('div', { class: 'cityui' }, this.promptEl, buildControls()));
    this.paintPrompt();
  }

  /** Builds the haggle sheet once per customer. Rounds update it in place so it can animate. */
  private showBarter() {
    const cur = this.cur!;
    const b = cur.b;
    const say = h('p', { class: 'hgsay' });
    const hearts = h('div', { class: 'hghearts' });
    const num = h('b', {});
    const word = h('small', {});
    const low = h('small', {});
    const mine = h('small', { class: 'mine' });
    const slider = h('input', { type: 'range', class: 'heat big', step: 1, 'aria-label': 'Your answer' });
    const go = h('button', { class: 'hggo', type: 'button' });
    go.addEventListener('click', () => this.act(Number(slider.value)));
    slider.addEventListener('input', () => this.paintBarter());
    const sheet = h('div', { class: 'sheetbox haggle' },
      h('div', { class: 'hgtop' },
        h('div', { class: 'hgface' }, icon(`cust_${b.type}_0`), hearts),
        h('div', { class: 'hgtalk' }, h('small', {}, CTYPES[b.type].name), say)),
      h('div', { class: 'hgprice' }, icon(`item_${cur.item}`), num, word),
      slider,
      h('div', { class: 'hgends' }, low, mine, h('small', {}, `Your price ${b.ask}`)),
      go,
      this.tutorial ? h('p', { class: 'tip' }, 'Slide to choose your answer. Each counter costs a heart; at zero they walk.') : null);
    this.hg = { sheet, say, hearts, num, word, slider, go, low, mine };
    setSheet(sheet);
    this.updateBarter(true);
  }

  /** A new round: their offer creeps up, a heart is lost. */
  private updateBarter(first = false) {
    const cur = this.cur;
    const hg = this.hg;
    if (!cur || !hg) return;
    const b = cur.b;
    hg.say.textContent = `“${cur.line}”`;
    hg.hearts.replaceChildren(...Array.from({ length: b.patience0 }, (_, i) =>
      h('i', { class: i < b.patience ? 'on' : i === b.patience && !first ? 'pop' : '' }, '♥')));
    hg.hearts.setAttribute('aria-label', `Patience ${b.patience} of ${b.patience0}`);
    hg.slider.min = String(b.offer);
    hg.slider.max = String(b.ask);
    // after a "no" the slider stays on the price you just proposed
    hg.slider.value = String(cur.last != null ? Phaser.Math.Clamp(cur.last, b.offer, b.ask) : Math.round((b.offer + b.ask) / 2));
    hg.low.textContent = `They offer ${b.offer}`;
    hg.mine.textContent = cur.last != null ? `You said ${cur.last}` : '';
    if (!first) {
      // nudge the eye: the bubble pops, the sheet shrugs, their offer flashes
      for (const [el, cls] of [[hg.say, 'pop'], [hg.sheet, 'nope'], [hg.low, 'up']] as const) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
      }
    }
    hg.sheet.classList.toggle('last', b.patience <= 1);
    this.paintBarter();
  }

  /** Slider position decides what the one button does. */
  private paintBarter() {
    const cur = this.cur;
    const hg = this.hg;
    if (!cur || !hg) return;
    const b = cur.b;
    const v = Number(hg.slider.value);
    const t = b.ask === b.offer ? 0 : (v - b.offer) / (b.ask - b.offer);
    hg.num.textContent = String(v);
    hg.sheet.style.setProperty('--heat', heat(t));
    hg.sheet.style.setProperty('--t', String(t));
    if (v <= b.offer) {
      hg.go.textContent = 'Deal!';
      hg.word.textContent = 'Take their offer';
    } else if (v === cur.last) {
      hg.go.textContent = 'Ask again';
      hg.word.textContent = 'Your last offer';
    } else if (v >= b.ask) {
      hg.go.textContent = 'Hold firm';
      hg.word.textContent = 'Your full price';
    } else {
      hg.go.textContent = 'Counter';
      hg.word.textContent = t < 0.34 ? 'Likely yes' : t < 0.67 ? 'Could go either way' : 'Pushing it';
    }
  }

  private openPrices() {
    sfx('tap');
    resetInput();
    setModal(pricingPanel('Prices', 'Changes apply to the next customer.', 'Done', () => setModal(null), this.shopDay));
  }
}
