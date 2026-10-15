/* ==========================================================================
   Wildpace · Pip companion: page behaviour + intent engine
   pip.js is the character; this file decides what Pip does and when.
   State lives in sessionStorage so Pip "walks" with the shopper from the
   collection page to the product page (the same thing a Shopify app embed
   would do across real page loads).
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  const page = document.body.dataset.page;
  const KEY = "pip.demo.v1";

  // Data: the generated mirror is loaded synchronously so Pip can be placed
  // before the first paint (keeps the cross-page hand-off seamless).
  const D = window.__PROTO_DATA__ && window.__PROTO_DATA__.store;
  if (!D) {
    document.body.insertAdjacentHTML("afterbegin", "<p style='padding:20px'>Store data missing. Run <code>node tools/sync-data.mjs</code>.</p>");
    return;
  }
  const L = D.lines;
  const R = D.rules;
  const product = (id) => D.products.find((p) => p.id === id);

  /* ---------------- session state ---------------- */
  const fresh = () => ({ enabled: true, cart: 0, discount: false, offered: false, sad: false, sneaked: false, carry: null });
  let S = load();
  function load() {
    try { return { ...fresh(), ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; } catch (e) { return fresh(); }
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: in-memory only */ } }
  function takeCarry() { const c = S.carry; S.carry = null; save(); return c; }

  /* ---------------- helpers ---------------- */
  const last = {};
  function line(key, vars = {}) {
    const arr = L[key];
    let i = Math.floor(Math.random() * arr.length);
    if (arr.length > 1 && i === last[key]) i = (i + 1) % arr.length;
    last[key] = i;
    return arr[i].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  }
  const priceOf = (p) => (S.discount ? Math.round(p.price * (100 - D.offer.percent)) / 100 : p.price);
  const fmt = (n) => `${D.shop.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
  function announce(m) { const l = $("#liveRegion"); l.textContent = ""; requestAnimationFrame(() => (l.textContent = m)); }
  const visible = (el, pad = 0) => { const r = el.getBoundingClientRect(); return r.top > pad && r.bottom < innerHeight - pad; };

  function updateCart(bump) {
    $("#cartCount").textContent = S.cart;
    $("#cartBtn").setAttribute("aria-label", `Cart, ${S.cart} item${S.cart === 1 ? "" : "s"}`);
    if (bump && !reduced()) gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.15, yoyo: true, repeat: 1, duration: 0.15 });
  }

  /* ---------------- Pip setup ---------------- */
  Pip.mount({
    onPoke: () => {
      if (!S.enabled) return;
      Pip.burst("hearts", 4);
      Pip.say(S.sad ? "…" : line("poke"), { ms: 1400 });
    },
  });
  Pip.place(-200, -200);
  if (!S.enabled) Pip.setEnabled(false);

  const sw = $("#pipSwitch");
  sw.setAttribute("aria-checked", String(S.enabled));
  sw.addEventListener("click", () => {
    S.enabled = !S.enabled;
    save();
    sw.setAttribute("aria-checked", String(S.enabled));
    Pip.setEnabled(S.enabled);
    if (S.enabled) Pip.act(async (g) => { await g(Pip.enterFromBelow()); Pip.wave(); Pip.say(line("hello"), { ms: 1400 }); });
    announce(S.enabled ? "Pip is on." : "Pip is hidden.");
  });

  /* ---------------- idle detection (both pages) ---------------- */
  const idle = { t: 0, sleeping: false, cb: null };
  function armIdle(ms, cb) {
    idle.cb = cb;
    const reset = () => {
      clearTimeout(idle.t);
      if (idle.sleeping) {
        idle.sleeping = false;
        if (S.enabled && !S.sad) Pip.act(async (g) => { Pip.mood("curious"); await g(Pip.hop(1, 10)); Pip.say(line("wake"), { ms: 1100 }); Pip.mood("idle"); });
      }
      idle.t = setTimeout(() => idle.cb?.(), ms);
    };
    ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, reset, { passive: true }));
    reset();
  }

  /* ---------------- Pip Lab panel ---------------- */
  function wireLab(handlers) {
    const t = $("#labToggle");
    t.addEventListener("click", () => {
      const open = t.getAttribute("aria-expanded") !== "true";
      t.setAttribute("aria-expanded", String(open));
      $("#labBody").hidden = !open;
    });
    $("#labBody").addEventListener("click", (e) => {
      const b = e.target.closest("[data-lab]");
      if (!b) return;
      if (b.dataset.lab === "reset") {
        try { sessionStorage.removeItem(KEY); } catch (err) { /* ignore */ }
        location.href = "index.html";
        return;
      }
      handlers[b.dataset.lab]?.();
    });
  }

  /* ==========================================================================
     COLLECTION PAGE
     ========================================================================== */
  function initCollection() {
    $("#pageTitle").textContent = D.shop.collection;
    $("#pageIntro").textContent = D.shop.intro;
    const promo = $("#promo");
    promo.hidden = !S.discount;
    promo.textContent = `${D.offer.code} applied: ${D.offer.percent}% off`;
    $("#grid").innerHTML = D.products
      .map((p) => {
        const c = p.colors[0];
        return `<li><a class="card" href="product.html?p=${p.id}" data-id="${p.id}">
          <div class="card__media"><img src="${c.image}" alt="${esc(p.title)} in ${esc(c.name)}" loading="lazy" decoding="async"></div>
          <div class="card__info"><div><h2 class="card__title">${esc(p.title)}</h2><p class="card__meta">★ ${p.rating} · ${p.colors.length} colours</p>
            <div class="card__dots" aria-hidden="true">${p.colors.map((x) => `<i style="--c:${x.hex}"></i>`).join("")}</div></div>
            <span class="card__price">${S.discount ? `<s>${fmt(p.price)}</s>` : ""}${fmt(priceOf(p))}</span></div>
        </a></li>`;
      })
      .join("");
    updateCart(false);
    if (!reduced()) {
      gsap.from(".intro > *", { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 });
      gsap.from(".card", { y: 30, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.05, delay: 0.1, clearProps: "transform,opacity" });
    }

    const cards = $$(".card");
    let lastAt = 0;
    let lastCard = null;
    let navigating = false;

    /** Pip hops onto a card's photo and pays a compliment. */
    async function compliment(card, g) {
      const p = product(card.dataset.id);
      const t = Pip.perch($(".card__media", card), 0.8, 0);
      S.sad = false;
      Pip.stand();
      Pip.mood("curious");
      await g(Pip.jumpTo(t.x, t.y));
      Pip.mood("happy");
      Pip.point("down");
      Pip.burst("hearts", 5);
      await g(Pip.say(Math.random() < 0.5 ? p.hook : line("compliment", { color: p.colors[0].name }), { ms: 2600 }));
      Pip.armsDown();
    }
    function bestVisibleCard() {
      const mid = innerHeight * 0.45;
      return cards.filter((c) => visible($(".card__media", c), 0)).sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return Math.abs(ra.top + ra.height / 2 - mid) - Math.abs(rb.top + rb.height / 2 - mid);
      })[0] || cards.find((c) => c.getBoundingClientRect().top < innerHeight);
    }
    function dwell(card, cooldown = 2500) {
      if (!S.enabled || navigating) return;
      if (Date.now() - lastAt < cooldown || lastCard === card) return;
      lastAt = Date.now();
      lastCard = card;
      Pip.act(async (g) => {
        await compliment(card, g);
        await g(Pip.wait(1400));
        if (!card.matches(":hover") && !card.contains(document.activeElement)) { Pip.mood("idle"); await g(Pip.dock()); }
      });
    }

    /* The sneak-in: Pip peeks over the bottom edge, tiptoes in, then says hi. */
    function sneakIn() {
      return Pip.act(async (g) => {
        const d = Pip.dockPoint();
        Pip.stand();
        Pip.mood("sneaky");
        Pip.place(d.x + 50, scrollY + innerHeight + 60);
        await g(Pip.wait(700));
        if (!reduced()) await g(gsap.to(Pip.el, { y: scrollY + innerHeight + 26, duration: 0.6, ease: "power2.out" }));
        await g(Pip.wait(500));
        await g(Pip.say(line("sneak"), { ms: 1100 }));
        await g(Pip.jumpTo(d.x + 50, d.y, { height: 34 }));
        await g(Pip.walkTo(d.x + 170, d.y, { sneaky: true }));
        Pip.mood("happy");
        await g(Pip.hop(1));
        Pip.wave();
        await g(Pip.say(line("hello"), { ms: 1300 }));
        const card = bestVisibleCard();
        if (card) { lastCard = card; lastAt = Date.now(); await compliment(card, g); }
        S.sneaked = true;
        save();
        await g(Pip.wait(1800));
        Pip.mood("idle");
        await g(Pip.dock());
      });
    }

    /* Clicking a product: Pip gets VERY happy and rides along to the PDP. */
    function pick(card, e) {
      e.preventDefault();
      if (navigating) return;
      const href = card.getAttribute("href");
      const go = () => {
        if (navigating) return;
        navigating = true;
        const p = Pip.pos();
        S.carry = { vx: p.x - scrollX, vy: p.y - scrollY, from: "collection" };
        S.sad = false;
        save();
        $(".card__media img", card).style.viewTransitionName = "hero";
        location.href = href;
      };
      if (!S.enabled || reduced()) return go();
      setTimeout(go, 2600); // safety net
      Pip.act(async (g) => {
        Pip.stand();
        Pip.mood("ecstatic");
        const t = Pip.perch($(".card__media", card), 0.5, 0);
        await g(Pip.jumpTo(t.x, t.y));
        Pip.burst("hearts", 10);
        Pip.say(line("pick"), { ms: 900 });
        await g(Pip.hop(2, 18));
        go();
      });
    }

    cards.forEach((card) => {
      let t = 0;
      card.addEventListener("pointerenter", () => { if (canHover()) { clearTimeout(t); t = setTimeout(() => dwell(card), 900); } });
      card.addEventListener("pointerleave", () => clearTimeout(t));
      card.addEventListener("focus", () => { if (card.matches(":focus-visible")) { clearTimeout(t); t = setTimeout(() => dwell(card), 700); } });
      card.addEventListener("blur", () => clearTimeout(t));
      card.addEventListener("click", (e) => pick(card, e));
    });

    // Touch screens: compliment the card the shopper stops scrolling on.
    let restT = 0;
    let lastY = scrollY;
    let lastT = performance.now();
    let fastAt = 0;
    addEventListener("scroll", () => {
      const now = performance.now();
      const v = Math.abs(scrollY - lastY) / Math.max(1, now - lastT);
      lastY = scrollY;
      lastT = now;
      if (v > 4.5 && Pip.state.docked && Date.now() - fastAt > 20000 && S.enabled && !S.sad) {
        fastAt = Date.now();
        Pip.mood("curious");
        Pip.say(line("fastScroll"), { ms: 1000 }).then(() => Pip.state.mood === "curious" && Pip.mood("idle"));
      }
      if (!canHover()) {
        clearTimeout(restT);
        restT = setTimeout(() => { const c = bestVisibleCard(); if (c) dwell(c, 8000); }, 1100);
      }
    }, { passive: true });

    armIdle(14000, () => {
      if (!S.enabled || S.sad) return;
      idle.sleeping = true;
      Pip.act(async (g) => { await g(Pip.dock()); Pip.sit(); Pip.mood("sleepy"); });
    });

    wireLab({ replay: () => { S.sneaked = false; sneakIn(); } });

    // Entrance
    const carry = takeCarry();
    if (!S.enabled) return;
    if (carry) {
      Pip.placeViewport(carry.vx, carry.vy);
      Pip.mood(S.sad ? "sad" : "happy");
      Pip.act(async (g) => {
        await g(Pip.hop(1));
        await g(Pip.dock());
        if (S.sad) { Pip.sit(); Pip.say(line("sad"), { ms: 1800 }); }
        else { Pip.mood("idle"); Pip.say("Back for more?", { ms: 1400 }); }
      });
    } else if (!S.sneaked) {
      sneakIn();
    } else {
      Pip.mood(S.sad ? "sad" : "idle");
      Pip.act(async (g) => { await g(Pip.enterFromBelow()); if (S.sad) Pip.sit(); else Pip.wave(); });
    }
  }

  /* ==========================================================================
     PRODUCT PAGE + INTENT ENGINE
     ========================================================================== */
  function initProduct() {
    const P = product(new URLSearchParams(location.search).get("p")) || D.products[0];
    const st = { color: 0, size: null };
    const carry = takeCarry();

    // Place Pip before anything awaits so the page hand-off lines up.
    if (S.enabled && carry) {
      Pip.placeViewport(carry.vx, carry.vy);
      Pip.mood("happy");
    }

    document.title = `${P.title} · ${D.shop.name}`;
    $("#pTitle").textContent = P.title;
    $("#pRating").innerHTML = `<b>★ ${P.rating}</b> · ${P.count} reviews`;
    $("#pDetails").textContent = P.details;
    renderPrice(false);
    const hero = $("#heroImg");
    hero.src = P.colors[0].image;
    hero.alt = `${P.title} in ${P.colors[0].name}`;
    $("#colorName").textContent = P.colors[0].name;
    $("#thumbs").innerHTML = P.colors.map((c, i) => `<button type="button" data-i="${i}" aria-current="${i === 0}" aria-label="${esc(c.name)} photo"><img src="${c.image}" alt=""></button>`).join("");
    $("#swatches").innerHTML = P.colors.map((c, i) => `<label class="swatch" title="${esc(c.name)}"><input type="radio" name="color" value="${i}" ${i === 0 ? "checked" : ""} aria-label="${esc(c.name)}"><span style="--c:${c.hex}"></span></label>`).join("");
    $("#sizes").innerHTML = P.sizes.map(([s, ok]) => `<label class="size${ok ? "" : " is-out"}"><input type="radio" name="size" value="${s}" ${ok ? "" : "disabled"} aria-label="${s}${ok ? "" : ", sold out"}"><span aria-hidden="true">${s}</span></label>`).join("");
    $("#reviewList").innerHTML = D.reviews.map((r) => `<li><b>★★★★★ ${esc(r.author)}</b>${esc(r.text)}</li>`).join("");
    updateCart(false);

    function renderPrice(animate) {
      const el = $("#pPrice");
      el.innerHTML = S.discount
        ? `<s>${fmt(P.price)}</s><span>${fmt(priceOf(P))}</span><span class="applied">${D.offer.code} · ${D.offer.percent}% off</span>`
        : `<span>${fmt(P.price)}</span>`;
      if (animate && !reduced()) gsap.fromTo(el.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: "back.out(2)" });
    }
    function setColor(i) {
      st.color = i;
      const c = P.colors[i];
      $("#colorName").textContent = c.name;
      $(`#swatches input[value="${i}"]`).checked = true;
      $$("#thumbs button").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.i === i)));
      if (reduced()) hero.src = c.image;
      else gsap.to(hero, { opacity: 0, duration: 0.15, onComplete: () => { hero.src = c.image; hero.alt = `${P.title} in ${c.name}`; gsap.to(hero, { opacity: 1, duration: 0.3 }); } });
    }

    /* ---------------- intent engine ---------------- */
    const I = { risk: 0, log: [], added: false, changes: [], cool: {}, offerT: 0, hoverAt: 0, hiddenAt: 0 };
    const cooled = (k, ms) => { if (Date.now() - (I.cool[k] || 0) < ms) return false; I.cool[k] = Date.now(); return true; };

    function renderLab() {
      const r = I.risk;
      const fill = $("#riskFill");
      const pct = Math.min(1, r / 6);
      const col = I.added ? "#3fae5a" : r >= R.offerAt ? "#e2452c" : r >= 1.5 ? "#f2a33a" : "#3fae5a";
      gsap.to(fill, { scaleX: I.added ? 1 : pct, backgroundColor: col, duration: reduced() ? 0 : 0.4 });
      $("#riskLabel").textContent = I.added ? "Converted" : S.sad ? "Lost (sad Pip)" : r >= R.offerAt ? "Leaving" : r >= 1.5 ? "Wavering" : "Calm";
      $("#riskMark").style.left = `${(R.offerAt / 6) * 100}%`;
      $("#labLog").innerHTML = I.log.map((l) => `<li class="${l.d > 0 ? "up" : "down"}"><span>${esc(l.label)}</span><b>${l.d > 0 ? "+" : ""}${l.d}</b></li>`).join("") || "<li><span>No signals yet</span><b>0</b></li>";
    }

    /** Record a behaviour signal and let Pip react to it. */
    function signal(kind, d, label) {
      if (I.added && d > 0) return;
      I.risk = Math.max(0, Math.min(6, I.risk + d));
      I.log.unshift({ label, d });
      I.log.length = Math.min(I.log.length, 7);
      renderLab();
      if (!S.enabled) return;
      if (d < 0) return cheerUp();
      if (I.risk >= R.offerAt) {
        if (!S.offered) return offer();
        if (!S.sad && !S.discount) return goSad();
        if (!S.sad && S.discount && kind === "exit") return goSad();
      }
      const small = {
        hesitate: () => Pip.act(async (g) => { Pip.mood("worried"); await g(Pip.say(line("hesitate"), { ms: 1400 })); Pip.mood("idle"); }),
        idle: () => Pip.act(async (g) => { await g(Pip.dock()); Pip.sit(); Pip.mood("sleepy"); Pip.say(line("idle"), { ms: 1800 }); }),
        tab: () => Pip.act(async (g) => { Pip.stand(); Pip.mood("curious"); await g(Pip.hop(1)); await g(Pip.say(line("back"), { ms: 1200 })); Pip.mood("idle"); }),
        indecision: () => Pip.act(async (g) => { Pip.mood("curious"); await g(Pip.say(line("indecision"), { ms: 2400 })); Pip.mood("idle"); }),
        exit: () => Pip.act(async (g) => { Pip.mood("worried"); await g(Pip.say(line("worried"), { ms: 1200 })); }),
      };
      if (!S.sad) small[kind]?.();
    }

    /** Any genuine engagement lifts a sad Pip back up. */
    function cheerUp() {
      if (!S.sad) return;
      S.sad = false;
      save();
      renderLab();
      Pip.act(async (g) => { Pip.stand(); Pip.mood("curious"); await g(Pip.hop(1, 10)); Pip.mood("happy"); await g(Pip.say("Oh? Oh!", { ms: 900 })); });
    }

    function offer() {
      S.offered = true;
      save();
      Pip.act(async (g) => {
        Pip.stand();
        Pip.mood("worried");
        await g(Pip.dock());
        await g(Pip.hop(1, 12));
        await g(Pip.say(line("worried"), { ms: 900 }));
        Pip.mood("curious");
        const b = Pip.showBoard(`
          <p class="pip-board__title">${esc(D.offer.title)}</p>
          <p class="pip-board__body">${esc(D.offer.body)}</p>
          <span class="pip-board__code">${esc(D.offer.code)}</span>
          <div class="pip-board__btns">
            <button class="pip-board__apply" type="button">Apply ${D.offer.percent}% off</button>
            <button class="pip-board__no" type="button">No thanks</button>
          </div>`);
        $(".pip-board__apply", b).addEventListener("click", applyOffer);
        $(".pip-board__no", b).addEventListener("click", () => declineOffer("Said no thanks"));
        announce(`Pip is offering ${D.offer.percent}% off with code ${D.offer.code}. The Apply and No thanks buttons are at the bottom of the page.`);
        clearTimeout(I.offerT);
        I.offerT = setTimeout(() => declineOffer(`Ignored the offer for ${R.offerIgnoredSeconds} s`), R.offerIgnoredSeconds * 1000);
      });
    }

    function applyOffer() {
      clearTimeout(I.offerT);
      S.discount = true;
      S.sad = false;
      save();
      I.log.unshift({ label: `Took ${D.offer.code}`, d: -I.risk });
      I.risk = 0;
      renderLab();
      renderPrice(true);
      announce(`${D.offer.percent}% off applied. New price ${fmt(priceOf(P))}.`);
      Pip.hideBoard().then(() => Pip.act(async (g) => {
        Pip.mood("ecstatic");
        Pip.burst("confetti", 14);
        await g(Pip.hop(2));
        const atc = $("#atc");
        if (visible(atc, 10)) { const t = Pip.perch(atc, 0.86, 0); await g(Pip.jumpTo(t.x, t.y)); Pip.point("down"); }
        await g(Pip.say(line("applied"), { ms: 2200 }));
        Pip.armsDown();
      }));
      $("#atc").focus({ preventScroll: true });
    }

    function declineOffer(reason) {
      clearTimeout(I.offerT);
      I.log.unshift({ label: reason, d: 0 });
      Pip.hideBoard().then(goSad);
    }

    function goSad() {
      if (I.added) return;
      S.sad = true;
      save();
      renderLab();
      Pip.act(async (g) => {
        Pip.stand();
        Pip.mood("sad");
        await g(Pip.say(line("sad"), { ms: 1900 }));
        await g(Pip.dock("walk", { speed: 55 }));
        Pip.sit();
        await g(Pip.wait(2600));
        Pip.say("…", { ms: 1600 });
      });
    }

    /* ---------------- signal sources ---------------- */
    // 1. Exit intent: the cursor leaves through the top of the window (towards tabs / close / back).
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget && e.clientY <= 10 && cooled("exit", 6000)) signal("exit", R.exitIntent, "Cursor headed for the tabs");
    });
    // 2. Tab switching (comparison shopping)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) I.hiddenAt = Date.now();
      else if (I.hiddenAt && Date.now() - I.hiddenAt > 1500) signal("tab", R.tabAway, "Switched tabs, came back");
    });
    // 3. Idle on the page
    armIdle(R.idleSeconds * 1000, () => {
      signal("idle", R.idle, `Idle for ${R.idleSeconds} s`);
      idle.sleeping = !S.sad && I.risk < R.offerAt;
      idle.t = setTimeout(() => idle.cb?.(), R.idleSeconds * 1000);
    });
    // 4. Hovering Add to cart, then backing off
    const atc = $("#atc");
    atc.addEventListener("pointerenter", () => (I.hoverAt = Date.now()));
    atc.addEventListener("pointerleave", () => {
      if (I.hoverAt && Date.now() - I.hoverAt > 350 && !I.added && cooled("hes", 5000)) signal("hesitate", R.atcHesitation, "Hovered Add to cart, then left");
      I.hoverAt = 0;
    });
    // 5. Indecision: lots of option flipping without adding
    function optionChanged() {
      const now = Date.now();
      I.changes = I.changes.filter((t) => now - t < 25000).concat(now);
      if (I.changes.length >= 5 && cooled("indecision", 20000)) { I.changes = []; signal("indecision", R.indecision, "Flip-flopping between options"); }
    }

    /* ---------------- positive interactions ---------------- */
    $("#swatches").addEventListener("change", (e) => {
      const i = +e.target.value;
      setColor(i);
      optionChanged();
      signal("colour", R.colourPicked, `Tried ${P.colors[i].name}`);
      if (!S.enabled) return;
      Pip.act(async (g) => { Pip.stand(); Pip.mood("happy"); Pip.burst("hearts", 4); await g(Pip.say(line("color", { color: P.colors[i].name }), { ms: 1600 })); });
    });
    $("#thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      setColor(+b.dataset.i);
      if (cooled("gallery", 15000)) { signal("gallery", R.galleryBrowsed, "Browsed the photos"); Pip.say(line("gallery"), { ms: 1300 }); }
    });
    $("#sizes").addEventListener("change", (e) => {
      st.size = e.target.value;
      $("#sizeHint").textContent = `${st.size} selected`;
      optionChanged();
      signal("size", R.sizePicked, `Picked size ${st.size}`);
      if (!S.enabled || I.added) return;
      Pip.act(async (g) => {
        Pip.stand();
        Pip.mood("happy");
        if (visible(atc, 10)) { const t = Pip.perch(atc, 0.86, 0); await g(Pip.jumpTo(t.x, t.y)); Pip.point("down"); }
        await g(Pip.say(line("size", { size: st.size }), { ms: 2200 }));
        Pip.armsDown();
      });
    });
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      signal("reviews", R.reviewsSeen, "Read the reviews");
      if (S.enabled && !S.sad && Pip.state.docked) Pip.say(line("reviews"), { ms: 1600 });
    }, { threshold: 0.4 }).observe($("#reviews"));

    /* ---------------- add to cart ---------------- */
    atc.addEventListener("click", () => {
      if (!st.size) {
        if (!reduced()) gsap.fromTo("#sizes", { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, 0] }, duration: 0.4 });
        $("#sizeHint").textContent = "Choose a size first";
        $("#sizes input:not(:disabled)").focus();
        if (S.enabled) Pip.act(async (g) => { Pip.stand(); Pip.mood("worried"); const t = Pip.perch($("#sizes"), 0.5, 0); await g(Pip.jumpTo(t.x, t.y)); Pip.point("down"); await g(Pip.say(line("needSize"), { ms: 1600 })); Pip.armsDown(); Pip.mood("idle"); });
        return;
      }
      const wasSad = S.sad;
      I.added = true;
      I.risk = 0;
      clearTimeout(I.offerT);
      S.cart += 1;
      S.sad = false;
      save();
      updateCart(true);
      renderLab();
      $("span", atc).textContent = "Added ✓";
      atc.classList.add("is-done");
      setTimeout(() => { $("span", atc).textContent = "Add another"; atc.classList.remove("is-done"); }, 2200);
      announce(`Added ${P.title}, ${P.colors[st.color].name}, size ${st.size} to cart.`);
      confettiFrom(atc);
      if (!S.enabled) return;
      Pip.hideBoard();
      Pip.act(async (g) => {
        Pip.stand();
        Pip.mood("ecstatic");
        Pip.burst("confetti", 16);
        Pip.say(wasSad ? line("comeback") : line("added"), { ms: 2400 });
        await g(Pip.hop(2, 22));
        const cart = $("#cartBtn");
        if (cart.getBoundingClientRect().bottom > 0) {
          const head = $(".topbar").getBoundingClientRect();
          const c = cart.getBoundingClientRect();
          await g(Pip.jumpTo(c.left + c.width / 2 + scrollX, head.bottom + scrollY + 64));
          Pip.point("up");
          Pip.burst("hearts", 8);
          await g(Pip.hop(1));
          await g(Pip.wait(1400));
          Pip.armsDown();
        }
        Pip.mood("happy");
        await g(Pip.dock());
      });
    });

    function confettiFrom(el) {
      if (reduced()) return;
      const host = $(".confetti-layer");
      const r = el.getBoundingClientRect();
      const colors = ["#ff6a1f", "#ffe14d", "#3fae5a", "#4f7dff", "#151515"];
      for (let i = 0; i < 36; i++) {
        const c = document.createElement("i");
        c.style.background = colors[i % colors.length];
        host.appendChild(c);
        const x = r.left + Math.random() * r.width;
        gsap.timeline({ onComplete: () => c.remove() })
          .set(c, { x, y: r.top, rotation: Math.random() * 180 })
          .to(c, { y: r.top - 120 - Math.random() * 160, x: x + (Math.random() - 0.5) * 220, rotation: "+=360", duration: 0.6, ease: "power2.out" })
          .to(c, { y: "+=320", opacity: 0, rotation: "+=180", duration: 1.1, ease: "power1.in" });
      }
    }

    // Back link: Pip rides back to the collection.
    $("#backLink").addEventListener("click", (e) => {
      if (!S.enabled) return;
      e.preventDefault();
      const go = () => { const p = Pip.pos(); S.carry = { vx: p.x - scrollX, vy: p.y - scrollY }; save(); location.href = "index.html"; };
      Pip.act(async (g) => { await g(Pip.hop(1)); go(); });
      setTimeout(go, 900);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.querySelector(".pip-board:not([hidden])")) declineOffer("Dismissed the offer");
    });

    wireLab({
      exit: () => signal("exit", R.exitIntent, "Cursor headed for the tabs (simulated)"),
      tab: () => signal("tab", R.tabAway, "Switched tabs, came back (simulated)"),
      idle: () => signal("idle", R.idle, `Idle for ${R.idleSeconds} s (simulated)`),
    });
    renderLab();

    if (!reduced()) {
      gsap.from(".buy > *", { y: 16, opacity: 0, duration: 0.6, stagger: 0.04, delay: 0.15, ease: "power3.out", clearProps: "transform,opacity" });
    }

    // Entrance
    if (!S.enabled) return;
    if (carry) {
      Pip.act(async (g) => {
        await g(Pip.hop(2));
        Pip.burst("hearts", 6);
        if (visible(atc, 10)) { const t = Pip.perch(atc, 0.86, 0); await g(Pip.jumpTo(t.x, t.y)); Pip.point("up"); }
        await g(Pip.say(line("pdpEnter"), { ms: 2400 }));
        Pip.armsDown();
        Pip.mood("idle");
      });
    } else {
      Pip.mood(S.sad ? "sad" : "idle");
      Pip.act(async (g) => {
        await g(Pip.enterFromBelow());
        if (S.sad) { Pip.sit(); return; }
        Pip.wave();
        await g(Pip.say(line("pdpCold"), { ms: 1600 }));
      });
    }
  }

  if (page === "collection") initCollection();
  else initProduct();
})();
