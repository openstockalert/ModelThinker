// Power laws story — three sims: grow a network, log-log degree, Lorenz curve.

import { fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', line: '#E9ECEF', ink: '#212529' };

// Grow a Barabási–Albert graph. Returns { edges, degrees, positions } where
// positions is a simple radial layout for visualization.
function growBA({ n, m, seed }) {
  const rng = makeRng(seed);
  const degrees = new Int32Array(n);
  const edges = [];
  // seed with a complete graph on m+1 nodes
  const seedN = m + 1;
  for (let i = 0; i < seedN; i++) {
    for (let j = i + 1; j < seedN; j++) {
      edges.push([i, j]);
      degrees[i]++; degrees[j]++;
    }
  }
  for (let newNode = seedN; newNode < n; newNode++) {
    // pick m distinct targets weighted by degree
    const total = degrees.slice(0, newNode).reduce((a, b) => a + b, 0);
    const picked = new Set();
    while (picked.size < m) {
      let r = rng() * total, t = -1;
      while (r > 0 && t < newNode - 1) { t++; r -= degrees[t]; }
      picked.add(t);
    }
    for (const t of picked) {
      edges.push([t, newNode]);
      degrees[t]++; degrees[newNode]++;
    }
  }
  return { edges, degrees };
}

// A cheap "force-lite" layout — polar coordinates seeded by node order,
// with hubs pulled to the middle.
function layout(n, degrees, W, H) {
  const cx = W / 2, cy = H / 2;
  const rmax = Math.min(W, H) * 0.42;
  const maxD = Math.max(...degrees, 1);
  const positions = new Array(n);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = rmax * (1 - Math.pow(degrees[i] / maxD, 0.5) * 0.85);
    positions[i] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }
  return positions;
}

// Discrete power-law MLE ~ Clauset
function mleExponent(degrees, kMin = 1) {
  const xs = [];
  for (let i = 0; i < degrees.length; i++) if (degrees[i] >= kMin) xs.push(degrees[i]);
  if (xs.length < 10) return NaN;
  const denom = xs.reduce((s, x) => s + Math.log(x / (kMin - 0.5)), 0);
  return 1 + xs.length / denom;
}

function lorenz(values) {
  const v = [...values].sort((a, b) => a - b);
  const total = v.reduce((a, b) => a + b, 0);
  const xs = [0], ys = [0];
  let cum = 0;
  for (let i = 0; i < v.length; i++) {
    cum += v[i];
    xs.push((i + 1) / v.length);
    ys.push(cum / total);
  }
  // Gini via trapezoid rule under Lorenz
  let area = 0;
  for (let i = 1; i < xs.length; i++) area += (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]) / 2;
  return { xs, ys, gini: 1 - 2 * area };
}

// ---------- Sim 1 · Watch a network grow ------------------------------------

function initSim1() {
  const canvas = document.getElementById('sim1');
  const playBtn = document.getElementById('sim1-play');
  const fastBtn = document.getElementById('sim1-fast');
  const resetBtn = document.getElementById('sim1-reset');
  const mN = document.getElementById('sim1-n');
  const mMax = document.getElementById('sim1-max');
  const mShare = document.getElementById('sim1-share');

  const m = 2;
  let rng = makeRng(11);
  let degrees = [];
  let edges = [];
  function reset() {
    rng = makeRng(Math.floor(Math.random() * 100000));
    degrees = [];
    edges = [];
    const seedN = m + 1;
    for (let i = 0; i < seedN; i++) degrees.push(0);
    for (let i = 0; i < seedN; i++) for (let j = i + 1; j < seedN; j++) {
      edges.push([i, j]); degrees[i]++; degrees[j]++;
    }
  }
  reset();

  function addNode() {
    const total = degrees.reduce((a, b) => a + b, 0);
    const picked = new Set();
    while (picked.size < m) {
      let r = rng() * total, t = -1;
      while (r > 0 && t < degrees.length - 1) { t++; r -= degrees[t]; }
      picked.add(t);
    }
    const newIdx = degrees.length;
    degrees.push(0);
    for (const t of picked) {
      edges.push([t, newIdx]);
      degrees[t]++; degrees[newIdx]++;
    }
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 380);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const pos = layout(degrees.length, degrees, W, H);
    // edges
    ctx.strokeStyle = 'rgba(76,110,245,0.14)';
    ctx.lineWidth = 0.7;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(pos[a][0], pos[a][1]);
      ctx.lineTo(pos[b][0], pos[b][1]);
      ctx.stroke();
    }
    // nodes — larger if higher degree
    const maxD = Math.max(...degrees, 1);
    for (let i = 0; i < degrees.length; i++) {
      const r = 2 + Math.sqrt(degrees[i]) * 1.6;
      ctx.fillStyle = i < m + 1 ? P.accent : P.primary;
      ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], r, 0, Math.PI * 2); ctx.fill();
    }
    setMetric(mN, String(degrees.length));
    setMetric(mMax, String(maxD));
    // top 5 share
    const totalDeg = degrees.reduce((a, b) => a + b, 0);
    const sorted = [...degrees].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
    setMetric(mShare, totalDeg > 0 ? `${(100 * sorted / totalDeg).toFixed(1)}%` : '—');
  }
  onResize(canvas, 380, render);
  render();

  const loop = makeLoop(() => {
    for (let i = 0; i < 2; i++) if (degrees.length < 500) addNode();
    if (degrees.length >= 500) return false;
    render();
  });
  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Grow it'; }
    else { loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  fastBtn.addEventListener('click', () => {
    while (degrees.length < 200) addNode();
    render();
  });
  resetBtn.addEventListener('click', () => { reset(); render(); });
}

// ---------- Sim 2 · Log-log degree distribution -----------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const mSlope = document.getElementById('sim2-slope');
  const controls = canvas.parentElement.querySelectorAll('.slider-block');
  let n = 2000, m = 2;
  bindSlider(controls[0], v => { n = v; render(); });
  bindSlider(controls[1], v => { m = v; render(); });

  function render() {
    const { degrees } = growBA({ n, m, seed: 42 });
    const gamma = mleExponent(degrees, m);
    setMetric(mSlope, isFinite(gamma) ? gamma.toFixed(2) : '—', 'theory ≈ 3');

    // Empirical PMF
    const counts = new Map();
    for (const d of degrees) counts.set(d, (counts.get(d) || 0) + 1);
    const ks = [...counts.keys()].sort((a, b) => a - b);
    const pk = ks.map(k => counts.get(k) / degrees.length);

    const { ctx, width: W, height: H } = fitCanvas(canvas, 320);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 50, r: 12, t: 12, b: 30 };
    ctx.strokeStyle = P.line;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();

    const kMin = Math.min(...ks), kMax = Math.max(...ks);
    const pMin = Math.min(...pk), pMax = Math.max(...pk);
    const xMin = Math.log10(Math.max(1, kMin)), xMax = Math.log10(kMax) + 0.1;
    const yMin = Math.log10(pMin) - 0.2, yMax = Math.log10(pMax) + 0.2;
    function px(k) { return M.l + (Math.log10(k) - xMin) / (xMax - xMin) * (W - M.l - M.r); }
    function py(p) { return H - M.b - (Math.log10(p) - yMin) / (yMax - yMin) * (H - M.b - M.t); }
    // grid lines + labels
    ctx.fillStyle = P.muted; ctx.font = '11px Inter';
    ctx.textAlign = 'right';
    for (let e = Math.ceil(yMin); e <= yMax; e++) {
      const y = py(Math.pow(10, e));
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); ctx.stroke();
      ctx.fillText(`10^${e}`, M.l - 4, y + 3);
    }
    ctx.textAlign = 'center';
    for (let e = Math.ceil(xMin); e <= xMax; e++) {
      ctx.fillText(`10^${e}`, px(Math.pow(10, e)), H - M.b + 16);
    }
    // MLE fit line
    if (isFinite(gamma)) {
      const kFitMin = m;
      const pFitMin = pk[ks.indexOf(kFitMin)] || pk[0];
      const ys = ks.filter(k => k >= kFitMin).map(k => pFitMin * Math.pow(k / kFitMin, -gamma));
      const xs = ks.filter(k => k >= kFitMin);
      ctx.strokeStyle = P.danger; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        const X = px(xs[i]), Y = py(ys[i]);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    // data points
    ctx.fillStyle = P.primary;
    for (let i = 0; i < ks.length; i++) {
      ctx.beginPath(); ctx.arc(px(ks[i]), py(pk[i]), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = 'bold 12px Inter'; ctx.textAlign = 'right';
    ctx.fillStyle = P.primary; ctx.fillText('empirical P(k)', W - M.r - 8, M.t + 16);
    if (isFinite(gamma)) { ctx.fillStyle = P.danger; ctx.fillText(`MLE fit  k^(−${gamma.toFixed(2)})`, W - M.r - 8, M.t + 34); }
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText('degree k (log)', (M.l + W - M.r) / 2, H - 8);
  }
  onResize(canvas, 320, render);
  render();
}

// ---------- Sim 3 · Lorenz curve --------------------------------------------

function initSim3() {
  const canvas = document.getElementById('sim3');
  const runBtn = document.getElementById('sim3-run');
  const mGini = document.getElementById('sim3-gini');
  const m8020 = document.getElementById('sim3-8020');
  let data = null;

  function run() {
    const { degrees } = growBA({ n: 2000, m: 2, seed: Math.floor(Math.random() * 100000) });
    const L = lorenz(degrees);
    // top 20 % share
    const top20idx = Math.floor(L.xs.length * 0.8);
    const top20share = 1 - L.ys[top20idx];
    data = { L, gini: L.gini, top20share };
    render();
  }
  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 340);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 50, r: 12, t: 12, b: 30 };
    ctx.strokeStyle = P.line;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();
    // grid + labels
    ctx.fillStyle = P.muted; ctx.font = '11px Inter';
    for (const y of [0, 0.25, 0.5, 0.75, 1.0]) {
      const py = H - M.b - y * (H - M.b - M.t);
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(M.l, py); ctx.lineTo(W - M.r, py); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(y.toFixed(2), M.l - 6, py + 3);
    }
    for (const x of [0, 0.25, 0.5, 0.75, 1.0]) {
      const px = M.l + x * (W - M.l - M.r);
      ctx.textAlign = 'center'; ctx.fillText(x.toFixed(2), px, H - M.b + 16);
    }
    // diagonal (equality)
    ctx.strokeStyle = P.muted; ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(M.l, H - M.b);
    ctx.lineTo(W - M.r, M.t);
    ctx.stroke(); ctx.setLineDash([]);
    if (!data) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'center'; ctx.font = '13px Inter';
      ctx.fillText('Click "Grow & draw" to build a network and see its Lorenz curve.', W / 2, H / 2);
      setMetric(mGini, '—'); setMetric(m8020, '—');
      return;
    }
    // Lorenz fill + line
    const { L } = data;
    ctx.beginPath();
    ctx.moveTo(M.l, H - M.b);
    for (let i = 0; i < L.xs.length; i++) {
      const px = M.l + L.xs[i] * (W - M.l - M.r);
      const py = H - M.b - L.ys[i] * (H - M.b - M.t);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W - M.r, H - M.b);
    ctx.closePath();
    ctx.fillStyle = 'rgba(76,110,245,0.16)'; ctx.fill();
    ctx.strokeStyle = P.primary; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < L.xs.length; i++) {
      const px = M.l + L.xs[i] * (W - M.l - M.r);
      const py = H - M.b - L.ys[i] * (H - M.b - M.t);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    setMetric(mGini, data.gini.toFixed(3));
    setMetric(m8020, `${(100 * data.top20share).toFixed(1)}%`);
    ctx.textAlign = 'right'; ctx.font = 'bold 12px Inter'; ctx.fillStyle = P.primary;
    ctx.fillText('Lorenz curve', W - M.r - 8, M.t + 18);
    ctx.fillStyle = P.muted;
    ctx.fillText('equality diagonal', W - M.r - 8, M.t + 36);
    ctx.fillStyle = P.muted; ctx.textAlign = 'center'; ctx.font = '11px Inter';
    ctx.fillText('fraction of nodes (poorest → richest)', (M.l + W - M.r) / 2, H - 8);
  }
  onResize(canvas, 340, render);
  runBtn.addEventListener('click', run);
  render();
}

initSim1();
initSim2();
initSim3();
