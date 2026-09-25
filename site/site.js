// whealthfactory.com — the app's LOCK IN, alive. One entrance (the words
// slam in, the control rises and ignites), one forge (embers rising, gold
// beading and dripping from the control's edge, sparks on commit), one
// interaction (press and hold, exactly as in the app), reveals that play once
// as a section arrives, and two scroll moments (the streak grows, the tiers
// climb).
(() => {
  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = document.querySelector(".hero");
  const stage = document.querySelector(".lockin-stage");
  const button = document.querySelector(".lockin");
  const labelText = button.querySelector(".label-text");
  const streakDay = document.querySelector(".hero-xp .streak-day");

  // ── The forge: embers, drips and sparks on one canvas around the control.
  const canvas = document.querySelector(".forge");
  const ctx = canvas.getContext("2d");
  // Glow and sparks need no retina sharpness; 1.5x keeps the fill cost down.
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let W = 0, H = 0, running = false, heat = 0;
  const embers = [], sparks = [], drips = [];
  const GOLD = [[255, 214, 120], [245, 179, 58], [255, 140, 50], [255, 110, 40]];

  // One soft round sprite per colour: drawing an image is far cheaper than
  // building a gradient per particle per frame.
  const sprite = (rgb) => {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,248,225,1)");
    g.addColorStop(0.25, `rgba(${rgb},0.95)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return c;
  };
  const SPRITES = GOLD.map((c) => sprite(c.join(",")));

  // The control's box in canvas pixels, from layout sizes (never the tilted
  // or entrance-scaled bounding box), measured on resize only.
  let B = { x: 0, y: 0, w: 0, h: 0 }, dripFill = "rgb(248,170,52)";
  const rect = () => B;
  const resize = () => {
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    B = { x: -canvas.offsetLeft, y: -canvas.offsetTop, w: stage.offsetWidth, h: button.offsetHeight };
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dripFill = ctx.createLinearGradient(0, B.y + B.h * 0.94, 0, B.y + B.h * 1.7);
    dripFill.addColorStop(0, "rgb(255,196,70)"); dripFill.addColorStop(0.5, "rgb(245,150,40)"); dripFill.addColorStop(1, "rgb(230,110,30)");
  };

  // Sparks thrown off the heat: born at the control's sides and underside,
  // flying out and up as short glowing streaks, like the comp's.
  const spawnEmber = (b) => {
    const side = Math.random();
    const left = side < 0.4, right = side >= 0.4 && side < 0.8;
    const x = left ? b.x + Math.random() * b.w * 0.12 : right ? b.x + b.w * (0.88 + Math.random() * 0.12) : b.x + Math.random() * b.w;
    const y = left || right ? b.y + b.h * (0.2 + Math.random() * 0.9) : b.y + b.h * (1 + Math.random() * 0.35);
    const out = left ? -1 : right ? 1 : (Math.random() - 0.5) * 0.6;
    embers.push({
      x, y, vx: out * (0.6 + Math.random() * 1.6), vy: -(0.4 + Math.random() * 1.2),
      r: 1 + Math.random() * 1.3, life: 0, max: 60 + Math.random() * 90,
      s: SPRITES[(Math.random() * SPRITES.length) | 0], c: GOLD[1 + ((Math.random() * 3) | 0)],
    });
  };
  const burst = (b, n, power = 1) => {
    for (let i = 0; i < n; i++) {
      const x = b.x + Math.random() * b.w;
      const y = Math.random() < 0.5 ? b.y + b.h : b.y + Math.random() * b.h;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const v = (2 + Math.random() * 6) * power;
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 0, max: 40 + Math.random() * 50, c: GOLD[(Math.random() * 4) | 0] });
    }
  };
  // Drip sites along the lower edge, as fractions of the control's width.
  const SITES = [0.12, 0.245, 0.64, 0.82, 0.875];
  const spawnDrip = (b) => {
    const f = SITES[(Math.random() * SITES.length) | 0] + (Math.random() - 0.5) * 0.02;
    drips.push({ f, len: 0, r: 0, grow: 0.07 + Math.random() * 0.09, rmax: b.h * (0.06 + Math.random() * 0.04), falling: false, y: 0, vy: 0 });
  };
  const drawDrip = (d, b) => {
    const x = b.x + d.f * b.w;
    const top = b.y + b.h + b.w * 0.048; // the slab's lower edge, 0.48em under the face
    ctx.fillStyle = dripFill;
    if (!d.falling) {
      // a neck from the edge, swelling into a bead
      const cy = top + d.len;
      // wide root at the edge, a thin neck, a heavy bead
      ctx.beginPath();
      ctx.moveTo(x - d.r * 1.5, top);
      ctx.quadraticCurveTo(x - d.r * 0.45, top + d.len * 0.2, x - d.r * 0.42, top + d.len * 0.55);
      ctx.quadraticCurveTo(x - d.r * 0.45, cy - d.r * 0.9, x - d.r, cy);
      ctx.arc(x, cy, d.r, Math.PI, 0, true);
      ctx.quadraticCurveTo(x + d.r * 0.45, cy - d.r * 0.9, x + d.r * 0.42, top + d.len * 0.55);
      ctx.quadraticCurveTo(x + d.r * 0.45, top + d.len * 0.2, x + d.r * 1.5, top);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,245,210,0.85)";
      ctx.beginPath(); ctx.ellipse(x - d.r * 0.35, cy - d.r * 0.25, d.r * 0.22, d.r * 0.32, -0.4, 0, 6.29); ctx.fill();
    } else {
      ctx.fillStyle = "rgb(245,150,40)";
      ctx.beginPath(); ctx.ellipse(x, d.y, d.r * 0.85, d.r * 1.25, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(255,245,210,0.8)";
      ctx.beginPath(); ctx.ellipse(x - d.r * 0.3, d.y - d.r * 0.4, d.r * 0.2, d.r * 0.3, -0.4, 0, 6.29); ctx.fill();
    }
  };

  let last = 0;
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min(2.5, last ? (t - last) / 16.7 : 1); last = t;
    const b = rect();
    ctx.clearRect(0, 0, W, H);
    // Embers and sparks never cross the gold face: over it they read as dust.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.roundRect(b.x, b.y, b.w, b.h * 0.97, b.h * 0.22);
    ctx.clip("evenodd");
    ctx.globalCompositeOperation = "lighter";
    if (embers.length < 46 + heat * 40 && Math.random() < (0.35 + heat) * dt) spawnEmber(b);
    ctx.lineCap = "round";
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life += dt;
      e.vx *= 0.992; e.vy -= 0.004 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt * (1 + heat);
      const k = e.life / e.max;
      if (k >= 1) { embers.splice(i, 1); continue; }
      const a = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
      ctx.globalAlpha = a;
      ctx.strokeStyle = `rgb(${e.c.join(",")})`; ctx.lineWidth = e.r;
      ctx.beginPath(); ctx.moveTo(e.x - e.vx * 7, e.y - e.vy * 7); ctx.lineTo(e.x, e.y); ctx.stroke();
      const s = e.r * 6;
      ctx.globalAlpha = a * 0.7;
      ctx.drawImage(e.s, e.x - s / 2, e.y - s / 2, s, s);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt; p.px = p.x; p.py = p.y;
      p.vy += 0.16 * dt; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.strokeStyle = `rgb(${p.c.join(",")})`; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    // a few beads always hang from the edge; holding the control makes it pour
    if (drips.length < 5 + heat * 5 && Math.random() < (0.03 + heat * 0.1) * dt) spawnDrip(b);
    const floor = Math.min(H - 4, b.y + b.h + b.w * 0.16);
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      if (!d.falling) {
        // a drip stretches fast, then hangs heavy for seconds before it lets go
        const max = b.h * (0.3 + (d.f % 0.2) * 0.6);
        d.r = Math.min(d.rmax, d.r + d.grow * 0.6 * dt * (1 + heat * 3));
        d.len += d.grow * 2.2 * dt * (d.r / d.rmax) * (1.05 - (d.len / max) * 0.85) * (1 + heat * 3);
        if (d.len > max) { d.falling = true; d.y = b.y + b.h + b.w * 0.048 + d.len; d.vy = 1; }
      } else {
        d.vy += 0.35 * dt; d.y += d.vy * dt;
        if (d.y >= floor) {
          // the drop lands: a small splash of sparks
          for (let k = 0; k < 7; k++) {
            const x = b.x + d.f * b.w;
            sparks.push({ x, y: floor, px: x, py: floor, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2.5, life: 0, max: 22 + Math.random() * 18, c: GOLD[(Math.random() * 4) | 0] });
          }
          drips.splice(i, 1); continue;
        }
      }
      drawDrip(d, b);
    }
    requestAnimationFrame(frame);
  };
  // The comp's five drips are already hanging when the page opens.
  const seed = () => {
    SITES.forEach((f) => drips.push({ f, len: B.h * (0.14 + Math.random() * 0.14), r: B.h * 0.07, grow: 0.08 + Math.random() * 0.06, rmax: B.h * (0.065 + Math.random() * 0.03), falling: false, y: 0, vy: 0 }));
  };
  let seeded = false;
  const start = () => { if (running || reduce) return; if (!seeded) { seeded = true; seed(); } running = true; last = 0; requestAnimationFrame(frame); };
  const stop = () => { running = false; };
  resize();
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(stage);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  // ── Reveals: a group (the score sheet, the 28 days, the brief) waits for
  // the viewport, then its lines rise in sequence — CSS transitions, once.
  // No scroll listener, no per-frame work; the observer fires one event.
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); }
  }, { rootMargin: "0px 0px -14% 0px" });
  document.querySelectorAll("[data-reveal-group]").forEach((el) => reveal.observe(el));

  // ── Press and hold: the app's lock-in, playable.
  let holdTimer = null, cooling = null, locked = false;
  const HOLD_MS = 900; // the melt's own rise time in site.css
  const beginHold = () => {
    if (button.classList.contains("is-holding")) return;
    stage.classList.add("used");
    clearTimeout(cooling);
    button.classList.remove("is-cooling");
    if (locked) {
      locked = false;
      button.classList.remove("is-locked");
      labelText.textContent = labelText.dataset.idle;
      streakDay.textContent = "Streak day 1";
    }
    button.classList.add("is-holding");
    heat = 1;
    holdTimer = setTimeout(commit, HOLD_MS);
  };
  const endHold = () => {
    if (!button.classList.contains("is-holding") || locked) return;
    clearTimeout(holdTimer);
    button.classList.remove("is-holding");
    heat = 0;
  };
  const commit = () => {
    locked = true;
    button.classList.add("is-locked");
    labelText.textContent = labelText.dataset.done;
    streakDay.textContent = "Streak day 1 · Locked in";
    burst(rect(), 160, 1.2);
    if (navigator.vibrate) navigator.vibrate(18);
    // the lava holds a moment, then cools back into gold — and once it has
    // parked again its loops stop, or they would run under the face forever
    cooling = setTimeout(() => {
      button.classList.add("is-cooling");
      button.classList.remove("is-holding");
      heat = 0;
      cooling = setTimeout(() => button.classList.remove("is-cooling"), 1700);
    }, 1400);
  };
  button.addEventListener("pointerdown", (e) => { if (e.button === 0) { button.setPointerCapture(e.pointerId); beginHold(); } });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => button.addEventListener(ev, endHold));
  button.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); beginHold(); } });
  button.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") endHold(); });
  button.addEventListener("contextmenu", (e) => e.preventDefault());
  // VoiceOver and switch access activate with a click (detail 0), not a hold.
  button.addEventListener("click", (e) => { if (e.detail === 0 && !locked) { button.classList.add("is-holding"); commit(); } });

  if (reduce) return;

  // ── Tilt: the control leans toward the cursor, the specular follows it.
  // A small lerp on requestAnimationFrame that stops once it has settled —
  // no library, no work while the pointer rests.
  if (matchMedia("(hover: hover)").matches) {
    const spec = button.querySelector(".lockin-spec");
    const cur = { rx: 0, ry: 0, sx: 0, sy: 0 }, to = { rx: 0, ry: 0, sx: 0, sy: 0 };
    let tilting = false;
    const settle = () => {
      let live = false;
      for (const k in to) { const d = to[k] - cur[k]; if (Math.abs(d) > 0.02) live = true; cur[k] += d * 0.16; }
      button.style.transform = `rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)`;
      spec.style.transform = `translate(${cur.sx.toFixed(1)}px, ${cur.sy.toFixed(1)}px)`;
      if (live) requestAnimationFrame(settle); else tilting = false;
    };
    const wake = () => { if (!tilting) { tilting = true; requestAnimationFrame(settle); } };
    hero.addEventListener("pointermove", (e) => {
      const b = stage.getBoundingClientRect();
      const nx = (e.clientX - (b.left + b.width / 2)) / (innerWidth / 2);
      const ny = (e.clientY - (b.top + B.h / 2)) / (innerHeight / 2);
      to.rx = Math.max(-1, Math.min(1, ny)) * -7;
      to.ry = Math.max(-1, Math.min(1, nx)) * 9;
      // the highlight's centre starts at 10% across, 50% down the face
      to.sx = e.clientX - b.left - b.width * 0.1;
      to.sy = e.clientY - b.top - B.h * 0.5;
      wake();
    });
    hero.addEventListener("pointerleave", () => { to.rx = 0; to.ry = 0; wake(); });
  }

  // ── Entrance: the words and the control are CSS animations that started
  // at the first paint (site.css "Entrance"). The one thing only a script can
  // do — the spark burst as the control lands — is timed from that same
  // paint, so a late script lands it late rather than replaying the opening.
  if (html.classList.contains("motion")) {
    const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
    const since = performance.now() - (paint ? paint.startTime : 0);
    setTimeout(() => burst(rect(), 90, 0.9), Math.max(0, 950 - since));
  }

  // ── The streak grows once, when it arrives: 1 → 30 over two seconds, the
  // flame with it (CSS, on .in). It used to be pinned and scrubbed to the
  // scroll, which on a phone means main-thread scroll events under momentum
  // scrolling — the number visibly trailed the thumb.
  const streak = document.querySelector(".streak");
  const num = document.querySelector(".streak-num");
  const unit = document.querySelector(".streak-unit");
  const countStreak = () => {
    const t0 = performance.now(), dur = 2000;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const d = Math.max(1, Math.round(1 + 29 * (1 - Math.pow(1 - k, 3))));
      if (num.textContent !== String(d)) { num.textContent = d; unit.textContent = d === 1 ? "day" : "days"; }
      if (k < 1) requestAnimationFrame(tick);
    };
    num.textContent = "1"; unit.textContent = "day";
    requestAnimationFrame(tick);
  };
  const streakIn = new IntersectionObserver(([e]) => {
    // the flicker runs only while the flame is on screen
    streak.classList.toggle("live", e.isIntersecting);
    if (e.isIntersecting && !streak.classList.contains("in")) { streak.classList.add("in"); countStreak(); }
  }, { rootMargin: "0px 0px -20% 0px" });
  streakIn.observe(streak);
  document.addEventListener("visibilitychange", () => { if (document.hidden) streak.classList.remove("live"); });
})();
