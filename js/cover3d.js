/* =========================================================
   Cover 3D scene — array, stack and queue rendered as data
   blocks. One WebGL renderer, moved between the cover and
   the conclusion slide; it only renders while one is active.
   ========================================================= */
window.Cover3D = (function () {
  'use strict';
  if (!window.THREE) return null;
  const T = THREE;
  const W = 1600, H = 900;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setSize(W, H, false);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const col = (h) => new T.Color(h).convertSRGBToLinear();
  const C = {
    navy: col('#464953'), navy2: col('#5c5f69'), steel: col('#cf5f8d'),
    pale: col('#d9d3d8'), amber: col('#ee7aa8'), ink: '#2c2e35', faint: '#9a9da7'
  };

  const scene = new T.Scene();
  scene.fog = new T.Fog(col('#f6f1f4'), 30, 56);

  const camera = new T.PerspectiveCamera(30, W / H, 0.1, 200);
  // shift the projection so the composition sits on the right of the frame,
  // leaving the left side clear for the title and academic details
  const VIEWS = {
    cover: { ox: -0.205, oy: 0.0, dist: 1.0 },
    end: { ox: -0.285, oy: 0.1, dist: 1.28 }
  };
  let view = VIEWS.cover;
  function applyView(v) { view = v; camera.setViewOffset(W, H, W * v.ox, H * v.oy, W, H); }
  applyView(view);
  const target = new T.Vector3(0.9, 1.3, 0.1);
  const camBase = new T.Vector3(-3.6, 10.2, 20.5);
  const camIntro = new T.Vector3(-8.5, 14.5, 27);

  /* ---------- lights ---------- */
  scene.add(new T.HemisphereLight(col('#ffffff'), col('#dcd2d8'), 0.85));
  const key = new T.DirectionalLight(col('#ffffff'), 0.95);
  key.position.set(-7, 15, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  key.shadow.radius = 4;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new T.DirectionalLight(col('#ffc4da'), 0.45);
  rim.position.set(10, 6, -8);
  scene.add(rim);

  /* ---------- ground ---------- */
  const ground = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: 0.11 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new T.GridHelper(44, 40, col('#d8d0d5'), col('#e9e3e7'));
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.position.y = 0.001;
  scene.add(grid);

  /* ---------- geometry & text textures ---------- */
  function blockGeo() {
    const s = 0.86, r = 0.1, x = -s / 2, y = -s / 2;
    const sh = new T.Shape();
    sh.moveTo(x + r, y); sh.lineTo(x + s - r, y); sh.quadraticCurveTo(x + s, y, x + s, y + r);
    sh.lineTo(x + s, y + s - r); sh.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    sh.lineTo(x + r, y + s); sh.quadraticCurveTo(x, y + s, x, y + s - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    const g = new T.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6 });
    g.center();
    return g;
  }
  const GEO = blockGeo();          // ≈ 0.98 × 0.98 × 0.82
  const HALF_Z = 0.41;

  const texCache = new Map();
  function textTex(text, opt) {
    const o = Object.assign({ w: 256, h: 256, size: 118, weight: 600, color: '#ffffff', family: '"JetBrains Mono", Menlo, monospace', spacing: 0, align: 'center' }, opt);
    const k = JSON.stringify([text, o]);
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas');
    c.width = o.w; c.height = o.h;
    const g = c.getContext('2d');
    g.fillStyle = o.color;
    g.font = `${o.weight} ${o.size}px ${o.family}`;
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = o.spacing + 'px';
    g.textAlign = o.align;
    g.fillText(text, o.align === 'left' ? 8 : o.w / 2, o.h / 2 + o.size * 0.04);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 8;
    texCache.set(k, t);
    return t;
  }
  function plane(tex, w, h) {
    const m = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    return new T.Mesh(new T.PlaneGeometry(w, h), m);
  }
  function floorText(text, w, h, x, z, opt) {
    const p = plane(textTex(text, Object.assign({ w: 1024, h: 128, size: 54, weight: 500, color: C.faint, family: 'Inter, Arial, sans-serif', spacing: 10 }, opt)), w, h);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.01, z);
    scene.add(p);
    return p;
  }

  function makeBlock(value, color) {
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: color || C.navy, roughness: 0.38, metalness: 0.06 });
    const mesh = new T.Mesh(GEO, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    const lbl = plane(textTex(String(value)), 0.62, 0.62);
    lbl.position.z = HALF_Z + 0.004;
    g.add(lbl);
    g.userData = { mat, base: mat.color.clone() };
    scene.add(g);
    return g;
  }

  /* ---------- tiny tween engine on scene time ---------- */
  let now = 0;
  const tweens = [];
  const E = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    drop: (t) => { // ease out with a small settle
      if (t < 0.78) { const u = t / 0.78; return u * u * (3 - 2 * u) * 1.03; }
      const u = (t - 0.78) / 0.22; return 1.03 - 0.03 * Math.sin(u * Math.PI / 2);
    }
  };
  function tw(dur, fn, ease, delay) {
    return new Promise((res) => tweens.push({ t0: now + (delay || 0), dur, fn, ease: ease || E.io, res }));
  }
  const wait = (ms) => tw(ms, () => {}, E.io);
  function stepTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i];
      const p = (now - t.t0) / t.dur;
      if (p < 0) continue;
      const q = Math.min(1, p);
      t.fn(t.ease(q));
      if (q === 1) { tweens.splice(i, 1); t.res(); }
    }
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = () => 2 + Math.floor(Math.random() * 97);

  /* =====================================================
     ARRAY — 8 indexed cells (front row)
     ===================================================== */
  const AZ = 2.1, AX0 = -3.85, AS = 1.1;
  const arrVals = [23, 8, 41, 16, 4, 35, 12, 50];
  const arr = arrVals.map((v, i) => {
    const b = makeBlock(v, C.navy);
    b.position.set(AX0 + i * AS, 0.49, AZ);
    b.scale.setScalar(0.0001);
    return b;
  });
  const idxLbls = arrVals.map((_, i) => {
    const p = plane(textTex(String(i), { size: 120, weight: 500, color: '#6a6d78' }), 0.42, 0.42);
    p.rotation.x = -Math.PI / 2;
    p.position.set(AX0 + i * AS, 0.012, AZ + 0.86);
    p.material.opacity = 0;
    scene.add(p);
    return p;
  });
  const capArr = floorText('ARRAY  ·  INDEX 0 – 7', 5.2, 0.65, -1.45, AZ + 1.6, { align: 'left', color: '#4a4d57', weight: 600 });

  /* =====================================================
     QUEUE — conveyor lane behind the array
     ===================================================== */
  const QZ = -1.55, QX0 = -3.3, QS = 1.1, QN = 5;
  const lane = new T.Mesh(new T.BoxGeometry(7.6, 0.05, 1.3), new T.MeshStandardMaterial({ color: col('#f1e6ec'), roughness: 0.9 }));
  lane.position.set(-1.1, 0.025, QZ);
  lane.receiveShadow = true;
  scene.add(lane);
  const queue = [];
  for (let k = 0; k < QN; k++) {
    const b = makeBlock(rnd(), C.steel);
    b.position.set(QX0 + k * QS + 6, 0.49 + 0.05, QZ);
    b.scale.setScalar(0.0001);
    queue.push(b);
  }
  floorText('FRONT', 2.4, 0.3, -3.3, QZ + 0.98, { size: 60, color: '#7a7e89' });
  floorText('REAR', 2.4, 0.3, 1.1, QZ + 0.98, { size: 60, color: '#7a7e89' });
  const capQ = floorText('QUEUE  ·  FIFO', 4.0, 0.5, -1.1, QZ + 1.0, { color: '#4a4d57', weight: 600 });

  /* =====================================================
     STACK — vertical column with a bounded container
     ===================================================== */
  const SX = 5.0, SZ = -0.5, SN = 6, SY = 1.02;
  const glassH = SN * SY + 0.25;
  const glass = new T.Mesh(new T.BoxGeometry(1.3, glassH, 1.15),
    new T.MeshStandardMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.12, roughness: 0.1, depthWrite: false }));
  glass.position.set(SX, glassH / 2, SZ);
  scene.add(glass);
  const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.3, glassH, 1.15)),
    new T.LineBasicMaterial({ color: col('#c0b6bd'), transparent: true, opacity: 0.7 }));
  edges.position.copy(glass.position);
  scene.add(edges);
  const capS = floorText('STACK  ·  LIFO', 3.6, 0.45, SX + 1.0, SZ + 1.35, { color: '#4a4d57', weight: 600 });
  const stack = [];
  const topMark = plane(textTex('◀ top', { w: 512, h: 128, size: 70, weight: 600, color: '#c9467a', family: '"JetBrains Mono", Menlo, monospace', align: 'left' }), 1.6, 0.4);
  topMark.position.set(SX + 1.45, 0.5, SZ + 0.6);
  topMark.material.opacity = 0;
  scene.add(topMark);

  /* ---------- choreography ---------- */
  function setScale(b, s) { b.scale.setScalar(Math.max(0.0001, s)); }

  async function pushStack(fromIntro) {
    if (stack.length >= SN) return;
    const b = makeBlock(rnd(), stack.length % 2 ? C.navy2 : C.navy);
    const y = 0.49 + stack.length * SY;
    b.position.set(SX, y + 6.5, SZ);
    setScale(b, 1);
    stack.push(b);
    const startY = b.position.y;
    const markFrom = topMark.position.y;
    tw(620, (t) => { topMark.position.y = lerp(markFrom, y, t); topMark.material.opacity = Math.max(topMark.material.opacity, t); }, E.out, fromIntro ? 0 : 200);
    await tw(760, (t) => { b.position.y = lerp(startY, y, t); }, E.drop);
  }
  async function popStack() {
    if (!stack.length) return;
    const b = stack.pop();
    const y0 = b.position.y;
    const ny = 0.49 + Math.max(0, stack.length - 1) * SY;
    const m0 = topMark.position.y;
    b.userData.mat.color.copy(C.amber);
    tw(600, (t) => { topMark.position.y = lerp(m0, ny, t); }, E.io, 250);
    await tw(700, (t) => { b.position.y = y0 + t * 3.2; setScale(b, 1 - t * t); }, E.io);
    scene.remove(b);
  }

  async function dequeueEnqueue() {
    const f = queue.shift();
    f.userData.mat.color.copy(C.amber);
    const fx = f.position.x;
    const pExit = tw(700, (t) => { f.position.x = fx - t * 1.9; setScale(f, 1 - t); }, E.io);
    queue.forEach((b, k) => {
      const x0 = b.position.x, x1 = QX0 + k * QS;
      tw(650, (t) => { b.position.x = lerp(x0, x1, t); }, E.io, 160);
    });
    await pExit;
    scene.remove(f);
    const n = makeBlock(rnd(), C.steel);
    const x1 = QX0 + (QN - 1) * QS;
    n.position.set(x1 + 2.2, 0.54, QZ);
    setScale(n, 0.0001);
    queue.push(n);
    await tw(760, (t) => { n.position.x = lerp(x1 + 2.2, x1, t); setScale(n, Math.min(1, t * 1.4)); }, E.out);
  }

  async function arrayCursor() {
    let i = 0;
    for (;;) {
      const b = arr[i];
      const m = b.userData.mat;
      tw(380, (t) => { b.position.y = 0.49 + 0.32 * t; m.color.copy(b.userData.base).lerp(C.amber, t); idxLbls[i].material.color.setRGB(1, 1 - 0.35 * t, 1 - 0.75 * t); }, E.out);
      await wait(620);
      const bi = i;
      tw(420, (t) => { b.position.y = 0.81 - 0.32 * t; m.color.copy(C.amber).lerp(b.userData.base, t); idxLbls[bi].material.color.setRGB(1, 1, 1); }, E.io);
      i = (i + 1) % arr.length;
      if (i === 0) await wait(900);
    }
  }
  async function stackLoop() {
    for (;;) {
      await wait(1500);
      const n = stack.length;
      if (n <= 2) await pushStack();
      else if (n >= 5) await popStack();
      else (Math.random() < 0.55 ? await pushStack() : await popStack());
    }
  }
  async function queueLoop() {
    for (;;) { await wait(1900); await dequeueEnqueue(); }
  }

  let started = false;
  async function intro() {
    started = true;
    // camera dolly-in
    const c0 = camIntro.clone();
    tw(3600, (t) => { camPos.lerpVectors(c0, camBase, t); }, E.out);
    // array cells rise in
    arr.forEach((b, i) => {
      tw(800, (t) => { setScale(b, E.back(t)); b.position.y = 0.49 + (1 - t) * 1.4; }, E.out, 350 + i * 85);
      tw(600, (t) => { idxLbls[i].material.opacity = t; }, E.io, 700 + i * 85);
    });
    // queue slides in from the right
    queue.forEach((b, k) => {
      const x1 = QX0 + k * QS, x0 = x1 + 6;
      tw(1100, (t) => { b.position.x = lerp(x0, x1, t); setScale(b, Math.min(1, t * 1.6)); }, E.out, 800 + k * 110);
    });
    // stack drops in
    await wait(1200);
    for (let k = 0; k < 3; k++) { pushStack(true); await wait(300); }
    await wait(1500);
    arrayCursor(); stackLoop(); queueLoop();
  }
  function instant() {
    started = true;
    camPos.copy(camBase);
    arr.forEach((b, i) => { setScale(b, 1); b.position.y = 0.49; idxLbls[i].material.opacity = 1; });
    queue.forEach((b, k) => { b.position.x = QX0 + k * QS; setScale(b, 1); });
    for (let k = 0; k < 3; k++) {
      const b = makeBlock(rnd(), k % 2 ? C.navy2 : C.navy);
      b.position.set(SX, 0.49 + k * SY, SZ); stack.push(b);
    }
    topMark.position.y = 0.49 + 2 * SY; topMark.material.opacity = 1;
  }

  /* ---------- camera drift + pointer parallax ---------- */
  const camPos = camIntro.clone();
  const look = target.clone();
  let px = 0, py = 0, sx = 0, sy = 0;
  addEventListener('pointermove', (e) => {
    px = (e.clientX / innerWidth - 0.5);
    py = (e.clientY / innerHeight - 0.5);
  });

  /* ---------- loop ---------- */
  let active = false, raf = 0, last = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, ts - (last || ts));
    last = ts;
    if (!reduce) now += dt;
    stepTweens();
    const s = now / 1000;
    sx += (px - sx) * 0.04; sy += (py - sy) * 0.04;
    const ang = reduce ? 0 : Math.sin(s * 0.12) * 0.09 + sx * 0.12;
    const r = Math.hypot(camPos.x - target.x, camPos.z - target.z);
    const a0 = Math.atan2(camPos.x - target.x, camPos.z - target.z);
    const d = view.dist;
    camera.position.set(
      target.x + Math.sin(a0 + ang) * r * d,
      target.y + (camPos.y - target.y) * d + (reduce ? 0 : Math.sin(s * 0.21) * 0.25) - sy * 0.6,
      target.z + Math.cos(a0 + ang) * r * d);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  function setScaleFactor(k) {
    renderer.setPixelRatio(Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * k)));
    renderer.setSize(W, H, false);
  }

  return {
    attach(host, viewName) {
      applyView(VIEWS[viewName] || VIEWS.cover);
      if (renderer.domElement.parentNode !== host) host.appendChild(renderer.domElement);
      if (!started) (reduce ? instant() : intro());
      if (!active) { active = true; last = 0; raf = requestAnimationFrame(frame); }
    },
    pause() { active = false; cancelAnimationFrame(raf); },
    setScaleFactor
  };
})();
