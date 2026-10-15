/* ==========================================================================
   Atelier Folio · Personalisation Studio prototype
   Live foil / deboss preview on an SVG journal, priced add-on, and a PNG
   proof the merchant can attach to the order. Data: data/studio.json.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

  let D;
  const S = { leather: "cognac", on: true, mode: "initials", text: { initials: "DRK", name: "Dhruv" }, font: "roman", foil: "gold", place: "br", cart: 0 };

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.studio;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const r = await fetch("data/studio.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (mirror()) return mirror();
      throw e;
    }
  }

  const P = () => D.personalisation;
  const mode = () => P().modes.find((m) => m.id === S.mode);
  const font = () => P().fonts.find((f) => f.id === S.font);
  const foil = () => P().foils.find((f) => f.id === S.foil);
  const place = () => P().placements.find((p) => p.id === S.place);
  const leather = () => D.product.leathers.find((l) => l.id === S.leather);
  const text = () => (S.on ? S.text[S.mode].trim() : "");
  const fee = () => (text() ? mode().fee : 0);
  const fmt = (n) => `${D.shop.currency}${n}`;

  /* ==========================================================================
     Cover rendering
     ========================================================================== */
  // Layout of the stamp on the 400×540 cover (usable leather is x 20–316).
  const LAYOUT = {
    br: { x: 300, y: 492, anchor: "end", size: { initials: 40, name: 27 }, maxW: 190 },
    center: { x: 168, y: 292, anchor: "middle", size: { initials: 74, name: 46 }, maxW: 250 },
    tl: { x: 52, y: 82, anchor: "start", size: { initials: 40, name: 27 }, maxW: 190 },
  };

  function stampSpec() {
    const f = font();
    const L = LAYOUT[S.place];
    let t = text();
    if (S.mode === "initials" && f.id !== "script") t = t.toUpperCase();
    return { t, f, L, size: L.size[S.mode] * f.scale };
  }

  function setLeather(animate) {
    const l = leather();
    const stops = [["#lA", l.light], ["#lB", l.base], ["#lC", l.dark]];
    stops.forEach(([sel, c]) => {
      if (animate && !reduced()) gsap.to(sel, { attr: { "stop-color": c }, duration: 0.6, ease: "power2.inOut" });
      else $(sel).setAttribute("stop-color", c);
    });
    $("#leatherName").textContent = l.name;
  }

  function setFoilGradient() {
    const g = $("#foil");
    const stops = foil().stops;
    g.innerHTML = stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join("");
  }

  function renderStamp({ stamp = false } = {}) {
    const main = $("#monoMain");
    const shadow = $("#monoShadow");
    const { t, f, L, size } = stampSpec();
    [main, shadow].forEach((el) => {
      el.textContent = t;
      el.setAttribute("x", L.x);
      el.setAttribute("text-anchor", L.anchor);
      el.setAttribute("font-family", `"${f.family}", serif`);
      el.setAttribute("font-weight", f.weight);
      el.setAttribute("font-size", size);
      el.setAttribute("letter-spacing", f.track);
      el.removeAttribute("textLength");
      el.removeAttribute("lengthAdjust");
    });
    // Long names shrink to fit their zone.
    let s = size;
    if (t) {
      const w = main.getComputedTextLength();
      if (w > L.maxW) {
        s = size * (L.maxW / w);
        [main, shadow].forEach((el) => el.setAttribute("font-size", s));
      }
    }
    const blind = S.foil === "blind";
    main.setAttribute("y", L.y);
    shadow.setAttribute("y", L.y + (blind ? 1.3 : 1.5));
    main.setAttribute("fill", blind ? "rgba(0,0,0,0.42)" : "url(#foil)");
    shadow.setAttribute("fill", blind ? "rgba(255,238,215,0.2)" : "rgba(0,0,0,0.5)");
    $("#coverDesc").textContent = t
      ? `${D.product.title} in ${leather().name} leather, personalised with “${t}” in ${f.label.toLowerCase()} lettering, ${foil().label.toLowerCase()}, ${place().label.toLowerCase()}`
      : `${D.product.title} in ${leather().name} leather, no personalisation`;

    if (!stamp || reduced() || !t) return;
    // Stamp press + foil sweep
    gsap.fromTo("#mono", { scale: 1.1, opacity: 0.35, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.4)" });
    gsap.fromTo("#tilt", { scale: 0.992 }, { scale: 1, duration: 0.35, ease: "power2.out" });
    if (!blind) gsap.fromTo("#foil", { attr: { gradientTransform: "translate(-1 0)" } }, { attr: { gradientTransform: "translate(1 0)" }, duration: 1.3, ease: "power2.inOut" });
  }

  /* ---------------- tilt + loupe ---------------- */
  function wireStage() {
    const stage = $("#stage");
    const cover = $("#cover");
    const loupe = $("#loupe");
    const loupeSvg = $("#loupeSvg");
    const rx = gsap.quickTo(cover, "rotationX", { duration: 0.6, ease: "power3.out" });
    const ry = gsap.quickTo(cover, "rotationY", { duration: 0.6, ease: "power3.out" });
    const lx = gsap.quickTo(loupe, "x", { duration: 0.18, ease: "power3.out" });
    const ly = gsap.quickTo(loupe, "y", { duration: 0.18, ease: "power3.out" });
    const ZOOM = 2.6;
    stage.addEventListener("pointermove", (e) => {
      if (reduced() || !fine()) return;
      const sr = stage.getBoundingClientRect();
      const nx = (e.clientX - sr.left) / sr.width - 0.5;
      const ny = (e.clientY - sr.top) / sr.height - 0.5;
      ry(nx * 14);
      rx(-ny * 9);
      $("#sheenRect").setAttribute("x", -160 + (nx + 0.5) * 540);

      const cr = cover.getBoundingClientRect();
      const inside = e.clientX > cr.left && e.clientX < cr.right && e.clientY > cr.top && e.clientY < cr.bottom;
      gsap.to(loupe, { opacity: inside ? 1 : 0, scale: inside ? 1 : 0.6, duration: 0.25, overwrite: "auto" });
      if (!inside) return;
      const W = cr.width * ZOOM;
      const H = cr.height * ZOOM;
      loupeSvg.setAttribute("width", W);
      loupeSvg.setAttribute("height", H);
      const px = (e.clientX - cr.left) / cr.width;
      const py = (e.clientY - cr.top) / cr.height;
      gsap.set(loupeSvg, { x: -px * W + 85, y: -py * H + 85 });
      lx(e.clientX - sr.left - 85);
      ly(e.clientY - sr.top - 85);
    });
    stage.addEventListener("pointerleave", () => {
      rx(0);
      ry(0);
      gsap.to(loupe, { opacity: 0, scale: 0.6, duration: 0.2 });
    });
  }

  /* ==========================================================================
     Controls
     ========================================================================== */
  /** Accessible radiogroup of buttons with arrow-key support. */
  function radiogroup(host, items, current, onPick, markup) {
    host.setAttribute("role", "radiogroup");
    host.innerHTML = items.map((it) => markup(it, it.id === current)).join("");
    const btns = () => $$("[role=radio]", host);
    const sync = (id) => btns().forEach((b) => { const on = b.dataset.id === id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    sync(current);
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[role=radio]");
      if (!b) return;
      sync(b.dataset.id);
      onPick(b.dataset.id, b);
    });
    host.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const list = btns();
      const i = list.indexOf(document.activeElement);
      const n = list[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length];
      n.focus();
      n.click();
    });
    return sync;
  }

  const popChoice = (el) => !reduced() && gsap.fromTo(el, { scale: 0.94 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });

  function buildControls() {
    const p = D.product;
    $("#productTitle").textContent = p.title;
    $("#productSub").textContent = p.subtitle;
    $("#leadTime").textContent = P().leadTime;

    $("#leathers").innerHTML = p.leathers
      .map((l) => `<label class="swatch" title="${esc(l.name)}"><input type="radio" name="leather" value="${l.id}" ${l.id === S.leather ? "checked" : ""} aria-label="${esc(l.name)}"><span style="--l:${l.light};--b:${l.dark}"></span></label>`)
      .join("");
    $("#leathers").addEventListener("change", (e) => {
      S.leather = e.target.value;
      setLeather(true);
      update();
    });

    radiogroup($("#modes"), P().modes, S.mode, (id) => { S.mode = id; syncInput(); update({ stamp: true }); }, (m, on) => `<button class="tab" type="button" role="radio" data-id="${m.id}">${esc(m.label)} · +${fmt(m.fee)}</button>`);

    radiogroup($("#fonts"), P().fonts, S.font, (id, b) => { S.font = id; popChoice(b); update({ stamp: true }); },
      (f) => `<button class="fontopt" type="button" role="radio" data-id="${f.id}"><span class="fontopt__aa" style="font-family:'${f.family}';font-weight:${f.weight}">Aa</span>${esc(f.label)}</button>`);

    radiogroup($("#foils"), P().foils, S.foil, (id, b) => { S.foil = id; setFoilGradient(); popChoice(b); update({ stamp: true }); },
      (f) => `<button class="foilopt" type="button" role="radio" data-id="${f.id}"><span class="foilopt__chip${f.stops.length ? "" : " foilopt__chip--blind"}" style="--g:linear-gradient(135deg, ${f.stops.join(", ") || "#000, #000"})"></span>${esc(f.label)}</button>`);

    const mark = { br: "M18 33h9", center: "M11 22h12", tl: "M7 9h9" };
    radiogroup($("#places"), P().placements, S.place, (id, b) => { S.place = id; popChoice(b); update({ stamp: true }); },
      (pl) => `<button class="placeopt" type="button" role="radio" data-id="${pl.id}"><svg viewBox="0 0 34 44" aria-hidden="true"><rect x="2" y="2" width="30" height="40" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="${mark[pl.id]}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>${esc(pl.label)}</button>`);

    const input = $("#monoInput");
    let errTimer;
    input.addEventListener("input", () => {
      const raw = input.value;
      const clean = raw.replace(/[^A-Za-z .&]/g, "");
      if (clean !== raw) {
        input.value = clean;
        $("#monoErr").textContent = "Only letters, spaces, full stops and & can be stamped.";
        $(".field__row").classList.add("is-bad");
        if (!reduced()) gsap.fromTo(".field__row", { x: 0 }, { keyframes: { x: [-6, 5, -3, 2, 0] }, duration: 0.35 });
        clearTimeout(errTimer);
        errTimer = setTimeout(() => {
          $("#monoErr").textContent = "";
          $(".field__row").classList.remove("is-bad");
        }, 2500);
      }
      if (S.mode === "initials") input.value = input.value.toUpperCase();
      S.text[S.mode] = input.value;
      $("#monoCount").textContent = `${input.value.length}/${mode().max}`;
      update({ stamp: true });
    });

    $("#personalise").addEventListener("change", (e) => {
      S.on = e.target.checked;
      const opts = $("#options");
      if (reduced()) opts.hidden = !S.on;
      else if (S.on) {
        opts.hidden = false;
        gsap.fromTo(opts, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.45, ease: "power3.out", clearProps: "height" });
      } else {
        gsap.to(opts, { height: 0, opacity: 0, duration: 0.35, ease: "power2.in", onComplete: () => { opts.hidden = true; gsap.set(opts, { clearProps: "height,opacity" }); } });
      }
      update({ stamp: true });
    });
    syncInput();
  }

  function syncInput() {
    const m = mode();
    const input = $("#monoInput");
    input.maxLength = m.max;
    input.placeholder = m.placeholder;
    input.value = S.text[S.mode];
    $("#monoLabel").textContent = S.mode === "initials" ? "Your initials" : "Name";
    $("#monoHelp").textContent = `Up to ${m.max} characters. ${P().allowed}.`;
    $("#monoCount").textContent = `${input.value.length}/${m.max}`;
    $("#monoErr").textContent = "";
  }

  let shownPrice = 0;
  function update(opts = {}) {
    renderStamp(opts);
    const total = D.product.price + fee();
    const priceEl = $("#price");
    if (reduced() || !shownPrice) priceEl.textContent = fmt(total);
    else {
      const o = { v: shownPrice };
      gsap.to(o, { v: total, duration: 0.4, onUpdate: () => (priceEl.textContent = fmt(Math.round(o.v))) });
    }
    shownPrice = total;
    $("#feeNote").textContent = fee() ? `includes ${fmt(fee())} personalisation` : "";
    $("#feeChip").textContent = S.on ? `+${fmt(mode().fee)}` : "Off";
    // live font previews show the shopper's own text
    const sample = (text() || mode().placeholder).slice(0, S.mode === "initials" ? 3 : 6);
    $$(".fontopt__aa").forEach((el) => (el.textContent = sample));
    const t = text();
    $("#summary").innerHTML = `<dl><dt>Leather</dt><dd>${esc(leather().name)}</dd><dt>Personalisation</dt><dd>${
      t ? `<b>“${esc(stampSpec().t)}”</b> in ${esc(font().label.toLowerCase())}, ${esc(foil().label.toLowerCase())}, ${esc(place().label.toLowerCase())}` : "None"
    }</dd><dt>Total</dt><dd><b>${fmt(D.product.price + fee())}</b></dd></dl>`;
  }

  /* ==========================================================================
     Proof export (canvas): leather from the SVG, lettering drawn with web fonts
     ========================================================================== */
  async function renderProof(scale = 2, withSpec = true) {
    const { t, f, L } = stampSpec();
    const svg = $("#cover").cloneNode(true);
    $("#mono", svg)?.remove();
    $("#sheenRect", svg)?.remove();
    svg.setAttribute("width", 400 * scale);
    svg.setAttribute("height", 540 * scale);
    svg.style.cssText = "";
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const footer = withSpec ? 150 * scale : 0;
    const c = document.createElement("canvas");
    c.width = 440 * scale;
    c.height = 580 * scale + footer;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#efe7da";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 20 * scale, 20 * scale, 400 * scale, 540 * scale);
    URL.revokeObjectURL(url);

    if (t) {
      const size = +$("#monoMain").getAttribute("font-size") * scale;
      await document.fonts.load(`${f.weight} ${Math.round(size)}px "${f.family}"`);
      ctx.save();
      ctx.translate(20 * scale, 20 * scale);
      ctx.font = `${f.weight} ${size}px "${f.family}"`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${f.track * scale}px`;
      ctx.textAlign = { start: "left", middle: "center", end: "right" }[L.anchor];
      ctx.textBaseline = "alphabetic";
      const x = L.x * scale;
      const y = L.y * scale;
      const blind = S.foil === "blind";
      ctx.fillStyle = blind ? "rgba(255,238,215,0.2)" : "rgba(0,0,0,0.5)";
      ctx.fillText(t, x, y + (blind ? 1.3 : 1.5) * scale);
      if (blind) ctx.fillStyle = "rgba(0,0,0,0.42)";
      else {
        const w = ctx.measureText(t).width;
        const x0 = L.anchor === "end" ? x - w : L.anchor === "middle" ? x - w / 2 : x;
        const g = ctx.createLinearGradient(x0, y - size, x0 + w, y);
        foil().stops.forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
        ctx.fillStyle = g;
      }
      ctx.fillText(t, x, y);
      ctx.restore();
    }

    if (withSpec) {
      const y0 = 580 * scale;
      ctx.fillStyle = "#241b19";
      ctx.fillRect(0, y0, c.width, footer);
      ctx.fillStyle = "#fbf8f3";
      ctx.textAlign = "left";
      ctx.font = `600 ${15 * scale}px Karla, sans-serif`;
      ctx.fillText(`${D.shop.name} · personalisation proof`, 22 * scale, y0 + 34 * scale);
      ctx.font = `400 ${12.5 * scale}px Karla, sans-serif`;
      const lines = [
        `Product: ${D.product.title}, ${leather().name} leather`,
        t ? `Text: “${t}”   Lettering: ${f.label} (${f.family})` : "Text: none",
        t ? `Finish: ${foil().label}   Placement: ${place().label}` : "",
        `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
      ].filter(Boolean);
      lines.forEach((l, i) => ctx.fillText(l, 22 * scale, y0 + (60 + i * 21) * scale));
    }
    return c.toDataURL("image/png");
  }

  async function downloadProof() {
    const btn = $("#proofBtn");
    btn.setAttribute("aria-busy", "true");
    try {
      const url = await renderProof(2, true);
      const a = document.createElement("a");
      a.href = url;
      a.download = `folio-proof-${(text() || "plain").replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
    }
    btn.removeAttribute("aria-busy");
  }

  /* ---------------- add to bag ---------------- */
  async function addToBag() {
    const btn = $("#addBtn");
    if (btn.dataset.busy) return;
    if (S.on && !text()) {
      $("#monoErr").textContent = S.mode === "initials" ? "Add your initials, or switch personalisation off." : "Add a name, or switch personalisation off.";
      $("#monoInput").focus();
      if (!reduced()) gsap.fromTo(".field__row", { x: 0 }, { keyframes: { x: [-6, 5, -3, 2, 0] }, duration: 0.35 });
      return;
    }
    btn.dataset.busy = "1";
    const label = $("span", btn);
    label.textContent = "Adding…";
    const thumb = await renderProof(1, false);
    S.cart += 1;
    $("#cartCount").textContent = S.cart;
    $("#cartBtn").setAttribute("aria-label", `Bag, ${S.cart} item${S.cart === 1 ? "" : "s"}`);
    label.textContent = "Added to bag";
    $("#toastImg").src = thumb;
    $("#toastText").textContent = text() ? `${D.product.title} · “${stampSpec().t}”, ${foil().label.toLowerCase()}` : D.product.title;
    const toast = $("#toast");
    if (reduced()) gsap.set(toast, { opacity: 1 });
    else {
      gsap.fromTo(toast, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" });
      gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.12, yoyo: true, repeat: 1, duration: 0.15 });
    }
    setTimeout(() => {
      gsap.to(toast, { opacity: 0, y: 12, duration: 0.3 });
      label.textContent = "Add to bag";
      delete btn.dataset.busy;
    }, 2600);
  }

  async function init() {
    D = await loadData();
    setLeather(false);
    setFoilGradient();
    buildControls();
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    update();
    wireStage();
    $("#addBtn").addEventListener("click", addToBag);
    $("#proofBtn").addEventListener("click", downloadProof);
    if (!reduced()) {
      gsap.from("#tilt", { y: 40, rotation: -4, opacity: 0, duration: 1, ease: "power3.out" });
      gsap.from(".studio > *", { y: 18, opacity: 0, duration: 0.6, stagger: 0.04, ease: "power3.out", clearProps: "transform,opacity" });
      gsap.fromTo("#foil", { attr: { gradientTransform: "translate(-1 0)" } }, { attr: { gradientTransform: "translate(1 0)" }, duration: 1.6, delay: 0.6, ease: "power2.inOut" });
    }
  }
  init().catch((e) => { console.error(e); $("#studio").insertAdjacentHTML("afterbegin", "<p>Data could not load. Run npx serve or node tools/sync-data.mjs.</p>"); });
})();
