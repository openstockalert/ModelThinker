// Threshold-feedback story · three sims:
//   1. Head-to-head cascade  — two crowds side by side, direct comparison
//   2. The El Farol Bar      — diverse vs homogeneous predictors
//   3. The Chaos Field       — 100 crowds at once, colored by outcome

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric } from '../shared/ui.js';

// ============================================================================
// Shared helpers
// ============================================================================

const P = {
  primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
  danger:  '#E03131', success:'#37B24D', warn:  '#F59F00',
  purple:  '#7048E8', ink:    '#212529', line:  '#E9ECEF',
};

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

function normal01(rng) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Cartoon face drawn on canvas — used by both Sim 1 (cascade) and Sim 3 (chaos).
//   mood ∈ { 'calm', 'worried', 'angry' } picks colour, brows, mouth
//   pulseAge > 0 makes the face briefly grow and glow (activation animation)
function drawFace(ctx, x, y, radius, mood, pulseAge = null) {
  let scale = 1, glowAlpha = 0;
  if (mood === 'angry' && pulseAge != null && pulseAge < 400) {
    const t = pulseAge / 400;
    scale = 1 + (1 - easeOut(t)) * 0.35;
    glowAlpha = (1 - t) * 0.6;
  }
  const r = radius * scale;

  if (glowAlpha > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(224,49,49,${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Colours per mood
  let bg, border;
  if      (mood === 'angry')   { bg = '#F03E3E'; border = '#C92A2A'; }
  else if (mood === 'worried') { bg = '#FFA94D'; border = '#E8590C'; }
  else                          { bg = '#FFD866'; border = '#F5A623'; }

  // Face background
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes
  const eyeR  = r * 0.13;
  const eyeY  = y - r * 0.15;
  const eyeDx = r * 0.32;
  ctx.fillStyle = '#212529';
  ctx.beginPath();
  ctx.arc(x - eyeDx, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(x + eyeDx, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Angry brows only on angry faces
  if (mood === 'angry') {
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.lineCap = 'round';
    const browY = eyeY - r * 0.32;
    ctx.beginPath();
    ctx.moveTo(x - eyeDx - r * 0.22, browY - r * 0.05);
    ctx.lineTo(x - eyeDx + r * 0.22, browY + r * 0.18);
    ctx.moveTo(x + eyeDx + r * 0.22, browY - r * 0.05);
    ctx.lineTo(x + eyeDx - r * 0.22, browY + r * 0.18);
    ctx.stroke();
  }

  // Mouth
  ctx.strokeStyle = '#212529';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'angry') {
    const mouthY = y + r * 0.4;
    ctx.arc(x, mouthY + r * 0.25, r * 0.40, Math.PI + 0.55, 2 * Math.PI - 0.55);
  } else if (mood === 'worried') {
    // Straight, tense line
    const mouthY = y + r * 0.35;
    ctx.moveTo(x - r * 0.28, mouthY);
    ctx.lineTo(x + r * 0.28, mouthY);
  } else {
    const mouthY = y + r * 0.15;
    ctx.arc(x, mouthY, r * 0.36, 0.35, Math.PI - 0.35);
  }
  ctx.stroke();
}

// Run the cascade. Returns { finalSize, history: [count per iteration incl. instigators] }
function runCascade(thresholds, instigators = 1) {
  const n = thresholds.length;
  const acted = new Uint8Array(n);
  let total = instigators;
  const history = [total];
  while (true) {
    let anyNew = false;
    for (let i = 0; i < n; i++) {
      if (acted[i]) continue;
      if (thresholds[i] <= total) { acted[i] = 1; anyNew = true; }
    }
    if (!anyNew) break;
    let count = 0;
    for (let i = 0; i < n; i++) count += acted[i];
    total = instigators + count;
    history.push(total);
  }
  let finalSize = 0;
  for (let i = 0; i < n; i++) finalSize += acted[i];
  return { finalSize, history };
}

function normalCrowd(mean, sd, n, seed) {
  const rng = makeRng(seed);
  const arr = new Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = Math.max(0, Math.min(n, mean + normal01(rng) * sd));
  }
  return arr;
}

// ============================================================================
// Sim 1 · Head-to-head cascade comparison
// ============================================================================

const CASCADE_N = 100;
const CASCADE_STEP_MS = 320;

// Preset pairs. Each has A and B specs plus a `story` line shown under the plot.
const PAIRS = {
  canonical: {
    id: 'canonical',
    deterministic: true,
    story: 'Same mean (49.50 vs 49.51). One threshold moves by exactly 1. Cascade outcome: 100 vs 1.',
    a: {
      name: '🪜 Perfect ladder',
      sub: 'thresholds 0, 1, 2, …, 99 — threshold-0 person is the natural spark',
      instigators: 0,
      make: () => Array.from({ length: CASCADE_N }, (_, i) => i),
    },
    b: {
      name: '🕳️ Missing rung',
      sub: 'threshold "1" becomes "2" — no first-follower, cascade dies alone',
      instigators: 0,
      make: () => {
        const t = Array.from({ length: CASCADE_N }, (_, i) => i);
        t[1] = 2;
        return t;
      },
    },
  },
  luck: {
    id: 'luck',
    deterministic: false,
    hardcodedSeeds: { a: 1, b: 13 },
    story: 'Same distribution — Normal(mean 25, SD 15) — sampled twice. Sometimes you get a full cascade. Sometimes it fizzles. Averages hide bimodal fates.',
    a: {
      name: '🎲 Draw A',
      sub: 'random crowd, mean 25, SD 15',
      instigators: 1,
      make: (seed) => normalCrowd(25, 15, CASCADE_N, seed),
    },
    b: {
      name: '🎲 Draw B',
      sub: 'same distribution, different draw',
      instigators: 1,
      make: (seed) => normalCrowd(25, 15, CASCADE_N, seed),
    },
  },
  sparks: {
    id: 'sparks',
    deterministic: false,
    sharedCrowd: true,
    hardcodedSeeds: { a: 1, b: 1 },   // same crowd
    story: 'Identical 100 people (mean 25, SD 10). Add 9 more instigators. Fizzle becomes full cascade — one person out of a hundred, ×10.',
    a: {
      name: '⚡ 1 instigator',
      sub: 'one lone spark',
      instigators: 1,
      make: (seed) => normalCrowd(25, 10, CASCADE_N, seed),
    },
    b: {
      name: '⚡ 10 instigators',
      sub: 'ten sparks at once',
      instigators: 10,
      make: (seed) => normalCrowd(25, 10, CASCADE_N, seed),
    },
  },
};

function initCascadeSim() {
  const canvas = document.getElementById('sim-cascade');
  if (!canvas) return;
  const sparkBtn  = document.getElementById('cascade-spark');
  const rerollBtn = document.getElementById('cascade-reroll');
  const presetBtns = document.querySelectorAll('button[data-pair]');

  const CANVAS_H = 500;

  let currentPair = 'canonical';
  let overrideSeeds = null;
  let thresholdsA = null, thresholdsB = null;
  let sortedA = null,     sortedB = null;
  let resultA = null,     resultB = null;
  let activationStepsA = null, activationStepsB = null;
  let animStart = 0;
  let playing = false;

  function pair() { return PAIRS[currentPair]; }
  function useSeeds() {
    return overrideSeeds ?? pair().hardcodedSeeds ?? { a: 1, b: 1 };
  }

  // For the "luck" preset: search for a seed pair where outcomes really differ.
  // Also randomly flip which panel gets the cascader so users don't always see
  // A-cascade / B-fizzle. Same information, more variety.
  function findLuckyPair(startSeed) {
    let cascadeSeed = null, fizzleSeed = null;
    for (let s = startSeed; s < startSeed + 120 && (cascadeSeed === null || fizzleSeed === null); s++) {
      const thr = pair().a.make(s);
      const size = runCascade(thr, pair().a.instigators).finalSize;
      if (size >= 90 && cascadeSeed === null) cascadeSeed = s;
      else if (size <= 10 && fizzleSeed === null) fizzleSeed = s;
    }
    const flip = Math.random() < 0.5;
    if (flip) return { a: fizzleSeed ?? startSeed + 13, b: cascadeSeed ?? startSeed };
    return { a: cascadeSeed ?? startSeed, b: fizzleSeed ?? startSeed + 13 };
  }

  // Given a sorted-ascending threshold vector and the cascade history, return
  // for each person the step at which they activated (or -1 if never).
  function computeActivationSteps(sorted, history) {
    const steps = new Array(sorted.length);
    let s = 0;
    for (let i = 0; i < sorted.length; i++) {
      while (s < history.length && history[s] <= sorted[i]) s++;
      steps[i] = s < history.length ? s : -1;
    }
    return steps;
  }

  function recompute() {
    const seeds = useSeeds();
    thresholdsA = pair().a.make(seeds.a);
    thresholdsB = pair().b.make(seeds.b);
    sortedA = [...thresholdsA].sort((a, b) => a - b);
    sortedB = [...thresholdsB].sort((a, b) => a - b);
    resultA = null;
    resultB = null;
    activationStepsA = null;
    activationStepsB = null;
  }

  function spark() {
    resultA = runCascade(thresholdsA, pair().a.instigators);
    resultB = runCascade(thresholdsB, pair().b.instigators);
    activationStepsA = computeActivationSteps(sortedA, resultA.history);
    activationStepsB = computeActivationSteps(sortedB, resultB.history);
    animStart = performance.now();
    playing = true;
    loop.start();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    // ---- Story line at the top ---------------------------------------
    ctx.font = 'bold 13px Inter,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.ink;
    ctx.fillText(pair().story, W / 2, 10);

    // Determine current animation step
    const stepA = resultA ? Math.floor((now - animStart) / CASCADE_STEP_MS) : -1;
    const stepB = resultB ? Math.floor((now - animStart) / CASCADE_STEP_MS) : -1;
    const levelA = resultA ? resultA.history[Math.min(stepA, resultA.history.length - 1)] : null;
    const levelB = resultB ? resultB.history[Math.min(stepB, resultB.history.length - 1)] : null;

    // Stop animating if both cascades have played out
    if (playing) {
      const doneA = !resultA || stepA >= resultA.history.length - 1;
      const doneB = !resultB || stepB >= resultB.history.length - 1;
      if (doneA && doneB) playing = false;
    }

    // ---- Two side-by-side panels -------------------------------------
    const panelY = 40;
    const panelH = H - panelY - 20;
    const gapX = 12;
    const panelW = (W - 24 - gapX) / 2;

    const drawPanel = (px, side) => {
      const info    = side === 0 ? pair().a : pair().b;
      const sorted  = side === 0 ? sortedA  : sortedB;
      const level   = side === 0 ? levelA   : levelB;
      const activationSteps = side === 0 ? activationStepsA : activationStepsB;
      const result  = side === 0 ? resultA  : resultB;
      const currentStep = side === 0 ? stepA : stepB;
      const accentColor = side === 0 ? P.primary : P.accent;
      // Population-only rioting count (level = instigators + population)
      const rioterCount = level != null ? Math.max(0, level - info.instigators) : null;

      // Panel background
      const isFull = result && result.finalSize >= 90;
      const isFizzle = result && result.finalSize <= 5;
      const bg = isFull ? 'rgba(224,49,49,0.06)' :
                 isFizzle ? 'rgba(134,142,150,0.06)' :
                 'rgba(0,0,0,0.02)';
      ctx.fillStyle = bg;
      roundRectPath(ctx, px, panelY, panelW, panelH, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, px, panelY, panelW, panelH, 14);
      ctx.stroke();

      // Header row
      const headY = panelY + 12;
      ctx.font = 'bold 14px Inter,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = accentColor;
      ctx.fillText(info.name, px + 14, headY);
      // Sub description
      ctx.font = '11px Inter,system-ui,sans-serif';
      ctx.fillStyle = P.muted;
      ctx.fillText(info.sub, px + 14, headY + 18);

      // Progress bar
      const barY = headY + 40;
      const barX = px + 14;
      const barW = panelW - 28;
      const barH = 16;
      ctx.fillStyle = P.line;
      roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
      ctx.fill();
      const filledFrac = rioterCount != null ? Math.min(1, rioterCount / CASCADE_N) : 0;
      const filledW = Math.max(barH, filledFrac * barW);
      if (rioterCount != null && rioterCount > 0) {
        const g = ctx.createLinearGradient(barX, 0, barX + filledW, 0);
        g.addColorStop(0, '#FF6B6B');
        g.addColorStop(1, '#C92A2A');
        ctx.fillStyle = g;
        roundRectPath(ctx, barX, barY, filledW, barH, barH / 2);
        ctx.fill();
      }
      // Count overlay
      ctx.font = 'bold 12px Inter,system-ui,sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const countTxt = rioterCount != null ? `🔥 ${rioterCount} / 100 rioting` : '  ready to spark…';
      ctx.fillStyle = P.ink;
      ctx.fillText(countTxt, barX + barW - 6, barY + barH / 2 + 1);

      // Face grid (10x10)
      const gridTop = barY + barH + 14;
      const gridBottom = panelY + panelH - 40;
      const gridH = gridBottom - gridTop;
      const gridW = panelW - 20;
      const gridX0 = px + 10;
      const cellW = gridW / 10;
      const cellH = gridH / 10;
      const faceR = Math.min(cellW, cellH) * 0.38;

      // A person is "rioting" iff their index in the sorted-by-threshold order
      // is below the number of population members who've joined. This keeps the
      // face count and the header number perfectly in sync regardless of how
      // many external instigators were seeded.
      const nRioting = rioterCount ?? 0;
      for (let i = 0; i < CASCADE_N; i++) {
        const col = i % 10;
        const row = Math.floor(i / 10);
        const cx = gridX0 + (col + 0.5) * cellW;
        const cy = gridTop + (row + 0.5) * cellH;
        const isRioting = i < nRioting;
        let pulseAge = null;
        if (isRioting && activationSteps && activationSteps[i] >= 0 && activationSteps[i] <= currentStep) {
          pulseAge = now - animStart - activationSteps[i] * CASCADE_STEP_MS;
        }
        drawFace(ctx, cx, cy, faceR, isRioting ? 'angry' : 'calm', pulseAge);
      }

      // Final result banner at the bottom
      if (result && !playing) {
        const bannerY = panelY + panelH - 30;
        ctx.font = 'bold 15px Inter,system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (result.finalSize >= 90) {
          ctx.fillStyle = P.danger;
          ctx.fillText(`🔥 FULL RIOT — ${result.finalSize} joined`, px + panelW / 2, bannerY);
        } else if (result.finalSize <= 5) {
          ctx.fillStyle = P.muted;
          ctx.fillText(`😌 nothing happens — ${result.finalSize} rioting`, px + panelW / 2, bannerY);
        } else {
          ctx.fillStyle = P.warn;
          ctx.fillText(`🕯️ partial — ${result.finalSize} joined, then stalled`, px + panelW / 2, bannerY);
        }
      }
    };

    drawPanel(12, 0);
    drawPanel(12 + panelW + gapX, 1);
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    render();
    return playing;
  });

  sparkBtn.onclick = () => { if (!thresholdsA) recompute(); spark(); };
  rerollBtn.onclick = () => {
    if (pair().deterministic) return;
    const startSeed = 1001 + Math.floor(Math.random() * 100000);
    if (currentPair === 'luck') {
      overrideSeeds = findLuckyPair(startSeed);
    } else if (pair().sharedCrowd) {
      overrideSeeds = { a: startSeed, b: startSeed };
    } else {
      overrideSeeds = { a: startSeed, b: startSeed + 13 };
    }
    recompute();
    spark();   // auto-play so the new crowds actually cascade in front of you
  };

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentPair = btn.getAttribute('data-pair');
      presetBtns.forEach(b => b.classList.toggle('active',
        b.getAttribute('data-pair') === currentPair));
      overrideSeeds = null;
      recompute();
      spark();   // auto-play on preset switch so the user sees the wave immediately
      rerollBtn.style.opacity = pair().deterministic ? '0.4' : '1';
      rerollBtn.style.pointerEvents = pair().deterministic ? 'none' : 'auto';
    });
  });

  recompute();
  rerollBtn.style.opacity = pair().deterministic ? '0.4' : '1';
  rerollBtn.style.pointerEvents = pair().deterministic ? 'none' : 'auto';
  spark();   // start with the canonical pair auto-playing
}

// ============================================================================
// Sim 2 · El Farol Bar  (unchanged from previous version)
// ============================================================================

const EF_PREDICTORS = [
  { name: 'last week',   fn: h => h.length ? h[h.length - 1] : 50 },
  { name: 'avg last 4',  fn: h => h.length ? h.slice(-4).reduce((s, v) => s + v, 0) / Math.min(4, h.length) : 50 },
  { name: 'mirror',      fn: h => h.length ? 100 - h[h.length - 1] : 50 },
  { name: 'constant 60', fn: () => 60 },
  { name: 'trend',       fn: h => {
      if (h.length < 2) return h.length ? h[h.length - 1] : 50;
      return Math.max(0, Math.min(100, 2 * h[h.length - 1] - h[h.length - 2]));
    } },
  { name: 'avg last 8',  fn: h => h.length ? h.slice(-8).reduce((s, v) => s + v, 0) / Math.min(8, h.length) : 50 },
];

function initBarSim() {
  const canvas = document.getElementById('sim-bar');
  if (!canvas) return;
  const playBtn   = document.getElementById('bar-play');
  const resetBtn  = document.getElementById('bar-reset');
  const toggleEl  = document.getElementById('ef-mode-toggle');
  const mAttend   = document.getElementById('b-attend');
  const mMean     = document.getElementById('b-mean');
  const mStd      = document.getElementById('b-std');

  const CANVAS_H = 460;
  const N_AGENTS = 100;
  const CAPACITY = 60;
  const WARMUP = 12;
  const STEP_MS = 320;
  const HISTORY_SHOWN = 60;

  let mode = 'diverse';
  let seed = Math.floor(Math.random() * 1e6);
  let rng = makeRng(seed);
  let agentsPreds = [];
  let history = [];
  let playing = false;
  let lastStep = 0;

  function resetSim() {
    rng = makeRng(seed);
    agentsPreds = [];
    if (mode === 'homogeneous') {
      for (let i = 0; i < N_AGENTS; i++) agentsPreds.push([1]);
    } else {
      for (let i = 0; i < N_AGENTS; i++) {
        const idx = [0, 1, 2, 3, 4, 5];
        shuffleInPlace(idx, rng);
        agentsPreds.push(idx.slice(0, 3));
      }
    }
    history = [];
    for (let w = 0; w < WARMUP; w++) {
      history.push(Math.floor(rng() * (N_AGENTS + 1)));
    }
  }

  function stepOnce() {
    let nGoing = 0;
    for (let i = 0; i < N_AGENTS; i++) {
      const preds = agentsPreds[i];
      let best = preds[0];
      let bestErr = Infinity;
      const windowLen = Math.min(WARMUP, history.length);
      for (const pi of preds) {
        const fn = EF_PREDICTORS[pi].fn;
        let err = 0;
        for (let k = 1; k <= windowLen; k++) {
          const trunc = history.slice(0, history.length - k);
          const forecast = fn(trunc);
          const actual = history[history.length - k];
          err += (forecast - actual) ** 2;
        }
        if (err < bestErr) { bestErr = err; best = pi; }
      }
      const forecast = EF_PREDICTORS[best].fn(history);
      if (forecast < CAPACITY) nGoing++;
    }
    history.push(nGoing);
  }

  resetSim();

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    if (playing && now - lastStep >= STEP_MS) {
      stepOnce();
      lastStep = now;
    }

    const attend = history[history.length - 1] ?? 0;
    const overCap = attend > CAPACITY;

    const barY = 20;
    const barH = 180;
    const barMargin = 20;

    const barW = W - 2 * barMargin;
    const midX = W / 2;
    const leftW = barW / 2 - 6;
    const rightW = barW / 2 - 6;
    const leftX = barMargin;
    const rightX = midX + 6;

    ctx.fillStyle = 'rgba(76,110,245,0.06)';
    roundRectPath(ctx, leftX, barY, leftW, barH, 12);
    ctx.fill();
    ctx.fillStyle = overCap ? 'rgba(224,49,49,0.10)' : 'rgba(55,178,77,0.08)';
    roundRectPath(ctx, rightX, barY, rightW, barH, 12);
    ctx.fill();

    ctx.font = 'bold 13px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.primary;
    ctx.fillText('🏠 stayed home', leftX + 12, barY + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = overCap ? P.danger : P.success;
    ctx.fillText(overCap ? '🍺 the bar (packed!)' : '🍺 the bar', rightX + rightW - 12, barY + 10);

    const nHome = N_AGENTS - attend;
    const dotR = 4;
    const drawDots = (x0, y0, w, h, count, color) => {
      const cols = Math.ceil(Math.sqrt(count * w / Math.max(h, 1)));
      const rows = Math.ceil(count / cols);
      const cellW = w / cols;
      const cellH = h / rows;
      for (let k = 0; k < count; k++) {
        const col = k % cols;
        const row = Math.floor(k / cols);
        const cx = x0 + col * cellW + cellW / 2;
        const cy = y0 + row * cellH + cellH / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawDots(leftX + 10, barY + 32, leftW - 20, barH - 42, nHome, P.primary);
    drawDots(rightX + 10, barY + 32, rightW - 20, barH - 42, attend,
             overCap ? P.danger : P.success);

    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = P.muted;
    ctx.fillText(`capacity = ${CAPACITY}`, rightX + rightW - 12, barY + barH - 8);

    ctx.font = 'bold 40px Inter,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = overCap ? P.danger : P.success;
    ctx.fillText(`${attend}`, midX, barY + barH / 2);
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.fillText('this week', midX, barY + barH / 2 + 28);

    const chartY = barY + barH + 26;
    const chartH = H - chartY - 20;
    const chartX = 30;
    const chartW = W - 60;

    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY); ctx.lineTo(chartX, chartY + chartH);
    ctx.moveTo(chartX, chartY + chartH); ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.stroke();

    const capY = chartY + chartH - (CAPACITY / N_AGENTS) * chartH;
    ctx.strokeStyle = P.muted;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX, capY); ctx.lineTo(chartX + chartW, capY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = P.muted;
    ctx.fillText(`capacity = ${CAPACITY}`, chartX + 4, capY - 2);

    const start = Math.max(WARMUP, history.length - HISTORY_SHOWN);
    const shown = history.slice(start);
    if (shown.length > 1) {
      ctx.strokeStyle = P.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < shown.length; i++) {
        const px = chartX + (i / Math.max(1, shown.length - 1)) * chartW;
        const py = chartY + chartH - (shown[i] / N_AGENTS) * chartH;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      for (let i = 0; i < shown.length; i++) {
        const px = chartX + (i / Math.max(1, shown.length - 1)) * chartW;
        const py = chartY + chartH - (shown[i] / N_AGENTS) * chartH;
        ctx.fillStyle = shown[i] > CAPACITY ? P.danger : P.success;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.muted;
    ctx.fillText(`attendance over last ${shown.length} weeks`, chartX + 4, chartY + 4);

    const post = history.slice(WARMUP);
    setMetric(mAttend, `${attend}`, overCap ? 'over capacity ⚠️' : 'under capacity ✓');
    if (post.length) {
      const mean = post.reduce((s, v) => s + v, 0) / post.length;
      const variance = post.reduce((s, v) => s + (v - mean) ** 2, 0) / post.length;
      setMetric(mMean, mean.toFixed(1),
                Math.abs(mean - CAPACITY) < 8 ? '≈ capacity ✓' : 'off capacity');
      setMetric(mStd, Math.sqrt(variance).toFixed(1));
    } else {
      setMetric(mMean, '—');
      setMetric(mStd, '—');
    }
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    render();
    return playing;
  });

  playBtn.onclick = () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
    if (playing) { lastStep = 0; loop.start(); }
  };
  resetBtn.onclick = () => {
    seed = Math.floor(Math.random() * 1e6);
    resetSim();
    playing = false;
    playBtn.textContent = '▶ Play';
    render();
  };

  toggleEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.getAttribute('data-mode');
      toggleEl.querySelectorAll('button').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-mode') === mode));
      seed = Math.floor(Math.random() * 1e6);
      resetSim();
      playing = false;
      playBtn.textContent = '▶ Play';
      render();
    });
  });

  render();
}

// ============================================================================
// Sim 3 · The Chaos Field · 100 crowds at once, colored by outcome
// ============================================================================

function initTippingSim() {
  const canvas = document.getElementById('sim-tip');
  if (!canvas) return;
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  const mFull    = document.getElementById('t-full');
  const mFizzle  = document.getElementById('t-fizzle');
  const mEntropy = document.getElementById('t-entropy');
  const jumpBtns = document.querySelectorAll('button[data-sd-jump]');

  const CANVAS_H = 620;
  const N_AGENTS = 100;
  const MEAN_THRESH = 25;
  const GRID = 10;
  const N_CROWDS = GRID * GRID;
  const INSTIGATORS = 1;

  const cache = new Map();

  function runField(sd) {
    if (cache.has(sd)) return cache.get(sd);
    const outcomes = new Array(N_CROWDS);
    for (let i = 0; i < N_CROWDS; i++) {
      const rng = makeRng(9000 + i * 7);
      const thr = new Array(N_AGENTS);
      for (let j = 0; j < N_AGENTS; j++) {
        thr[j] = Math.max(0, Math.min(N_AGENTS,
                          MEAN_THRESH + normal01(rng) * sd));
      }
      outcomes[i] = runCascade(thr, INSTIGATORS).finalSize;
    }
    let full = 0, fizzle = 0, partial = 0;
    for (const o of outcomes) {
      if (o >= 90) full++;
      else if (o <= 10) fizzle++;
      else partial++;
    }
    // Predictability: how often would you guess right if you always picked
    // the most likely outcome (out of full / fizzle / partial)?
    const predictable = Math.max(full, fizzle, partial) / N_CROWDS;
    // Regime classification for the big badge
    let regime;
    if (full >= 75) {
      regime = { key: 'roar', emoji: '🔥', label: 'ROARING',
                 sub: 'almost every crowd cascades — predictable riot',
                 bg: 'rgba(224,49,49,0.16)', color: '#C92A2A' };
    } else if (fizzle >= 75) {
      regime = { key: 'safe', emoji: '🌤️', label: 'SAFE',
                 sub: 'almost every crowd fizzles — predictable calm',
                 bg: 'rgba(55,178,77,0.14)', color: '#2B8A3E' };
    } else if (full >= 25 && fizzle >= 15) {
      regime = { key: 'tip', emoji: '⚡', label: 'TIPPING POINT',
                 sub: 'same recipe, opposite fates — you literally cannot predict what happens next',
                 bg: 'rgba(247,103,7,0.14)', color: '#D9480F' };
    } else if (partial >= 55) {
      regime = { key: 'stuck', emoji: '🌫️', label: 'STUCK',
                 sub: 'cascades start but stall on stubborn holdouts',
                 bg: 'rgba(134,142,150,0.14)', color: '#495057' };
    } else {
      regime = { key: 'mixed', emoji: '🎲', label: 'MIXED',
                 sub: 'outcomes still spread across the board',
                 bg: 'rgba(112,72,232,0.12)', color: '#5F3DC4' };
    }
    const res = { outcomes, full, fizzle, partial, predictable, regime };
    cache.set(sd, res);
    return res;
  }

  function moodOf(size) {
    if (size >= 90) return 'angry';
    if (size <= 10) return 'calm';
    return 'worried';
  }

  let currentSD = 15;

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const data = runField(currentSD);

    // ---- Header story ------------------------------------------------
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.muted;
    ctx.fillText(`100 fresh crowds sampled from Normal(mean = ${MEAN_THRESH}, SD = ${currentSD}). Each face below is one crowd's final fate.`,
                 W / 2, 10);

    // ---- Big regime badge --------------------------------------------
    const badgeY = 36;
    const badgeH = 78;
    const badgeMargin = 24;
    ctx.fillStyle = data.regime.bg;
    roundRectPath(ctx, badgeMargin, badgeY, W - 2 * badgeMargin, badgeH, 16);
    ctx.fill();
    // Emoji on the left
    ctx.font = 'bold 42px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = data.regime.color;
    ctx.fillText(data.regime.emoji, badgeMargin + 18, badgeY + badgeH / 2);
    // Label + subtitle
    ctx.font = 'bold 22px Inter,system-ui,sans-serif';
    ctx.fillStyle = data.regime.color;
    ctx.fillText(data.regime.label, badgeMargin + 78, badgeY + 26);
    ctx.font = '12px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.ink;
    ctx.fillText(data.regime.sub, badgeMargin + 78, badgeY + 52);

    // ---- Face grid ---------------------------------------------------
    const gridTop = badgeY + badgeH + 20;
    const gridSize = Math.min(W - 48, 480);
    const cellSize = gridSize / GRID;
    const gridX = (W - gridSize) / 2;

    for (let i = 0; i < N_CROWDS; i++) {
      const col = i % GRID;
      const row = Math.floor(i / GRID);
      const cx = gridX + (col + 0.5) * cellSize;
      const cy = gridTop + (row + 0.5) * cellSize;
      const size = data.outcomes[i];
      const faceR = cellSize * 0.38;
      drawFace(ctx, cx, cy, faceR, moodOf(size));
    }

    // ---- Legend row under the grid -----------------------------------
    const legY = gridTop + gridSize + 22;
    const legW = 460;
    const legX = (W - legW) / 2;
    const drawLegItem = (x, mood, label) => {
      drawFace(ctx, x + 12, legY + 8, 12, mood);
      ctx.font = '12px Inter,system-ui,sans-serif';
      ctx.fillStyle = P.ink;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 28, legY + 8);
    };
    drawLegItem(legX,               'calm',    'fizzled (≤ 10)');
    drawLegItem(legX + legW / 3,    'worried', 'partial (11–89)');
    drawLegItem(legX + 2 * legW / 3, 'angry',   'full riot (≥ 90)');

    // ---- Update HTML metrics ----------------------------------------
    setMetric(mFull, `${data.full} / 100`, `${((data.full / N_CROWDS) * 100).toFixed(0)}% of crowds`);
    setMetric(mFizzle, `${data.fizzle} / 100`, `${((data.fizzle / N_CROWDS) * 100).toFixed(0)}% of crowds`);
    setMetric(mEntropy, `${Math.round(data.predictable * 100)}%`,
              data.predictable > 0.85 ? '"I could bet on it"' :
              data.predictable > 0.60 ? 'mostly one outcome' :
              'coin flip — genuinely unpredictable');
  }
  onResize(canvas, CANVAS_H, render);

  bindSlider(sliderRoot, v => { currentSD = v; render(); });

  jumpBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sd = Number(btn.getAttribute('data-sd-jump'));
      const inp = sliderRoot.querySelector('input[type="range"]');
      inp.value = sd;
      sliderRoot.querySelector('.value').textContent = sd;
      currentSD = sd;
      render();
    });
  });

  // Warm the cache for common SDs on load
  for (const sd of [3, 5, 10, 15, 20, 25, 40, 60]) runField(sd);

  render();
}

// ============================================================================
// Bootstrap
// ============================================================================

initCascadeSim();
initBarSim();
initTippingSim();
