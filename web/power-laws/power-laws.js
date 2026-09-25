// Power laws story — three sims: MusicLab two-worlds, log-log degree, Lorenz.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', success: '#37B24D', warn: '#F59F00',
            ink: '#212529', line: '#E9ECEF' };

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

// ---------- Sim 1 · The MusicLab two-worlds experiment ---------------------
// Two parallel worlds, same 8 songs of nearly-identical (hidden) appeal.
// Every tick, one new listener enters each world and picks a song:
//   independent world: weights = song appeal alone
//   social world:      weights = appeal × (1 + current listeners)
// The social world produces a runaway winner. The winner is different every
// reset — the point of the sim.

const SONG_EMOJI = ['🎸', '🎹', '🎤', '🥁', '🎻', '🎺', '🎧', '🎼'];
const SONG_LETTER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const N_SONGS = SONG_EMOJI.length;
const LAB_TICK_MS = 50;      // ms between listener arrivals — one per world per tick
const LAB_TARGET = 500;
const LAB_POP_BONUS = 4;      // multiplies "listeners" weight in social world for a stronger effect

function labWeightedPick(rng, weights) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function labGini(counts) {
  const n = counts.length;
  const sorted = [...counts].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let cum = 0, area = 0;
  for (let i = 0; i < n; i++) { cum += sorted[i]; area += cum / total; }
  return Math.max(0, 1 - 2 * area / n + 1 / n);
}

function initMusicLab() {
  const canvas = document.getElementById('sim-lab');
  if (!canvas) return;
  const playBtn = document.getElementById('lab-play');
  const fastBtn = document.getElementById('lab-fast');
  const resetBtn = document.getElementById('lab-reset');

  const CANVAS_H = 420;
  let rng, appeals, indep, social;
  let lastTick = 0;
  let auto = false;
  let recentIndep = -1, recentSocial = -1, recentTime = 0;   // for the pulse animation

  function reset() {
    rng = makeRng(Math.floor(Math.random() * 1e6));
    // Appeals: all "similar quality" (0.80 – 1.20). Any variance here would exist
    // in a real album — no song is drastically worse than another.
    appeals = new Array(N_SONGS).fill(0).map(() => 0.80 + rng() * 0.40);
    indep = new Array(N_SONGS).fill(0);
    social = new Array(N_SONGS).fill(0);
    recentIndep = recentSocial = -1;
  }
  reset();

  function stepOne(now) {
    const wIndep = appeals;
    const iIndep = labWeightedPick(rng, wIndep);
    indep[iIndep]++;
    // Social: appeal × (1 + listeners × bonus). Bonus makes preferential attachment
    // dominate the base appeal quickly, matching Salganik's inequality result.
    const wSocial = appeals.map((a, i) => a * (1 + LAB_POP_BONUS * social[i]));
    const iSocial = labWeightedPick(rng, wSocial);
    social[iSocial]++;
    recentIndep = iIndep;
    recentSocial = iSocial;
    recentTime = now;
  }

  function drawWorld(ctx, x, y, w, h, title, counts, colour, recentIdx, now) {
    ctx.fillStyle = P.ink; ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, x + w / 2, y + 4);

    const chartTop    = y + 46;
    const chartBottom = y + h - 46;
    const chartH      = chartBottom - chartTop;
    const gap = w / (N_SONGS + 1);
    const barW = gap * 0.72;
    const maxC = Math.max(...counts, 1);
    const total = counts.reduce((a, b) => a + b, 0);

    // Baseline
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, chartBottom);
    ctx.lineTo(x + w - 12, chartBottom);
    ctx.stroke();

    // Bars
    for (let i = 0; i < N_SONGS; i++) {
      const cx = x + gap * (i + 1);
      const barH = (counts[i] / maxC) * chartH;
      // Recent-arrival pulse — expanding halo just above the bar
      if (recentIdx === i && counts[i] > 0) {
        const t = Math.min(1, (now - recentTime) / 380);
        const eased = easeOut(t);
        ctx.save();
        ctx.globalAlpha = 1 - eased;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, chartBottom - barH, 8 + eased * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Bar itself
      ctx.fillStyle = colour;
      ctx.fillRect(cx - barW / 2, chartBottom - barH, barW, barH);
      // Emoji above the bar
      const emojiSize = Math.max(14, Math.min(24, gap * 0.5));
      ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(SONG_EMOJI[i], cx, chartBottom - barH - 6);
      // Count under bar
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = P.muted;
      ctx.textBaseline = 'top';
      ctx.fillText(String(counts[i]), cx, chartBottom + 4);
      // Song letter under count
      ctx.fillText(SONG_LETTER[i], cx, chartBottom + 18);
    }

    // Footer: metrics (Total · Top share · Gini)
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const topShare = total > 0 ? Math.max(...counts) / total : 0;
    const gini = labGini(counts);
    ctx.fillText(
      `Listeners ${total} · Top song ${(100 * topShare).toFixed(0)}% · Gini ${gini.toFixed(2)}`,
      x + w / 2, y + h - 8
    );

    // Crown the top song if there's a clear winner
    if (total > 40 && topShare > 0.25) {
      const winner = counts.indexOf(Math.max(...counts));
      const cx = x + gap * (winner + 1);
      const barH = (counts[winner] / maxC) * chartH;
      ctx.font = '18px "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('👑', cx, chartBottom - barH - 32);
    }
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const midX = W / 2;
    // Divider
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, 12); ctx.lineTo(midX, H - 12);
    ctx.stroke();

    const now = performance.now();
    drawWorld(ctx, 0,    0, midX, H, 'Independent world · pick by taste alone',
              indep, P.primary, recentIndep, now);
    drawWorld(ctx, midX, 0, midX, H, 'Social influence world · popular attracts more',
              social, P.accent,  recentSocial, now);
  }

  const loop = makeLoop(() => {
    const now = performance.now();
    if (auto && now - lastTick >= LAB_TICK_MS) {
      const total = indep.reduce((a, b) => a + b, 0);
      if (total >= LAB_TARGET) {
        auto = false; playBtn.textContent = '▶ Start listening';
      } else {
        stepOne(now);
        lastTick = now;
      }
    }
    render();
    if (!auto && (now - recentTime) > 500) return false;
  });

  onResize(canvas, CANVAS_H, render);
  render();

  playBtn.addEventListener('click', () => {
    if (auto) { auto = false; playBtn.textContent = '▶ Start listening'; }
    else       { auto = true;  playBtn.textContent = '⏸ Pause'; lastTick = 0; loop.start(); }
  });
  fastBtn.addEventListener('click', () => {
    auto = false; playBtn.textContent = '▶ Start listening';
    const now = performance.now();
    while (indep.reduce((a, b) => a + b, 0) < LAB_TARGET) stepOne(now);
    render();
  });
  resetBtn.addEventListener('click', () => {
    auto = false; playBtn.textContent = '▶ Start listening';
    reset(); render();
  });
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

initMusicLab();
initSim2();
initSim3();
