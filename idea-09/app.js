/* ==========================================================================
   Northline · Smart Buy Bar prototype
   When the buy box scrolls out of view, its Add to cart button morphs into a
   floating bar with the product, a section scroll-spy, colour picker, a live
   "order within … get it by …" countdown and a reading-progress line.
   Data: data/product.json.
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let D;
  const S = { color: 0, qty: 1, cart: 0, barOn: false, pos: "bottom", section: null };
  const fmt = (n) => `${D.shop.currency}${n}`;
  const announce = (m) => { const l = $("#liveRegion"); l.textContent = ""; requestAnimationFrame(() => (l.textContent = m)); };

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.product;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const r = await fetch("data/product.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (mirror()) return mirror();
      throw e;
    }
  }

  /* ==========================================================================
     Delivery estimate: next cutoff + business-day transit
     ========================================================================== */
  function addBusinessDays(date, n, weekends) {
    const d = new Date(date);
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (weekends || (day !== 0 && day !== 6)) n--;
    }
    return d;
  }
  function nextCutoff(now, cfg) {
    const c = new Date(now);
    c.setHours(cfg.cutoffHour, cfg.cutoffMinute, 0, 0);
    const shipDay = (d) => cfg.shipsWeekends || (d.getDay() !== 0 && d.getDay() !== 6);
    if (now >= c || !shipDay(c)) {
      do { c.setDate(c.getDate() + 1); } while (!shipDay(c));
    }
    return c;
  }
  function eta(now = new Date()) {
    const cfg = D.delivery;
    const cutoff = nextCutoff(now, cfg);
    const arrive = addBusinessDays(cutoff, cfg.transitDays, cfg.shipsWeekends);
    const ms = cutoff - now;
    const h = Math.floor(ms / 3.6e6);
    const m = Math.floor((ms % 3.6e6) / 6e4);
    const s = Math.floor((ms % 6e4) / 1e3);
    const day = arrive.toLocaleDateString("en-GB", { weekday: "long" });
    const date = arrive.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const left = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    return { left, day, date, short: h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, "0")}m` };
  }
  function tickEta() {
    const e = eta();
    $("#etaText").innerHTML = `Order within <span class="mono">${e.left}</span> to get it <b>${e.day}, ${e.date}</b> with ${esc(D.delivery.carrier.toLowerCase())} delivery.`;
    $("#barEta").innerHTML = `Get it <b>${e.day}</b> · order in <span class="mono">${e.short}</span>`;
  }

  /* ==========================================================================
     Page rendering
     ========================================================================== */
  function render() {
    const p = D.product;
    const c = p.colors[S.color];
    $("#gallery").innerHTML = [c.image, ...p.gallery].map((src, i) => `<figure><img ${i ? 'loading="lazy"' : ""} src="${src}" alt="${esc(p.title)}${i ? " detail" : `, ${esc(c.name)}`}"></figure>`).join("");
    $("#pRating").innerHTML = `<b>★ ${p.rating}</b> · ${p.ratingCount} reviews`;
    $("#pTitle").textContent = p.title;
    $("#pTag").textContent = p.tagline;
    $("#pPrice").textContent = fmt(p.price);
    $("#pCompare").textContent = fmt(p.compareAt);
    $("#pSave").textContent = `Save ${fmt(p.compareAt - p.price)}`;
    $("#pHighlights").innerHTML = p.highlights.map((h) => `<li>${esc(h)}</li>`).join("");
    $("#pColors").innerHTML = p.colors.map((col, i) => `<label class="cdot" title="${esc(col.name)}"><input type="radio" name="color" value="${i}" ${i === S.color ? "checked" : ""} aria-label="${esc(col.name)}"><span style="--c:${col.hex}"></span></label>`).join("");
    $("#pColorName").textContent = c.name;
    $("#stock").textContent = `Only ${p.stock} left in ${c.name}`;

    $("#barTitle").textContent = p.title;
    $("#barImg").src = c.image;
    $("#barColors").innerHTML = p.colors.map((col, i) => `<button type="button" role="radio" aria-checked="${i === S.color}" aria-label="${esc(col.name)}" data-c="${i}" style="--c:${col.hex}"></button>`).join("");
    updateBarPrice();

    $("#content").innerHTML = D.sections
      .map((s, i) => {
        let body = s.body ? `<p>${esc(s.body)}</p>` : "";
        if (s.specs) body = `<dl class="spec">${s.specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
        if (s.reviews) body = `<ul class="revs">${s.reviews.map(([a, t]) => `<li><b>★★★★★ ${esc(a)}</b>${esc(t)}</li>`).join("")}</ul>`;
        if (s.faq) body = `<div class="faq">${s.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
        const vis = i < 2 ? `<div class="sec__visual"><img loading="lazy" src="${p.gallery[i] || c.image}" alt=""></div>` : "";
        return `<section class="sec" id="${s.id}" aria-labelledby="h-${s.id}"><h2 id="h-${s.id}">${esc(s.heading)}</h2>${body}${vis}</section>`;
      })
      .join("");
    $("#barNav").insertAdjacentHTML("beforeend", D.sections.map((s) => `<a href="#${s.id}" data-sec="${s.id}">${esc(s.label)}</a>`).join(""));
  }

  function updateBarPrice() {
    const p = D.product;
    $("#barPrice").innerHTML = `${fmt(p.price * S.qty)}${S.qty > 1 ? ` · ${S.qty} × ${fmt(p.price)}` : ` <s>${fmt(p.compareAt)}</s>`} · ${esc(p.colors[S.color].name)}`;
  }

  function setColor(i, from) {
    if (i === S.color) return;
    S.color = i;
    const p = D.product;
    const c = p.colors[i];
    $("#pColorName").textContent = c.name;
    $(`#pColors input[value="${i}"]`).checked = true;
    $$("#barColors button").forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.c === i)));
    $("#stock").textContent = `Only ${p.stock} left in ${c.name}`;
    const main = $("#gallery figure img");
    const swap = (img) => {
      if (reduced()) { img.src = c.image; return; }
      gsap.to(img, { opacity: 0, duration: 0.15, onComplete: () => { img.src = c.image; gsap.to(img, { opacity: 1, duration: 0.3 }); } });
    };
    swap(main);
    swap($("#barImg"));
    updateBarPrice();
    if (from === "bar" && !reduced()) gsap.fromTo("#barImg", { scale: 0.8, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2.4)" });
    announce(`Colour: ${c.name}`);
  }

  /* ==========================================================================
     The bar: show/hide with a morph from the buy-box button
     ========================================================================== */
  function showBar() {
    if (S.barOn) return;
    S.barOn = true;
    const bar = $("#bar");
    bar.removeAttribute("aria-hidden");
    $("#atcBar").tabIndex = 0;
    gsap.killTweensOf(bar);
    gsap.set(bar, { visibility: "visible" });
    if (reduced()) { gsap.set(bar, { y: 0, opacity: 1 }); return; }
    const top = S.pos === "top";
    const from = $("#atcMain").getBoundingClientRect();
    gsap.set(bar, { y: 0, opacity: 1 });
    const to = $("#atcBar").getBoundingClientRect(); // final resting rect
    gsap.fromTo(bar, { y: top ? -40 : 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power4.out" });
    // Morph: a ghost of the main button travels into the bar's button.
    const ghost = document.createElement("div");
    ghost.className = "atc";
    ghost.innerHTML = "<span>Add to cart</span>";
    Object.assign(ghost.style, { position: "absolute", left: "0", top: "0", width: `${from.width}px`, height: `${from.height}px`, display: "grid", placeItems: "center" });
    $(".flyer-layer").appendChild(ghost);
    // The buy box has just scrolled off the top, so start the ghost at the viewport edge.
    gsap.set(ghost, { x: from.left, y: Math.max(8, from.top), opacity: 0.95 });
    gsap.set("#atcBar", { opacity: 0 });
    gsap.to(ghost, {
      x: to.left, y: to.top, width: to.width, height: to.height, borderRadius: 13, duration: 0.6, ease: "power3.inOut",
      onComplete: () => { ghost.remove(); gsap.set("#atcBar", { opacity: 1 }); },
    });
    gsap.fromTo(".bar__inner > *:not(.atc)", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, delay: 0.15, ease: "power3.out" });
    if (S.section) { const sec = S.section; S.section = null; requestAnimationFrame(() => setSection(sec)); }
  }

  function hideBar() {
    if (!S.barOn) return;
    S.barOn = false;
    const bar = $("#bar");
    bar.setAttribute("aria-hidden", "true");
    $("#atcBar").tabIndex = -1;
    if (document.activeElement && bar.contains(document.activeElement)) $("#atcMain").focus({ preventScroll: true });
    gsap.killTweensOf(bar);
    $$(".flyer-layer .atc").forEach((g) => g.remove());
    gsap.set("#atcBar", { opacity: 1 });
    if (reduced()) { gsap.set(bar, { opacity: 0, visibility: "hidden" }); return; }
    gsap.to(bar, { y: S.pos === "top" ? -40 : 40, opacity: 0, duration: 0.3, ease: "power2.in", onComplete: () => gsap.set(bar, { visibility: "hidden" }) });
  }

  function wireScroll() {
    ScrollTrigger.create({
      trigger: "#atcMain",
      start: "bottom top+=10",
      end: () => `+=${document.documentElement.scrollHeight}`,
      onToggle: (self) => (self.isActive ? showBar() : hideBar()),
    });
    // reading progress
    gsap.to("#barProgress", { scaleX: 1, ease: "none", scrollTrigger: { trigger: "#content", start: "top bottom", end: "bottom bottom", scrub: true } });
    // scroll-spy
    D.sections.forEach((s) =>
      ScrollTrigger.create({ trigger: `#${s.id}`, start: "top 45%", end: "bottom 45%", onToggle: (self) => self.isActive && setSection(s.id) })
    );
  }

  function setSection(id, force) {
    if (S.navLock && !force) return;
    if (S.section === id) return;
    S.section = id;
    const link = $(`#barNav a[data-sec="${id}"]`);
    $$("#barNav a").forEach((a) => a.setAttribute("aria-current", String(a === link)));
    const pill = $(".bar__navpill");
    if (!link.offsetWidth) return;
    const vars = { x: link.offsetLeft, width: link.offsetWidth, opacity: 1 };
    if (reduced() || +gsap.getProperty(pill, "opacity") === 0) gsap.set(pill, vars);
    else gsap.to(pill, { ...vars, duration: 0.4, ease: "power3.inOut" });
  }

  /* ---------------- add to cart (both buttons) ---------------- */
  function addToCart(btn) {
    if (btn.classList.contains("is-done")) return;
    const p = D.product;
    const label = $("span", btn);
    S.cart += S.qty;
    $("#cartCount").textContent = S.cart;
    $("#cartBtn").setAttribute("aria-label", `Cart, ${S.cart} item${S.cart === 1 ? "" : "s"}`);
    announce(`Added ${S.qty} × ${p.title}, ${p.colors[S.color].name}, to cart`);
    const src = btn.id === "atcBar" ? $("#barImg") : $("#gallery figure img");
    if (!reduced()) {
      const a = src.getBoundingClientRect();
      const b = $("#cartBtn").getBoundingClientRect();
      const c = document.createElement("img");
      c.src = src.currentSrc || src.src;
      c.className = "flyer";
      Object.assign(c.style, { width: `${a.width}px`, height: `${a.height}px` });
      $(".flyer-layer").appendChild(c);
      gsap.set(c, { x: a.left, y: a.top });
      gsap.to(c, { x: b.left, duration: 0.7, ease: "power1.inOut" });
      gsap.to(c, { y: b.top, duration: 0.7, ease: "back.in(1.4)" });
      gsap.to(c, { width: 24, height: 24, borderRadius: 12, opacity: 0.5, duration: 0.7, ease: "power2.in", onComplete: () => { c.remove(); gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.15, yoyo: true, repeat: 1, duration: 0.15 }); } });
    }
    [$("#atcMain"), $("#atcBar")].forEach((b) => { b.classList.add("is-done"); $("span", b).textContent = "Added ✓"; });
    setTimeout(() => [$("#atcMain"), $("#atcBar")].forEach((b) => { b.classList.remove("is-done"); $("span", b).textContent = "Add to cart"; }), 1800);
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    $("#pColors").addEventListener("change", (e) => setColor(+e.target.value, "main"));
    $("#barColors").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setColor(+b.dataset.c, "bar"); });
    $(".qty").addEventListener("click", (e) => {
      const b = e.target.closest("[data-q]");
      if (!b) return;
      S.qty = Math.max(1, Math.min(D.product.stock, S.qty + +b.dataset.q));
      $("#qty").textContent = S.qty;
      updateBarPrice();
    });
    $("#atcMain").addEventListener("click", (e) => addToCart(e.currentTarget));
    $("#atcBar").addEventListener("click", (e) => addToCart(e.currentTarget));
    $("#barNav").addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      const t = $(a.getAttribute("href"));
      // Lock the spy on the clicked section while the scroll runs through the others.
      S.navLock = a.dataset.sec;
      setSection(a.dataset.sec, true);
      const release = () => { S.navLock = null; };
      if (reduced()) { t.scrollIntoView(); release(); }
      else gsap.to(window, { scrollTo: { y: t, offsetY: S.pos === "top" ? 90 : 20 }, duration: 0.9, ease: "power3.inOut", onComplete: release });
      t.querySelector("h2").setAttribute("tabindex", "-1");
      setTimeout(() => t.querySelector("h2").focus({ preventScroll: true }), reduced() ? 0 : 950);
    });

    const bar = $("#bar");
    const map = { optNav: "is-off-nav", optEta: "is-off-eta", optColors: "is-off-colors", optProgress: "is-off-progress" };
    Object.entries(map).forEach(([id, cls]) => $(`#${id}`).addEventListener("change", (e) => {
      bar.classList.toggle(cls, !e.target.checked);
      if (!reduced() && S.barOn) gsap.fromTo(".bar__inner", { scale: 0.98 }, { scale: 1, duration: 0.4, ease: "back.out(2)" });
      if (S.section) { const s = S.section; S.section = null; setSection(s); }
    }));
    $("#optPos").addEventListener("change", (e) => {
      S.pos = e.target.value;
      const was = S.barOn;
      if (was) { S.barOn = false; gsap.killTweensOf(bar); gsap.set(bar, { visibility: "hidden", opacity: 0 }); }
      bar.classList.toggle("is-top", S.pos === "top");
      if (was) showBar();
    });
    const mb = $("#merchantBtn");
    mb.addEventListener("click", () => {
      const open = mb.getAttribute("aria-expanded") !== "true";
      mb.setAttribute("aria-expanded", String(open));
      $("#merchantPanel").hidden = !open;
    });
  }

  async function init() {
    D = await loadData();
    render();
    tickEta();
    setInterval(tickEta, 1000);
    wire();
    wireScroll();
    if (!reduced()) {
      gsap.from(".gallery figure", { y: 24, opacity: 0, duration: 0.7, stagger: 0.07, ease: "power3.out", clearProps: "transform,opacity" });
      gsap.from(".buybox", { x: 24, opacity: 0, duration: 0.8, ease: "power3.out", clearProps: "transform,opacity" });
    }
    window.addEventListener("load", () => ScrollTrigger.refresh());
  }
  init().catch((e) => { console.error(e); document.body.insertAdjacentHTML("afterbegin", "<p>Data could not load. Run npx serve or node tools/sync-data.mjs.</p>"); });
})();
