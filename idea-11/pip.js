/* ==========================================================================
   Pip: the shopping companion character (presentation + motion only).
   Page code (app.js) decides WHAT Pip does; this file knows HOW:
   moods, walking, jumping with squash/stretch, speech, a billboard,
   hearts/confetti/tears, docking and following the scroll.

   Pip lives in page coordinates (position: absolute), so when it sits on a
   button it scrolls with that button. Coordinates are the point between
   its feet.
   ========================================================================== */
window.Pip = (() => {
  "use strict";

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = () => matchMedia("(max-width: 640px)").matches;
  const CANCEL = Symbol("pip-cancel");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const SVG = `
  <svg class="pip__svg" viewBox="-40 -66 80 72" aria-hidden="true">
    <ellipse class="pip-shadow" cx="0" cy="1" rx="15" ry="3.2"/>
    <g class="pip-rig">
      <g class="pip-legs">
        <path class="pip-legL" d="M-7 -9 L-7 -1"/>
        <path class="pip-legR" d="M7 -9 L7 -1"/>
      </g>
      <g class="pip-breathe">
        <path class="pip-armL" d="M-17 -24 Q-25 -20 -26 -13"/>
        <path class="pip-armR" d="M17 -24 Q25 -20 26 -13"/>
        <g class="pip-sprout">
          <path class="pip-stem" d="M0 -46 Q1.5 -52 -1 -56"/>
          <path class="pip-leaf" d="M-1 -55 C-9 -63 -15 -56 -9.5 -52 C-6 -50 -2.5 -52 -1 -55Z"/>
        </g>
        <path class="pip-body" d="M0 -48 C14 -48 22 -36 22 -24 C22 -11 13 -6 0 -6 C-13 -6 -22 -11 -22 -24 C-22 -36 -14 -48 0 -48Z"/>
        <ellipse class="pip-belly" cx="0" cy="-15" rx="12" ry="7.5"/>
        <g class="pip-face">
          <g class="pip-eyes">
            <g class="pip-eye pip-eyeL"><ellipse cx="-8" cy="-29" rx="4.6" ry="5.6" fill="#fff"/><g class="pip-pupil"><circle cx="-8" cy="-28.5" r="2.7"/><circle class="pip-shine" cx="-7" cy="-30" r=".9"/></g></g>
            <g class="pip-eye pip-eyeR"><ellipse cx="8" cy="-29" rx="4.6" ry="5.6" fill="#fff"/><g class="pip-pupil"><circle cx="8" cy="-28.5" r="2.7"/><circle class="pip-shine" cx="9" cy="-30" r=".9"/></g></g>
          </g>
          <g class="pip-happyeyes"><path d="M-12 -28 Q-8 -33.5 -4 -28"/><path d="M4 -28 Q8 -33.5 12 -28"/></g>
          <g class="pip-brows"><path class="pip-browL" d="M-12 -37 L-4 -37"/><path class="pip-browR" d="M4 -37 L12 -37"/></g>
          <ellipse class="pip-cheek" cx="-14.5" cy="-21" rx="3.4" ry="2"/>
          <ellipse class="pip-cheek" cx="14.5" cy="-21" rx="3.4" ry="2"/>
          <path class="pip-mouth" d="M-4 -19 Q0 -16 4 -19"/>
          <path class="pip-tear pip-tearL" d="M-9 -23 q-2.2 4 0 5.2 q2.2 -1.2 0 -5.2z"/>
          <path class="pip-tear pip-tearR" d="M9 -23 q-2.2 4 0 5.2 q2.2 -1.2 0 -5.2z"/>
        </g>
      </g>
    </g>
  </svg>`;

  const MOUTH = {
    smile: { d: "M-4 -19 Q0 -16 4 -19", fill: false },
    happy: { d: "M-6 -20.5 Q0 -11 6 -20.5 Z", fill: true },
    ecstatic: { d: "M-7.5 -21.5 Q0 -8 7.5 -21.5 Z", fill: true },
    sad: { d: "M-4.5 -15.5 Q0 -19.5 4.5 -15.5", fill: false },
    worried: { d: "M-5 -17 Q-2.5 -19 0 -17 Q2.5 -15 5 -17", fill: false },
    o: { d: "M-2.6 -17.5 a2.6 3.2 0 1 0 5.2 0 a2.6 3.2 0 1 0 -5.2 0", fill: true },
    smirk: { d: "M-4 -18 Q1 -16.5 5 -20.5", fill: false },
    flat: { d: "M-3 -18 L3 -18", fill: false },
  };
  const BROWS = {
    sad: ["M-12 -35 L-4 -38.5", "M4 -38.5 L12 -35"],
    worried: ["M-12 -35.5 L-4 -38", "M4 -38 L12 -35.5"],
    sneaky: ["M-12 -38 L-4 -35.5", "M4 -35.5 L12 -38"],
  };
  const MOODS = {
    idle: { eyes: "open", mouth: "smile", cheeks: 0.45 },
    curious: { eyes: "open", mouth: "o", cheeks: 0.3 },
    sneaky: { eyes: "half", mouth: "smirk", brows: "sneaky", cheeks: 0.25 },
    happy: { eyes: "happy", mouth: "happy", cheeks: 0.85 },
    ecstatic: { eyes: "happy", mouth: "ecstatic", cheeks: 1 },
    worried: { eyes: "open", mouth: "worried", brows: "worried", cheeks: 0.15 },
    sad: { eyes: "open", mouth: "sad", brows: "sad", cheeks: 0, tears: true, droop: true },
    sleepy: { eyes: "closed", mouth: "flat", cheeks: 0.3 },
  };

  let layer, el, flip, bubble, board, sticks, $;
  const S = { mood: "idle", docked: false, enabled: true, moving: false, token: 0, facing: 1, sitting: false };
  const loops = {};
  let motion = null; // current timeline
  let bubbleTimer = 0;
  let hooks = {};

  /* ---------------- position helpers ---------------- */
  const pos = () => ({ x: gsap.getProperty(el, "x"), y: gsap.getProperty(el, "y") });
  function place(x, y) { gsap.set(el, { x, y }); }
  function placeViewport(vx, vy) { place(vx + scrollX, vy + scrollY); }
  function dockPoint() {
    return { x: narrow() ? 38 : 58, y: scrollY + innerHeight - (narrow() ? 10 : 18) };
  }
  /** Top edge of an element, at a given horizontal fraction, in page coords. */
  function perch(target, fx = 0.85, inset = 0) {
    const r = target.getBoundingClientRect();
    return { x: r.left + scrollX + r.width * fx, y: r.top + scrollY + inset };
  }
  const inView = (y, pad = 0) => y > scrollY - pad && y < scrollY + innerHeight + pad;

  function face(dx) {
    if (Math.abs(dx) < 4) return;
    const f = dx > 0 ? 1 : -1;
    if (f === S.facing) return;
    S.facing = f;
    gsap.to(flip, { scaleX: f, duration: reduced() ? 0 : 0.15 });
  }

  /* ---------------- motion primitives ---------------- */
  function interrupt() {
    motion?.kill();
    motion = null;
    gsap.killTweensOf(el);
    stopWalk();
    S.moving = false;
    gsap.to($(".pip-rig"), { scaleX: 1, scaleY: 1, rotation: 0, y: 0, duration: 0.2, svgOrigin: "0 0" });
    if (!board.classList.contains("is-up")) gsap.to([$(".pip-armL"), $(".pip-armR")], { rotation: 0, duration: 0.2 });
    if (S.sitting) stand();
  }

  function teleport(x, y) {
    return new Promise((res) => {
      gsap.timeline({ onComplete: res }).to(el, { opacity: 0, duration: 0.12 }).set(el, { x, y }).to(el, { opacity: 1, duration: 0.18 });
    });
  }

  function startWalk(sneaky) {
    stopWalk();
    const amp = sneaky ? 30 : 22;
    const dur = sneaky ? 0.32 : 0.16;
    loops.walk = gsap.timeline({ repeat: -1 })
      .to($(".pip-legL"), { rotation: amp, duration: dur, ease: "sine.inOut", svgOrigin: "-7 -9" }, 0)
      .to($(".pip-legR"), { rotation: -amp, duration: dur, ease: "sine.inOut", svgOrigin: "7 -9" }, 0)
      .to($(".pip-legL"), { rotation: -amp, duration: dur, ease: "sine.inOut" }, dur)
      .to($(".pip-legR"), { rotation: amp, duration: dur, ease: "sine.inOut" }, dur);
    loops.bob = gsap.to($(".pip-rig"), { y: sneaky ? -3 : -2.2, rotation: sneaky ? -9 : -3, duration: dur, yoyo: true, repeat: -1, ease: "sine.inOut", svgOrigin: "0 0" });
  }
  function stopWalk() {
    loops.walk?.kill();
    loops.bob?.kill();
    if (!$) return;
    gsap.to([$(".pip-legL"), $(".pip-legR")], { rotation: 0, duration: 0.15 });
    gsap.to($(".pip-rig"), { y: 0, rotation: 0, duration: 0.15, svgOrigin: "0 0" });
  }

  function walkTo(x, y, o = {}) {
    return new Promise((res) => {
      S.docked = false;
      const p = pos();
      face(x - p.x);
      const dist = Math.hypot(x - p.x, y - p.y);
      if (reduced()) return teleport(x, y).then(res);
      if (dist < 3) return res();
      S.moving = true;
      startWalk(o.sneaky);
      const d = Math.max(0.3, dist / (o.speed || (o.sneaky ? 70 : 210)));
      motion = gsap.to(el, { x, y, duration: d, ease: o.sneaky ? "none" : "power1.inOut", onComplete: () => { stopWalk(); S.moving = false; res(); } });
    });
  }

  function jumpTo(x, y, o = {}) {
    return new Promise((res) => {
      S.docked = false;
      const p = pos();
      face(x - p.x);
      if (reduced()) return teleport(x, y).then(res);
      const rig = $(".pip-rig");
      const dist = Math.hypot(x - p.x, y - p.y);
      const d = Math.min(1.05, 0.42 + dist / 1500);
      const peak = Math.min(p.y, y) - (o.height ?? Math.min(150, 46 + dist * 0.16));
      S.moving = true;
      motion = gsap.timeline({ onComplete: () => { S.moving = false; res(); } })
        .to(rig, { scaleY: 0.76, scaleX: 1.16, duration: 0.1, ease: "power2.out", svgOrigin: "0 0" })
        .addLabel("air")
        .to(rig, { scaleY: 1.14, scaleX: 0.88, duration: 0.14, ease: "power2.out", svgOrigin: "0 0" }, "air")
        .to($(".pip-armL"), { rotation: 70, duration: 0.15, svgOrigin: "-17 -24" }, "air")
        .to($(".pip-armR"), { rotation: -70, duration: 0.15, svgOrigin: "17 -24" }, "air")
        .to(el, { x, duration: d, ease: "none" }, "air")
        .to(el, { y: peak, duration: d / 2, ease: "power2.out" }, "air")
        .to(el, { y, duration: d / 2, ease: "power2.in" }, `air+=${d / 2}`)
        .to(rig, { scaleY: 1, scaleX: 1, duration: d * 0.4, svgOrigin: "0 0" }, "air+=0.16")
        .addLabel("land", `air+=${d}`)
        .to(rig, { scaleY: 0.78, scaleX: 1.2, duration: 0.08, ease: "power2.out", svgOrigin: "0 0" }, "land")
        .to([$(".pip-armL"), $(".pip-armR")], { rotation: 0, duration: 0.25 }, "land")
        .to(rig, { scaleY: 1, scaleX: 1, duration: 0.55, ease: "elastic.out(1.2, 0.4)", svgOrigin: "0 0" }, "land+=0.08");
    });
  }

  function hop(n = 2, h = 16) {
    if (reduced()) return Promise.resolve();
    return new Promise((res) => {
      const rig = $(".pip-rig");
      motion = gsap.timeline({ onComplete: res });
      for (let i = 0; i < n; i++) {
        motion.to(rig, { scaleY: 0.82, scaleX: 1.12, duration: 0.07, svgOrigin: "0 0" })
          .to(rig, { y: -h, scaleY: 1.1, scaleX: 0.92, duration: 0.16, ease: "power2.out", svgOrigin: "0 0" })
          .to(rig, { y: 0, scaleY: 1, scaleX: 1, duration: 0.14, ease: "power2.in", svgOrigin: "0 0" });
      }
      motion.to(rig, { scaleY: 0.85, scaleX: 1.1, duration: 0.06, svgOrigin: "0 0" }).to(rig, { scaleY: 1, scaleX: 1, duration: 0.3, ease: "elastic.out(1, 0.5)", svgOrigin: "0 0" });
    });
  }

  function dock(how = "jump", o = {}) {
    const d = dockPoint();
    const p = pos();
    const go = how === "walk" || Math.abs(d.y - p.y) < 24 ? walkTo(d.x, d.y, o) : jumpTo(d.x, d.y, o);
    return go.then(() => { S.docked = true; });
  }

  /** Enter from below the viewport edge into the dock. */
  function enterFromBelow() {
    const d = dockPoint();
    place(d.x, scrollY + innerHeight + 70);
    return jumpTo(d.x, d.y, { height: 40 }).then(() => { S.docked = true; });
  }

  /* ---------------- gestures ---------------- */
  const arm = (side, rotation, duration = 0.25, ease = "power2.out") =>
    gsap.to($(side === "L" ? ".pip-armL" : ".pip-armR"), { rotation, duration, ease, svgOrigin: side === "L" ? "-17 -24" : "17 -24" });

  function wave() {
    if (reduced()) return Promise.resolve();
    return new Promise((res) => {
      gsap.timeline({ onComplete: res })
        .to($(".pip-armR"), { rotation: -140, duration: 0.18, svgOrigin: "17 -24" })
        .to($(".pip-armR"), { rotation: -100, duration: 0.14, yoyo: true, repeat: 3, ease: "sine.inOut", svgOrigin: "17 -24" })
        .to($(".pip-armR"), { rotation: 0, duration: 0.25, svgOrigin: "17 -24" });
    });
  }
  /** Point: "down" (at what Pip stands on), "side" (ahead), "up". */
  function point(dir = "down") {
    const r = { down: 20, side: -40, up: -150 }[dir];
    arm("R", r, 0.25, "back.out(2)");
    if (!reduced()) gsap.fromTo($(".pip-armR"), { rotation: r - 12 }, { rotation: r, duration: 0.3, repeat: 3, yoyo: true, ease: "sine.inOut", delay: 0.25, svgOrigin: "17 -24" });
  }
  function armsDown() { arm("L", 0); arm("R", 0); }

  function sit() {
    S.sitting = true;
    gsap.to($(".pip-legs"), { scaleY: 0.35, duration: 0.3, svgOrigin: "0 -9" });
    gsap.to($(".pip-breathe"), { y: 5.5, duration: 0.3 });
  }
  function stand() {
    S.sitting = false;
    gsap.to($(".pip-legs"), { scaleY: 1, duration: 0.25, svgOrigin: "0 -9" });
    gsap.to($(".pip-breathe"), { y: 0, duration: 0.25 });
  }

  /* ---------------- moods ---------------- */
  function mood(name) {
    const m = MOODS[name] || MOODS.idle;
    S.mood = name;
    el.dataset.mood = name;
    const R = reduced();
    const eyes = $(".pip-eyes");
    const happyEyes = $(".pip-happyeyes");
    const showHappy = m.eyes === "happy";
    gsap.set(happyEyes, { opacity: showHappy ? 1 : 0 });
    gsap.set(eyes, { opacity: showHappy ? 0 : 1 });
    const sy = { open: 1, half: 0.55, closed: 0.1, happy: 1 }[m.eyes];
    gsap.to($$(".pip-eye"), { scaleY: sy, duration: R ? 0 : 0.15, transformOrigin: "50% 60%" });

    const mo = MOUTH[m.mouth];
    const mouth = $(".pip-mouth");
    mouth.setAttribute("d", mo.d);
    mouth.classList.toggle("is-fill", mo.fill);
    if (!R) gsap.fromTo(mouth, { scale: 0.6 }, { scale: 1, duration: 0.3, ease: "back.out(3)", transformOrigin: "50% 50%" });

    const brows = $(".pip-brows");
    if (m.brows) {
      $(".pip-browL").setAttribute("d", BROWS[m.brows][0]);
      $(".pip-browR").setAttribute("d", BROWS[m.brows][1]);
    }
    gsap.to(brows, { opacity: m.brows ? 1 : 0, duration: R ? 0 : 0.15 });
    gsap.to($$(".pip-cheek"), { opacity: m.cheeks, duration: R ? 0 : 0.3 });

    // droop (sad) vs perk
    gsap.to($(".pip-sprout"), { rotation: m.droop ? 48 : 0, duration: R ? 0 : 0.6, ease: "power2.out", svgOrigin: "0 -46" });
    gsap.to($(".pip-breathe"), { scaleY: m.droop ? 0.93 : 1, duration: R ? 0 : 0.5, svgOrigin: "0 -6" });
    tears(!!m.tears);

    loops.wiggle?.kill();
    if ((name === "happy" || name === "ecstatic") && !R) {
      loops.wiggle = gsap.to($(".pip-sprout"), { rotation: 14, duration: 0.18, yoyo: true, repeat: 7, ease: "sine.inOut", svgOrigin: "0 -46", onComplete: () => gsap.to($(".pip-sprout"), { rotation: 0, duration: 0.2 }) });
    }
    loops.zzz?.kill();
    if (name === "sleepy") zzz();
  }

  function tears(on) {
    loops.tears?.kill();
    const t = $$(".pip-tear");
    if (!on) { gsap.set(t, { opacity: 0, y: 0 }); return; }
    if (reduced()) { gsap.set(t, { opacity: 1 }); return; }
    loops.tears = gsap.timeline({ repeat: -1 });
    t.forEach((tear, i) => loops.tears.fromTo(tear, { opacity: 0, y: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25, transformOrigin: "50% 0%" }, i * 0.7).to(tear, { y: 9, opacity: 0, duration: 0.7, ease: "power1.in" }, i * 0.7 + 0.3));
  }

  function zzz() {
    if (reduced()) return;
    loops.zzz = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
    for (let i = 0; i < 3; i++) {
      loops.zzz.add(() => {
        const z = document.createElement("span");
        z.className = "pip-z";
        z.textContent = "z";
        el.appendChild(z);
        gsap.fromTo(z, { x: 10, y: -40, opacity: 0, scale: 0.6 }, { x: 26 + i * 4, y: -78, opacity: 1, scale: 1.2, duration: 1.4, ease: "sine.out", onComplete: () => z.remove() });
        gsap.to(z, { opacity: 0, duration: 0.4, delay: 1 });
      }, i * 0.5);
    }
  }

  /* ---------------- speech ---------------- */
  /** Keep a bubble/board inside the viewport by sliding it horizontally. */
  function clampX(node) {
    // Uses layout width (offsetWidth), so it's correct even mid scale-animation.
    const pr = el.getBoundingClientRect();
    const cx = pr.left + pr.width / 2;
    const w = node.offsetWidth;
    const left = cx - w / 2;
    const m = 12;
    let shift = 0;
    if (left < m) shift = m - left;
    if (left + w > innerWidth - m) shift = innerWidth - m - (left + w);
    node.style.setProperty("--shift", `${shift}px`);
  }

  function say(text, o = {}) {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.hidden = false;
    clampX(bubble);
    if (!reduced()) gsap.fromTo(bubble, { scale: 0.4, opacity: 0, y: 6 }, { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "back.out(2.6)" });
    else gsap.set(bubble, { opacity: 1, scale: 1 });
    hooks.onSay?.(text, o);
    const ms = o.ms ?? Math.min(4200, 1500 + text.length * 45);
    return new Promise((res) => {
      bubbleTimer = setTimeout(() => {
        if (!o.stay) hush();
        res();
      }, ms);
    });
  }
  function hush() {
    clearTimeout(bubbleTimer);
    gsap.to(bubble, { opacity: 0, scale: 0.8, duration: 0.18, onComplete: () => (bubble.hidden = true) });
  }

  /* ---------------- billboard ---------------- */
  function showBoard(html) {
    board.innerHTML = html;
    board.hidden = false;
    sticks.hidden = false;
    board.classList.add("is-up");
    hush();
    arm("L", 125, 0.3, "back.out(2)");
    arm("R", -125, 0.3, "back.out(2)");
    clampX(board);
    if (!reduced()) {
      gsap.fromTo(sticks, { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: "power2.out", transformOrigin: "50% 100%" });
      gsap.fromTo(board, { y: 40, scaleY: 0.2, opacity: 0 }, { y: 0, scaleY: 1, opacity: 1, duration: 0.55, ease: "back.out(1.8)", delay: 0.1, transformOrigin: "50% 100%" });
      // a few swings, then it settles so the buttons are easy to hit
      gsap.fromTo(board, { rotation: -4 }, { rotation: 2, duration: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut", delay: 0.65, onComplete: () => gsap.to(board, { rotation: 0, duration: 0.4 }) });
    }
    return board;
  }
  function hideBoard() {
    if (board.hidden) return Promise.resolve();
    board.classList.remove("is-up");
    gsap.killTweensOf(board);
    return new Promise((res) => {
      const done = () => { board.hidden = true; sticks.hidden = true; board.innerHTML = ""; armsDown(); res(); };
      if (reduced()) return done();
      gsap.to(board, { y: 40, scaleY: 0.2, opacity: 0, rotation: 0, duration: 0.3, ease: "power2.in" });
      gsap.to(sticks, { scaleY: 0, duration: 0.25, delay: 0.1, onComplete: done });
    });
  }

  /* ---------------- particles ---------------- */
  function burst(kind = "hearts", n = 8) {
    if (reduced()) return;
    const p = pos();
    const colors = ["#ff6a1f", "#ffcf3d", "#3fae5a", "#4f7dff", "#ff4f8b"];
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = kind === "hearts" ? "pip-heart" : "pip-confetti";
      if (kind !== "hearts") s.style.background = colors[i % colors.length];
      s.textContent = kind === "hearts" ? "♥" : "";
      layer.appendChild(s);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const d = 40 + Math.random() * 50;
      gsap.timeline({ onComplete: () => s.remove() })
        .set(s, { x: p.x, y: p.y - 40, opacity: 1, scale: 0.4, rotation: Math.random() * 90 - 45 })
        .to(s, { x: p.x + Math.cos(a) * d, y: p.y - 40 + Math.sin(a) * d, scale: 1, rotation: "+=120", duration: 0.6, ease: "power3.out" })
        .to(s, { y: "+=26", opacity: 0, duration: 0.6, ease: "power1.in" });
    }
  }

  /* ---------------- ambient: breathe, blink, look at cursor ---------------- */
  function ambient() {
    if (!reduced()) loops.breathe = gsap.to($(".pip-breathe"), { scaleX: 1.03, scaleY: 0.985, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut", svgOrigin: "0 -6" });
    const blink = () => {
      if (S.mood !== "sleepy" && S.mood !== "happy" && S.mood !== "ecstatic" && !reduced()) {
        const eyes = $$(".pip-eye");
        const base = gsap.getProperty(eyes[0], "scaleY");
        gsap.timeline().to(eyes, { scaleY: 0.1, duration: 0.07, transformOrigin: "50% 60%" }).to(eyes, { scaleY: base, duration: 0.1 });
      }
      setTimeout(blink, 2200 + Math.random() * 2800);
    };
    setTimeout(blink, 1800);
    const pupils = $$(".pip-pupil");
    const look = (cx, cy) => {
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height * 0.4;
      const dx = cx - ex;
      const dy = cy - ey;
      const len = Math.hypot(dx, dy) || 1;
      gsap.to(pupils, { x: (dx / len) * 1.7 * S.facing, y: (dy / len) * 1.5, duration: 0.25, overwrite: "auto" });
    };
    addEventListener("pointermove", (e) => look(e.clientX, e.clientY), { passive: true });
    S.lookAt = look;
  }

  /* ---------------- scroll follow + auto re-dock ---------------- */
  let raf = 0;
  let offTimer = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!S.enabled) return;
      if (S.docked) {
        const d = dockPoint();
        gsap.to(el, { x: d.x, y: d.y, duration: reduced() ? 0 : 0.35, ease: "power2.out", overwrite: "auto" });
        return;
      }
      if (S.moving || !board.hidden) return;
      const p = pos();
      if (!inView(p.y, 30)) {
        clearTimeout(offTimer);
        offTimer = setTimeout(() => {
          if (S.docked || S.moving || inView(pos().y, 30)) return;
          act(async (g) => {
            await g(enterFromBelow());
            hooks.onRedock?.();
          });
        }, 500);
      }
    });
  }

  /* ---------------- behaviour runner (newest behaviour wins) ---------------- */
  function act(fn) {
    if (!S.enabled) return Promise.resolve();
    const my = ++S.token;
    interrupt();
    const g = (p) => Promise.resolve(p).then((v) => { if (my !== S.token) throw CANCEL; return v; });
    return fn(g).catch((e) => { if (e !== CANCEL) console.error(e); });
  }
  const busyToken = () => S.token;

  /* ---------------- mount / enable ---------------- */
  function $$(sel) { return Array.from(el.querySelectorAll(sel)); }

  function mount(opts = {}) {
    hooks = opts;
    layer = document.createElement("div");
    layer.className = "pip-layer";
    // Pip's body, speech and sticks are decorative (speech is mirrored to a live region by the page);
    // the billboard is real UI, so it stays outside the aria-hidden parts.
    layer.innerHTML = `<div class="pip"><div class="pip__flip" aria-hidden="true">${SVG}</div><div class="pip-sticks" aria-hidden="true" hidden><i></i><i></i></div><p class="pip-bubble" aria-hidden="true" hidden></p><div class="pip-board" role="group" aria-label="Pip's offer" hidden></div></div>`;
    document.body.appendChild(layer);
    el = layer.querySelector(".pip");
    flip = el.querySelector(".pip__flip");
    bubble = el.querySelector(".pip-bubble");
    board = el.querySelector(".pip-board");
    sticks = el.querySelector(".pip-sticks");
    $ = (sel) => el.querySelector(sel);
    gsap.set($(".pip-rig"), { svgOrigin: "0 0" });
    gsap.set([bubble, board], { xPercent: -50 });
    mood("idle");
    ambient();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".pip-board")) return;
      if (!reduced()) gsap.fromTo($(".pip-rig"), { scaleY: 0.7, scaleX: 1.25 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1.3, 0.35)", svgOrigin: "0 0" });
      hooks.onPoke?.();
    });
    return el;
  }

  function setEnabled(on) {
    S.enabled = on;
    if (!on) {
      S.token++;
      interrupt();
      hush();
      hideBoard();
      gsap.to(el, { opacity: 0, scale: 0.6, duration: reduced() ? 0 : 0.25, onComplete: () => (layer.hidden = true) });
    } else {
      layer.hidden = false;
      gsap.to(el, { opacity: 1, scale: 1, duration: reduced() ? 0 : 0.25 });
    }
  }

  return {
    mount, setEnabled, act, wait, place, placeViewport, pos, perch, dockPoint, inView,
    walkTo, jumpTo, hop, dock, enterFromBelow, wave, point, armsDown, sit, stand,
    mood, say, hush, showBoard, hideBoard, burst, face,
    get state() { return S; }, get el() { return el; }, busyToken,
  };
})();
