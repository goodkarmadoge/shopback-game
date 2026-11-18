// The ShopBack app home screen, mocked up as the way into the game. It is a plain DOM
// layer over the stage, laid out at 424px wide and scaled to fit. Only the ShopKeeper
// card is live: "Play now" hands over to the game's own welcome screen.

import { h } from './ui';

const W = 424;
const stage = document.getElementById('stage')!;
let layer: HTMLElement | null = null;

const svg = (d: string) => {
  const el = h('span', { class: 'hic' });
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return el;
};
const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  bookmark: '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"/><path d="M9.5 10l2 2 3.5-4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  user: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0"/>',
};

const STORES: [string, string, string, string, boolean][] = [
  ['Shopee', '#ee4d2d', '#fff', 'Up to 16%', true], ['Lazada', '#0f146d', '#fff', 'Up to 6%', false],
  ['Amazon', '#131a22', '#fff', 'Up to 4%', false], ['Klook', '#ff5b00', '#fff', 'Up to 25%', false],
];
const DEALS: [string, string, string, string, boolean][] = [
  ['Trip.com', '#2e6cf6', '#fff', 'Up to 9%', true], ['Dyson', '#111', '#fff', 'Up to 12%', true],
  ['Sephora', '#f1f2f5', '#151a2d', 'Up to 8%', true], ['Nike', '#111', '#fff', 'Up to 10%', true],
];

const tile = ([name, bg, fg, rate, up]: [string, string, string, string, boolean]) =>
  h('div', { class: 'htile' },
    h('div', { class: 'hlogo', style: `background:${bg};color:${fg}` }, up ? h('i', {}, 'Upsized') : null, name),
    h('small', {}, name), h('b', {}, rate));

function fit() {
  if (!layer) return;
  const k = stage.clientWidth / W;
  layer.style.transform = `scale(${k})`;
  layer.style.height = `${Math.ceil(stage.clientHeight / k) + 1}px`;
}
window.addEventListener('resize', fit);

export const homeOpen = () => !!layer;

/** Show the app home screen. `onPlay` runs when the ShopKeeper card's button is pressed. */
export function showHome(onPlay: () => void) {
  layer?.remove();
  const play = h('button', { class: 'hplay', type: 'button' }, 'Play now');
  play.addEventListener('click', () => {
    const el = layer;
    if (!el) return;
    layer = null;
    onPlay();
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 420);
  });
  const nav = (icon: keyof typeof ICONS, label: string, cls = '') =>
    h('span', { class: `hnavi ${cls}` }, svg(ICONS[icon]), label, cls.includes('new') ? h('i', {}, 'New') : null);

  layer = h('div', { class: 'apphome', role: 'region', 'aria-label': 'ShopBack home (mock-up)' },
    h('div', { class: 'hhead' },
      h('div', { class: 'hrow' }, h('b', { class: 'hhi' }, 'Hi, Sam'), h('span', { class: 'hsearch' }, svg(ICONS.search))),
      h('div', { class: 'hrow' }, h('span', { class: 'hlife' }, 'Lifetime earnings'), h('b', { class: 'hsum' }, '$500.00'))),
    h('div', { class: 'hsheet' },
      h('div', { class: 'hscroll' },
        h('div', { class: 'hcard' },
          h('img', { class: 'hart', src: 'home/keeper.jpg', alt: '', draggable: 'false' }),
          h('div', { class: 'hshade' }),
          h('div', { class: 'htag' }, 'New on ShopBack'),
          h('div', { class: 'hbody' },
            h('h1', {}, 'Shop', h('b', {}, 'Keeper')),
            h('p', {}, 'Shop by day, dungeons by night. ', h('b', {}, 'Play & earn Cashback.'))),
          play),
        h('div', { class: 'hdots' }, h('i', { class: 'on' }), h('i', {}), h('i', {})),
        h('div', { class: 'htabs' }, h('span', { class: 'on' }, 'Online'), h('span', {}, 'Travel'), h('span', {}, 'Play')),
        h('div', { class: 'hchips' }, h('span', {}, 'How to Earn'), h('span', { class: 'hot' }, '✦ Play ShopKeeper'), h('span', {}, 'Refer & Earn $30')),
        h('h2', {}, 'Popular Stores'),
        h('div', { class: 'hgrid' }, ...STORES.map(tile)),
        h('h2', {}, 'Upsized Cashback Deals', h('a', {}, 'See all deals')),
        h('div', { class: 'hgrid' }, ...DEALS.map(tile))),
      h('div', { class: 'hnav' },
        nav('home', 'Home', 'on'), nav('list', 'Categories'), nav('bookmark', 'ShopList', 'new'), nav('trophy', 'Quests'), nav('user', 'Account'))),
    h('p', { class: 'hnote' }, 'Mock-up of the app home screen. Only the ShopKeeper card is live.'));
  stage.append(layer);
  fit();
}
