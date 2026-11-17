# ShopKeeper: promotion card mockup directions

Five key frames from the current build and directions for turning them into a
promotion card mockup for the ShopBack app. The mockup itself is not in this folder.

All frames are portrait, 900 × 1600 px, captured from the game with the on-screen
joystick and action buttons hidden so they composite cleanly. The game's own HUD
(coins, hearts, bag) is left in.

## Key frames

| File | Moment | Best crop for a card |
| --- | --- | --- |
| `01-home-screen.png` | Title over the shophouse street, both shopkeepers outside | Top 45%: logo, hero line and shophouse row |
| `02-busy-shop-cashback.png` | Campaign live, shop full, a "+Cashback!" bubble, queue outside | Middle band: the red carpet with displays and customers |
| `03-haggle.png` | Bargain Hunter offers 105, player counters 172 on the heat slider | Bottom 45%: customer face, price and slider |
| `04-dungeon-combat-cat.png` | Shopkeeper and lucky cat landing a hit, drones closing in | Centre: hero, cat and enemies |
| `05-boss-fight-dog.png` | Vault Guardian boss, bow shot in flight, shiba at the shopkeeper's side | Centre to lower right: hero, shiba, arrow line and boss |

## What to build

A horizontal promotion card as it would sit in the ShopBack app's home feed, shown
inside a phone frame.

- **Card size:** ShopBack's exact card spec was not available when this was written.
  Work at **1200 × 628 px (about 1.91:1)** with 32 px rounded corners, and confirm
  the real size before final export. Keep text and faces inside the middle 80%.
- **Mockup:** a phone frame on a plain light background, the ShopBack home feed
  blurred or greyed behind, and this card as the one sharp, full-colour element.

## Layout

Split the card into two halves that meet on a soft diagonal, with the shopkeeper
on the seam. This is the hero line as a picture.

1. **Left half, day:** crop of `02-busy-shop-cashback.png` (red carpet, displays,
   delighted customers). Warm and bright.
2. **Right half, night:** crop of `05-boss-fight-dog.png` or
   `04-dungeon-combat-cat.png`. Dark teal with magenta and cyan light.
3. **Centre:** the shopkeeper, cut out and enlarged, with the lucky cat on the shop
   side and the shiba on the dungeon side. Cut them from the frames or re-render;
   they should be the largest things on the card.
4. **Top left:** the "ShopKeeper" logo lifted from `01-home-screen.png`.
5. **Bottom left:** headline and one-line subhead.
6. **Bottom right:** a pill button in ShopBack red.
7. **Optional inset:** the slider and price from `03-haggle.png` as a small tilted
   chip near the shop side, to show the haggle.

## Copy

- **Headline:** Entrepreneur by Day. Adventurer by Night.
- **Subhead:** Run your shop, haggle for the best price, and raid the Techno Dungeon for loot.
- **Button:** Play now
- **Badge (optional):** New game · Earn Cashback magic

Alternative headline if space is tight: **You are the Shop Keeper!**

## Style

- **Colour:** warm wood, cream and carpet red on the shop side; deep teal with
  magenta and cyan on the dungeon side. Use ShopBack red (about `#f1492c`, taken
  from screenshots, so check the official brand kit) for the button and badge only.
- **Type:** rounded, friendly display type; the game uses Fredoka. White headline
  with a soft dark shadow so it reads over both halves.
- **Cashback:** always shown as a good thing. Pink and gold sparkles, happy faces.
  Never worded as a fee, cost or deduction.
- **Finish:** a soft drop shadow under the card, and a gentle dark gradient behind
  the text for contrast.

## Steps

1. Create the 1200 × 628 canvas with rounded corners.
2. Place the shop crop left and the dungeon crop right; mask them on a diagonal.
3. Cut out and place the shopkeeper, cat and shiba on the seam.
4. Add the logo, headline, subhead and button.
5. Add Cashback sparkles drifting from the shop side toward the customers.
6. Check it at phone size: the headline and button must read at about 360 px wide.
7. Drop the card into the phone frame over a muted ShopBack home feed.

## Avoid

- The game's joystick and action buttons (already hidden in these frames).
- Shrinking a whole portrait screenshot into the card; crop to the action instead.
- Small text: nothing below about 28 px on the 1200 px canvas.
- Other brands' logos, and any real partner names.
