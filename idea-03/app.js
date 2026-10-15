/* ==========================================================================
   Aureline · Scroll-story sections pack
   Lenis smooth scroll + GSAP ScrollTrigger. Content comes from data/page.json
   (file:// falls back to the generated data/page.js mirror).

   Every section is a { render, init } pair in the registry below. render()
   returns markup from the section's JSON block; init() wires its motion and
   returns an optional cleanup. That split maps 1:1 to a Shopify section:
   Liquid markup + a JS custom element reading data-settings.
   ========================================================================== */
(() => {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isNarrow = () => matchMedia("(max-width: 900px)").matches;

  const opts = {
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    speed: 1,
  };

  let data;
  let ctx;
  let lenis = null;
  let lenisTick = null;
  let cleanups = [];
  let bag = 0;
  let currentSection = 0;

  async function loadData() {
    const mirror = () => window.__PROTO_DATA__ && window.__PROTO_DATA__.page;
    if (location.protocol === "file:" && mirror()) return mirror();
    try {
      const res = await fetch("data/page.json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      if (mirror()) return mirror();
      throw err;
    }
  }

  const Sections = {};

  /* ==========================================================================
     01 · Hero text-mask reveal
     Settings: parallax (0–0.4, image drift as a share of its height),
               introDuration (seconds), imageStartScale (load zoom, 1–1.4)
     Content:  lines[] (each line is masked separately), body, image, imageAlt
     ========================================================================== */
  Sections.hero = {
    render(s, i) {
      return `
        <section class="hero" id="${s.id}" data-section="${i}" aria-labelledby="h-${s.id}">
          <div class="hero__media"><img src="${s.image}" alt="${esc(s.imageAlt)}" fetchpriority="high" decoding="async"></div>
          <div class="hero__content">
            <h1 class="hero__title" id="h-${s.id}">
              ${s.lines.map((l) => `<span class="hero__line"><span>${esc(l)}</span></span>`).join("")}
            </h1>
            <div class="hero__foot">
              <p class="hero__body">${esc(s.body)}</p>
              <span class="hero__cue" aria-hidden="true"><i></i>Scroll</span>
            </div>
          </div>
        </section>`;
    },
    init(root, s, o) {
      const S = s.settings;
      const img = $(".hero__media img", root);
      const lines = $$(".hero__line > span", root);
      const content = $(".hero__content", root);
      if (o.reduced) {
        gsap.from(content, { opacity: 0, duration: 0.6 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(img, { scale: S.imageStartScale }, { scale: 1, duration: S.introDuration * 1.5, ease: "power2.out" }, 0)
        .fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: S.introDuration * 0.8, stagger: 0.13, ease: "power4.out" }, 0.15)
        .from($$(".hero__foot > *", root), { opacity: 0, y: 16, duration: 0.8, stagger: 0.1 }, 0.75)
        .from(".topbar", { opacity: 0, duration: 0.8 }, 0.5);

      const scrub = { trigger: root, start: "top top", end: "bottom top", scrub: true };
      gsap.to($(".hero__media", root), { yPercent: S.parallax * 100, ease: "none", scrollTrigger: scrub });
      gsap.to(content, { yPercent: -28, opacity: 0.15, ease: "none", scrollTrigger: { ...scrub } });
    },
  };

  /* ==========================================================================
     02 · Pinned product story
     Settings: transition ("wipe" clip-path or "fade"), pinOnMobile
     Content:  heading, steps[] { title, body, image, alt }
     The image column pins while the steps scroll; each step wipes in its image
     and the progress line is scrubbed by the steps' scroll progress.
     ========================================================================== */
  Sections["pinned-story"] = {
    render(s, i) {
      const n = s.steps.length;
      return `
        <section class="story" id="${s.id}" data-section="${i}" aria-labelledby="h-${s.id}">
          <div class="story__media">
            <div class="story__frame">
              ${s.steps.map((st, k) => `<img class="story__img${k === 0 ? " is-first" : ""}" src="${st.image}" alt="${esc(st.alt)}" ${k ? 'loading="lazy"' : ""} decoding="async">`).join("")}
            </div>
            <div class="story__progress" aria-hidden="true">
              <span class="story__count"><b class="story__cur">01</b>/ ${pad(n)}</span>
              <span class="story__track"><span class="story__fill"></span></span>
            </div>
          </div>
          <div class="story__steps">
            <h2 class="story__heading" id="h-${s.id}">${esc(s.heading)}</h2>
            ${s.steps
              .map(
                (st, k) => `
              <article class="step">
                <h3 class="step__title"><em>Step ${k + 1} of ${n}</em>${esc(st.title)}</h3>
                <p class="step__body">${esc(st.body)}</p>
              </article>`
              )
              .join("")}
          </div>
        </section>`;
    },
    init(root, s, o) {
      const media = $(".story__media", root);
      const stepsEl = $(".story__steps", root);
      const imgs = $$(".story__img", root);
      const steps = $$(".step", root);
      const fill = $(".story__fill", root);
      const cur = $(".story__cur", root);
      const narrow = isNarrow();
      let active = 0;
      let z = 1;

      gsap.set(steps, { opacity: (k) => (o.reduced || k === 0 ? 1 : 0.25) });

      const show = (k) => {
        if (k === active) return;
        const dir = k > active ? 1 : -1;
        active = k;
        cur.textContent = pad(k + 1);
        const img = imgs[k];
        gsap.set(img, { zIndex: ++z });
        if (o.reduced || s.settings.transition === "fade") {
          gsap.fromTo(img, { opacity: 0, clipPath: "inset(0% 0% 0% 0%)" }, { opacity: 1, duration: o.reduced ? 0.3 : 0.8 });
        } else {
          gsap.fromTo(
            img,
            { clipPath: dir > 0 ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)", scale: 1.12 },
            { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.05, ease: "power3.inOut", overwrite: true }
          );
        }
        if (!o.reduced) {
          steps.forEach((st, j) => gsap.to(st, { opacity: j === k ? 1 : 0.25, duration: 0.5, overwrite: true }));
          gsap.fromTo(cur, { yPercent: dir * 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4 });
        }
      };

      if (!o.reduced && (!narrow || s.settings.pinOnMobile)) {
        ScrollTrigger.create({ trigger: media, start: "top top", endTrigger: stepsEl, end: "bottom bottom", pin: true, pinSpacing: false });
      }
      const line = narrow ? "78%" : "55%";
      steps.forEach((st, k) =>
        ScrollTrigger.create({
          trigger: st,
          start: `top ${line}`,
          end: `bottom ${line}`,
          onToggle: (self) => self.isActive && show(k),
        })
      );
      if (!o.reduced) {
        gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: stepsEl, start: `top ${line}`, end: "bottom bottom", scrub: true } });
      } else {
        gsap.set(fill, { scaleY: 1 });
      }
    },
  };

  /* ==========================================================================
     03 · Horizontal collection rail
     Settings: depthScale (max shrink away from centre), depthRotate (degrees),
               scrubSmoothing (seconds of catch-up)
     Content:  heading, intro, products[] { title, kind, notes, price, image }
     Vertical scroll drives the pinned track sideways; cards scale and turn
     slightly with their distance from the viewport centre.
     ========================================================================== */
  Sections["collection-rail"] = {
    render(s, i) {
      return `
        <section class="rail" id="${s.id}" data-section="${i}" aria-labelledby="h-${s.id}">
          <div class="rail__head">
            <h2 class="rail__heading" id="h-${s.id}">${esc(s.heading)}</h2>
            <p class="rail__intro">${esc(s.intro)}</p>
          </div>
          <div class="rail__viewport">
            <ul class="rail__track" role="list">
              ${s.products
                .map(
                  (p) => `
                <li class="pcard">
                  <div class="pcard__img"><img src="${p.image}" alt="${esc(p.title)}, ${esc(p.kind)}" loading="lazy" decoding="async"></div>
                  <div class="pcard__meta">
                    <h3 class="pcard__title">${esc(p.title)}</h3>
                    <span class="pcard__price">${data.brand.currency}${p.price}</span>
                    <p class="pcard__kind">${esc(p.kind)}</p>
                    <p class="pcard__notes">${esc(p.notes)}</p>
                    <button class="pcard__add" type="button" data-title="${esc(p.title)}">Add to bag</button>
                  </div>
                </li>`
                )
                .join("")}
            </ul>
          </div>
        </section>`;
    },
    init(root, s, o) {
      if (o.reduced) return;
      const S = s.settings;
      const track = $(".rail__track", root);
      const cards = $$(".pcard", root);
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const depth = () => {
        const vw = window.innerWidth;
        cards.forEach((c) => {
          const r = c.getBoundingClientRect();
          const d = (r.left + r.width / 2 - vw / 2) / vw;
          const ad = Math.min(1, Math.abs(d));
          gsap.set(c, {
            scale: 1 - ad * S.depthScale * 1.4,
            rotationY: -d * S.depthRotate * 2,
            rotation: d * S.depthRotate * 0.35,
            transformPerspective: 1100,
          });
        });
      };
      gsap.to(track, {
        x: () => -dist(),
        ease: "none",
        onUpdate: depth,
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: () => `+=${dist()}`,
          pin: true,
          scrub: S.scrubSmoothing,
          invalidateOnRefresh: true,
          onRefresh: depth,
        },
      });
      depth();
    },
  };

  /* ==========================================================================
     04 · Marquee proof bar
     Settings: baseSpeed (px per second), velocityBoost (speed gained per px/s
               of scroll velocity), maxBoost (cap)
     Content:  press[] (invented publications), reviews[]
     Two rows run in opposite directions. Scroll velocity speeds them up, and
     scrolling up reverses both, then they settle back to cruise speed.
     ========================================================================== */
  Sections.marquee = {
    render(s, i) {
      const row = (items, cls) => {
        const copy = [...items, ...items].map((t) => `<span class="marquee__item">${esc(t)}</span>`).join("");
        return `<div class="marquee ${cls}" aria-hidden="true"><div class="marquee__track">${copy}${copy}</div></div>`;
      };
      return `
        <section class="proof" id="${s.id}" data-section="${i}" aria-label="Press and reviews">
          ${row(s.press, "marquee--press")}
          ${row(s.reviews, "marquee--reviews")}
          <ul class="visually-hidden">
            ${s.press.map((t) => `<li>Featured in ${esc(t)}</li>`).join("")}
            ${s.reviews.map((t) => `<li>${esc(t)}</li>`).join("")}
          </ul>
        </section>`;
    },
    init(root, s, o) {
      if (o.reduced) return;
      const S = s.settings;
      const tracks = $$(".marquee__track", root);
      const loops = tracks.map((t, k) => {
        const duration = t.scrollWidth / 2 / S.baseSpeed;
        return k === 0
          ? gsap.fromTo(t, { xPercent: 0 }, { xPercent: -50, duration, ease: "none", repeat: -1 })
          : gsap.fromTo(t, { xPercent: -50 }, { xPercent: 0, duration, ease: "none", repeat: -1 });
      });

      let target = 1;
      let current = 1;
      let dir = 1;
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          dir = self.direction || dir;
          const boost = gsap.utils.clamp(1, S.maxBoost, 1 + Math.abs(self.getVelocity()) * S.velocityBoost);
          target = boost * dir;
        },
      });
      const tick = () => {
        target += (dir - target) * 0.04; // decay back to cruise speed
        current += (target - current) * 0.12;
        loops.forEach((l) => l.timeScale(current));
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
  };

  /* ==========================================================================
     05 · Split-image reveal
     Settings: travel (scroll length multiplier), scrubSmoothing
     Content:  image, imageAlt, statement, points[]
     The image is two clip-path halves. Scrubbed by scroll, they part like
     curtains to reveal the benefit statement behind them.
     ========================================================================== */
  Sections["split-reveal"] = {
    render(s, i) {
      return `
        <section class="split" id="${s.id}" data-section="${i}" aria-labelledby="h-${s.id}">
          <div class="split__statement">
            <h2 id="h-${s.id}">${esc(s.statement)}</h2>
            <ul class="split__points">${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          </div>
          <div class="split__half split__half--l"><img src="${s.image}" alt="${esc(s.imageAlt)}" loading="lazy" decoding="async"></div>
          <div class="split__half split__half--r" aria-hidden="true"><img src="${s.image}" alt="" loading="lazy" decoding="async"></div>
          <span class="split__seam" aria-hidden="true"></span>
        </section>`;
    },
    init(root, s, o) {
      const S = s.settings;
      const statement = $(".split__statement h2", root);
      const points = $$(".split__points li", root);
      if (o.reduced) {
        gsap.from([statement, ...points], { opacity: 0, duration: 0.6, stagger: 0.06, scrollTrigger: { trigger: root, start: "top 70%" } });
        return;
      }
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root, start: "top top", end: () => `+=${window.innerHeight * 1.4 * S.travel}`, pin: true, scrub: S.scrubSmoothing, invalidateOnRefresh: true },
      });
      tl.fromTo($(".split__seam", root), { scaleY: 0 }, { scaleY: 1, duration: 0.15 })
        .to($(".split__seam", root), { opacity: 0, duration: 0.05 })
        .to($(".split__half--l", root), { xPercent: -52, duration: 1, ease: "power2.inOut" }, 0.15)
        .to($(".split__half--r", root), { xPercent: 52, duration: 1, ease: "power2.inOut" }, 0.15)
        .fromTo(statement, { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "power2.out" }, 0.4)
        .fromTo(points, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.08 }, 0.85)
        .to({}, { duration: 0.35 });
    },
  };

  /* ==========================================================================
     06 · Sticky stacking cards
     Settings: scaleStep (how far each buried card shrinks), offset (px each
               card's sticky top steps down, so edges stay visible)
     Content:  heading, cards[] { name, origin, body, image }
     Cards are CSS-sticky; ScrollTrigger scrubs each one back (scale + shade)
     as the cards after it arrive on top.
     ========================================================================== */
  Sections["stacking-cards"] = {
    render(s, i) {
      return `
        <section class="ingredients" id="${s.id}" data-section="${i}" aria-labelledby="h-${s.id}">
          <h2 class="ingredients__heading" id="h-${s.id}">${esc(s.heading)}</h2>
          <div class="icards" style="--offset:${s.settings.offset}px">
            ${s.cards
              .map(
                (c, k) => `
              <article class="icard" style="--i:${k}">
                <div class="icard__img"><img src="${c.image}" alt="${esc(c.name)}" loading="lazy" decoding="async"></div>
                <div class="icard__body">
                  <p class="icard__origin">${esc(c.origin)}</p>
                  <h3 class="icard__name">${esc(c.name)}</h3>
                  <p class="icard__text">${esc(c.body)}</p>
                </div>
                <span class="icard__shade" aria-hidden="true"></span>
              </article>`
              )
              .join("")}
          </div>
        </section>`;
    },
    init(root, s, o) {
      if (o.reduced) return;
      const cards = $$(".icard", root);
      const n = cards.length;
      const last = cards[n - 1];
      const topOf = (c) => parseFloat(getComputedStyle(c).top) || 0;
      cards.forEach((card, k) => {
        gsap.fromTo($(".icard__img img", card), { scale: 1.18 }, { scale: 1, ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: () => `top ${topOf(card)}px`, scrub: true } });
        if (k === n - 1) return;
        const st = { trigger: cards[k + 1], start: "top bottom", endTrigger: last, end: () => `top ${topOf(last)}px`, scrub: true, invalidateOnRefresh: true };
        gsap.to(card, { scale: 1 - s.settings.scaleStep * (n - 1 - k), ease: "none", scrollTrigger: st });
        gsap.to($(".icard__shade", card), { opacity: 0.1 + 0.07 * (n - 2 - k), ease: "none", scrollTrigger: { ...st } });
      });
    },
  };

  /* ==========================================================================
     Page chrome: side label, top bar, bag, anchors
     ========================================================================== */
  const DARK = new Set(["hero", "split-reveal"]);

  function setLabel(i) {
    if (i === currentSection) return;
    const dir = i > currentSection ? 1 : -1;
    currentSection = i;
    const s = data.sections[i];
    const num = $("#labelNum");
    const name = $("#labelName");
    $(".sectionlabel").classList.toggle("is-light", DARK.has(s.type));
    if (opts.reduced) {
      num.textContent = pad(i + 1);
      name.textContent = s.label;
      return;
    }
    gsap.to([num, name], {
      yPercent: -100 * dir, opacity: 0, duration: 0.18, ease: "power2.in",
      onComplete: () => {
        num.textContent = pad(i + 1);
        name.textContent = s.label;
        gsap.fromTo([num, name], { yPercent: 100 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3, ease: "power3.out" });
      },
    });
  }

  function initChrome() {
    data.sections.forEach((s, i) => {
      ScrollTrigger.create({
        trigger: `[data-section="${i}"]`,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => self.isActive && setLabel(i),
      });
    });
    gsap.fromTo("#labelBar", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: true } });
    ScrollTrigger.create({
      trigger: ".hero",
      start: "bottom 70px",
      onEnter: () => $(".topbar").classList.add("is-solid"),
      onLeaveBack: () => $(".topbar").classList.remove("is-solid"),
    });
  }

  function wireStatic() {
    document.addEventListener("click", (e) => {
      const add = e.target.closest(".pcard__add");
      if (add && !add.classList.contains("is-added")) {
        bag += 1;
        $("#bagCount").textContent = bag;
        $("#bagBtn").setAttribute("aria-label", `Bag, ${bag} item${bag === 1 ? "" : "s"}`);
        add.classList.add("is-added");
        add.textContent = "Added to bag";
        $("#liveRegion").textContent = `${add.dataset.title} added to bag`;
        if (!opts.reduced) gsap.fromTo("#bagBtn", { scale: 1 }, { scale: 1.12, yoyo: true, repeat: 1, duration: 0.16 });
      }
      const link = e.target.closest('a[href^="#"]');
      if (link && link.getAttribute("href").length > 1) {
        const target = $(link.getAttribute("href"));
        if (target) {
          e.preventDefault();
          if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
          else target.scrollIntoView({ behavior: opts.reduced ? "auto" : "smooth" });
        }
      }
    });
  }

  /* ==========================================================================
     Start / restart (the Tweak panel can rebuild everything live)
     ========================================================================== */
  function start() {
    document.documentElement.classList.toggle("is-reduced", opts.reduced);
    gsap.globalTimeline.timeScale(opts.speed);
    if (!opts.reduced && window.Lenis) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      lenisTick = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);
    }
    ctx = gsap.context(() => {
      data.sections.forEach((s, i) => {
        const root = $(`[data-section="${i}"]`);
        const cleanup = Sections[s.type].init(root, s, opts);
        if (typeof cleanup === "function") cleanups.push(cleanup);
      });
      initChrome();
    });
    ScrollTrigger.refresh();
  }

  function stop() {
    cleanups.forEach((f) => f());
    cleanups = [];
    ctx?.revert();
    if (lenis) {
      gsap.ticker.remove(lenisTick);
      lenis.destroy();
      lenis = null;
    }
  }

  function restart() {
    const keep = currentSection;
    stop();
    start();
    const target = $(`[data-section="${keep}"]`);
    if (target && keep > 0) {
      requestAnimationFrame(() => {
        const y = target.getBoundingClientRect().top + window.scrollY;
        if (lenis) lenis.scrollTo(y, { immediate: true });
        else window.scrollTo(0, y);
        ScrollTrigger.update();
      });
    }
  }

  /* ---------------- Tweak panel ---------------- */
  const ACCENTS = [
    { name: "Bronze", hex: "#a88452" },
    { name: "Olive", hex: "#6f7146" },
    { name: "Rosewood", hex: "#9a5a54" },
    { name: "Slate blue", hex: "#4a5d78" },
  ];

  function initTweak() {
    const btn = $("#tweakBtn");
    const panel = $("#tweakPanel");
    const sw = $("#accentSwatches");
    sw.innerHTML = ACCENTS.map(
      (a, i) => `<label class="tweak__swatch" title="${a.name}"><input type="radio" name="accent" value="${a.hex}" ${i === 0 ? "checked" : ""} aria-label="${a.name}"><span style="--c:${a.hex}"></span></label>`
    ).join("");
    sw.addEventListener("change", (e) => {
      document.documentElement.style.setProperty("--accent", e.target.value);
    });

    const range = $("#speedRange");
    const out = $("#speedOut");
    range.addEventListener("input", () => {
      opts.speed = +range.value;
      out.textContent = `${opts.speed.toFixed(1)}×`;
      gsap.globalTimeline.timeScale(opts.speed);
    });

    const motion = $("#motionToggle");
    motion.checked = opts.reduced;
    motion.addEventListener("change", () => {
      opts.reduced = motion.checked;
      restart();
      $("#liveRegion").textContent = opts.reduced ? "Reduced motion on" : "Reduced motion off";
    });

    const open = (on) => {
      btn.setAttribute("aria-expanded", String(on));
      if (on) {
        panel.hidden = false;
        if (!opts.reduced) gsap.fromTo(panel, { opacity: 0, scale: 0.92, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.8)" });
        $("input", panel).focus();
      } else if (!panel.hidden) {
        gsap.to(panel, { opacity: 0, scale: 0.96, duration: opts.reduced ? 0 : 0.15, onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: "all" }); } });
      }
    };
    btn.addEventListener("click", () => open(btn.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
        open(false);
        btn.focus();
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (btn.getAttribute("aria-expanded") === "true" && !e.target.closest("#tweak")) open(false);
    });
  }

  /* ---------------- boot ---------------- */
  async function init() {
    data = await loadData();
    $("#sections").innerHTML = data.sections.map((s, i) => Sections[s.type].render(s, i)).join("");
    $("#labelName").textContent = data.sections[0].label;
    $(".sectionlabel").classList.add("is-light");
    $(".sectionlabel__num").lastChild.textContent = ` / ${pad(data.sections.length)}`;
    wireStatic();
    initTweak();
    start();
    window.addEventListener("load", () => ScrollTrigger.refresh());
    let w = window.innerWidth;
    window.addEventListener("resize", () => {
      // Narrow/wide switches the story layout, so rebuild rather than just refresh.
      if ((w <= 900) !== (window.innerWidth <= 900)) restart();
      w = window.innerWidth;
    });
  }

  init().catch((err) => {
    console.error(err);
    $("#sections").innerHTML = `<p style="padding:120px 24px">Content could not load. Run <code>npx serve</code>, or regenerate data/page.js with <code>node tools/sync-data.mjs</code>.</p>`;
  });
})();
