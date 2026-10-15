/* ==========================================================================
   Fieldnote Active · demo storefront
   Plays the part of a Shopify theme: renders the collection grid from
   data/products.json (the same contract the Liquid snippet emits) and drops a
   <loupe-chip> on each card. Everything that opens from a chip is loupe/loupe.js.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

  const el = {
    title: $("#collectionTitle"),
    intro: $("#collectionIntro"),
    count: $("#productCount"),
    sort: $("#sortSelect"),
    grid: $("#grid"),
    bag: $("#bag"),
    bagCount: $("#bagCount"),
    toasts: $("#toasts"),
  };

  const state = { shop: null, products: [], bag: 0 };

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.products;
    // Browsers block fetch() on file://, so use the generated mirror there.
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const res = await fetch("data/products.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (err) {
      if (mirror()) return mirror();
      throw err;
    }
  }

  /* ---------------- cards ---------------- */

  const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.43 5.08 5.57.67-4.1 3.84 1.07 5.52L10 14.2l-4.97 2.71 1.07-5.52L2 7.55l5.57-.67z" fill="currentColor"/></svg>';

  function colours(p) {
    const option = p.options.find((o) => /colou?r/i.test(o.name));
    if (!option) return [];
    const index = p.options.indexOf(option);
    return option.values.map((v) => {
      const variant = p.variants.find((x) => x.options[index] === v.name && x.available) || p.variants.find((x) => x.options[index] === v.name);
      return { name: v.name, hex: v.swatch && v.swatch.color, image: variant && variant.image, variantId: variant && variant.id };
    });
  }

  function cardMarkup(p) {
    const list = colours(p);
    const first = list[0] || { name: "", image: p.image };
    return `
      <li class="card" data-handle="${esc(p.handle)}">
        <div class="card__media">
          <img class="card__img" src="${esc(first.image || p.image)}" alt="${esc(p.title)} in ${esc(first.name)}" width="900" height="1125" loading="lazy" decoding="async">
        </div>
        <div class="card__body">
          <div class="card__line">
            <h2 class="card__title">${esc(p.title)}</h2>
            <span class="card__price">${esc(p.priceLabel)}</span>
          </div>
          <div class="card__line card__line--meta">
            <div class="card__swatches" role="radiogroup" aria-label="${esc(p.title)} colour">
              ${list
                .map(
                  (c, i) =>
                    `<button class="dot" type="button" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(c.name)}" data-index="${i}" style="--c:${esc(c.hex || "#ccc")}"></button>`
                )
                .join("")}
            </div>
            <span class="card__rating" aria-label="Rated ${p.rating.value} out of 5 from ${p.rating.count} reviews">${STAR}<span aria-hidden="true">${p.rating.value.toFixed(1)} (${p.rating.count})</span></span>
          </div>
        </div>
      </li>`;
  }

  function renderGrid() {
    el.title.textContent = state.shop.collection;
    el.intro.textContent = state.shop.intro;
    el.count.textContent = `${state.products.length} products`;
    el.grid.innerHTML = state.products.map(cardMarkup).join("");
    $$(".card", el.grid).forEach((card) => {
      const p = state.products.find((x) => x.handle === card.dataset.handle);
      // The chip carries the whole product contract, exactly as the Liquid snippet renders it.
      const chip = document.createElement("loupe-chip");
      chip.setAttribute("data-product", JSON.stringify(p));
      $(".card__media", card).appendChild(chip);
      wireSwatches(card, p);
    });
  }

  function crossfade(media, src, alt) {
    const current = $$(".card__img", media).pop();
    if (!current || current.getAttribute("src") === src) return;
    const next = new Image();
    next.className = "card__img";
    next.alt = alt;
    next.decoding = "async";
    next.src = src;
    next.style.opacity = "0";
    current.after(next);
    const show = () => {
      const a = next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 150 : 480, easing: "linear" });
      next.style.opacity = "";
      a.finished.then(() => $$(".card__img", media).forEach((n) => n !== next && n.remove()));
    };
    next.complete ? show() : next.addEventListener("load", show, { once: true });
  }

  function setColour(card, p, index, focus) {
    const list = colours(p);
    const c = list[index];
    if (!c) return;
    $$(".dot", card).forEach((d, i) => {
      d.setAttribute("aria-checked", String(i === index));
      d.tabIndex = i === index ? 0 : -1;
      if (focus && i === index) d.focus();
    });
    crossfade($(".card__media", card), c.image, `${p.title} in ${c.name}`);
    // The Shop tab opens on the colour picked here.
    const chip = $("loupe-chip", card);
    if (chip && c.variantId) chip.setAttribute("data-selected-variant", String(c.variantId));
  }

  function wireSwatches(card, p) {
    const group = $(".card__swatches", card);
    group.addEventListener("click", (e) => {
      const dot = e.target.closest(".dot");
      if (dot) setColour(card, p, Number(dot.dataset.index));
    });
    group.addEventListener("keydown", (e) => {
      const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const dots = $$(".dot", group);
      const current = dots.findIndex((d) => d.getAttribute("aria-checked") === "true");
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      setColour(card, p, (current + step + dots.length) % dots.length, true);
    });
  }

  /* ---------------- sort (FLIP reorder) ---------------- */

  function sortProducts(mode) {
    const list = [...state.products];
    if (mode === "price-asc") list.sort((a, b) => a.price - b.price);
    if (mode === "price-desc") list.sort((a, b) => b.price - a.price);
    if (mode === "rating") list.sort((a, b) => b.rating.value - a.rating.value || b.rating.count - a.rating.count);
    const cards = $$(".card", el.grid);
    const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    list.forEach((p) => el.grid.appendChild(cards.find((c) => c.dataset.handle === p.handle)));
    cards.forEach((card, i) => {
      const a = before.get(card);
      const b = card.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;
      if (reduced()) {
        card.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 220 });
        return;
      }
      card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 760,
        easing: EASE,
        delay: i * 18,
        fill: "backwards",
      });
    });
  }

  /* ---------------- bag ---------------- */

  function updateBag(bump) {
    el.bagCount.textContent = String(state.bag);
    el.bagCount.dataset.empty = String(state.bag === 0);
    el.bag.setAttribute("aria-label", `Bag, ${state.bag} item${state.bag === 1 ? "" : "s"}`);
    if (bump && !reduced()) {
      el.bagCount.animate([{ transform: "scale(0.6)" }, { transform: "scale(1.25)", offset: 0.55 }, { transform: "none" }], { duration: 520, easing: "ease-out" });
    }
  }

  function toast(product, variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<img src="${esc((variant && variant.image) || product.image)}" alt=""><div><b>Added to bag</b><span>${esc(product.title)}${variant ? ", " + esc(variant.options.join(" / ")) : ""}</span></div>`;
    el.toasts.appendChild(node);
    const enter = reduced()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: "translateY(16px) scale(0.98)" }, { opacity: 1, transform: "none" }];
    node.animate(enter, { duration: 520, easing: EASE });
    setTimeout(() => {
      node.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: 260, easing: "ease-in", fill: "forwards" }).finished.then(() => node.remove());
    }, 2600);
  }

  document.addEventListener("loupe:added", (e) => {
    state.bag += e.detail.quantity || 1;
    updateBag(true);
    toast(e.detail.product, e.detail.variantId);
  });

  // Keep the card image in step with the colour picked in the Shop tab.
  document.addEventListener("loupe:variant", (e) => {
    const { product, options } = e.detail;
    const card = el.grid.querySelector(`.card[data-handle="${CSS.escape(product.handle)}"]`);
    const colour = options && (options.Colour || options.Color);
    if (!card || !colour) return;
    const p = state.products.find((x) => x.handle === product.handle);
    const index = colours(p).findIndex((c) => c.name === colour);
    if (index > -1) setColour(card, p, index, false);
  });

  /* ---------------- entrance ---------------- */

  function entrance() {
    if (reduced()) return;
    // One moment: the title stretches out to its full width, then the cards settle in.
    el.title.animate(
      [
        { fontStretch: "72%", opacity: 0, letterSpacing: "-0.02em" },
        { fontStretch: "125%", opacity: 1, letterSpacing: "-0.04em" },
      ],
      { duration: 1300, easing: EASE, fill: "backwards" }
    );
    $(".intro__row").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 350, easing: "linear", fill: "backwards" });
    $$(".card", el.grid).forEach((card, i) => {
      const media = $(".card__media", card);
      card.animate([{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "none" }], {
        duration: 900,
        delay: 420 + i * 70,
        easing: EASE,
        fill: "backwards",
      });
      media.animate([{ clipPath: "inset(12% 0 0 0 round 14px)" }, { clipPath: "inset(0 0 0 0 round 14px)" }], {
        duration: 1000,
        delay: 420 + i * 70,
        easing: EASE,
        fill: "backwards",
      });
    });
  }

  /* ---------------- boot ---------------- */

  async function init() {
    const data = await loadData();
    state.shop = data.shop;
    state.products = data.products;
    renderGrid();
    updateBag(false);
    entrance();
    el.sort.addEventListener("change", () => sortProducts(el.sort.value));
  }

  init().catch((err) => {
    console.error(err);
    el.grid.innerHTML =
      '<li class="load-error">The products could not load. Run <code>npx serve</code> from the repo root, or regenerate data/products.js with <code>node tools/sync-data.mjs</code>.</li>';
  });
})();
