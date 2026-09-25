// Random walk story — five little sims, one page.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { makeRng, setMetric } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', success: '#37B24D', line: '#E9ECEF', ink: '#212529' };

// ---------- Chart helpers ---------------------------------------------------

function axes(ctx, W, H, {left=40, right=10, top=10, bottom=28, xLabel, yLabel} = {}) {
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(left, H - bottom); ctx.lineTo(W - right, H - bottom);
  ctx.stroke();
  ctx.fillStyle = P.muted;
  ctx.font = '12px Inter, sans-serif';
  if (xLabel) { ctx.textAlign = 'center'; ctx.fillText(xLabel, (left + W - right) / 2, H - 6); }
  if (yLabel) {
    ctx.save(); ctx.translate(12, (top + H - bottom) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText(yLabel, 0, 0); ctx.restore();
  }
  return { left, right, top, bottom, plotW: W - left - right, plotH: H - top - bottom };
}

// ---------- Sim 1 · One walker ----------------------------------------------

function initSim1() {
  const canvas = document.getElementById('sim1');
  const playBtn = document.getElementById('sim1-play');
  const resetBtn = document.getElementById('sim1-reset');
  const mT = document.getElementById('sim1-t');
  const mX = document.getElementById('sim1-x');
  const mMax = document.getElementById('sim1-max');

  const STEP_DURATION = 250;    // ms per coin flip — 1.5× the "brisk stroll" pace, ~4 flips/sec

  let rng = makeRng(42);
  let trace = [0];
  let maxAbs = 0;
  let pending = null;           // { fromPos, toPos, fromT, toT, startTime, direction }

  function scheduleNextFlip(now) {
    const from = trace[trace.length - 1];
    const direction = rng() < 0.5 ? -1 : 1;
    pending = {
      fromPos: from,
      toPos:   from + direction,
      fromT:   trace.length - 1,
      toT:     trace.length,
      startTime: now,
      direction,
    };
  }
  function commitFlip() {
    trace.push(pending.toPos);
    maxAbs = Math.max(maxAbs, Math.abs(pending.toPos));
    pending = null;
  }

  function drawWalker(ctx, cx, cy, facingRight, progress) {
    // Vertical bounce as we walk — sine wave crests at mid-step
    const bounce = progress != null ? -Math.abs(Math.sin(progress * Math.PI)) * 8 : 0;
    ctx.save();
    ctx.translate(cx, cy + bounce);
    // 🚶 renders facing left in most emoji fonts; mirror when stepping right so
    // the walker actually points the way they're going.
    if (facingRight) ctx.scale(-1, 1);
    ctx.font = '34px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillText('🚶', 0, -18);
    ctx.restore();
  }

  function drawStepPuff(ctx, cx, cy, direction, progress) {
    // A "+1 →" or "← −1" that puffs up and fades during the animation.
    const alpha = Math.max(0, 1 - progress);          // 1 → 0
    const rise = -18 - 22 * progress;                  // floats upward
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = direction > 0 ? P.success : P.danger;
    ctx.fillText(direction > 0 ? '+1 →' : '← −1', cx, cy + rise);
    ctx.restore();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 340);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const g = axes(ctx, W, H, { xLabel: 'coin flip t', yLabel: 'position' });
    const projectedLen = trace.length + (pending ? 1 : 0);
    const T = Math.max(120, projectedLen);
    const yMax = Math.max(20, maxAbs * 1.4);
    const yZero = g.top + g.plotH / 2;

    // Zero line
    ctx.strokeStyle = P.line; ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(g.left, yZero); ctx.lineTo(g.left + g.plotW, yZero); ctx.stroke(); ctx.setLineDash([]);

    // Trace (finished portion) — a coloured line
    ctx.strokeStyle = P.primary; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < trace.length; i++) {
      const x = g.left + (i / T) * g.plotW;
      const y = yZero - (trace[i] / yMax) * (g.plotH / 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Interpolated position of the walker
    let progress = 0;
    let displayPos = trace[trace.length - 1];
    let displayT = trace.length - 1;
    let direction = pending ? pending.direction : 0;
    if (pending) {
      const now = performance.now();
      progress = Math.min(1, (now - pending.startTime) / STEP_DURATION);
      const eased = easeOut(progress);
      displayPos = pending.fromPos + (pending.toPos - pending.fromPos) * eased;
      displayT = pending.fromT + (pending.toT - pending.fromT) * eased;

      // Dashed leader-line from last committed point to current animated point
      const x0 = g.left + (pending.fromT / T) * g.plotW;
      const y0 = yZero - (pending.fromPos / yMax) * (g.plotH / 2);
      const x1 = g.left + (displayT / T) * g.plotW;
      const y1 = yZero - (displayPos / yMax) * (g.plotH / 2);
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.setLineDash([]);
    }

    const cx = g.left + (displayT / T) * g.plotW;
    const cy = yZero - (displayPos / yMax) * (g.plotH / 2);
    // Facing direction: mostly the current step direction; when idle, face right by default
    const facingRight = direction !== 0 ? direction > 0 : true;
    drawWalker(ctx, cx, cy, facingRight, pending ? progress : null);
    if (pending) drawStepPuff(ctx, cx, cy, direction, progress);

    setMetric(mT, String(trace.length - 1 + (pending ? Math.min(1, (performance.now() - pending.startTime) / STEP_DURATION) : 0) | 0));
    setMetric(mX, String(trace[trace.length - 1]));
    setMetric(mMax, String(maxAbs));
  }
  onResize(canvas, 340, render);

  const loop = makeLoop(() => {
    const now = performance.now();
    if (!pending) {
      scheduleNextFlip(now);
    } else if (now - pending.startTime >= STEP_DURATION) {
      commitFlip();
      if (trace.length > 2000) { render(); return false; }
      scheduleNextFlip(now);
    }
    render();
  });

  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Flip coins'; }
    else { loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', () => {
    loop.stop(); playBtn.textContent = '▶ Flip coins';
    rng = makeRng(Math.floor(Math.random() * 100000));
    trace = [0]; maxAbs = 0; pending = null; render();
  });
  render();
}

// ---------- Sim 2 · Swarm + √t envelope -------------------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const playBtn = document.getElementById('sim2-play');
  const resetBtn = document.getElementById('sim2-reset');
  const mT = document.getElementById('sim2-t');
  const mStd = document.getElementById('sim2-std');

  const N = 100;
  const T_MAX = 1500;
  let rng = makeRng(7);
  let positions = new Float64Array(N);
  let t = 0;
  // Store history for drawing
  const traces = Array.from({ length: N }, () => [0]);

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 340);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const g = axes(ctx, W, H, { xLabel: 'step t', yLabel: 'position' });
    const yMax = Math.max(30, Math.sqrt(T_MAX) * 3);
    const yZero = g.top + g.plotH / 2;
    // √t envelope
    ctx.fillStyle = 'rgba(247,103,7,0.16)';
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const tt = (i / 100) * T_MAX;
      const x = g.left + (tt / T_MAX) * g.plotW;
      const yTop = yZero - (Math.sqrt(tt) / yMax) * (g.plotH / 2);
      if (i === 0) ctx.moveTo(x, yTop); else ctx.lineTo(x, yTop);
    }
    for (let i = 100; i >= 0; i--) {
      const tt = (i / 100) * T_MAX;
      const x = g.left + (tt / T_MAX) * g.plotW;
      const yBot = yZero + (Math.sqrt(tt) / yMax) * (g.plotH / 2);
      ctx.lineTo(x, yBot);
    }
    ctx.closePath(); ctx.fill();
    // Traces
    ctx.strokeStyle = 'rgba(76,110,245,0.35)'; ctx.lineWidth = 1;
    const maxT = traces[0].length;
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      const tr = traces[i];
      for (let j = 0; j < tr.length; j++) {
        const x = g.left + (j / T_MAX) * g.plotW;
        const y = yZero - (tr[j] / yMax) * (g.plotH / 2);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Legend
    ctx.fillStyle = P.accent; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'left';
    ctx.fillText('±√t', g.left + 10, g.top + 16);
    let std = 0;
    for (let i = 0; i < N; i++) std += positions[i] ** 2;
    std = Math.sqrt(std / N);
    setMetric(mT, String(t));
    setMetric(mStd, std.toFixed(2), `theory √t = ${Math.sqrt(t).toFixed(2)}`);
  }
  onResize(canvas, 340, render);

  const loop = makeLoop(() => {
    for (let k = 0; k < 4; k++) {
      if (t >= T_MAX) return false;
      for (let i = 0; i < N; i++) {
        const step = rng() < 0.5 ? -1 : 1;
        positions[i] += step;
        traces[i].push(positions[i]);
      }
      t++;
    }
    render();
  });
  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Run'; }
    else { loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', () => {
    loop.stop(); playBtn.textContent = '▶ Run';
    rng = makeRng(Math.floor(Math.random() * 100000));
    positions = new Float64Array(N); t = 0;
    for (let i = 0; i < N; i++) traces[i].length = 0, traces[i].push(0);
    render();
  });
  render();
}

// ---------- Sim 3 · Return-time histogram -----------------------------------

function initSim3() {
  const canvas = document.getElementById('sim3');
  const runBtn = document.getElementById('sim3-run');
  const resetBtn = document.getElementById('sim3-reset');
  const mMed = document.getElementById('sim3-med');
  const mP99 = document.getElementById('sim3-p99');
  const mMean = document.getElementById('sim3-mean');

  let times = [];

  function simulate() {
    const rng = makeRng(Math.floor(Math.random() * 100000));
    times = [];
    const MAX = 10000;
    for (let w = 0; w < 2000; w++) {
      let pos = rng() < 0.5 ? -1 : 1;   // first step guaranteed nonzero
      let ret = 0;
      for (let t = 2; t <= MAX; t++) {
        pos += rng() < 0.5 ? -1 : 1;
        if (pos === 0) { ret = t; break; }
      }
      if (ret > 0) times.push(ret);
    }
    render();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 320);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const g = axes(ctx, W, H, { xLabel: 'return time T (log)', yLabel: 'walks' });
    if (times.length === 0) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'center';
      ctx.fillText('Click "Simulate 2000 walks" to fill.', W / 2, H / 2);
      setMetric(mMed, '—'); setMetric(mP99, '—'); setMetric(mMean, '—');
      return;
    }
    // Log-uniform bins from 2 to max. Return times are ALWAYS even (a 1-D walk
    // can only reach 0 after an even number of steps), so we snap each edge to
    // an even integer and enforce a minimum step of 2 — otherwise low-end bins
    // land on ranges like (4, 5] that no even integer can fall into, leaving
    // visually confusing gaps at t = 5, 7, 9, …
    const maxT = Math.max(...times);
    const targetBins = 26;
    const edges = [2];
    let last = 2;
    for (let i = 1; i <= targetBins; i++) {
      const raw = 2 * Math.pow(maxT / 2, i / targetBins);
      let e = 2 * Math.round(raw / 2);
      if (e <= last) e = last + 2;
      edges.push(e);
      last = e;
    }
    const nBins = edges.length - 1;
    const counts = new Array(nBins).fill(0);
    for (const t of times) {
      if (t < edges[0]) continue;
      let bin = 0;
      while (bin < nBins - 1 && t > edges[bin + 1]) bin++;
      counts[bin]++;
    }
    const maxCount = Math.max(...counts);
    // Draw bars (log x)
    const logMin = Math.log(2), logMax = Math.log(maxT);
    for (let i = 0; i < nBins; i++) {
      const xa = g.left + ((Math.log(edges[i]) - logMin) / (logMax - logMin)) * g.plotW;
      const xb = g.left + ((Math.log(edges[i + 1]) - logMin) / (logMax - logMin)) * g.plotW;
      const h = (counts[i] / maxCount) * g.plotH;
      ctx.fillStyle = P.primary;
      ctx.fillRect(xa + 1, g.top + g.plotH - h, Math.max(1, xb - xa - 2), h);
    }
    // x tick labels
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    for (const val of [2, 10, 100, 1000, 10000]) {
      if (val >= 2 && val <= maxT) {
        const x = g.left + ((Math.log(val) - logMin) / (logMax - logMin)) * g.plotW;
        ctx.fillText(String(val), x, g.top + g.plotH + 18);
      }
    }
    // Metrics
    const sorted = [...times].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    setMetric(mMed, `${med} steps`);
    setMetric(mP99, `${p99} steps`);
    setMetric(mMean, `${mean.toFixed(0)} steps`, 'theory: ∞');
  }
  onResize(canvas, 320, render);
  runBtn.addEventListener('click', simulate);
  resetBtn.addEventListener('click', () => { times = []; render(); });
  render();
}

// ---------- Sim 4 · Dimension recurrence ------------------------------------

function initSim4() {
  const canvas = document.getElementById('sim4');
  const runBtn = document.getElementById('sim4-run');
  const resetBtn = document.getElementById('sim4-reset');
  const dims = [1, 2, 3, 4];
  const theory = { 1: 1.0, 2: 1.0, 3: 0.3405, 4: 0.193 };
  let results = null;

  function simulate() {
    const rng = makeRng(Math.floor(Math.random() * 100000));
    const N_WALKS = 500;
    const MAX = 5000;
    results = {};
    for (const dim of dims) {
      let returned = 0;
      for (let w = 0; w < N_WALKS; w++) {
        const pos = new Int32Array(dim);
        let done = false;
        for (let t = 1; t <= MAX && !done; t++) {
          const axis = Math.floor(rng() * dim);
          pos[axis] += rng() < 0.5 ? -1 : 1;
          let atZero = true;
          for (let d = 0; d < dim; d++) if (pos[d] !== 0) { atZero = false; break; }
          if (atZero) { returned++; done = true; }
        }
      }
      results[dim] = returned / N_WALKS;
    }
    render();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 320);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const g = axes(ctx, W, H, { yLabel: 'fraction returning' });
    // grid lines
    for (const y of [0.25, 0.5, 0.75, 1.0]) {
      const py = g.top + g.plotH - y * g.plotH;
      ctx.strokeStyle = P.line; ctx.beginPath();
      ctx.moveTo(g.left, py); ctx.lineTo(g.left + g.plotW, py); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'right';
      ctx.fillText(y.toFixed(2), g.left - 6, py + 4);
    }
    const barW = g.plotW / (dims.length + 1);
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      const cx = g.left + (i + 0.5) * (g.plotW / dims.length);
      const val = results ? results[d] : 0;
      const h = val * g.plotH;
      // Bar
      ctx.fillStyle = P.primary;
      ctx.fillRect(cx - barW / 2, g.top + g.plotH - h, barW, h);
      // Theory diamond
      const ty = g.top + g.plotH - theory[d] * g.plotH;
      ctx.fillStyle = P.danger;
      ctx.beginPath();
      ctx.moveTo(cx, ty - 8); ctx.lineTo(cx + 8, ty);
      ctx.lineTo(cx, ty + 8); ctx.lineTo(cx - 8, ty);
      ctx.closePath(); ctx.fill();
      // Labels
      ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.font = 'bold 14px Inter';
      ctx.fillText(`${d}-D`, cx, g.top + g.plotH + 20);
      if (results) {
        ctx.font = 'bold 13px Inter'; ctx.fillStyle = 'white';
        if (h > 30) ctx.fillText(`${Math.round(val * 100)}%`, cx, g.top + g.plotH - h + 20);
      }
    }
    if (!results) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'center'; ctx.font = '13px Inter';
      ctx.fillText('Click "Simulate" to run 500 walks per dimension.', W / 2, H / 2 - 20);
    }
  }
  onResize(canvas, 320, render);
  runBtn.addEventListener('click', simulate);
  resetBtn.addEventListener('click', () => { results = null; render(); });
  render();
}

// ---------- Sim 5 · Arcsine law ---------------------------------------------

function initSim5() {
  const canvas = document.getElementById('sim5');
  const runBtn = document.getElementById('sim5-run');
  const resetBtn = document.getElementById('sim5-reset');
  let fractions = [];

  function simulate() {
    const rng = makeRng(Math.floor(Math.random() * 100000));
    const N = 3000, STEPS = 400;
    fractions = new Array(N);
    for (let w = 0; w < N; w++) {
      let pos = 0, posCount = 0;
      for (let t = 0; t < STEPS; t++) {
        pos += rng() < 0.5 ? -1 : 1;
        if (pos > 0) posCount++;
      }
      fractions[w] = posCount / STEPS;
    }
    render();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 300);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const g = axes(ctx, W, H, { xLabel: 'fraction of time above zero', yLabel: 'density' });
    if (fractions.length === 0) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'center';
      ctx.fillText('Click "Simulate" to draw the distribution.', W / 2, H / 2);
      return;
    }
    const nBins = 25;
    const counts = new Array(nBins).fill(0);
    for (const f of fractions) {
      const bin = Math.min(nBins - 1, Math.floor(f * nBins));
      counts[bin]++;
    }
    const dens = counts.map(c => c / fractions.length * nBins);
    // Theoretical arcsine density peak is high at edges — cap y-axis at 3 for readability
    const yMax = 4;
    // Bars
    for (let i = 0; i < nBins; i++) {
      const xa = g.left + (i / nBins) * g.plotW;
      const xb = g.left + ((i + 1) / nBins) * g.plotW;
      const h = Math.min(dens[i], yMax) / yMax * g.plotH;
      ctx.fillStyle = P.primary;
      ctx.fillRect(xa + 1, g.top + g.plotH - h, xb - xa - 2, h);
    }
    // Theoretical arcsine density curve
    ctx.strokeStyle = P.danger; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = 0.005 + (0.99 * i / 200);
      const y = 1 / (Math.PI * Math.sqrt(x * (1 - x)));
      const px = g.left + x * g.plotW;
      const py = g.top + g.plotH - Math.min(y, yMax) / yMax * g.plotH;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // x ticks
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const px = g.left + v * g.plotW;
      ctx.fillText(v.toFixed(2), px, g.top + g.plotH + 18);
    }
    // Legend
    ctx.fillStyle = P.danger; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'right';
    ctx.fillText('arcsine density (theory)', g.left + g.plotW - 10, g.top + 16);
  }
  onResize(canvas, 300, render);
  runBtn.addEventListener('click', simulate);
  resetBtn.addEventListener('click', () => { fractions = []; render(); });
  render();
}

initSim1();
initSim2();
initSim3();
initSim4();
initSim5();
