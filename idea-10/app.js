/* ==========================================================================
   Cacao & Co · Gift Mode prototype
   One switch turns a normal PDP into a gift flow: the product image wraps
   itself, the shopper picks paper, writes a live note card, hides prices and
   schedules delivery. Add to cart seals the note in an envelope.
   Data: data/gift.json.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let D;
  const S = { gift: false, wrap: "kraft", font: "hand", to: "", from: "", msg: "", hide: true, schedule: false, day: null, img: 0, cart: 0 };
  const G = () => D.gift;
  const wrap = () => G().wraps.find((w) => w.id === S.wrap);
  const fmt = (n) => `${D.shop.currency}${n}`;
  const announce = (m) => { const l = $("#liveRegion"); l.textContent = ""; requestAnimationFrame(() => (l.textContent = m)); };

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.gift;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const r = await fetch("data/gift.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (mirror()) return mirror();
      throw e;
    }
  }

  /* ==========================================================================
     Product media
     ========================================================================== */
  function renderMedia() {
    const p = D.product;
    $("#heroImg").src = p.images[0];
    $("#heroImg").alt = p.title;
    $("#thumbs").innerHTML = p.images.map((src, i) => `<button type="button" aria-current="${i === 0}" aria-label="Image ${i + 1}" data-i="${i}"><img src="${src}" alt="" loading="lazy"></button>`).join("");
    $("#thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      S.img = +b.dataset.i;
      $$("#thumbs button").forEach((x) => x.setAttribute("aria-current", String(x === b)));
      if (S.gift) setGift(false, true); // unwrap to show the photo
      const img = $("#heroImg");
      if (reduced()) img.src = p.images[S.img];
      else gsap.to(img, { opacity: 0, duration: 0.15, onComplete: () => { img.src = p.images[S.img]; gsap.to(img, { opacity: 1, duration: 0.3 }); } });
    });
  }

  /* ---------------- wrapping paper ---------------- */
  function paintWrap() {
    const w = wrap();
    ["#paperLfill", "#paperRfill"].forEach((s) => $(s).setAttribute("fill", w.paper));
    ["#paperLpat", "#paperRpat"].forEach((s) => $(s).setAttribute("fill", `url(#pat-${w.pattern})`));
    ["#ribV", "#ribH", "#bowL", "#bowR", "#tailL", "#tailR"].forEach((s) => $(s).setAttribute("fill", w.ribbon));
    $("#knot").setAttribute("fill", w.ribbon);
    // Loops and tails get an outline and a shaded fill so the bow reads in front of the ribbon.
    ["#bowL", "#bowR", "#tailL", "#tailR", "#knot"].forEach((sel) => {
      const el = $(sel);
      el.setAttribute("stroke", "rgba(0,0,0,0.28)");
      el.setAttribute("stroke-width", "2");
    });
    ["#bowL", "#bowR"].forEach((sel) => $(sel).setAttribute("filter", "url(#bowShade)"));
    $("#tagText").textContent = S.to ? `For ${S.to}` : "For you";
  }

  function wrapIn() {
    const svg = $("#wrap");
    paintWrap();
    gsap.set(svg, { visibility: "visible" });
    gsap.to("#heroBadge", { opacity: 1, duration: 0.3, delay: reduced() ? 0 : 1.2 });
    if (reduced()) {
      gsap.set(["#paperL", "#paperR", "#ribV", "#ribH", "#bow", "#tag", "#foldShade"], { clearProps: "all", opacity: 1 });
      return;
    }
    gsap.timeline()
      .fromTo("#paperL", { xPercent: -100 }, { xPercent: 0, duration: 0.6, ease: "power3.out" }, 0)
      .fromTo("#paperR", { xPercent: 100 }, { xPercent: 0, duration: 0.6, ease: "power3.out" }, 0.08)
      .fromTo("#foldShade", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.5)
      .fromTo("#ribV", { scaleY: 0, transformOrigin: "50% 0%" }, { scaleY: 1, duration: 0.4, ease: "power2.out" }, 0.6)
      .fromTo("#ribH", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.4, ease: "power2.out" }, 0.75)
      .fromTo("#bow", { scale: 0, rotation: -40, transformOrigin: "50% 50%" }, { scale: 1, rotation: 0, duration: 0.7, ease: "elastic.out(1, 0.5)" }, 1.0)
      .fromTo("#tag", { opacity: 0, y: -40, rotation: -30 }, { opacity: 1, y: 0, rotation: 10, duration: 0.6, ease: "back.out(2)", transformOrigin: "0% 50%" }, 1.2);
  }

  function wrapOut() {
    const svg = $("#wrap");
    gsap.to("#heroBadge", { opacity: 0, duration: 0.2 });
    if (reduced()) { gsap.set(svg, { visibility: "hidden" }); return; }
    gsap.timeline({ onComplete: () => gsap.set(svg, { visibility: "hidden" }) })
      .to(["#tag", "#bow"], { scale: 0, opacity: 0, duration: 0.25, ease: "power2.in", transformOrigin: "50% 50%" }, 0)
      .to(["#ribV", "#ribH", "#foldShade"], { opacity: 0, duration: 0.2 }, 0.1)
      .to("#paperL", { xPercent: -100, duration: 0.45, ease: "power3.in" }, 0.15)
      .to("#paperR", { xPercent: 100, duration: 0.45, ease: "power3.in" }, 0.15)
      .set(["#tag", "#bow", "#ribV", "#ribH", "#foldShade"], { clearProps: "opacity,scale" });
  }

  /* ==========================================================================
     Gift switch
     ========================================================================== */
  function setGift(on, quiet) {
    if (S.gift === on) return;
    S.gift = on;
    const sw = $("#giftSwitch");
    sw.setAttribute("aria-checked", String(on));
    const panel = $("#giftPanel");
    if (on) {
      wrapIn();
      panel.hidden = false;
      if (!reduced()) {
        gsap.fromTo(panel, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.55, ease: "power3.out", clearProps: "height" });
        gsap.fromTo(".giftpanel .g", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, delay: 0.1, ease: "power3.out" });
        gsap.fromTo(".giftswitch__icon", { rotation: -15, scale: 0.8 }, { rotation: 0, scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.5)" });
      }
      if (!quiet) announce("Gift mode on. Choose wrapping and write a note.");
    } else {
      wrapOut();
      if (reduced()) panel.hidden = true;
      else gsap.to(panel, { height: 0, opacity: 0, duration: 0.35, ease: "power2.in", onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: "height,opacity" }); } });
      if (!quiet) announce("Gift mode off.");
    }
    if (!on) $("#giftSwitch").setAttribute("aria-checked", "false");
    updateSummary();
  }

  /* ---------------- builders ---------------- */
  function radiogroup(host, items, current, onPick, markup) {
    host.innerHTML = items.map((it) => markup(it)).join("");
    const btns = () => $$("[role=radio]", host);
    const sync = (id) => btns().forEach((b) => { const on = b.dataset.id === id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    sync(current);
    host.addEventListener("click", (e) => { const b = e.target.closest("[role=radio]"); if (b && !b.disabled) { sync(b.dataset.id); onPick(b.dataset.id, b); } });
    host.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const list = btns().filter((b) => !b.disabled);
      const i = list.indexOf(document.activeElement);
      const n = list[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length];
      n.focus();
      n.click();
    });
  }

  function buildGift() {
    radiogroup($("#wraps"), G().wraps, S.wrap, (id, b) => {
      S.wrap = id;
      paintWrap();
      if (!reduced()) {
        gsap.fromTo(["#paperL", "#paperR"], { opacity: 0.4 }, { opacity: 1, duration: 0.4 });
        gsap.fromTo("#bow", { scale: 0.85 }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)", transformOrigin: "50% 50%" });
        gsap.fromTo(b, { scale: 0.95 }, { scale: 1, duration: 0.3, ease: "back.out(3)" });
      }
      updateSummary();
    }, (w) => `<button class="wrapopt" type="button" role="radio" data-id="${w.id}"><span class="wrapopt__swatch" style="--paper:${w.paper};--ribbon:${w.ribbon}"></span><span><b>${esc(w.label)}</b><br><span>${w.price ? `+${fmt(w.price)}` : "Free"}</span></span></button>`);

    $("#occasions").innerHTML = G().occasions.map((o) => `<button type="button" aria-pressed="false" data-occ="${o.id}">${esc(o.label)}</button>`).join("");
    $("#occasions").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("#occasions button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      typeInto(G().occasions.find((o) => o.id === b.dataset.occ).prompt);
    });

    radiogroup($("#noteFonts"), G().noteFonts, S.font, (id) => { S.font = id; $("#card").classList.toggle("is-print", id === "print"); }, (f) => `<button type="button" role="radio" data-id="${f.id}" style="font-family:'${f.family}'">${esc(f.label)}</button>`);

    const msg = $("#noteMsg");
    msg.maxLength = G().noteMax;
    msg.addEventListener("input", () => { S.msg = msg.value; renderCard(); });
    $("#toName").addEventListener("input", (e) => { S.to = e.target.value.trim(); renderCard(); paintWrap(); });
    $("#fromName").addEventListener("input", (e) => { S.from = e.target.value.trim(); renderCard(); });

    const hide = $("#hidePrices");
    hide.checked = S.hide = G().hidePricesDefault;
    hide.addEventListener("change", () => { S.hide = hide.checked; updateSummary(); });

    // Delivery days: skip Sundays, earliest is 2 days out.
    const days = [];
    const start = new Date();
    for (let i = 2; i < G().scheduleDaysOut + 2; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push({ id: d.toISOString().slice(0, 10), d, off: d.getDay() === 0 });
    }
    S.day = days.find((x) => !x.off).id;
    radiogroup($("#days"), days, S.day, (id) => { S.day = id; updateSummary(); },
      (x) => `<button class="day" type="button" role="radio" data-id="${x.id}" ${x.off ? "disabled aria-label=\"No Sunday delivery\"" : ""}>${x.d.toLocaleDateString("en-GB", { weekday: "short" })}<b>${x.d.getDate()}</b>${x.d.toLocaleDateString("en-GB", { month: "short" })}</button>`);
    $("#schedule").addEventListener("change", (e) => {
      S.schedule = e.target.checked;
      const host = $("#days");
      host.hidden = !S.schedule;
      if (S.schedule && !reduced()) gsap.fromTo(".day", { y: 12, opacity: 0 }, { y: 0, opacity: (i, el) => (el.disabled ? 0.35 : 1), duration: 0.35, stagger: 0.025, ease: "power3.out" });
      updateSummary();
    });
    renderCard();
  }

  /* ---------------- note card ---------------- */
  let typing;
  function typeInto(text) {
    const msg = $("#noteMsg");
    typing?.kill();
    if (reduced() || !text) { msg.value = S.msg = text; renderCard(); return; }
    const o = { n: 0 };
    typing = gsap.to(o, { n: text.length, duration: Math.min(1.6, text.length * 0.03), ease: "none", onUpdate: () => { msg.value = S.msg = text.slice(0, Math.round(o.n)); renderCard(true); }, onComplete: () => renderCard() });
  }

  function renderCard(caret) {
    $("#cardTo").textContent = S.to ? `Dear ${S.to},` : "To someone lovely,";
    $("#cardMsg").innerHTML = `${esc(S.msg) || '<span style="opacity:.45">Your message appears here as you type</span>'}${caret ? '<span class="caret"></span>' : ""}`;
    $("#cardFrom").textContent = S.from ? `— ${S.from}` : "";
    $("#noteCount").textContent = `${S.msg.length}/${G().noteMax}`;
    updateSummary();
  }

  /* ---------------- summary + price ---------------- */
  function giftFee() { return S.gift ? wrap().price : 0; }
  function updateSummary() {
    const p = D.product;
    $("#pPrice").textContent = fmt(p.price + giftFee());
    $("#pGiftFee").textContent = S.gift ? (giftFee() ? `includes ${fmt(giftFee())} wrapping` : "gift wrap included free") : "";
    const sum = $("#summary");
    if (!S.gift) { sum.hidden = true; $("span", $("#atc")).textContent = "Add to cart"; return; }
    sum.hidden = false;
    const day = S.schedule ? new Date(S.day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Standard delivery (2 to 3 days)";
    sum.innerHTML = `<dl>
      <dt>Wrapping</dt><dd>${esc(wrap().label)}</dd>
      <dt>Note</dt><dd>${S.msg ? `“${esc(S.msg.slice(0, 48))}${S.msg.length > 48 ? "…" : ""}”` : "No note"}</dd>
      <dt>Prices</dt><dd>${S.hide ? "Hidden on the packing slip" : "Shown on the packing slip"}</dd>
      <dt>Arrives</dt><dd>${esc(day)}</dd></dl>`;
    $("span", $("#atc")).textContent = `Add gift to cart · ${fmt(p.price + giftFee())}`;
  }

  /* ---------------- add to cart (+ envelope seal) ---------------- */
  function addToCart() {
    const done = () => {
      S.cart += 1;
      $("#cartCount").textContent = S.cart;
      $("#cartBtn").setAttribute("aria-label", `Cart, ${S.cart} item${S.cart === 1 ? "" : "s"}`);
      $("span", $("#atc")).textContent = S.gift ? "Gift added ✓" : "Added ✓";
      announce(S.gift ? "Gift added to cart with your note." : "Added to cart.");
      setTimeout(updateSummary, 1600);
      if (!S.gift) setTimeout(() => ($("span", $("#atc")).textContent = "Add to cart"), 1600);
    };
    if (!S.gift || reduced()) { if (!reduced()) gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.12, yoyo: true, repeat: 1, duration: 0.15 }); return done(); }

    const seal = $("#seal");
    $("#sealCard").innerHTML = `${esc(S.to ? `Dear ${S.to},` : "")}<br>${esc(S.msg || "A little something for you.")}`;
    $("#sealCard").style.fontFamily = S.font === "print" ? "Fraunces, serif" : "Caveat, cursive";
    const b = $("#cartBtn").getBoundingClientRect();
    gsap.timeline({ onComplete: () => { gsap.set(seal, { visibility: "hidden", clearProps: "opacity" }); gsap.set(".seal__env", { clearProps: "all" }); done(); } })
      .set(seal, { visibility: "visible" })
      .to(seal, { opacity: 1, duration: 0.25 })
      .fromTo("#sealCard", { y: -120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.1)
      .fromTo("#sealFlap", { rotationX: 180 }, { rotationX: 0, duration: 0.5, ease: "power2.inOut" }, 0.65)
      .fromTo("#sealWax", { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" }, 1.1)
      .to(".seal__env", { x: () => b.left + b.width / 2 - innerWidth / 2, y: () => b.top + b.height / 2 - innerHeight / 2, scale: 0.08, rotation: 12, duration: 0.6, ease: "power3.in" }, 1.7)
      .to(seal, { opacity: 0, duration: 0.25 }, 2.05)
      .fromTo("#cartBtn", { scale: 1 }, { scale: 1.15, yoyo: true, repeat: 1, duration: 0.15 }, 2.2);
  }

  async function init() {
    D = await loadData();
    const p = D.product;
    $("#pTitle").textContent = p.title;
    $("#pSub").textContent = p.subtitle;
    $("#pDetails").textContent = p.details;
    renderMedia();
    buildGift();
    paintWrap();
    updateSummary();
    $("#giftSwitch").addEventListener("click", () => setGift(!S.gift));
    $("#atc").addEventListener("click", addToCart);
    if (!reduced()) {
      gsap.from(".hero", { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", clearProps: "transform,opacity" });
      gsap.from(".buy > *:not([hidden])", { y: 16, opacity: 0, duration: 0.6, stagger: 0.05, delay: 0.1, ease: "power3.out", clearProps: "transform,opacity" });
      // nudge the gift switch once so it gets noticed
      gsap.fromTo(".giftswitch__icon", { rotation: 0 }, { keyframes: { rotation: [-12, 10, -6, 0] }, duration: 0.7, delay: 1.4 });
    }
  }
  init().catch((e) => { console.error(e); document.body.insertAdjacentHTML("afterbegin", "<p>Data could not load. Run npx serve or node tools/sync-data.mjs.</p>"); });
})();
