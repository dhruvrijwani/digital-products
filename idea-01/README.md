# Idea 01 · Hyper Card (Fieldnote Active)

A collection page where every product card carries a small UGC video chip. The chip expands into a full player, and the player hands off to Features, Reviews and Options panels without leaving the grid.

Fieldnote Active is an invented brand. Photos and clips come from Pexels (free licence), colour-graded to fit the art direction.

## What the demo shows

**Collection grid**
- Eight products from `data/products.json`: 4:5 image, name, price, stars, colour swatches.
- Each image has a video chip (a muted 9:16 loop plus a badge pill: New, Summer Collection, Bestseller).
- Card swatches crossfade the card image.
- The sort pill reorders the grid with a GSAP Flip animation.

**Chip hover (desktop)**
- The chip springs to about 1.1×, the clip starts playing, and the pill expands to show "Watch".
- The thumbnail tilts up to 4° toward the cursor and the card image zooms 1.02×.
- Keyboard focus gets the same treatment.

**Chip click**
- GSAP Flip morphs the chip into a centred 9:16 player (`min(80vh, 720px)` tall, 1.5px amber border with glow) in 550ms, `power3.inOut`.
- The backdrop dims to 70% with a 6px blur, and the grid scales to 0.985.
- The video carries on from the chip's playhead. It plays muted, with an unmute button.

**Tab rail**
- Features, Reviews and Options slide out from behind the player's right edge, staggered 60ms with a slight overshoot.

**Features**
- The player Flip-shrinks into a mini 9:16 thumbnail at the panel's top-right and keeps playing. Click it to return to the full video.
- The panel reveals with a clip-path wipe. Numbered badges pop from 0.6 to 1 and marker highlights sweep behind the key phrases.
- A tilted secondary image floats in and follows the mouse with light parallax.

**Reviews**
- Quotes rise in word groups, the highlight sweeps behind the key phrase, and "helpful" counts count up from 0.

**Options**
- **Colour and image:** the product image crossfades when the colour changes, the colour label crossfades, and a selection ring glides between choices.
- **Sizes:** sold-out sizes get a drawn strikethrough.
- **Add to cart:** a small state machine runs idle → spinner → drawn checkmark → idle. The header cart counter bumps; the cart is lifted above the backdrop so you can see it.
- **Wishlist:** the heart toggles with an elastic fill and a particle burst.

**Tab switching**
- The active-tab indicator slides between tabs. Content crossfades and slides in the direction of tab order.

**Close**
- Esc, a backdrop click or the close button. The player Flip-fits back into the chip and focus returns to it.

**Mobile (<768px)**
- The dialog becomes a near full-height bottom sheet with a drag handle. Swipe down on the handle or the video to dismiss.
- Tabs become a bottom segmented bar.
- On touch devices there is no hover, so chip clips autoplay inline while on screen and a tap opens the player.

**Accessibility**
- Dialog with `aria-modal`, a focus trap, and inert page content behind it.
- Roving-tabindex tabs: arrow keys, Home and End.
- Native radio inputs for colour and size, a polite live region for cart and wishlist changes, and visible focus rings.

**Reduced motion**
- `prefers-reduced-motion` replaces Flip, slides, springs and sweeps with short opacity fades.
- Off-screen chip videos pause through IntersectionObserver.

## How to run

From the repo root or this folder:

```bash
npx serve .
# open http://localhost:3000/idea-01/
```

Opening `index.html` straight from disk also works. Browsers block `fetch()` on `file://`, so the page falls back to `data/products.js`, a generated mirror of the JSON. After editing `data/products.json`, regenerate the mirror:

```bash
node tools/sync-data.mjs   # from the repo root
```

Libraries come from a CDN (GSAP 3.12.5 core + Flip), so the first load needs a network connection.

## File map

| File | Role |
| --- | --- |
| `index.html` | Page shell: header, grid container, dialog skeleton |
| `styles.css` | Tokens, grid, chip, stage, panels, mobile sheet |
| `app.js` | Rendering from data, hover, Flip transitions, tabs, options state, focus trap, sheet drag |
| `data/products.json` | Mock catalogue: products, colours, sizes, video, features, reviews |
| `data/products.js` | Generated `file://` mirror of the JSON (do not edit) |
| `assets/img/` | Graded 4:5 product photos (one per colourway) |
| `assets/video/` | 540×960 UGC clips + poster frames |

## Shopify mapping (later, not implemented)

| Prototype piece | Shopify home |
| --- | --- |
| Card markup (`cardMarkup` in `app.js`) | `snippets/card-product.liquid` override, or a Hyper Card snippet rendered by the theme app extension |
| Video chip + expanded player + tabs | Theme app extension **app block** (`blocks/hyper-card.liquid`) with JS/CSS assets. The merchant adds it to the collection grid. |
| Global stage/dialog + scripts | Theme app extension **app embed** so the dialog markup and scripts load once per page |
| Collection header, sort pill, count | Section `main-collection-product-grid` (Dawn already has sort and count) |
| `product.video` (UGC clip, creator) | Product metafield `fieldnote.ugc_video` (file reference) and `fieldnote.ugc_creator` (single-line text), or a metaobject list for several clips |
| `badge` | Product metafield `fieldnote.badge_label`, or derived from tags/collections |
| `features[]` (title, body, highlight) | Metaobject `product_feature` + product metafield list reference |
| `reviews[]` | Reviews app API, or product metafields `reviews.rating` / `reviews.rating_count` plus a curated `fieldnote.featured_reviews` metaobject list |
| `colors[]`, `sizes[]`, availability | Native variant options + `variant.available`. Colour hex from a swatch metafield or Shopify's native swatches. |
| Add to cart state machine | Ajax Cart API `POST /cart/add.js`, then the `cart-icon-bubble` section rerenders |
| Wishlist | App-owned customer metafield or a wishlist app API |
| Shop copy (`collection`, `intro`) | `collection.title` / `collection.description` |
