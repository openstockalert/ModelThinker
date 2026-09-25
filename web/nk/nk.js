// NK landscape story — two sims: interactive climb game, and a strategy race.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric, shuffle } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', success: '#37B24D', warn: '#F59F00',
            line: '#E9ECEF', ink: '#212529' };

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

// ---------- Sim 1 · Interactive climb game ---------------------------------
// N=6 binary decisions the user can flip. Each is a themed "design choice"
// so the NK abstraction is grounded in something tangible.

const CLIMB_N = 6;
const BIT_ICON = ['🎨', '📦', '⚙️', '🎵', '🚀', '💰'];
const BIT_STATE = [
  ['Muted',    'Bright' ],   // 🎨 colour
  ['Big',      'Small'  ],   // 📦 size
  ['Minimal',  'Loaded' ],   // ⚙️ features
  ['Silent',   'Sounds' ],   // 🎵 sound
  ['Steady',   'Fast'   ],   // 🚀 speed
  ['Budget',   'Premium'],   // 💰 price
];

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function initClimberGame() {
  const canvas = document.getElementById('sim-climber');
  if (!canvas) return;
  const hintBtn    = document.getElementById('climber-hint');
  const jumpBtn    = document.getElementById('climber-jump');
  const restartBtn = document.getElementById('climber-restart');
  const newBtn     = document.getElementById('climber-new');
  const mFit    = document.getElementById('climber-fit');
  const mMax    = document.getElementById('climber-max');
  const mMoves  = document.getElementById('climber-moves');
  const mPeaks  = document.getElementById('climber-peaks');
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 380;
  let K = 2;
  let seed = Math.floor(Math.random() * 1e6);
  let rng = makeRng(seed);
  let L = makeLandscape({ N: CLIMB_N, K, seed });
  let F = allFitnesses(L);
  let globalMax = Math.max(...F);
  let nPeaks = countLocalPeaks(F, CLIMB_N);
  let x = new Int8Array(CLIMB_N);
  let moves = 0;
  let hint = false;
  const cardBounds = new Array(CLIMB_N).fill(null);   // filled by draw for hit-testing
  let flashBit = -1, flashStart = 0;                   // click feedback

  function rebuildLandscape() {
    L = makeLandscape({ N: CLIMB_N, K, seed });
    F = allFitnesses(L);
    globalMax = Math.max(...F);
    nPeaks = countLocalPeaks(F, CLIMB_N);
  }
  function randomStart() {
    for (let i = 0; i < CLIMB_N; i++) x[i] = rng() < 0.5 ? 0 : 1;
    moves = 0;
    hint = false;
  }
  randomStart();

  function currentF() { return fitness(x, L); }
  function neighbourF(bit) {
    x[bit] = 1 - x[bit];
    const f = fitness(x, L);
    x[bit] = 1 - x[bit];
    return f;
  }
  function bestNeighbour() {
    const cur = currentF();
    let bestBit = -1, bestF = cur;
    for (let i = 0; i < CLIMB_N; i++) {
      const nf = neighbourF(i);
      if (nf > bestF + 1e-9) { bestF = nf; bestBit = i; }
    }
    return { bit: bestBit, fitness: bestF, delta: bestF - cur };
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    // ---------- fitness gauge (top) --------------------------------------
    const cur = currentF();
    const gaugeX = 24, gaugeY = 22, gaugeW = W - 48, gaugeH = 40;
    // background bar
    ctx.fillStyle = P.line;
    roundRectPath(ctx, gaugeX, gaugeY, gaugeW, gaugeH, 10);
    ctx.fill();
    // filled portion (proportional to global max)
    const fillW = Math.max(4, (cur / globalMax) * gaugeW);
    const grad = ctx.createLinearGradient(gaugeX, 0, gaugeX + fillW, 0);
    grad.addColorStop(0, P.primary);
    grad.addColorStop(1, cur >= globalMax - 1e-6 ? P.success : P.accent);
    ctx.fillStyle = grad;
    roundRectPath(ctx, gaugeX, gaugeY, fillW, gaugeH, 10);
    ctx.fill();
    // labels
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`Fitness ${cur.toFixed(3)}`, gaugeX + 12, gaugeY + gaugeH / 2);
    ctx.textAlign = 'right'; ctx.fillStyle = P.ink; ctx.font = '13px Inter, sans-serif';
    ctx.fillText(`global max ${globalMax.toFixed(3)}`, gaugeX + gaugeW - 6, gaugeY + gaugeH / 2);

    // ---------- decision cards (middle) -----------------------------------
    const cardsY = gaugeY + gaugeH + 22;
    const cardsH = 230;
    const gap = 8;
    const cardW = (W - 48 - (CLIMB_N - 1) * gap) / CLIMB_N;
    const cur2 = cur;
    const best = bestNeighbour();

    for (let i = 0; i < CLIMB_N; i++) {
      const cx = 24 + i * (cardW + gap);
      const cy = cardsY;

      const nf = neighbourF(i);
      const delta = nf - cur2;

      // Background colour by delta
      let bg;
      if (delta > 0.001) bg = 'rgba(55,178,77,0.14)';       // green
      else if (delta < -0.001) bg = 'rgba(224,49,49,0.09)'; // red
      else bg = 'rgba(134,142,150,0.09)';                    // grey

      // Card body
      ctx.fillStyle = bg;
      roundRectPath(ctx, cx, cy, cardW, cardsH, 14);
      ctx.fill();

      // Border — thicker + accent for the best neighbour (only if hint on)
      if (hint && i === best.bit && best.delta > 0.001) {
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 1;
      }
      roundRectPath(ctx, cx, cy, cardW, cardsH, 14);
      ctx.stroke();

      // Click flash
      if (flashBit === i) {
        const t = Math.min(1, (now - flashStart) / 300);
        ctx.save();
        ctx.globalAlpha = 1 - easeOut(t);
        ctx.fillStyle = 'rgba(76,110,245,0.35)';
        roundRectPath(ctx, cx, cy, cardW, cardsH, 14);
        ctx.fill();
        ctx.restore();
        if (t >= 1) flashBit = -1;
      }

      // Emoji
      const emojiSize = Math.floor(cardW * 0.42);
      ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(BIT_ICON[i], cx + cardW / 2, cy + 14);

      // Current state — bold pill
      const pillLabel = BIT_STATE[i][x[i]];
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      const pillW = ctx.measureText(pillLabel).width + 16;
      const pillX = cx + (cardW - pillW) / 2;
      const pillY = cy + emojiSize + 22;
      ctx.fillStyle = P.ink;
      roundRectPath(ctx, pillX, pillY, pillW, 22, 11);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pillLabel, cx + cardW / 2, pillY + 11);

      // Delta arrow + value
      const arrow = delta > 0.001 ? '↑' : (delta < -0.001 ? '↓' : '→');
      const dCol = delta > 0.001 ? P.success : (delta < -0.001 ? P.danger : P.muted);
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillStyle = dCol;
      ctx.textBaseline = 'top';
      ctx.fillText(`${arrow} ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`, cx + cardW / 2, pillY + 34);

      // "flip to" hint below the delta
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = P.muted;
      ctx.fillText(`flip → ${BIT_STATE[i][1 - x[i]]}`, cx + cardW / 2, pillY + 58);

      // "🎯 best" chip on the winning card
      if (hint && i === best.bit && best.delta > 0.001) {
        ctx.font = '18px "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif';
        ctx.textBaseline = 'top'; ctx.fillText('🎯', cx + cardW / 2, cy + cardsH - 34);
      }

      cardBounds[i] = { x: cx, y: cy, w: cardW, h: cardsH };
    }

    // ---------- status line (bottom) --------------------------------------
    const statusY = cardsY + cardsH + 18;
    ctx.font = 'bold 15px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (cur >= globalMax - 1e-6) {
      ctx.fillStyle = P.success;
      ctx.fillText(`🏆 GLOBAL MAX in ${moves} moves — this is the best design possible.`, W / 2, statusY);
    } else if (best.delta <= 1e-9) {
      ctx.fillStyle = P.warn;
      ctx.fillText(
        `🏁 Stuck at a local peak (${(100 * cur / globalMax).toFixed(0)} % of global). ` +
        `Try 🌪️ big jump or 🎲 restart.`,
        W / 2, statusY,
      );
    } else {
      ctx.fillStyle = P.muted;
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.fillText(
        `${moves} move${moves === 1 ? '' : 's'} · click a green card to climb ` +
        `(best available: ${BIT_ICON[best.bit]} +${best.delta.toFixed(3)})`,
        W / 2, statusY,
      );
    }

    // Metrics
    setMetric(mFit, cur.toFixed(3), `${(100 * cur / globalMax).toFixed(0)} %`);
    setMetric(mMax, globalMax.toFixed(3));
    setMetric(mMoves, String(moves));
    setMetric(mPeaks, String(nPeaks));
  }
  onResize(canvas, CANVAS_H, render);

  // Repaint loop — needed because of the click-flash animation
  const loop = makeLoop(() => {
    render();
    if (flashBit === -1) return false;
  });

  function tryFlip(bit) {
    x[bit] = 1 - x[bit];
    moves++;
    flashBit = bit;
    flashStart = performance.now();
    hint = false;
    loop.start();
  }

  bindSlider(sliderRoot, v => {
    K = v;
    rebuildLandscape();
    randomStart();
    render();
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1);
    const py = (e.clientY - rect.top)  * (canvas.height / rect.height) / (window.devicePixelRatio || 1);
    for (let i = 0; i < CLIMB_N; i++) {
      const b = cardBounds[i];
      if (b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        tryFlip(i);
        return;
      }
    }
  });

  hintBtn.addEventListener('click', () => { hint = !hint; render(); });
  jumpBtn.addEventListener('click', () => {
    // Flip 3 distinct random bits
    const idx = Array.from({ length: CLIMB_N }, (_, i) => i);
    shuffle(idx, rng);
    for (let i = 0; i < 3; i++) x[idx[i]] = 1 - x[idx[i]];
    moves += 3;
    hint = false;
    render();
  });
  restartBtn.addEventListener('click', () => { randomStart(); render(); });
  newBtn.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1e6);
    rng = makeRng(seed);
    rebuildLandscape();
    randomStart();
    render();
  });

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

initClimberGame();
initSim2();
