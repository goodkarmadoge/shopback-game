import Phaser from 'phaser';
import './style.css';
import { ART, buildArt } from './art';
import { ITEMS, ItemId, RULES, estimateDay } from './econ';
import { DaySummary, RunSummary, S, getLog, hasSave, hooks, log, resetState, save } from './state';
import { btn, card, h, icon, setHud, setModal, toast } from './ui';
import { BRAND, pricingPanel } from './panels';
import { music, setMuted, sfx } from './audio';
import { buildScenery } from './scenery';
import { mountViewer } from './viewer3d';
import { ShopScene } from './scenes/ShopScene';
import { CITY_SPRITES, CityScene, PARTNERS, PARTNER_BONUS } from './scenes/CityScene';
import { DungeonScene } from './scenes/DungeonScene';
import offerData from './offers.json';

// ---- boot ----

buildArt();
buildScenery();

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  preload() {
    // shopkeeper avatars: sprite sheets rendered from the 3D models (see scripts/render-avatars.cjs)
    for (const a of ['male', 'female']) this.load.spritesheet(`av_${a}`, `avatars/${a}.png`, { frameWidth: 96, frameHeight: 96 });
    // city buildings and props: sprites rendered from 3D models (see scripts/render-city.cjs)
    for (const k of CITY_SPRITES) this.load.image(`city_${k}`, `city/${k}.png`);
  }
  create() {
    for (const [key, canvas] of Object.entries(ART)) this.textures.addCanvas(key, canvas);
    for (const k of ['hero', 'cust_hunter', 'cust_collector', 'cust_rusher', 'ped_a', 'ped_b', 'bot', 'drone', 'slime', 'guardian']) {
      this.anims.create({ key: k, frames: [{ key: `${k}_0` }, { key: `${k}_1` }], frameRate: k === 'drone' ? 12 : 5, repeat: -1 });
    }
    // painted backdrops and 3D-rendered sprites are high resolution: smooth them, keep pixel art crisp
    const smooth = ['shop_bg', 'city_bg', 'dungeon_bg_0', 'dungeon_bg_1', 'dungeon_bg_2', 'table', 'shadow', 'av_male', 'av_female', ...CITY_SPRITES.map((k) => `city_${k}`)];
    for (const k of smooth) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.scene.start('shop', { idle: true });
    title();
  }
}

const stage = document.getElementById('stage')!;
const fit = () => (document.getElementById('ui')!.style.fontSize = `${stage.clientWidth / 22.5}px`);
window.addEventListener('resize', fit);
fit();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // the world is 360x640; it is drawn at twice that so 3D-rendered art keeps its detail
  width: 720,
  height: 1280,
  pixelArt: true,
  backgroundColor: '#1a1320',
  scale: { mode: Phaser.Scale.FIT },
  scene: [BootScene, ShopScene, CityScene, DungeonScene],
});

function go(key: 'shop' | 'dungeon' | 'city', data: object = {}) {
  game.scene.stop('shop');
  game.scene.stop('city');
  game.scene.stop('dungeon');
  game.scene.start(key, data);
}

// mute button, always available
const muteBtn = h('button', { id: 'mute', type: 'button' });
const drawMute = () => {
  muteBtn.textContent = S.muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', S.muted ? 'Sound off. Tap to unmute' : 'Sound on. Tap to mute');
};
muteBtn.addEventListener('click', () => {
  S.muted = !S.muted;
  setMuted(S.muted);
  drawMute();
  save();
});
document.getElementById('ui')!.append(muteBtn);
setMuted(S.muted);
drawMute();

// ---- HUD ----

function hud(label = `Day ${S.day}`) {
  const pct = S.level >= 2 ? 100 : Math.min(100, (S.xp / RULES.xpLevel2) * 100);
  setHud(h('div', { class: 'hudbar' },
    h('span', { class: 'pill' }, icon('coin', 'ico s'), h('b', {}, S.coins)),
    h('span', { class: 'pill xp' },
      h('b', {}, `Lv ${S.level}`),
      h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
      h('small', {}, S.level >= 2 ? `${S.xp} XP` : `${S.xp}/${RULES.xpLevel2} XP`)),
    h('span', { class: 'pill' }, label),
  ));
}
let hudLabel = '';
hooks.hud = () => hud(hudLabel);

const stat = (label: string, value: string | number, cls = '') => h('div', { class: `stat ${cls}` }, h('span', {}, label), h('b', {}, value));
const lootRow = (ids: ItemId[]) =>
  h('div', { class: 'loot' }, ...ids.map((id) => h('span', { class: 'lootitem' }, icon(`item_${id}`), h('small', {}, ITEMS[id].name))));

// ---- title and onboarding ----

function title() {
  setHud(null);
  music('shop');
  setModal(h('div', { class: 'title' },
    h('div', { class: 'logo' }, h('span', {}, 'Shop'), h('span', { class: 'k' }, 'Keeper')),
    h('p', { class: 'tagline' }, 'Sell loot by day. Fight for stock by night.'),
    h('div', { class: 'titlebtns' },
      hasSave() && btn('Continue', () => { sfx('tap'); resume(); }, 'primary big'),
      btn(hasSave() ? 'New game' : 'Start', () => { sfx('tap'); resetState(); avatarSelect(); }, hasSave() ? 'big' : 'primary big'),
    ),
    h('p', { class: 'fine' }, `Prototype for the ${BRAND} app · one loop, about 8 minutes · coins have no cash value`),
  ));
}

function resume() {
  log('resume', { phase: S.phase });
  if (S.phase === 'tutorial') tutorialIntro();
  else if (S.phase === 'dungeon') city();
  else if (S.phase === 'morning') morning();
  else if (S.phase === 'upgrade') upgrade();
  else if (S.phase === 'done') endCard();
  else interests();
}

function avatarSelect() {
  const disposers: (() => void)[] = [];
  let open = true;
  const pick = (a: 'male' | 'female') => {
    open = false;
    disposers.forEach((d) => d());
    S.avatar = a;
    save();
    sfx('tap');
    log('avatar', { avatar: a });
    go('shop', { idle: true });
    interests();
  };
  const option = (a: 'male' | 'female', label: string) => {
    // a rendered portrait shows at once; the live 3D model fades in over it when loaded
    const canvas = h('canvas', { class: 'av3d' });
    const el = h('button', { class: 'avatar', type: 'button', onclick: () => pick(a) },
      h('div', { class: 'avstage' }, h('img', { src: `avatars/${a}-portrait.png`, alt: '', draggable: 'false' }), canvas), h('b', {}, label));
    window.setTimeout(() => {
      if (!open) return;
      mountViewer(canvas, `models/${a}.glb`).then((dispose) => {
        if (!open) return dispose();
        disposers.push(dispose);
        el.classList.add('live');
      }).catch(() => { /* keep the portrait */ });
    }, 50);
    return el;
  };
  setModal(card('Choose your shopkeeper',
    h('p', {}, 'Who is running the shop?'),
    h('div', { class: 'avatars' }, option('male', 'Shopkeeper A'), option('female', 'Shopkeeper B'))));
}

function interests() {
  const picked = new Set<string>();
  const count = h('p', { class: 'fine' }, 'Tap 3');
  const chips = offerData.categories.map((c) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false' }, h('span', {}, c.emoji), c.label);
    b.addEventListener('click', () => {
      if (picked.has(c.id)) picked.delete(c.id);
      else if (picked.size < 3) picked.add(c.id);
      b.setAttribute('aria-pressed', String(picked.has(c.id)));
      b.classList.toggle('on', picked.has(c.id));
      count.textContent = picked.size < 3 ? `Tap ${3 - picked.size} more` : 'Great!';
      sfx('tap');
      if (picked.size === 3) {
        window.setTimeout(() => {
          if (picked.size !== 3) return;
          S.interests = [...picked];
          S.phase = 'tutorial';
          save();
          log('interests', { picked: S.interests });
          tutorialIntro();
        }, 450);
      }
    });
    return b;
  });
  setModal(card('What are you shopping for?',
    h('p', {}, 'We use this to pick the example deals you see after a dungeon run.'),
    h('div', { class: 'chips' }, ...chips), count));
}

// ---- tutorial day ----

function tutorialIntro() {
  go('shop', { idle: true });
  hud((hudLabel = 'Day 1 · Tutorial'));
  setModal(pricingPanel('Your first day',
    'You have 3 items and 2 customers on the way. Every item has a hidden market value. Set a price, then learn from how customers react.',
    'Open the shop', () => {
      setModal(null);
      log('day_start', { tutorial: true });
      go('shop', { tutorial: true });
    }));
}

hooks.dayEnded = (d: DaySummary) => (d.tutorial ? tutorialDone(d) : summary(d));

function tutorialDone(d: DaySummary) {
  S.phase = 'dungeon';
  save();
  hooks.hud();
  setModal(card('Shop closed',
    h('p', {}, d.sales ? `You made ${d.sales} sale${d.sales > 1 ? 's' : ''} and earned ${d.revenue} coins.` : 'No sales today. Lower prices sell faster: check your notebook tomorrow.'),
    h('p', {}, 'The shelves are nearly bare. Step out into the city: meet the neighbours, then find the old server mall in the park. Everything you carry out of the Techno Dungeon is tomorrow’s stock.'),
    btn('Head out ▶', () => { sfx('tap'); city(); }, 'primary')));
}

// ---- evening: the city ----

function city() {
  S.phase = 'dungeon';
  save();
  setModal(null);
  hud((hudLabel = `Evening ${S.day}`));
  go('city');
}
hooks.cityExit = () => dungeonIntro();

// ---- night: dungeon ----

function dungeonIntro() {
  go('shop', { idle: true });
  hud((hudLabel = `Night ${S.day}`));
  setModal(card('Techno Dungeon',
    h('p', {}, 'An abandoned server mall under the market street. Three rooms, five hearts, a six-slot loot bag.'),
    h('div', { class: 'keys' },
      stat('Move', 'Stick · WASD / arrows'),
      stat('Attack', 'Button · J / click'),
      stat('Dodge roll', 'Button · K / space')),
    h('p', { class: 'fine' }, 'Three hits make a combo: the third lands harder. Rolling makes you untouchable for a moment. Red shapes show where an attack will land.'),
    btn('Enter ▶', () => { sfx('tap'); setModal(null); go('dungeon'); }, 'primary')));
}

hooks.runEnded = (r: RunSummary) => {
  go('shop', { idle: true });
  S.stock.push(...r.bag);
  S.phase = 'morning';
  save();
  hud((hudLabel = `Night ${S.day}`));
  setModal(card(r.defeated ? 'Defeated' : r.rooms === 3 ? 'Dungeon cleared!' : 'Back safely',
    h('p', {}, r.defeated
      ? `You were carried out after ${r.rooms} room${r.rooms === 1 ? '' : 's'} and dropped half your bag on the way.`
      : `You cleared ${r.rooms} of 3 rooms.`),
    h('div', { class: 'stats' }, stat('Rooms cleared', `${r.rooms} / 3`), stat('XP earned', `+${r.rooms * RULES.xpRoom}`), stat('Loot carried out', r.bag.length)),
    r.bag.length ? lootRow(r.bag) : h('p', { class: 'fine' }, 'Your bag is empty.'),
    r.lost.length ? h('p', { class: 'fine' }, `Lost: ${r.lost.map((i) => ITEMS[i].name).join(', ')}`) : null,
    btn('Continue ▶', () => { sfx('tap'); offerCard(); }, 'primary')));
};

// ---- the offer card: one per run, after the loot is counted, always skippable ----

function offerCard() {
  const pool = offerData.offers.filter((o) => S.interests.includes(o.cat));
  const unseen = pool.filter((o) => !S.shopList.includes(o.id));
  const list = unseen.length ? unseen : pool.length ? pool : offerData.offers;
  const o = list[Math.floor(Math.random() * list.length)];
  const cat = offerData.categories.find((c) => c.id === o.cat)!;
  log('offer_shown', { offer: o.id, cat: o.cat });
  const done = (action: string) => {
    log('offer_action', { offer: o.id, action });
    sfx('tap');
    morning();
  };
  setModal(h('div', { class: 'card offer' },
    h('div', { class: 'sponsored' }, `Sponsored · ${BRAND} · Example only`),
    h('h2', {}, 'Real-world loot'),
    h('div', { class: 'offerbody' },
      h('div', { class: 'offeremoji' }, cat.emoji),
      h('div', {},
        h('b', { class: 'oproduct' }, o.product),
        h('div', { class: 'omerchant' }, `${o.merchant} · ${cat.label}`),
        h('div', { class: 'ocash' }, `${o.cashback} Cashback`))),
    h('p', { class: 'fine' }, `Picked because you said you are shopping for ${cat.label.toLowerCase()}.`),
    btn('View deal', () => { toast('Example only: in the app this opens the merchant.'); done('view'); }, 'primary'),
    btn('Save to Shop List', () => { S.shopList.push(o.id); save(); toast('Saved to your Shop List.'); done('save'); }),
    btn('Skip', () => done('skip'), 'ghost')));
}

// ---- morning: stock and price ----

function morning() {
  go('shop', { idle: true });
  if (!S.stock.length) {
    S.stock.push('gear', 'gear');
    toast('Empty shelves! A neighbour lends you two Scrap Gears.');
  }
  S.phase = 'morning';
  save();
  hud((hudLabel = `Day ${S.day + 1}`));
  const slots = S.upgrades.shelf ? RULES.shelfSlotsUpgraded : RULES.shelfSlots;
  setModal(pricingPanel('Morning: stock and price',
    `Last night’s loot is on the shelves: ${S.stock.length} items, ${slots} on display at a time. Price each one. Too high and customers leave; too low and you leave money on the table.`,
    'Open the shop', () => {
      setModal(null);
      log('day_start', { tutorial: false, stock: S.stock, prices: S.prices });
      go('shop', {});
    }));
}

// ---- close and tally ----

function summary(d: DaySummary) {
  const profit = d.revenue - d.cashback;
  const base = { stock: d.startStock, prices: S.prices, slots: S.upgrades.shelf ? RULES.shelfSlotsUpgraded : RULES.shelfSlots };
  const walkIns = RULES.walkIns + (S.upgrades.sign ? RULES.signBonus : 0);
  const without = estimateDay({ ...base, customers: walkIns, campaign: false });
  const withC = estimateDay({ ...base, customers: walkIns * RULES.campaignMult + S.partners.length * PARTNER_BONUS, campaign: true });
  const other = d.campaignUsed ? without.profit : withC.profit;
  const max = Math.max(profit, other, 1);
  const bar = (label: string, v: number, cls: string) =>
    h('div', { class: 'cmp' }, h('span', {}, label), h('div', { class: 'bar' }, h('i', { class: cls, style: `width:${(v / max) * 100}%` })), h('b', {}, v));
  let verdict: string;
  if (d.campaignUsed) {
    verdict = profit > other
      ? `The campaign brought ${d.customers} customers instead of ${walkIns}. You paid ${d.cashback} coins in cashback and still finished about ${profit - other} coins ahead.`
      : `The campaign brought ${d.customers} customers instead of ${walkIns}, but this time the extra sales did not cover the cashback. More stock, or prices customers accept, makes it pay.`;
  } else {
    verdict = `You did not run a campaign. With one, about ${walkIns * RULES.campaignMult} customers would have come by instead of ${walkIns}.`;
  }
  log('summary', { profit, estimateOther: other, campaign: d.campaignUsed });
  S.phase = 'upgrade';
  save();
  hooks.hud();
  setModal(card(`Day ${S.day + 1} closed`,
    h('div', { class: 'stats' },
      stat('Sales', `${d.sales} of ${d.startStock.length} items`),
      stat('Revenue', d.revenue),
      stat('Cashback paid', d.cashback ? `−${d.cashback}` : 0),
      stat('Profit', profit, 'total')),
    h('div', { class: 'compare' },
      h('div', { class: 'sponsored' }, `${BRAND} campaign`),
      bar(d.campaignUsed ? 'With campaign (you)' : 'Without campaign (you)', profit, 'you'),
      bar(d.campaignUsed ? 'Without it (estimate)' : 'With a campaign (estimate)', other, 'est'),
      h('p', {}, verdict)),
    btn('Continue ▶', () => { sfx('tap'); levelCheck(); }, 'primary')));
}

function levelCheck() {
  if (S.level < 2 && S.xp >= RULES.xpLevel2) {
    S.level = 2;
    save();
    hooks.hud();
    sfx('level');
    log('level_up', { level: 2 });
    setModal(h('div', { class: 'card offer' },
      h('div', { class: 'sponsored' }, `${BRAND} reward · Example only`),
      h('h2', {}, 'Shop Level 2!'),
      h('div', { class: 'offerbody' },
        h('div', { class: 'offeremoji' }, '🎟️'),
        h('div', {},
          h('b', { class: 'oproduct' }, 'Cashback boost unlocked'),
          h('div', { class: 'omerchant' }, 'One purchase · single use · expires in 7 days'),
          h('div', { class: 'ocash' }, '+x% Cashback'))),
      h('p', { class: 'fine' }, 'Levels come from playing, never from spending or chance. In the app, this would be a real discount tied to your account.'),
      btn('Nice ▶', () => { sfx('tap'); upgrade(); }, 'primary')));
  } else upgrade();
}

// ---- upgrade ----

function upgrade() {
  go('shop', { idle: true });
  hud((hudLabel = `Day ${S.day + 1}`));
  const defs: { id: keyof typeof S.upgrades; name: string; text: string; emoji: string }[] = [
    { id: 'shelf', name: 'Extra shelf', text: 'Shelf slots go from 4 to 6', emoji: '🗄️' },
    { id: 'sign', name: 'Shop sign', text: 'Two more walk-in customers a day', emoji: '🪧' },
    { id: 'wrench', name: 'Charged wrench', text: 'Each hit deals one more damage', emoji: '🔧' },
  ];
  const can = S.coins >= RULES.upgradeCost;
  const open = defs.filter((u) => !S.upgrades[u.id]);
  const rows = open.map((u) => {
    const b = btn([h('span', { class: 'uemoji' }, u.emoji), h('span', { class: 'utext' }, h('b', {}, u.name), h('small', {}, u.text)), h('span', { class: 'ucost' }, icon('coin', 'ico s'), RULES.upgradeCost)], () => {
      S.coins -= RULES.upgradeCost;
      S.upgrades[u.id] = true;
      sfx('level');
      log('upgrade', { id: u.id });
      toast(`${u.name} installed.`);
      endCard();
    }, 'upgrade');
    b.disabled = !can;
    return b;
  });
  setModal(card('Pick one upgrade',
    h('p', {}, can ? `You have ${S.coins} coins. Each upgrade costs ${RULES.upgradeCost}.` : `Each upgrade costs ${RULES.upgradeCost} coins and you have ${S.coins}. Keep selling and come back for it.`),
    ...rows,
    btn(can ? 'Skip for now' : 'Continue ▶', () => { sfx('tap'); endCard(); }, can ? 'ghost' : 'primary')));
}

// ---- the end of the loop ----

function endCard() {
  S.phase = 'done';
  save();
  hooks.hud();
  log('loop_complete', { day: S.day, coins: S.coins, xp: S.xp });
  setModal(card('Come back tomorrow',
    h('p', {}, 'That is one full loop: fight, price, sell, upgrade. In the app, play is capped at one loop a day, so the shop is always waiting tomorrow.'),
    h('div', { class: 'stats' }, stat('Coins', S.coins), stat('Shop level', S.level), stat('Local partners', `${S.partners.length} of ${PARTNERS.length}`), stat('Shop List', `${S.shopList.length} saved`)),
    btn('Play the next day (demo)', () => { sfx('tap'); S.day++; S.phase = 'dungeon'; save(); city(); }, 'primary'),
    btn('Download event log', downloadLog),
    btn('Start over', () => { resetState(); title(); go('shop', { idle: true }); }, 'ghost')));
}

function downloadLog() {
  const blob = new Blob([JSON.stringify(getLog(), null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'shopkeeper-events.json' });
  a.click();
  URL.revokeObjectURL(a.href);
}

// handle for debugging and automated playtests
(window as unknown as Record<string, unknown>).__shopkeeper = { S, game, getLog };
