/* =========================================================
   Deck controller — scaling, navigation, slide lifecycle
   ========================================================= */
(function () {
  'use strict';
  const stage = document.getElementById('stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const N = slides.length;
  const count = document.getElementById('count');
  const bar = document.getElementById('bar');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const cover3d = window.Cover3D;
  const demos = window.Demos || {};
  const glHosts = { 0: document.getElementById('gl-cover'), 7: document.getElementById('gl-end') };
  let cur = -1;

  function fit() {
    const s = Math.min(innerWidth / 1600, innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    if (cover3d) cover3d.setScaleFactor(s);
    if (window.Transitions) window.Transitions.setScaleFactor(s);
  }
  addEventListener('resize', fit);
  fit();

  const trans = window.Transitions;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sm = (p, a, b) => { const u = Math.max(0, Math.min(1, (p - a) / (b - a))); return u * u * (3 - 2 * u); };

  function activate(n) {
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === n);
      s.setAttribute('aria-hidden', i === n ? 'false' : 'true');
      if ('inert' in s) s.inert = i !== n;
    });
    if (demos[n + 1]) demos[n + 1].enter();
    if (cover3d && glHosts[n]) cover3d.attach(glHosts[n], n === 0 ? 'cover' : 'end');
  }
  function chrome(n, fromHash) {
    count.textContent = `${n + 1} / ${N}`;
    bar.style.width = ((n + 1) / N * 100) + '%';
    prev.disabled = n === 0;
    next.disabled = n === N - 1;
    if (!fromHash) history.replaceState(null, '', '#' + (n + 1));
  }

  function go(n, fromHash) {
    n = Math.max(0, Math.min(N - 1, n));
    if (trans && trans.busy) trans.finish();     // a new request completes the running transition first
    if (n === cur) return;
    const old = cur;
    cur = n;
    chrome(n, fromHash);
    if (old >= 0 && demos[old + 1]) demos[old + 1].leave();

    // adjacent slides: play the content-driven 3D transition for that pair
    if (old >= 0 && trans && !reduceMotion && Math.abs(n - old) === 1) {
      const A = slides[old], B = slides[n];
      A.classList.add('tr'); B.classList.add('tr');
      B.style.opacity = '0';
      let swapped = false;
      trans.play(Math.min(old, n), n > old ? 1 : -1, (p) => {
        const a = sm(p, 0, 0.22), b = sm(p, 0.74, 0.97);
        A.style.opacity = String(1 - a);
        A.style.transform = `scale(${1 - 0.035 * a}) translateY(${-10 * a}px)`;
        B.style.opacity = String(b);
        B.style.transform = `scale(${1.03 - 0.03 * b}) translateY(${12 * (1 - b)}px)`;
        if (!swapped && p >= 0.7) { swapped = true; activate(n); }
      }, () => {
        if (!swapped) activate(n);
        [A, B].forEach((s) => { s.classList.remove('tr'); s.style.opacity = ''; s.style.transform = ''; });
        if (cover3d && !glHosts[cur]) cover3d.pause();
      });
      return;
    }

    // first load, distant jumps or reduced motion: direct cross-fade
    activate(n);
    if (cover3d && !glHosts[n]) cover3d.pause();
  }

  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));
  document.getElementById('fs').addEventListener('click', toggleFs);
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }

  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target.closest && e.target.closest('button, input, select, textarea, [role="tab"]');
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': go(cur + 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'PageUp': go(cur - 1); e.preventDefault(); break;
      case ' ': case 'Enter':
        if (onControl) return; // let buttons activate normally
        e.shiftKey ? go(cur - 1) : go(cur + 1); e.preventDefault(); break;
      case 'Home': go(0); e.preventDefault(); break;
      case 'End': go(N - 1); e.preventDefault(); break;
      case 'f': case 'F': toggleFs(); break;
      default:
        if (/^[1-8]$/.test(e.key)) go(+e.key - 1);
    }
  });

  // touch swipe
  let tx = null, ty = 0;
  addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', (e) => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
    tx = null;
  }, { passive: true });

  addEventListener('hashchange', () => { const h = parseInt(location.hash.slice(1), 10); if (h) go(h - 1, true); });

  const start = parseInt(location.hash.slice(1), 10);
  const begin = () => { if (window.Transitions) { try { window.Transitions.warm(); } catch (e) { console.warn(e); } } go(start ? start - 1 : 0, true); };
  // wait briefly for web fonts so the 3D labels and title render with the right faces
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(() => requestAnimationFrame(begin));
  } else begin();
})();
