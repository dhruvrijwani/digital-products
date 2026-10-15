# Idea 01 · Loupe (Fieldnote Active)

A collection page where product cards carry a creator clip. The chip on the card grows into a player, and three tabs unfold beside it: Details, Reviews and Shop.

This is the premium light redesign. The original dark version is kept in `../idea-01-v1/` for comparison.

Fieldnote Active is an invented brand. Clips and photos come from Pexels (free licence).

## This demo runs the production code

The demo owns only the page itself: header, intro, grid, cards, sort and bag. Everything that opens from a chip is the Loupe runtime in `loupe/`, a minified build of the production code, which lives in a private repo.

`data/products.json` uses the same JSON shape the Shopify Liquid snippet emits, so the demo and a real store run identical code.

## What it shows

**Design.** The concept is that every clip is a field note from someone who trained in the piece, and the card opens like a notebook spread.

- **Colour:** a cool chalk-white page, graphite-blue ink, one field-green accent.
- **Type:** Archivo throughout, expanded for display and normal width for UI.
- **One load moment:** the collection title stretches out to full width, then the cards settle in.

**Card chip.**

- At rest, the chip shows the card's label (New, Bestseller, Summer Collection).
- On hover or keyboard focus:
  - the thumbnail lifts with a spring and starts playing
  - the label rolls over to "Watch 0:16"
  - the thumbnail tilts toward the cursor
- On phones, clips preview muted while on screen.
- The first chip pulses once to show it can be opened.

**Open.**

- The chip's own video element flies into the player and keeps playing.
- The page recedes behind a frosted light veil.
- The title, price and tabs settle in under the player.

**Unfold.** Choosing a tab slides the player left and unfolds the details card from behind it. The title and tabs glide into the card header.

**Details.**

- Features are chapters of the clip: each has a timestamp that seeks the video, and the active chapter's bar fills as it plays.
- The progress bar on the video is split into the same chapters.
- Key phrases get a hand-drawn underline.
- "Also in" tiles jump to Shop with that colour picked.

**Reviews.**

- The score counts up and the stars fill.
- Quotes rise in word pairs, the key phrase is underlined, and "helpful" counts count up.

**Shop.**

- The image crossfades with the colour.
- The selection ring glides between swatches and sizes.
- Sold-out combinations follow the chosen colour (Ink has no S on the first product).
- A size must be picked before adding.
- Add to bag runs idle → progress line → drawn check, then the bag bumps and a toast appears.
- The card swatches and the Shop colour stay in step.
- The wishlist heart bursts.

**Phones.**

- The stage is a bottom sheet.
- Picking a tab shrinks the video into a mini player beside the title; tap it to go back.
- Swipe the sheet down to close it.

**Accessibility.**

- Dialog with an inert page behind it, a focus trap, and focus returned to the chip.
- Arrow keys, Home and End on the tabs.
- Native radios, a polite live region, and a pause button on the video.
- Reduced motion swaps every movement for short fades and stops previews.

## How to run

From the repo root:

```bash
npx serve .
# open http://localhost:3000/idea-01/
```

Opening `index.html` from disk also works: browsers block `fetch()` on `file://`, so the page falls back to `data/products.js`. After editing `data/products.json`, run `node tools/sync-data.mjs` from the repo root.

The only network dependency is Google Fonts (Archivo).

## File map

| File | Role |
| --- | --- |
| `index.html` | Page shell and `window.LoupeConfig` for the demo (fake cart, notes, wishlist on) |
| `styles.css` | Page styles and the Loupe theme variables |
| `app.js` | Renders the grid from data, card swatches, sort, bag counter, toast, entrance |
| `loupe/` | Minified Loupe runtime (generated, do not edit) |
| `data/products.json` | Catalogue in the Loupe data contract (prices in cents, variants, chapters) |
| `data/products.js` | Generated `file://` mirror of the JSON |
| `assets/` | Product photos and UGC clips |

## In Shopify

Loupe ships as a Shopify app (an app embed plus a product-card block) and as a theme integration. Both live in a private repo.
