/* =========================================================
   Content-driven 3D slide transitions.
   One WebGL layer above the slides. Every transition is a short
   piece of the seminar's own science, played with the same data
   blocks used throughout the deck:

     1→2  Unordered data is organized into one linear sequence,
          then traversed in a single run.
     2→3  The sequence becomes an array: gaps close (contiguous
          memory), indices appear, array[3] is accessed directly.
     3→4  The array is rotated 90° about index 0 — index 0 becomes
          the bottom of a stack; a push lands on top; the exit pops
          every element in LIFO order.
     4→5  The stack converts A + B * C to postfix: operands go to
          the output, operators wait on the stack and leave in order.
     5→6  The postfix output stream turns into a FIFO queue:
          tokens leave at the front while 10…50 enter at the rear.
     6→7  A normal queue with freed front cells bends into a circle;
          80 wraps into index 0 (rear = (rear + 1) % SIZE).
     7→8  The circle unrolls and regroups into an array, a queue and
          a stack — the summary composition of the conclusion.

   Each transition is a pure function of t ∈ [0, 1]. Going back
   plays it in reverse (a push becomes a pop, the rotation unwinds),
   except where reversal would break the science (postfix order,
   FIFO direction): those have their own backward variant.
   ========================================================= */
window.Transitions = (function () {
  'use strict';
  if (!window.THREE) return null;
  const T = THREE;
  const W = 1600, H = 900;

  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  renderer.setSize(W, H, false);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'tr-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.getElementById('stage').appendChild(canvas);

  const col = (h) => new T.Color(h).convertSRGBToLinear();
  const P = {
    graphite: col('#464953'), slate: col('#5c5f69'), gray: col('#8d8f99'), light: col('#d6d1d5'),
    pink: col('#cf5f8d'), hot: col('#e8689c'), blush: col('#f0bfd3'), white: col('#ffffff')
  };
  const LIGHT_KEYS = { light: 1, blush: 1, white: 1 };

  /* ---------- scene ---------- */
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, W / H, 0.1, 200);
  scene.add(new T.HemisphereLight(col('#ffffff'), col('#dcd2d8'), 0.9));
  const key = new T.DirectionalLight(col('#ffffff'), 0.95);
  key.position.set(-6, 14, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  key.shadow.radius = 4;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new T.DirectionalLight(col('#ffc4da'), 0.5);
  rim.position.set(9, 5, -7);
  scene.add(rim);
  const ground = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const root = new T.Group();
  scene.add(root);

  /* ---------- geometry, textures ---------- */
  const GEO = (function () {
    const s = 0.86, r = 0.1, x = -s / 2, y = -s / 2;
    const sh = new T.Shape();
    sh.moveTo(x + r, y); sh.lineTo(x + s - r, y); sh.quadraticCurveTo(x + s, y, x + s, y + r);
    sh.lineTo(x + s, y + s - r); sh.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    sh.lineTo(x + r, y + s); sh.quadraticCurveTo(x, y + s, x, y + s - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    const g = new T.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6 });
    g.center();
    return g;
  })();
  const LBL_GEO = new T.PlaneGeometry(0.62, 0.62);

  const texCache = new Map();
  function tex(text, o) {
    o = Object.assign({ w: 256, h: 256, size: 118, weight: 600, color: '#ffffff', family: '"JetBrains Mono", Menlo, monospace', spacing: 0, align: 'center' }, o);
    const k = JSON.stringify([text, o]);
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas');
    c.width = o.w; c.height = o.h;
    const g = c.getContext('2d');
    g.fillStyle = o.color;
    g.font = `${o.weight} ${o.size}px ${o.family}`;
    g.textBaseline = 'middle';
    g.textAlign = o.align;
    if ('letterSpacing' in g) g.letterSpacing = o.spacing + 'px';
    // shrink long captions so they always fit inside the texture
    let size = o.size;
    while (size > 12 && g.measureText(text).width > o.w - 24) {
      size -= 2;
      g.font = `${o.weight} ${size}px ${o.family}`;
    }
    g.fillText(text, o.align === 'left' ? 8 : o.w / 2, o.h / 2 + size * 0.04);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 8;
    texCache.set(k, t);
    return t;
  }

  /* ---------- easing & math ---------- */
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const io = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const out = (u) => 1 - Math.pow(1 - u, 3);
  const back = (u) => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const drop = (u) => (u < 0.8 ? out(u / 0.8) * 1.025 : 1.025 - 0.025 * Math.sin(((u - 0.8) / 0.2) * Math.PI / 2));
  const lin = (u) => u;
  const seg = (t, a, b, e) => (e || io)(clamp((t - a) / (b - a)));
  const lerp = (a, b, u) => a + (b - a) * u;
  const L3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const fade = (t, a, b, c, d) => seg(t, a, b) * (1 - seg(t, c, d));
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /* ---------- keyframes: [{t, p, s, r, c, arc, e}] ---------- */
  function keyframes(frames) {
    const f = [];
    let last = { p: [0, 0.5, 0], s: 1, r: [0, 0, 0], c: 'graphite' };
    frames.forEach((k) => { last = { t: k.t, p: k.p || last.p, s: k.s != null ? k.s : last.s, r: k.r || last.r, c: k.c || last.c, arc: k.arc || 0, e: k.e || io }; f.push(last); });
    return function (t) {
      if (t <= f[0].t) return { p: f[0].p, s: f[0].s, r: f[0].r, c0: f[0].c, c1: f[0].c, u: 0 };
      for (let i = 1; i < f.length; i++) {
        const b = f[i];
        if (t <= b.t) {
          const a = f[i - 1];
          const raw = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
          const u = b.e(clamp(raw));
          const p = L3(a.p, b.p, u);
          p[1] += b.arc * Math.sin(Math.PI * clamp(raw));
          return { p, s: lerp(a.s, b.s, u), r: L3(a.r, b.r, u), c0: a.c, c1: b.c, u };
        }
      }
      const z = f[f.length - 1];
      return { p: z.p, s: z.s, r: z.r, c0: z.c, c1: z.c, u: 0 };
    };
  }

  /* ---------- scene builders ---------- */
  function Build() {
    this.items = [];
    this.extras = [];
  }
  Build.prototype.block = function (label, colorKey, poseOrFrames) {
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: P[colorKey].clone(), roughness: 0.38, metalness: 0.06 });
    const mesh = new T.Mesh(GEO, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    const lm = new T.MeshBasicMaterial({ map: tex(String(label)), transparent: true, depthWrite: false });
    const lmDark = tex(String(label), { color: '#3a3c45' });
    const lbl = new T.Mesh(LBL_GEO, lm);
    lbl.position.z = 0.414;
    g.add(lbl);
    root.add(g);
    const pose = typeof poseOrFrames === 'function' ? poseOrFrames : keyframes(poseOrFrames);
    const it = { g, mat, lm, lmLight: lm.map, lmDark, pose };
    this.items.push(it);
    return it;
  };
  // flat caption on the floor; opFn(t) → opacity
  Build.prototype.floor = function (text, w, x, z, opFn, o) {
    const m = new T.MeshBasicMaterial({
      map: tex(text, Object.assign({ w: 1024, h: 128, size: 52, weight: 600, color: '#5c5f69', family: 'Inter, Arial, sans-serif', spacing: 9 }, o)),
      transparent: true, depthWrite: false, opacity: 0
    });
    const pl = new T.Mesh(new T.PlaneGeometry(w, w / 8), m);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(x, 0.012, z);
    root.add(pl);
    this.extras.push((t) => { m.opacity = opFn(t); pl.visible = m.opacity > 0.002; });
    return pl;
  };
  // upright tag (e.g. "◀ top"); fn(t) → {p:[x,y,z], o}
  Build.prototype.tag = function (text, w, fn, color) {
    const m = new T.MeshBasicMaterial({
      map: tex(text, { w: 512, h: 128, size: 66, weight: 600, color: color || '#c9467a', align: 'left' }),
      transparent: true, depthWrite: false, opacity: 0
    });
    const pl = new T.Mesh(new T.PlaneGeometry(w, w / 4), m);
    root.add(pl);
    this.extras.push((t) => { const r = fn(t); pl.position.set(r.p[0], r.p[1], r.p[2]); m.opacity = r.o; pl.visible = r.o > 0.002; });
    return pl;
  };
  Build.prototype.mesh = function (obj, fn) { root.add(obj); this.extras.push((t) => fn(t, obj)); return obj; };
  Build.prototype.glass = function (w, h, d, x, z, opFn) {
    const g = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, h, d)),
      new T.LineBasicMaterial({ color: col('#c4b8c0'), transparent: true, opacity: 0 }));
    g.position.set(x, h / 2, z);
    return this.mesh(g, (t, o) => { o.material.opacity = 0.8 * opFn(t); o.visible = o.material.opacity > 0.002; });
  };
  Build.prototype.lane = function (len, x, z, opFn) {
    const m = new T.MeshStandardMaterial({ color: col('#f1e3ea'), roughness: 0.9, transparent: true, opacity: 0 });
    const l = new T.Mesh(new T.BoxGeometry(len, 0.04, 1.3), m);
    l.position.set(x, 0.02, z);
    l.receiveShadow = true;
    return this.mesh(l, (t, o) => { m.opacity = opFn(t); o.visible = m.opacity > 0.002; });
  };

  function applyItem(it, t) {
    const r = it.pose(t);
    it.g.position.set(r.p[0], r.p[1], r.p[2]);
    const s = Math.max(0.0001, r.s);
    it.g.scale.setScalar(s);
    it.g.visible = r.s > 0.002;
    it.g.rotation.set(r.r[0], r.r[1], r.r[2]);
    if (r.color) it.mat.color.copy(r.color);
    else it.mat.color.copy(P[r.c0]).lerp(P[r.c1], r.u);
    const lightNow = r.color ? false : (r.u < 0.5 ? LIGHT_KEYS[r.c0] : LIGHT_KEYS[r.c1]);
    const want = lightNow ? it.lmDark : it.lmLight;
    if (it.lm.map !== want) { it.lm.map = want; it.lm.needsUpdate = true; }
  }

  // common entry/exit envelope for frames-based blocks
  const Y = 0.5;

  /* =====================================================
     The seven transitions
     ===================================================== */
  const DEFS = [];

  /* 1 → 2 · Unordered data → one linear sequence → single-run traversal */
  DEFS[0] = {
    dur: 2050,
    build(b) {
      const vals = [12, 7, 31, 4, 25, 18, 9];
      const R = rng(7);
      vals.forEach((v, i) => {
        const x = (i - 3) * 1.12;
        const sc = [(R() - 0.5) * 13, 1.6 + R() * 4.2, (R() - 0.5) * 6 - 1];
        const rr = [(R() - 0.5) * 2.4, (R() - 0.5) * 3, (R() - 0.5) * 2];
        const hl = 0.56 + i * 0.026;
        b.block(v, 'gray', [
          { t: 0.02 + i * 0.012, p: sc, s: 0, r: rr, c: 'gray' },
          { t: 0.16 + i * 0.012, s: 1, e: out },
          { t: 0.24 + i * 0.02, p: [sc[0] * 0.92, sc[1] + 0.3, sc[2]] },
          { t: 0.44 + i * 0.022, p: [x, Y, 0], r: [0, 0, 0], c: 'graphite', arc: 1.1 },
          { t: hl, p: [x, Y, 0] },
          { t: hl + 0.03, p: [x, Y + 0.34, 0], c: 'hot', e: out },
          { t: hl + 0.075, p: [x, Y, 0], c: 'graphite' },
          { t: 0.8 + i * 0.016 },
          { t: 0.9 + i * 0.014, p: [x + 1.9, Y + 0.2, 0], s: 0, c: 'pink' }
        ]);
      });
      for (let i = 0; i < 7; i++) b.floor('[' + i + ']', 1.1, (i - 3) * 1.12, 0.95, (t) => fade(t, 0.5, 0.58, 0.84, 0.92), { size: 64, weight: 500, color: '#7a7e89', spacing: 0 });
      b.floor('LINEAR  ·  SEQUENTIAL ORDER  ·  SINGLE RUN', 7.4, 0, 1.75, (t) => fade(t, 0.5, 0.6, 0.84, 0.92));
      // a traversal cursor sweeping along the row
      const cur = new T.Mesh(new T.BoxGeometry(1.0, 0.03, 0.1), new T.MeshBasicMaterial({ color: P.hot, transparent: true, opacity: 0 }));
      b.mesh(cur, (t, o) => {
        const u = seg(t, 0.55, 0.77, lin);
        o.position.set(lerp(-3.36, 3.36, u), 0.02, 0.62);
        o.material.opacity = fade(t, 0.55, 0.58, 0.76, 0.8);
        o.visible = o.material.opacity > 0.01;
      });
    },
    cam: (t) => { const u = io(t); return { p: [lerp(-3.4, 1.2, u), lerp(8.8, 6.0, u), lerp(19, 14.8, u)], l: [lerp(-0.4, 0.4, u), 0.9, 0] }; }
  };

  /* 2 → 3 · Linear sequence → array: contiguous, indexed, direct access */
  DEFS[1] = {
    dur: 2050,
    build(b) {
      const vals = [23, 8, 41, 16, 4, 35, 12, 50, 7, 29];
      vals.forEach((v, i) => {
        const xs = (i - 4.5) * 1.55, x = (i - 4.5) * 1.02;
        const fr = [
          { t: 0.02 + (9 - i) * 0.01, p: [xs - 10, Y, 0], s: 0, c: 'graphite' },
          { t: 0.26 + (9 - i) * 0.008, p: [xs, Y, 0], s: 1, e: out },
          { t: 0.36 },
          { t: 0.5, p: [x, Y, 0] }
        ];
        if (i === 3) fr.push({ t: 0.56 }, { t: 0.63, p: [x, Y + 0.75, 0.25], c: 'hot', e: back }, { t: 0.76 }, { t: 0.82, p: [x, Y, 0], c: 'graphite' });
        else fr.push({ t: 0.82 });
        fr.push({ t: 0.84 + i * 0.011 }, { t: 0.92 + i * 0.007, p: [x, Y + 0.9, 0], s: 0, c: 'pink' });
        b.block(v, 'graphite', fr);
      });
      for (let i = 0; i < 10; i++) b.floor(String(i), 0.9, (i - 4.5) * 1.02, 0.92, (t) => fade(t, 0.47, 0.55, 0.84, 0.92), { size: 66, weight: 500, color: i === 3 ? '#c9467a' : '#7a7e89', spacing: 0 });
      b.floor('int array[10]  ·  CONTIGUOUS  ·  INDEX 0 – 9', 7.6, 0, 1.75, (t) => fade(t, 0.47, 0.57, 0.84, 0.92));
      // the memory strip under the cells closes with them
      const strip = new T.Mesh(new T.BoxGeometry(1, 0.02, 0.06), new T.MeshBasicMaterial({ color: P.pink, transparent: true, opacity: 0 }));
      b.mesh(strip, (t, o) => {
        const u = seg(t, 0.36, 0.5);
        o.scale.x = lerp(15.5, 10.2, u);
        o.position.set(0, 0.02, 0.55);
        o.material.opacity = 0.7 * fade(t, 0.3, 0.4, 0.84, 0.9);
        o.visible = o.material.opacity > 0.01;
      });
      b.tag('array[3]', 1.4, (t) => ({ p: [(3 - 4.5) * 1.02 + 0.2, Y + 1.55, 0.25], o: fade(t, 0.6, 0.66, 0.76, 0.81) }));
    },
    cam: (t) => { const u = io(t); return { p: [lerp(-4.2, 1.6, u), lerp(5.6, 5.2, u), lerp(14.5, 13.2, u)], l: [lerp(-1.4, 0.6, u), 0.8, 0] }; }
  };

  /* 3 → 4 · Array rotated about index 0 becomes a stack; push; LIFO pop-out */
  DEFS[2] = {
    dur: 2250,
    build(b) {
      const vals = [12, 27, 5, 43, 18];
      const d = 1.03, X0 = -2.06;
      const theta = (t) => (Math.PI / 2) * seg(t, 0.24, 0.54);
      const shift = (t) => 2.06 * seg(t, 0.56, 0.66);
      const popAt = (k) => 0.82 + (5 - k) * 0.026; // top leaves first
      vals.forEach((v, i) => {
        b.block(v, 'graphite', (t) => {
          const th = theta(t);
          const x = X0 + i * d * Math.cos(th) + shift(t);
          let y = Y + i * d * Math.sin(th);
          let s = back(clamp((t - 0.03 - i * 0.015) / 0.12));
          const pe = seg(t, popAt(i), popAt(i) + 0.06);
          y += pe * 2.2; s *= 1 - pe;
          const bottom = i === 0 ? fade(t, 0.5, 0.56, 0.62, 0.68) : 0;
          return { p: [x, y, 0], s, r: [0, 0, 0], color: P.graphite.clone().lerp(P.gray, i * 0.12).lerp(P.pink, bottom * 0.8 + pe * 0.6) };
        });
      });
      // the push: a new element lands on top (index 5)
      b.block(36, 'hot', (t) => {
        const u = seg(t, 0.64, 0.76, drop);
        const pe = seg(t, popAt(5), popAt(5) + 0.06);
        return { p: [0, Y + 5 * d + (1 - u) * 6 + pe * 2.2, 0], s: (t > 0.64 ? 1 : 0) * (1 - pe), r: [0, 0, 0], c0: 'hot', c1: 'hot', u: 0 };
      });
      // index labels follow each block: below in the row, to the left in the column
      for (let i = 0; i < 6; i++) {
        b.tag('[' + i + ']', 1.0, (t) => {
          const th = theta(t), sn = Math.sin(th);
          const x = X0 + i * d * Math.cos(th) + shift(t);
          const y = Y + i * d * sn;
          const ox = lerp(-0.25, -1.25, sn), oy = lerp(-0.92, -0.05, sn);
          const show = i < 5 ? fade(t, 0.12, 0.2, popAt(i) - 0.02, popAt(i) + 0.03) : fade(t, 0.72, 0.78, popAt(5) - 0.02, popAt(5) + 0.03);
          return { p: [x + ox, y + oy, 0.45], o: show };
        }, '#7a7e89');
      }
      b.tag('◀ top', 1.5, (t) => {
        const k = t < 0.7 ? 4 : 5;
        const y = Y + (t < 0.7 ? 4 : lerp(4, 5, seg(t, 0.7, 0.78))) * d;
        return { p: [1.4 + (k - 5) * 0, y, 0.2], o: fade(t, 0.6, 0.66, 0.82, 0.86) };
      });
      b.glass(1.3, 6 * d + 0.3, 1.15, 0, 0, (t) => fade(t, 0.58, 0.68, 0.86, 0.95));
      b.floor('ARRAY  →  STACK  ·  INDEX 0 = BOTTOM', 6.6, -0.3, 1.5, (t) => fade(t, 0.3, 0.4, 0.82, 0.9));
    },
    cam: (t) => { const u = io(t); return { p: [lerp(-2.0, 3.0, u), lerp(5.2, 6.4, u), lerp(14.5, 15.5, u)], l: [lerp(-0.9, 0.2, u), lerp(1.1, 2.7, u), 0] }; }
  };

  /* 4 → 5 · The stack runs infix → postfix on A + B * C */
  DEFS[3] = {
    dur: 2500,
    reversible: false,
    build(b) {
      const toks = ['A', '+', 'B', '*', 'C'];
      const IN = (k) => [-6.0 + k * 1.1, Y, -1.4];
      const ST = (k) => [0.4, Y + k * 1.03, 0];
      const OUT = (j) => [2.2 + j * 1.1, Y, 1.5];
      const e = (k) => 0.2 + k * 0.083;               // event k start
      const D = 0.07;
      // event list (from the algorithm):
      // 0 A→out0, 1 +→st0, 2 B→out1, 3 *→st1 (above +), 4 C→out2, 5 *→out3, 6 +→out4
      const plan = {
        0: [[0, OUT(0)]], 1: [[1, ST(0)], [6, OUT(4)]], 2: [[2, OUT(1)]], 3: [[3, ST(1)], [5, OUT(3)]], 4: [[4, OUT(2)]]
      };
      const outIdx = { 0: 0, 2: 1, 4: 2, 3: 3, 1: 4 };
      toks.forEach((tk, k) => {
        const op = tk === '+' || tk === '*';
        const c = op ? 'pink' : 'graphite';
        const fr = [{ t: 0.02 + k * 0.015, p: IN(k), s: 0, c }, { t: 0.14 + k * 0.015, s: 1, e: back }];
        plan[k].forEach(([ev, to], n) => {
          fr.push({ t: e(ev) }, { t: e(ev) + D, p: to, arc: 1.25, c: op && n === 0 ? 'hot' : c });
        });
        const j = outIdx[k];
        fr.push({ t: 0.82 + j * 0.012 }, { t: 0.93 + j * 0.008, p: [OUT(j)[0] + 1.6, Y + 0.3, 1.5], s: 0 });
        b.block(tk, c, fr);
      });
      b.glass(1.3, 2 * 1.03 + 0.4, 1.15, 0.4, 0, (t) => fade(t, 0.1, 0.2, 0.8, 0.88));
      b.floor('INFIX  ·  A + B * C', 4.4, -3.8, -0.4, (t) => fade(t, 0.08, 0.18, 0.62, 0.72));
      b.floor('OPERATOR STACK', 3.6, 0.4, 0.95, (t) => fade(t, 0.12, 0.22, 0.8, 0.88));
      b.floor('POSTFIX  ·  A B C * +', 4.8, 4.4, 2.5, (t) => fade(t, 0.5, 0.6, 0.84, 0.92), { color: '#c9467a' });
    },
    cam: (t) => { const u = io(t); return { p: [lerp(-2.6, 2.2, u), lerp(8.6, 7.4, u), lerp(15.5, 15.0, u)], l: [lerp(-1.6, 1.4, u), 0.8, 0] }; }
  };

  /* 5 → 6 · Postfix output stream → FIFO queue (front out, rear in) */
  DEFS[4] = {
    dur: 2450,
    reversible: false,
    build(b, dir) {
      const A = ['A', 'B', 'C', '*', '+'], Nn = ['10', '20', '30', '40', '50'];
      const first = dir > 0 ? A : Nn, second = dir > 0 ? Nn : A;
      const cOf = (v, isFirst) => (dir > 0 ? (isFirst ? (v === '*' || v === '+' ? 'gray' : 'graphite') : 'pink') : (isFirst ? 'pink' : (v === '*' || v === '+' ? 'gray' : 'graphite')));
      const SL = (j) => [-2.2 + j * 1.1, Y, 0];
      const tc = (c) => 0.2 + c * 0.12;
      first.forEach((v, k) => {
        const c = cOf(v, true);
        const fr = [{ t: 0.02 + k * 0.014, p: SL(k), s: 0, c }, { t: 0.13 + k * 0.014, s: 1, e: back }];
        for (let cy = 0; cy < k; cy++) fr.push({ t: tc(cy) + 0.025 }, { t: tc(cy) + 0.085, p: SL(k - cy - 1) });
        fr.push({ t: tc(k) }, { t: tc(k) + 0.02, c: 'hot' }, { t: tc(k) + 0.08, p: [-4.7, Y, 0], s: 0 });
        b.block(v, c, fr);
      });
      second.forEach((v, m) => {
        const c = cOf(v, false);
        const fr = [{ t: tc(m) + 0.03, p: [4.7, Y, 0], s: 0, c }, { t: tc(m) + 0.1, p: SL(4), s: 1, e: out }];
        for (let cy = m + 1; cy < 5; cy++) fr.push({ t: tc(cy) + 0.025 }, { t: tc(cy) + 0.085, p: SL(4 - (cy - m)) });
        const j = m; // final slot
        fr.push({ t: 0.84 + j * 0.012 }, { t: 0.94 + j * 0.008, p: [SL(j)[0], Y + 0.8, 0], s: 0 });
        b.block(v, c, fr);
      });
      b.lane(8.4, 0, 0, (t) => fade(t, 0.06, 0.16, 0.86, 0.95));
      b.floor('FRONT  ·  DEQUEUE', 3.6, -3.4, 1.05, (t) => fade(t, 0.12, 0.2, 0.84, 0.92), { color: '#c9467a' });
      b.floor('REAR  ·  ENQUEUE', 3.6, 3.4, 1.05, (t) => fade(t, 0.12, 0.2, 0.84, 0.92));
      b.floor('FIFO  ·  FIRST IN, FIRST OUT', 5.2, 0, -1.15, (t) => fade(t, 0.2, 0.3, 0.84, 0.92));
    },
    cam: (t) => { const u = io(t); return { p: [lerp(-1.8, 1.6, u), lerp(6.6, 6.0, u), lerp(14.2, 13.2, u)], l: [lerp(-0.6, 0.6, u), 0.7, 0] }; }
  };

  /* 6 → 7 · Normal queue with freed cells bends into a circular queue */
  DEFS[5] = {
    dur: 2400,
    build(b) {
      const R = 2.55, n = 7;
      const ang = (i, t) => -Math.PI / 2 + (i * 2 * Math.PI) / n + 0.55 * seg(t, 0.62, 0.97);
      const ringP = (i, t) => [R * Math.cos(ang(i, t)), Y, R * Math.sin(ang(i, t))];
      for (let i = 0; i < n; i++) {
        const lineP = [(i - 3) * 1.08, Y, 0.4];
        b.block((i + 1) * 10, 'pink', (t) => {
          const ap = back(clamp((t - 0.03 - i * 0.012) / 0.12));
          const freed = i < 3 ? seg(t, 0.17 + i * 0.05, 0.23 + i * 0.05) : 0;
          const m = seg(t, 0.36 + i * 0.012, 0.6 + i * 0.012);
          const p = L3(lineP, ringP(i, t), m);
          p[1] += 0.7 * Math.sin(Math.PI * m) - freed * 0.09;
          let s = ap * (1 - 0.2 * freed);
          if (i === 0) s *= 1 - seg(t, 0.62, 0.67);
          const ex = seg(t, 0.85 + i * 0.012, 0.94 + i * 0.006);
          s *= 1 - ex; p[1] += ex * 1.2;
          return { p, s, r: [0, 0, 0], c0: 'pink', c1: 'light', u: freed };
        });
      }
      // rear wraps: 80 lands in index 0
      b.block(80, 'hot', (t) => {
        const u = seg(t, 0.64, 0.76, drop);
        const ex = seg(t, 0.85, 0.94);
        const p = ringP(0, t);
        return { p: [p[0], Y + (1 - u) * 6 + ex * 1.2, p[2]], s: (t > 0.64 ? 1 : 0) * (1 - ex), r: [0, 0, 0], c0: 'hot', c1: 'hot', u: 0 };
      });
      const ring = new T.Mesh(new T.RingGeometry(R - 0.05, R + 0.05, 96), new T.MeshBasicMaterial({ color: P.pink, transparent: true, opacity: 0, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      b.mesh(ring, (t, o) => { o.position.y = 0.015; o.material.opacity = 0.55 * fade(t, 0.5, 0.62, 0.86, 0.95); o.visible = o.material.opacity > 0.01; });
      b.floor('FREED BUT UNUSABLE', 4.2, -1.6, 1.55, (t) => fade(t, 0.22, 0.3, 0.36, 0.44), { color: '#9a9da7' });
      b.floor('rear = (rear + 1) % SIZE', 5.2, 0, 3.75, (t) => fade(t, 0.64, 0.72, 0.86, 0.94), { color: '#c9467a', family: '"JetBrains Mono", monospace', spacing: 2, size: 56 });
    },
    cam: (t) => { const u = io(t); return { p: [lerp(-1.2, 0.8, u), lerp(5.4, 9.2, u), lerp(13.5, 11.2, u)], l: [0, lerp(0.8, 0.1, u), lerp(0, -0.2, u)] }; }
  };

  /* 7 → 8 · The circle unrolls and regroups into array, queue and stack */
  DEFS[6] = {
    dur: 2400,
    build(b) {
      const n = 9, R = 2.6;
      const vals = [40, 50, 60, 70, 80, 90, 23, 16, 35];
      const ring = (i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [R * Math.cos(a), Y, R * Math.sin(a)]; };
      const row = (i) => [(i - 4) * 1.08, Y, 0];
      const target = (i) => (i < 3 ? [-3.6 + i * 1.08, Y, 1.4] : i < 6 ? [-2.6 + (i - 3) * 1.08, Y, -1.5] : [2.9, Y + (i - 6) * 1.03, 0]);
      const final = (i) => (i < 3 ? 'graphite' : i < 6 ? 'pink' : 'gray');
      for (let i = 0; i < n; i++) {
        b.block(vals[i], 'pink', [
          { t: 0.02 + i * 0.01, p: ring(i), s: 0, c: 'pink' },
          { t: 0.13 + i * 0.01, s: 1, e: back },
          { t: 0.2 + i * 0.012 },
          { t: 0.42 + i * 0.012, p: row(i), c: 'graphite', arc: 0.5 },
          { t: 0.5 + (i % 3) * 0.02 },
          { t: 0.7 + (i % 3) * 0.02, p: target(i), c: final(i), arc: i >= 6 ? 0.4 : 0.9 },
          { t: 0.84 + i * 0.008 },
          { t: 0.94 + i * 0.005, p: [target(i)[0], target(i)[1] + 0.9, target(i)[2]], s: 0 }
        ]);
      }
      b.glass(1.3, 3 * 1.03 + 0.3, 1.15, 2.9, 0, (t) => fade(t, 0.62, 0.72, 0.86, 0.95));
      b.lane(4.6, -1.5, -1.5, (t) => fade(t, 0.6, 0.7, 0.86, 0.95));
      b.floor('ARRAY', 2.4, -2.5, 2.35, (t) => fade(t, 0.68, 0.76, 0.86, 0.94));
      b.floor('QUEUE  ·  FIFO', 3.4, -1.5, -2.6, (t) => fade(t, 0.68, 0.76, 0.86, 0.94), { color: '#c9467a' });
      b.floor('STACK  ·  LIFO', 3.4, 2.9, 1.15, (t) => fade(t, 0.68, 0.76, 0.86, 0.94));
    },
    cam: (t) => { const u = io(t); return { p: [lerp(0.4, -2.4, u), lerp(9.0, 7.6, u), lerp(11.5, 17.5, u)], l: [lerp(0, 0.2, u), lerp(0.2, 1.0, u), 0] }; }
  };

  /* =====================================================
     Player
     ===================================================== */
  let cur = null, raf = 0;
  function clearScene() {
    while (root.children.length) {
      const o = root.children.pop();
      o.traverse((c) => {
        if (c.geometry && c.geometry !== GEO && c.geometry !== LBL_GEO) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
  }
  function render(t) {
    cur.b.items.forEach((it) => applyItem(it, t));
    cur.b.extras.forEach((fn) => fn(t));
    const c = cur.def.cam(t);
    camera.position.set(c.p[0], c.p[1], c.p[2]);
    camera.lookAt(c.l[0], c.l[1], c.l[2]);
    renderer.render(scene, camera);
  }
  function step(p) {
    const t = cur.reverse ? 1 - p : p;
    render(t);
    cur.onP(p);
  }
  function loop(now) {
    if (!cur) return;
    if (cur.t0 == null) cur.t0 = now;
    const p = Math.min(1, (now - cur.t0) / cur.def.dur);
    step(p);
    if (p >= 1) end();
    else raf = requestAnimationFrame(loop);
  }
  function end() {
    const c = cur;
    cur = null;
    cancelAnimationFrame(raf);
    canvas.style.display = 'none';
    clearScene();
    c.done();
  }

  return {
    count: DEFS.length,
    get busy() { return !!cur; },
    /** play transition between slide `pair` and `pair + 1`; dir = +1 forward, -1 back */
    play(pair, dir, onP, done) {
      if (cur) this.finish();
      const def = DEFS[pair];
      if (!def) { onP(1); done(); return; }
      clearScene();
      const b = new Build();
      def.build(b, dir);
      cur = { def, b, reverse: dir < 0 && def.reversible !== false, onP, done, t0: null };
      canvas.style.display = 'block';
      step(0);
      raf = requestAnimationFrame(loop);
    },
    finish() { if (!cur) return; step(1); end(); },
    setScaleFactor(k) {
      renderer.setPixelRatio(Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * k)));
      renderer.setSize(W, H, false);
    },
    /** compile every transition's shaders once so the first play does not stutter */
    warm() {
      DEFS.forEach((def) => { const b = new Build(); def.build(b, 1); cur = { def, b }; render(0.5); cur = null; clearScene(); });
      renderer.clear();
    },
    /** testing hook: render a transition frozen at progress p */
    _freeze(pair, dir, p) {
      clearScene(); const def = DEFS[pair]; const b = new Build(); def.build(b, dir);
      cur = { def, b, reverse: dir < 0 && def.reversible !== false, onP() {}, done() {} };
      canvas.style.display = 'block'; step(p); cur = null;
    }
  };
})();
