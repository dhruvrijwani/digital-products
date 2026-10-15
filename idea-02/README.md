# Idea 02 · Compare Dock (Northline Audio)

A collection grid where shoppers tick up to three products into a docked tray. The tray then expands into a full-width spec comparison that marks the best value in each row.

Northline Audio is an invented brand. Product photos are from Pexels (free licence), chosen without visible third-party logos and lightly graded. All specs are mock data.

## What the demo shows

**Compare pill**
- Each card has a pill at the top-right of the image.
- On hover or keyboard focus it expands from an icon to "Compare" with a clip-path reveal.
- Ticking it draws on a checkmark, sends out a soft ring pulse, and lifts the card with an electric-blue outline.

**Dock**
- Springs up from the bottom (elastic ease) on the first tick.
- Has three dashed placeholder slots.
- The ticked product's image flies into the next free slot. `Flip.fit` places the thumbnail over the card image, then x and y tween with different eases (`power1.inOut` and `back.in`) so the path arcs. About 520ms.

**Limit of three**
- Ticking a fourth shakes the dock and shows a tooltip. The checkbox stays unticked.

**Removing**
- The × on a slot flies the thumbnail back to its card and unticks it.
- The remaining thumbnails slide over with a Flip reflow, and the freed placeholder redraws.
- "Clear" empties everything with a stagger.

**Compare now**
- Stays disabled below two products. When it becomes active it pulses a few times.

**Comparison sheet**
- Expands out of the dock: the sheet clip-path grows from the dock's exact rectangle to full width, while the dock thumbnails Flip-morph into the sheet's column headers.
- Columns are the chosen products and rows are the 13 specs from `data/products.json`.
- Rows stagger in. The best value in each row gets a highlight sweep and a "Best" badge. "Best" comes from per-spec rules in the data (`higher`, `lower`, `yes`). Ties and rows with fewer than two comparable values get no badge.
- "Show differences only" collapses rows where every product matches (height and opacity) and brings them back.
- The header row with images, prices and Add to cart buttons is sticky while the table scrolls. Add to cart updates the header cart counter.

**Close**
- Esc, a backdrop click or the close button. The thumbnails fly back into the dock and the sheet collapses into it.
- Focus returns to "Compare now", and selections persist for the rest of the visit.

**Mobile (<768px)**
- The dock becomes a compact bar with a count, three small thumbnails and a Compare button.
- The comparison becomes a full-screen sheet with horizontally swipeable, snap-aligned product columns and sticky row labels.

**Accessibility**
- Real checkboxes with labels; the dock count is a polite live region.
- Modal sheet with a focus trap and an inert page behind it.
- The differences toggle is a `role="switch"` checkbox, and the table uses ARIA table roles.

**Reduced motion**
- Flights, springs, sweeps and the shake are replaced with fades.

## How to run

```bash
npx serve .          # from the repo root
# open http://localhost:3000/idea-02/
```

Opening `index.html` from disk also works: it falls back to the generated `data/products.js` mirror. After editing the JSON, run `node tools/sync-data.mjs` from the repo root. GSAP (core + Flip) loads from a CDN.

## File map

| File | Role |
| --- | --- |
| `index.html` | Header, grid container, dock and sheet skeletons |
| `styles.css` | Tokens, cards, compare pill, dock, sheet/table, mobile layout |
| `app.js` | Rendering, compare state, flights, sheet open/close, best-value logic, diff toggle |
| `data/products.json` | Shop copy, the spec schema (label, unit, format, which direction wins) and 8 products |
| `assets/img/` | 800×800 product photos |

## Shopify mapping (later, not implemented)

| Prototype piece | Shopify home |
| --- | --- |
| Compare pill on each card | Small snippet (`snippets/compare-toggle.liquid`) rendered inside `card-product.liquid`, or a theme app extension **app block** in the product card |
| Dock + comparison sheet + scripts | Theme app extension **app embed** (one global tray per page, works on collection and search pages) |
| Spec schema (`specs[]`: label, unit, format, better) | Shop metafield `northline.compare_schema` (JSON), editable by the merchant, or app settings |
| Per-product spec values | Product metafields in a `specs` namespace (`specs.battery_hours`, `specs.weight_g`, `specs.anc` …), typed number/boolean/list, read with the Storefront API or `product.metafields` in Liquid |
| Product title, price, image | Standard product object (`product.featured_image`, `product.price`) |
| Add to cart in the sheet | Ajax Cart API `POST /cart/add.js` with the first available variant, then `sections` rendering to refresh the cart bubble |
| Collection header | Section `main-collection-banner` |
| Selections persisting across pages (future) | `sessionStorage`, or a cart attribute when it should survive into checkout |
