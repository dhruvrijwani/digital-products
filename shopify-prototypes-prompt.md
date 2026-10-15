# MASTER PROMPT: 5 Shopify digital-product prototypes (one run)

You are building five independent, self-contained, sales-demo-quality prototypes for Shopify digital products. I will demo them to agency clients, so animation quality, feel and polish matter more than code volume. Nothing here needs a backend or real Shopify code yet.

## Workflow (follow in order)
1. Give me a short plan (max 10 lines) covering all five, then start building. Do not wait for approval.
2. Create the folders `idea-01` to `idea-05` and a root `index.html` launcher (see "Launcher").
3. Build the ideas one at a time, in order. Finish each completely (including its README) before starting the next.
4. After each idea, do a self-check: no console errors, no broken asset paths, all interactions in the spec actually work. Fix before moving on.
5. At the end, give me a summary: how to run, what each demo shows, and anything you could not do or had to substitute.

## Shared rules (apply to every idea)
- Stack: vanilla HTML, CSS and JS. No build step. Must work by opening `index.html` or running `npx serve`.
- Libraries via CDN only: GSAP (+ Flip, ScrollTrigger plugins, all free), Lenis for smooth scroll where specified. No frameworks.
- Each folder is fully self-contained: own `index.html`, `styles.css`, `app.js`, `data/*.json`, `assets/`, `README.md`.
- Keep rendering code separate from mock data (JSON), so the data can be swapped for Shopify data later.
- Invented brands, copy and visuals only. Do NOT copy any real brand's assets, naming, copy or code. For idea 01, take the interaction pattern only from the reference.
- Media: no copyrighted material. Use royalty-free images and vertical video (Pexels, Mixkit, Unsplash) downloaded into `assets/`. If downloading fails, generate CSS or canvas animated gradient placeholders so every demo works offline.
- Performance: animate only `transform`, `opacity` and `clip-path`. Target 60fps. Pause off-screen videos with IntersectionObserver. `preload="metadata"`. Lazy-load images.
- Accessibility: keyboard operable, visible focus states, correct ARIA roles, focus trap in dialogs, focus returns to the trigger on close.
- Respect `prefers-reduced-motion`: replace motion with simple fades.
- Responsive: desktop, tablet and mobile (375px) must all look intentional, not just shrunk.
- Visual quality: each idea gets its own distinct, deliberate art direction (palette, type pairing, spacing). Avoid generic templated looks. Use `/mnt/skills`-style frontend-design thinking if available: strong typography, one accent colour, confident whitespace.
- Each README contains: what the demo shows, how to run it, and a short mapping of which parts would become a Shopify product-card snippet, theme app extension block/embed, section, or product/shop metafield later. Do not implement Shopify code now.

## Launcher (root `index.html`)
A clean dark landing page titled "Shopify Prototype Lab" with five animated cards (one per idea: number, name, one-line description, "Open demo" link). Staggered entrance animation, hover lift. Links go to `idea-0X/index.html`.

## Animation references (use as needed)
- GSAP Flip: https://gsap.com/docs/v3/Plugins/Flip/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- GSAP eases: https://gsap.com/docs/v3/Eases/
- Lenis smooth scroll: https://lenis.darkroom.engineering/
- Motion (spring and layout ideas): https://motion.dev
- View Transitions API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Shopify Dawn (real product-card and theme markup for realism): https://github.com/Shopify/dawn
- Free media: https://www.pexels.com/videos/ , https://mixkit.co/free-stock-video/ , https://unsplash.com

---

## IDEA 01: Hyper Card (expanding collection card)

Reference for interaction pattern only: https://www.thehypertoolkit.com/hyper-card/demo (if I attached screenshots, use them to understand the states). Invented brand: "Fieldnote Active". Dark, warm, editorial look, one gold/amber accent, serif headings.

**Collection page:** header with title, product count, a sort pill and a cart icon with counter. Responsive grid, 3 columns desktop, 2 on tablet and mobile. 8 products in `data/products.json`, each with title, price, 3 colours, sizes, rating, rating count, badge label ("New", "Summer Collection", "Bestseller"), a vertical UGC video, 3 features, 3 reviews (quote, author, helpful count, a highlighted phrase). Each card: 4:5 image, name, price, stars, colour swatches, and a small "video chip" at the bottom-left of the image (9:16 muted looping thumbnail plus a label pill).

**Interaction and animation spec:**
1. Hover (desktop): chip scales about 1.1 with a springy ease, the thumbnail starts playing, the label pill expands, the chip tilts toward the cursor (max about 4deg), the card image zooms about 1.02. About 220ms.
2. Click chip: GSAP Flip morphs the chip into a centred 9:16 player (height min(80vh, 720px), rounded corners, 1.5px accent border with glow). Backdrop fades to about 70% dark with 6px blur, the grid behind scales to 0.985. About 550ms, ease power3.inOut. Video plays muted with a small unmute button.
3. After the player settles, three tab pills (Features, Reviews, Options) slide out from behind the player's right edge, staggered 60ms, slight overshoot.
4. Features: the player Flip-shrinks to a small 9:16 thumbnail at the top-right of the panel (video keeps playing). The panel reveals with a clip-path wipe. Numbered badges pop in (scale 0.6 to 1), a highlight sweep animates behind the key phrase (background-size 0 to 100%), a tilted secondary product image floats in with light mouse parallax.
5. Reviews: quotes fade up in word groups, the highlighted phrase gets the same marker sweep, "helpful" counts count up from 0.
6. Options: product image, name, price, "in stock" label. Colour swatches with an animated selection ring, label and image crossfade on change. Size pills with a sold-out strikethrough state. Add to cart button as a state machine (idle, loading spinner, checkmark morph), header cart counter bumps. Wishlist heart with a small burst on toggle.
7. Tab switching: active-tab indicator slides, panel content crossfades and slides in the direction of tab order.
8. Close: Esc, backdrop click or close button. Reverse Flip back to the chip, focus returns to it.

**Mobile (<768px):** modal becomes a full-height bottom sheet with drag handle and swipe-down to dismiss. Tabs become a bottom segmented bar. Hover effects become tap.

---

## IDEA 02: Compare Dock

Invented brand: "Northline Audio" (headphones and speakers). Light, crisp, technical look: off-white background, graphite text, one electric-blue accent, a grotesk or mono type pairing.

**Collection page:** 8 products in `data/products.json`, each with title, price, image, rating, and 8 to 10 comparable specs (battery hours, weight, driver size, ANC yes/no, water rating, colours, etc.). Each card has a small "Compare" checkbox pill at the top-right of the image.

**Interaction and animation spec:**
1. Hover on the pill: it expands from an icon to "+ Compare". Ticking it plays a draw-on checkmark and a soft ring pulse, and the card lifts slightly with an accent outline.
2. A dock slides up from the bottom (spring ease) once the first item is ticked: 3 slots with dashed placeholders. A ticked product's image flies into the next free slot (use GSAP Flip, arc path, about 500ms). Max 3 items; ticking a 4th shakes the dock and shows a small tooltip.
3. Each slot has a remove "x"; removal flies the thumbnail back out and collapses the slot.
4. A "Compare now" button activates when 2+ items are chosen, with a subtle pulse. Click opens a full-width comparison sheet that expands out of the dock (Flip). Columns are the chosen products; rows are specs.
5. Table animation: rows stagger in; the best value in each row gets an animated highlight sweep and a small "best" badge; a "Show differences only" toggle animates rows collapsing and expanding (height plus opacity, no layout jank).
6. A sticky header in the sheet keeps product images and Add to cart buttons visible while the table scrolls.
7. Close with Esc, backdrop click or close button, and the sheet collapses back into the dock. Selections persist while on the page.
8. Mobile: the dock becomes a compact bar with count and thumbnails; the comparison becomes a horizontally swipeable column set with sticky row labels.

---

## IDEA 03: Scroll-Story Sections pack

Invented brand: "Aureline" (skincare/premium home fragrance). Calm, luxurious look: warm neutral palette, high-contrast editorial serif plus a clean sans, generous whitespace.

Build one long demo page with six premium scroll-animated sections, using Lenis smooth scroll and GSAP ScrollTrigger. A small fixed side label shows the section name and number as you scroll (e.g. "02 / Pinned Story").

1. **Hero text-mask reveal:** a headline revealed line by line from a mask, a background image scaling down on load, and a slow parallax on scroll.
2. **Pinned product story:** the product image stays pinned while 4 text steps scroll past; each step swaps the image state (crossfade or clip-path wipe) and animates a progress line.
3. **Horizontal collection rail:** vertical scroll drives a horizontal track of 6 product cards; cards have depth (slight scale and rotation based on distance from centre).
4. **Marquee proof bar:** two opposing-direction marquees (press names as invented text, review snippets) that accelerate with scroll velocity.
5. **Split-image reveal:** two image halves close like curtains to reveal a benefit statement, scrubbed by scroll.
6. **Sticky stacking cards:** 4 ingredient cards that stack and scale back as the next one arrives.

Each section is a clearly separated component (own CSS block and JS init function) with a short comment at the top explaining its settings, so it can later become a Shopify section with schema settings (headings, images, colours, speed). Add a settings panel (a small floating "Tweak" menu) that lets a viewer change accent colour, animation speed multiplier and reduced-motion on/off live, to demonstrate configurability.

---

## IDEA 04: Creator Video Pipeline

Invented brand: "Loop Studio". Playful but clean look: soft off-white, deep violet accent, rounded shapes, friendly rounded sans.

One page with a top switcher for three views, all driven by shared state saved in `localStorage` (no backend, mock only), so the story flows end to end:

1. **Creator upload form:** drag-and-drop zone that animates on drag-over; fake upload with a progress ring and file preview; fields for name, Instagram handle, product they used (dropdown), a consent checkbox. Submit plays a success animation and adds the clip to the queue.
2. **Merchant approval queue:** a card stack (Tinder-style) and a list toggle. Swipe or use buttons or keyboard (arrow keys) to Approve or Reject; cards fly out with rotation. Approving opens a small "Attach to products" step with animated product chips. A counter shows pending, approved and rejected, animating on change. Include 6 seeded pending clips.
3. **Storefront shoppable wall:** a masonry grid of approved clips with hover autoplay. Clicking opens a stories-style full-screen viewer: progress bars at the top, tap left/right to move, a product tag card sliding up from the bottom with price and Add to cart. Newly approved clips appear in the wall with an entrance animation.

Add a "Reset demo" button. Mobile: the views become a bottom tab bar; the viewer is full-screen.

---

## IDEA 05: Fit Finder from Reviews

Invented brand: "Standard Issue" (denim and basics). Clean, minimal look: stone and black palette, one tomato-red accent, condensed sans headings.

A single product page (PDP) with a "Find my size" button opening a drawer. Use mock data in `data/product.json`: sizes XS-XXL with measurements, plus 40 mock reviews with a size purchased, a reviewer height and fit comment ("runs small", "true to size", "runs large", with a few variants of phrasing).

**Interaction and animation spec:**
1. The drawer slides in from the right with a stagger. The quiz is exactly 2 questions: (1) height and usual size (a slider with a live animated ruler plus a size pill selector), (2) fit preference (Snug / Regular / Relaxed) as three illustrated cards with hover states. Progress dots animate between steps.
2. Answering the second question plays a short "analysing reviews" animation (counting up the number of reviews considered), then reveals the recommendation: a large size letter that morphs in, a confidence meter that fills, and a one-line reason.
3. **Review-mined fit signal:** a horizontal distribution bar (Runs small / True to size / Runs large) animating to the computed percentages, computed in JS from the mock reviews. Below it, 3 relevant reviews (matching the user's height range) with the fit keyword highlighted by a marker sweep.
4. "Select this size" scrolls to the PDP size selector, pre-selects the size with a ring animation, and pulses the Add to cart button.
5. The size pills on the PDP show a small "recommended" tag after a quiz result. A "Retake" link resets with a reverse animation.
6. Mobile: the drawer becomes a bottom sheet with a drag handle.

README note for this idea: say clearly that the recommendation logic is a simple mock heuristic for demo purposes and what real data would be needed (order and return data, review text) for production.

---

## Final deliverable
Five working folders, a root launcher, per-folder READMEs, and a final summary message. Do not leave TODOs in the UI. If something in a spec is impossible in this environment, implement the nearest working substitute and tell me in the summary.