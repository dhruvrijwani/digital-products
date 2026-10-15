/* ==========================================================================
   Northline Audio · Compare Dock prototype
   Rendering + interaction only. Catalogue and spec schema live in data/products.json
   (file:// falls back to the generated data/products.js mirror).
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(Flip);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => mqReduced.matches;

  const el = {
    grid: $("#grid"),
    title: $("#collectionTitle"),
    intro: $("#collectionIntro"),
    count: $("#productCount"),
    cartBtn: $("#cartBtn"),
    cartCount: $("#cartCount"),
    dock: $("#dock"),
    dockInner: $(".dock__inner"),
    dockCount: $("#dockCount"),
    slots: $$("#dockSlots .slot"),
    clear: $("#dockClear"),
    go: $("#dockGo"),
    tip: $("#dockTip"),
    sheet: $("#sheet"),
    backdrop: $(".sheet__backdrop"),
    panel: $("#sheetPanel"),
    sheetTitle: $("#sheetTitle"),
    diff: $("#diffToggle"),
    close: $("#sheetClose"),
    scroll: $("#sheetScroll"),
    table: $("#ctable"),
    page: $(".page"),
    topbar: $(".topbar"),
    live: $("#liveRegion"),
  };

  const state = {
    shop: null,
    specs: [],
    products: [],
    selected: [], // product ids, in dock order
    cart: 0,
    dockShown: false,
    sheetOpen: false,
    busy: false,
  };

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = (id) => state.products.find((p) => p.id === id);
  const money = (n) => `${state.shop.currency}${n}`;
  const announce = (msg) => {
    el.live.textContent = "";
    requestAnimationFrame(() => (el.live.textContent = msg));
  };
  const max = () => state.shop.maxCompare || 3;
  const cardOf = (id) => el.grid.querySelector(`.card[data-id="${id}"]`);

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.products;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const res = await fetch("data/products.json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      if (mirror()) return mirror();
      throw err;
    }
  }

  /** Format a spec value for display, using the schema in products.json. */
  function formatSpec(spec, value) {
    if (value === null || value === undefined) return { text: spec.empty || "None", empty: true };
    switch (spec.format) {
      case "price": return { text: money(value) };
      case "bool": return { text: value ? "Yes" : "No" };
      case "ip": return { text: `IPX${value}` };
      case "list": return { text: value.join(", ") };
      case "number": return { text: `${spec.prefix || ""}${spec.decimals != null ? value.toFixed(spec.decimals) : value}${spec.unit ? " " + spec.unit : ""}` };
      default: return { text: String(value) };
    }
  }

  /** Indexes of the winning products in a row. Ties and rows with fewer than two comparable values get no winner. */
  function bestOf(spec, values) {
    const winners = new Set();
    if (!spec.better) return winners;
    if (spec.better === "yes") {
      const yes = values.map((v, i) => (v === true ? i : -1)).filter((i) => i >= 0);
      const comparable = values.filter((v) => typeof v === "boolean").length;
      if (yes.length && yes.length < comparable) yes.forEach((i) => winners.add(i));
      return winners;
    }
    const scores = values.map((v) => (typeof v === "number" ? (spec.better === "lower" ? -v : v) : null));
    const valid = scores.filter((n) => n !== null);
    if (valid.length < 2) return winners;
    const top = Math.max(...valid);
    if (scores.filter((n) => n === top).length === 1) winners.add(scores.indexOf(top));
    return winners;
  }

  /* ==========================================================================
     Grid
     ========================================================================== */
  function cardMarkup(p) {
    const s = p.specs;
    const specCells = [
      ["Battery", s.battery == null ? "—" : `${s.battery} h`],
      ["Weight", `${s.weight} g`],
      ["ANC", s.anc == null ? "—" : s.anc ? "Yes" : "No"],
    ];
    return `
      <li class="card" data-id="${p.id}">
        <div class="card__media">
          <img class="card__img" src="${p.image}" alt="${esc(p.title)}" loading="lazy" decoding="async" width="800" height="800" data-flip-id="img-${p.id}">
          <label class="cmp">
            <input class="cmp__input" type="checkbox" aria-label="Compare ${esc(p.title)}">
            <span class="cmp__pill">
              <span class="cmp__icon" aria-hidden="true">
                <svg class="cmp__plus" viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                <svg class="cmp__check" viewBox="0 0 16 16"><path d="m3.5 8.4 2.9 2.8 6-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <span class="cmp__t-off" aria-hidden="true">Compare</span><span class="cmp__t-on" aria-hidden="true">Comparing</span>
            </span>
            <span class="cmp__ring" aria-hidden="true"></span>
          </label>
        </div>
        <div class="card__body">
          <p class="card__cat">${esc(p.category)}</p>
          <div class="card__head">
            <h2 class="card__title">${esc(p.title)}</h2>
            <span class="card__price">${money(p.price)}</span>
          </div>
          <p class="card__rating"><b>★ ${p.rating}</b> from ${p.ratingCount.toLocaleString("en-US")} reviews</p>
          <dl class="card__specs">
            ${specCells.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
          </dl>
        </div>
      </li>`;
  }

  function renderGrid() {
    el.title.textContent = state.shop.collection;
    el.intro.textContent = state.shop.intro;
    el.count.textContent = `${state.products.length} products · ${state.specs.length} measured specs each`;
    el.grid.innerHTML = state.products.map(cardMarkup).join("");
    el.grid.addEventListener("change", (e) => {
      const input = e.target.closest(".cmp__input");
      if (!input) return;
      const id = input.closest(".card").dataset.id;
      if (input.checked) addToCompare(id, input);
      else removeFromCompare(id);
    });
  }

  function setCardSelected(id, on) {
    const card = cardOf(id);
    if (!card) return;
    card.classList.toggle("is-selected", on);
    $(".cmp", card).classList.toggle("is-on", on);
    $(".cmp__input", card).checked = on;
  }

  /* ==========================================================================
     Dock
     ========================================================================== */
  function showDock() {
    if (state.dockShown) return;
    state.dockShown = true;
    gsap.killTweensOf(el.dock);
    gsap.set(el.dock, { opacity: 1 });
    el.dock.hidden = false;
    if (reduced()) gsap.fromTo(el.dock, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    else gsap.fromTo(el.dock, { yPercent: 160 }, { yPercent: 0, duration: 0.75, ease: "elastic.out(1, 0.78)" });
  }

  function hideDock() {
    if (!state.dockShown) return;
    state.dockShown = false;
    gsap.killTweensOf(el.dock);
    gsap.to(el.dock, {
      yPercent: reduced() ? 0 : 160,
      opacity: reduced() ? 0 : 1,
      duration: reduced() ? 0.2 : 0.4,
      ease: "power2.in",
      onComplete: () => {
        if (!state.dockShown) {
          el.dock.hidden = true;
          gsap.set(el.dock, { clearProps: "opacity,transform" });
        }
      },
    });
  }

  function updateDockMeta() {
    const n = state.selected.length;
    el.dockCount.textContent = n;
    const ready = n >= 2;
    const was = el.go.getAttribute("aria-disabled") === "false";
    el.go.setAttribute("aria-disabled", String(!ready));
    $("span", el.go).textContent = window.innerWidth < 768 ? "Compare" : "Compare now";
    if (ready && !was) pulseGo();
  }

  let pulseEl;
  function pulseGo() {
    if (reduced()) return;
    if (!pulseEl) {
      pulseEl = document.createElement("span");
      pulseEl.className = "dock__pulse";
      pulseEl.setAttribute("aria-hidden", "true");
      el.go.appendChild(pulseEl);
    }
    gsap.fromTo(pulseEl, { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 1.18, duration: 0.9, ease: "power2.out", repeat: 2, repeatDelay: 0.25 });
    gsap.fromTo(el.go, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" });
  }

  function dockItem(p) {
    const item = document.createElement("div");
    item.className = "dock-item";
    item.dataset.id = p.id;
    item.innerHTML = `
      <img src="${p.image}" alt="${esc(p.title)}" data-flip-id="cmp-${p.id}">
      <button class="dock-item__remove" type="button" aria-label="Remove ${esc(p.title)} from comparison">
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 2 6 6M8 2 2 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>`;
    $("button", item).addEventListener("click", () => removeFromCompare(p.id));
    return item;
  }

  function addToCompare(id, input) {
    if (state.selected.includes(id)) return;
    if (state.selected.length >= max()) {
      input.checked = false;
      rejectFourth(byId(id));
      return;
    }
    const p = byId(id);
    state.selected.push(id);
    setCardSelected(id, true);
    showDock();

    const card = cardOf(id);
    const ring = $(".cmp__ring", card);
    if (!reduced()) gsap.fromTo(ring, { scale: 1, opacity: 0.8 }, { scale: 2.3, opacity: 0, duration: 0.7, ease: "power2.out" });

    const slot = el.slots[state.selected.length - 1];
    const item = dockItem(p);
    slot.appendChild(item);

    if (reduced()) {
      gsap.fromTo(item, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    } else {
      // Flip.fit lays the slot thumbnail over the card image, then x and y ease
      // separately so the flight follows an arc (y uses back.in to lift first).
      const cardImg = $(".card__img", card);
      Flip.fit(item, cardImg, { scale: true });
      const dur = 0.52;
      gsap.to(item, { x: 0, duration: dur, ease: "power1.inOut" });
      gsap.to(item, { y: 0, duration: dur, ease: "back.in(1.5)" });
      gsap.to(item, { scaleX: 1, scaleY: 1, duration: dur, ease: "power2.inOut" });
      gsap.fromTo(slot, { scale: 1 }, { scale: 1.08, duration: 0.14, yoyo: true, repeat: 1, delay: dur - 0.04, ease: "power2.out" });
    }
    updateDockMeta();
    hideTip();
    announce(`${p.title} added to comparison. ${state.selected.length} of ${max()} selected.`);
  }

  function removeFromCompare(id, { silent = false, onDone } = {}) {
    const idx = state.selected.indexOf(id);
    if (idx < 0) return;
    const p = byId(id);
    state.selected.splice(idx, 1);
    setCardSelected(id, false);
    const item = el.dock.querySelector(`.dock-item[data-id="${id}"]`);
    const card = cardOf(id);

    const reflow = () => {
      item?.remove();
      const items = $$(".dock-item", el.dock);
      const flipState = Flip.getState(items);
      state.selected.forEach((sid, i) => {
        const it = items.find((n) => n.dataset.id === sid);
        if (it && it.parentElement !== el.slots[i]) el.slots[i].appendChild(it);
      });
      if (!reduced()) Flip.from(flipState, { duration: 0.42, ease: "power3.inOut" });
      // the slot that just emptied re-draws its placeholder
      const freed = el.slots[state.selected.length];
      if (freed && !reduced()) gsap.fromTo($(".slot__ph", freed), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" });
      updateDockMeta();
      if (!state.selected.length) hideDock();
      onDone?.();
    };

    if (!item || reduced() || !card) {
      if (item) gsap.to(item, { opacity: 0, duration: 0.15, onComplete: reflow });
      else reflow();
    } else {
      gsap.killTweensOf(item);
      const cardImg = $(".card__img", card);
      const tl = gsap.timeline({ onComplete: reflow });
      tl.add(Flip.fit(item, cardImg, { scale: true, duration: 0.45, ease: "power2.inOut" }));
      tl.to(item, { opacity: 0, duration: 0.18 }, 0.3);
    }
    if (!silent) announce(`${p.title} removed from comparison. ${state.selected.length} of ${max()} selected.`);
  }

  let tipTimer;
  function rejectFourth(p) {
    el.tip.textContent = `You can compare ${max()} at a time. Remove one to add ${p.title}.`;
    if (!reduced()) {
      gsap.fromTo(el.dockInner, { x: 0 }, { keyframes: { x: [-10, 9, -7, 5, -3, 0] }, duration: 0.45, ease: "none" });
      gsap.fromTo(el.tip, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" });
    } else {
      gsap.set(el.tip, { opacity: 1 });
    }
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 2800);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    gsap.to(el.tip, { opacity: 0, duration: 0.2 });
  }

  el.clear.addEventListener("click", () => {
    const ids = [...state.selected].reverse();
    ids.forEach((id, i) => setTimeout(() => removeFromCompare(id, { silent: true }), i * 90));
    announce("Comparison cleared.");
  });

  el.go.addEventListener("click", () => {
    if (el.go.getAttribute("aria-disabled") === "true") {
      el.tip.textContent = "Pick at least two products to compare.";
      gsap.fromTo(el.tip, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
      clearTimeout(tipTimer);
      tipTimer = setTimeout(hideTip, 2200);
      return;
    }
    openSheet();
  });

  /* ==========================================================================
     Comparison sheet
     ========================================================================== */
  function renderTable() {
    const chosen = state.selected.map(byId);
    el.table.style.setProperty("--cols", chosen.length);
    el.sheetTitle.textContent = `Comparing ${chosen.length} products`;

    const head = `
      <div class="ctable__head" role="rowgroup">
        <div class="crow" role="row">
          <div class="ccell ccell--corner" role="columnheader">Best value in each row is marked</div>
          ${chosen
            .map(
              (p) => `
            <div class="ccell ccell--product" role="columnheader">
              <img class="cimg" src="${p.image}" alt="" data-flip-id="cmp-${p.id}">
              <p class="cname">${esc(p.title)}</p>
              <p class="cprice">${money(p.price)}</p>
              <button class="catc" type="button" data-id="${p.id}">Add to cart</button>
            </div>`
            )
            .join("")}
        </div>
      </div>`;

    const rows = state.specs
      .map((spec) => {
        const values = chosen.map((p) => p.specs[spec.key]);
        const shown = values.map((v) => formatSpec(spec, v));
        const same = new Set(shown.map((s) => s.text)).size === 1;
        const bestSet = bestOf(spec, values);
        return `
          <div class="crow" role="row" data-same="${same}">
            <div class="ccell ccell--label" role="rowheader">${esc(spec.label)}</div>
            ${shown
              .map(
                (s, i) => `
              <div class="ccell ccell--value${bestSet.has(i) ? " is-best" : ""}" role="cell">
                ${bestSet.has(i) ? '<span class="best-sweep" aria-hidden="true"></span>' : ""}
                <span class="${s.empty ? "muted" : ""}">${esc(s.text)}</span>
                ${bestSet.has(i) ? '<span class="best-badge"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2L8 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Best</span>' : ""}
              </div>`
              )
              .join("")}
          </div>`;
      })
      .join("");

    el.table.innerHTML = `${head}<div class="ctable__body" role="rowgroup">${rows}</div>`;
    el.diff.checked = false;
  }

  function setPageInert(on) {
    el.page.inert = on;
    el.topbar.inert = on;
    document.documentElement.classList.toggle("is-locked", on);
  }

  /** clip-path inset that matches `rect` inside `panelRect` */
  function insetFor(rect, panelRect, radius) {
    const t = Math.max(0, rect.top - panelRect.top);
    const r = Math.max(0, panelRect.right - rect.right);
    const b = Math.max(0, panelRect.bottom - rect.bottom);
    const l = Math.max(0, rect.left - panelRect.left);
    return `inset(${t}px ${r}px ${b}px ${l}px round ${radius}px)`;
  }

  function openSheet() {
    if (state.sheetOpen || state.busy || state.selected.length < 2) return;
    state.busy = true;
    state.sheetOpen = true;
    hideTip();

    const dockImgs = $$(".dock-item img", el.dock);
    const flipState = Flip.getState(dockImgs);
    const dockRect = el.dockInner.getBoundingClientRect();

    renderTable();
    el.sheet.hidden = false;
    el.scroll.scrollTop = 0;
    el.scroll.scrollLeft = 0;
    setPageInert(true);

    const rows = $$(".ctable__body .crow", el.table);
    const done = () => {
      state.busy = false;
      highlightBest();
    };

    if (reduced()) {
      gsap.set(el.dock, { opacity: 0 });
      gsap.fromTo([el.backdrop, el.panel], { opacity: 0 }, { opacity: 1, duration: 0.25, onComplete: done });
      el.close.focus();
      return;
    }

    const panelRect = el.panel.getBoundingClientRect();
    const full = `inset(0px 0px 0px 0px round ${window.innerWidth < 768 ? 0 : 20}px)`;
    const tl = gsap.timeline({ onComplete: done });
    tl.fromTo(el.backdrop, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0)
      .fromTo(el.panel, { clipPath: insetFor(dockRect, panelRect, 18) }, { clipPath: full, duration: 0.62, ease: "power3.inOut" }, 0)
      .to(el.dock, { opacity: 0, duration: 0.2 }, 0.05)
      .add(Flip.from(flipState, { targets: $$(".cimg", el.table), duration: 0.62, ease: "power3.inOut", scale: true }), 0)
      .fromTo($$(".cname, .cprice, .catc, .ccell--corner", el.table), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.03 }, 0.38)
      .fromTo(rows, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.035 }, 0.42)
      .fromTo($$(".sheet__bar > *", el.panel), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.05 }, 0.35);
    el.close.focus({ preventScroll: true });
  }

  function highlightBest() {
    const sweeps = $$(".best-sweep", el.table);
    const badges = $$(".best-badge", el.table);
    if (reduced()) {
      gsap.set(sweeps, { scaleX: 1 });
      gsap.set(badges, { scale: 1 });
      return;
    }
    gsap.to(sweeps, { scaleX: 1, duration: 0.55, ease: "power3.inOut", stagger: 0.05 });
    gsap.to(badges, { scale: 1, duration: 0.4, ease: "back.out(2.6)", stagger: 0.05, delay: 0.25 });
  }

  function closeSheet() {
    if (!state.sheetOpen || state.busy) return;
    state.busy = true;

    const finish = () => {
      el.sheet.hidden = true;
      el.dock.classList.remove("is-raised");
      gsap.set([el.panel, el.backdrop, el.dock], { clearProps: "clipPath,opacity" });
      gsap.set($$(".dock-item img", el.dock), { clearProps: "transform,opacity" });
      setPageInert(false);
      state.sheetOpen = false;
      state.busy = false;
      el.go.focus({ preventScroll: true });
    };

    if (reduced()) {
      gsap.to([el.backdrop, el.panel], { opacity: 0, duration: 0.2, onComplete: finish });
      gsap.to(el.dock, { opacity: 1, duration: 0.2 });
      return;
    }

    // Thumbnails fly from the sticky header back into their dock slots.
    const headImgs = $$(".cimg", el.table);
    const flipState = Flip.getState(headImgs);
    gsap.set(headImgs, { opacity: 0 });
    el.dock.classList.add("is-raised");
    gsap.set(el.dock, { opacity: 1 });
    gsap.set($$(".dock__inner > :not(.dock__slots)", el.dock), { opacity: 0 });

    const dockRect = el.dockInner.getBoundingClientRect();
    const panelRect = el.panel.getBoundingClientRect();
    const tl = gsap.timeline({ onComplete: finish });
    tl.add(Flip.from(flipState, { targets: $$(".dock-item img", el.dock), duration: 0.55, ease: "power3.inOut", scale: true }), 0)
      .to(el.panel, { clipPath: insetFor(dockRect, panelRect, 18), duration: 0.55, ease: "power3.inOut" }, 0)
      .to(el.backdrop, { opacity: 0, duration: 0.45 }, 0.05)
      .to($$(".dock__inner > :not(.dock__slots)", el.dock), { opacity: 1, duration: 0.25, clearProps: "opacity" }, 0.4);
  }

  /* "Show differences only": rows with identical values collapse (height + opacity). */
  el.diff.addEventListener("change", () => {
    const on = el.diff.checked;
    const rows = $$('.ctable__body .crow[data-same="true"]', el.table);
    if (!rows.length) {
      announce("Every spec differs between these products.");
      return;
    }
    if (reduced()) {
      rows.forEach((r) => (r.hidden = on));
      return;
    }
    if (on) {
      gsap.to(rows, {
        height: 0, opacity: 0, duration: 0.38, ease: "power2.inOut", stagger: 0.03,
        onComplete: () => rows.forEach((r) => (r.hidden = true)),
      });
    } else {
      rows.forEach((r) => (r.hidden = false));
      gsap.fromTo(rows, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.03, clearProps: "height" });
    }
    announce(on ? `Hiding ${rows.length} specs that match.` : "Showing all specs.");
  });

  el.table.addEventListener("click", (e) => {
    const btn = e.target.closest(".catc");
    if (!btn || btn.classList.contains("is-added")) return;
    const p = byId(btn.dataset.id);
    state.cart += 1;
    el.cartCount.textContent = state.cart;
    el.cartBtn.setAttribute("aria-label", `Cart, ${state.cart} item${state.cart === 1 ? "" : "s"}`);
    btn.classList.add("is-added");
    btn.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.4 2.9 2.8 6-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Added`;
    if (!reduced()) {
      gsap.fromTo(btn, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
      gsap.fromTo($("path", btn), { strokeDasharray: 20, strokeDashoffset: 20 }, { strokeDashoffset: 0, duration: 0.35 });
    }
    announce(`${p.title} added to cart.`);
  });

  el.sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (!state.sheetOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeSheet();
    }
    if (e.key === "Tab") {
      const list = $$('button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])', el.sheet).filter((n) => n.getClientRects().length);
      const first = list[0];
      const last = list[list.length - 1];
      if (!el.sheet.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (state.selected.length) $("span", el.go).textContent = window.innerWidth < 768 ? "Compare" : "Compare now";
  });

  /* ---------------- boot ---------------- */
  async function init() {
    const data = await loadData();
    state.shop = data.shop;
    state.specs = data.specs;
    state.products = data.products;
    renderGrid();
    if (!reduced()) {
      gsap.from(".intro > *", { y: 20, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 });
      // Animate each card's children so the card's own CSS lift transition never fights the tween.
      $$(".card", el.grid).forEach((card, i) => {
        gsap.from(card.children, { y: 30, opacity: 0, duration: 0.7, ease: "power3.out", delay: 0.15 + i * 0.05, clearProps: "transform,opacity" });
      });
    }
  }
  init().catch((err) => {
    console.error(err);
    el.grid.innerHTML = `<li>Products could not load. Run <code>npx serve</code>, or regenerate data/products.js with <code>node tools/sync-data.mjs</code>.</li>`;
  });
})();
