import Phaser from 'phaser';
import {
  Barter, CTYPES, Customer, ITEMS, ItemId, RULES, approach, barterStep, makeCustomer, reaction, startBarter, takeForShelf,
} from '../econ';
import { S, hooks, log, save } from '../state';
import { btn, floatAt, floatLayer, h, icon, place, setModal, setSheet } from '../ui';
import { BRAND, EMOTE, pricingPanel } from '../panels';
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
  private coachText = '';
  private over = false;

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
    this.revenue = this.cashback = this.sales = this.arrived = 0;
  }

  create() {
    music('shop');
    this.cameras.main.setZoom(2).centerOn(180, 320);
    this.add.image(0, 0, 'shop_bg').setOrigin(0).setScale(0.5).setDepth(-10);
    this.add.sprite(180, 86, `av_${S.avatar}`, 0).setScale(0.6).setDepth(-9);

    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.pedestrian() });
    this.pedestrian();

    this.events.once('shutdown', () => {
      this.dom.forEach((d) => d.remove());
      setSheet(null);
    });
    if (this.idle) return;

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

    this.coach(this.tutorial
      ? 'Two customers are on their way. Watch how they react to your prices.'
      : `Shop is open. Start a ${BRAND} campaign early to fill the street.`);

    void this.runDay();
  }

  update() {
    for (const cu of this.custs) {
      cu.sp.setDepth(cu.sp.y);
      cu.sh.setPosition(cu.sp.x, cu.sp.y + 14).setDepth(cu.sp.y - 1);
      if (cu.bubble) place(cu.bubble, cu.sp.x, cu.sp.y - 22);
    }
    for (const s of this.slots) {
      const text = s.item ? String(S.prices[s.item]) : '';
      if (s.tag.textContent !== text) s.tag.textContent = text;
      s.tag.classList.toggle('off', !s.item);
    }
  }

  // ---- helpers ----

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()));
  }

  private walk(sp: Phaser.GameObjects.Sprite, x: number, y: number, speed = 95) {
    const d = Phaser.Math.Distance.Between(sp.x, sp.y, x, y);
    sp.setFlipX(x < sp.x);
    return new Promise<void>((res) => this.tweens.add({ targets: sp, x, y, duration: (d / speed) * 1000, onComplete: () => res() }));
  }

  private coach(text: string) {
    this.coachText = text;
    this.renderSheet();
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
      if (pop) this.tweens.add({ targets: s.icon, scale: { from: 0.2, to: 1 }, duration: 220, ease: 'Back.out' });
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
      : Array.from({ length: walkIns }, () => makeCustomer(Math.random));
    this.total = this.queue.length;
    this.renderSheet();
    await this.wait(1200);

    while (this.queue.length) {
      void this.visit(this.queue.shift()!);
      this.arrived++;
      this.renderSheet();
      if (this.tutorial) {
        while (this.custs.length) await this.wait(300);
        await this.wait(600);
      } else {
        await this.wait(this.campaign ? 1500 : 3800);
      }
      if (!S.stock.length && !this.custs.length) {
        this.queue = [];
        this.coach('Sold out! Closing up for the day.');
      }
    }
    while (this.custs.length) await this.wait(300);
    await this.wait(700);
    this.over = true;
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

    // find a free shelf with the item they want; wait a moment if someone else is looking at it
    let slot: Slot | undefined;
    for (let tries = 0; tries < 4; tries++) {
      slot = this.slots.find((s) => s.item === c.wants && !s.reserved);
      if (slot || !this.slots.some((s) => s.item === c.wants)) break;
      await this.walk(sp, rnd(140, 220), rnd(440, 465));
      await this.wait(900);
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
        if (this.tutorial) this.coach(r === 'delighted' ? 'Sold at once. Delighted means you could have asked for more.' : 'Sold at your asking price. Happy customers pay in full.');
      } else if (a === 'barter') {
        this.bubble(cu, '💬', 'Wants to barter', 'wait');
        price = await this.barter(cu, c.wants, ask);
      } else {
        sfx('leave');
        if (this.tutorial) this.coach('Annoyed: your price was far too high, so they left. Tap Prices to lower it.');
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
    this.renderSheet();
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
    floatAt(slot.x, slot.y - 26, `+${price}`, 'gain');
    for (let i = 0; i < 3; i++) this.flyCoin('coin', slot.x + rnd(-8, 8), slot.y - 10, 40, 24, i * 70);

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
    this.time.delayedCall(700, () => {
      if (!this.over && !slot.item) this.stockSlot(slot);
    });
  }

  // ---- bartering ----

  private barter(cu: Cust, item: ItemId, ask: number) {
    return new Promise<number | null>((res) => {
      this.haggles.push({ cu, item, b: startBarter(cu.c.type, ask, ITEMS[item].value), line: '', res });
      this.pump();
    });
  }

  private pump() {
    if (!this.cur && this.haggles.length) {
      this.cur = this.haggles.shift()!;
      this.cur.line = say(this.cur.cu.c.type, 'open', this.cur.item, this.cur.b.offer);
      this.bubble(this.cur.cu, '💬', 'Bartering', 'wait');
      sfx('tap');
    }
    this.renderSheet();
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
      this.renderSheet();
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
        : 'Out of patience, so they left. Accept an offer before patience hits zero.');
    }
    cur.res(price);
    this.cur = null;
    this.pump();
  }

  // ---- bottom sheet: day status, campaign button, barter panel ----

  private startCampaign() {
    if (this.campaign || this.tutorial || !this.queue.length) return;
    this.campaign = true;
    // partner businesses send their regulars too
    const extra = this.queue.length * (RULES.campaignMult - 1) + S.partners.length * PARTNER_BONUS;
    for (let i = 0; i < extra; i++) this.queue.push(makeCustomer(Math.random));
    this.total += extra;
    sfx('campaign');
    log('campaign_start', { arrived: this.arrived, extra });
    this.coach(`${BRAND} campaign live! The street is filling up. Every sale pays 10% cashback.`);
    floatAt(180, 300, `${BRAND} campaign live!`, 'banner', 2000);
    for (let i = 0; i < 14; i++) this.time.delayedCall(i * 160, () => this.pedestrian(rnd(540, 628)));
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.pedestrian() });
    this.renderSheet();
  }

  private renderSheet() {
    if (this.over || this.idle) return;
    const status = h('div', { class: 'daybar' },
      h('span', {}, `Customers ${this.arrived} of ${this.total}`),
      h('span', {}, `Stock left ${S.stock.length}`),
      btn('Prices', () => this.openPrices(), 'small'),
    );
    const kids: (HTMLElement | false)[] = [status, !!this.coachText && !this.cur && h('p', { class: 'coach' }, this.coachText)];

    if (!this.tutorial) {
      if (this.campaign) kids.push(h('div', { class: 'campaign live' }, `⚡ ${BRAND} campaign live · 3× customers · 10% cashback`));
      else if (this.queue.length) {
        kids.push(btn([h('b', {}, `⚡ Start ${BRAND} campaign`), h('small', {}, '' + (S.partners.length ? `3× customers +${S.partners.length * PARTNER_BONUS} from partners · 10% cashback per sale · once a day` : '3× customers today · you pay 10% cashback per sale · once a day'))],
          () => this.startCampaign(), 'campaign'));
      }
    }

    const cur = this.cur;
    if (cur) {
      const b = cur.b;
      const T = CTYPES[b.type];
      const pips = '●'.repeat(b.patience) + '○'.repeat(b.patience0 - b.patience);
      const panel = h('div', { class: 'barter' },
        h('div', { class: 'bhead' },
          icon(`cust_${b.type}_0`),
          h('div', {}, h('b', {}, T.name), h('small', {}, T.blurb)),
          h('div', { class: 'patience', 'aria-label': `Patience ${b.patience} of ${b.patience0}` }, h('small', {}, `Patience ${b.patience}/${b.patience0}`), h('span', {}, pips)),
        ),
        h('p', { class: 'line' }, `“${cur.line}”`),
        h('div', { class: 'bitem' }, icon(`item_${cur.item}`, 'ico s'), `${ITEMS[cur.item].name} · your price ${b.ask} · they offer `, h('b', {}, b.offer)),
      );
      const row = h('div', { class: 'brow' },
        btn(['Accept ', h('b', {}, b.offer)], () => this.act(null), 'primary'),
        btn(['Hold firm ', h('b', {}, b.ask)], () => this.act(b.ask)),
      );
      panel.append(row);
      if (b.ask - b.offer > 1) {
        const mid = Math.round((b.ask + b.offer) / 2);
        const out = h('b', {}, mid);
        const slider = h('input', {
          type: 'range', min: b.offer + 1, max: b.ask - 1, step: 1, value: mid, 'aria-label': 'Counter offer',
          oninput: () => (out.textContent = slider.value),
        });
        panel.append(h('div', { class: 'brow counter' }, slider, btn(['Counter ', out], () => this.act(Number(slider.value)))));
      }
      if (this.tutorial) panel.append(h('p', { class: 'tip' }, 'Tip: each Counter or Hold firm costs 1 patience. At zero, they walk out.'));
      kids.push(panel);
    } else if (this.haggles.length === 0 && this.tutorial && this.arrived === 0) {
      kids.push(h('p', { class: 'tip' }, 'Prices are on the tags. Tap Prices to change them at any time.'));
    }
    setSheet(h('div', { class: 'sheetbox' }, ...kids));
  }

  private openPrices() {
    sfx('tap');
    setModal(pricingPanel('Prices', 'Changes apply to the next customer.', 'Done', () => setModal(null)));
  }
}
