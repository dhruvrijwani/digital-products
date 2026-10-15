# Shopify Prototype Lab

Eleven self-contained, sales-demo prototypes for Shopify digital products. Vanilla HTML/CSS/JS with GSAP (and Lenis for idea 03) from a CDN. No build step and no backend.

```bash
npx serve .
# open http://localhost:3000 (the launcher links to every demo)
```

Opening `index.html` (or any `idea-0X/index.html`) straight from disk also works.

| Folder | Demo | Brand |
| --- | --- | --- |
| `idea-01/` | Hyper Card: a UGC video chip expands into a player with Features / Reviews / Options | Fieldnote Active |
| `idea-02/` | Compare Dock: a tick-to-compare tray expands into a best-value spec table | Northline Audio |
| `idea-03/` | Scroll-Story Sections: six ScrollTrigger sections plus a live Tweak panel | Aureline |
| `idea-04/` | Creator Video Pipeline: upload → swipe approval → shoppable stories wall | Loop Studio |
| `idea-05/` | Fit Finder from Reviews: a two-question quiz with a review-mined size signal | Standard Issue |

### Round 2: sellable features

| Folder | Feature | Pain point | Moves | Suggested price |
| --- | --- | --- | --- | --- |
| `idea-06/` | Reward Ladder Cart | Carts stall just under the free-shipping line | AOV | $99 one-time / $19 mo |
| `idea-07/` | Build-a-Box Bundles | Shoppers buy one item when they'd buy a set | AOV, units/order | $129 one-time / $24 mo |
| `idea-08/` | Personalisation Studio | Personalisation sold blind from a text box | New revenue, CVR | $149 one-time / $29 mo |
| `idea-09/` | Smart Buy Bar | Buy button scrolls away on long pages | CVR | $79 one-time / $9 mo |
| `idea-10/` | Gift Mode | Gifting on Shopify is clumsy by default | AOV, seasonal CVR | $99 one-time / $15 mo |
| `idea-11/` | Pip, the shopping companion | Browsers leave silently; exit popups get ignored | CVR, engagement | $29–49 mo + custom character |

Each folder has its own `README.md` covering what it shows, how to run it, and the Shopify mapping. Round-2 READMEs also include the sales pitch (pain point, buyer, price, and what makes it catchy).

**Mock data**

Mock data lives in each `idea-0X/data/*.json`. Browsers block `fetch()` on `file://`, so every JSON file has a generated `.js` mirror next to it. After editing a JSON file, run:

```bash
node tools/sync-data.mjs
```

**Credits and brands**

All brands, copy and reviews are invented. Photos and clips are from Pexels (free licence) and were picked to avoid visible third-party logos.
