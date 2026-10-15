# Idea 11 · Pip, the shopping companion

A tiny character that lives on the store and reacts to how the shopper behaves.

- **Collection page:** Pip sneaks in from the bottom of the screen, hops onto products and pays compliments ("This one would look really good on you").
- **Clicking a product:** Pip gets very happy and rides along to the product page.
- **Product page:** Pip jumps onto the buttons the shopper needs, celebrates when they add to cart, and pulls out a discount billboard when they look like leaving. If they still leave, it gets very sad.

Demo store: **Wildpace**, an invented activewear brand. Photos from Pexels. Pip is drawn in SVG and animated with GSAP.

## Is this doable on Shopify? Yes.

| What Pip needs | How it works on Shopify |
| --- | --- |
| Appear on every page | A theme app extension **app embed**. The merchant toggles it on in the theme editor, no theme code changes. It's one small JS + CSS bundle (Pip is pure SVG). |
| Remember mood and position between pages | `sessionStorage`, exactly as this prototype does. Pip's position and mood are handed from one page to the next on every load. |
| Ride along to the product page | Same-origin page loads plus the cross-document **View Transitions API**: Chrome and Edge morph the product photo and Pip between pages; other browsers simply re-enter. |
| Read behaviour (hover, clicks, size picks, add to cart) | Ordinary DOM events on the theme's product cards and product form. Add to cart is detected from the form submit or from `/cart/add.js` responses. |
| Detect "about to leave" | Exit intent (cursor heading to the tabs), tab switching (`visibilitychange`), idle time, hovering Add to cart and backing off, flipping between options. All of this runs in the browser. |
| The discount on the billboard | The app creates **unique, single-use codes** with the Admin API (`discountCodeBasicCreate`) through an app proxy, then applies them with `/discount/CODE` or a cart update. A shared code like `PIP10` is only for the demo. |
| Merchant control | App settings: tone of voice (all lines are data), offer size, how many signals before an offer, which pages Pip appears on, a "never offer twice" cap and A/B testing. |
| Shopper control | A visible "Pip" switch in the header (in the prototype) that hides Pip for the session. |

### Things to get right in a real build

- **Don't train shoppers to wait for a discount.** Offer once per customer, not every visit. Use unique expiring codes and a holdout group to measure the true lift.
- **Annoyance budget.** Cap how often Pip speaks, never cover the buy button, and keep one tap to hide Pip.
- **Mobile has no exit intent.** On phones, idle time, tab switching and fast scrolls back to the top stand in for it (the prototype does this).
- **Performance.** Load Pip after the page is idle so it doesn't hurt Core Web Vitals.
- **Accessibility.** Pip is decorative (`aria-hidden`). Anything that matters (the offer, add to cart) is a real button and is announced in a polite live region. Reduced motion turns all jumping into instant moves.

## What the demo shows

**Collection (`index.html`)**
1. **Sneak-in:** Pip's sprout and eyes peek over the bottom edge ("Psst…"), it pops up, tiptoes in with a sneaky face, waves ("Hey you. Yes, you."), jumps onto the product nearest the middle of the screen and compliments it with hearts.
2. **Hover a product for about 1 second** (or tab to it with the keyboard): Pip jumps onto that photo with a product-specific line ("Plum. On you. Trust me.").
3. **On phones:** Pip compliments whichever product you stop scrolling on.
4. **Click a product:** an ecstatic face, a jump onto the card, a burst of hearts, "Ooh, good pick!", and then it rides to the product page. In Chrome the photo morphs into the product page hero and Pip carries over.
5. **Other reactions:** a fast scroll gets "Whoa, slow down!". 14 seconds idle sends Pip to sleep (zzz) and it wakes when you move. Click Pip to poke it.

**Product page (`product.html`)**
1. **Arrival:** Pip arrives where it left the card, hops, jumps onto **Add to cart** and points up at the sizes ("Told you. Now pick a size.").
2. **Choices:** a colour change gets a colour compliment, a size pick sends Pip jumping onto the button to point at it, and Add to cart without a size sends it onto the size row looking worried.
3. **Add to cart:** confetti, an ecstatic face, a jump under the cart icon and cheering.
4. **Drop-off pattern:** the **intent engine** scores signals. At 3 points:
   - **First time:** Pip looks worried ("Wait, wait, wait!") and pulls out a **billboard**: "Wait! Don't go! Take 10% off: PIP10 · Apply / No thanks".
   - **Apply:** the price updates (also on the collection page). Pip goes ecstatic and jumps onto the button: "Now it's a steal!"
   - **No thanks, ignored for 15 seconds, or Esc:** Pip gets **very sad**. Tears, drooping sprout, slow shuffle to the corner, sits down: "It would've looked great on you…"
   - **Shopper re-engages** (picks a size, browses photos): Pip perks up ("Oh? Oh!").
   - **Shopper adds to cart while Pip is sad:** "YOU CAME BACK!!"

| Signal | Points | How it's detected |
| --- | --- | --- |
| Cursor heads for the tabs or close button | +3 | `mouseout` through the top of the window |
| Switched tabs and came back | +2 | `visibilitychange` (hidden > 1.5 s) |
| Idle for 16 s | +2 | No pointer, scroll or keyboard input |
| Hovered Add to cart, then left | +1 | Hover > 350 ms without a click |
| Flip-flopping (5 option changes in 25 s) | +1 | Colour/size changes without adding |
| Picked a size | −1 | |
| Tried a colour, browsed photos, read reviews | −0.5 each | |

All weights, the threshold and every line Pip says live in `data/store.json`, so a merchant could tune them from settings.

**Pip Lab (bottom-right, for presenting only)**
- A live **drop-off risk meter** with the offer threshold marked, plus a log of every signal Pip noticed.
- Buttons to simulate exit intent, a tab switch and going idle, so the offer and sad sequences can be shown on demand in a meeting.
- A reset button to start over.

**Pip's moods:** idle, sneaky, curious, happy, ecstatic, worried, sad (with tears), sleepy. Pip blinks, breathes, and its eyes follow your cursor.

## How to run

```bash
npx serve .     # repo root → http://localhost:3000/idea-11/
```

- **View transitions:** the photo-and-Pip morph between pages needs Chrome or Edge served over http (`npx serve`).
- **From disk:** opening `index.html` directly works, but pages just cut instead of morphing.
- **Fresh start:** "Reset demo" in Pip Lab clears the session so the sneak-in plays again.

## Files

| File | Role |
| --- | --- |
| `index.html` | Collection page |
| `product.html` | Product page (`?p=product-id`) |
| `pip.js` | The character: SVG, moods, walk/jump with squash and stretch, speech bubble, billboard, hearts/confetti/tears, docking and scroll-following. Reusable on any page. |
| `app.js` | The brain: what Pip does on each page, the intent engine, the offer, sad and comeback flows, and Pip Lab |
| `styles.css` | Store styles, Pip styles, Pip Lab |
| `data/store.json` | Products, Pip's lines, the offer, and the intent weights and thresholds |

## Suggested pricing

This is the most "only on our store" of all the ideas: a brand mascot that actually works. A custom character per brand is agency work.

| Package | Price |
| --- | --- |
| Pip as an app | $29 to $49/month, or a usage tier tied to conversions |
| Branded custom character | $1.5k to $5k one-time setup on top |
