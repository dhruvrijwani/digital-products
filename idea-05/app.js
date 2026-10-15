/* ==========================================================================
   Standard Issue · Fit Finder prototype
   Product + 40 mock reviews come from data/product.json (file:// uses the
   generated data/product.js mirror). The size recommendation is a simple,
   transparent heuristic for demo purposes: see recommend() below.
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(ScrollToPlugin);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => matchMedia("(max-width: 767px)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (x) => `${Math.round(x * 100)}%`;

  let D; // { brand, product, reviews }
  const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
  const state = { color: 0, size: null, rec: null, cart: 0, quiz: { height: 175, usual: null, pref: null }, step: 0 };

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.product;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const res = await fetch("data/product.json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      if (mirror()) return mirror();
      throw err;
    }
  }

  const announce = (msg) => {
    const l = $("#liveRegion");
    l.textContent = "";
    requestAnimationFrame(() => (l.textContent = msg));
  };

  /** Wrap the review's fit phrase in a highlight mark. */
  function markPhrase(text, phrase, sweep) {
    const i = text.toLowerCase().indexOf(phrase.toLowerCase());
    if (i < 0) return esc(text);
    return `${esc(text.slice(0, i))}<mark class="mark${sweep ? " is-sweep" : ""}">${esc(text.slice(i, i + phrase.length))}</mark>${esc(text.slice(i + phrase.length))}`;
  }

  /* ==========================================================================
     Fit maths (mock heuristic)
     ========================================================================== */
  function distribution(list) {
    const n = list.length || 1;
    const c = { small: 0, true: 0, large: 0 };
    list.forEach((r) => c[r.fit]++);
    return { n: list.length, small: c.small / n, true: c.true / n, large: c.large / n };
  }

  /** Reviews from people within ±5 cm, widening the window until there are at least 8. */
  function relevantReviews(height) {
    let range = 5;
    let list = [];
    while (range <= 20) {
      list = D.reviews.filter((r) => Math.abs(r.heightCm - height) <= range);
      if (list.length >= 8) break;
      range += 3;
    }
    return { list, range };
  }

  /**
   * Recommendation: start from the shopper's usual size, then
   *  - lean = share saying "runs small" minus share saying "runs large" (people your height)
   *  - preference nudges it: snug −0.45, regular 0, relaxed +0.45
   *  - score = lean × 1.4 + preference; ≥ 0.5 → one size up, ≤ −0.5 → one size down
   * Confidence grows with how one-sided the reviews are and how many matched.
   */
  function recommend({ height, usual, pref }) {
    const { list, range } = relevantReviews(height);
    const d = distribution(list);
    const lean = d.small - d.large;
    const prefShift = { snug: -0.45, regular: 0, relaxed: 0.45 }[pref];
    const score = lean * 1.4 + prefShift;
    const step = score >= 0.5 ? 1 : score <= -0.5 ? -1 : 0;
    let idx = clamp(SIZES.indexOf(usual) + step, 0, SIZES.length - 1);
    const sizeObj = D.product.sizes[idx];
    const dominant = Math.max(d.small, d.true, d.large);
    const confidence = Math.round(clamp(50 + dominant * 34 + Math.min(10, list.length / 2), 40, 96));
    const who = `reviewers between ${height - range} and ${height + range} cm`;
    let reason;
    if (step > 0 && pref === "relaxed" && lean < 0.36) reason = `You like a relaxed fit and ${pct(d.small)} of ${who} said it runs small, so go one size up from your usual ${usual}.`;
    else if (step > 0) reason = `${pct(d.small)} of ${who} said it runs small, so go one size up from your usual ${usual}.`;
    else if (step < 0 && pref === "snug") reason = `You like a snug fit and few ${who} found it small, so go one size down from ${usual}.`;
    else if (step < 0) reason = `${pct(d.large)} of ${who} said it runs large, so go one size down from your usual ${usual}.`;
    else if (lean > 0.2 && pref === "snug") reason = `It runs a little small, but you like a snug fit, so stay with your usual ${usual}.`;
    else reason = `Most ${who} found it true to size, so your usual ${usual} should fit.`;

    // Three reviews from the closest heights, preferring the majority opinion.
    const majority = ["small", "true", "large"].sort((a, b) => d[b] - d[a])[0];
    const matches = [...list]
      .sort((a, b) => (a.fit === majority ? 0 : 1) - (b.fit === majority ? 0 : 1) || Math.abs(a.heightCm - height) - Math.abs(b.heightCm - height))
      .slice(0, 3);

    return { size: SIZES[idx], usual, step, d, list, range, confidence, reason, matches, soldOut: !sizeObj.available };
  }

  /* ==========================================================================
     Product page
     ========================================================================== */
  function renderPDP() {
    const p = D.product;
    $("#crumbTitle").textContent = p.title;
    $("#productSub").textContent = p.subtitle;
    $("#productTitle").textContent = p.title;
    $("#productPrice").textContent = `${D.brand.currency}${p.price}`;
    $("#productRating").innerHTML = `<b>★ ${p.rating}</b> from ${D.reviews.length} reviews`;
    $("#productDesc").textContent = p.description;
    $("#productDetails").innerHTML = p.details.map((d) => `<li>${esc(d)}</li>`).join("");

    $("#gallery").innerHTML = p.images
      .map((im, i) => `<figure><img src="${im.src}" alt="${esc(im.alt)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`)
      .join("");

    $("#swatches").innerHTML = p.colors
      .map((c, i) => `<label class="swatch" title="${esc(c.name)}"><input type="radio" name="color" value="${i}" ${i === 0 ? "checked" : ""} aria-label="${esc(c.name)}"><span style="--c:${c.hex}"></span></label>`)
      .join("");
    $("#colorName").textContent = p.colors[0].name;
    $("#swatches").addEventListener("change", (e) => {
      state.color = +e.target.value;
      $("#colorName").textContent = p.colors[state.color].name;
    });

    $("#sizes").innerHTML = p.sizes
      .map(
        (s) => `
        <label class="size${s.available ? "" : " is-out"}" data-size="${s.label}">
          <input type="radio" name="size" value="${s.label}" ${s.available ? "" : "disabled"} aria-label="${s.label}${s.available ? "" : ", sold out"}">
          <span class="size__box" aria-hidden="true">${s.label}</span>
        </label>`
      )
      .join("");
    $("#sizes").addEventListener("change", (e) => setSize(e.target.value, false));

    $("#sizeChart").innerHTML =
      `<thead><tr><th>Size</th><th>Waist</th><th>Hip</th><th>Inseam</th></tr></thead><tbody>` +
      p.sizes.map((s) => `<tr><td>${s.label}</td><td>${s.waistCm}</td><td>${s.hipCm}</td><td>${s.inseamCm}</td></tr>`).join("") +
      `</tbody>`;

    $("#reviewsList").innerHTML = D.reviews
      .slice(0, 9)
      .map(
        (r) => `
        <li class="review">
          <div class="review__top"><span><b>${esc(r.author)}</b> · ${r.heightCm} cm · bought ${r.sizePurchased}</span><span class="review__stars" aria-label="${r.rating} out of 5">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div>
          <p class="review__text">${markPhrase(r.comment, r.fitPhrase, false)}</p>
        </li>`
      )
      .join("");
    renderFitbar($("#pdpFitbar"), distribution(D.reviews), false);
  }

  function setSize(label, fromQuiz) {
    state.size = label;
    const s = D.product.sizes.find((x) => x.label === label);
    $("#sizeHint").textContent = `Waist ${s.waistCm} cm · inseam ${s.inseamCm} cm`;
    $("#atcMsg").textContent = "";
    if (fromQuiz) {
      const input = $(`#sizes input[value="${label}"]`);
      input.checked = true;
    }
  }

  function renderRecTags() {
    $$("#sizes .size__tag, #sizes .size__ring").forEach((n) => n.remove());
    $("#sizes").classList.toggle("has-rec", !!state.rec);
    if (!state.rec) return;
    const holder = $(`#sizes .size[data-size="${state.rec.size}"]`);
    holder.insertAdjacentHTML("beforeend", `<span class="size__tag">Recommended</span><span class="size__ring" aria-hidden="true"></span>`);
    $("input", holder).setAttribute("aria-label", `${state.rec.size}, recommended for you`);
    if (!reduced()) gsap.fromTo($(".size__tag", holder), { y: 8, opacity: 0, scale: 0.6 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.6)", delay: 0.2 });
  }

  function clearRecTags() {
    const tag = $("#sizes .size__tag");
    $$("#sizes input").forEach((i) => i.setAttribute("aria-label", i.value + (i.disabled ? ", sold out" : "")));
    const done = () => {
      $$("#sizes .size__tag, #sizes .size__ring").forEach((n) => n.remove());
      $("#sizes").classList.remove("has-rec");
    };
    if (tag && !reduced()) gsap.to(tag, { y: 6, opacity: 0, scale: 0.7, duration: 0.25, onComplete: done });
    else done();
  }

  function wireATC() {
    $("#atcBtn").addEventListener("click", () => {
      if (!state.size) {
        $("#atcMsg").textContent = "Choose a size first, or use Find my size.";
        if (!reduced()) gsap.fromTo("#sizes", { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, 0] }, duration: 0.4 });
        return;
      }
      state.cart += 1;
      $("#cartCount").textContent = state.cart;
      $("#cartBtn").setAttribute("aria-label", `Cart, ${state.cart} item${state.cart === 1 ? "" : "s"}`);
      const msg = `Added ${D.product.title}, ${D.product.colors[state.color].name}, size ${state.size}.`;
      $("#atcMsg").textContent = msg;
      if (!reduced()) gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.12, yoyo: true, repeat: 1, duration: 0.15 });
    });
  }

  /* ---------------- fit distribution bar ---------------- */
  function renderFitbar(host, d, animate, delay = 0) {
    const segs = [
      { key: "small", label: "Runs small", v: d.small },
      { key: "true", label: "True to size", v: d.true },
      { key: "large", label: "Runs large", v: d.large },
    ];
    let left = 0;
    host.innerHTML = `
      <div class="fitbar__track" role="img" aria-label="${segs.map((s) => `${s.label} ${pct(s.v)}`).join(", ")}">
        ${segs.map((s) => { const html = `<span class="fitbar__seg fitbar__seg--${s.key}" style="left:${left * 100}%;width:${s.v * 100}%"></span>`; left += s.v; return html; }).join("")}
      </div>
      <ul class="fitbar__legend" aria-hidden="true">
        ${segs.map((s) => `<li><span class="fitbar__lab"><i class="fitbar__seg--${s.key}"></i>${s.label}</span><span class="fitbar__num"><b data-to="${Math.round(s.v * 100)}">${Math.round(s.v * 100)}</b>%</span></li>`).join("")}
      </ul>`;
    if (!animate || reduced()) return;
    gsap.fromTo($$(".fitbar__seg", host), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.out", stagger: 0.5 * 0.6, delay });
    $$(".fitbar__legend b", host).forEach((b, i) => {
      const o = { v: 0 };
      b.textContent = "0";
      gsap.to(o, { v: +b.dataset.to, duration: 0.9, ease: "power2.out", delay: delay + i * 0.3, onUpdate: () => (b.textContent = Math.round(o.v)) });
    });
  }

  /* ==========================================================================
     Fit finder drawer
     ========================================================================== */
  const STEPS = ["#step1", "#step2", "#stepAnalyse", "#stepResult"];
  const PX_PER_CM = 12;
  let rulerX;

  function buildRuler() {
    const track = $("#rulerTrack");
    let html = "";
    for (let cm = 140; cm <= 215; cm++) {
      const cls = cm % 10 === 0 ? "tick tick--10" : cm % 5 === 0 ? "tick tick--5" : "tick";
      html += `<span class="${cls}" style="left:${(cm - 140) * PX_PER_CM}px">${cm % 10 === 0 ? `<span>${cm}</span>` : ""}</span>`;
    }
    track.innerHTML = html;
    rulerX = gsap.quickTo(track, "x", { duration: reduced() ? 0 : 0.45, ease: "power3.out" });
    gsap.set(track, { x: -(state.quiz.height - 140) * PX_PER_CM });
  }

  function setHeight(h) {
    state.quiz.height = h;
    $("#heightCm").textContent = h;
    const inches = h / 2.54;
    let ft = Math.floor(inches / 12);
    let inch = Math.round(inches - ft * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    $("#heightFt").textContent = `${ft} ft ${inch} in`;
    rulerX(-(h - 140) * PX_PER_CM);
    $("#heightRange").setAttribute("aria-valuetext", `${h} centimetres, ${ft} feet ${inch} inches`);
  }

  const FIT_PREFS = [
    { key: "snug", name: "Snug", desc: "Close through the hip and thigh", legs: [20, 31, 41, 52], t: 0 },
    { key: "regular", name: "Regular", desc: "Straight, room to move", legs: [15, 31, 41, 57], t: 2 },
    { key: "relaxed", name: "Relaxed", desc: "Loose with a wider leg", legs: [8, 31, 41, 64], t: 5 },
  ];
  const jeans = ({ legs: [lo, li, ri, ro], t }) =>
    `<svg viewBox="0 0 72 110" aria-hidden="true"><path d="M14 4h44v8H14z" opacity=".55"/><path d="M14 13h44l${t} 28L${ro} 106h-14L37 48h-2L${li} 106H${lo}L${14 - t} 41z"/></svg>`;

  function buildQuiz() {
    $("#usualPills").innerHTML = SIZES.map(
      (s) => `<label class="size"><input type="radio" name="usual" value="${s}"><span class="size__box">${s}</span></label>`
    ).join("");
    $("#fitCards").innerHTML = FIT_PREFS.map(
      (f, i) => `<button class="fitcard" type="button" role="radio" aria-checked="false" tabindex="${i === 0 ? 0 : -1}" data-pref="${f.key}">
        ${jeans(f)}<span class="fitcard__name">${f.name}</span><span class="fitcard__desc">${f.desc}</span></button>`
    ).join("");
    buildRuler();
    setHeight(state.quiz.height);

    $("#heightRange").addEventListener("input", (e) => setHeight(+e.target.value));
    $("#usualPills").addEventListener("change", (e) => {
      state.quiz.usual = e.target.value;
      const next = $("#toStep2");
      if (next.getAttribute("aria-disabled") === "true") {
        next.setAttribute("aria-disabled", "false");
        if (!reduced()) gsap.fromTo(next, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
      }
    });
    $("#toStep2").addEventListener("click", () => {
      if (!state.quiz.usual) {
        if (!reduced()) gsap.fromTo("#usualPills", { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, 0] }, duration: 0.4 });
        announce("Choose your usual size first.");
        return;
      }
      goStep(1, 1);
    });
    $("#backTo1").addEventListener("click", () => goStep(0, -1));

    const cards = $("#fitCards");
    cards.addEventListener("click", (e) => {
      const card = e.target.closest(".fitcard");
      if (card) choosePref(card);
    });
    cards.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
      e.preventDefault();
      const list = $$(".fitcard", cards);
      const i = list.indexOf(document.activeElement);
      const n = (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list.forEach((c, k) => (c.tabIndex = k === n ? 0 : -1));
      list[n].focus();
    });
    $$(".fitcard", cards).forEach((card) => {
      card.addEventListener("pointerenter", () => !reduced() && gsap.to($("svg", card), { y: -4, rotation: card.dataset.pref === "relaxed" ? 3 : -3, duration: 0.3, ease: "back.out(2)" }));
      card.addEventListener("pointerleave", () => gsap.to($("svg", card), { y: 0, rotation: 0, duration: 0.3 }));
    });

    $("#selectSize").addEventListener("click", applyRecommendation);
    $("#retake").addEventListener("click", retake);
  }

  function choosePref(card) {
    state.quiz.pref = card.dataset.pref;
    $$(".fitcard").forEach((c) => {
      c.setAttribute("aria-checked", String(c === card));
      c.tabIndex = c === card ? 0 : -1;
    });
    if (!reduced()) gsap.fromTo(card, { scale: 0.95 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
    gsap.delayedCall(reduced() ? 0.05 : 0.35, () => goStep(2, 1));
  }

  function setDots(i) {
    $$(".dot").forEach((d, k) => {
      d.classList.toggle("is-on", k === i);
      d.classList.toggle("is-done", k < i);
      if (k === i) d.setAttribute("aria-current", "step");
      else d.removeAttribute("aria-current");
    });
    const fill = $(".dots__fill");
    if (reduced()) gsap.set(fill, { scaleX: i / 2 });
    else gsap.to(fill, { scaleX: i / 2, duration: 0.5, ease: "power3.inOut" });
    const dot = $$(".dot")[i];
    if (dot && !reduced()) gsap.fromTo(dot, { scale: 1.6 }, { scale: 1, duration: 0.45, ease: "back.out(3)" });
  }

  /** Swap steps: outgoing content slides out, incoming staggers in from the other side. */
  function goStep(to, dir, { instant = false } = {}) {
    const from = state.step;
    state.step = to;
    const out = $(STEPS[from]);
    const inn = $(STEPS[to]);
    setDots(Math.min(to, 2));
    const enter = () => {
      STEPS.forEach((s) => ($(s).hidden = s !== STEPS[to]));
      $("#drawerBody").scrollTop = 0;
      const kids = Array.from(inn.children);
      if (!instant && !reduced()) gsap.fromTo(kids, { x: 36 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.05, clearProps: "transform,opacity" });
      if (to === 0) $("#heightRange").focus();
      if (to === 1) ($(".fitcard[aria-checked='true']") || $(".fitcard")).focus();
      if (to === 2) runAnalysis();
    };
    if (from === to || instant || reduced() || out.hidden) return enter();
    gsap.to(Array.from(out.children), { x: -30 * dir, opacity: 0, duration: 0.22, ease: "power2.in", stagger: 0.02, onComplete: () => { gsap.set(Array.from(out.children), { clearProps: "transform,opacity" }); enter(); } });
  }

  function runAnalysis() {
    const rec = recommend(state.quiz);
    state.rec = rec;
    const count = $("#analyseCount");
    const bars = $$(".scan span");
    const o = { v: 0 };
    count.textContent = "0";
    if (reduced()) {
      count.textContent = rec.list.length;
      gsap.delayedCall(0.4, () => showResult(rec));
      return;
    }
    gsap.fromTo(bars, { scaleX: 0.05, opacity: 0.4 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: "power2.inOut", stagger: { each: 0.12, repeat: 2, yoyo: true } });
    gsap.to(o, { v: rec.list.length, duration: 1.4, ease: "power1.inOut", onUpdate: () => (count.textContent = Math.round(o.v)) });
    gsap.delayedCall(1.75, () => showResult(rec));
  }

  function showResult(rec) {
    $("#resultOld").textContent = rec.usual;
    $("#resultNew").textContent = rec.size;
    $("#resultReason").textContent = rec.soldOut ? `${rec.reason} Size ${rec.size} is sold out right now.` : rec.reason;
    $("#signalTitle").textContent = `What ${rec.list.length} reviewers between ${state.quiz.height - rec.range} and ${state.quiz.height + rec.range} cm said`;
    $("#matches").innerHTML = rec.matches
      .map(
        (r) => `<li class="match"><div class="match__top"><span><b>${esc(r.author)}</b> · ${r.heightCm} cm</span><span>Bought ${r.sizePurchased}</span></div><p>${markPhrase(r.comment, r.fitPhrase, true)}</p></li>`
      )
      .join("");
    const btn = $("#selectSize");
    btn.textContent = rec.soldOut ? `Size ${rec.size} is sold out` : `Select size ${rec.size}`;
    btn.setAttribute("aria-disabled", String(rec.soldOut));
    renderFitbar($("#drawerFitbar"), rec.d, true, 0.9);
    renderRecTags();
    announce(`We recommend size ${rec.size}, ${rec.confidence}% confidence. ${rec.reason}`);

    goStep(3, 1);
    const R = reduced();
    const oldL = $("#resultOld");
    const newL = $("#resultNew");
    const fill = $("#meterFill");
    const conf = $("#confidence");
    if (R) {
      gsap.set(oldL, { opacity: 0 });
      gsap.set(newL, { opacity: 1 });
      gsap.set(fill, { scaleX: rec.confidence / 100 });
      conf.textContent = rec.confidence;
      gsap.set(".match .mark", { backgroundSize: "100% 100%" });
      return;
    }
    // The usual size flips away and the recommendation flips in.
    const same = rec.usual === rec.size;
    const tl = gsap.timeline({ delay: 0.25 });
    tl.set(newL, { opacity: 0 })
      .fromTo(oldL, { opacity: 1, yPercent: 0, rotationX: 0 }, { opacity: same ? 1 : 0, yPercent: same ? 0 : -70, rotationX: same ? 0 : 70, duration: same ? 0.01 : 0.4, ease: "power2.in" }, 0.35)
      .fromTo(newL, { opacity: 0, yPercent: same ? 0 : 80, rotationX: same ? 0 : -80, scale: same ? 1.3 : 1 }, { opacity: 1, yPercent: 0, rotationX: 0, scale: 1, duration: 0.6, ease: "back.out(2)" }, same ? 0.35 : 0.7)
      .set(oldL, { opacity: 0 })
      .fromTo(fill, { scaleX: 0 }, { scaleX: rec.confidence / 100, duration: 1, ease: "power3.out" }, 0.8)
      .fromTo(".result__reason", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, 1.0)
      .fromTo(".match", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, 1.7)
      .to(".match .mark", { backgroundSize: "100% 100%", duration: 0.6, ease: "power2.inOut", stagger: 0.12 }, 2.0);
    const o = { v: 0 };
    tl.to(o, { v: rec.confidence, duration: 1, ease: "power3.out", onUpdate: () => (conf.textContent = Math.round(o.v)) }, 0.8);
  }

  function applyRecommendation() {
    const rec = state.rec;
    if (!rec || rec.soldOut) return;
    closeDrawer(() => {
      const field = $("#sizeField");
      const select = () => {
        setSize(rec.size, true);
        const holder = $(`#sizes .size[data-size="${rec.size}"]`);
        $("input", holder).focus({ preventScroll: true });
        announce(`Size ${rec.size} selected.`);
        if (reduced()) return;
        gsap.fromTo($(".size__ring", holder), { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" });
        gsap.to($(".size__ring", holder), { opacity: 0, duration: 0.6, delay: 1.4 });
        gsap.fromTo($(".size__box", holder), { scale: 0.9 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
        pulseATC();
      };
      if (reduced()) {
        field.scrollIntoView({ block: "center" });
        select();
      } else {
        gsap.to(window, { scrollTo: { y: field, offsetY: window.innerHeight * 0.3 }, duration: 0.8, ease: "power3.inOut", onComplete: select });
      }
    });
  }

  function pulseATC() {
    const btn = $("#atcBtn");
    let p = $(".atc__pulse", btn);
    if (!p) {
      p = document.createElement("span");
      p.className = "atc__pulse";
      p.setAttribute("aria-hidden", "true");
      btn.appendChild(p);
    }
    gsap.fromTo(p, { opacity: 1, scale: 1 }, { opacity: 0, scaleX: 1.06, scaleY: 1.5, duration: 0.8, ease: "power2.out", repeat: 2, repeatDelay: 0.1, delay: 0.3 });
    gsap.fromTo(btn, { scale: 1 }, { scale: 1.025, duration: 0.18, yoyo: true, repeat: 3, ease: "power2.out", delay: 0.3 });
  }

  /** Retake: result content leaves in reverse order, then the quiz restarts at question 1. */
  function retake() {
    const restart = () => {
      state.rec = null;
      state.quiz.pref = null;
      clearRecTags();
      $$(".fitcard").forEach((c, k) => {
        c.setAttribute("aria-checked", "false");
        c.tabIndex = k === 0 ? 0 : -1;
      });
      gsap.set("#meterFill", { scaleX: 0 });
      goStep(0, -1, { instant: false });
    };
    if (reduced()) return restart();
    const parts = Array.from($("#stepResult").children).reverse();
    gsap.to(parts, {
      x: 40, opacity: 0, duration: 0.25, ease: "power2.in", stagger: 0.05,
      onComplete: () => {
        gsap.set(parts, { clearProps: "transform,opacity" });
        $("#stepResult").hidden = true;
        state.step = 0;
        restart();
      },
    });
  }

  /* ---------------- open / close ---------------- */
  let trigger;
  function openDrawer() {
    trigger = document.activeElement;
    const dr = $("#drawer");
    dr.hidden = false;
    document.documentElement.classList.add("is-locked");
    $("#main").inert = true;
    $(".topbar").inert = true;
    STEPS.forEach((s, i) => ($(s).hidden = i !== state.step));
    setDots(Math.min(state.step, 2));
    const panel = $("#drawerPanel");
    if (reduced()) {
      gsap.set(".drawer__backdrop", { opacity: 1 });
      gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    } else {
      gsap.to(".drawer__backdrop", { opacity: 1, duration: 0.35 });
      gsap.fromTo(panel, isMobile() ? { yPercent: 100, xPercent: 0 } : { xPercent: 100, yPercent: 0 }, { xPercent: 0, yPercent: 0, duration: 0.55, ease: "power4.out" });
      const kids = [...$$(".drawer__head > *"), ...Array.from($(STEPS[state.step]).children)];
      gsap.fromTo(kids, { opacity: 0, x: isMobile() ? 0 : 40, y: isMobile() ? 24 : 0 }, { opacity: 1, x: 0, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.04, delay: 0.12, clearProps: "transform,opacity" });
    }
    setTimeout(() => (state.step === 0 ? $("#heightRange") : $(".drawer__close")).focus(), reduced() ? 0 : 200);
  }

  function closeDrawer(after) {
    const dr = $("#drawer");
    if (dr.hidden) return;
    const panel = $("#drawerPanel");
    const done = () => {
      dr.hidden = true;
      gsap.set(panel, { clearProps: "transform,opacity" });
      document.documentElement.classList.remove("is-locked");
      $("#main").inert = false;
      $(".topbar").inert = false;
      if (typeof after === "function") after();
      else (trigger || $("#finderBtn")).focus();
    };
    if (reduced()) {
      gsap.to([panel, ".drawer__backdrop"], { opacity: 0, duration: 0.2, onComplete: done });
      return;
    }
    gsap.to(".drawer__backdrop", { opacity: 0, duration: 0.3 });
    gsap.to(panel, { ...(isMobile() ? { yPercent: 100 } : { xPercent: 100 }), duration: 0.4, ease: "power3.in", onComplete: done });
  }

  function wireDrawer() {
    $("#finderBtn").addEventListener("click", openDrawer);
    $("#drawer").addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeDrawer();
    });
    document.addEventListener("keydown", (e) => {
      if ($("#drawer").hidden) return;
      if (e.key === "Escape") closeDrawer();
      if (e.key === "Tab") {
        const list = $$("button, input, [href], [tabindex]:not([tabindex='-1'])", $("#drawerPanel")).filter((n) => n.getClientRects().length && !n.closest("[hidden]") && !(n.type === "radio" && !n.checked && $(`input[name="${n.name}"]:checked`)));
        const first = list[0];
        const last = list[list.length - 1];
        if (!$("#drawerPanel").contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Mobile: drag the sheet header down to dismiss.
    const head = $(".drawer__head");
    const panel = $("#drawerPanel");
    let y0 = 0;
    let dy = 0;
    let t0 = 0;
    let dragging = false;
    head.addEventListener("pointerdown", (e) => {
      if (!isMobile() || e.target.closest("button")) return;
      dragging = true;
      y0 = e.clientY;
      dy = 0;
      t0 = performance.now();
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - y0);
      gsap.set(panel, { y: dy });
    });
    const up = () => {
      if (!dragging) return;
      dragging = false;
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 120 || v > 0.6) {
        gsap.set(panel, { clearProps: "y" });
        gsap.set(panel, { yPercent: (dy / panel.offsetHeight) * 100 });
        closeDrawer();
      } else gsap.to(panel, { y: 0, duration: 0.4, ease: "back.out(1.6)" });
    };
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", up);
  }

  /* ---------------- boot ---------------- */
  async function init() {
    D = await loadData();
    renderPDP();
    buildQuiz();
    wireATC();
    wireDrawer();
    if (!reduced()) {
      gsap.from(".gallery figure", { opacity: 0, y: 20, duration: 0.7, stagger: 0.08, ease: "power3.out", clearProps: "transform,opacity" });
      gsap.from(".buy__inner > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.05, delay: 0.1, ease: "power3.out", clearProps: "transform,opacity" });
    }
  }
  init().catch((err) => {
    console.error(err);
    $("#main").insertAdjacentHTML("afterbegin", `<p>Product data could not load. Run <code>npx serve</code>, or regenerate data/product.js with <code>node tools/sync-data.mjs</code>.</p>`);
  });
})();
