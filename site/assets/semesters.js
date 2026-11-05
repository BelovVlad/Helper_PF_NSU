// Semester cards: each card is a field of dots in the style of the hub's banner, and the dots fall away
// semester by semester («Осыпание»): steady on the 1st, the most falling on the 6th, easing off on the 7th;
// on the 8th the grid is still and level again, only the dot in the centre pulses red and a tremor runs
// across it from time to time. The fields are dark in both themes, like the banner.
// Shared Hyle settings (dots.js): the speed and the clock, and «Выключены» stops the motion; so does
// reduced motion. The pointer pushes the dots aside, as the banner's lens does.
(() => {
  'use strict';
  const GAP = 8, CREAM = '234,212,183', RED = '214,76,80';
  const FALL = [0, .08, .2, .38, .6, .88, .42, 0];   // share of falling dots: peak on the 6th, easing on the 7th
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const dots = () => window.PwebDots;
  const now = () => dots()?.clock ? dots().clock() : performance.now();
  const moving = () => !still.matches && (dots()?.settings?.show ?? 'hover') !== 'off';

  function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function valueNoise(random) {
    const size = 256, grid = new Float32Array(size * size).map(() => random()), smooth = t => t * t * (3 - 2 * t);
    const at = (i, j) => grid[(j & 255) * size + (i & 255)];
    return (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j), a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  }
  // Seeded by the date, as the hub's banner: every day has its own pattern.
  const today = new Date();
  const noise = valueNoise(rng(today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()));
  const field = (x, y) => noise(x, y) * .65 + noise(x * 2.1 + 17, y * 2.1 + 3) * .35;
  const wave01 = v => v * .5 + .5;
  const hash2 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  // The hub's running wave.
  const drift = (x, y, t) => { const n = field(x / 130 + t * 4e-5, y / 130), w = wave01(Math.sin(x * .017 + y * .06 + n * 5 - t * .0009)); return w * w; };

  // The 8th: a level, still grid; the centre dot pulses red and now and then a tremor runs out from it.
  function calm(card, t) {
    const ci = card.cols >> 1, cj = card.rows >> 1, ph = (t % 9000) / 9000, ring = ph * card.rows * 1.3;
    return (i, j) => {
      if (i === ci && j === cj) return { s: .35 + .55 * wave01(Math.sin(t * .0032)), red: true };
      const shake = ph < .7 ? Math.exp(-(((Math.hypot(i - ci, j - cj) - ring) / 1.6) ** 2)) : 0;
      return { s: .34 + .25 * shake, dx: (hash2(i, j) - .5) * 7 * shake, dy: (hash2(j, i) - .5) * 7 * shake };
    };
  }
  // Dots come loose from the wave one by one and fall to the bottom, fading; some fall red.
  function crumble(card, t) {
    const e = FALL[card.n - 1];
    if (card.n >= 8) return calm(card, t);
    const height = card.h + 30;
    return (i, j, x, y) => {
      const w = drift(x, y, t);
      if (!e) return { s: w };
      const h = hash2(i, j);
      if (h > e * .78) return { s: w * (1 - e * .35) };
      const h2 = hash2(j, i), period = 7000 - 3000 * e + h2 * 3000, ph = ((t / period) + h * 13) % 1;
      const fall = ph < .18 ? 0 : ((ph - .18) / .82) ** 2, alpha = smooth(0, .12, ph) * (1 - smooth(.6, 1, ph));
      return { s: .25 + .5 * w, a: alpha, red: h2 < e * .45, dx: Math.sin(ph * 6 + h * 40) * GAP * .8 * fall, dy: fall * (height - y + 10) };
    };
  }

  const cards = [];
  function fit(card) {
    const box = card.canvas.getBoundingClientRect(), ratio = Math.min(matchMedia('(pointer: coarse)').matches ? 1.5 : 2, devicePixelRatio || 1);
    if (!box.width) return false;
    const W = Math.round(box.width * ratio), H = Math.round(box.height * ratio);
    if (card.canvas.width !== W || card.canvas.height !== H) { card.canvas.width = W; card.canvas.height = H; }
    card.w = box.width; card.h = box.height;
    card.cols = Math.max(4, Math.floor(card.w / GAP)); card.rows = Math.max(4, Math.floor(card.h / GAP));
    card.ox = (card.w - card.cols * GAP) / 2; card.oy = (card.h - card.rows * GAP) / 2;
    card.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return true;
  }
  // Dots are gathered into a few buckets by colour and opacity and each bucket is filled as one path:
  // a card has some 700 dots, and one fill per dot kept phones busy.
  const LEVELS = 12, buckets = Array.from({ length: LEVELS * 2 }, () => []);
  const styles = buckets.map((_, k) => k < LEVELS ? `rgba(${CREAM},${((k + 1) / LEVELS).toFixed(3)})` : `rgba(${RED},${(.92 * (k - LEVELS + 1) / LEVELS).toFixed(3)})`);
  function draw(card, t) {
    if (!card.w && !fit(card)) return;
    const { ctx } = card, sample = crumble(card, t), scale = GAP / 13 * 1.25, p = card.pointer;
    ctx.fillStyle = '#080d12'; ctx.fillRect(0, 0, card.w, card.h);
    for (const b of buckets) b.length = 0;
    for (let j = 0; j < card.rows; j++) for (let i = 0; i < card.cols; i++) {
      const x = card.ox + (i + .5) * GAP, y = card.oy + (j + .5) * GAP, d = sample(i, j, x, y);
      let s = clamp01(d.s), dx = d.dx || 0, dy = d.dy || 0;
      if (p.on) {
        const r = Math.hypot(x - p.x, y - p.y), lens = Math.exp(-((r / 52) ** 2));
        if (r > 0) { const k = lens * 7 / r; dx += (x - p.x) * k; dy += (y - p.y) * k; }
        s = clamp01(s + lens * .3);
      }
      const a = d.a ?? 1;
      if ((s < .02 && !d.red) || a < .02) continue;
      const alpha = d.red ? a : Math.min(1, a * (.3 + .7 * s)), level = Math.min(LEVELS - 1, Math.max(0, Math.round(alpha * LEVELS) - 1));
      buckets[(d.red ? LEVELS : 0) + level].push(x + dx, y + dy, (.45 + 2.2 * s) * scale);
    }
    for (let k = 0; k < buckets.length; k++) {
      const b = buckets[k]; if (!b.length) continue;
      ctx.fillStyle = styles[k]; ctx.beginPath();
      for (let n = 0; n < b.length; n += 3) { ctx.moveTo(b[n] + b[n + 2], b[n + 1]); ctx.arc(b[n], b[n + 1], b[n + 2], 0, 6.2832); }
      ctx.fill();
    }
  }

  const seen = new IntersectionObserver(entries => { for (const entry of entries) { const card = cards.find(c => c.canvas === entry.target); if (card) card.visible = entry.isIntersecting; } });
  function mount(root = document) {
    for (const canvas of root.querySelectorAll('.semester canvas')) {
      if (cards.some(c => c.canvas === canvas)) continue;
      const card = { canvas, ctx: canvas.getContext('2d'), n: Number(canvas.closest('.semester').dataset.semester) || 1, pointer: { x: 0, y: 0, on: false }, visible: true };
      canvas.addEventListener('pointermove', e => { const box = canvas.getBoundingClientRect(); card.pointer.x = e.clientX - box.left; card.pointer.y = e.clientY - box.top; card.pointer.on = e.pointerType === 'mouse'; });
      canvas.addEventListener('pointerleave', () => { card.pointer.on = false; });
      cards.push(card); seen.observe(canvas); fit(card); draw(card, now());
    }
    for (let k = cards.length - 1; k >= 0; k--) if (!cards[k].canvas.isConnected) { seen.unobserve(cards[k].canvas); cards.splice(k, 1); }
    start();
  }
  const FRAME = matchMedia('(pointer: coarse)').matches ? 50 : 33;
  let running = false, drawnAt = -Infinity;
  function loop(stamp) {
    if (!moving()) { running = false; return; }
    if (!document.hidden && stamp - drawnAt >= FRAME) { drawnAt = stamp; const t = now(); for (const card of cards) if (card.visible) draw(card, t); }
    requestAnimationFrame(loop);
  }
  function start() { if (!running && moving()) { running = true; requestAnimationFrame(loop); } }
  const redraw = () => { const t = now(); for (const card of cards) { card.w = 0; draw(card, t); } start(); };
  let resizing; addEventListener('resize', () => { clearTimeout(resizing); resizing = setTimeout(redraw, 120); });
  still.addEventListener('change', redraw);
  addEventListener('load', () => dots()?.onChange?.(redraw));
  window.HelperSemesters = { mount, redraw };
  mount();
})();
