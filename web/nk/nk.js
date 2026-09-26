// NK landscape story · turn the ruggedness dial, climb the map, race three explorers.
//
// Everything lives on the same visible search space: 64 possible designs (N=6),
// arranged on an 8×8 grid using a Gray-code ordering so adjacent grid cells
// differ by exactly one flipped decision. That gives us a landscape whose
// ruggedness the eye can actually parse.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric, shuffle } from '../shared/ui.js';

// ============================================================================
// Constants & tiny helpers
// ============================================================================

const P = {
  primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
  danger:  '#E03131', success:'#37B24D', warn:  '#F59F00',
  line:    '#E9ECEF', ink:    '#212529',
};

const N = 6;                       // 6 binary decisions → 64 designs
const HALF = 3;                    // N / 2
const GRID = 8;                    // 2^HALF
const GRAY     = [0, 1, 3, 2, 6, 7, 5, 4];    // gray[i] = i XOR (i>>1)
const GRAY_INV = [0, 1, 3, 2, 7, 6, 4, 5];

const stateForCell = (r, c) => (GRAY[r] << HALF) | GRAY[c];
const cellForState = (s) => ({ r: GRAY_INV[(s >> HALF) & 7], c: GRAY_INV[s & 7] });

const BIT_ICON  = ['🎨', '📦', '⚙️', '🎵', '🚀', '💰'];
const BIT_STATE = [
  ['Muted',   'Bright' ],   // 🎨 colour
  ['Big',     'Small'  ],   // 📦 size
  ['Minimal', 'Loaded' ],   // ⚙️ features
  ['Silent',  'Sounds' ],   // 🎵 sound
  ['Steady',  'Fast'   ],   // 🚀 speed
  ['Budget',  'Premium'],   // 💰 price
];

// ============================================================================
// NK model
// ============================================================================

function makeLandscape({ K, seed }) {
  const rng = makeRng(seed);
  const neighbours = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    const others = [];
    for (let j = 0; j < N; j++) if (j !== i) others.push(j);
    shuffle(others, rng);
    neighbours[i] = others.slice(0, K);
  }
  const tables = neighbours.map(() => {
    const t = new Float64Array(1 << (K + 1));
    for (let i = 0; i < t.length; i++) t[i] = rng();
    return t;
  });
  return { N, K, neighbours, tables };
}

function fitness(state, L) {
  let acc = 0;
  for (let i = 0; i < L.N; i++) {
    let idx = (state >> i) & 1;
    for (const j of L.neighbours[i]) idx = (idx << 1) | ((state >> j) & 1);
    acc += L.tables[i][idx];
  }
  return acc / L.N;
}

function allFitnesses(L) {
  const M = 1 << L.N;
  const out = new Float64Array(M);
  for (let s = 0; s < M; s++) out[s] = fitness(s, L);
  return out;
}

function findLocalPeaks(F) {
  const peaks = [];
  for (let s = 0; s < F.length; s++) {
    let isPeak = true;
    for (let b = 0; b < N; b++) {
      if (F[s ^ (1 << b)] > F[s]) { isPeak = false; break; }
    }
    if (isPeak) peaks.push(s);
  }
  return peaks;
}

function argmax(F) {
  let best = 0;
  for (let s = 1; s < F.length; s++) if (F[s] > F[best]) best = s;
  return best;
}

// ============================================================================
// Rendering primitives
// ============================================================================

function terrainColor(t) {
  // Deep purple → indigo → teal → gold → pale. A classic terrain map.
  const stops = [
    [0.00,  30,  25,  70],
    [0.30,  55, 100, 155],
    [0.55,  70, 175, 130],
    [0.80, 235, 190,  80],
    [1.00, 255, 240, 200],
  ];
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [a0, ar, ag, ab] = stops[i - 1];
      const [b0, br, bg, bb] = stops[i];
      const u = (t - a0) / (b0 - a0);
      const r = Math.round(ar + (br - ar) * u);
      const g = Math.round(ag + (bg - ag) * u);
      const b = Math.round(ab + (bb - ab) * u);
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(255,240,200)`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawLandscape(ctx, x0, y0, size, F) {
  let fMin = F[0], fMax = F[0];
  for (let i = 1; i < F.length; i++) {
    if (F[i] < fMin) fMin = F[i];
    if (F[i] > fMax) fMax = F[i];
  }
  const cell = size / GRID;
  const span = Math.max(1e-9, fMax - fMin);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const s = stateForCell(r, c);
      ctx.fillStyle = terrainColor((F[s] - fMin) / span);
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell + 0.5, cell + 0.5);
    }
  }
  // Faint cell lines
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + size, y0 + i * cell); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
}

function drawLandscapeShadow(ctx, x0, y0, size) {
  ctx.save();
  ctx.shadowColor = 'rgba(30,30,60,0.18)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'white';
  roundRectPath(ctx, x0 - 3, y0 - 3, size + 6, size + 6, 10);
  ctx.fill();
  ctx.restore();
}

function drawPeakMarkers(ctx, x0, y0, size, peakStates) {
  const cell = size / GRID;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  for (const s of peakStates) {
    const { r, c } = cellForState(s);
    ctx.beginPath();
    ctx.arc(x0 + c * cell + cell / 2, y0 + r * cell + cell / 2, cell * 0.30, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlobalMax(ctx, x0, y0, size, F, sizeHint) {
  const cell = size / GRID;
  const s = argmax(F);
  const { r, c } = cellForState(s);
  const em = sizeHint ?? Math.floor(cell * 0.62);
  ctx.save();
  ctx.font = `${em}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🏆', x0 + c * cell + cell / 2, y0 + r * cell + cell / 2 + 1);
  ctx.restore();
}

function pointForState(x0, y0, size, s) {
  const cell = size / GRID;
  const { r, c } = cellForState(s);
  return { x: x0 + c * cell + cell / 2, y: y0 + r * cell + cell / 2, cell };
}

function drawTrail(ctx, x0, y0, size, trail, color, opts = {}) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opts.alpha ?? 0.65;
  ctx.lineWidth = opts.width ?? 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < trail.length; i++) {
    const { x, y } = pointForState(x0, y0, size, trail[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawWalker(ctx, x, y, radius, color, label, opts = {}) {
  ctx.save();
  if (opts.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (label) {
    ctx.font = `bold ${Math.max(9, Math.floor(radius * 1.05))}px Inter,system-ui,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(label, x, y + 1);
  }
  ctx.restore();
}

// ============================================================================
// Sim 1 · The ruggedness dial
// ============================================================================

function initTerrainSim() {
  const canvas = document.getElementById('sim-terrain');
  if (!canvas) return;
  const newBtn = document.getElementById('terrain-new');
  const mPeaks = document.getElementById('terrain-peaks');
  const mMax   = document.getElementById('terrain-max');
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 400;
  let K = 0;
  let seed = Math.floor(Math.random() * 1e6);
  let L, F, peaks;

  function rebuild() {
    L = makeLandscape({ K, seed });
    F = allFitnesses(L);
    peaks = findLocalPeaks(F);
  }
  rebuild();

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);

    const size = Math.min(W - 80, H - 90);
    const x0 = (W - size) / 2;
    const y0 = 20;

    drawLandscapeShadow(ctx, x0, y0, size);
    drawLandscape(ctx, x0, y0, size, F);
    drawPeakMarkers(ctx, x0, y0, size, peaks);
    drawGlobalMax(ctx, x0, y0, size, F);

    // ---- Legend row underneath ----
    const legY = y0 + size + 28;
    ctx.textBaseline = 'middle';

    // Centre the legend under the landscape.
    // Items:  🏆 global max   ·   ○ local peak
    ctx.font = '13px Inter,system-ui,sans-serif';
    const gap = 26;
    const wGlobal = 22 + ctx.measureText('global max').width;
    const wPeak   = 22 + ctx.measureText('local peak').width;
    const total   = wGlobal + gap + wPeak;
    let lx = (W - total) / 2;

    ctx.font = '17px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = P.ink;
    ctx.fillText('🏆', lx, legY);
    lx += 22;
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.fillText('global max', lx, legY);
    lx += ctx.measureText('global max').width + gap;

    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(lx + 8, legY, 7, 0, Math.PI * 2); ctx.stroke();
    lx += 22;
    ctx.fillStyle = P.ink; ctx.fillText('local peak', lx, legY);

    setMetric(mPeaks, String(peaks.length),
              peaks.length === 1 ? 'a single hill' : `${peaks.length} traps in the terrain`);
    setMetric(mMax, F[argmax(F)].toFixed(3));
  }
  onResize(canvas, CANVAS_H, render);

  bindSlider(sliderRoot, v => { K = v; rebuild(); render(); });
  newBtn.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1e6);
    rebuild(); render();
  });

  render();
}

// ============================================================================
// Sim 2 · The climber game (map + 6 decision cards)
// ============================================================================

function initClimbSim() {
  const canvas = document.getElementById('sim-climb');
  if (!canvas) return;
  const hintBtn    = document.getElementById('climb-hint');
  const jumpBtn    = document.getElementById('climb-jump');
  const restartBtn = document.getElementById('climb-restart');
  const newBtn     = document.getElementById('climb-new');
  const mFit    = document.getElementById('climb-fit');
  const mMax    = document.getElementById('climb-max');
  const mMoves  = document.getElementById('climb-moves');
  const mPeaks  = document.getElementById('climb-peaks');
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 520;

  let K = 2;
  let seed = Math.floor(Math.random() * 1e6);
  let rng = makeRng(seed);
  let L, F, peaks, globalMax;
  let state = 0, moves = 0, trail = [];
  let hint = false;
  let flashBit = -1, flashStart = 0;
  let jumpAnim = null;
  const cardBounds = new Array(N).fill(null);

  function rebuild() {
    L = makeLandscape({ K, seed });
    F = allFitnesses(L);
    peaks = findLocalPeaks(F);
    globalMax = F[argmax(F)];
  }
  function randomStart() {
    state = Math.floor(rng() * (1 << N));
    trail = [state];
    moves = 0;
    hint = false;
    jumpAnim = null;
  }
  rebuild(); randomStart();

  function bestNeighbour() {
    const cur = F[state];
    let bestBit = -1, bestF = cur;
    for (let b = 0; b < N; b++) {
      const nf = F[state ^ (1 << b)];
      if (nf > bestF + 1e-9) { bestF = nf; bestBit = b; }
    }
    return { bit: bestBit, fitness: bestF, delta: bestF - cur };
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    // ---- Landscape (top) ------------------------------------------------
    const gridSize = 240;
    const gridX = (W - gridSize) / 2;
    const gridY = 12;

    drawLandscapeShadow(ctx, gridX, gridY, gridSize);
    drawLandscape(ctx, gridX, gridY, gridSize, F);
    drawPeakMarkers(ctx, gridX, gridY, gridSize, peaks);
    drawGlobalMax(ctx, gridX, gridY, gridSize, F);
    drawTrail(ctx, gridX, gridY, gridSize, trail, P.primary, { alpha: 0.85, width: 2.5 });

    // Highlight the 6 neighbour cells (delta halos)
    const best = bestNeighbour();
    const cell = gridSize / GRID;
    for (let b = 0; b < N; b++) {
      const ns = state ^ (1 << b);
      const { r, c } = cellForState(ns);
      const nx = gridX + c * cell + cell / 2;
      const ny = gridY + r * cell + cell / 2;
      const d = F[ns] - F[state];
      const col = d > 0.001 ? P.success : (d < -0.001 ? P.danger : P.muted);
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(nx, ny, cell * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (hint && b === best.bit && best.delta > 0.001) {
        ctx.save();
        ctx.strokeStyle = P.warn;
        ctx.lineWidth = 3.5;
        const pulse = 3 * Math.sin(now / 180);
        ctx.beginPath();
        ctx.arc(nx, ny, cell * 0.5 + pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Walker (with jump animation)
    let wx, wy;
    if (jumpAnim) {
      const t = Math.min(1, (now - jumpAnim.startTime) / 260);
      const from = pointForState(gridX, gridY, gridSize, jumpAnim.from);
      const to   = pointForState(gridX, gridY, gridSize, jumpAnim.to);
      const u = easeOut(t);
      wx = from.x + (to.x - from.x) * u;
      wy = from.y + (to.y - from.y) * u;
      if (t >= 1) jumpAnim = null;
    } else {
      const pt = pointForState(gridX, gridY, gridSize, state);
      wx = pt.x; wy = pt.y;
    }
    drawWalker(ctx, wx, wy, cell * 0.34, P.primary, '', { glow: true });

    // ---- Status line ----------------------------------------------------
    const statusY = gridY + gridSize + 22;
    ctx.font = 'bold 14px Inter,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cur = F[state];
    if (cur >= globalMax - 1e-9) {
      ctx.fillStyle = P.success;
      ctx.fillText(`🏆 GLOBAL MAX in ${moves} moves — this is the best design possible.`, W / 2, statusY);
    } else if (best.delta <= 1e-9) {
      ctx.fillStyle = P.warn;
      ctx.fillText(
        `🏁 Stuck on a local peak · ${(100 * cur / globalMax).toFixed(0)}% of global · big jump or restart`,
        W / 2, statusY,
      );
    } else {
      ctx.fillStyle = P.muted;
      ctx.fillText(
        `${moves} move${moves === 1 ? '' : 's'} · click a green card to climb`,
        W / 2, statusY,
      );
    }

    // ---- Decision cards (bottom) ---------------------------------------
    const cardsY = statusY + 20;
    const cardsH = H - cardsY - 8;
    const gap = 6;
    const cardW = (W - 24 - (N - 1) * gap) / N;

    for (let i = 0; i < N; i++) {
      const cx = 12 + i * (cardW + gap);
      const cy = cardsY;
      const nf = F[state ^ (1 << i)];
      const d  = nf - cur;

      let bg;
      if (d > 0.001) bg = 'rgba(55,178,77,0.14)';
      else if (d < -0.001) bg = 'rgba(224,49,49,0.09)';
      else bg = 'rgba(134,142,150,0.09)';
      ctx.fillStyle = bg;
      roundRectPath(ctx, cx, cy, cardW, cardsH, 12); ctx.fill();

      if (hint && i === best.bit && best.delta > 0.001) {
        ctx.strokeStyle = P.warn; ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      }
      roundRectPath(ctx, cx, cy, cardW, cardsH, 12); ctx.stroke();

      if (flashBit === i) {
        const t = Math.min(1, (now - flashStart) / 320);
        ctx.save();
        ctx.globalAlpha = 1 - easeOut(t);
        ctx.fillStyle = 'rgba(76,110,245,0.32)';
        roundRectPath(ctx, cx, cy, cardW, cardsH, 12); ctx.fill();
        ctx.restore();
        if (t >= 1) flashBit = -1;
      }

      // Emoji (top)
      const emojiSize = Math.floor(cardW * 0.42);
      ctx.font = `${emojiSize}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(BIT_ICON[i], cx + cardW / 2, cy + 10);

      // Current state pill
      const bit = (state >> i) & 1;
      const pillLabel = BIT_STATE[i][bit];
      ctx.font = 'bold 11px Inter,system-ui,sans-serif';
      const pillW = ctx.measureText(pillLabel).width + 12;
      const pillX = cx + (cardW - pillW) / 2;
      const pillY = cy + emojiSize + 14;
      ctx.fillStyle = P.ink;
      roundRectPath(ctx, pillX, pillY, pillW, 18, 9); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pillLabel, cx + cardW / 2, pillY + 9);

      // Delta line
      const arrow = d > 0.001 ? '↑' : (d < -0.001 ? '↓' : '→');
      const dCol  = d > 0.001 ? P.success : (d < -0.001 ? P.danger : P.muted);
      ctx.font = 'bold 12px Inter,system-ui,sans-serif';
      ctx.fillStyle = dCol; ctx.textBaseline = 'top';
      ctx.fillText(`${arrow} ${d >= 0 ? '+' : ''}${d.toFixed(3)}`, cx + cardW / 2, pillY + 26);

      // Small "→ new state" caption
      ctx.font = '10px Inter,system-ui,sans-serif';
      ctx.fillStyle = P.muted;
      ctx.fillText(`→ ${BIT_STATE[i][1 - bit]}`, cx + cardW / 2, pillY + 44);

      cardBounds[i] = { x: cx, y: cy, w: cardW, h: cardsH };
    }

    setMetric(mFit, cur.toFixed(3), `${(100 * cur / globalMax).toFixed(0)}%`);
    setMetric(mMax, globalMax.toFixed(3));
    setMetric(mMoves, String(moves));
    setMetric(mPeaks, String(peaks.length));
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    render();
    if (hint || jumpAnim || flashBit >= 0) return true;
    return false;
  });

  function flipBit(bit) {
    const from = state;
    state = state ^ (1 << bit);
    trail.push(state);
    if (trail.length > 40) trail = trail.slice(trail.length - 40);
    moves++;
    flashBit = bit;
    flashStart = performance.now();
    jumpAnim = { from, to: state, startTime: performance.now() };
    hint = false;
    loop.start();
  }

  function bigJump() {
    const from = state;
    const bits = shuffle([0, 1, 2, 3, 4, 5], rng);
    let ns = state;
    for (let i = 0; i < 3; i++) ns ^= (1 << bits[i]);
    state = ns;
    trail.push(state);
    if (trail.length > 40) trail = trail.slice(trail.length - 40);
    moves += 3;
    jumpAnim = { from, to: state, startTime: performance.now() };
    hint = false;
    loop.start();
  }

  bindSlider(sliderRoot, v => {
    K = v;
    rebuild(); randomStart();
    render();
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * canvas.width / rect.width / (window.devicePixelRatio || 1);
    const py = (e.clientY - rect.top)  * canvas.height / rect.height / (window.devicePixelRatio || 1);
    for (let i = 0; i < N; i++) {
      const b = cardBounds[i];
      if (b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        flipBit(i); return;
      }
    }
  });

  hintBtn.addEventListener('click', () => {
    hint = !hint;
    if (hint) loop.start(); else render();
  });
  jumpBtn.addEventListener('click', bigJump);
  restartBtn.addEventListener('click', () => { randomStart(); render(); });
  newBtn.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1e6);
    rng = makeRng(seed);
    rebuild(); randomStart();
    render();
  });

  render();
}

// ============================================================================
// Sim 3 · Race three explorers on the same map
// ============================================================================

function initRaceSim() {
  const canvas = document.getElementById('sim-race');
  if (!canvas) return;
  const runBtn = document.getElementById('race-run');
  const newBtn = document.getElementById('race-new');
  const mHC = document.getElementById('race-hc');
  const mRR = document.getElementById('race-rr');
  const mLJ = document.getElementById('race-lj');
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 500;
  const BUDGET = 80;
  const STEP_MS = 80;

  let K = 3;
  let seed = Math.floor(Math.random() * 1e6);
  let L, F, globalMax;
  let racers = null;
  let stepIdx = 0;
  let animStart = 0;

  function rebuild() {
    L = makeLandscape({ K, seed });
    F = allFitnesses(L);
    globalMax = F[argmax(F)];
  }
  rebuild();

  // Plan a trajectory of length BUDGET for each strategy.

  function planHillClimb(planSeed) {
    const rng = makeRng(planSeed);
    let s = Math.floor(rng() * (1 << N));
    const traj = [s];
    while (traj.length < BUDGET) {
      let bestB = -1, bestF = F[s];
      for (let b = 0; b < N; b++) {
        const nf = F[s ^ (1 << b)];
        if (nf > bestF + 1e-9) { bestF = nf; bestB = b; }
      }
      if (bestB < 0) break;
      s = s ^ (1 << bestB);
      traj.push(s);
    }
    while (traj.length < BUDGET) traj.push(s);   // hold at the local peak
    return traj;
  }

  function planRandomRestart(planSeed) {
    const rng = makeRng(planSeed);
    let s = Math.floor(rng() * (1 << N));
    const traj = [s];
    while (traj.length < BUDGET) {
      let bestB = -1, bestF = F[s];
      for (let b = 0; b < N; b++) {
        const nf = F[s ^ (1 << b)];
        if (nf > bestF + 1e-9) { bestF = nf; bestB = b; }
      }
      if (bestB >= 0) s = s ^ (1 << bestB);
      else s = Math.floor(rng() * (1 << N));    // teleport fresh
      traj.push(s);
    }
    return traj;
  }

  function planLongJump(planSeed) {
    const rng = makeRng(planSeed);
    let s = Math.floor(rng() * (1 << N));
    const traj = [s];
    while (traj.length < BUDGET) {
      if (rng() < 0.75) {
        // Local hill-climb step
        let bestB = -1, bestF = F[s];
        for (let b = 0; b < N; b++) {
          const nf = F[s ^ (1 << b)];
          if (nf > bestF + 1e-9) { bestF = nf; bestB = b; }
        }
        if (bestB >= 0) s = s ^ (1 << bestB);
        // If stuck: hold and burn a step; next iter may go long.
      } else {
        // Long jump: flip 2 or 3 bits unconditionally
        const bits = shuffle([0, 1, 2, 3, 4, 5], rng);
        const k = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < k; i++) s ^= (1 << bits[i]);
      }
      traj.push(s);
    }
    return traj;
  }

  function bestSoFar(traj) {
    const out = new Float64Array(traj.length);
    let best = -Infinity;
    for (let i = 0; i < traj.length; i++) {
      if (F[traj[i]] > best) best = F[traj[i]];
      out[i] = best;
    }
    return out;
  }

  function launchRace() {
    racers = [
      { color: P.primary, letter: 'H', name: 'Hill climb',    traj: planHillClimb(seed + 11),    metricEl: mHC, off: [-7, -3] },
      { color: P.success, letter: 'R', name: 'Restart squad', traj: planRandomRestart(seed + 22), metricEl: mRR, off: [ 7, -3] },
      { color: P.accent,  letter: 'L', name: 'Long-jumper',   traj: planLongJump(seed + 33),      metricEl: mLJ, off: [ 0,  7] },
    ];
    for (const r of racers) r.best = bestSoFar(r.traj);
    stepIdx = 0;
    animStart = performance.now();
    loop.start();
  }

  const loop = makeLoop(() => {
    if (!racers) return false;
    stepIdx = Math.min(BUDGET - 1, Math.floor((performance.now() - animStart) / STEP_MS));
    render();
    return stepIdx < BUDGET - 1;
  });

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);

    // Landscape
    const gridSize = Math.min(W - 60, 300);
    const gridX = (W - gridSize) / 2;
    const gridY = 12;
    drawLandscapeShadow(ctx, gridX, gridY, gridSize);
    drawLandscape(ctx, gridX, gridY, gridSize, F);
    drawGlobalMax(ctx, gridX, gridY, gridSize, F);

    if (racers) {
      // trails
      for (const r of racers) {
        drawTrail(ctx, gridX, gridY, gridSize, r.traj.slice(0, stepIdx + 1), r.color,
                  { alpha: 0.55, width: 2 });
      }
      // walkers on top
      const cell = gridSize / GRID;
      for (const r of racers) {
        const { x, y } = pointForState(gridX, gridY, gridSize, r.traj[stepIdx]);
        drawWalker(ctx, x + r.off[0], y + r.off[1], cell * 0.24, r.color, r.letter, { glow: true });
      }
    }

    // ---- Race bars ------------------------------------------------------
    const barsY = gridY + gridSize + 26;
    if (racers) {
      const rowH = 26, rowGap = 6;
      const trackX = 24, trackW = W - 48;
      for (let i = 0; i < racers.length; i++) {
        const r = racers[i];
        const by = barsY + i * (rowH + rowGap);
        // Track background
        ctx.fillStyle = P.line;
        roundRectPath(ctx, trackX, by, trackW, rowH, rowH / 2); ctx.fill();
        // Fill by best-so-far / globalMax
        const bestF = r.best[stepIdx];
        const frac = Math.max(0, Math.min(1, bestF / globalMax));
        const fillW = Math.max(rowH, frac * trackW);
        ctx.fillStyle = r.color;
        roundRectPath(ctx, trackX, by, fillW, rowH, rowH / 2); ctx.fill();
        // Label inside fill
        ctx.font = 'bold 12px Inter,system-ui,sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(`${r.letter}  ·  ${r.name}`, trackX + 12, by + rowH / 2 + 1);
        // Value at the far right of the track
        ctx.textAlign = 'right';
        ctx.fillStyle = frac > 0.5 ? 'white' : P.ink;
        const label = `${bestF.toFixed(3)}  ·  ${(100 * frac).toFixed(0)}%`;
        const rx = frac > 0.55 ? trackX + fillW - 10 : trackX + trackW - 10;
        ctx.fillStyle = frac > 0.55 ? 'white' : P.ink;
        ctx.fillText(label, rx, by + rowH / 2 + 1);

        setMetric(r.metricEl, bestF.toFixed(3), `${(100 * frac).toFixed(0)}% of max`);
      }
      // Step counter
      ctx.font = '12px Inter,system-ui,sans-serif';
      ctx.fillStyle = P.muted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(`step ${stepIdx + 1} / ${BUDGET}`, W / 2, barsY + 3 * (rowH + rowGap) + 4);
    } else {
      ctx.fillStyle = P.muted;
      ctx.font = '14px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Click 🏁 Race them to send three explorers into this terrain.', W / 2, barsY + 24);
      setMetric(mHC, '—', 'greedy');
      setMetric(mRR, '—', 'random restarts');
      setMetric(mLJ, '—', 'occasional big flips');
    }
  }
  onResize(canvas, CANVAS_H, render);

  bindSlider(sliderRoot, v => { K = v; rebuild(); racers = null; render(); });
  runBtn.addEventListener('click', launchRace);
  newBtn.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1e6);
    rebuild(); racers = null; render();
  });
  render();
}

// ============================================================================
// Bootstrap
// ============================================================================

initTerrainSim();
initClimbSim();
initRaceSim();
