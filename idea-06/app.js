/* ==========================================================================
   Halfmile · Reward Ladder cart prototype
   A cart drawer with tiered rewards (free shipping → free gift → % off),
   unlock moments, gift auto-add/removal and upsells ranked by which item
   gets the shopper to the next tier. Data: data/store.json.
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(Flip);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => matchMedia("(max-width: 767px)").matches;

  let D;
  const state = { lines: [], gift: null, unlocked: new Set(), showUpsell: true, open: false };
  let money;

  const ICON = {
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="1.8" fill="currentColor"/><circle cx="17" cy="17.5" r="1.8" fill="currentColor"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S10.5 9 12 9c1.5 0 5 1 5-1.5S13.5 6 12 9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    percent: '<path d="m6 18 12-12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="7.5" cy="7.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16.5" cy="16.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    check: '<path d="m5.5 12.5 4 4 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const ART = {
    bottle: '<path d="M10 3h4v3l2 3v11a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V9l2-3z M8 13h8" fill="none" stroke="#2a4bd1" stroke-width="1.7" stroke-linejoin="round"/>',
    socks: '<path d="M7 3h5v9l3 3a3 3 0 0 1-4.2 4.2L7 15.5z M7 7h5" fill="none" stroke="#d1562a" stroke-width="1.7" stroke-linejoin="round"/>',
    band: '<ellipse cx="12" cy="12" rx="8" ry="5" fill="none" stroke="#3a8a2a" stroke-width="2.4"/>',
  };
  const svg = (inner, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.store;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const r = await fetch("data/store.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (mirror()) return mirror();
      throw e;
    }
  }

  const product = (id) => D.products.find((p) => p.id === id);
  const giftById = (id) => D.gifts.find((g) => g.id === id);
  const announce = (m) => { const l = $("#liveRegion"); l.textContent = ""; requestAnimationFrame(() => (l.textContent = m)); };

  /* ---------------- money maths ---------------- */
  function totals() {
    const sub = state.lines.reduce((s, l) => s + (l.gift ? 0 : product(l.id).price * l.qty), 0);
    const unlocked = D.rewards.filter((r) => sub >= r.threshold);
    const disc = unlocked.find((r) => r.type === "discount");
    const discount = disc ? Math.round(sub * disc.value) / 100 : 0;
    const freeShip = unlocked.some((r) => r.type === "shipping");
    const shipping = !sub || freeShip ? 0 : D.shop.shippingFee;
    const next = D.rewards.find((r) => sub < r.threshold);
    return { sub, unlocked, discount, shipping, total: sub - discount + shipping, next };
  }
  const fmt = (n) => (Number.isInteger(n) ? `${D.shop.currency}${n}` : `${D.shop.currency}${n.toFixed(2)}`);

  /** Tween a number inside an element, remembering the last value. */
  function rollTo(el, to, format = fmt) {
    const from = +el.dataset.v || 0;
    el.dataset.v = to;
    if (reduced() || from === to) { el.textContent = format(to); return; }
    const o = { v: from };
    gsap.to(o, { v: to, duration: 0.5, ease: "power2.out", onUpdate: () => (el.textContent = format(Math.round(o.v * 100) / 100)) });
  }

  /* ==========================================================================
     Grid
     ========================================================================== */
  function renderGrid() {
    $("#grid").innerHTML = D.products
      .map(
        (p) => `
        <li class="card" data-id="${p.id}">
          <div class="card__media">
            <img src="${p.image}" alt="${esc(p.title)} in ${esc(p.color)}" loading="lazy" decoding="async">
            <button class="card__add" type="button" data-add="${p.id}" aria-label="Add ${esc(p.title)} to cart">${svg('<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>')}<span>Quick add</span></button>
          </div>
          <div class="card__info">
            <div><h2 class="card__title">${esc(p.title)}</h2><p class="card__meta">${esc(p.color)}</p></div>
            <span class="card__price">${fmt(p.price)}</span>
          </div>
        </li>`
      )
      .join("");
  }

  /* ---------------- fly to cart ---------------- */
  function fly(fromImg, toEl, onDone) {
    if (reduced() || !fromImg || !toEl) return onDone?.();
    const a = fromImg.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const c = document.createElement("img");
    c.src = fromImg.currentSrc || fromImg.src;
    c.className = "flyer";
    c.style.width = `${a.width}px`;
    c.style.height = `${a.height}px`;
    $(".flyer-layer").appendChild(c);
    const tx = b.left + b.width / 2 - (a.left + a.width / 2);
    const ty = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.12, Math.min(b.width, 60) / a.width);
    gsap.set(c, { x: a.left, y: a.top, transformOrigin: "50% 50%" });
    const dur = 0.7;
    gsap.to(c, { x: a.left + tx, duration: dur, ease: "power1.inOut" });
    gsap.to(c, { y: a.top + ty, duration: dur, ease: "back.in(1.6)" });
    gsap.to(c, { scale: s, borderRadius: 40, duration: dur, ease: "power2.in" });
    gsap.to(c, { opacity: 0, duration: 0.15, delay: dur - 0.12, onComplete: () => { c.remove(); onDone?.(); } });
  }

  function bumpCart() {
    const n = state.lines.reduce((s, l) => s + (l.gift ? 0 : l.qty), 0);
    $("#cartCount").textContent = n;
    $("#cartBtn").setAttribute("aria-label", `Open cart, ${n} item${n === 1 ? "" : "s"}`);
    $("#drawerCount").textContent = n ? `(${n})` : "";
    if (!reduced()) gsap.fromTo("#cartCount", { scale: 1.6 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.5)" });
  }

  /* ==========================================================================
     Reward ladder
     ========================================================================== */
  function buildLadder() {
    const max = D.rewards[D.rewards.length - 1].threshold;
    const track = $("#ladderTrack");
    $$(".node", track).forEach((n) => n.remove());
    D.rewards.forEach((r) => {
      track.insertAdjacentHTML(
        "beforeend",
        `<span class="node${state.unlocked.has(r.id) ? " is-on" : ""}" data-id="${r.id}" style="left:${(r.threshold / max) * 100}%">
          <span class="node__ring"></span>
          <span class="node__dot">${svg(state.unlocked.has(r.id) ? ICON.check : ICON[r.icon])}</span>
          <span class="node__label"><b>${fmt(r.threshold)}</b>${esc(r.short)}</span>
        </span>`
      );
    });
  }

  function updateLadder(t, celebrate = true) {
    const max = D.rewards[D.rewards.length - 1].threshold;
    const p = Math.min(1, t.sub / max);
    if (reduced()) gsap.set("#ladderFill", { scaleX: p });
    else gsap.to("#ladderFill", { scaleX: p, duration: 0.7, ease: "power3.out" });

    const msg = $("#ladderMsg");
    const bar = $("#announce");
    if (!t.sub) {
      msg.innerHTML = `Spend ${fmt(D.rewards[0].threshold)} for <b>${esc(D.rewards[0].short.toLowerCase())}</b>, and unlock more as you go.`;
    } else if (t.next) {
      const gap = t.next.threshold - t.sub;
      msg.innerHTML = `Add <span class="amt" data-v="${msg.querySelector(".amt")?.dataset.v || gap}">${fmt(gap)}</span> to unlock <b>${esc(t.next.label.toLowerCase())}</b>`;
      rollTo($(".amt", msg), gap);
    } else {
      msg.innerHTML = `Every reward unlocked. <b>Enjoy the haul.</b>`;
    }
    const first = D.rewards.find((r) => t.sub < r.threshold);
    bar.innerHTML = first ? `${esc(first.short)} on orders over <b>${fmt(first.threshold)}</b>` : `<b>All rewards unlocked</b> on this order`;

    const now = new Set(t.unlocked.map((r) => r.id));
    const before = state.unlocked;
    state.unlocked = now; // commit first: side effects below can re-enter refresh()
    D.rewards.forEach((r) => {
      const node = $(`.node[data-id="${r.id}"]`);
      const was = before.has(r.id);
      const is = now.has(r.id);
      if (was === is) return;
      node.classList.toggle("is-on", is);
      $(".node__dot", node).innerHTML = svg(is ? ICON.check : ICON[r.icon]);
      if (is && celebrate) celebrateNode(node, r);
      if (!is && !reduced()) gsap.fromTo(node.querySelector(".node__dot"), { x: 0 }, { keyframes: { x: [-4, 4, -3, 2, 0] }, duration: 0.35 });
      if (r.type === "gift") onGiftTier(is);
    });
  }

  function celebrateNode(node, r) {
    announce(`Unlocked: ${r.label}`);
    if (reduced()) return;
    const dot = $(".node__dot", node);
    gsap.fromTo(dot, { scale: 0.6, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.7, ease: "elastic.out(1.2, 0.45)" });
    gsap.fromTo($(".node__ring", node), { scale: 1, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.7, ease: "power2.out" });
    // confetti from the node
    const host = $(".ladder__confetti");
    const hr = host.getBoundingClientRect();
    const nr = dot.getBoundingClientRect();
    const cx = nr.left + nr.width / 2 - hr.left;
    const cy = nr.top + nr.height / 2 - hr.top;
    const colors = ["#ffd60a", "#121212", "#ff7a59", "#5b8cff"];
    for (let i = 0; i < 18; i++) {
      const c = document.createElement("i");
      c.style.background = colors[i % colors.length];
      host.appendChild(c);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const d = 40 + Math.random() * 60;
      gsap.timeline({ onComplete: () => c.remove() })
        .set(c, { x: cx, y: cy, opacity: 1, rotation: Math.random() * 180 })
        .to(c, { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, rotation: "+=260", duration: 0.55, ease: "power3.out" })
        .to(c, { y: "+=40", opacity: 0, duration: 0.5, ease: "power1.in" });
    }
    gsap.fromTo(".ladder", { scale: 1 }, { scale: 1.02, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" });
  }

  /* ---------------- free gift ---------------- */
  function onGiftTier(unlocked) {
    const pick = $("#giftPick");
    if (unlocked) {
      if (state.gift) return addGiftLine(state.gift);
      pick.hidden = false;
      $("#giftRow").innerHTML = D.gifts
        .map((g, i) => `<button class="gift" type="button" role="radio" aria-checked="false" tabindex="${i ? -1 : 0}" data-gift="${g.id}">
            <span class="gift__art" style="--tint:${g.tint}">${svg(ART[g.art])}</span><b>${esc(g.title)}</b><span>${esc(g.note)}</span></button>`)
        .join("");
      if (!reduced()) {
        gsap.fromTo(pick, { opacity: 0, y: -10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(2)" });
        gsap.fromTo(".gift", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.07, delay: 0.1, ease: "back.out(2)" });
      }
    } else {
      pick.hidden = true;
      const had = state.lines.find((l) => l.gift);
      if (had) {
        removeLine(had.key, true);
        announce("Free gift removed. Add more to keep it.");
      }
    }
  }

  function addGiftLine(giftId) {
    state.gift = giftId;
    if (state.lines.some((l) => l.gift)) return;
    state.lines.unshift({ key: `gift-${giftId}`, id: null, giftId, qty: 1, gift: true });
    renderLines();
  }

  /* ==========================================================================
     Lines
     ========================================================================== */
  function lineMarkup(l) {
    if (l.gift) {
      const g = giftById(l.giftId);
      return `<li class="line" data-flip-id="${l.key}" data-key="${l.key}">
        <span class="line__art" style="--tint:${g.tint}">${svg(ART[g.art])}</span>
        <div><p class="line__title">${esc(g.title)}</p><p class="line__meta">${esc(g.note)}</p><span class="line__badge">Free gift</span></div>
        <div class="line__right"><span class="line__price"><s>${fmt(g.value)}</s>${fmt(0)}</span><button class="line__remove" type="button" data-swap>Change</button></div>
      </li>`;
    }
    const p = product(l.id);
    return `<li class="line" data-flip-id="${l.key}" data-key="${l.key}">
      <img class="line__img" src="${p.image}" alt="">
      <div><p class="line__title">${esc(p.title)}</p><p class="line__meta">${esc(p.color)} · Size M</p>
        <div class="qty" role="group" aria-label="Quantity for ${esc(p.title)}">
          <button type="button" data-q="-1" aria-label="Decrease">−</button><output aria-live="polite">${l.qty}</output><button type="button" data-q="1" aria-label="Increase">+</button>
        </div>
      </div>
      <div class="line__right"><span class="line__price" data-v="${p.price * l.qty}">${fmt(p.price * l.qty)}</span><button class="line__remove" type="button" data-remove>Remove</button></div>
    </li>`;
  }

  function renderLines() {
    const list = $("#lines");
    const flip = Flip.getState($$(".line", list));
    list.innerHTML = state.lines.map(lineMarkup).join("");
    $("#empty").hidden = state.lines.length > 0;
    if (!reduced()) {
      Flip.from(flip, {
        targets: $$(".line", list),
        duration: 0.45,
        ease: "power3.inOut",
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: -14, backgroundColor: "#fff4b8" }, { opacity: 1, y: 0, backgroundColor: "rgba(255,255,255,0)", duration: 0.7, ease: "power3.out", clearProps: "backgroundColor" }),
      });
    }
    refresh();
  }

  function refresh(celebrate = true) {
    const t = totals();
    rollTo($("#tSub"), t.sub);
    $("#discRow").hidden = !t.discount;
    rollTo($("#tDisc"), t.discount, (n) => `−${fmt(n)}`);
    $("#tShip").textContent = t.shipping ? fmt(t.shipping) : t.sub ? "Free" : fmt(0);
    rollTo($("#tTotal"), t.total);
    updateLadder(t, celebrate);
    renderUpsell(t);
    bumpCart();
  }

  function addItem(id) {
    const l = state.lines.find((x) => x.id === id);
    if (l) {
      l.qty += 1;
      const row = $(`.line[data-key="${l.key}"]`);
      if (row) {
        $("output", row).textContent = l.qty;
        rollTo($(".line__price", row), product(id).price * l.qty);
        if (!reduced()) gsap.fromTo(row, { backgroundColor: "#fff4b8" }, { backgroundColor: "rgba(255,255,255,0)", duration: 0.8, clearProps: "backgroundColor" });
        refresh();
        return;
      }
    } else {
      state.lines.push({ key: `p-${id}`, id, qty: 1 });
    }
    renderLines();
    announce(`${product(id).title} added to cart`);
  }

  function removeLine(key, silent) {
    const row = $(`.line[data-key="${key}"]`);
    const done = () => {
      state.lines = state.lines.filter((l) => l.key !== key);
      renderLines();
    };
    if (!row || reduced()) return done();
    gsap.to(row, { height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, duration: 0.35, ease: "power2.in", onComplete: done });
    if (!silent) announce("Item removed");
  }

  function wireLines() {
    $("#lines").addEventListener("click", (e) => {
      const row = e.target.closest(".line");
      if (!row) return;
      const l = state.lines.find((x) => x.key === row.dataset.key);
      if (e.target.closest("[data-remove]")) return removeLine(l.key);
      if (e.target.closest("[data-swap]")) {
        state.gift = null;
        state.lines = state.lines.filter((x) => !x.gift);
        renderLines();
        onGiftTier(true);
        return;
      }
      const q = e.target.closest("[data-q]");
      if (q) {
        const d = +q.dataset.q;
        if (l.qty + d <= 0) return removeLine(l.key);
        l.qty += d;
        $("output", row).textContent = l.qty;
        rollTo($(".line__price", row), product(l.id).price * l.qty);
        refresh();
      }
    });
    $("#giftRow").addEventListener("click", (e) => {
      const g = e.target.closest(".gift");
      if (!g) return;
      $$(".gift").forEach((b) => b.setAttribute("aria-checked", String(b === g)));
      const pick = $("#giftPick");
      const finish = () => {
        pick.hidden = true;
        gsap.set(pick, { clearProps: "all" });
        addGiftLine(g.dataset.gift);
        announce(`${giftById(g.dataset.gift).title} added as your free gift`);
      };
      if (reduced()) return finish();
      gsap.fromTo(g, { scale: 0.92 }, { scale: 1, duration: 0.3, ease: "back.out(3)" });
      gsap.to(pick, { opacity: 0, y: -8, duration: 0.25, delay: 0.25, onComplete: finish });
    });
  }

  /* ---------------- upsells ranked by "gets you to the next tier" ---------------- */
  function renderUpsell(t) {
    const sec = $("#upsell");
    const inCart = new Set(state.lines.map((l) => l.id));
    let pool = D.products.filter((p) => !inCart.has(p.id));
    sec.hidden = !state.showUpsell || !pool.length || !state.lines.length;
    if (sec.hidden) return;
    const gap = t.next ? t.next.threshold - t.sub : 0;
    if (t.next) pool.sort((a, b) => (a.price >= gap ? 0 : 1) - (b.price >= gap ? 0 : 1) || (a.price >= gap ? a.price - b.price : b.price - a.price));
    pool = pool.slice(0, 4);
    $("#upsellTitle").textContent = t.next ? "Get there faster" : "Pairs with your kit";
    const key = pool.map((p) => p.id).join() + (t.next?.id || "");
    if (sec.dataset.key === key) return;
    sec.dataset.key = key;
    $("#upsellRow").innerHTML = pool
      .map((p) => {
        const tag = !t.next ? "Matches your kit" : p.price >= gap ? `Unlocks <em>${esc(t.next.short.toLowerCase())}</em>` : `${fmt(p.price)} closer to ${esc(t.next.short.toLowerCase())}`;
        return `<li class="ucard"><img src="${p.image}" alt=""><div class="ucard__body"><p class="ucard__title">${esc(p.title)} · ${fmt(p.price)}</p><p class="ucard__tag">${tag}</p>
          <button class="ucard__add" type="button" data-add="${p.id}" aria-label="Add ${esc(p.title)}">Add</button></div></li>`;
      })
      .join("");
    if (!reduced()) gsap.fromTo(".ucard", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: "power3.out" });
  }

  /* ==========================================================================
     Drawer
     ========================================================================== */
  let trigger;
  function openDrawer() {
    if (state.open) return;
    state.open = true;
    trigger = document.activeElement;
    const dr = $("#drawer");
    dr.hidden = false;
    document.documentElement.classList.add("is-locked");
    $(".page").inert = true;
    const panel = $("#drawerPanel");
    if (reduced()) {
      gsap.set(".drawer__backdrop", { opacity: 1 });
    } else {
      gsap.to(".drawer__backdrop", { opacity: 1, duration: 0.3 });
      gsap.fromTo(panel, isMobile() ? { yPercent: 100, xPercent: 0 } : { xPercent: 100, yPercent: 0 }, { xPercent: 0, yPercent: 0, duration: 0.55, ease: "power4.out" });
      gsap.fromTo([".ladder", ...$$(".line"), ".upsell", ".drawer__foot"], { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, delay: 0.15, ease: "power3.out", clearProps: "opacity,transform" });
    }
    $(".drawer__head .iconbtn").focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!state.open) return;
    const panel = $("#drawerPanel");
    const done = () => {
      state.open = false;
      $("#drawer").hidden = true;
      gsap.set(panel, { clearProps: "transform" });
      document.documentElement.classList.remove("is-locked");
      $(".page").inert = false;
      (trigger && document.contains(trigger) ? trigger : $("#cartBtn")).focus({ preventScroll: true });
    };
    if (reduced()) return done();
    gsap.to(".drawer__backdrop", { opacity: 0, duration: 0.3 });
    gsap.to(panel, { ...(isMobile() ? { yPercent: 100 } : { xPercent: 100 }), duration: 0.4, ease: "power3.in", onComplete: done });
  }

  function wireDrawer() {
    $("#cartBtn").addEventListener("click", openDrawer);
    $("#drawer").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeDrawer(); });
    $("#checkout").addEventListener("click", (e) => {
      const b = e.currentTarget;
      b.textContent = "Checkout is off in this demo";
      setTimeout(() => (b.textContent = "Checkout"), 1600);
    });
    document.addEventListener("keydown", (e) => {
      if (!state.open) return;
      if (e.key === "Escape") closeDrawer();
      if (e.key === "Tab") {
        const list = $$("button, [href], input, [tabindex]:not([tabindex='-1'])", $("#drawerPanel")).filter((n) => n.getClientRects().length && !n.closest("[hidden]"));
        const first = list[0];
        const last = list[list.length - 1];
        if (!$("#drawerPanel").contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // mobile: drag the sheet header down
    const head = $(".drawer__head");
    const panel = $("#drawerPanel");
    let y0 = 0, dy = 0, drag = false;
    head.addEventListener("pointerdown", (e) => {
      if (!isMobile() || e.target.closest("button")) return;
      drag = true; y0 = e.clientY; dy = 0; head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", (e) => { if (drag) { dy = Math.max(0, e.clientY - y0); gsap.set(panel, { y: dy }); } });
    const up = () => {
      if (!drag) return;
      drag = false;
      if (dy > 110) { gsap.set(panel, { y: 0, yPercent: (dy / panel.offsetHeight) * 100 }); closeDrawer(); }
      else gsap.to(panel, { y: 0, duration: 0.4, ease: "back.out(1.6)" });
    };
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", up);
  }

  /* ---------------- add buttons (grid + upsell) ---------------- */
  function wireAdds() {
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-add]");
      if (!b) return;
      const id = b.dataset.add;
      const img = b.closest(".card, .ucard")?.querySelector("img");
      if (state.open) {
        fly(img, $("#lines").firstElementChild || $("#lines"), () => addItem(id));
      } else {
        fly(img, $("#cartBtn"), () => {
          addItem(id);
          openDrawer();
        });
      }
    });
  }

  /* ---------------- merchant settings ---------------- */
  function wireMerchant() {
    const btn = $("#merchantBtn");
    const panel = $("#merchantPanel");
    const ranges = { ship: [50, 150], gift: [100, 250], off: [150, 350] };
    $("#tierControls").innerHTML = D.rewards
      .map((r) => `<div class="tier"><label for="t-${r.id}">${esc(r.short)} at <output id="o-${r.id}">${fmt(r.threshold)}</output></label>
        <input type="range" id="t-${r.id}" min="${ranges[r.id][0]}" max="${ranges[r.id][1]}" step="5" value="${r.threshold}"></div>`)
      .join("");
    D.rewards.forEach((r, i) => {
      $(`#t-${r.id}`).addEventListener("input", (e) => {
        let v = +e.target.value;
        const prev = D.rewards[i - 1];
        const next = D.rewards[i + 1];
        if (prev && v <= prev.threshold) v = prev.threshold + 5;
        if (next && v >= next.threshold) v = next.threshold - 5;
        e.target.value = v;
        r.threshold = v;
        $(`#o-${r.id}`).textContent = fmt(v);
        buildLadder();
        refresh();
      });
    });
    $("#upsellToggle").addEventListener("change", (e) => {
      state.showUpsell = e.target.checked;
      $("#upsell").dataset.key = "";
      refresh(false);
    });
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      if (open && !reduced()) gsap.fromTo(panel, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(2)", transformOrigin: "0 100%" });
    });
  }

  async function init() {
    D = await loadData();
    renderGrid();
    buildLadder();
    renderLines();
    wireLines();
    wireDrawer();
    wireAdds();
    wireMerchant();
    if (!reduced()) {
      gsap.from(".hero > *", { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 });
      gsap.from(".card", { y: 30, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.05, delay: 0.15, clearProps: "transform,opacity" });
    }
  }
  init().catch((e) => { console.error(e); $("#grid").innerHTML = "<li>Store data could not load. Run npx serve or node tools/sync-data.mjs.</li>"; });
})();
