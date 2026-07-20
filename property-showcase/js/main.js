/* =====================================================================
   Swan Landing — scroll orchestration
   Lenis (inertial smooth scroll) + GSAP ScrollTrigger (scrubbed,
   pinned cinematic acts). Degrades gracefully to a static, readable
   page when JS/libraries are unavailable or reduced-motion is on.
   ===================================================================== */
(function () {
  "use strict";

  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);

  /* ---------- Preloader ---------- */
  const loader = doc.getElementById("loader");
  const loaderBar = doc.getElementById("loaderBar");
  (function runLoader() {
    if (!loader) return;
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(100, p + Math.random() * 18 + 6);
      if (loaderBar) loaderBar.style.width = p + "%";
      if (p >= 100) {
        clearInterval(tick);
        setTimeout(() => loader.classList.add("is-done"), 350);
      }
    }, 130);
  })();

  /* ---------- Stat count-up (works with or without GSAP) ---------- */
  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const dur = 1400;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent =
        prefix +
        (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US")) +
        suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Reveal-on-scroll (IntersectionObserver) ---------- */
  function initReveals() {
    const items = doc.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((i) => i.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          e.target.querySelectorAll("[data-count]").forEach(countUp);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.25 }
    );
    items.forEach((i) => io.observe(i));
  }

  /* =====================================================================
     Static fallback — no GSAP or reduced motion requested
     ===================================================================== */
  if (!hasGSAP || reduceMotion) {
    initReveals();
    return;
  }

  const { gsap } = window;
  gsap.registerPlugin(window.ScrollTrigger);
  const ST = window.ScrollTrigger;

  /* ---------- Lenis smooth scroll, tied into GSAP's ticker ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    lenis.on("scroll", ST.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis; // exposed for tests / deep-linking
  }

  /* ---------- Depth parallax within the hero (before pinning) ---------- */
  // (handled inside the approach timeline below)

  function build() {
    /* ---- ACT 1 · APPROACH — dolly forward toward the door ---- */
    const t1 = gsap.timeline({
      scrollTrigger: {
        trigger: "#approach",
        start: "top top",
        end: "+=160%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });
    t1.to("#approach .layer--sky", { scale: 1.18, yPercent: -5, ease: "none" }, 0)
      .to("#approach .layer--house", { scale: 2.0, yPercent: 8, ease: "none" }, 0)
      .to("#approach .façade-door", { scale: 3.1, ease: "none" }, 0)
      .to("#approach .layer--fg", { scale: 2.3, yPercent: 34, opacity: 0, ease: "none" }, 0)
      .to("#approach .hero__title", { autoAlpha: 0, y: -60, ease: "power1.in", duration: 0.45 }, 0)
      .to("#approach .scroll-hint", { autoAlpha: 0, duration: 0.15 }, 0)
      .to("#approach .grade--vignette", { opacity: 1.4, ease: "none" }, 0);

    /* ---- ACT 2 · ENTER — door swings open, camera passes through ---- */
    const t2 = gsap.timeline({
      scrollTrigger: {
        trigger: "#enter",
        start: "top top",
        end: "+=220%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });
    t2.fromTo(
      "#enter .doorway",
      { scale: 0.82, z: -120 },
      { scale: 1.0, z: 0, ease: "power1.out", duration: 0.35 },
      0
    )
      .to("#enter .door__panel", { rotateY: -108, ease: "power2.inOut", duration: 0.55 }, 0.15)
      .to("#enter .door__glow", { opacity: 1, ease: "power1.in", duration: 0.4 }, 0.25)
      .to("#enter .enter__caption", { autoAlpha: 0, y: -30, duration: 0.25 }, 0.35)
      .to("#enter .doorway", { scale: 7.5, ease: "power2.in", duration: 0.5 }, 0.55)
      .to("#enter .door__frame", { autoAlpha: 0, duration: 0.25 }, 0.72)
      .to("#enter .door__wall", { autoAlpha: 0, duration: 0.2 }, 0.78);

    /* ---- ACT 3/4 · ROOMS + BACKYARD — forward push + ken-burns ---- */
    gsap.utils.toArray(".act--room, .act--backyard").forEach((section) => {
      const scene = section.querySelector(".scene");
      const info = section.querySelectorAll(".room__info > *");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=130%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });
      // enter the room (starts pushed-in + soft), settle, then keep drifting forward
      tl.fromTo(
        scene,
        { scale: 1.28, filter: "blur(9px)", autoAlpha: 0.25 },
        { scale: 1.08, filter: "blur(0px)", autoAlpha: 1, ease: "power2.out", duration: 0.5 },
        0
      )
        .to(scene, { scale: 1.18, ease: "none", duration: 0.5 }, 0.5)
        .fromTo(
          info,
          { y: 46, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.08, ease: "power2.out", duration: 0.35 },
          0.22
        )
        .to(info, { autoAlpha: 0, y: -24, duration: 0.25 }, 0.78);
    });

    /* ---- ACT 5 · THE VIEW — pull all the way back ---- */
    const t5 = gsap.timeline({
      scrollTrigger: {
        trigger: "#view",
        start: "top top",
        end: "+=170%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });
    t5.fromTo(
      "#view .scene--view",
      { scale: 1.75, rotateX: 7, transformOrigin: "50% 45%" },
      { scale: 1.0, rotateX: 0, ease: "power2.out", duration: 0.75 },
      0
    )
      .fromTo("#view .layer--water", { yPercent: 10 }, { yPercent: -4, ease: "none", duration: 1 }, 0)
      .fromTo(
        "#view .view__caption",
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, ease: "power2.out", duration: 0.4 },
        0.45
      );

    /* ---- Progress bar ---- */
    gsap.to("#progressBar", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: doc.body, start: "top top", end: "bottom bottom", scrub: 0.3 },
    });

    initReveals();
    ST.refresh();
  }

  /* Build after fonts/layout settle so pin measurements are correct */
  if (doc.readyState === "complete") {
    build();
  } else {
    window.addEventListener("load", build, { once: true });
  }

  // Keep pin math correct across resizes / orientation changes
  let rID;
  window.addEventListener("resize", () => {
    clearTimeout(rID);
    rID = setTimeout(() => ST.refresh(), 200);
  });
})();
