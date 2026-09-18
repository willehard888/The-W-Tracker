// whealthfactory.com — one authored entrance (the W, then the words), one
// light sweep across the metal, and one scroll signature: the dial's hand
// travelling the day. Everything else holds still. Transform and opacity only.
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── The dial: 24 hours, a tick every quarter hour, the four marks labelled.
  const svg = document.querySelector(".dial-svg");
  const marks = [...document.querySelectorAll(".mark")];
  if (svg) {
    const ticks = svg.querySelector(".ticks");
    const labels = svg.querySelector(".labels");
    const polar = (r, deg) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return [r * Math.cos(a), r * Math.sin(a)];
    };
    for (let q = 0; q < 96; q++) {
      const deg = q * 3.75;
      const hour = q % 4 === 0;
      const [x1, y1] = polar(hour ? 170 : 178, deg);
      const [x2, y2] = polar(186, deg);
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", x1.toFixed(2)); l.setAttribute("y1", y1.toFixed(2));
      l.setAttribute("x2", x2.toFixed(2)); l.setAttribute("y2", y2.toFixed(2));
      if (!hour) l.setAttribute("class", "minor");
      ticks.appendChild(l);
    }
    // Each mark's time sits just inside the ring at its hour; the names live
    // in the list beside the dial, so nothing reaches past the ring.
    for (const li of marks) {
      const deg = Number(li.dataset.angle);
      const time = li.querySelector("time").textContent.trim();
      const [x, y] = polar(150, deg);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x.toFixed(1));
      t.setAttribute("y", (y + 3).toFixed(1));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "t");
      t.textContent = time;
      labels.appendChild(t);
    }
  }

  if (reduce || !window.gsap) {
    document.documentElement.classList.remove("motion");
    return;
  }
  const { gsap } = window;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
  const html = document.documentElement;

  // ── Entrance: the object arrives, the words rise, the rest settles. If the
  // fallback in <head> already showed the page, the entrance is skipped.
  if (html.classList.contains("motion")) {
    window.__wfIntro = true;
    gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: () => html.classList.remove("motion") })
      .fromTo(".hero-object", { opacity: 0, y: 28, scale: 0.975 }, { opacity: 1, y: 0, scale: 1, duration: 2.2, clearProps: "opacity,scale" })
      .to(".word > span", { y: 0, duration: 1.5, stagger: 0.14 }, 0.45)
      .to("[data-reveal='late']", { opacity: 1, duration: 1.4, stagger: 0.12 }, 1.05);
  }

  // ── The light: once as the page arrives, then rarely, like a turned wrist.
  gsap.fromTo(".w-beam",
    { xPercent: 45 },
    { xPercent: -45, duration: 2.8, ease: "power2.inOut", delay: 1.2, repeat: -1, repeatDelay: 9 });

  if (!window.ScrollTrigger) return;
  const mm = gsap.matchMedia();
  // Complements of each other, and NARROW matches the CSS narrow block.
  const WIDE = "(min-width: 761px) and (orientation: landscape), (min-width: 1101px)";
  const NARROW = "(max-width: 760px), (orientation: portrait) and (max-width: 1100px)";

  // ── Leaving the hero: the W recedes a little slower than the page. On an
  // inner wrapper, so it never fights the entrance on .hero-object.
  mm.add(WIDE, () => {
    gsap.to(".w-lift", {
      yPercent: -10, opacity: 0.35, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  });

  // ── The signature: the hand travels 06:30 → 21:00 with the scroll, resting
  // at each mark, and the mark it points at is the one that speaks. Wide
  // screens pin the section; narrow ones keep the dial sticky and scrub
  // across the list beneath it.
  const hand = document.querySelector(".dial-svg .hand");
  const angles = marks.map((m) => Number(m.dataset.angle));
  const stage = document.querySelector(".ritual");
  const handTimeline = (scrollTrigger) => {
    stage.classList.add("pinned");
    const state = { a: angles[0] };
    const draw = () => {
      gsap.set(hand, { rotation: state.a, svgOrigin: "0 0" });
      let on = 0;
      angles.forEach((a, i) => { if (state.a >= a - 0.5) on = i; });
      marks.forEach((m, i) => m.classList.toggle("is-on", i === on));
    };
    const tl = gsap.timeline({ scrollTrigger });
    angles.forEach((a, i) => {
      if (i) tl.to(state, { a, duration: 1, ease: "power2.inOut", onUpdate: draw });
      tl.to(state, { a, duration: 0.6 });
    });
    draw();
    return () => { stage.classList.remove("pinned"); state.a = angles[0]; draw(); };
  };
  mm.add(WIDE, () => handTimeline({ trigger: ".ritual-stage", start: "center center", end: "+=220%", pin: true, scrub: 0.8 }));
  mm.add(NARROW, () => handTimeline({ trigger: ".marks", start: "top 72%", end: "bottom 60%", scrub: 0.6 }));
})();
