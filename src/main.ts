import Phaser from 'phaser';
import '@fontsource-variable/fredoka';
import './style.css';
import { ART, buildArt } from './art';
import { ITEMS, ItemId, RULES, estimateDay } from './econ';
import { DaySummary, RunSummary, S, getLog, hasSave, hooks, log, resetState, save } from './state';
import { btn, card, confetti, countUp, h, hero, icon, setHud, setModal, stars, toast } from './ui';
import { artUrl } from './art';
import { BRAND, pricingPanel } from './panels';
import { music, setMuted, sfx } from './audio';
import { buildScenery } from './scenery';
import { mountViewer } from './viewer3d';
import { ShopScene } from './scenes/ShopScene';
import { CITY_SPRITES, CityScene, PARTNERS, PARTNER_BONUS } from './scenes/CityScene';
import { DungeonScene } from './scenes/DungeonScene';
import offerData from './offers.json';
import { INTRO, UNLOCK_INFO, Unlock } from './levels';
import { PET_INFO } from './pet';
import { BRANCHES, Branch, NODES, anyAffordable, buy, costOf, lockReason, lvl, maxed, shelfCount, storageCap, walkInCount } from './upgrades';

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
    for (const k of ['cat', 'dog']) this.load.spritesheet(`pet_${k}`, `pets/${k}.png`, { frameWidth: 80, frameHeight: 80 });
  }
  create() {
    for (const [key, canvas] of Object.entries(ART)) this.textures.addCanvas(key, canvas);
    for (const k of ['hero', 'cust_hunter', 'cust_collector', 'cust_rusher', 'ped_a', 'ped_b', 'bot', 'drone', 'slime', 'guardian']) {
      this.anims.create({ key: k, frames: [{ key: `${k}_0` }, { key: `${k}_1` }], frameRate: k === 'drone' ? 12 : 5, repeat: -1 });
    }
    // painted backdrops and 3D-rendered sprites are high resolution: smooth them, keep pixel art crisp
    const smooth = ['pillar', 'deco_wood', 'deco_carpet', 'deco_curtains', 'deco_lights', 'pet_cat', 'pet_dog', 'shop_bg', 'city_bg', 'dungeon_bg_0', 'dungeon_bg_1', 'dungeon_bg_2', 'table', 'shadow', 'av_male', 'av_female', ...CITY_SPRITES.map((k) => `city_${k}`)];
    for (const k of smooth) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
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
  if (!(data as { idle?: boolean }).idle) stopShowcase(); // real play always ends the welcome slideshow
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
  const shownXp = Math.min(S.xp, RULES.xpLevel2);
  setHud(h('div', { class: 'hudbar' },
    h('span', { class: 'pill' }, icon('coin', 'ico s'), h('b', {}, S.coins)),
    h('span', { class: 'pill xp' },
      h('b', {}, `Lv ${S.level}`),
      h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
      h('small', {}, S.level >= 2 ? `${S.xp} XP` : `${shownXp}/${RULES.xpLevel2} XP`)),
    h('span', { class: 'pill' }, label),
    label.startsWith('Evening') ? btn(['⬆ Upgrades', anyAffordable() ? h('i', { class: 'dot' }) : null], () => { sfx('tap'); upgradeTree(() => { setModal(null); hooks.hud(); }); }, 'small upg') : null,
  ));
}
let hudLabel = '';
hooks.hud = () => hud(hudLabel);

const stat = (label: string, value: string | number, cls = '') => h('div', { class: `stat ${cls}` }, h('span', {}, label), h('b', {}, value));
// one tile per item type, with a count, so names never wrap unevenly
const lootRow = (ids: ItemId[]) =>
  h('div', { class: 'loot' }, ...[...new Set(ids)].map((id) => {
    const n = ids.filter((i) => i === id).length;
    return h('span', { class: 'lootitem' }, icon(`item_${id}`), h('b', {}, `×${n}`), h('small', {}, ITEMS[id].name));
  }));

// ---- title and onboarding ----

let showcase: number | undefined;
/** Any screen after the welcome screen stops the background slideshow. */
function stopShowcase() {
  window.clearInterval(showcase);
  showcase = undefined;
}

function title() {
  setHud(null);
  music('shop');
  // the welcome screen shows off the world behind it: the city, then the shop, and back
  stopShowcase();
  let where: 'city' | 'shop' = 'city';
  go('city', { idle: true });
  showcase = window.setInterval(() => {
    where = where === 'city' ? 'shop' : 'city';
    go(where, { idle: true });
  }, 7000);
  setModal(h('div', { class: 'title' },
    h('div', { class: 'tgroup top' },
      h('div', { class: 'logo' }, h('span', {}, 'Shop'), h('span', { class: 'k' }, 'Keeper')),
      h('p', { class: 'tagline' }, 'Entrepreneur by Day.', h('br', {}), 'Adventurer by Night.', h('br', {}), h('b', {}, 'You are the Shop Keeper!'))),
    h('div', { class: 'tgroup bottom' },
      h('div', { class: 'pillars' },
        h('span', {}, h('b', {}, '⚔️'), 'Fight'), h('span', {}, h('b', {}, '🏷️'), 'Price'),
        h('span', {}, h('b', {}, '🤝'), 'Haggle'), h('span', {}, h('b', {}, '⚡'), 'Sell out')),
      h('div', { class: 'titlebtns' },
        hasSave() && btn('Continue', () => { sfx('tap'); stopShowcase(); resume(); }, 'primary big pulse'),
        btn(hasSave() ? 'New game' : 'Play', () => { sfx('tap'); stopShowcase(); resetState(); go('shop', { idle: true }); avatarSelect(); }, hasSave() ? 'big' : 'primary big pulse')),
      h('p', { class: 'fine' }, `A prototype for the ${BRAND} app`)),
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
    petSelect();
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

function petSelect() {
  let kind: 'cat' | 'dog' = 'cat';
  const name = h('input', { class: 'petname', type: 'text', maxlength: '12', value: PET_INFO.cat.name, 'aria-label': 'Pet name', autocomplete: 'off' });
  let typed = false;
  name.addEventListener('input', () => (typed = true));
  const cards = (['cat', 'dog'] as const).map((k) => {
    const el = h('button', { class: `avatar ${k === kind ? 'picked' : ''}`, type: 'button', 'aria-pressed': String(k === kind) },
      h('div', { class: 'avstage' }, h('img', { src: `pets/${k}-portrait.png`, alt: '', draggable: 'false' })),
      h('b', {}, PET_INFO[k].label), h('small', {}, PET_INFO[k].blurb));
    el.addEventListener('click', () => {
      kind = k;
      sfx('tap');
      cards.forEach((c, i) => { const on = (['cat', 'dog'] as const)[i] === k; c.classList.toggle('picked', on); c.setAttribute('aria-pressed', String(on)); });
      if (!typed) name.value = PET_INFO[k].name;
    });
    return el;
  });
  setModal(card('Choose your companion',
    h('p', {}, 'They follow you everywhere, and fight beside you in the dungeon.'),
    h('div', { class: 'avatars' }, ...cards),
    h('label', { class: 'namerow' }, h('span', {}, 'Name'), name),
    btn('This one! ▶', () => {
      S.pet = { kind, name: name.value.trim().slice(0, 12) || PET_INFO[kind].name };
      save();
      sfx('deal');
      log('pet', { kind });
      interests();
    }, 'primary')));
}

function interests() {
  const picked = new Set<string>();
  const count = h('p', { class: 'fine count' }, 'Pick 3 to continue');
  const chips = offerData.categories.map((c) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false' }, h('span', {}, c.emoji), c.label);
    b.addEventListener('click', () => {
      if (picked.has(c.id)) picked.delete(c.id);
      else if (picked.size < 3) picked.add(c.id);
      b.setAttribute('aria-pressed', String(picked.has(c.id)));
      b.classList.toggle('on', picked.has(c.id));
      count.textContent = picked.size < 3 ? `Pick ${3 - picked.size} more` : 'All set';
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
  const earned = h('b', {}, '0');
  countUp(earned, d.revenue, 800, '+');
  if (d.sales) sfx('level');
  setModal(h('div', { class: 'card pop' },
    hero('Day 1', d.sales ? 'First sales!' : 'Tough crowd', d.sales ? `${d.sales} sale${d.sales > 1 ? 's' : ''} on your very first day.` : 'No sales today. Lower prices sell faster.'),
    h('div', { class: 'bignum' }, icon('coin'), earned, h('small', {}, 'coins earned')),
    h('p', {}, 'But the shelves are nearly bare. Head into the city, meet the neighbours, then find the old server mall in the park. Whatever you carry out of the Techno Dungeon is tomorrow’s stock.'),
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
  const daily = S.dungeonLevel >= INTRO.length;
  const level = INTRO[Math.min(S.dungeonLevel, INTRO.length - 1)];
  const reward = !daily && level.unlock ? UNLOCK_INFO[level.unlock] : null;
  setModal(h('div', { class: 'card pop' },
    daily
      ? hero('Daily Dungeon', 'Today’s run', 'A fresh layout every day. Pillars for cover, four rooms, and loot you cannot find anywhere else.')
      : hero(`Level ${S.dungeonLevel + 1} of ${INTRO.length}`, level.title, level.blurb),
    daily
      ? h('div', { class: 'reward' }, h('span', {}, '💎'), h('div', {}, h('b', {}, 'Special loot'), h('small', {}, 'Gold Chips and Prism Shards sell for far more than anything else.')))
      : reward && h('div', { class: 'reward' }, h('span', {}, reward.emoji), h('div', {}, h('b', {}, `Clear it to unlock: ${reward.name}`), h('small', {}, reward.text))),
    h('div', { class: 'keys' },
      stat('Move', 'Stick · WASD'),
      stat('Attack', S.unlocks.auto ? 'Automatic · J' : 'Button · J'),
      stat('Dodge roll', 'Button · K'),
      S.unlocks.bow ? stat('Bow', 'Drag to aim · L') : null),
    h('p', { class: 'fine' }, 'Five hearts, six bag slots. Red shapes show where an attack will land.'),
    btn('Enter ▶', () => { sfx('tap'); setModal(null); go('dungeon', { daily }); }, 'primary')));
}

hooks.runEnded = (r: RunSummary) => {
  go('shop', { idle: true });
  // everything carried out, plus whatever the pet already ran home
  const haul = [...r.banked, ...r.bag].sort((x, y) => ITEMS[y].value - ITEMS[x].value);
  const room = Math.max(0, storageCap() - S.stock.length);
  const kept = haul.slice(0, room);
  const overflow = haul.slice(room);
  const scrap = overflow.reduce((sum, i) => sum + Math.round(ITEMS[i].value * 0.5), 0);
  S.stock.push(...kept);
  S.coins += scrap;
  S.phase = 'morning';
  // clearing an introduction level moves you on and may unlock something
  let unlocked: Unlock | undefined;
  const levelBonus = r.complete ? 30 : 0;
  S.xp += levelBonus;
  if (r.complete && !r.daily && S.dungeonLevel < INTRO.length) {
    unlocked = INTRO[S.dungeonLevel].unlock;
    S.dungeonLevel++;
    if (unlocked === 'auto') S.unlocks.auto = true;
    if (unlocked === 'bow') S.unlocks.bow = true;
    log('level_cleared', { level: S.dungeonLevel, unlocked });
  }
  save();
  hud((hudLabel = `Night ${S.day}`));
  const rating = r.defeated ? 0 : r.complete ? 3 : r.rooms >= r.total / 2 ? 2 : 1;
  const info = unlocked ? UNLOCK_INFO[unlocked] : null;
  if (r.complete) sfx('level');
  setModal(h('div', { class: 'card pop' },
    hero(r.daily ? 'Daily Dungeon' : `Level ${S.dungeonLevel + (r.complete ? 0 : 1)}`,
      r.defeated ? 'Knocked out!' : r.complete ? 'CLEARED!' : 'Back safely',
      r.defeated ? 'You were carried out and dropped half your bag on the way.' : r.complete ? undefined : 'Clear every room to finish the level.'),
    stars(rating),
    h('div', { class: 'tiles' },
      h('span', {}, h('b', {}, `${r.rooms}/${r.total}`), h('small', {}, 'Rooms')),
      h('span', {}, h('b', {}, `+${r.rooms * RULES.xpRoom + levelBonus}`), h('small', {}, 'XP')),
      h('span', {}, h('b', {}, haul.length), h('small', {}, 'Loot'))),
    info && h('div', { class: 'reward new' }, h('span', {}, info.emoji), h('div', {}, h('b', {}, `Unlocked: ${info.name}`), h('small', {}, info.text))),
    haul.length ? lootRow(haul) : h('p', { class: 'fine' }, 'Your bag is empty.'),
    r.banked.length && S.pet ? h('p', { class: 'fine' }, `${S.pet.name} ran ${r.banked.length} of these home safely.`) : null,
    overflow.length ? h('p', { class: 'fine' }, `Stock room full (${storageCap()}). ${overflow.length} sold for scrap: +${scrap} coins.`) : null,
    r.lost.length ? h('p', { class: 'fine' }, `Lost: ${r.lost.map((i) => ITEMS[i].name).join(', ')}`) : null,
    btn('Continue ▶', () => { sfx('tap'); offerCard(); }, 'primary')));
  if (r.complete) confetti(unlocked ? 48 : 30);
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
    h('div', { class: 'sponsored' }, `Sponsored by ${BRAND} · Example only`),
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
  const slots = shelfCount();
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
  const base = { stock: d.startStock, prices: S.prices, slots: shelfCount() };
  const walkIns = walkInCount();
  const without = estimateDay({ ...base, customers: walkIns, campaign: false });
  const withC = estimateDay({ ...base, customers: walkIns * RULES.campaignMult + S.partners.length * PARTNER_BONUS, campaign: true });
  const other = d.campaignUsed ? without.profit : withC.profit;
  const max = Math.max(profit, other, 1);
  const bar = (label: string, note: string, v: number, cls: string) =>
    h('div', { class: 'cmp' }, h('span', {}, label, h('small', {}, note)), h('div', { class: 'bar' }, h('i', { class: cls, style: `width:${(v / max) * 100}%` })), h('b', {}, v));
  let verdict: string;
  if (d.campaignUsed) {
    verdict = profit > other
      ? `The campaign packed the shop: ${d.customers} customers instead of ${walkIns}. You gave back ${d.cashback} coins in cashback and still came out ${profit - other} ahead.`
      : `The campaign brought ${d.customers} customers instead of ${walkIns}, but this time the extra sales did not cover the cashback. More stock, or prices customers accept, makes it pay.`;
  } else {
    verdict = `No campaign today. Hit the ${BRAND} button tomorrow: about ${walkIns * RULES.campaignMult} customers instead of ${walkIns}.`;
  }
  log('summary', { profit, estimateOther: other, campaign: d.campaignUsed });
  S.phase = 'upgrade';
  save();
  hooks.hud();
  const ratio = d.startStock.length ? d.sales / d.startStock.length : 0;
  const rating = ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : d.sales ? 1 : 0;
  const headline = rating === 3 ? 'SOLD OUT!' : rating === 2 ? 'Great day!' : rating === 1 ? 'Shop closed' : 'Slow day';
  const big = h('b', {}, '0');
  countUp(big, profit, 1100, '+');
  const gain = profit - other;
  if (rating >= 2) sfx('level');
  setModal(h('div', { class: 'card pop' },
    hero(`Day ${S.day + 1}`, headline),
    stars(rating),
    h('div', { class: 'bignum' }, icon('coin'), big, h('small', {}, 'profit')),
    h('div', { class: 'tiles' },
      h('span', {}, h('b', {}, `${d.sales}/${d.startStock.length}`), h('small', {}, 'Sold')),
      h('span', {}, h('b', {}, d.revenue), h('small', {}, 'Revenue')),
      h('span', {}, h('b', {}, d.cashback ? `−${d.cashback}` : '0'), h('small', {}, 'Cashback'))),
    h('div', { class: `compare ${d.campaignUsed && gain > 0 ? 'win' : ''}` },
      h('div', { class: 'cmphead' },
        h('b', {}, `⚡ ${BRAND} campaign`),
        d.campaignUsed && gain > 0 ? h('span', { class: 'boost' }, `+${gain} coins`) : null),
      bar(d.campaignUsed ? 'With campaign' : 'No campaign', 'Your day', profit, 'you'),
      bar(d.campaignUsed ? 'Without it' : 'With a campaign', 'Estimate', other, 'est'),
      h('p', {}, verdict)),
    btn('Continue ▶', () => { sfx('tap'); levelCheck(); }, 'primary')));
  if (rating === 3) confetti();
}

function levelCheck() {
  if (S.level < 2 && S.xp >= RULES.xpLevel2) {
    S.level = 2;
    save();
    hooks.hud();
    sfx('level');
    log('level_up', { level: 2 });
    confetti(48);
    setModal(h('div', { class: 'card offer pop' },
      h('div', { class: 'sponsored' }, `${BRAND} reward · Example only`),
      hero('Level up', 'Shop Level 2!'),
      h('div', { class: 'offerbody' },
        h('div', { class: 'offeremoji' }, '🎟️'),
        h('div', {},
          h('b', { class: 'oproduct' }, 'Cashback boost unlocked'),
          h('div', { class: 'omerchant' }, 'Single use. Expires in 7 days.'),
          h('div', { class: 'ocash' }, '+x% Cashback'))),
      h('p', { class: 'fine' }, 'Levels come from playing, never from spending or chance. In the app, this would be a real discount tied to your account.'),
      btn('Claim ▶', () => { sfx('tap'); upgrade(); }, 'primary')));
  } else upgrade();
}

// ---- upgrade ----

let treeTab: Branch = 'store';

/** The upgrade tree: four branches, bought with coins. */
function upgradeTree(onDone: () => void) {
  const render = () => {
    const branch = BRANCHES.find((b) => b.id === treeTab)!;
    const nodes = NODES.filter((n) => n.branch === treeTab);
    // children sit under the node they need, so the tree reads top to bottom
    const ordered: { n: (typeof NODES)[number]; depth: number }[] = [];
    const add = (parent: string | undefined, depth: number) =>
      nodes.filter((n) => n.needs === parent).forEach((n) => { ordered.push({ n, depth }); add(n.id, depth + 1); });
    add(undefined, 0);
    const rows = ordered.map(({ n, depth }) => {
      const level = lvl(n.id);
      const full = maxed(n.id);
      const lock = lockReason(n.id);
      const cost = costOf(n.id);
      const pips = h('span', { class: 'pips', 'aria-label': `Level ${level} of ${n.levels.length}` },
        ...n.levels.map((_, i) => h('i', { class: i < level ? 'on' : '' })));
      const action = full ? h('span', { class: 'maxed' }, 'MAX')
        : lock ? h('span', { class: 'locked' }, '🔒')
        : btn([icon('coin', 'ico s'), h('b', {}, cost)], () => {
          if (!buy(n.id)) return;
          sfx('level');
          hooks.hud();
          render();
        }, 'buy');
      if (action instanceof HTMLButtonElement) action.disabled = S.coins < cost;
      return h('div', { class: `node d${Math.min(depth, 2)} ${full ? 'full' : ''} ${lock ? 'lock' : ''}` },
        h('span', { class: 'nemoji' }, n.emoji),
        h('div', { class: 'ntext' },
          h('div', { class: 'nname' }, h('b', {}, n.name), pips),
          h('small', {}, full ? n.levels[level - 1] : lock ?? n.levels[level])),
        action);
    });
    setModal(h('div', { class: 'card tree' },
      h('div', { class: 'treehead' }, h('h2', {}, 'Upgrades'), h('span', { class: 'pill' }, icon('coin', 'ico s'), h('b', {}, S.coins))),
      h('div', { class: 'tabs', role: 'tablist' }, ...BRANCHES.map((b) => {
        const t = h('button', { class: `tab ${b.id === treeTab ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(b.id === treeTab) }, h('span', {}, b.emoji), b.name);
        t.addEventListener('click', () => { treeTab = b.id; sfx('tap'); render(); });
        return t;
      })),
      h('p', { class: 'fine' }, treeTab === 'pet' && S.pet ? `${S.pet.name}: ${branch.blurb.replace('Your companion', 'your companion')}` : branch.blurb),
      h('div', { class: 'nodes' }, ...rows),
      btn('Done', () => { sfx('tap'); onDone(); }, 'primary')));
  };
  render();
}

function upgrade() {
  go('shop', { idle: true });
  hud((hudLabel = `Day ${S.day + 1}`));
  upgradeTree(endCard);
}

// ---- the end of the loop ----

function endCard() {
  S.phase = 'done';
  save();
  hooks.hud();
  log('loop_complete', { day: S.day, coins: S.coins, xp: S.xp });
  setModal(h('div', { class: 'card pop' },
    hero('Loop complete', 'See you tomorrow!', 'Fight, price, sell, upgrade: that is one full loop. In the app, play is capped at one loop a day, so the shop is always waiting.'),
    h('div', { class: 'stats' }, stat('Coins', S.coins), stat('Shop level', S.level), S.pet ? stat('Companion', `${S.pet.name} the ${PET_INFO[S.pet.kind].label}`) : null, stat('Dungeon', S.dungeonLevel >= INTRO.length ? 'Daily unlocked' : `Level ${S.dungeonLevel} of ${INTRO.length}`), stat('Local partners', `${S.partners.length} of ${PARTNERS.length}`), stat('Shop List', `${S.shopList.length} saved`)),
    btn('Play the next day ▶', () => { sfx('tap'); S.day++; S.phase = 'dungeon'; save(); city(); }, 'primary'),
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
