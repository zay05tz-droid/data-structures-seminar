/* =========================================================
   Interactive demonstrations, one module per slide.
   Each module exposes enter() / leave() for the deck.
   ========================================================= */
window.Demos = (function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const replay = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  function setStatus(node, html, kind) {
    node.className = 'status' + (kind ? ' ' + kind : '') + (node.id === 'arrStatus' ? '' : '');
    node.innerHTML = html;
  }

  /* ---------------------------------------------------------
     Slide 2 — linear vs non-linear traversal, tabs
     --------------------------------------------------------- */
  const S2 = (function () {
    // linear: 7 nodes in one run
    const lx = (i) => 40 + i * 80, ly = 50;
    const linN = [], linE = [];
    const gE = $('#linEdges'), gN = $('#linNodes');
    for (let i = 0; i < 7; i++) {
      if (i) { const e = svg('line', { x1: lx(i - 1) + 16, y1: ly, x2: lx(i) - 16, y2: ly, class: 'edge' }); gE.appendChild(e); linE.push(e); }
      const c = svg('circle', { cx: lx(i), cy: ly, r: 15, class: 'node' }); gN.appendChild(c); linN.push(c);
      const t = svg('text', { x: lx(i), y: ly + 36, class: 'nlabel' }); t.textContent = '[' + i + ']'; gN.appendChild(t);
    }
    // non-linear: tree
    const tN = [[280, 18], [170, 56], [390, 56], [110, 94], [230, 94], [330, 94], [450, 94]];
    const tE = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
    const tg = $('#treeEdges'), tn = $('#treeNodes');
    const treeE = tE.map(([a, b]) => { const e = svg('line', { x1: tN[a][0], y1: tN[a][1], x2: tN[b][0], y2: tN[b][1], class: 'edge' }); tg.appendChild(e); return e; });
    const treeN = tN.map(([x, y]) => { const c = svg('circle', { cx: x, cy: y, r: 12, class: 'node' }); tn.appendChild(c); return c; });
    const levels = [[0], [1, 2], [3, 4, 5, 6]];

    let timer = 0, step = 0;
    function tick() {
      // linear: a single run, one element after another
      const L = 9; const i = step % L;
      linN.forEach((n, k) => { n.classList.toggle('on', k < i && i <= 7); n.classList.toggle('hot', k === i - 1 && i <= 7); });
      linE.forEach((e, k) => e.classList.toggle('on', k < i - 1 && i <= 7));
      // tree: branching — several successors at once
      const j = step % 5;
      treeN.forEach((n, k) => {
        const lv = levels.findIndex((l) => l.includes(k));
        n.classList.toggle('on', lv < j && j <= 3);
        n.classList.toggle('hot', lv === j - 1 && j <= 3);
      });
      treeE.forEach((e, k) => { const lv = levels.findIndex((l) => l.includes(tE[k][1])); e.classList.toggle('on', lv < j && j <= 3); });
      step++;
    }
    // tabs
    $$('.s2 .tabs button').forEach((b) => b.addEventListener('click', () => {
      $$('.s2 .tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
      $$('.s2 .tabpane').forEach((p) => p.classList.toggle('on', p.dataset.pane === b.dataset.tab));
    }));
    return {
      enter() { step = 0; clearInterval(timer); setTimeout(tick, 900); timer = setInterval(tick, 560); },
      leave() { clearInterval(timer); }
    };
  })();

  /* ---------------------------------------------------------
     Slide 3 — arrays
     --------------------------------------------------------- */
  const S3 = (function () {
    const vals = [23, 8, 41, 16, 4, 35, 12, 50, 7, 29];
    const host = $('#arr');
    const blks = [], idxs = [];
    vals.forEach((v, i) => {
      const c = el('div', 'cell');
      const b = el('div', 'blk', String(v));
      b.setAttribute('role', 'button'); b.tabIndex = -1;
      const ix = el('button', 'idx', String(i));
      ix.setAttribute('aria-label', 'Access array[' + i + ']');
      b.addEventListener('click', () => access(i));
      ix.addEventListener('click', () => access(i));
      c.append(b, ix); host.appendChild(c);
      blks.push(b); idxs.push(ix);
    });
    let sel = 3;
    function access(i) {
      sel = i;
      blks.forEach((b, k) => { b.classList.toggle('sel', k === i); b.classList.toggle('hot', k === i); });
      idxs.forEach((x, k) => x.classList.toggle('sel', k === i));
      $('#arrExpr').textContent = 'array[' + i + ']';
      const v = $('#arrVal'); v.textContent = vals[i]; replay(v, 'pulse');
    }
    // static size
    const st = $('#arrStatus');
    const oobHTML = st.innerHTML;
    function bindOob() {
      $('#arrOob').addEventListener('click', () => {
        replay(host, 'shake');
        st.className = 'status err';
        st.style.cssText = 'min-height:40px;padding:8px 12px;font-size:14.5px';
        st.innerHTML = 'Index <code>10</code> is outside <code>0–9</code>: the size is fixed at 10 for the whole run.';
        setTimeout(() => { st.className = 'status'; st.innerHTML = oobHTML; bindOob(); }, 4200);
      });
    }
    bindOob();

    // loops
    const code = $('#loopCode'), viz = $('#loopViz'), vars = $('#loopVars'), title = $('#loopTitle');
    let dim = 1, run = 0;
    const CODE = {
      1: [['l0', '<span class="kw">for</span> (i = <span class="nu">0</span>; i &lt; <span class="nu">10</span>; i++)'], ['l1', '    read array[i];']],
      2: [['l0', '<span class="kw">for</span> (i = <span class="nu">0</span>; i &lt; <span class="nu">3</span>; i++)'], ['l1', '  <span class="kw">for</span> (j = <span class="nu">0</span>; j &lt; <span class="nu">4</span>; j++)'], ['l2', '    read m[i][j];']]
    };
    let cells = [];
    function build() {
      code.innerHTML = CODE[dim].map(([k, h]) => `<span class="ln" data-l="${k}">${h}</span>`).join('');
      viz.innerHTML = '';
      cells = [];
      if (dim === 1) {
        title.textContent = 'One dimension → one loop';
        const row = el('div', 'loop-1d');
        vals.forEach((v) => { const b = el('div', 'blk empty', String(v)); row.appendChild(b); cells.push(b); });
        viz.appendChild(row);
        vars.innerHTML = '<span>i = <b>–</b></span>';
      } else {
        title.textContent = 'Two dimensions → two nested loops · int m[3][4]';
        const g = el('div', 'grid2');
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const b = el('div', 'blk empty', i + ',' + j); g.appendChild(b); cells.push(b); }
        viz.appendChild(g);
        vars.innerHTML = '<span>i = <b>–</b></span><span>j = <b>–</b></span>';
      }
    }
    function hit(k) { $$('.ln', code).forEach((l) => l.classList.toggle('hit', l.dataset.l === k)); }
    async function runLoop() {
      const my = ++run;
      build();
      $('#loopRun').disabled = true;
      await sleep(250);
      if (dim === 1) {
        for (let i = 0; i < 10; i++) {
          if (my !== run) return;
          hit('l0'); vars.innerHTML = `<span>i = <b>${i}</b></span>`;
          await sleep(160); if (my !== run) return;
          hit('l1'); cells[i].className = 'blk hot';
          if (i) cells[i - 1].className = 'blk';
          await sleep(260);
        }
        cells[9].className = 'blk';
      } else {
        for (let i = 0; i < 3; i++) {
          if (my !== run) return;
          hit('l0'); vars.innerHTML = `<span>i = <b>${i}</b></span><span>j = <b>–</b></span>`;
          await sleep(320);
          for (let j = 0; j < 4; j++) {
            if (my !== run) return;
            hit('l1'); vars.innerHTML = `<span>i = <b>${i}</b></span><span>j = <b>${j}</b></span>`;
            await sleep(140); if (my !== run) return;
            hit('l2');
            const k = i * 4 + j;
            cells[k].className = 'blk hot';
            if (k) cells[k - 1].className = 'blk';
            await sleep(240);
          }
        }
        cells[11].className = 'blk';
      }
      hit('');
      $('#loopRun').disabled = false;
    }
    $$('.s3 .seg button').forEach((b) => b.addEventListener('click', () => {
      $$('.s3 .seg button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      dim = +b.dataset.dim; run++; $('#loopRun').disabled = false; build();
    }));
    $('#loopRun').addEventListener('click', runLoop);
    build();

    let autoT = 0;
    return {
      enter() { access(3); clearTimeout(autoT); autoT = setTimeout(() => { if (!$('#loopRun').disabled) runLoop(); }, 1400); },
      leave() { clearTimeout(autoT); run++; $('#loopRun').disabled = false; build(); }
    };
  })();

  /* ---------------------------------------------------------
     Slide 4 — stack (array implementation, N = 6)
     --------------------------------------------------------- */
  const S4 = (function () {
    const N = 6, SLOT = 72, BASE = 8;
    const tube = $('#tube');
    const stack = []; let top = -1;
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const l = el('div', 'slotlbl', '[' + i + ']');
      l.style.bottom = (BASE + i * SLOT + 24) + 'px';
      tube.appendChild(l);
    }
    const ptr = el('div', 'topptr', 'top');
    tube.appendChild(ptr);
    const seq = [12, 27, 5, 43, 18, 36, 9, 21, 14, 30];
    let seqI = 0;
    const status = $('#stStatus'), hist = $('#stHist');
    function nextVal() { return seq[seqI % seq.length]; }
    function code(lines) {
      const ls = $$('#stCode .ln');
      ls.forEach((l) => l.classList.remove('hit'));
      lines.forEach((k, i) => setTimeout(() => ls.forEach((l) => l.classList.toggle('hit', l.dataset.l === k)), i * 260));
      setTimeout(() => ls.forEach((l) => l.classList.remove('hit')), lines.length * 260 + 1400);
    }
    function sync() {
      $('#topLbl').innerHTML = 'top = <b>' + top + '</b>';
      ptr.style.bottom = (BASE + Math.max(top, -0.6) * SLOT + 22) + 'px';
      ptr.style.opacity = top < 0 ? .45 : 1;
      ptr.textContent = top < 0 ? 'top = -1' : 'top';
      $('#stNext').textContent = nextVal();
      nodes.forEach((n, i) => n.classList.toggle('hot', i === top));
    }
    function push() {
      if (top === N - 1) {
        code(['p0', 'p1']);
        setStatus(status, '<b>Overflow</b> — <code>IsFull()</code> is true (<code>top == N - 1 = 5</code>). Nothing is pushed.', 'err');
        replay(tube, 'shake');
        return;
      }
      const v = nextVal(); seqI++;
      top++; stack[top] = v;
      const b = el('div', 'blk enter', String(v));
      b.style.bottom = (BASE + top * SLOT) + 'px';
      tube.appendChild(b); nodes.push(b);
      code(['p0', 'p1', 'p2', 'p3']);
      setStatus(status, `Pushed <code>${v}</code> onto the top: <code>top</code> incremented to <code>${top}</code>, <code>stack[${top}] = ${v}</code>.`, 'ok');
      sync();
    }
    function pop() {
      if (top === -1) {
        code(['o0', 'o1']);
        setStatus(status, '<b>Underflow</b> — <code>IsEmpty()</code> is true (<code>top == -1</code>). Nothing to pop.', 'err');
        return;
      }
      const v = stack[top];
      const b = nodes.pop();
      b.classList.remove('enter'); b.classList.add('hot', 'leaving');
      setTimeout(() => b.remove(), 520);
      top--;
      code(['o0', 'o1', 'o2', 'o3']);
      setStatus(status, `Popped <code>${v}</code> from the top — the last item stored is the first retrieved. <code>top</code> decremented to <code>${top}</code>.`, 'warn');
      if (hist.querySelector('span:not(.chip-v)')) hist.innerHTML = '';
      hist.appendChild(el('span', 'chip-v', String(v)));
      sync();
    }
    $('#stPush').addEventListener('click', push);
    $('#stPop').addEventListener('click', pop);
    $('#stEmpty').addEventListener('click', () => { code(['e0']); setStatus(status, `<code>IsEmpty()</code> → <b>${top === -1}</b> &nbsp;(top = ${top})`, top === -1 ? 'warn' : ''); });
    $('#stFull').addEventListener('click', () => { code(['f0']); setStatus(status, `<code>IsFull()</code> → <b>${top === N - 1}</b> &nbsp;(top = ${top}, N - 1 = ${N - 1})`, top === N - 1 ? 'warn' : ''); });
    sync();

    let seeded = false;
    return {
      async enter() {
        if (seeded) return; seeded = true;
        await sleep(900); push(); await sleep(450); push(); await sleep(450); push();
      },
      leave() {}
    };
  })();

  /* ---------------------------------------------------------
     Slide 5 — infix → postfix tracer
     --------------------------------------------------------- */
  const S5 = (function () {
    const EX = [
      ['A', '*', 'B', '+', 'C'],
      ['A', '+', 'B', '*', 'C'],
      ['A', '*', '(', 'B', '+', 'C', ')'],
      ['A', '-', 'B', '+', 'C']
    ];
    const show = (t) => (t === '-' ? '−' : t);
    const prec = (t) => (t === '+' || t === '-' ? 1 : t === '*' || t === '/' ? 2 : 0);
    const isOp = (t) => '+-*/'.includes(t);

    function trace(tokens) {
      const steps = [];
      const st = [], out = [];
      const snap = (i, msg) => steps.push({ i, st: st.slice(), out: out.slice(), msg });
      snap(-1, 'Read the infix expression from left to right.');
      tokens.forEach((t, i) => {
        const tok = { t, id: i };
        if (/[A-Z]/.test(t)) { out.push(tok); snap(i, `Operand <code>${t}</code> is output as soon as it is read.`); }
        else if (t === '(') { st.push(tok); snap(i, '<code>(</code> is pushed onto the stack.'); }
        else if (t === ')') {
          const rel = [];
          while (st.length && st[st.length - 1].t !== '(') { const o = st.pop(); out.push(o); rel.push(show(o.t)); }
          st.pop();
          snap(i, `<code>)</code> releases <code>${rel.join(' ')}</code> to the output; the <code>(</code> is removed.`);
        } else {
          const rel = [];
          while (st.length && isOp(st[st.length - 1].t) && prec(st[st.length - 1].t) >= prec(t)) { const o = st.pop(); out.push(o); rel.push(show(o.t)); }
          const below = st.length ? st[st.length - 1].t : null;
          st.push(tok);
          let msg;
          if (rel.length) msg = `The earlier operator <code>${rel.join(' ')}</code> is output before <code>${show(t)}</code> is pushed.`;
          else if (below && isOp(below)) msg = `<code>${show(t)}</code> is pushed above <code>${show(below)}</code> — it must leave the stack first.`;
          else if (below === '(') msg = `<code>${show(t)}</code> is pushed above the <code>(</code>.`;
          else msg = `<code>${show(t)}</code> is pushed onto the empty stack — it waits for its second operand.`;
          snap(i, msg);
        }
      });
      if (st.length) {
        const rel = [];
        while (st.length) { const o = st.pop(); out.push(o); rel.push(show(o.t)); }
        snap(tokens.length, `At the end of the input, <code>${rel.join(' ')}</code> ${rel.length > 1 ? 'are' : 'is'} released from the stack.`);
      }
      return steps;
    }

    const exHost = $('#pfEx'), inH = $('#pfIn'), stH = $('#pfStack'), outH = $('#pfOut'), msg = $('#pfMsg');
    let ex = 2, steps = [], k = 0, prevIds = new Set(), playT = 0;
    EX.forEach((tokens, n) => {
      const b = el('button', 'chip', tokens.map(show).join(' '));
      b.setAttribute('aria-pressed', n === ex);
      b.addEventListener('click', () => { $$('.chip', exHost).forEach((x) => x.setAttribute('aria-pressed', x === b)); load(n); });
      exHost.appendChild(b);
    });

    const opCls = (t) => (t === '(' || t === ')' ? 'blk steel' : isOp(t) ? 'blk hot' : 'blk');
    function load(n) { stop(); ex = n; steps = trace(EX[n]); k = 0; prevIds = new Set(); render(); }
    function render() {
      const s = steps[k], tokens = EX[ex];
      inH.innerHTML = '';
      tokens.forEach((t, i) => {
        const b = el('div', opCls(t), show(t));
        if (i < s.i || (s.i >= tokens.length)) b.classList.add('done');
        if (i === s.i) b.classList.add('cur');
        inH.appendChild(b);
      });
      const cap = stH.querySelector('.opstack-cap');
      stH.innerHTML = ''; stH.appendChild(cap);
      const ids = new Set();
      s.st.forEach((o) => { const b = el('div', opCls(o.t), show(o.t)); if (!prevIds.has('s' + o.id)) b.classList.add('enter'); ids.add('s' + o.id); stH.appendChild(b); });
      outH.innerHTML = '';
      s.out.forEach((o) => { const b = el('div', opCls(o.t), show(o.t)); if (!prevIds.has('o' + o.id)) b.classList.add('enterx'); ids.add('o' + o.id); outH.appendChild(b); });
      prevIds = ids;
      msg.innerHTML = s.msg;
      msg.className = 'status tr-msg' + (k === steps.length - 1 ? ' ok' : '');
      $('#pfNo').textContent = `Step ${k} of ${steps.length - 1}`;
      const last = steps[steps.length - 1];
      const done = k === steps.length - 1;
      $('#pfResCode').textContent = done ? last.out.map((o) => show(o.t)).join(' ') : '…';
      $('#pfRes').classList.toggle('done', done);
      $('#pfStep').disabled = done;
      $('#pfBack').disabled = k === 0;
    }
    function stepF() { if (k < steps.length - 1) { k++; render(); } else stop(); }
    function back() { stop(); if (k > 0) { k--; prevIds = new Set(); render(); } }
    function play() {
      if (playT) { stop(); return; }
      if (k === steps.length - 1) { k = 0; prevIds = new Set(); render(); }
      $('#pfPlay').textContent = 'Pause';
      playT = setInterval(() => { stepF(); if (k === steps.length - 1) stop(); }, 1500);
    }
    function stop() { clearInterval(playT); playT = 0; $('#pfPlay').textContent = 'Play'; }
    $('#pfStep').addEventListener('click', () => { stop(); stepF(); });
    $('#pfBack').addEventListener('click', back);
    $('#pfReset').addEventListener('click', () => load(ex));
    $('#pfPlay').addEventListener('click', play);
    load(ex);
    return { enter() {}, leave() { stop(); } };
  })();

  /* ---------------------------------------------------------
     Slide 6 — linear queue exactly as in the lecture algorithm
     --------------------------------------------------------- */
  const S6 = (function () {
    const SIZE = 6, X0 = 62, STEP = 82;
    const track = $('#qTrack');
    const q = new Array(SIZE).fill(null);
    let front = -1, rear = -1, nextV = 10;
    const xAt = (i) => X0 + i * STEP;           // left edge of slot i
    const cx = (i) => (i < 0 ? 22 : xAt(i) + 31); // pointer centre
    const ghost = el('div', 'slot');
    ghost.style.left = '2px';
    ghost.innerHTML = '<div class="ghost">none</div><span class="si">-1</span>';
    track.appendChild(ghost);
    const blks = [];
    for (let i = 0; i < SIZE; i++) {
      const s = el('div', 'slot');
      s.style.left = xAt(i) + 'px';
      const b = el('div', 'blk empty', '');
      s.append(b, el('span', 'si', String(i)));
      track.appendChild(s); blks.push(b);
    }
    const pf = el('div', 'qptr front', '<span>front</span>');
    const pr = el('div', 'qptr rear', '<span>rear</span>');
    track.append(pf, pr);
    const status = $('#qStatus');

    function draw(changed) {
      for (let i = 0; i < SIZE; i++) {
        const b = blks[i];
        let cls = 'blk empty', txt = '';
        if (front !== -1 || rear !== -1) {
          if (i > front && i <= rear) { cls = 'blk steel'; txt = q[i]; }
          else if (i <= front) { cls = 'blk freed'; txt = q[i]; }
        }
        if (i === changed) cls += ' enterx';
        b.className = cls; b.textContent = txt;
      }
      pf.style.left = cx(front) + 'px';
      pr.style.left = cx(rear) + 'px';
      pf.querySelector('span').textContent = 'front = ' + front;
      pr.querySelector('span').textContent = 'rear = ' + rear;
      $('#qNext').textContent = nextV;
    }
    function hit(list, idxs) {
      const lis = $$('#' + list + ' li');
      lis.forEach((l) => l.classList.remove('hit'));
      idxs.forEach((n, k) => setTimeout(() => { lis.forEach((l) => l.classList.remove('hit')); lis[n].classList.add('hit'); }, k * 380));
      setTimeout(() => lis.forEach((l) => l.classList.remove('hit')), idxs.length * 380 + 1600);
    }
    function enq() {
      $$('#qDel li').forEach((l) => l.classList.remove('hit'));
      if (rear === SIZE - 1) {
        hit('qIns', [0, 1]);
        const free = front + 1;
        setStatus(status, '<b>Queue is FULL!!!</b> &nbsp;<code>rear == SIZE-1</code>' + (free > 0 ? ` — even though ${free} position${free > 1 ? 's' : ''} at the front ${free > 1 ? 'were' : 'was'} freed.` : '.'), 'err');
        replay(track, 'shake');
        return;
      }
      rear++; q[rear] = nextV; nextV += 10;
      hit('qIns', [0, 2]);
      setStatus(status, `Inserted <code>${q[rear]}</code> at the rear: <code>rear = ${rear}</code>, <code>queue[${rear}] = ${q[rear]}</code>.`, 'ok');
      draw(rear);
    }
    function deq() {
      $$('#qIns li').forEach((l) => l.classList.remove('hit'));
      if (front === rear) {
        hit('qDel', [0, 1]);
        setStatus(status, '<b>Queue is EMPTY!!!</b> &nbsp;<code>front == rear</code>', 'err');
        return;
      }
      front++;
      const v = q[front];
      hit('qDel', [0, 2]);
      if (front === rear) {
        draw();
        setStatus(status, `Deleted <code>${v}</code> from the front — first in, first out. Now <code>front == rear</code>, so both are reset to <code>-1</code>.`, 'warn');
        setTimeout(() => { front = rear = -1; q.fill(null); draw(); }, 900);
      } else {
        setStatus(status, `Deleted <code>${v}</code> from the front (<code>front = ${front}</code>) — the element added first is removed first.`, 'warn');
        draw();
      }
    }
    function reset() { front = rear = -1; q.fill(null); nextV = 10; draw(); setStatus(status, 'Empty queue: <code>front = rear = -1</code>.'); }
    $('#qEnq').addEventListener('click', enq);
    $('#qDeq').addEventListener('click', deq);
    $('#qReset').addEventListener('click', reset);
    draw();
    let seeded = false;
    return {
      async enter() {
        if (seeded) return; seeded = true;
        await sleep(1000); enq(); await sleep(500); enq(); await sleep(500); enq();
      },
      leave() {}
    };
  })();

  /* ---------------------------------------------------------
     Slide 7 — normal queue → circular queue; pointers
     --------------------------------------------------------- */
  const S7 = (function () {
    const SIZE = 7;
    const box = $('#cq'), stage = $('#cqStage'), status = $('#cqStatus');
    const W = 420, H = 330, CX = 210, CY = 165, R = 122;
    let q, front, rear, circ, nextV;
    const cells = [];
    for (let i = 0; i < SIZE; i++) {
      const c = el('div', 'cqcell');
      const b = el('div', 'blk', '');
      c.append(b, el('span', 'si', '[' + i + ']'));
      stage.appendChild(c); cells.push({ c, b });
    }
    const pf = el('div', 'cq-ptr front', 'front'), pr = el('div', 'cq-ptr rear', 'rear');
    stage.append(pf, pr);

    // geometry
    const CW = 54, CH = 54 + 18;
    function stripPos(i) { return [8 + i * 59, 110]; }
    function ringAng(i) { return -Math.PI / 2 + (i * 2 * Math.PI) / SIZE; }
    function ringPos(i) { const a = ringAng(i); return [CX + Math.cos(a) * R - CW / 2, CY + Math.sin(a) * R - CH / 2 + 6]; }
    function ptrPos(i, which) {
      if (!circ) { const [x, y] = stripPos(i); return [x + CW / 2 - 24, y + (which === 'f' ? 92 : 120)]; }
      const a = ringAng(i), rr = which === 'f' ? R - 66 : R - 66;
      const off = which === 'f' ? -12 : 12;
      return [CX + Math.cos(a) * rr - 26, CY + Math.sin(a) * rr - 10 + off];
    }
    // wrap arc between index SIZE-1 and 0 (outside the ring)
    (function () {
      const a1 = ringAng(SIZE - 1), a0 = ringAng(0) + 2 * Math.PI, ro = R + 46;
      const p = (a) => (CX + Math.cos(a) * ro).toFixed(1) + ' ' + (CY + Math.sin(a) * ro).toFixed(1);
      $('#wrapArc').setAttribute('d', `M ${p(a1 + 0.1)} A ${ro} ${ro} 0 0 1 ${p(a0 - 0.1)}`);
    })();

    function layout() {
      cells.forEach(({ c }, i) => {
        const [x, y] = circ ? ringPos(i) : stripPos(i);
        c.style.transform = `translate(${x}px, ${y}px)`;
        c.style.transitionDelay = circ ? (i * 0.05) + 's' : '0s';
      });
      const empty = front === -1;
      pf.classList.toggle('hide', empty); pr.classList.toggle('hide', empty);
      if (!empty) {
        const [fx, fy] = ptrPos(front, 'f'), [rx, ry] = ptrPos(rear, 'r');
        pf.style.transform = `translate(${fx}px, ${fy}px)`;
        pr.style.transform = `translate(${rx}px, ${ry}px)`;
      }
      box.classList.toggle('circ', circ);
      $('#cqMode').textContent = circ ? 'Circular queue · SIZE = 7' : 'Normal queue · SIZE = 7';
      $('#cqCirc').disabled = circ;
      $('#cqNext').textContent = nextV;
    }
    function occupied(i) {
      if (front === -1) return false;
      if (front <= rear) return i >= front && i <= rear;
      return i >= front || i <= rear;
    }
    function draw(changed) {
      cells.forEach(({ b }, i) => {
        const occ = occupied(i);
        let cls;
        if (occ) cls = 'blk steel';
        else if (q[i] != null && !circ) cls = 'blk freed';
        else cls = 'blk empty';
        if (i === changed) cls = 'blk hot enter';
        b.className = cls;
        b.textContent = occ || (!circ && q[i] != null) ? q[i] : '';
      });
      layout();
    }
    function formula(ids) {
      ['fRear', 'fFront', 'fEmpty'].forEach((id) => $('#' + id).classList.toggle('hit', ids.includes(id)));
      setTimeout(() => ['fRear', 'fFront', 'fEmpty'].forEach((id) => $('#' + id).classList.remove('hit')), 2200);
    }
    function wrapHit() { const a = $('#wrapArc'); a.classList.add('hit'); setTimeout(() => a.classList.remove('hit'), 1800); }

    function deq() {
      if (front === -1) { formula(['fEmpty']); setStatus(status, '<b>Queue is EMPTY!!!</b> — <code>front == -1</code>.', 'err'); return; }
      const v = q[front];
      if (circ) q[front] = null;
      if (front === rear) {
        front = rear = -1;
        if (!circ) q.fill(null);
        setStatus(status, `Deleted <code>${v}</code>. The queue is now empty: <code>front = rear = -1</code>.`, 'warn');
      } else {
        const old = front;
        front = circ ? (front + 1) % SIZE : front + 1;
        if (circ) { formula(['fFront']); if (old === SIZE - 1) wrapHit(); }
        setStatus(status, `Deleted <code>${v}</code> from the front. ${circ ? `<code>front = (${old} + 1) % 7 = ${front}</code>` : `Position <code>[${old}]</code> is now free — but a normal queue cannot reuse it.`}`, 'warn');
      }
      draw();
    }
    function enq() {
      if (!circ) {
        if (rear === SIZE - 1) {
          const free = front === -1 ? SIZE : front;
          setStatus(status, `<b>Queue is FULL!!!</b> — <code>rear == SIZE-1</code>, yet <b>${free}</b> position${free === 1 ? ' is' : 's are'} free at the front. They cannot be reused.`, 'err');
          replay(stage, 'shake');
          return;
        }
        if (front === -1) front = 0;
        rear++; q[rear] = nextV; nextV += 10;
        setStatus(status, `Inserted <code>${q[rear]}</code> at <code>rear = ${rear}</code>.`, 'ok');
        draw(rear);
        return;
      }
      if (front !== -1 && (rear + 1) % SIZE === front) {
        setStatus(status, '<b>Queue is FULL!!!</b> — every position of the circle is in use.', 'err');
        replay(stage, 'shake');
        return;
      }
      const old = rear;
      if (front === -1) { front = 0; rear = 0; } else rear = (rear + 1) % SIZE;
      q[rear] = nextV; nextV += 10;
      formula(['fRear']);
      if (old === SIZE - 1) wrapHit();
      setStatus(status, `Inserted <code>${q[rear]}</code>: <code>rear = (${old} + 1) % 7 = ${rear}</code>${old === SIZE - 1 ? ' — the last position wraps back to the first, so the freed space is reused.' : '.'}`, 'ok');
      draw(rear);
    }
    function makeCircular() {
      circ = true;
      // freed positions become reusable
      q = q.map((v, i) => (occupied(i) ? v : null));
      draw();
      setStatus(status, 'The last position is now connected back to the first. Insert again — <code>rear</code> wraps with <code>% SIZE</code>.', 'ok');
    }
    function reset() {
      q = [10, 20, 30, 40, 50, 60, 70]; front = 0; rear = 6; circ = false; nextV = 80;
      draw();
      setStatus(status, 'A full queue: 10, 20, 30, 40, 50, 60, 70. Delete from the front, then try to insert.');
    }
    $('#cqDeq').addEventListener('click', deq);
    $('#cqEnq').addEventListener('click', enq);
    $('#cqCirc').addEventListener('click', makeCircular);
    $('#cqReset').addEventListener('click', reset);
    reset();

    /* ----- pointers ----- */
    const mC = $('#mCount'), mP = $('#mP'), arrow = $('#ptrArrow'), pst = $('#ptrStatus');
    const psvg = $('#memRow .ptr-svg');
    function placeArrow() {
      const row = $('#memRow');
      const w = row.clientWidth || 490;
      psvg.setAttribute('viewBox', `0 0 ${w} 60`);
      const cx = (n) => n.offsetLeft + n.offsetWidth / 2;
      const a = cx(mP), b = cx(mC);
      arrow.setAttribute('d', `M ${a} 56 C ${a} 0, ${b} 0, ${b} 52`);
    }
    const steps = [
      () => { mC.className = 'mcell on'; mC.querySelector('.box').textContent = '7'; mC.querySelector('.box').textContent = '7'; mP.className = 'mcell'; mP.querySelector('.box').textContent = '—'; arrow.classList.remove('on');
        return ['An ordinary variable <code>count</code> holds the value <code>7</code> at its memory address.', '']; },
      () => { mP.className = 'mcell bad'; mP.querySelector('.box').textContent = '?'; arrow.classList.remove('on'); mC.className = 'mcell on'; mC.querySelector('.box').textContent = '7';
        return ['<code>int *p;</code> declares a pointer (<code>Data-type *name;</code>). Until it is assigned, its content is <b>invalid</b>: it does not point to an object, and using it can crash the program.', 'err']; },
      () => { mP.className = 'mcell on'; mP.querySelector('.box').textContent = '0x7ff4'; placeArrow(); arrow.classList.add('on'); mC.className = 'mcell on'; mC.querySelector('.box').textContent = '7';
        return ['<code>p = &amp;count;</code> — <code>&amp;</code> returns the address of <code>count</code>, which is stored in <code>p</code>. Now <code>p</code> indicates where to find <code>count</code>.', 'ok']; },
      () => { mP.className = 'mcell on'; mP.querySelector('.box').textContent = '0x7ff4'; placeArrow(); arrow.classList.add('on'); mC.className = 'mcell hot'; mC.querySelector('.box').textContent = '7';
        return ['<code>*p</code> — the indirection operator follows the address and dereferences it: <code>*p</code> gives <code>7</code>.', 'ok']; },
      () => { mP.className = 'mcell'; mP.querySelector('.box').textContent = 'NULL'; arrow.classList.remove('on'); mC.className = 'mcell on'; mC.querySelector('.box').textContent = '7';
        return ['<code>p = NULL;</code> — a NULL pointer deliberately points to no object.', 'warn']; }
    ];
    $$('#ptrSteps button').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.s;
      // apply steps in order so state is always consistent
      $$('#ptrSteps button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      const [m, kind] = steps[n]();
      setStatus(pst, m, kind);
    }));

    return {
      enter() { requestAnimationFrame(placeArrow); },
      leave() {}
    };
  })();

  return { 2: S2, 3: S3, 4: S4, 5: S5, 6: S6, 7: S7 };
})();
