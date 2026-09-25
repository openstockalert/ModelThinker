// NK landscape story — two sims: landscape shape as K grows, and a strategy race.

import { fitCanvas, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric, shuffle } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', success: '#37B24D', line: '#E9ECEF', ink: '#212529' };

// ---------- Model -----------------------------------------------------------

function makeLandscape({ N, K, seed }) {
  const rng = makeRng(seed);
  // For each bit, pick K distinct neighbour bits from {0..N-1}\{i}.
  const neighbours = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    const others = [];
    for (let j = 0; j < N; j++) if (j !== i) others.push(j);
    shuffle(others, rng);
    neighbours[i] = others.slice(0, K);
  }
  // For each bit, a lookup table of size 2^(K+1)
  const tables = neighbours.map(() => {
    const arr = new Float64Array(1 << (K + 1));
    for (let i = 0; i < arr.length; i++) arr[i] = rng();
    return arr;
  });
  return { N, K, neighbours, tables };
}

function fitness(x, L) {
  let acc = 0;
  for (let i = 0; i < L.N; i++) {
    let idx = x[i];
    for (const j of L.neighbours[i]) idx = (idx << 1) | x[j];
    acc += L.tables[i][idx];
  }
  return acc / L.N;
}

// Enumerate ALL fitnesses (only for small N)
function allFitnesses(L) {
  const N = L.N;
  const out = new Float64Array(1 << N);
  const x = new Int8Array(N);
  for (let i = 0; i < (1 << N); i++) {
    for (let b = 0; b < N; b++) x[b] = (i >> (N - 1 - b)) & 1;
    out[i] = fitness(x, L);
  }
  return out;
}

function countLocalPeaks(fitnesses, N) {
  let peaks = 0;
  for (let i = 0; i < fitnesses.length; i++) {
    let peak = true;
    for (let b = 0; b < N; b++) {
      const nb = i ^ (1 << (N - 1 - b));
      if (fitnesses[nb] > fitnesses[i]) { peak = false; break; }
    }
    if (peak) peaks++;
  }
  return peaks;
}

// Strategies — all record best-so-far trajectory
function hillClimb(L, { budget, rng }) {
  const x = new Int8Array(L.N);
  for (let i = 0; i < L.N; i++) x[i] = rng() < 0.5 ? 0 : 1;
  let f = fitness(x, L);
  const traj = [f];
  while (traj.length < budget) {
    let bestNeighbour = null, bestF = f;
    for (let b = 0; b < L.N; b++) {
      x[b] = 1 - x[b];
      const nf = fitness(x, L);
      traj.push(Math.max(bestF, nf));
      if (nf > bestF) { bestF = nf; bestNeighbour = b; }
      x[b] = 1 - x[b];
      if (traj.length >= budget) break;
    }
    if (bestNeighbour === null) break;
    x[bestNeighbour] = 1 - x[bestNeighbour];
    f = bestF;
  }
  while (traj.length < budget) traj.push(f);
  return { fitness: f, trajectory: traj };
}

function randomRestart(L, { budget, restarts, rng }) {
  const per = Math.max(1, Math.floor(budget / restarts));
  const traj = new Array(budget).fill(0);
  let best = -Infinity;
  let idx = 0;
  for (let r = 0; r < restarts && idx < budget; r++) {
    const rem = Math.min(per, budget - idx);
    const sub = hillClimb(L, { budget: rem, rng });
    for (let k = 0; k < rem; k++) {
      best = Math.max(best, sub.trajectory[k]);
      traj[idx + k] = best;
    }
    idx += rem;
  }
  while (idx < budget) { traj[idx++] = best; }
  return { fitness: best, trajectory: traj };
}

function longJump(L, { budget, flipP, rng }) {
  const x = new Int8Array(L.N);
  for (let i = 0; i < L.N; i++) x[i] = rng() < 0.5 ? 0 : 1;
  let f = fitness(x, L);
  const traj = [f];
  while (traj.length < budget) {
    const y = new Int8Array(x);
    for (let b = 0; b < L.N; b++) if (rng() < flipP) y[b] = 1 - y[b];
    const fy = fitness(y, L);
    if (fy > f) { for (let b = 0; b < L.N; b++) x[b] = y[b]; f = fy; }
    traj.push(f);
  }
  return { fitness: f, trajectory: traj };
}

// ---------- Sim 1 · landscape shape -----------------------------------------

function initSim1() {
  const canvas = document.getElementById('sim1');
  const mPeaks = document.getElementById('sim1-peaks');
  const mMax = document.getElementById('sim1-max');
  const slider = canvas.parentElement.querySelector('.slider-block');
  let K = 2;
  bindSlider(slider, v => { K = v; render(); });

  function render() {
    const N = 10;
    const L = makeLandscape({ N, K, seed: 7 });
    const F = allFitnesses(L);
    const peaks = countLocalPeaks(F, N);
    setMetric(mPeaks, String(peaks));
    setMetric(mMax, Math.max(...F).toFixed(3));

    const { ctx, width: W, height: H } = fitCanvas(canvas, 320);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 40, r: 12, t: 12, b: 30 };
    ctx.strokeStyle = P.line;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();
    // Fill under curve
    ctx.fillStyle = 'rgba(76,110,245,0.18)';
    ctx.beginPath();
    ctx.moveTo(M.l, H - M.b);
    for (let i = 0; i < F.length; i++) {
      const x = M.l + (i / (F.length - 1)) * (W - M.l - M.r);
      const y = H - M.b - F[i] * (H - M.b - M.t);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W - M.r, H - M.b);
    ctx.closePath(); ctx.fill();
    // Line
    ctx.strokeStyle = P.primary; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < F.length; i++) {
      const x = M.l + (i / (F.length - 1)) * (W - M.l - M.r);
      const y = H - M.b - F[i] * (H - M.b - M.t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Mark peaks
    for (let i = 0; i < F.length; i++) {
      let peak = true;
      for (let b = 0; b < N; b++) {
        const nb = i ^ (1 << (N - 1 - b));
        if (F[nb] > F[i]) { peak = false; break; }
      }
      if (peak) {
        const x = M.l + (i / (F.length - 1)) * (W - M.l - M.r);
        const y = H - M.b - F[i] * (H - M.b - M.t);
        ctx.fillStyle = P.accent;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Global max marker
    const maxIdx = F.indexOf(Math.max(...F));
    const gx = M.l + (maxIdx / (F.length - 1)) * (W - M.l - M.r);
    const gy = H - M.b - F[maxIdx] * (H - M.b - M.t);
    ctx.strokeStyle = P.danger; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(gx, M.t); ctx.lineTo(gx, H - M.b); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.danger; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'left';
    ctx.fillText(`global max = ${F[maxIdx].toFixed(3)}`, Math.min(gx + 6, W - 160), M.t + 14);
    // Legend
    ctx.textAlign = 'right'; ctx.fillStyle = P.accent;
    ctx.fillText('local peak (nowhere to climb)', W - M.r - 8, M.t + 14);
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText('solution index (all 2^10 bit-strings, in order)', (M.l + W - M.r) / 2, H - 8);
  }
  onResize(canvas, 320, render);
  render();
}

// ---------- Sim 2 · Race three strategies -----------------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const runBtn = document.getElementById('sim2-run');
  const mHC = document.getElementById('sim2-hc');
  const mRR = document.getElementById('sim2-rr');
  const mLJ = document.getElementById('sim2-lj');
  const mMax = document.getElementById('sim2-max');
  const controls = canvas.parentElement.querySelectorAll('.slider-block');

  let K = 4, budget = 300;
  bindSlider(controls[0], v => { K = v; });
  bindSlider(controls[1], v => { budget = v; });

  let data = null;

  function run() {
    const N = 12;
    const seed = Math.floor(Math.random() * 100000);
    const L = makeLandscape({ N, K, seed });
    const rng = makeRng(seed + 1);
    const F = allFitnesses(L);
    const globalMax = Math.max(...F);
    const hc = hillClimb(L, { budget, rng: makeRng(seed + 1) });
    const rr = randomRestart(L, { budget, restarts: 10, rng: makeRng(seed + 2) });
    const lj = longJump(L, { budget, flipP: 0.15, rng: makeRng(seed + 3) });
    data = { hc, rr, lj, globalMax };
    render();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 340);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 50, r: 12, t: 12, b: 30 };
    ctx.strokeStyle = P.line;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();
    if (!data) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'center';
      ctx.fillText('Click "Race them" to run all three on the same terrain.', W / 2, H / 2);
      setMetric(mHC, '—'); setMetric(mRR, '—'); setMetric(mLJ, '—'); setMetric(mMax, '—');
      return;
    }
    const yMin = 0.3, yMax = data.globalMax * 1.02;
    // grid
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'right';
    for (let y = 0.4; y <= 0.9; y += 0.1) {
      const py = H - M.b - (y - yMin) / (yMax - yMin) * (H - M.b - M.t);
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(M.l, py); ctx.lineTo(W - M.r, py); ctx.stroke();
      ctx.fillText(y.toFixed(1), M.l - 6, py + 3);
    }
    // global max
    const gy = H - M.b - (data.globalMax - yMin) / (yMax - yMin) * (H - M.b - M.t);
    ctx.strokeStyle = P.muted; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(M.l, gy); ctx.lineTo(W - M.r, gy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.textAlign = 'left';
    ctx.fillText(`global max = ${data.globalMax.toFixed(3)}`, M.l + 6, gy - 4);
    // curves
    function plot(traj, color, label, yOffset) {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < traj.length; i++) {
        const x = M.l + i / (traj.length - 1) * (W - M.l - M.r);
        const y = H - M.b - (traj[i] - yMin) / (yMax - yMin) * (H - M.b - M.t);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = color; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'right';
      ctx.fillText(label, W - M.r - 8, M.t + 16 + yOffset);
    }
    plot(data.hc.trajectory, P.primary, `hill climb  · ${data.hc.fitness.toFixed(3)}`, 0);
    plot(data.rr.trajectory, P.success, `random restart · ${data.rr.fitness.toFixed(3)}`, 18);
    plot(data.lj.trajectory, P.accent,  `long jumps · ${data.lj.fitness.toFixed(3)}`, 36);
    // x axis
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText('evaluations', (M.l + W - M.r) / 2, H - 8);
    setMetric(mHC, data.hc.fitness.toFixed(3));
    setMetric(mRR, data.rr.fitness.toFixed(3));
    setMetric(mLJ, data.lj.fitness.toFixed(3));
    setMetric(mMax, data.globalMax.toFixed(3));
  }
  onResize(canvas, 340, render);
  runBtn.addEventListener('click', run);
  render();
}

initSim1();
initSim2();
