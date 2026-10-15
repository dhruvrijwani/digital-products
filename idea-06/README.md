# Idea 06 · Reward Ladder Cart

A drop-in cart drawer that turns "free shipping over $100" into a visible, tiered reward ladder: free shipping, then a free gift, then a % discount. Every add moves the bar. Every tier unlocks with a small celebration. The upsells shown are the items that get the shopper to the next tier.

Demo store: **Halfmile**, an invented training-apparel brand. Photos from Pexels.

## The pitch

| | |
| --- | --- |
| **Pain point** | Merchants set a free-shipping threshold, but shoppers rarely see how close they are, so carts sit just under it. Default theme cart drawers show a subtotal and a checkout button, and nothing that motivates the next add. |
| **What it moves** | Average order value (more items per order). Secondary: checkout rate, because shipping cost shown early stops being a surprise at checkout. |
| **Who buys it** | Any store with a free-shipping threshold or gift-with-purchase promos: apparel, beauty, food, home. |
| **Suggested price** | $99 one-time (snippet installed by the agency), or $19/month as an app with an admin settings page. |
| **Why it's not a commodity** | A goal bar alone is common. This one adds three things: a gift picker that auto-adds the gift and removes it if the cart drops below the tier, upsells ranked by "this one unlocks the next reward", and unlock moments that feel like a game rather than a banner. |

## What the demo shows

**Grid**
- "Quick add" flies the product thumbnail along an arc into the cart icon, then the drawer slides in.

**Reward ladder**
- Three nodes sit at their real thresholds: $100 free shipping, $150 free gift, $200 15% off.
- The fill animates with every change, and the message counts down ("Add $18 to unlock 15% off").
- **Unlock:** the node springs into a check with a ring burst and confetti, and the screen reader announces it.
- **Losing a tier:** the node shakes.

**Free gift**
- Unlocking the gift tier opens a chooser with three gifts.
- The chosen gift drops into the cart at $0 with a "Free gift" badge, and "Change" reopens the chooser.
- If the cart falls below the tier, the gift is removed. It comes back automatically if the shopper climbs back up.

**Line items**
- Quantity steppers with rolling prices. Removed rows collapse, and the list reflows with GSAP Flip.

**"Get there faster" upsells**
- Products not in the cart, sorted so the cheapest item that crosses the next threshold comes first.
- Each card is tagged "Unlocks free gift" or "$46 closer to free gift".
- After the last tier the heading becomes "Pairs with your kit".

**Totals**
- Subtotal, reward discount, shipping ("Free" once unlocked) and total, all rolling.
- The announcement bar always shows the next unmet reward.

**Merchant settings (bottom-left)**
- Drag the tier thresholds; thresholds stay in order and the ladder rebuilds live.
- Toggle the upsell row on or off. This shows clients the app is configurable.

**Mobile**
- The drawer becomes a bottom sheet you can drag down to close.

**Accessibility and reduced motion**
- Focus-trapped dialog, Esc to close, live announcements for unlocks and gift changes.
- Reduced motion replaces flights and confetti with instant updates.

## How to run

```bash
npx serve .     # repo root → http://localhost:3000/idea-06/
```
Opening `index.html` from disk works too (it uses the `data/store.js` mirror; regenerate it with `node tools/sync-data.mjs`).

## Shopify build notes (later)

| Prototype piece | Shopify home |
| --- | --- |
| Cart drawer + ladder | Theme app extension **app embed** that replaces or augments the theme's cart drawer. It listens to `/cart.js` and the Section Rendering API for updates. |
| Tier thresholds, reward types, gift list | App settings stored in a shop metafield (`reward_ladder.config`, JSON), edited in an embedded admin page |
| Free shipping tier | Shopify automatic **shipping discount** with an order minimum, or a Shopify Function (delivery customization) |
| % off tier | Automatic **order discount** with a minimum subtotal (Discount Function or native automatic discount) |
| Free gift | Gift product added with `/cart/add.js` plus line-item property `_reward_gift`. A Cart Transform or Discount Function sets it to $0 and validates the threshold server-side. |
| "Get there faster" ranking | Client-side sort of Shopify's product recommendations API (`/recommendations/products.json`) by price vs. remaining gap |
| Merchant settings panel | Embedded admin page (Polaris) in the app |
