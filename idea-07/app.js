/* ==========================================================================
   Ritual Supply · Build-a-Box prototype
   Shoppers pick a box size (tiered discount), fill the slots with minis,
   and the box closes itself when full. Data: data/box.json.
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(Flip);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => matchMedia("(max-width: 900px)").matches;

  let D;
  const state = { tier: null, items: [], closed: false, cart: 0, uid: 0, busy: false };
  const tier = () => D.tiers.find((t) => t.id === state.tier);
  const product = (id) => D.products.find((p) => p.id === id);
  const fmt = (n) => (Number.isInteger(n) ? `${D.shop.currency}${n}` : `${D.shop.currency}${n.toFixed(2)}`);
  const announce = (m) => { const l = $("#liveRegion"); l.textContent = ""; requestAnimationFrame(() => (l.textContent = m)); };

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.box;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const r = await fetch("data/box.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (mirror()) return mirror();
      throw e;
    }
  }

  function rollTo(el, to, format = fmt) {
    const from = +el.dataset.v || 0;
    el.dataset.v = to;
    if (reduced() || from === to) { el.textContent = format(to); return; }
    const o = { v: from };
    gsap.to(o, { v: to, duration: 0.45, ease: "power2.out", onUpdate: () => (el.textContent = format(Math.round(o.v * 100) / 100)) });
  }

  /* ---------------- flights (fixed-position clones) ---------------- */
  function fly(fromEl, toEl, { src, onDone, shrink = true } = {}) {
    if (reduced() || !fromEl || !toEl) return onDone?.();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const c = document.createElement("img");
    c.src = src;
    c.className = "flyer";
    Object.assign(c.style, { width: `${a.width}px`, height: `${a.height}px` });
    $(".flyer-layer").appendChild(c);
    gsap.set(c, { x: a.left, y: a.top, transformOrigin: "0 0" });
    const sx = b.width / a.width;
    const sy = b.height / a.height;
    const d = 0.62;
    gsap.to(c, { x: b.left, duration: d, ease: "power1.inOut" });
    gsap.to(c, { y: b.top, duration: d, ease: "back.in(1.4)" });
    gsap.to(c, { scaleX: shrink ? sx : 1, scaleY: shrink ? sy : 1, duration: d, ease: "power2.inOut", onComplete: () => { c.remove(); onDone?.(); } });
  }

  /* ==========================================================================
     Product grid
     ========================================================================== */
  function renderProducts() {
    $("#pageTitle").textContent = D.title;
    $("#pageIntro").textContent = D.intro;
    $("#products").innerHTML = D.products
      .map(
        (p) => `
        <li class="prod" data-id="${p.id}">
          <div class="prod__media"><img src="${p.image}" alt="${esc(p.title)}, ${esc(p.kind)}" loading="lazy" decoding="async"><span class="prod__count" aria-hidden="true">0</span></div>
          <div class="prod__info"><div><h3 class="prod__title">${esc(p.title)}</h3><p class="prod__kind">${esc(p.kind)}</p></div><span class="prod__price">${fmt(p.price)}</span></div>
          <button class="prod__add" type="button" data-add="${p.id}" aria-label="Add ${esc(p.title)} to box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>Add to box
          </button>
        </li>`
      )
      .join("");
  }

  function updateCounts() {
    $$(".prod").forEach((li) => {
      const n = state.items.filter((i) => i.id === li.dataset.id).length;
      const badge = $(".prod__count", li);
      const was = +badge.textContent;
      badge.textContent = n;
      if (n !== was && !reduced()) gsap.to(badge, { scale: n ? 1 : 0, duration: 0.4, ease: n ? "back.out(3)" : "power2.in" });
      else gsap.set(badge, { scale: n ? 1 : 0 });
    });
    const full = state.items.length >= tier().size;
    $$(".prod__add").forEach((b) => b.setAttribute("aria-disabled", String(full || state.closed)));
  }

  /* ==========================================================================
     Box sizes
     ========================================================================== */
  function renderSizes() {
    const host = $("#sizes");
    host.innerHTML =
      `<span class="sizes__pill" aria-hidden="true"></span>` +
      D.tiers
        .map((t) => `<button class="size" type="button" role="radio" aria-checked="${t.id === state.tier}" data-tier="${t.id}"><b>${t.size} minis</b><span>Save ${t.discount}%</span></button>`)
        .join("");
    placePill(false);
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".size");
      if (b && b.dataset.tier !== state.tier) setTier(b.dataset.tier);
    });
    host.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const i = D.tiers.findIndex((t) => t.id === state.tier);
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + D.tiers.length) % D.tiers.length;
      setTier(D.tiers[n].id);
      $(`.size[data-tier="${D.tiers[n].id}"]`).focus();
    });
  }

  function placePill(animate) {
    const btn = $(`.size[data-tier="${state.tier}"]`);
    const pill = $(".sizes__pill");
    gsap.set(pill, { width: btn.offsetWidth });
    const x = btn.offsetLeft - 4;
    if (animate && !reduced()) gsap.to(pill, { x, duration: 0.4, ease: "power3.inOut" });
    else gsap.set(pill, { x });
    $$(".size").forEach((b) => {
      const on = b.dataset.tier === state.tier;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  function setTier(id) {
    if (state.busy) return;
    const prevSize = tier().size;
    state.tier = id;
    placePill(true);
    const t = tier();
    $("#boxTag").textContent = `${t.label} box`;
    const excess = state.items.slice(t.size);
    if (state.closed) openLid();
    if (excess.length) {
      state.items = state.items.slice(0, t.size);
      excess.forEach((it, k) => {
        const el = $(`.item[data-uid="${it.uid}"]`);
        const card = $(`.prod[data-id="${it.id}"] .prod__media`);
        if (el) {
          fly(el, card, { src: product(it.id).image });
          el.remove();
        }
      });
      announce(`${excess.length} item${excess.length > 1 ? "s" : ""} moved out to fit the ${t.size}-mini box`);
    }
    renderSlots(prevSize);
    refresh();
    if (state.items.length === t.size) closeLid();
  }

  /* ==========================================================================
     Slots
     ========================================================================== */
  function itemMarkup(it) {
    const p = product(it.id);
    return `<div class="item" data-uid="${it.uid}" data-flip-id="${it.uid}"><img src="${p.image}" alt="${esc(p.title)}">
      <button class="item__x" type="button" data-remove="${it.uid}" aria-label="Remove ${esc(p.title)} from box"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 2 6 6M8 2 2 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>`;
  }

  function renderSlots(prevSize) {
    const t = tier();
    const ol = $("#slots");
    const flip = Flip.getState($$(".item", ol));
    ol.style.setProperty("--cols", t.cols);
    ol.innerHTML = Array.from({ length: t.size }, (_, i) => {
      const it = state.items[i];
      return `<li class="slot" aria-label="Slot ${i + 1}${it ? `: ${esc(product(it.id).title)}` : ", empty"}"><span class="slot__num" aria-hidden="true">${i + 1}</span>${it ? itemMarkup(it) : ""}</li>`;
    }).join("");
    // Skip motion when the box is collapsed (mobile tray): Flip can't measure hidden elements.
    if (reduced() || !ol.getClientRects().length) return;
    if ($$(".item", ol).length) Flip.from(flip, { targets: $$(".item", ol), duration: 0.45, ease: "power3.inOut" });
    if (prevSize && prevSize !== t.size) {
      if (t.size > prevSize) gsap.fromTo($$(".slot", ol).slice(prevSize), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.04 });
      gsap.fromTo("#box", { scale: 0.98 }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" });
    }
  }

  function refresh() {
    const t = tier();
    const n = state.items.length;
    const full = state.items.reduce((s, i) => s + product(i.id).price, 0);
    const save = Math.round(full * t.discount) / 100;
    rollTo($("#sumFull"), full);
    rollTo($("#sumSave"), save, (v) => `−${fmt(v)}`);
    rollTo($("#sumTotal"), full - save);
    $("#saveLabel").textContent = `Box saving (${t.discount}%)`;
    const left = t.size - n;
    $("#status").innerHTML = !n
      ? `Add ${t.size} minis to fill your ${t.label.toLowerCase()} box and save <b>${t.discount}%</b>.`
      : left > 0
      ? `${n} of ${t.size} filled. Add <b>${left} more</b> to save ${t.discount}%.`
      : `Box full. You're saving <b>${fmt(save)}</b>.`;
    gsap.to("#meterFill", { scaleX: n / t.size, duration: reduced() ? 0 : 0.5, ease: "power3.out" });
    const btn = $("#addBox");
    btn.setAttribute("aria-disabled", String(left > 0));
    btn.textContent = left > 0 ? `Fill ${left} more slot${left > 1 ? "s" : ""} to continue` : `Add box to cart · ${fmt(full - save)}`;
    $("#editBox").hidden = !state.closed;
    // mobile peek
    $("#peekCount").textContent = `${n} / ${t.size} minis`;
    $("#peekPrice").textContent = n ? `${fmt(full - save)} · save ${t.discount}%` : `Save ${t.discount}% when full`;
    $("#peekThumbs").innerHTML = Array.from({ length: t.size }, (_, i) => (state.items[i] ? `<img src="${product(state.items[i].id).image}" alt="">` : "<i></i>")).join("");
    updateCounts();
  }

  /* ---------------- add / remove ---------------- */
  function addItem(id, fromEl) {
    const t = tier();
    if (state.closed || state.items.length >= t.size) {
      announce("Your box is full. Remove a mini or pick a bigger box.");
      $("#status").innerHTML = `Your box is full. Remove a mini or pick a <b>bigger box</b>.`;
      if (!reduced()) {
        gsap.fromTo("#box", { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.4 });
        const bigger = D.tiers.find((x) => x.size > t.size);
        if (bigger) gsap.fromTo(`.size[data-tier="${bigger.id}"]`, { scale: 1 }, { scale: 1.08, yoyo: true, repeat: 3, duration: 0.15 });
      }
      return;
    }
    const it = { uid: `u${++state.uid}`, id };
    state.items.push(it);
    renderSlots();
    const el = $(`.item[data-uid="${it.uid}"]`);
    const willFill = state.items.length === t.size;
    if (isMobile() && !$("#boxPanel").classList.contains("is-open")) {
      // On mobile the box is collapsed: fly into the tray instead.
      fly(fromEl, $("#peekThumbs").children[state.items.length - 1] || $("#peek"), { src: product(id).image, onDone: () => { refresh(); if (willFill) closeLid(); } });
      refresh();
      return;
    }
    gsap.set(el, { opacity: 0 });
    fly(fromEl, el, {
      src: product(id).image,
      onDone: () => {
        gsap.set(el, { opacity: 1 });
        if (!reduced()) gsap.fromTo(el, { scale: 0.85 }, { scale: 1, duration: 0.45, ease: "back.out(3)", transformOrigin: "50% 50%" });
        if (willFill) closeLid();
      },
    });
    refresh();
    announce(`${product(id).title} added. ${state.items.length} of ${t.size}.`);
  }

  function removeItem(uid) {
    const it = state.items.find((i) => i.uid === uid);
    if (!it) return;
    const el = $(`.item[data-uid="${uid}"]`);
    const card = $(`.prod[data-id="${it.id}"] .prod__media`);
    state.items = state.items.filter((i) => i.uid !== uid);
    if (el && !isMobile()) fly(el, card, { src: product(it.id).image });
    el?.remove();
    renderSlots();
    refresh();
    announce(`${product(it.id).title} removed from box`);
  }

  /* ---------------- lid ---------------- */
  function closeLid() {
    if (state.closed) return;
    state.closed = true;
    const lid = $("#lid");
    refresh();
    announce(`Box full. Ready to add to cart.`);
    if (reduced()) {
      gsap.set(lid, { rotationX: 0, opacity: 1, visibility: "visible" });
      gsap.set(".ribbon", { scale: 1 });
      return;
    }
    gsap.timeline()
      .set(lid, { visibility: "visible", opacity: 1 })
      .fromTo(lid, { rotationX: -105 }, { rotationX: 0, duration: 0.7, ease: "power3.inOut" }, 0.15)
      .fromTo(".ribbon--v", { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: "power2.out" }, 0.8)
      .fromTo(".ribbon--h", { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.out" }, 0.95)
      .fromTo(".box__tag", { scale: 0, rotation: -20 }, { scale: 1, rotation: -4, duration: 0.5, ease: "back.out(2.6)" }, 1.15)
      .fromTo("#box", { y: 0 }, { y: -6, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }, 0.82)
      .fromTo("#addBox", { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1 }, 1.2);
  }

  function openLid(after) {
    if (!state.closed) return after?.();
    state.closed = false;
    const lid = $("#lid");
    const done = () => { gsap.set(lid, { visibility: "hidden", opacity: 0 }); refresh(); after?.(); };
    if (reduced()) return done();
    gsap.timeline({ onComplete: done })
      .to(".box__tag", { scale: 0, duration: 0.2 })
      .to(".ribbon", { scale: 0, duration: 0.2 }, 0)
      .to(lid, { rotationX: -105, duration: 0.55, ease: "power3.inOut" }, 0.15);
  }

  function addBoxToCart() {
    const btn = $("#addBox");
    if (btn.getAttribute("aria-disabled") === "true") {
      if (!reduced()) gsap.fromTo("#slots .slot:not(:has(.item))", { scale: 1 }, { scale: 1.08, yoyo: true, repeat: 1, duration: 0.15, stagger: 0.04 });
      return;
    }
    const finish = () => {
      state.cart += 1;
      $("#cartCount").textContent = state.cart;
      $("#cartBtn").setAttribute("aria-label", `Cart, ${state.cart} item${state.cart === 1 ? "" : "s"}`);
      if (!reduced()) gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.15, yoyo: true, repeat: 1, duration: 0.15 });
      announce("Box added to cart");
      openLid(() => {
        state.items = [];
        renderSlots();
        refresh();
        $("#status").innerHTML = `Box added to cart. <b>Build another?</b>`;
      });
    };
    if (reduced()) return finish();
    // the whole closed box shrinks into the cart
    const box = $("#box");
    const a = box.getBoundingClientRect();
    const b = $("#cartBtn").getBoundingClientRect();
    const ghost = box.cloneNode(true);
    ghost.removeAttribute("id");
    $$("[id]", ghost).forEach((n) => n.removeAttribute("id"));
    Object.assign(ghost.style, { position: "absolute", left: "0", top: "0", width: `${a.width}px`, margin: "0" });
    $(".flyer-layer").appendChild(ghost);
    gsap.set(ghost, { x: a.left, y: a.top, transformOrigin: "0 0" });
    gsap.to(ghost, { x: b.left, duration: 0.75, ease: "power2.inOut" });
    gsap.to(ghost, { y: b.top, duration: 0.75, ease: "back.in(1.3)" });
    gsap.to(ghost, { scale: 40 / a.width, opacity: 0.4, duration: 0.75, ease: "power2.in", onComplete: () => { ghost.remove(); finish(); } });
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    document.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) {
        if (add.getAttribute("aria-disabled") === "true") return addItem(add.dataset.add, null);
        return addItem(add.dataset.add, add.closest(".prod").querySelector(".prod__media"));
      }
      const rm = e.target.closest("[data-remove]");
      if (rm) removeItem(rm.dataset.remove);
    });
    $("#addBox").addEventListener("click", addBoxToCart);
    $("#editBox").addEventListener("click", () => openLid());
    $("#peek").addEventListener("click", () => {
      const panel = $("#boxPanel");
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      $("#peek").setAttribute("aria-expanded", String(open));
      if (open) {
        placePill(false);
        if (!reduced()) gsap.fromTo(".boxpanel__inner", { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: "power3.out" });
      }
    });
    window.addEventListener("resize", () => placePill(false));
  }

  async function init() {
    D = await loadData();
    state.tier = D.defaultTier;
    renderProducts();
    renderSizes();
    $("#boxTag").textContent = `${tier().label} box`;
    renderSlots();
    refresh();
    wire();
    if (document.fonts) document.fonts.ready.then(() => placePill(false));
    if (!reduced()) {
      gsap.from(".pick > *:not(.products)", { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 });
      gsap.from(".prod", { y: 30, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.05, delay: 0.1, clearProps: "transform,opacity" });
      gsap.from(".boxpanel__inner", { x: 30, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.2, clearProps: "transform,opacity" });
    }
  }
  init().catch((e) => { console.error(e); $("#products").innerHTML = "<li>Data could not load. Run npx serve or node tools/sync-data.mjs.</li>"; });
})();
