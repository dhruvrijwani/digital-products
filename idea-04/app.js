/* ==========================================================================
   Loop Studio · Creator video pipeline prototype
   Three views share one state object persisted in localStorage, so the story
   flows end to end: creator upload → merchant approval → storefront wall.
   Seed content lives in data/seed.json (file:// uses the data/seed.js mirror).
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  const KEY = "loopstudio.demo.v1";

  let seed;
  let S; // shared state
  const blobs = {}; // clip id → object URL for files uploaded this session (not persistable)

  /* ---------------- product icons (rounded line drawings) ---------------- */
  const ICONS = {
    bands: '<ellipse cx="9" cy="12" rx="5" ry="7"/><ellipse cx="15" cy="12" rx="5" ry="7"/>',
    mat: '<path d="M4 8.5h10v9H6a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="11" r="3.5"/><circle cx="16.5" cy="11" r="1.2"/>',
    wheel: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.2"/><path d="M2.5 12h3M18.5 12h3"/>',
    dumbbell: '<path d="M7.5 12h9"/><rect x="3" y="7.5" width="4.5" height="9" rx="1.6"/><rect x="16.5" y="7.5" width="4.5" height="9" rx="1.6"/>',
    roller: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M8.5 8v8M12 8v8M15.5 8v8"/>',
    bottle: '<path d="M10 3h4v3l2 3v10.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19.5V9l2-3z"/><path d="M8 13.5h8"/>',
  };
  const icon = (p) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" style="color:${p.ink}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon]}</svg>`;
  const product = (id) => seed.products.find((p) => p.id === id);
  const money = (n) => `${seed.shop.currency}${n}`;
  const srcOf = (c) => blobs[c.id] || c.src;

  /* ---------------- state ---------------- */
  function fresh() {
    return { clips: seed.clips.map((c) => ({ ...c, approvedAt: 0, isNew: false })), cart: 0, view: "upload", mode: "stack" };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable: run in memory */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  const pending = () => S.clips.filter((c) => c.status === "pending");
  const approved = () => S.clips.filter((c) => c.status === "approved").sort((a, b) => b.approvedAt - a.approvedAt);
  const count = (st) => S.clips.filter((c) => c.status === st).length;

  async function loadSeed() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.seed;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const res = await fetch("data/seed.json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      if (mirror()) return mirror();
      throw err;
    }
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    gsap.killTweensOf(t);
    gsap.fromTo(t, { opacity: 0, y: 20, xPercent: -50, x: 0 }, { opacity: 1, y: 0, duration: 0.3, ease: "back.out(2)" });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => gsap.to(t, { opacity: 0, y: 10, duration: 0.25 }), 2600);
  }

  /* ==========================================================================
     View switcher (top segmented control, bottom tab bar on mobile)
     ========================================================================== */
  const VIEWS = ["upload", "queue", "wall"];

  function placePill(animate) {
    const list = $("#switcher");
    const pill = $(".switcher__pill", list);
    const tab = $(`.switcher__tab[data-view="${S.view}"]`, list);
    const W = list.clientWidth;
    const L = tab.offsetLeft;
    const R = W - (L + tab.offsetWidth);
    gsap.set(pill, { width: W, left: 0 });
    const clip = `inset(0px ${R}px 0px ${L}px round 999px)`;
    if (animate && !reduced()) gsap.to(pill, { clipPath: clip, duration: 0.45, ease: "power3.inOut" });
    else gsap.set(pill, { clipPath: clip });
  }

  function setView(view, { animate = true } = {}) {
    const prev = S.view;
    S.view = view;
    save();
    $$(".switcher__tab").forEach((t) => {
      const on = t.dataset.view === view;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    VIEWS.forEach((v) => ($(`#view-${v}`).hidden = v !== view));
    placePill(animate);
    pauseAllVideos();
    const panel = $(`#view-${view}`);
    if (view === "queue") renderQueue(false);
    if (view === "wall") renderWall(true);
    if (animate && prev !== view && !reduced()) {
      const dir = VIEWS.indexOf(view) > VIEWS.indexOf(prev) ? 1 : -1;
      gsap.fromTo(panel, { opacity: 0, x: 30 * dir }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out", clearProps: "transform" });
    }
    window.scrollTo({ top: 0 });
  }

  function wireSwitcher() {
    const list = $("#switcher");
    list.addEventListener("click", (e) => {
      const t = e.target.closest(".switcher__tab");
      if (t) setView(t.dataset.view);
    });
    list.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      let i = VIEWS.indexOf(S.view);
      if (e.key === "ArrowLeft") i = (i + 2) % 3;
      if (e.key === "ArrowRight") i = (i + 1) % 3;
      if (e.key === "Home") i = 0;
      if (e.key === "End") i = 2;
      setView(VIEWS[i]);
      $(`.switcher__tab[data-view="${VIEWS[i]}"]`).focus();
    });
    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-goto]");
      if (go) setView(go.dataset.goto);
    });
  }

  function updateCounts(animate = true) {
    const badge = $("#queueBadge");
    const n = count("pending");
    const was = +badge.textContent;
    badge.textContent = n;
    badge.dataset.zero = String(n === 0);
    $("#tab-queue").setAttribute("aria-label", `Approval queue, ${n} pending`);
    if (animate && was !== n && !reduced()) gsap.fromTo(badge, { scale: 1.5 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.5)" });

    [["#cPending", "pending"], ["#cApproved", "approved"], ["#cRejected", "rejected"]].forEach(([sel, st]) => {
      const dd = $(sel);
      const from = +dd.textContent;
      const to = count(st);
      if (from === to) return;
      if (!animate || reduced()) {
        dd.textContent = to;
        return;
      }
      const o = { v: from };
      gsap.to(o, { v: to, duration: 0.5, ease: "power2.out", onUpdate: () => (dd.textContent = Math.round(o.v)) });
      gsap.fromTo(dd, { scale: 1.35, y: -4 }, { scale: 1, y: 0, duration: 0.55, ease: "back.out(3)" });
    });
    $("#cartCount").textContent = S.cart;
    $("#cartBtn").setAttribute("aria-label", `Cart, ${S.cart} item${S.cart === 1 ? "" : "s"}`);
  }

  function pauseAllVideos() {
    $$("video").forEach((v) => v.pause());
  }

  /* ==========================================================================
     1. Creator upload
     ========================================================================== */
  const upload = { file: null, done: false, tl: null };
  const CIRC = 2 * Math.PI * 52;

  function wireUpload() {
    const sel = $("#fProduct");
    sel.innerHTML = seed.products.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("");

    const drop = $("#drop");
    const icon = $(".drop__icon", drop);
    let depth = 0;
    let bounce;
    drop.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (++depth > 1) return;
      drop.classList.add("is-over");
      if (!reduced()) {
        gsap.to(drop, { scale: 1.02, duration: 0.25, ease: "back.out(2)" });
        bounce = gsap.to(icon, { y: -8, duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" });
      }
    });
    drop.addEventListener("dragover", (e) => e.preventDefault());
    const leave = () => {
      depth = 0;
      drop.classList.remove("is-over");
      bounce?.kill();
      gsap.to(drop, { scale: 1, duration: 0.25 });
      gsap.to(icon, { y: 0, duration: 0.25 });
    };
    drop.addEventListener("dragleave", () => { if (--depth <= 0) leave(); });
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      leave();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) takeFile(f);
    });
    $("#fileInput").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) takeFile(f);
      e.target.value = "";
    });
    $("#sampleBtn").addEventListener("click", () => {
      const sample = seed.sampleClips[Math.floor(Math.random() * seed.sampleClips.length)];
      startUpload({ name: "my-loop-session.mp4", src: sample.src, poster: sample.poster, sample: true });
    });
    $("#replaceBtn").addEventListener("click", resetDrop);
    $("#uploadForm").addEventListener("submit", submitClip);
    $("#anotherBtn").addEventListener("click", () => {
      resetForm();
      showForm();
    });
    ["fName", "fHandle"].forEach((id) => $(`#${id}`).addEventListener("input", () => clearError(id)));
    $("#fConsent").addEventListener("change", () => clearError("fConsent"));
  }

  function takeFile(f) {
    if (!f.type.startsWith("video/")) {
      const drop = $("#drop");
      drop.classList.add("is-invalid");
      $("#dropHint").textContent = "That file isn't a video. Choose an MP4 or MOV.";
      if (!reduced()) gsap.fromTo(drop, { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.4 });
      return;
    }
    const url = URL.createObjectURL(f);
    const sample = seed.sampleClips[0];
    startUpload({ name: f.name, src: url, poster: "", sample: false, fallback: sample });
  }

  function startUpload(file) {
    upload.file = file;
    upload.done = false;
    const drop = $("#drop");
    drop.classList.remove("is-invalid", "is-done");
    $("#dropHint").innerHTML = 'or <label for="fileInput" class="drop__browse">choose a file</label> · MP4 or MOV';
    $(".drop__idle", drop).hidden = true;
    $(".drop__input", drop).hidden = true;
    const busy = $(".drop__busy", drop);
    busy.hidden = false;
    $("#fileName").textContent = file.name;
    $("#uploadStatus").textContent = "Uploading…";
    const preview = $(".ring__preview", drop);
    preview.src = file.src;
    if (file.poster) preview.poster = file.poster;
    const fg = $(".ring__fg", drop);
    const pct = $("#ringPct");
    const prog = { p: 0 };
    const render = () => {
      fg.style.strokeDashoffset = CIRC * (1 - prog.p);
      pct.textContent = `${Math.round(prog.p * 100)}%`;
    };
    upload.tl?.kill();
    if (!reduced()) gsap.fromTo(busy, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" });
    const finish = () => {
      upload.done = true;
      drop.classList.add("is-done");
      $("#uploadStatus").textContent = "Uploaded. Add your details below.";
      preview.play().catch(() => {});
      fg.style.stroke = "var(--approve)";
      if (!reduced()) gsap.fromTo($(".ring", drop), { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1 });
    };
    fg.style.stroke = "";
    if (reduced()) {
      upload.tl = gsap.to(prog, { p: 1, duration: 0.4, ease: "none", onUpdate: render, onComplete: finish });
    } else {
      upload.tl = gsap.timeline({ onUpdate: render, onComplete: finish })
        .to(prog, { p: 0.31, duration: 0.6, ease: "power2.out", onUpdate: render })
        .to(prog, { p: 0.48, duration: 0.5, ease: "power1.inOut", onUpdate: render }, "+=0.15")
        .to(prog, { p: 0.86, duration: 0.7, ease: "power2.inOut", onUpdate: render })
        .to(prog, { p: 1, duration: 0.45, ease: "power2.out", onUpdate: render }, "+=0.2");
    }
  }

  function resetDrop() {
    upload.tl?.kill();
    upload.file = null;
    upload.done = false;
    const drop = $("#drop");
    drop.classList.remove("is-done", "is-invalid");
    $(".drop__busy", drop).hidden = true;
    $(".drop__idle", drop).hidden = false;
    $(".drop__input", drop).hidden = false;
    const preview = $(".ring__preview", drop);
    preview.pause();
    preview.removeAttribute("src");
    preview.removeAttribute("poster");
    $(".ring__fg", drop).style.strokeDashoffset = CIRC;
    $("#dropHint").innerHTML = 'or <label for="fileInput" class="drop__browse">choose a file</label> · MP4 or MOV';
  }

  function setError(id, msg) {
    const err = $(`#${id}Err`);
    err.textContent = msg;
    const field = $(`#${id}`).closest(".field, .consent");
    field?.classList.add("is-invalid");
    if (!reduced()) gsap.fromTo(err, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.25 });
  }
  function clearError(id) {
    $(`#${id}Err`).textContent = "";
    $(`#${id}`).closest(".field, .consent")?.classList.remove("is-invalid");
  }

  function submitClip(e) {
    e.preventDefault();
    const name = $("#fName").value.trim();
    const handle = $("#fHandle").value.trim().replace(/^@/, "");
    const productId = $("#fProduct").value || seed.products[0].id;
    const consent = $("#fConsent").checked;
    let firstBad = null;
    ["fName", "fHandle", "fConsent"].forEach(clearError);

    if (!upload.file) {
      const drop = $("#drop");
      drop.classList.add("is-invalid");
      $("#dropHint").textContent = "Add a clip first, or use the sample.";
      if (!reduced()) gsap.fromTo(drop, { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.4 });
      firstBad = firstBad || $("#sampleBtn");
    } else if (!upload.done) {
      $("#uploadStatus").textContent = "Still uploading. One moment.";
      return;
    }
    if (!name) { setError("fName", "Add your name so we can credit you."); firstBad = firstBad || $("#fName"); }
    if (!/^[a-z0-9._]{2,30}$/i.test(handle)) { setError("fHandle", "Use letters, numbers, dots or underscores."); firstBad = firstBad || $("#fHandle"); }
    if (!consent) { setError("fConsent", "Confirm you have permission to share this clip."); firstBad = firstBad || $("#fConsent"); }
    if (firstBad) {
      firstBad.focus();
      return;
    }

    const id = `u-${Date.now().toString(36)}`;
    const f = upload.file;
    const clip = {
      id,
      status: "pending",
      creator: name,
      handle,
      productIds: [productId],
      src: f.sample ? f.src : f.fallback.src,
      poster: f.sample ? f.poster : f.fallback.poster,
      submittedAgo: "Just now",
      approvedAt: 0,
      isNew: false,
      ownFile: !f.sample,
    };
    if (!f.sample) blobs[id] = f.src;
    S.clips.unshift(clip);
    save();
    updateCounts(true);
    showSuccess(name, handle);
  }

  function showSuccess(name, handle) {
    const form = $(".upload");
    const ok = $("#success");
    $("#successText").textContent = `Thanks, ${name}. Your clip is first in the queue, and we'll message @${handle} when it goes live.`;
    const reveal = () => {
      form.hidden = true;
      ok.hidden = false;
      ok.focus();
      const circle = $(".success__badge circle", ok);
      const tick = $(".success__badge path", ok);
      if (reduced()) {
        gsap.set([circle, tick], { strokeDashoffset: 0 });
        return;
      }
      gsap.fromTo(ok, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)" });
      gsap.fromTo(circle, { strokeDashoffset: 214 }, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut", delay: 0.15 });
      gsap.fromTo(tick, { strokeDashoffset: 50 }, { strokeDashoffset: 0, duration: 0.35, ease: "power2.out", delay: 0.6 });
      gsap.fromTo($(".success__badge", ok), { scale: 0.6 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.5)", delay: 0.1 });
      confetti($(".confetti", ok));
    };
    if (reduced()) reveal();
    else gsap.to(form, { opacity: 0, y: -12, duration: 0.25, onComplete: () => { gsap.set(form, { clearProps: "all" }); reveal(); } });
  }

  function confetti(host) {
    host.innerHTML = "";
    const colors = ["#5b2ee6", "#ffd9cf", "#12a37a", "#ffcf4a", "#d0407e", "#c9bff0"];
    for (let i = 0; i < 34; i++) {
      const p = document.createElement("i");
      p.style.background = colors[i % colors.length];
      if (i % 3 === 0) p.style.borderRadius = "50%";
      host.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 200;
      gsap.timeline({ delay: 0.5 + Math.random() * 0.1 })
        .set(p, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 0.6 + Math.random() * 0.8 })
        .to(p, { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7 - 40, rotation: Math.random() * 540 - 270, duration: 0.9, ease: "power3.out" })
        .to(p, { y: "+=160", opacity: 0, duration: 0.9, ease: "power1.in" }, "-=0.25");
    }
  }

  function resetForm() {
    $("#uploadForm").reset();
    ["fName", "fHandle", "fConsent"].forEach(clearError);
    resetDrop();
  }
  function showForm() {
    $("#success").hidden = true;
    $(".upload").hidden = false;
    if (!reduced()) gsap.fromTo(".upload", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, clearProps: "all" });
  }

  /* ==========================================================================
     2. Approval queue: card stack (swipe / buttons / arrow keys) and list
     ========================================================================== */
  let attachFor = null;
  let deciding = false;

  function qcardMarkup(c, top) {
    const prods = c.productIds.map(product).filter(Boolean);
    return `
      <article class="qcard" data-id="${c.id}" aria-label="Clip from ${esc(c.creator)}">
        ${top
          ? `<video src="${srcOf(c)}" ${c.poster ? `poster="${c.poster}"` : ""} muted loop playsinline preload="metadata" autoplay></video>`
          : `<img src="${c.poster || seed.sampleClips[0].poster}" alt="">`}
        <span class="qcard__time">${esc(c.submittedAgo)}</span>
        <span class="stamp stamp--yes" aria-hidden="true">Approve</span>
        <span class="stamp stamp--no" aria-hidden="true">Reject</span>
        <div class="qcard__info">
          <p class="qcard__name">${esc(c.creator)}</p>
          <p class="qcard__handle">@${esc(c.handle)}</p>
          <div class="qcard__meta">${prods.map((p) => `<span class="pchip" style="--tint:${p.tint}"><i>${icon(p)}</i>${esc(p.title)}</span>`).join("")}</div>
        </div>
      </article>`;
  }

  const depthVars = (k) => ({ scale: 1 - k * 0.06, y: k * 18, rotation: k === 0 ? 0 : (k % 2 ? 2.5 : -2.5), opacity: k > 2 ? 0 : 1 });

  function renderQueue(animateIn, enterFrom = 0) {
    const list = pending();
    const stack = $("#stack");
    const isStack = S.mode === "stack";
    $$(".seg__btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
    $("#stackWrap").hidden = !isStack || !list.length;
    $("#qlist").hidden = isStack;
    $("#queueEmpty").hidden = list.length > 0;

    if (isStack) {
      const top = list.slice(0, 3);
      stack.innerHTML = top.slice().reverse().map((c) => qcardMarkup(c, c === top[0])).join("");
      const cards = $$(".qcard", stack).reverse(); // index 0 = top
      cards.forEach((card, k) => {
        if (animateIn && !reduced()) {
          const from = k === 0 && enterFrom ? { x: enterFrom * window.innerWidth * 0.6, rotation: enterFrom * 20, opacity: 0, y: 0, scale: 1 } : depthVars(k + 1);
          gsap.fromTo(card, from, { ...depthVars(k), duration: 0.5, ease: "back.out(1.4)", x: 0 });
        } else {
          gsap.set(card, depthVars(k));
        }
      });
      if (cards[0]) wireDrag(cards[0]);
    } else {
      renderList();
    }
  }

  function renderList() {
    const rows = [...pending(), ...S.clips.filter((c) => c.status !== "pending")];
    $("#qlist").innerHTML = rows
      .map((c) => {
        const prods = c.productIds.map((id) => product(id)?.title).filter(Boolean).join(", ");
        const actions =
          c.status === "pending"
            ? `<div class="qrow__actions"><button class="no" type="button" data-act="reject" data-id="${c.id}">Reject</button><button class="yes" type="button" data-act="approve" data-id="${c.id}">Approve</button></div>`
            : `<span class="status-pill status-pill--${c.status}">${c.status === "approved" ? "Approved" : "Rejected"}</span>`;
        return `
          <li class="qrow" data-id="${c.id}">
            <img src="${c.poster || seed.sampleClips[0].poster}" alt="">
            <div><p class="qrow__name">${esc(c.creator)} <span class="qrow__meta">@${esc(c.handle)}</span></p><p class="qrow__meta">${esc(prods)} · ${esc(c.submittedAgo)}</p></div>
            ${actions}
          </li>`;
      })
      .join("");
  }

  function wireDrag(card) {
    const yes = $(".stamp--yes", card);
    const no = $(".stamp--no", card);
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dragging = false;
    card.addEventListener("pointerdown", (e) => {
      if (deciding) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      card.setPointerCapture(e.pointerId);
      gsap.killTweensOf(card);
    });
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = e.clientY - startY;
      gsap.set(card, { x: dx, y: dy * 0.25, rotation: dx * 0.06 });
      gsap.set(yes, { opacity: gsap.utils.clamp(0, 1, dx / 110) });
      gsap.set(no, { opacity: gsap.utils.clamp(0, 1, -dx / 110) });
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (dx > 110) decide("approve", card);
      else if (dx < -110) decide("reject", card);
      else {
        gsap.to(card, { x: 0, y: 0, rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.6)" });
        gsap.to([yes, no], { opacity: 0, duration: 0.2 });
      }
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function decide(kind, card) {
    if (deciding) return;
    const id = card ? card.dataset.id : pending()[0]?.id;
    if (!id) return;
    card = card || $(`.qcard[data-id="${id}"]`);
    deciding = true;
    const dir = kind === "approve" ? 1 : -1;
    const clip = S.clips.find((c) => c.id === id);
    const after = () => {
      deciding = false;
      if (kind === "approve") openAttach(clip);
      else {
        clip.status = "rejected";
        save();
        updateCounts(true);
        renderQueue(true);
        toast(`Rejected clip from ${clip.creator}`);
      }
    };
    if (!card) return after();
    $("video", card)?.pause();
    if (reduced()) {
      gsap.to(card, { opacity: 0, duration: 0.2, onComplete: after });
      return;
    }
    gsap.to($(dir > 0 ? ".stamp--yes" : ".stamp--no", card), { opacity: 1, duration: 0.12 });
    gsap.to(card, { x: dir * (window.innerWidth * 0.6 + 200), y: "+=60", rotation: dir * 28, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: after });
  }

  /* ---------------- attach products step ---------------- */
  function openAttach(clip) {
    attachFor = clip;
    const dlg = $("#attach");
    $("#attachPoster").src = clip.poster || seed.sampleClips[0].poster;
    $("#attachText").textContent = `Approved clip from ${clip.creator}. Pick the products shoppers can buy from it.`;
    $("#attachChips").innerHTML = seed.products
      .map(
        (p) => `<button class="chip" type="button" aria-pressed="${clip.productIds.includes(p.id)}" data-id="${p.id}" style="--tint:${p.tint}">
          <i>${icon(p)}</i>${esc(p.title)}<span class="tick" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.4 2.9 2.8 6-6.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`
      )
      .join("");
    dlg.hidden = false;
    document.documentElement.classList.add("is-locked");
    if (!reduced()) {
      gsap.fromTo(".attach__backdrop", { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(".attach__card", { y: 40, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" });
      gsap.fromTo(".chip", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.4)", stagger: 0.05, delay: 0.15 });
    }
    $(".chip", dlg).focus();
  }

  function closeAttach(published) {
    const dlg = $("#attach");
    const clip = attachFor;
    attachFor = null;
    const done = () => {
      dlg.hidden = true;
      document.documentElement.classList.remove("is-locked");
      if (published) {
        renderQueue(true);
        toast(`Published to the storefront wall`);
      } else {
        renderQueue(true, 1); // card comes back from the right
      }
      const focusTarget = S.mode === "stack" ? $("#approveBtn") : $("#qlist button");
      (focusTarget && !focusTarget.closest("[hidden]") ? focusTarget : $("#tab-queue")).focus();
    };
    if (published) {
      clip.status = "approved";
      clip.productIds = $$('.chip[aria-pressed="true"]').map((c) => c.dataset.id);
      clip.approvedAt = Date.now();
      clip.isNew = true;
      save();
      updateCounts(true);
    }
    if (reduced()) return done();
    gsap.to(".attach__card", { y: 30, opacity: 0, scale: 0.96, duration: 0.25, ease: "power2.in" });
    gsap.to(".attach__backdrop", { opacity: 0, duration: 0.25, onComplete: done });
  }

  function wireQueue() {
    $("#approveBtn").addEventListener("click", () => decide("approve"));
    $("#rejectBtn").addEventListener("click", () => decide("reject"));
    $$(".seg__btn").forEach((b) =>
      b.addEventListener("click", () => {
        S.mode = b.dataset.mode;
        save();
        renderQueue(false);
        if (!reduced()) gsap.fromTo(S.mode === "stack" ? "#stackWrap" : "#qlist", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35 });
      })
    );
    $("#qlist").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const clip = S.clips.find((c) => c.id === b.dataset.id);
      const row = b.closest(".qrow");
      if (b.dataset.act === "approve") return openAttach(clip);
      const finish = () => {
        clip.status = "rejected";
        save();
        updateCounts(true);
        renderList();
        if (!pending().length) renderQueue(false);
        toast(`Rejected clip from ${clip.creator}`);
      };
      if (reduced()) return finish();
      gsap.to(row, { height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: -10, duration: 0.35, ease: "power2.in", onComplete: finish });
    });
    $("#attachChips").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const on = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", String(on));
      if (!reduced()) {
        gsap.fromTo(chip, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
        gsap.fromTo($(".tick", chip), { scale: on ? 0 : 1 }, { scale: on ? 1 : 0, duration: 0.3, ease: on ? "back.out(3)" : "power2.in" });
      }
    });
    $("#attachPublish").addEventListener("click", () => {
      if (!$$('.chip[aria-pressed="true"]').length) {
        toast("Tag at least one product");
        if (!reduced()) gsap.fromTo("#attachChips", { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.4 });
        return;
      }
      closeAttach(true);
    });
    $("#attachCancel").addEventListener("click", () => closeAttach(false));
    $(".attach__backdrop").addEventListener("click", () => closeAttach(false));
    $("#attach").addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAttach(false);
      if (e.key === "Tab") trapTab(e, $("#attach"));
    });

    document.addEventListener("keydown", (e) => {
      if (S.view !== "queue" || S.mode !== "stack" || attachFor || !$("#viewer").hidden) return;
      if (e.target.closest("input, select, textarea")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); decide("approve"); }
      if (e.key === "ArrowLeft") { e.preventDefault(); decide("reject"); }
    });
  }

  function trapTab(e, root) {
    const list = $$("button:not([disabled]), [href], input, select, [tabindex]:not([tabindex='-1'])", root).filter((n) => n.getClientRects().length);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ==========================================================================
     3. Storefront wall + stories viewer
     ========================================================================== */
  const RATIOS = ["9 / 16", "4 / 5", "9 / 14", "3 / 4", "9 / 16", "1 / 1.15"];
  let wallObserver;

  function renderWall(animate) {
    const list = approved();
    const wall = $("#wall");
    $("#wallTitle").textContent = seed.shop.wallTitle;
    $("#wallIntro").textContent = seed.shop.wallIntro;
    $("#wallEmpty").hidden = list.length > 0;
    wall.innerHTML = list
      .map((c, i) => {
        const prods = c.productIds.map(product).filter(Boolean);
        return `
          <li class="tile${c.isNew ? " is-new" : ""}" data-id="${c.id}">
            <button class="tile__btn" type="button" style="--ar:${RATIOS[i % RATIOS.length]}" aria-label="Watch @${esc(c.handle)}'s clip featuring ${esc(prods.map((p) => p.title).join(" and "))}">
              <video src="${srcOf(c)}" ${c.poster ? `poster="${c.poster}"` : ""} muted loop playsinline preload="metadata" tabindex="-1"></video>
              ${c.isNew ? '<span class="tile__new">New</span>' : ""}
              <span class="tile__play" aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M2.5 1.5 8.5 5l-6 3.5z" fill="currentColor"/></svg></span>
              <span class="tile__over">
                <span class="tile__handle">@${esc(c.handle)}</span>
                <span class="tile__tags">${prods.map((p) => `<span class="pchip" style="--tint:${p.tint}"><i>${icon(p)}</i>${esc(p.title.split(",")[0])}</span>`).join("")}</span>
              </span>
            </button>
          </li>`;
      })
      .join("");

    const tiles = $$(".tile", wall);
    tiles.forEach((tile) => {
      const v = $("video", tile);
      const btn = $(".tile__btn", tile);
      if (canHover()) {
        btn.addEventListener("pointerenter", () => v.play().catch(() => {}));
        btn.addEventListener("pointerleave", () => v.pause());
      }
      btn.addEventListener("focus", () => btn.matches(":focus-visible") && v.play().catch(() => {}));
      btn.addEventListener("blur", () => v.pause());
      btn.addEventListener("click", () => openViewer(tile.dataset.id, btn));
    });

    wallObserver?.disconnect();
    wallObserver = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        const v = $("video", en.target);
        if (!en.isIntersecting) v.pause();
        else if (!canHover() && !reduced() && $("#viewer").hidden) v.play().catch(() => {});
      }),
      { threshold: 0.6 }
    );
    tiles.forEach((t) => wallObserver.observe(t));

    if (animate && !reduced()) {
      const fresh = tiles.filter((t) => t.classList.contains("is-new"));
      const old = tiles.filter((t) => !t.classList.contains("is-new"));
      if (old.length) gsap.fromTo(old, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.05 });
      if (fresh.length) gsap.fromTo(fresh, { opacity: 0, scale: 0.7, rotation: -6, y: 30 }, { opacity: 1, scale: 1, rotation: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.6)", stagger: 0.12, delay: 0.25 });
      fresh.forEach((t, i) => gsap.fromTo($(".tile__new", t), { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(3)", delay: 0.55 + i * 0.12 }));
    }
    // Clips only count as "new" on the first visit after approval.
    let changed = false;
    S.clips.forEach((c) => { if (c.isNew) { c.isNew = false; changed = true; } });
    if (changed) save();
  }

  /* ---------------- viewer ---------------- */
  const V = { list: [], i: 0, trigger: null, prodIdx: 0, held: false, holdTimer: 0, raf: null, MAX: 12 };

  function openViewer(id, trigger) {
    V.list = approved();
    V.i = Math.max(0, V.list.findIndex((c) => c.id === id));
    V.trigger = trigger;
    pauseAllVideos();
    const viewer = $("#viewer");
    $("#viewerBars").innerHTML = V.list.map(() => '<span class="viewer__bar"><span></span></span>').join("");
    viewer.hidden = false;
    document.documentElement.classList.add("is-locked");
    loadClip(true);
    const stage = $("#viewerStage");
    if (!reduced()) {
      gsap.fromTo(".viewer__backdrop", { opacity: 0 }, { opacity: 1, duration: 0.35 });
      // grow out of the tapped tile
      const from = trigger.getBoundingClientRect();
      const to = stage.getBoundingClientRect();
      gsap.fromTo(
        stage,
        { x: from.left + from.width / 2 - (to.left + to.width / 2), y: from.top + from.height / 2 - (to.top + to.height / 2), scale: from.width / to.width, opacity: 0.6 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" }
      );
    }
    $("#viewerClose").focus();
    gsap.ticker.add(tickViewer);
  }

  function closeViewer() {
    const viewer = $("#viewer");
    if (viewer.hidden) return;
    const v = $("#viewerVideo");
    gsap.ticker.remove(tickViewer);
    const done = () => {
      v.pause();
      viewer.hidden = true;
      gsap.set("#viewerStage", { clearProps: "all" });
      document.documentElement.classList.remove("is-locked");
      V.trigger?.focus();
    };
    if (reduced()) return done();
    const stage = $("#viewerStage");
    const r = V.trigger.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    gsap.to(".viewer__backdrop", { opacity: 0, duration: 0.3 });
    gsap.to(stage, {
      x: r.left + r.width / 2 - (s.left + s.width / 2),
      y: r.top + r.height / 2 - (s.top + s.height / 2),
      scale: r.width / s.width, opacity: 0, duration: 0.4, ease: "power3.in", onComplete: done,
    });
  }

  function loadClip(first) {
    const c = V.list[V.i];
    const v = $("#viewerVideo");
    V.prodIdx = 0;
    $$(".viewer__bar span").forEach((b, k) => (b.style.transform = `scaleX(${k < V.i ? 1 : 0})`));
    $("#viewerName").textContent = c.creator;
    $("#viewerHandle").textContent = `@${c.handle}`;
    $("#viewerAvatar").textContent = c.creator.charAt(0);
    const swap = () => {
      v.src = srcOf(c);
      if (c.poster) v.poster = c.poster; else v.removeAttribute("poster");
      v.currentTime = 0;
      v.play().catch(() => {});
      if (!reduced()) gsap.fromTo(v, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    };
    if (first || reduced()) swap();
    else gsap.to(v, { opacity: 0, duration: 0.12, onComplete: swap });
    renderTag(true);
  }

  function renderTag(animate) {
    const c = V.list[V.i];
    const prods = c.productIds.map(product).filter(Boolean);
    const p = prods[V.prodIdx % prods.length];
    const card = $("#tagcard");
    card.style.setProperty("--tint", p.tint);
    card.innerHTML = `
      <span class="tagcard__icon">${icon(p)}</span>
      <div>
        <p class="tagcard__title">${esc(p.title)}</p>
        <p class="tagcard__price">${money(p.price)}</p>
        ${prods.length > 1 ? `<button class="tagcard__more" type="button">${prods.length - 1} more in this clip</button>` : ""}
      </div>
      <button class="tagcard__add" type="button" data-id="${p.id}">Add to cart</button>`;
    if (animate && !reduced()) gsap.fromTo(card, { yPercent: 140, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: "back.out(1.5)", delay: 0.3 });
  }

  function step(d) {
    const n = V.list.length;
    const next = V.i + d;
    if (next < 0) { V.i = 0; $("#viewerVideo").currentTime = 0; return; }
    if (next >= n) return closeViewer();
    V.i = next;
    loadClip(false);
  }

  function tickViewer() {
    const v = $("#viewerVideo");
    if (!v.duration) return;
    const len = Math.min(v.duration, V.MAX);
    const p = Math.min(1, v.currentTime / len);
    const bar = $$(".viewer__bar span")[V.i];
    if (bar) bar.style.transform = `scaleX(${p})`;
    // Clips longer than MAX seconds advance early; shorter ones advance on "ended".
    if (v.duration > V.MAX && p >= 1 && !V.held && !v.paused) step(1);
  }

  function wireViewer() {
    const v = $("#viewerVideo");
    v.addEventListener("ended", () => step(1));
    const tap = (btn, d) => {
      btn.addEventListener("pointerdown", () => {
        V.held = false;
        V.holdTimer = setTimeout(() => { V.held = true; v.pause(); }, 260);
      });
      btn.addEventListener("pointerup", () => {
        clearTimeout(V.holdTimer);
        if (V.held) {
          V.held = false;
          V.suppressClick = true; // releasing a hold resumes instead of navigating
          v.play().catch(() => {});
        }
      });
      btn.addEventListener("click", () => {
        if (V.suppressClick) { V.suppressClick = false; return; }
        step(d);
      });
    };
    tap($("#viewerPrev"), -1);
    tap($("#viewerNext"), 1);
    $("#viewer").addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeViewer();
      const add = e.target.closest(".tagcard__add");
      if (add && !add.classList.contains("is-added")) {
        S.cart += 1;
        save();
        updateCounts(false);
        add.classList.add("is-added");
        add.textContent = "Added";
        if (!reduced()) {
          gsap.fromTo(add, { scale: 0.9 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
          gsap.fromTo("#cartBtn", { scale: 1 }, { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1 });
        }
        toast(`${product(add.dataset.id).title} added to cart`);
      }
      if (e.target.closest(".tagcard__more")) {
        V.prodIdx += 1;
        renderTag(false);
        if (!reduced()) gsap.fromTo("#tagcard", { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" });
        $(".tagcard__add").focus();
      }
    });
    $("#viewerSound").addEventListener("click", (e) => {
      v.muted = !v.muted;
      e.currentTarget.setAttribute("aria-pressed", String(!v.muted));
      e.currentTarget.setAttribute("aria-label", v.muted ? "Unmute" : "Mute");
    });
    document.addEventListener("keydown", (e) => {
      if ($("#viewer").hidden) return;
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "Tab") trapTab(e, $("#viewer"));
    });
  }

  /* ---------------- reset + boot ---------------- */
  function resetDemo() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    Object.keys(blobs).forEach((k) => { URL.revokeObjectURL(blobs[k]); delete blobs[k]; });
    S = fresh();
    save();
    resetForm();
    showForm();
    updateCounts(false);
    renderQueue(false);
    setView("upload");
    toast(`Demo reset: ${count("pending")} clips waiting for review`);
  }

  async function init() {
    seed = await loadSeed();
    S = load();
    wireSwitcher();
    wireUpload();
    wireQueue();
    wireViewer();
    $("#resetBtn").addEventListener("click", resetDemo);
    updateCounts(false);
    setView(S.view || "upload", { animate: false });
    if (document.fonts) document.fonts.ready.then(() => placePill(false));
    window.addEventListener("resize", () => placePill(false));
    // Keep two open tabs in sync (e.g. creator view in one, merchant in another).
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      const view = S.view;
      S = load();
      S.view = view; // each tab keeps its own view
      updateCounts(true);
      if (S.view === "queue") renderQueue(false);
      if (S.view === "wall") renderWall(false);
    });
    if (!reduced()) gsap.from(".appbar", { y: -20, opacity: 0, duration: 0.6, ease: "power3.out", clearProps: "transform,opacity" });
  }

  init().catch((err) => {
    console.error(err);
    $("#views").innerHTML = `<p>Seed data could not load. Run <code>npx serve</code>, or regenerate data/seed.js with <code>node tools/sync-data.mjs</code>.</p>`;
  });
})();
