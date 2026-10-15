/* ==========================================================================
   Fieldnote Active · Hyper Card prototype
   Rendering + interaction only. All product content comes from data/products.json
   (file:// falls back to the generated data/products.js mirror).
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(Flip);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mqMobile = matchMedia("(max-width: 767px)");
  const mqHover = matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = () => mqReduced.matches;
  const isMobile = () => mqMobile.matches;

  const TAB_ORDER = ["features", "reviews", "options"];

  const el = {
    page: $("#page"),
    grid: $("#grid"),
    title: $("#collectionTitle"),
    intro: $("#collectionIntro"),
    count: $("#productCount"),
    sort: $("#sortSelect"),
    cartBtn: $("#cartBtn"),
    cartCount: $("#cartCount"),
    stage: $("#stage"),
    stageTitle: $("#stageTitle"),
    backdrop: $(".stage__backdrop"),
    stack: $("#stack"),
    sheetBg: $(".sheet-bg"),
    player: $("#player"),
    video: $("#playerVideo"),
    expand: $("#playerExpand"),
    creator: $("#playerCreator"),
    sound: $("#soundBtn"),
    progress: $("#playerProgress"),
    tabs: $("#tabs"),
    tabBtns: $$(".tab"),
    indicator: $("#tabIndicator"),
    panel: $("#panel"),
    panelScroll: $("#panelScroll"),
    close: $("#closeBtn"),
    live: $("#liveRegion"),
    topbar: $(".topbar"),
  };

  const state = {
    shop: null,
    products: [],
    order: [],
    cart: 0,
    mode: "closed", // closed | player | panel
    tab: null,
    product: null,
    trigger: null,
    busy: false,
    picks: {}, // productId -> { color, size, wished }
  };

  /* ---------------- helpers ---------------- */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${state.shop.currency}${n}`;
  const announce = (msg) => {
    el.live.textContent = "";
    requestAnimationFrame(() => (el.live.textContent = msg));
  };
  const pick = (p) => (state.picks[p.id] ||= { color: 0, size: p.sizes.find((s) => s.available)?.label, wished: false });

  /** Wrap `phrase` inside `text` with a highlight mark (first occurrence, case-sensitive then -insensitive). */
  function withMark(text, phrase) {
    if (!phrase) return esc(text);
    let i = text.indexOf(phrase);
    if (i < 0) i = text.toLowerCase().indexOf(phrase.toLowerCase());
    if (i < 0) return esc(text);
    return `${esc(text.slice(0, i))}<mark class="mark">${esc(text.slice(i, i + phrase.length))}</mark>${esc(text.slice(i + phrase.length))}`;
  }

  /** Split a quote into word groups for the staggered reveal. The highlight keeps its own groups inside one <mark>. */
  function wordGroups(text, phrase, size = 2) {
    const groupWords = (str) => {
      // Groups are inline-blocks joined by real spaces, so lines still break (and trim) naturally.
      const words = str.trim().split(/\s+/).filter(Boolean);
      const out = [];
      for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(" "));
      const lead = /^\s/.test(str) ? " " : "";
      const trail = /\s$/.test(str) ? " " : "";
      return lead + out.map((g) => `<span class="wg">${esc(g)}</span>`).join(" ") + trail;
    };
    let i = phrase ? text.indexOf(phrase) : -1;
    if (i < 0) return groupWords(text);
    // Glue touching punctuation (". , !") into the highlight so it never wraps onto its own line.
    const tail = text.slice(i + phrase.length).match(/^[^\s]*/)[0];
    phrase += tail;
    return (
      groupWords(text.slice(0, i)) +
      `<mark class="mark">${groupWords(text.slice(i, i + phrase.length))}</mark>` +
      groupWords(text.slice(i + phrase.length))
    );
  }

  function stars(rating, count) {
    return `<span class="stars" role="img" aria-label="Rated ${rating} out of 5 from ${count} reviews"><span class="stars__base" aria-hidden="true">★★★★★</span><span class="stars__fill" aria-hidden="true" style="width:${(rating / 5) * 100}%">★★★★★</span></span><span aria-hidden="true">${rating} · ${count}</span>`;
  }

  /* ---------------- data ---------------- */
  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.products;
    // Browsers block fetch() on file://, so use the generated mirror there.
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

  /* ==========================================================================
     Collection grid
     ========================================================================== */
  function cardMarkup(p) {
    const c = p.colors[0];
    return `
      <li class="card" data-id="${p.id}">
        <div class="card__media">
          <img class="card__img" src="${c.image}" alt="${esc(p.title)} in ${esc(c.name)}" loading="lazy" decoding="async" width="900" height="1125">
          <button class="chip" type="button" aria-haspopup="dialog" aria-label="Play ${esc(p.video.creator)}'s clip: ${esc(p.title)}, ${esc(p.badge)}">
            <span class="chip__thumb">
              <video muted loop playsinline preload="metadata" poster="${p.video.poster}" src="${p.video.src}" tabindex="-1" aria-hidden="true"></video>
            </span>
            <span class="chip__label"><span class="chip__text">${esc(p.badge)}</span><span class="chip__more"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1 9 5 2 9Z" fill="currentColor"/></svg>Watch</span></span>
          </button>
        </div>
        <div class="card__info">
          <div class="card__row">
            <h2 class="card__title">${esc(p.title)}</h2>
            <span class="card__price">${money(p.price)}</span>
          </div>
          <div class="card__meta">${stars(p.rating, p.ratingCount)}</div>
          <div class="card__swatches" role="radiogroup" aria-label="${esc(p.title)} colour">
            ${p.colors
              .map(
                (col, i) =>
                  `<button class="mini-swatch" type="button" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(col.name)}" data-color="${i}" style="--c:${col.hex}"><span></span></button>`
              )
              .join("")}
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
      const product = state.products.find((p) => p.id === card.dataset.id);
      wireCard(card, product);
    });
    observeChipVideos();
  }

  /** Measure how much of the label pill to clip so only the badge text shows at rest. */
  const chipClip = (label) => {
    const text = $(".chip__text", label);
    return Math.max(0, label.offsetWidth - (text.offsetLeft + text.offsetWidth) - 13);
  };
  function measureChipLabels() {
    $$(".chip__label", el.grid).forEach((label) => label.style.setProperty("--more", `${chipClip(label)}px`));
  }

  function wireCard(card, product) {
    const chip = $(".chip", card);
    const thumb = $(".chip__thumb", card);
    const video = $("video", thumb);
    const label = $(".chip__label", card);
    const img = () => $(".card__img:last-of-type", card);

    // Hover: spring scale, autoplay, pill expands, tilt toward cursor, image zoom.
    let hovering = false;
    const tiltX = gsap.quickTo(thumb, "rotationX", { duration: 0.3, ease: "power2.out" });
    const tiltY = gsap.quickTo(thumb, "rotationY", { duration: 0.3, ease: "power2.out" });
    gsap.set(thumb, { transformPerspective: 380 });

    const enter = () => {
      if (hovering || state.mode !== "closed") return;
      hovering = true;
      video.play().catch(() => {});
      if (reduced()) {
        gsap.to(label, { "--more": "0px", duration: 0.15 });
        return;
      }
      gsap.to(chip, { scale: 1.1, duration: 0.24, ease: "back.out(3)", overwrite: "auto" });
      gsap.to(label, { "--more": "0px", duration: 0.24, ease: "power3.out" });
      gsap.to(img(), { scale: 1.02, duration: 0.22, ease: "power2.out" });
    };
    const leave = () => {
      if (!hovering) return;
      hovering = false;
      if (state.mode === "closed") video.pause();
      const more = chipClip(label);
      gsap.to(chip, { scale: 1, duration: 0.3, ease: "power3.out", overwrite: "auto" });
      gsap.to(label, { "--more": `${more}px`, duration: 0.22, ease: "power2.inOut" });
      gsap.to(img(), { scale: 1, duration: 0.3, ease: "power2.out" });
      tiltX(0);
      tiltY(0);
    };

    if (mqHover.matches) {
      chip.addEventListener("pointerenter", enter);
      chip.addEventListener("pointerleave", leave);
      chip.addEventListener("pointermove", (e) => {
        if (reduced() || !hovering) return;
        const r = chip.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        tiltY(gsap.utils.clamp(-4, 4, nx * 8));
        tiltX(gsap.utils.clamp(-4, 4, -ny * 8));
      });
    }
    chip.addEventListener("focus", () => chip.matches(":focus-visible") && enter());
    chip.addEventListener("blur", leave);
    chip.addEventListener("click", () => {
      hovering = false;
      openStage(product, chip);
    });

    // Card swatches crossfade the card image and pre-select the colour in Options.
    const group = $(".card__swatches", card);
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".mini-swatch");
      if (btn) setCardColor(card, product, +btn.dataset.color, true);
    });
    group.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
      e.preventDefault();
      const cur = pick(product).color;
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      const next = (cur + dir + product.colors.length) % product.colors.length;
      setCardColor(card, product, next, true);
      $$(".mini-swatch", group)[next].focus();
    });
  }

  function crossfadeImage(container, currentImg, src, alt, extraClass) {
    if (currentImg && currentImg.getAttribute("src") === src) return currentImg;
    const next = new Image();
    next.className = extraClass;
    next.alt = alt;
    next.decoding = "async";
    next.src = src;
    next.style.opacity = 0;
    if (currentImg) currentImg.after(next);
    else container.prepend(next);
    const reveal = () =>
      gsap.to(next, {
        opacity: 1,
        duration: reduced() ? 0.2 : 0.45,
        ease: "power2.out",
        onComplete: () => {
          $$(`.${extraClass.split(" ")[0]}`, container).forEach((n) => n !== next && n.remove());
        },
      });
    next.complete ? reveal() : next.addEventListener("load", reveal, { once: true });
    return next;
  }

  function setCardColor(card, product, index, announceIt) {
    pick(product).color = index;
    const col = product.colors[index];
    const media = $(".card__media", card);
    const current = $(".card__img:last-of-type", card);
    const next = crossfadeImage(media, current, col.image, `${product.title} in ${col.name}`, "card__img");
    next.style.transform = "";
    $$(".mini-swatch", card).forEach((b, i) => {
      b.setAttribute("aria-checked", String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
    if (announceIt) announce(`${product.title}: ${col.name}`);
  }

  /** Only play chip thumbnails that are on screen (touch devices preview them inline). */
  let chipObserver;
  function observeChipVideos() {
    chipObserver?.disconnect();
    chipObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const v = entry.target;
          if (!entry.isIntersecting) v.pause();
          else if (!mqHover.matches && !reduced() && state.mode === "closed") v.play().catch(() => {});
        }
      },
      { threshold: 0.4 }
    );
    $$(".chip__thumb video", el.grid).forEach((v) => chipObserver.observe(v));
  }

  /* ---------------- sort (Flip reorder) ---------------- */
  function sortProducts(mode) {
    const list = [...state.order];
    if (mode === "price-asc") list.sort((a, b) => a.price - b.price);
    if (mode === "price-desc") list.sort((a, b) => b.price - a.price);
    if (mode === "rating") list.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
    const cards = $$(".card", el.grid);
    const flipState = Flip.getState(cards);
    list.forEach((p) => el.grid.appendChild(cards.find((c) => c.dataset.id === p.id)));
    if (reduced()) {
      gsap.fromTo(cards, { opacity: 0.4 }, { opacity: 1, duration: 0.25 });
    } else {
      Flip.from(flipState, { duration: 0.7, ease: "power3.inOut", stagger: 0.025 });
    }
    announce(`Sorted: ${el.sort.selectedOptions[0].textContent}`);
  }

  /* ==========================================================================
     Stage: open / close
     ========================================================================== */
  function setStageInert(on) {
    el.page.inert = on;
    el.topbar.inert = on;
    document.documentElement.classList.toggle("is-locked", on);
    document.body.classList.toggle("has-stage", on);
  }

  function pageOrigin() {
    const r = el.page.getBoundingClientRect();
    return `50% ${window.innerHeight / 2 - r.top}px`;
  }

  function openStage(product, chip) {
    if (state.mode !== "closed" || state.busy) return;
    state.busy = true;
    state.product = product;
    state.trigger = chip;
    state.tab = null;

    const thumb = $(".chip__thumb", chip);
    const chipVideo = $("video", thumb);

    // Player content
    el.stageTitle.textContent = `${product.title}, filmed by ${product.video.creator}`;
    el.creator.textContent = `Filmed by ${product.video.creator}`;
    if (el.video.getAttribute("src") !== product.video.src) {
      el.video.src = product.video.src;
      el.video.poster = product.video.poster;
    }
    el.video.muted = true;
    syncSound();
    const startAt = chipVideo.currentTime || 0;
    const seek = () => {
      try { el.video.currentTime = startAt; } catch (e) { /* metadata not ready */ }
    };
    el.video.readyState >= 1 ? seek() : el.video.addEventListener("loadedmetadata", seek, { once: true });
    el.video.play().catch(() => {});

    resetTabs();
    el.panel.classList.remove("is-visible");
    el.panelScroll.innerHTML = "";
    el.stage.classList.remove("is-panel");
    gsap.set([el.player, el.tabs, el.close, el.stack, el.sheetBg], { clearProps: "transform,opacity,visibility" });

    // Capture the chip before anything moves (Flip matches it to the player by data-flip-id).
    thumb.setAttribute("data-flip-id", "ugc");
    const from = Flip.getState(thumb);
    gsap.killTweensOf(chip);
    gsap.set(chip, { scale: 1 });

    el.stage.hidden = false;
    setStageInert(true);
    state.mode = "player";
    thumb.style.visibility = "hidden";
    chipVideo.pause();

    gsap.set(el.tabBtns, { opacity: 0 });
    gsap.set(el.close, { opacity: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        state.busy = false;
        revealTabs();
      },
    });

    if (reduced()) {
      tl.fromTo(el.backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25 })
        .fromTo([el.player, el.sheetBg], { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0)
        .to(el.close, { opacity: 1, duration: 0.2 }, 0);
    } else {
      el.page.style.transformOrigin = pageOrigin();
      tl.fromTo(el.backdrop, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, 0)
        .to(el.page, { scale: 0.985, duration: 0.55, ease: "power3.inOut" }, 0)
        .add(
          Flip.from(from, {
            targets: el.player,
            duration: 0.55,
            ease: "power3.inOut",
            scale: true,
          }),
          0
        )
        .to(el.close, { opacity: 1, duration: 0.3 }, 0.35);
      if (isMobile()) {
        tl.fromTo(el.sheetBg, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: "power3.out" }, 0);
      }
    }
    el.close.focus({ preventScroll: true });
  }

  function revealTabs() {
    if (state.mode === "closed") return;
    if (reduced()) {
      gsap.to(el.tabBtns, { opacity: 1, duration: 0.2 });
      return;
    }
    const fromVars = isMobile() ? { y: 26, opacity: 0 } : { x: -70, opacity: 0 };
    gsap.fromTo(el.tabBtns, fromVars, {
      x: 0,
      y: 0,
      opacity: 1,
      duration: 0.5,
      ease: "back.out(1.9)",
      stagger: 0.06,
    });
  }

  function closeStage({ fromDrag = false } = {}) {
    if (state.mode === "closed" || state.busy) return;
    state.busy = true;
    const chip = state.trigger;
    const thumb = $(".chip__thumb", chip);
    const chipVideo = $("video", thumb);
    const wasPanel = state.mode === "panel";

    const finish = () => {
      el.video.pause();
      try { chipVideo.currentTime = el.video.currentTime || 0; } catch (e) { /* ignore */ }
      thumb.style.visibility = "";
      thumb.removeAttribute("data-flip-id");
      el.stage.hidden = true;
      el.stage.classList.remove("is-panel");
      el.panel.classList.remove("is-visible");
      gsap.set([el.player, el.tabs, el.tabBtns, el.close, el.stack, el.sheetBg, el.page, el.indicator, el.panel], {
        clearProps: "transform,opacity,clipPath,visibility",
      });
      setStageInert(false);
      state.mode = "closed";
      state.busy = false;
      state.tab = null;
      chip.focus({ preventScroll: true });
    };

    if (reduced()) {
      gsap.to([el.backdrop, el.stack], { opacity: 0, duration: 0.2, onComplete: finish });
      return;
    }

    const tl = gsap.timeline({ onComplete: finish });
    tl.to([el.tabBtns, el.close, el.indicator], { opacity: 0, duration: 0.18 }, 0);
    if (wasPanel) {
      tl.to(el.panel, { clipPath: isMobile() ? "inset(0% 100% 0% 0%)" : "inset(0% 100% 0% 0% round 22px)", duration: 0.32, ease: "power2.in" }, 0);
    }
    if (isMobile()) {
      tl.to(el.sheetBg, { yPercent: 100, duration: 0.45, ease: "power3.in" }, 0.05);
    }

    // Measure the chip at its resting (unscaled) position, then animate back into it.
    gsap.set(el.page, { scale: 1 });
    const fit = Flip.fit(el.player, thumb, { scale: true, duration: 0.5, ease: "power3.inOut" });
    if (!fromDrag) gsap.set(el.page, { scale: 0.985 });
    tl.add(fit, wasPanel ? 0.12 : 0.05);
    if (!fromDrag) tl.to(el.page, { scale: 1, duration: 0.5, ease: "power3.inOut" }, 0.05);
    tl.to(el.backdrop, { opacity: 0, duration: 0.45, ease: "power2.inOut" }, 0.1);
  }

  /* ==========================================================================
     Tabs + panel modes
     ========================================================================== */
  function resetTabs() {
    el.tabBtns.forEach((b, i) => {
      b.setAttribute("aria-selected", "false");
      b.tabIndex = i === 0 ? 0 : -1;
    });
    gsap.set(el.indicator, { opacity: 0 });
    el.panel.removeAttribute("aria-labelledby");
  }

  function markTab(name) {
    el.tabBtns.forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    el.panel.setAttribute("aria-labelledby", `tab-${name}`);
  }

  function moveIndicator(name, instant) {
    const btn = el.tabBtns.find((b) => b.dataset.tab === name);
    const mobile = isMobile();
    const x = mobile ? btn.offsetLeft - 5 : 12;
    const y = mobile ? 0 : btn.offsetTop;
    const wasHidden = gsap.getProperty(el.indicator, "opacity") < 0.5;
    if (instant || wasHidden || reduced()) {
      gsap.set(el.indicator, { x, y });
      gsap.to(el.indicator, { opacity: 1, duration: 0.2 });
    } else {
      gsap.to(el.indicator, { x, y, opacity: 1, duration: 0.42, ease: "power3.inOut" });
    }
    if (!mobile) {
      el.tabBtns.forEach((b) => gsap.to(b, { x: b === btn ? 12 : 0, duration: 0.35, ease: "power3.out" }));
    }
  }

  function selectTab(name) {
    if (state.busy || state.mode === "closed") return;
    if (state.mode === "player") return enterPanel(name);
    if (state.tab === name) return;
    switchTab(name);
  }

  function enterPanel(name) {
    state.busy = true;
    state.tab = name;
    markTab(name);
    renderPanel(name);

    const flipState = Flip.getState([el.player, el.tabs, el.close]);
    el.stage.classList.add("is-panel");
    el.panel.classList.add("is-visible");
    state.mode = "panel";
    el.expand.tabIndex = 0;
    moveIndicator(name, true);

    const content = el.panelScroll.firstElementChild;
    const done = () => {
      state.busy = false;
    };

    if (reduced()) {
      gsap.set(el.panel, { clipPath: "inset(0% 0% 0% 0% round 22px)" });
      gsap.fromTo(el.panel, { opacity: 0 }, { opacity: 1, duration: 0.25, onComplete: done });
      animatePanel(name, content);
      return;
    }

    const radius = isMobile() ? "" : " round 22px";
    const tl = gsap.timeline({ onComplete: done });
    tl.add(Flip.from(flipState, { duration: 0.6, ease: "power3.inOut", scale: true }), 0);
    tl.fromTo(
      el.panel,
      { clipPath: `inset(0% 100% 0% 0%${radius})` },
      { clipPath: `inset(0% 0% 0% 0%${radius})`, duration: 0.65, ease: "power3.inOut" },
      0.05
    );
    tl.add(() => animatePanel(name, content), 0.3);
  }

  function exitPanel() {
    if (state.busy || state.mode !== "panel") return;
    state.busy = true;
    const flipState = Flip.getState([el.player, el.tabs, el.close]);
    el.stage.classList.remove("is-panel");
    state.mode = "player";
    state.tab = null;
    el.expand.tabIndex = -1;
    resetTabs();
    gsap.to(el.tabBtns, { x: 0, duration: 0.3 });

    const finish = () => {
      el.panel.classList.remove("is-visible");
      el.panelScroll.innerHTML = "";
      state.busy = false;
      el.sound.focus({ preventScroll: true });
    };
    if (reduced()) {
      gsap.to(el.panel, { opacity: 0, duration: 0.2, onComplete: () => { gsap.set(el.panel, { clearProps: "opacity" }); finish(); } });
      return;
    }
    const radius = isMobile() ? "" : " round 22px";
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(el.panel, { clipPath: `inset(0% 100% 0% 0%${radius})`, duration: 0.45, ease: "power3.inOut" }, 0);
    tl.add(Flip.from(flipState, { duration: 0.6, ease: "power3.inOut", scale: true }), 0);
  }

  function switchTab(name) {
    state.busy = true;
    const dir = TAB_ORDER.indexOf(name) > TAB_ORDER.indexOf(state.tab) ? 1 : -1;
    state.tab = name;
    markTab(name);
    moveIndicator(name);
    const old = el.panelScroll.firstElementChild;
    const axis = isMobile() ? "x" : "y";
    const dist = 42;

    const swapIn = () => {
      renderPanel(name);
      el.panelScroll.scrollTop = 0;
      const content = el.panelScroll.firstElementChild;
      if (reduced()) {
        gsap.fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      } else {
        gsap.fromTo(content, { [axis]: dir * dist, opacity: 0 }, { [axis]: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
      }
      animatePanel(name, content);
      state.busy = false;
    };
    if (!old) return swapIn();
    if (reduced()) {
      gsap.to(old, { opacity: 0, duration: 0.15, onComplete: swapIn });
    } else {
      gsap.to(old, { [axis]: -dir * dist, opacity: 0, duration: 0.22, ease: "power2.in", onComplete: swapIn });
    }
  }

  /* ---------------- panel renderers ---------------- */
  function renderPanel(name) {
    const p = state.product;
    const html = { features: featuresMarkup, reviews: reviewsMarkup, options: optionsMarkup }[name](p);
    el.panelScroll.innerHTML = html;
    if (name === "options") wireOptions(p);
  }

  function secondaryImage(p) {
    const sel = pick(p).color;
    return p.colors[(sel + 1) % p.colors.length];
  }

  function featuresMarkup(p) {
    const alt = secondaryImage(p);
    return `
      <div class="pc pc--features">
        <p class="panel-kicker">What ${esc(p.video.creator.split(" ")[0])} noticed first</p>
        <ol class="feats">
          ${p.features
            .map(
              (f, i) => `
            <li class="feat${i === 0 ? " lead" : ""}">
              <span class="badge" aria-hidden="true">${i + 1}</span>
              <div>
                <h3 class="feat__title">${esc(f.title)}</h3>
                <p class="feat__body">${withMark(f.body, f.highlight)}</p>
              </div>
            </li>`
            )
            .join("")}
        </ol>
        <figure class="float-img"><img src="${alt.image}" alt="${esc(p.title)} in ${esc(alt.name)}" decoding="async"></figure>
      </div>`;
  }

  function reviewsMarkup(p) {
    return `
      <div class="pc pc--reviews">
        <p class="rev-summary"><strong>${p.rating}</strong> from ${p.ratingCount} reviews</p>
        <ol class="revs">
          ${p.reviews
            .map(
              (r, i) => `
            <li class="rev${i === 0 ? " lead" : ""}">
              <span class="badge" aria-hidden="true">${i + 1}</span>
              <div>
                <blockquote class="rev__quote">${wordGroups(r.quote, r.highlight, i === 0 ? 2 : 3)}</blockquote>
                <p class="rev__by">${esc(r.author)}</p>
                <p class="rev__help"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1 9.5 9h-9z" fill="currentColor"/></svg><span class="count" data-to="${r.helpful}">${r.helpful}</span> found this helpful</p>
              </div>
            </li>`
            )
            .join("")}
        </ol>
      </div>`;
  }

  function optionsMarkup(p) {
    const sel = pick(p);
    const col = p.colors[sel.color];
    return `
      <div class="pc pc--options">
        <div class="opt__top">
          <div class="opt__media"><img class="opt__img" src="${col.image}" alt="${esc(p.title)} in ${esc(col.name)}" decoding="async"></div>
          <div class="opt__summary">
            <h3 class="opt__title">${esc(p.title)}</h3>
            <p class="opt__price">${money(p.price)}<span class="opt__stock">In stock</span></p>
          </div>
        </div>

        <fieldset class="opt__group">
          <legend>Colour: <b class="opt__colorname">${esc(col.name)}</b></legend>
          <div class="choice-row choice-row--colors" data-group="color">
            ${p.colors
              .map(
                (c, i) => `
              <label class="choice choice--color">
                <input type="radio" name="color-${p.id}" value="${i}" ${i === sel.color ? "checked" : ""}>
                <span class="choice__dot" style="--c:${c.hex}" aria-hidden="true"></span>${esc(c.name)}
              </label>`
              )
              .join("")}
            <span class="choice-ring" aria-hidden="true"></span>
          </div>
        </fieldset>

        <fieldset class="opt__group">
          <legend>Size: <b class="opt__sizename">${esc(sel.size || "Choose a size")}</b></legend>
          <div class="choice-row choice-row--sizes" data-group="size">
            ${p.sizes
              .map(
                (s) => `
              <label class="choice choice--size${s.available ? "" : " is-out"}">
                <input type="radio" name="size-${p.id}" value="${s.label}" ${s.label === sel.size ? "checked" : ""} ${s.available ? "" : "disabled"} aria-label="${s.label}${s.available ? "" : ", sold out"}">
                <span aria-hidden="true">${s.label}</span>
              </label>`
              )
              .join("")}
            <span class="choice-ring" aria-hidden="true"></span>
          </div>
        </fieldset>

        <div class="opt__actions">
          <button class="atc" type="button" data-state="idle">
            <span class="atc__label">Add to cart · ${money(p.price)}</span>
            <span class="atc__spinner" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="40 100" stroke-linecap="round"/></svg></span>
            <span class="atc__done" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Added</span>
          </button>
          <button class="wish" type="button" aria-pressed="${sel.wished}" aria-label="Save ${esc(p.title)} to wishlist">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path class="heart-fill" d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" ${sel.wished ? 'style="transform:scale(1)"' : ""}/>
            </svg>
            ${'<span class="burst"></span>'.repeat(8)}
          </button>
        </div>
        <p class="opt__note">Free returns within 30 days. Ships in 2 to 4 days.</p>
      </div>`;
  }

  /* ---------------- panel animations ---------------- */
  function sweep(marks, delay = 0) {
    if (!marks.length) return;
    if (reduced()) {
      gsap.set(marks, { backgroundSize: "100% 100%" });
      return;
    }
    gsap.fromTo(marks, { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", duration: 0.7, ease: "power2.inOut", delay, stagger: 0.18 });
  }

  let parallaxOff = null;
  function animatePanel(name, root) {
    parallaxOff?.();
    parallaxOff = null;
    if (!root) return;
    const R = reduced();

    if (name === "features") {
      const badges = $$(".badge", root);
      const items = $$(".feat", root);
      const img = $(".float-img", root);
      if (R) {
        sweep($$(".mark", root));
        return;
      }
      gsap.fromTo(items, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.08 });
      gsap.fromTo(badges, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.6)", stagger: 0.09, delay: 0.05 });
      sweep($$(".mark", root), 0.35);
      gsap.fromTo(img, { y: 50, opacity: 0, rotation: 9 }, { y: 0, opacity: 1, rotation: 4, duration: 0.8, ease: "power3.out", delay: 0.2 });
      if (mqHover.matches) {
        const px = gsap.quickTo(img, "x", { duration: 0.6, ease: "power3.out" });
        const py = gsap.quickTo(img, "y", { duration: 0.6, ease: "power3.out" });
        const pr = gsap.quickTo(img, "rotation", { duration: 0.6, ease: "power3.out" });
        const move = (e) => {
          const r = el.panel.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          px(nx * -16);
          py(ny * -12);
          pr(4 + nx * 3);
        };
        el.panel.addEventListener("pointermove", move);
        parallaxOff = () => el.panel.removeEventListener("pointermove", move);
      }
    }

    if (name === "reviews") {
      const counts = $$(".count", root);
      if (R) {
        sweep($$(".mark", root));
        return;
      }
      $$(".rev", root).forEach((rev, i) => {
        const groups = $$(".wg", rev);
        const at = i * 0.22;
        gsap.fromTo($(".badge", rev), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.6)", delay: at });
        gsap.fromTo(groups, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.035, delay: at + 0.05 });
        gsap.fromTo($$(".rev__by, .rev__help", rev), { opacity: 0 }, { opacity: 1, duration: 0.4, delay: at + 0.3 });
        sweep($$(".mark", rev), at + 0.25 + groups.length * 0.035);
      });
      counts.forEach((c, i) => {
        const obj = { v: 0 };
        c.textContent = "0";
        gsap.to(obj, {
          v: +c.dataset.to,
          duration: 1.2,
          ease: "power2.out",
          delay: 0.35 + i * 0.22,
          onUpdate: () => (c.textContent = Math.round(obj.v)),
        });
      });
    }

    if (name === "options") {
      $$(".choice-row", root).forEach((row) => placeRing(row, true));
      if (R) return;
      gsap.fromTo($(".opt__media", root), { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "power3.out" });
      gsap.fromTo($$(".opt__summary, .opt__group, .opt__actions, .opt__note", root), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.07, delay: 0.1 });
      gsap.fromTo($$(".choice.is-out", root), { "--strike": 0 }, { "--strike": 1, duration: 0.5, ease: "power2.out", delay: 0.45, stagger: 0.08 });
    }
  }

  /** Selection ring glides to the checked choice. */
  function placeRing(row, instant) {
    const ring = $(".choice-ring", row);
    const checked = $("input:checked", row);
    if (!ring) return;
    if (!checked) {
      gsap.set(ring, { opacity: 0 });
      return;
    }
    const label = checked.closest(".choice");
    const vars = { x: label.offsetLeft, y: label.offsetTop, width: label.offsetWidth, height: label.offsetHeight };
    gsap.set(ring, { width: vars.width, height: vars.height });
    if (instant || reduced()) gsap.set(ring, { x: vars.x, y: vars.y, opacity: 1 });
    else gsap.to(ring, { x: vars.x, y: vars.y, opacity: 1, duration: 0.42, ease: "back.out(1.4)" });
  }

  function wireOptions(p) {
    const root = el.panelScroll;
    const sel = pick(p);
    const colorRow = $('[data-group="color"]', root);
    const sizeRow = $('[data-group="size"]', root);

    colorRow.addEventListener("change", (e) => {
      const idx = +e.target.value;
      sel.color = idx;
      const col = p.colors[idx];
      placeRing(colorRow);
      const name = $(".opt__colorname", root);
      const media = $(".opt__media", root);
      crossfadeImage(media, $(".opt__img:last-of-type", media), col.image, `${p.title} in ${col.name}`, "opt__img");
      if (reduced()) name.textContent = col.name;
      else
        gsap.to(name, {
          opacity: 0, y: -6, duration: 0.15,
          onComplete: () => {
            name.textContent = col.name;
            gsap.fromTo(name, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25 });
          },
        });
      // Keep the grid card in sync with the choice.
      const card = el.grid.querySelector(`.card[data-id="${p.id}"]`);
      if (card) setCardColor(card, p, idx, false);
    });

    sizeRow.addEventListener("change", (e) => {
      sel.size = e.target.value;
      $(".opt__sizename", root).textContent = sel.size;
      placeRing(sizeRow);
    });

    const atc = $(".atc", root);
    atc.addEventListener("click", () => addToCart(p, atc));

    const wish = $(".wish", root);
    wish.addEventListener("click", () => toggleWish(p, wish));
  }

  /* ---------------- add to cart state machine ---------------- */
  function addToCart(p, btn) {
    if (btn.dataset.state !== "idle") return;
    const sel = pick(p);
    const label = $(".atc__label", btn);
    const spin = $(".atc__spinner", btn);
    const done = $(".atc__done", btn);
    const check = $("path", done);
    const R = reduced();
    btn.dataset.state = "loading";
    btn.setAttribute("aria-busy", "true");

    const tl = gsap.timeline();
    tl.to(label, { y: R ? 0 : -14, opacity: 0, duration: 0.18 })
      .to(spin, { opacity: 1, duration: 0.15 }, "<0.05")
      .to($("svg", spin), { rotation: 360 * 2, duration: 0.8, ease: "none", transformOrigin: "50% 50%" }, "<")
      .add(() => {
        btn.dataset.state = "done";
        state.cart += 1;
        updateCart(true);
        announce(`Added ${p.title}, ${p.colors[sel.color].name}, size ${sel.size} to cart`);
      })
      .to(spin, { opacity: 0, duration: 0.12 })
      .fromTo(done, { opacity: 0, scale: R ? 1 : 0.7 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2.4)" }, "<")
      .fromTo(check, { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: R ? 0.01 : 0.35, ease: "power2.out" }, "<0.05")
      .to(done, { opacity: 0, duration: 0.2 }, "+=1.1")
      .fromTo(label, { y: R ? 0 : 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25 }, "<0.1")
      .add(() => {
        btn.dataset.state = "idle";
        btn.removeAttribute("aria-busy");
        gsap.set($("svg", spin), { rotation: 0 });
      });
  }

  function updateCart(bump) {
    el.cartCount.textContent = state.cart;
    el.cartBtn.setAttribute("aria-label", `Cart, ${state.cart} item${state.cart === 1 ? "" : "s"}`);
    if (bump && !reduced()) {
      gsap.fromTo(el.cartCount, { scale: 1 }, { scale: 1.5, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1 });
      gsap.fromTo(el.cartBtn, { rotation: 0 }, { rotation: -10, duration: 0.09, yoyo: true, repeat: 3, ease: "sine.inOut" });
    }
  }

  function toggleWish(p, btn) {
    const sel = pick(p);
    sel.wished = !sel.wished;
    btn.setAttribute("aria-pressed", String(sel.wished));
    const fill = $(".heart-fill", btn);
    announce(sel.wished ? `Saved ${p.title} to wishlist` : `Removed ${p.title} from wishlist`);
    if (reduced()) {
      gsap.set(fill, { scale: sel.wished ? 1 : 0 });
      return;
    }
    if (!sel.wished) {
      gsap.to(fill, { scale: 0, duration: 0.2, ease: "power2.in" });
      return;
    }
    gsap.fromTo(fill, { scale: 0 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.1, 0.45)" });
    gsap.fromTo($("svg", btn), { scale: 0.8 }, { scale: 1, duration: 0.45, ease: "back.out(3)" });
    $$(".burst", btn).forEach((dot, i) => {
      const a = (i / 8) * Math.PI * 2;
      gsap.fromTo(
        dot,
        { x: 0, y: 0, scale: 1, opacity: 1 },
        { x: Math.cos(a) * 24, y: Math.sin(a) * 24, scale: 0, opacity: 0, duration: 0.55, ease: "power2.out" }
      );
    });
  }

  /* ---------------- player ---------------- */
  function syncSound() {
    const on = !el.video.muted;
    el.sound.setAttribute("aria-pressed", String(on));
    el.sound.setAttribute("aria-label", on ? "Mute video" : "Unmute video");
  }

  gsap.ticker.add(() => {
    if (state.mode === "closed" || !el.video.duration) return;
    el.progress.style.transform = `scaleX(${el.video.currentTime / el.video.duration})`;
  });

  /* ---------------- focus trap + keys ---------------- */
  function focusables() {
    return $$(
      'button:not([disabled]), [href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
      el.stage
    ).filter((n) => {
      if (n.tabIndex < 0) return false;
      if (n.type === "radio" && !n.checked && $(`input[name="${n.name}"]:checked`, el.stage)) return false;
      const cs = getComputedStyle(n);
      return n.getClientRects().length && cs.visibility !== "hidden" && cs.pointerEvents !== "none";
    });
  }

  document.addEventListener("keydown", (e) => {
    if (state.mode === "closed") return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeStage();
      return;
    }
    if (e.key === "Tab") {
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (!el.stage.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  el.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    btn.focus({ preventScroll: true });
    selectTab(btn.dataset.tab);
  });
  el.tabs.addEventListener("keydown", (e) => {
    const keys = isMobile() ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    if (![...keys, "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = el.tabBtns.indexOf(document.activeElement);
    let n = i;
    if (e.key === keys[0]) n = (i - 1 + 3) % 3;
    if (e.key === keys[1]) n = (i + 1) % 3;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = 2;
    el.tabBtns[n].focus();
    selectTab(el.tabBtns[n].dataset.tab);
  });

  el.stage.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeStage();
  });
  el.expand.addEventListener("click", exitPanel);
  el.sound.addEventListener("click", () => {
    el.video.muted = !el.video.muted;
    if (!el.video.muted) el.video.play().catch(() => {});
    syncSound();
  });

  /* ---------------- mobile: swipe the sheet down ---------------- */
  function initSheetDrag() {
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let dy = 0;
    let dragging = false;

    const down = (e) => {
      if (!isMobile() || state.busy || state.mode === "closed") return;
      if (e.currentTarget === el.player && state.mode !== "player") return;
      if (e.target.closest("button") && e.target !== el.expand) return;
      dragging = true;
      startY = lastY = e.clientY;
      lastT = performance.now();
      velocity = 0;
      dy = 0;
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!dragging) return;
      const now = performance.now();
      velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
      dy = Math.max(0, e.clientY - startY);
      gsap.set(el.stack, { y: dy });
      gsap.set(el.backdrop, { opacity: 1 - Math.min(0.8, dy / 500) });
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (dy > 130 || velocity > 0.7) {
        closeStage({ fromDrag: true });
      } else {
        gsap.to(el.stack, { y: 0, duration: 0.45, ease: "back.out(1.5)" });
        gsap.to(el.backdrop, { opacity: 1, duration: 0.3 });
      }
    };
    [el.sheetBg, el.player].forEach((zone) => {
      zone.addEventListener("pointerdown", down);
      zone.addEventListener("pointermove", move);
      zone.addEventListener("pointerup", up);
      zone.addEventListener("pointercancel", up);
    });
  }

  /* ---------------- boot ---------------- */
  async function init() {
    const data = await loadData();
    state.shop = data.shop;
    state.products = data.products;
    state.order = [...data.products];
    renderGrid();
    updateCart(false);
    initSheetDrag();

    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(measureChipLabels);
    window.addEventListener("resize", () => {
      measureChipLabels();
      if (state.mode === "panel" && state.tab) {
        moveIndicator(state.tab, true);
        if (state.tab === "options") $$(".choice-row", el.panelScroll).forEach((r) => placeRing(r, true));
      }
    });
    mqMobile.addEventListener("change", () => state.mode !== "closed" && !state.busy && closeStage());

    el.sort.addEventListener("change", () => sortProducts(el.sort.value));

    // One orchestrated entrance: title, then the cards rise in sequence.
    if (!reduced()) {
      gsap.from(".intro__title", { yPercent: 30, opacity: 0, duration: 0.9, ease: "power3.out" });
      gsap.from(".intro__lede, .intro__tools", { opacity: 0, y: 12, duration: 0.7, delay: 0.2, ease: "power2.out" });
      gsap.from(".card", { y: 40, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.07, delay: 0.25, clearProps: "transform,opacity" });
    }
  }

  init().catch((err) => {
    console.error(err);
    el.grid.innerHTML = `<li class="load-error">Products could not load. Run <code>npx serve</code> in this folder, or regenerate data/products.js with <code>node tools/sync-data.mjs</code>.</li>`;
  });
})();
