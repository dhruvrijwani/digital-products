# Idea 10 · Gift Mode

A "This is a gift" switch for product pages. One tap wraps the product photo in paper and ribbon. The shopper picks a wrapping, writes a note that renders live on a card, hides prices from the packing slip and can pick a delivery day. Add to cart seals the note in an envelope.

Demo store: **Cacao & Co**, an invented craft-chocolate brand. Photos from Pexels.

## The pitch

| | |
| --- | --- |
| **Pain point** | Gifting on Shopify is clumsy by default: a "gift message" text box in the cart (if the theme has one), no wrapping choice, no way to hide prices, no date. Shoppers buying gifts leave for Amazon or a marketplace. |
| **What it moves** | Average order value (paid premium wrapping is close to pure margin), conversion during gifting seasons (Valentine's Day, Mother's Day, Black Friday, holidays) and fewer "please don't include the receipt" emails. |
| **Who buys it** | Chocolate, flowers, candles, jewellery, books, stationery, spirits: any store with gift-season spikes. |
| **Suggested price** | $99 one-time, or $15/month as an app (merchants keep it on all year because of the wrap revenue). |
| **Why it's catchy** | The paper slides in, the ribbon draws, the bow springs and the tag reads "For Maya". The demo makes clients smile, and that's the moment they buy. |

## What the demo shows

**Gift switch**
- Paper slides in from both sides over the product photo.
- The ribbons draw, the bow springs into place, the tag drops in and a "Gift wrapped" badge appears.
- The gift panel expands with a stagger.

**Wrapping**
- Kraft & twine (free), Noir & gold (+$6) or Blush botanical (+$6), with live paper, pattern and ribbon colours.
- The price updates ("includes $6 wrapping").

**Gift note**
- "To" and "From" fields feed the card ("Dear Maya, … — Sam") and the gift tag ("For Maya").
- Occasion chips (Birthday, Thank you, Thinking of you) type a starter message into the note with a caret.
- Handwritten or printed style, with a 160-character count.

**Delivery**
- "Hide prices on the packing slip" is on by default.
- "Arrive on a specific day" opens a date strip (two days out onwards, Sundays disabled).

**Summary**
- A live recap (wrapping, note excerpt, price visibility, arrival). The button reads "Add gift to cart · $60".

**Seal**
- On add to cart the note slides into an envelope, the flap folds, a wax seal stamps "C&C" and the envelope flies into the cart.

**Switching off or browsing**
- The wrap unwraps in reverse. Clicking a thumbnail unwraps it to show the photo.

**Mobile**
- Single column. Note fields stack under the card.

**Accessibility**
- The switch is a real `role="switch"`, and wrapping, note style and days are keyboard radiogroups.
- A live summary region, and reduced motion swaps every animation for instant states.

## How to run

```bash
npx serve .     # repo root → http://localhost:3000/idea-10/
```
`index.html` also opens directly from disk (it uses the `data/gift.js` mirror; regenerate it with `node tools/sync-data.mjs`).

## Shopify build notes (later)

| Prototype piece | Shopify home |
| --- | --- |
| Gift switch, wrap preview, note card | Theme app extension **app block** in the product form |
| Wrapping options and prices | App settings (shop metafield `gift_mode.wraps`). Paid wraps are hidden "gift wrap" products added with `_gift_parent`, or a **Cart Transform** that adds the fee to the line. |
| Note, to, from, hide prices | Line-item properties (`_gift_to`, `_gift_from`, `Gift note`, `_hide_prices`). The packing-slip template reads `_hide_prices` to omit prices. |
| Delivery date | Cart attribute `Delivery date`, validated by a **Delivery Customization** or checkout UI extension, and shown on the order |
| Seal animation | Front-end only (part of the block's JS) |
| Gift orders tagged | Shopify Flow, or an app webhook that tags orders with gift properties (`gift`), so staff pack them differently |
