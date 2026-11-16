# ShopKeeper

A single-player shopkeeper game prototype for the ShopBack app. Sell loot in your shop by day, fight through the Techno Dungeon for new stock by night. One full loop plays in a browser in under 10 minutes.

Built with Phaser 3, TypeScript and Vite. It is a static site with no backend.

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
4. **Night:** three rooms of the Techno Dungeon. Fill a six-slot loot bag.
5. **Offer card:** one skippable, sponsored example deal picked from your interests.
6. **Morning:** price last night's loot.
7. **Shop day:** customers react, buy, barter or leave. Start the ShopBack campaign once for 3x customers and 10% cashback per sale.
8. **Close:** revenue, cashback and profit, next to an estimate of the day without the campaign.
9. **Upgrade,** then the "come back tomorrow" card.

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
| `src/art.ts` | Pixel-art sprites (customers, enemies, items), drawn in code |
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
