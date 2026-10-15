# Idea 07 · Build-a-Box Bundles

A "build your own box" page block. Shoppers pick a box size, fill every slot with minis, and save more on bigger boxes. Each item flies into the box, and a full box closes its lid, ties a ribbon and becomes one bundle in the cart.

Demo store: **Ritual Supply**, an invented home-fragrance brand. Photos from Pexels.

## The pitch

| | |
| --- | --- |
| **Pain point** | Shoppers buy one candle when they'd happily buy a set. Shopify's native bundles are fixed combinations. Letting shoppers choose their own mix, with a visible "fill the box" goal, is what turns browsing into a multi-item order. |
| **What it moves** | Average order value and units per order. It also works as a gifting entry point ("build a box for someone"). |
| **Who buys it** | Beauty, candles, snacks, coffee, tea, socks, pet treats: anything with small, mixable SKUs. |
| **Suggested price** | $129 one-time as a section installed by an agency, or $24/month as an app with a bundle editor. |
| **Why it's catchy** | The box itself is the progress bar. A dashed, numbered slot is a stronger "add one more" cue than any banner, and the closing lid gives a satisfying finish. |

## What the demo shows

**Box sizes**
- 3, 5 or 7 minis at 10%, 15% or 20% off, on a segmented control with a sliding pill (arrow keys work).
- Shrinking the box flies the overflow items back to their cards.
- Growing it pops in new empty slots and reopens the lid.

**Adding**
- "Add to box" flies the product photo along an arc into the next empty slot, and the slot springs when the item lands.
- Product cards show a count badge, and the same mini can be added twice.

**Progress**
- "4 of 5 filled. Add 1 more to save 15%" with a meter.
- Items total, box saving and box price all roll as values change.

**Full box**
- The lid swings shut in 3D, the ribbon ties itself and a "Ritual box" tag stamps on.
- The button switches to "Add box to cart · $108.80".

**Edits and blocked adds**
- "Open the box to change items" swings the lid open again. The × on an item flies it back to its card and the slots reflow (Flip).
- Adding to a full box shakes it and nudges the next bigger size.

**Add box to cart**
- The closed box shrinks into the cart icon and the cart count bumps.
- The box then reopens empty for another round.

**Mobile**
- The box becomes a bottom tray showing slot thumbnails, the count and the price, and taps open into the full box.
- Items fly into the tray thumbnails.

**Accessibility**
- Real buttons, a radiogroup for sizes, slot labels ("Slot 2: Rose Quiet") and live announcements.
- Reduced motion swaps flights, lid and ribbon animations for instant states.

## How to run

```bash
npx serve .     # repo root → http://localhost:3000/idea-07/
```
`index.html` also opens directly from disk (it uses the `data/box.js` mirror; regenerate it with `node tools/sync-data.mjs`).

## Shopify build notes (later)

| Prototype piece | Shopify home |
| --- | --- |
| Builder page | Theme **section** (`sections/build-a-box.liquid`) on a dedicated page template, or a theme app extension **app block** |
| Box sizes and discounts | Section settings or app config (metafield `build_a_box.tiers`). Discount applied with a **Discount Function** that checks the bundle's line-item property and item count. |
| Eligible minis | A collection picked in section settings (`collection.products`) |
| "Add box to cart" | One `/cart/add.js` call adding every mini with a shared property `_box_id` and `_box_size`, or a **Cart Transform** (`linesMerge`) that shows them as one "Ritual box" parent line |
| Box visual + lid | Pure front end (CSS/JS asset of the block). The merchant can pick kraft, white or black box colours in settings. |
| Inventory | Each mini keeps its own inventory. Sold-out minis disable their "Add to box" button. |
