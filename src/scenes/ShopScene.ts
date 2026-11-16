import Phaser from 'phaser';
import {
  BASE_IDS, Barter, CTYPES, Customer, ITEMS, ItemId, RULES, approach, barterStep, makeCustomer, reaction, startBarter, takeForShelf,
} from '../econ';
import { S, hooks, log, save } from '../state';
import { btn, floatAt, floatLayer, h, icon, place, setModal, setSheet } from '../ui';
import { BRAND, EMOTE, heat, pricingPanel } from '../panels';
import { axis, buildControls, resetInput } from '../input';
import { music, sfx } from '../audio';
import lines from '../lines.json';
import { PARTNER_BONUS } from './CityScene';

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

  constructor() {
    super('shop');
  }

  init(data: { tutorial?: boolean; idle?: boolean }) {
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
    this.heroShadow = this.add.image(0, 0, 'shadow').setScale(0.5);
    this.hero = this.add.sprite(180, 84, `av_${S.avatar}`, 0).setScale(0.6);
    this.placeHero(false);

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
        this.add.image(x, y + 4, 'table').setScale(0.5).setDepth(y - 6);
        this.add.image(x, y - 12, `item_${wares[i]}`).setDepth(y - 5);
      });
      for (const [key, x, y] of [['cust_collector', 104, 296], ['cust_rusher', 256, 380], ['cust_hunter', 200, 440]] as const) {
        this.add.image(x, y + 14, 'shadow').setScale(0.5).setDepth(y - 1);
        this.add.sprite(x, y, `${key}_0`).play(key).setDepth(y);
      }
      this.cameras.main.fadeIn(500);
      return;
    }

    // shelves
    const n = S.upgrades.shelf ? RULES.shelfSlotsUpgraded : RULES.shelfSlots;
    const xs = n === 4 ? [120, 240] : [90, 180, 270];
    this.startStock = [...S.stock];
    this.back = [...S.stock];
    for (const y of [262, 346]) {
      for (const x of xs) {
        this.add.image(x, y + 4, 'table').setScale(0.5).setDepth(y - 6);
        const tag = h('div', { class: 'tag' });
        place(tag, x, y + 13);
        floatLayer.append(tag);
        this.dom.push(tag);
        this.slots.push({ x, y, item: null, reserved: false, icon: this.add.image(x, y - 12, 'item_gear').setDepth(y - 5).setVisible(false), tag });
      }
    }
    for (const s of this.slots) this.stockSlot(s, false);

    // day status, coach line and the campaign button live at the top of the screen
    this.statusEl = h('div', { class: 'daystrip' });
    this.coachEl = h('div', { class: 'coachtop' });
    floatLayer.append(this.statusEl, this.coachEl);
    this.dom.push(this.statusEl, this.coachEl);
    if (!this.tutorial) {
      this.fab = h('button', { class: 'fab', type: 'button', 'aria-label': `Start ${BRAND} campaign: three times the customers, 10% cashback per sale` },
        h('span', { class: 'bolt' }, '⚡'), h('b', {}, BRAND), h('small', {}, 'Campaign'));
      this.fab.addEventListener('click', () => this.startCampaign());
      floatLayer.append(this.fab);
      this.dom.push(this.fab);
    }
    this.coach(this.tutorial
      ? 'Customers are coming! Watch how they react to your prices.'
      : `Tap the ${BRAND} button to pull in a crowd. Walk up to an empty shelf to restock it.`);
    this.showControls();
    this.refresh();
    void this.runDay();
  }

  update(_: number, dms: number) {
    const dt = Math.min(dms, 50) / 1000;
    if (!this.idle && !this.over) this.moveHero(dt);
    for (const cu of this.custs) {
      cu.sp.setDepth(cu.sp.y);
      cu.sh.setPosition(cu.sp.x, cu.sp.y + 14).setDepth(cu.sp.y - 1);
      if (cu.bubble) place(cu.bubble, cu.sp.x, cu.sp.y - 22);
    }
    for (const s of this.slots) {
      const need = !s.item && this.back.length > 0;
      const text = s.item ? String(S.prices[s.item]) : need ? '+ Restock' : '';
      if (s.tag.textContent !== text) s.tag.textContent = text;
      s.tag.classList.toggle('off', !text);
      s.tag.classList.toggle('need', need);
    }
  }

  // ---- the shopkeeper ----

  private blocked(x: number, y: number) {
    if (x > COUNTER.x - 8 && x < COUNTER.x + COUNTER.w + 8 && y > COUNTER.y && y < COUNTER.y + COUNTER.h + 6) return true;
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

    // walking up to an empty shelf restocks it from the back room
    for (const s of this.slots) {
      if (s.item || !this.back.length || Math.hypot(p.x - s.x, p.y - (s.y + 6)) > 40) continue;
      this.stockSlot(s);
      sfx('tap');
      floatAt(s.x, s.y - 26, 'Restocked!', 'gain', 800);
      this.refresh();
    }
  }

  private placeHero(moving: boolean) {
    const p = this.p;
    const dir = (Math.round(Math.atan2(-p.fx, p.fy) / (Math.PI / 4)) + 8) % 8;
    this.hero.setFrame(dir * 6 + (moving ? Math.floor(this.time.now / 90) % 6 : 0)).setPosition(p.x, p.y - 20).setDepth(p.y);
    this.heroShadow.setPosition(p.x, p.y + 5).setDepth(p.y - 1);
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
    sp.setFlipX(x < sp.x);
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
    place(cu.bubble, cu.sp.x, cu.sp.y - 22);
    floatLayer.append(cu.bubble);
    this.dom.push(cu.bubble);
  }

  private stockSlot(s: Slot, pop = true) {
    const shelf = this.slots.map((x) => x.item);
    s.item = takeForShelf(shelf, this.back);
    s.icon.setVisible(!!s.item);
    if (s.item) {
      s.icon.setTexture(`item_${s.item}`);
      if (pop) this.tweens.add({ targets: s.icon, scale: { from: 0.2, to: 1 }, duration: 260, ease: 'Back.out' });
    }
  }

  private pedestrian(y = rnd(556, 624)) {
    const left = Math.random() < 0.5;
    const key = pickOne(['ped_a', 'ped_b', 'cust_hunter', 'cust_rusher', 'cust_collector']);
    const sp = this.add.sprite(left ? -20 : 380, y, `${key}_0`).play(key).setDepth(y).setFlipX(!left);
    this.tweens.add({ targets: sp, x: left ? 380 : -20, duration: rnd(5000, 8000), onComplete: () => sp.destroy() });
  }

  private flyCoin(key: string, fx: number, fy: number, tx: number, ty: number, delay = 0) {
    const c = this.add.image(fx, fy, key).setDepth(900).setVisible(false);
    this.tweens.add({
      targets: c, x: tx, y: ty, duration: 480, delay, ease: 'Quad.in',
      onStart: () => c.setVisible(true), onComplete: () => c.destroy(),
    });
  }

  // ---- the day ----

  private async runDay() {
    const walkIns = RULES.walkIns + (S.upgrades.sign ? RULES.signBonus : 0);
    this.queue = this.tutorial
      ? [{ type: 'rusher', wants: 'gear' }, { type: 'hunter', wants: 'cell' }]
      : Array.from({ length: walkIns }, () => makeCustomer(Math.random, this.pool()));
    this.total = this.queue.length;
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
    this.over = true;
    this.statusEl.remove();
    this.coachEl.remove();
    this.fab?.remove();
    setSheet(null);
    log('day_end', { tutorial: this.tutorial, revenue: this.revenue, cashback: this.cashback, sales: this.sales, campaign: this.campaign });
    hooks.dayEnded({
      tutorial: this.tutorial, revenue: this.revenue, cashback: this.cashback, sales: this.sales,
      campaignUsed: this.campaign, customers: this.total, startStock: this.startStock,
    });
  }

  private async visit(c: Customer) {
    const key = `cust_${c.type}`;
    const left = Math.random() < 0.5;
    const sp = this.add.sprite(left ? -20 : 380, rnd(565, 600), `${key}_0`).play(key);
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
          this.coach('A shelf is empty! Walk over to it to restock.');
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
      const r = reaction(ask, it.value);
      this.takeNote(c.wants, r, ask);
      this.bubble(cu, EMOTE[r].face, EMOTE[r].word, r);
      await this.wait(800);

      const a = approach(c.type, ask, it.value);
      let price: number | null = null;
      if (a === 'buy') {
        price = ask;
        if (this.tutorial) this.coach(r === 'delighted' ? 'Sold in a flash! Delighted means you could have asked for more.' : 'Sold at full price! Happy customers pay what you ask.');
      } else if (a === 'barter') {
        this.bubble(cu, '💬', 'Wants to barter', 'wait');
        price = await this.barter(cu, c.wants, ask);
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
    for (let i = 0; i < 4; i++) this.flyCoin('coin', slot.x + rnd(-8, 8), slot.y - 10, 40, 24, i * 70);

    if (this.campaign) {
      const cb = Math.round(price * RULES.cashback);
      S.coins -= cb;
      this.cashback += cb;
      this.time.delayedCall(350, () => {
        sfx('cashback');
        floatAt(cu.sp.x, cu.sp.y - 44, `${cb} cashback`, 'cb');
        for (let i = 0; i < 2; i++) this.flyCoin('cbcoin', 180, 120, cu.sp.x, cu.sp.y - 8, i * 90);
      });
    }
    log('sale', { item: id, price, type: cu.c.type, campaign: this.campaign });
    hooks.hud();
    save();
    this.refresh();
  }

  // ---- bartering ----

  private barter(cu: Cust, item: ItemId, ask: number) {
    return new Promise<number | null>((res) => {
      this.haggles.push({ cu, item, b: startBarter(cu.c.type, ask, ITEMS[item].value), line: '', res });
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
    } else this.showControls();
  }

  /** counter === null means Accept. */
  private act(counter: number | null) {
    const cur = this.cur;
    if (!cur) return;
    if (counter == null) return this.finish(cur.b.offer);
    const res = barterStep(cur.b, counter);
    if (res.result === 'deal') this.finish(res.price);
    else if (res.result === 'leave') this.finish(null);
    else {
      cur.line = say(cur.cu.c.type, 'raise', cur.item, res.offer);
      sfx('tap');
      this.showBarter();
    }
  }

  private finish(price: number | null) {
    const cur = this.cur!;
    const type = cur.cu.c.type;
    const text = say(type, price != null ? 'deal' : 'leave', cur.item, price ?? 0);
    this.bubble(cur.cu, price != null ? '🤝' : '🚪', text, price != null ? 'happy' : 'annoyed');
    sfx(price != null ? 'deal' : 'leave');
    log('barter', { type, item: cur.item, outcome: price != null ? 'deal' : 'left', price, rounds: cur.b.round, ask: cur.b.ask });
    if (this.tutorial) {
      this.coach(price != null
        ? 'Deal! Bargain Hunters never pay full value, but they nearly always buy.'
        : 'Out of patience, so they walked. Accept an offer before patience hits zero.');
    }
    cur.res(price);
    this.cur = null;
    this.pump();
  }

  // ---- UI: top strip, campaign button, bottom sheet ----

  private startCampaign() {
    if (this.campaign || this.tutorial || !this.queue.length) return;
    this.campaign = true;
    // partner businesses send their regulars too
    const extra = this.queue.length * (RULES.campaignMult - 1) + S.partners.length * PARTNER_BONUS;
    for (let i = 0; i < extra; i++) this.queue.push(makeCustomer(Math.random, this.pool()));
    this.total += extra;
    sfx('campaign');
    log('campaign_start', { arrived: this.arrived, extra });
    this.coach(`Here they come! +${extra} customers. Every sale pays 10% cashback.`);
    floatAt(180, 300, `${BRAND} campaign live!`, 'banner', 2200);
    this.cameras.main.flash(260, 255, 120, 90);
    for (let i = 0; i < 18; i++) this.time.delayedCall(i * 140, () => this.pedestrian(rnd(540, 628)));
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.pedestrian() });
    this.refresh();
  }

  /** Cheap to call: only touches the top strip and the campaign button, never the barter panel. */
  private refresh() {
    if (this.over || this.idle) return;
    this.statusEl.replaceChildren(
      h('span', {}, h('small', {}, 'Customers'), h('b', {}, `${this.arrived}/${this.total}`)),
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
    setSheet(h('div', { class: 'cityui' }, buildControls()));
  }

  private showBarter() {
    const cur = this.cur!;
    const b = cur.b;
    const T = CTYPES[b.type];
    const pips = '●'.repeat(b.patience) + '○'.repeat(b.patience0 - b.patience);
    const panel = h('div', { class: 'barter' },
      h('div', { class: 'bhead' },
        icon(`cust_${b.type}_0`),
        h('div', {}, h('b', {}, T.name), h('small', {}, T.blurb)),
        h('div', { class: `patience ${b.patience <= 1 ? 'last' : ''}`, 'aria-label': `Patience ${b.patience} of ${b.patience0}` },
          h('small', {}, b.patience <= 1 ? 'Last chance!' : 'Patience'), h('span', {}, pips)),
      ),
      h('p', { class: 'line' }, `“${cur.line}”`),
      h('div', { class: 'bitem' },
        h('span', { class: 'bname' }, icon(`item_${cur.item}`, 'ico s'), ITEMS[cur.item].name),
        h('span', {}, h('small', {}, 'Your price'), h('b', {}, b.ask)),
        h('span', { class: 'theirs' }, h('small', {}, 'Their offer'), h('b', {}, b.offer))),
      h('div', { class: 'brow' },
        btn([h('small', {}, 'Safe'), h('b', {}, `Accept ${b.offer}`)], () => this.act(null), 'deal go'),
        btn([h('small', {}, 'Risky'), h('b', {}, `Hold firm ${b.ask}`)], () => this.act(b.ask), 'deal hold'),
      ),
    );
    if (b.ask - b.offer > 1) {
      // counter slider: green beside their offer (likely yes), red beside your price (likely no)
      const lo = b.offer + 1;
      const hi = b.ask - 1;
      const out = h('b', {});
      const word = h('small', {});
      const slider = h('input', { type: 'range', class: 'heat', min: lo, max: hi, step: 1, value: Math.round((b.ask + b.offer) / 2), 'aria-label': 'Counter offer' });
      const counterBtn = btn([word, out], () => this.act(Number(slider.value)), 'deal counter');
      const paint = () => {
        const t = hi === lo ? 0.5 : (Number(slider.value) - lo) / (hi - lo);
        out.textContent = `Counter ${slider.value}`;
        word.textContent = t < 0.34 ? 'Likely yes' : t < 0.67 ? 'Could go either way' : 'Pushing it';
        counterBtn.style.setProperty('--heat', heat(t));
      };
      slider.addEventListener('input', paint);
      paint();
      panel.append(h('div', { class: 'brow counter' },
        h('div', { class: 'heatwrap' }, slider, h('div', { class: 'heatends' }, h('small', {}, 'Safer'), h('small', {}, 'Greedier'))),
        counterBtn));
    }
    if (this.tutorial) panel.append(h('p', { class: 'tip' }, 'Each Counter or Hold firm costs 1 patience. At zero, they walk out.'));
    setSheet(h('div', { class: 'sheetbox' }, panel));
  }

  private openPrices() {
    sfx('tap');
    resetInput();
    setModal(pricingPanel('Prices', 'Changes apply to the next customer.', 'Done', () => setModal(null)));
  }
}
