# Idea 09 · Smart Buy Bar

A sticky add-to-cart bar for long product pages. When the real buy box scrolls out of view, its Add to cart button morphs into a floating bar. The bar holds the product, a section scroll-spy, a colour picker, a live "order within … get it by …" delivery countdown and a reading-progress line.

Demo: **Northline Audio** (the brand from idea 02) on a long headphone product page, in dark mode. Photos from Pexels.

## The pitch

| | |
| --- | --- |
| **Pain point** | On mobile the buy button is gone after the first swipe. Shoppers read specs, reviews and FAQ, then have to scroll all the way back up to buy. Generic "sticky ATC" apps are a plain grey strip with a button. |
| **What it moves** | Conversion rate (the buy action is always one tap away), plus urgency from a real delivery promise ("get it Monday") instead of fake timers. |
| **Who buys it** | Any store with long product pages: electronics, supplements, furniture, apparel with size guides. |
| **Suggested price** | $79 one-time (snippet) or $9 to $12/month as an app. It's the cheapest of the five, an easy add-on sale. |
| **Why it's catchy** | The morph from button to bar, the scroll-spy pill that glides under section names, and a countdown that's honest: it computes the next dispatch cutoff and skips weekends. |

## What the demo shows

**Morph in**
- Scroll past the buy box: a ghost of its button flies into the bar's button while the bar rises in, and its contents stagger.
- Scroll back up and the bar drops away.

**Bar contents**
- Product thumbnail, title, live price (it follows the quantity), and the colour name.

**Section scroll-spy**
- Overview, Sound, Specs, Reviews, FAQ. A pill glides to the section in view.
- Clicking a name scroll-animates there and moves focus to the heading.

**Colour picker in the bar**
- Changing colour in the bar updates the gallery, the buy box and the stock line, and vice versa.

**Delivery countdown**
- "Order within 4h 58m 12s to get it Monday, 19 Oct". It ticks every second.
- Computed from a dispatch cutoff (3 pm), 2 business days in transit and no weekend dispatch, all set in `data/product.json`.

**Reading progress**
- A thin mint line on the bar's edge tracks how far through the page you are.

**Add to cart (bar or buy box)**
- The product image flies to the cart icon and both buttons confirm.

**Merchant settings (top-left)**
- Toggle section nav, countdown, colour picker and progress line, and switch the bar between top and bottom. This shows clients what's configurable.

**Mobile**
- The bar becomes a full-width bottom strip with the thumbnail, price and Add to cart. Nav and colours hide to keep it thumb-friendly.

**Accessibility**
- The bar is `aria-hidden` and untabbable while off screen, and focus is handed back to the main button if the bar hides while focused.
- Section links move focus. Reduced motion turns the morph, glide and scroll animation into instant changes.

## How to run

```bash
npx serve .     # repo root → http://localhost:3000/idea-09/
```
`index.html` also works from disk (it uses the `data/product.js` mirror; regenerate it with `node tools/sync-data.mjs`).

## Shopify build notes (later)

| Prototype piece | Shopify home |
| --- | --- |
| Bar | Theme app extension **app embed** on product templates. It reads `product` and the selected variant from the theme's product form, and its button submits that same form so properties and selling plans stay intact. |
| Colour picker | Mirrors the theme's variant picker and fires its change event (Dawn: `variant-selects`) |
| Section nav | Auto-built from the product template's sections (`[id^="shopify-section"]` with a heading), or set in app settings |
| Delivery countdown | Cutoff, transit days, weekend rules and holidays in app settings (shop metafield `smart_bar.delivery`). Optionally per-market using `localization.country`. |
| Stock line | `variant.inventory_quantity` (when the merchant allows showing it) |
| Merchant toggles | App settings page or theme editor settings on the app embed |
