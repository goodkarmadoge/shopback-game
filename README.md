# ShopKeeper

A single-player shopkeeper game prototype for the ShopBack app. Sell loot in your shop by day, fight through the Techno Dungeon for new stock by night. One full loop plays in a browser in under 10 minutes.

Built with Phaser 3, TypeScript and Vite. It is a static site with no backend.

## The three states of a day

1. **Store Open (day).** Set prices, tap **Open Shop!** (the door sign flips to OPEN) and trade. A clock shows how long until closing and how many customers are still to come.
2. **Dungeon Exploration (evening).** Leave the shop at dusk, walk to the Techno Dungeon and fight through its rooms. The HUD shows a pip for each room. Pull back anywhere on the field to aim the bow: time slows by a quarter and the aim can be held for 2 seconds (upgradable). A placeholder 16:9 ad slot shows on the way back to the surface.
3. **Idle Time & Store Management (night).** The shop is closed and yours: rearrange displays, check Personal Offers at the counter, feed your pet, buy upgrades at the workbench, rest on the couch, or sleep to start the next day. Step outside and the other shops are shut and the dungeon gate is locked until tomorrow.

The Room branch of the upgrade tree adds furniture: a proper bed, rug, armchair, posters and a floor lamp.

## Entry point

The app opens on a mock-up of the ShopBack home screen (`src/home.ts`). Its ShopKeeper card's **Play now** button launches the game; **‹ ShopBack** on the game's welcome screen goes back. Add `?game` to the URL to skip straight to the game.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` writes a static site to `dist/` that can be hosted from any path.

## The loop

1. Choose a shopkeeper, then tap three things you are shopping for.
2. **Tutorial day:** three starter items, two customers. Set prices and barter once.
3. **Evening:** walk the City. Partner with local businesses on your street, then find the old server mall in the park.
4. **Night:** one dungeon level. Fill a six-slot loot bag.
5. **Offer card:** one skippable, sponsored example deal picked from your interests.
6. **Morning:** price last night's loot.
7. **Shop day:** walk up to any display case and tap Change display (or + Stock) to choose what it shows from the stock room, and haggle. After a rejected counter the slider stays on your last offer. Hit the ShopBack button (top right) once for 3x customers and 10% cashback per sale.
8. **Close:** revenue, cashback and profit, next to an estimate of the day without the campaign.
9. **Upgrade,** then the "come back tomorrow" card.

## Companion and upgrades

- **Companion:** after choosing a shopkeeper you pick and name a pet, a lucky cat or a black-and-tan shiba. It follows you in the shop and city and attacks enemies in the dungeon. Models are in `assets-src/pets/`, rendered to sprites with `node scripts/render-pets.cjs`.
- **Upgrade tree** (`src/upgrades.ts`): four branches bought with coins, opened after each shop day and from the Upgrades button in the city.
  - **Store:** shelves (4, 6, 9), storage, shop sign, pre-orders, VIP customers, and four cosmetics that change the shop's look and make customers tolerate higher prices.
  - **Combat:** melee damage, hearts, energy shield, heal on room clear, roll cooldown, bow damage.
  - **Backpack:** loot slots, 6 up to 12.
  - **Pet:** damage, attack speed, a saddlebag for extra loot, and the homing run, which sends the pet back to the store with your bag so that loot is safe even if you fall.

## Haggling, cashback and the promotion calendar

- **Haggling** is one sheet with one slider and one button. Slide toward their offer (green) or your price (red); the button reads Deal, Counter or Hold firm to match. Each counter costs the customer a heart.
- **Cashback** on campaign sales does three things: it brings customers who would not have come, it makes them 5% more willing to pay, and one in three comes back as an extra walk-in the next day.
- **Promotion calendar** (`src/promos.ts`): each day of the week has a theme that makes some loot worth more, such as Gear Up Monday or Flashy Friday. The pricing screen shows the week, and the dungeon intro shows tomorrow's theme so you know what to bring back.

## Dungeon progression

- **Five introduction levels**, one per night. Level 1 unlocks auto attack, Level 3 unlocks the bow (drag the bow button to aim, release to fire; L on desktop), Level 5 is the Vault Guardian.
- **Daily Dungeon** opens after Level 5: four rooms generated from the date, with pillars for cover and special loot (Gold Chip, Prism Shard) that sells for far more.
- Levels live in `src/levels.ts`.

Controls in the dungeon: virtual stick and two buttons on touch; WASD or arrows, J or click to attack, K or space to dodge on desktop.

## Balance check

```bash
npm run simulate
```

Simulates 1,000 shop days per price point and fails if a campaign day does not beat a walk-in day, if a walk-in day sells out, or if the pricing bands are wrong.

## Where things live

| Path | What |
| --- | --- |
| `src/econ.ts` | All rules and numbers: items, customers, pricing bands, bartering, day simulation. No DOM or Phaser. |
| `src/scenes/ShopScene.ts` | The shop day: customers, shelves, bartering, campaign |
| `src/scenes/DungeonScene.ts` | Combat, enemies, loot bag |
| `src/main.ts` | The flow between screens: onboarding, results, offer card, summary, upgrades |
| `src/scenes/CityScene.ts` | The City hub: walk around, partner with businesses, enter the dungeon |
| `src/art.ts` | Small effects and HUD glyphs drawn in code |
| `src/sprites.ts` | Rendered sprites for customers, enemies, loot, chest, coin and tables (`public/sprites`, built by `python3 scripts/build-sprites.py` from the renders in `assets-src/gen`) |
| `src/scenery.ts` | Painted shop, dungeon and city backdrops, drawn in code at 2x |
| `src/viewer3d.ts` | Live three.js preview of the shopkeeper models on the select screen |
| `src/audio.ts` | Synthesised music and sound effects |
| `src/style.css` | UI styling. ShopBack-style colour tokens are at the top. |
| `src/offers.json` | Mock offer cards (invented merchants) |
| `src/lines.json` | Pre-generated barter dialogue |
| `public/models/` | Shopkeeper 3D models (GLB, rigged, with a walk cycle) |
| `public/avatars/` | Sprite sheets and portraits rendered from those models |
| `assets-src/city/` | City buildings and props (GLB), from the Operation: Merlion project |
| `public/city/` | Sprites rendered from those models |

## 3D assets

The world is 2D, drawn at 720x1280 for a 360x640 play area, so 3D-rendered art keeps its detail.

- **Shopkeepers:** two models generated with Higgsfield (concept image, then image-to-3D with rigging and a walk animation). The select screen shows them live in three.js. In play, each is a sprite sheet rendered from the model: 8 directions by 6 walk frames.
- **City:** shophouses, the Merlion, Marina Bay Sands, supertrees, trees and street props come from the Operation: Merlion project's models, rendered to sprites from the game's camera angle.

To re-render after changing a model, start the dev server, then run the scripts:

```bash
npm run dev -- --port 5199
```

```bash
node scripts/render-avatars.cjs
```

```bash
node scripts/render-city.cjs
```

## Prototype limits

- Coins have no cash value. Offer cards and the level 2 discount are mock examples and are labelled as such.
- Save data and the analytics event log stay in the browser's local storage. The end card can download the log as JSON.
- ShopBack colours are approximated from public screenshots, and the brand name is a single constant (`BRAND` in `src/panels.ts`).
