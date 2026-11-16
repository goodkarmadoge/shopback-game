// Balance check: simulates 1,000 shop days per scenario and confirms that a
// campaign day beats a walk-in day, and that the pricing bands behave as designed.
// Run with: npm run simulate

import { ITEMS, ITEM_IDS, RULES, ItemId, mulberry32, reaction, simulateDay } from '../src/econ';

const DAYS = 1000;
const fullBag: ItemId[] = ['gear', 'gear', 'cell', 'gel', 'lens', 'lens', 'core'];
const pricesAt = (mult: number) =>
  Object.fromEntries(ITEM_IDS.map((id) => [id, Math.round(ITEMS[id].value * mult)])) as Record<ItemId, number>;

let failed = false;
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed = true;
};

console.log(`Stock: ${fullBag.join(', ')} (market value ${fullBag.reduce((s, i) => s + ITEMS[i].value, 0)})\n`);
console.log('price   | walk-in profit  sold | campaign profit  sold | campaign wins');
for (const mult of [0.7, 0.9, 1.0, 1.1, 1.25, 1.4]) {
  const rngA = mulberry32(1);
  const rngB = mulberry32(2);
  let wp = 0, ws = 0, cp = 0, cs = 0, wins = 0;
  for (let d = 0; d < DAYS; d++) {
    const base = { stock: fullBag, prices: pricesAt(mult), slots: RULES.shelfSlots };
    const w = simulateDay({ ...base, customers: RULES.walkIns, campaign: false }, rngA);
    const c = simulateDay({ ...base, customers: RULES.walkIns * RULES.campaignMult, campaign: true }, rngB);
    wp += w.profit; ws += w.sales; cp += c.profit; cs += c.sales;
    if (c.profit > w.profit) wins++;
  }
  const n = fullBag.length;
  const row = [
    `${Math.round(mult * 100)}%`.padEnd(7),
    `${(wp / DAYS).toFixed(0).padStart(8)}  ${((ws / DAYS / n) * 100).toFixed(0).padStart(8)}%`,
    `${(cp / DAYS).toFixed(0).padStart(9)}  ${((cs / DAYS / n) * 100).toFixed(0).padStart(8)}%`,
    `${((wins / DAYS) * 100).toFixed(0)}%`,
  ];
  console.log(row.join(' | '));
  if (mult >= 0.9 && mult <= 1.25) {
    check(`campaign day earns more on average at ${Math.round(mult * 100)}%`, cp > wp);
    check(`walk-in day does not sell out at ${Math.round(mult * 100)}% (${((ws / DAYS / n) * 100).toFixed(0)}% sold)`, ws / DAYS / n < 0.7);
  }
}

console.log('\nPricing bands');
check('79% of value is Delighted', reaction(79, 100) === 'delighted');
check('80% and 110% are Happy', reaction(80, 100) === 'happy' && reaction(110, 100) === 'happy');
check('111% and 140% are Hesitant', reaction(111, 100) === 'hesitant' && reaction(140, 100) === 'hesitant');
check('141% is Annoyed', reaction(141, 100) === 'annoyed');

process.exit(failed ? 1 : 0);
