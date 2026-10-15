# Idea 08 · Personalisation Studio

A live personalisation preview for product pages. Shoppers type initials or a name and see it stamped on the product in real time. They can switch lettering, foil (gold, silver, copper, blind deboss) and placement, inspect it with a loupe, and add it to the bag as a paid add-on. A proof image is generated for the order.

Demo store: **Atelier Folio**, an invented leather-journal brand. The journal is drawn in SVG (leather gradient, procedural grain, stitching, page block), so any text renders on it without photography.

## The pitch

| | |
| --- | --- |
| **Pain point** | Most Shopify personalisation is a plain text field with "Enter your text". Shoppers can't see the result, so they hesitate, and merchants deal with typos, unreadable script and "that's not what I expected" returns. |
| **What it moves** | New revenue per order (the personalisation fee is pure margin), conversion (seeing it removes doubt) and fewer support tickets and returns (the proof plus validation). |
| **Who buys it** | Leather goods, jewellery, stationery, gifts, drinkware, pet tags: any store that already personalises or wants to start. |
| **Suggested price** | $149 one-time for one product type (agency setup), or $29/month as an app, the most clearly "monthly-worthy" of the five because it touches every personalised order. |
| **Why it's catchy** | The foil sweep after each keystroke, the hover tilt with a moving sheen, and the loupe that magnifies the stamp make it feel like a luxury configurator, not a form field. |

## What the demo shows

**Live stamp**
- Every keystroke re-stamps the cover with a small press effect and a light sweep across the foil.
- Long names shrink to fit their zone instead of overflowing.

**Modes**
- Initials (up to 3 characters, +$15) or Name (up to 14, +$20).
- The price rolls to include the fee, and "includes $15 personalisation" appears beside it.

**Lettering**
- Four styles. The style buttons preview the shopper's own text, not "Aa".

**Finish**
- Gold, silver and copper foil (metallic gradients), or blind deboss (pressed into the leather, with no foil).

**Placement**
- Bottom right, centre or top left, each shown as a small diagram.

**Leather**
- Cognac, black or forest. The cover colour crossfades.

**Validation**
- Characters that can't be stamped are stripped, and a message explains why.
- Add to bag with empty text asks for initials or offers to switch personalisation off.

**Inspect**
- On desktop the cover tilts toward the cursor with a moving sheen.
- A loupe magnifies whatever is under the pointer, which is the moment to show clients the foil detail.

**Download proof**
- Exports a PNG of the cover plus a spec strip (product, text, font, finish, placement, timestamp).
- In production this image is attached to the order so the workshop stamps exactly what was approved.

**Add to bag**
- A toast shows a thumbnail of the personalised cover.

**Switch off**
- The options collapse, the stamp clears and the fee disappears.

**Mobile**
- The preview sticks to the top half of the screen while the options scroll beneath it, so the shopper always sees the result.

**Accessibility**
- Every choice is a keyboard radiogroup, and the input has a live character count.
- The SVG description is updated with the full personalisation for screen readers.
- Reduced motion removes the stamp, sweep and tilt.

## How to run

```bash
npx serve .     # repo root → http://localhost:3000/idea-08/
```
`index.html` also opens directly from disk (it uses the `data/studio.js` mirror; regenerate it with `node tools/sync-data.mjs`).

## Shopify build notes (later)

| Prototype piece | Shopify home |
| --- | --- |
| Studio panel + preview | Theme app extension **app block** in the product form. The preview is either an SVG template per product type or a product photo with a defined text area (metafield `personalise.zone`: x, y, width, rotation). |
| Fonts, finishes, placements, limits | App settings per product, or product metafield `personalise.config` (JSON) |
| Text, font, finish, placement on the order | Line-item properties (`Initials`, `Lettering`, `Finish`, `Placement`), visible on the order and packing slip |
| Personalisation fee | Option A: a hidden "Personalisation" product added alongside, linked by a `_parent` property. Option B (cleaner): a **Cart Transform** function that adds the fee to the line price. |
| Proof image | Generated client-side and uploaded to the app (or rendered server-side). The URL is stored in a line-item property `_proof` and shown in the admin order page via an **admin block** extension. |
| Validation rules | Mirrored server-side in the app so properties can't be tampered with |
