// Markov chains story — three sims:
//   1. State graph with an animated walker + live time-in-state vs π
//   2. Three parallel worlds racing to the same stationary distribution
//   3. One-time intervention vs. rule change on the drug-cycle chain

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { makeRng, setMetric } from '../shared/ui.js';

const P = {
  primary: '#4C6EF5', accent: '#F76707', success: '#37B24D',
  danger: '#E03131', warn: '#F59F00', muted: '#868E96',
  ink: '#212529', line: '#E9ECEF', bgSoft: '#F5F7FC',
};

// A palette of state colours, kept consistent across sims.
const STATE_COLORS = ['#4C6EF5', '#F76707', '#37B24D', '#7048E8', '#F59F00', '#12B886'];

// ---------- Presets ---------------------------------------------------------

const PRESETS = {
  students: {
    name: 'Attention span',
    hook: '<strong>🧑‍🎓 Attention span.</strong> Even the sharpest student drifts. How much of the lecture time is spent zoned out?',
    walker: '🧑‍🎓',
    states: ['🙂 Alert', '😴 Bored'],
    matrix: [[0.90, 0.10], [0.70, 0.30]],
  },
  weather: {
    name: 'The weather',
    hook: '<strong>🌤 The weather.</strong> Sunny is sticky, rainy is stickier still. But it all mixes to a long-run climate.',
    walker: '🌤',
    states: ['☀ Sunny', '☁ Cloudy', '🌧 Rainy'],
    matrix: [[0.70, 0.20, 0.10], [0.30, 0.40, 0.30], [0.20, 0.30, 0.50]],
  },
  democracy: {
    name: 'Freedom over time',
    hook: '<strong>🌍 Freedom, over time.</strong> Countries drift between Free, Partly Free, and Not Free. Where do they land in the long run?',
    walker: '🌍',
    states: ['🏛 Free', '⚖ Partly', '🔒 Not Free'],
    matrix: [[0.94, 0.05, 0.01], [0.10, 0.80, 0.10], [0.03, 0.10, 0.87]],
  },
  drug: {
    name: 'Addiction cycle',
    hook: '<strong>👤 The addiction cycle.</strong> One person\'s path through the four states. Notice how easily the walker returns to the same mix, even after "recovery".',
    walker: '👤',
    states: ['✅ Sober', '🌀 Using', '⚠ Addicted', '🌱 Recovering'],
    matrix: [
      [0.85, 0.13, 0.00, 0.02],
      [0.30, 0.50, 0.20, 0.00],
      [0.02, 0.20, 0.75, 0.03],
      [0.60, 0.05, 0.05, 0.30],
    ],
  },
  brands: {
    name: 'Brand loyalty',
    hook: '<strong>🛒 Brand loyalty.</strong> Every period a shopper stays or switches. The stationary distribution is the long-run market share.',
    walker: '🛒',
    states: ['🅰 Brand A', '🅱 Brand B', '🅲 Brand C'],
    matrix: [[0.80, 0.10, 0.10], [0.15, 0.75, 0.10], [0.20, 0.15, 0.65]],
  },
};

// ---------- Math helpers ----------------------------------------------------

/** Compute stationary distribution via power iteration. */
function stationary(mat, iters = 400) {
  const n = mat.length;
  let x = new Array(n).fill(1 / n);
  for (let k = 0; k < iters; k++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) next[j] += x[i] * mat[i][j];
    }
    x = next;
  }
  return x;
}

/** Sample the next state given current state and matrix. */
function nextState(current, mat, rng) {
  const row = mat[current];
  let r = rng();
  for (let j = 0; j < row.length; j++) {
    r -= row[j];
    if (r <= 0) return j;
  }
  return row.length - 1;
}

/** Advance a probability distribution one step: x_{t+1} = x_t · P. */
function advanceDistribution(dist, mat) {
  const n = dist.length;
  const next = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) next[j] += dist[i] * mat[i][j];
  }
  return next;
}

// ---------- Drawing helpers -------------------------------------------------

function roundRectPath(ctx, x, y, w, h, r) {
  // Clamp radius to the largest that fits — otherwise arcTo goes wild and
  // draws spurious curves that spill outside the rectangle (this happens for
  // pill-shaped bars whose filled portion shrinks to a few pixels).
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStateNode(ctx, cx, cy, r, label, colour, highlight = false) {
  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  // Gradient fill
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.2, cx, cy, r);
  grad.addColorStop(0, lighten(colour, 40));
  grad.addColorStop(1, colour);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Border on highlight
  if (highlight) {
    ctx.strokeStyle = P.warn;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 14px Inter, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}

function lighten(hex, pct) {
  // Very cheap hex lightener.
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  r = Math.min(255, r + pct);
  g = Math.min(255, g + pct);
  b = Math.min(255, b + pct);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawArrow(ctx, from, to, prob, colour) {
  if (prob < 0.02) return;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  // "Left-hand" perpendicular (90° CCW from travel direction). Because we
  // always use the left-hand side, a bidirectional pair naturally curves on
  // *opposite* sides of the connecting line — one arrow's left is the other
  // arrow's right — so the two arrows and their labels don't collide.
  const px = -uy, py = ux;
  const nodeR = 32;
  const start = { x: from.x + ux * nodeR + px * 6, y: from.y + uy * nodeR + py * 6 };
  const end = { x: to.x - ux * nodeR + px * 6, y: to.y - uy * nodeR + py * 6 };
  const midOffset = len * 0.12;
  const mid = {
    x: (start.x + end.x) / 2 + px * midOffset,
    y: (start.y + end.y) / 2 + py * midOffset,
  };

  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1 + prob * 5;
  ctx.globalAlpha = 0.25 + prob * 0.6;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(end.y - mid.y, end.x - mid.x);
  const arrowSize = 9;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - arrowSize * Math.cos(angle - Math.PI / 6),
    end.y - arrowSize * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    end.x - arrowSize * Math.cos(angle + Math.PI / 6),
    end.y - arrowSize * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();

  // Label for prominent arrows
  if (prob >= 0.1) {
    ctx.fillStyle = P.ink;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Small white pill for readability
    const label = prob.toFixed(2);
    const w = ctx.measureText(label).width + 8;
    const h = 14;
    ctx.fillStyle = 'white';
    roundRectPath(ctx, mid.x - w / 2, mid.y - h / 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.fillText(label, mid.x, mid.y);
  }
}

function drawSelfLoop(ctx, cx, cy, prob, colour) {
  if (prob < 0.02) return;
  const r = 22;
  const loopCx = cx;
  const loopCy = cy - 44;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1 + prob * 5;
  ctx.globalAlpha = 0.25 + prob * 0.6;
  ctx.beginPath();
  ctx.arc(loopCx, loopCy, r, Math.PI * 0.15, Math.PI * 0.85 + Math.PI, false);
  ctx.stroke();
  // Arrowhead
  const arrowAngle = Math.PI * 0.15;
  const ex = loopCx + r * Math.cos(arrowAngle);
  const ey = loopCy + r * Math.sin(arrowAngle);
  const tangent = arrowAngle + Math.PI / 2;
  const arrowSize = 8;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - arrowSize * Math.cos(tangent - Math.PI / 6),
    ey - arrowSize * Math.sin(tangent - Math.PI / 6),
  );
  ctx.lineTo(
    ex - arrowSize * Math.cos(tangent + Math.PI / 6),
    ey - arrowSize * Math.sin(tangent + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();
  if (prob >= 0.1) {
    ctx.fillStyle = P.ink;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = prob.toFixed(2);
    const w = ctx.measureText(label).width + 8;
    const h = 14;
    ctx.fillStyle = 'white';
    roundRectPath(ctx, loopCx - w / 2, loopCy - r - 4 - h / 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.fillText(label, loopCx, loopCy - r - 4);
  }
}

function statePositions(n, cx, cy, radius) {
  // Arrange states in a circle. For n=2, place them horizontally.
  if (n === 2) {
    return [
      { x: cx - radius, y: cy },
      { x: cx + radius, y: cy },
    ];
  }
  const positions = [];
  const startAngle = -Math.PI / 2;  // top
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / n;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return positions;
}

// ============================================================================
// SIM 1 · State graph with walker
// ============================================================================

function initStateGraph() {
  const canvas = document.getElementById('mkv-graph');
  if (!canvas) return;
  const playBtn = document.getElementById('mkv-play');
  const stepBtn = document.getElementById('mkv-step');
  const resetBtn = document.getElementById('mkv-reset');
  const tabsRoot = document.getElementById('mkv-preset-tabs');
  const hookEl = document.getElementById('mkv-hook');
  const mTime = document.getElementById('mkv-time');
  const mHere = document.getElementById('mkv-here');
  const mMix = document.getElementById('mkv-mix');

  const CANVAS_H = 500;
  const STEP_MS = 900;             // one hop per this many ms in auto mode
  const HOP_MS = 620;              // duration of the walker's animated hop

  let presetKey = 'students';
  let preset = PRESETS[presetKey];
  let mat = preset.matrix;
  let pi = stationary(mat);
  let rng = makeRng(Math.floor(Math.random() * 1e6));

  let currentState = 0;
  let nextStateIdx = 0;
  let hopStart = 0;                // ms timestamp when the current hop began
  let hopping = false;
  let timeSteps = 0;
  let visitCounts = new Array(mat.length).fill(0);
  visitCounts[currentState] = 1;
  let auto = false;
  let lastStepAt = 0;

  function setPreset(key) {
    presetKey = key;
    preset = PRESETS[key];
    mat = preset.matrix;
    pi = stationary(mat);
    for (const btn of tabsRoot.querySelectorAll('button')) {
      btn.classList.toggle('btn-primary', btn.dataset.preset === key);
    }
    hookEl.innerHTML = preset.hook;
    reset();
  }

  function reset() {
    rng = makeRng(Math.floor(Math.random() * 1e6));
    currentState = 0;
    nextStateIdx = 0;
    hopping = false;
    timeSteps = 0;
    visitCounts = new Array(mat.length).fill(0);
    visitCounts[currentState] = 1;
    auto = false;
    playBtn.textContent = '▶ Auto-walk';
    render();
  }

  function beginHop(now) {
    if (hopping) return;
    nextStateIdx = nextState(currentState, mat, rng);
    hopStart = now;
    hopping = true;
  }

  function commitHop() {
    currentState = nextStateIdx;
    hopping = false;
    timeSteps++;
    visitCounts[currentState]++;
  }

  function update(now) {
    if (hopping && now - hopStart >= HOP_MS) commitHop();
    if (auto && !hopping && now - lastStepAt >= STEP_MS - HOP_MS) {
      beginHop(now);
      lastStepAt = now;
    }
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();
    update(now);

    const n = mat.length;
    // Graph area (left side ~65% width), bars area (right ~35%)
    const graphW = Math.min(W * 0.65, W - 220);
    const graphCX = graphW / 2;
    const graphCY = H / 2;
    const graphRadius = Math.min(graphW, H) * 0.32;
    const nodeR = 32;
    const positions = statePositions(n, graphCX, graphCY, graphRadius);

    // Draw arrows first (behind nodes). drawArrow always uses the left-hand
    // perpendicular relative to travel direction, so an i→j and j→i pair
    // naturally curves on opposite sides of the line.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        drawArrow(ctx, positions[i], positions[j], mat[i][j], STATE_COLORS[i % STATE_COLORS.length]);
      }
    }
    // Self-loops (on top of state colour of that node)
    for (let i = 0; i < n; i++) {
      drawSelfLoop(ctx, positions[i].x, positions[i].y, mat[i][i], STATE_COLORS[i % STATE_COLORS.length]);
    }

    // Draw nodes
    for (let i = 0; i < n; i++) {
      const highlight = !hopping && i === currentState;
      drawStateNode(ctx, positions[i].x, positions[i].y, nodeR,
                    preset.states[i], STATE_COLORS[i % STATE_COLORS.length], highlight);
    }

    // Draw walker
    let walkerX, walkerY;
    if (hopping) {
      const t = Math.min(1, (now - hopStart) / HOP_MS);
      const eased = easeOut(t);
      const from = positions[currentState];
      const to = positions[nextStateIdx];
      walkerX = from.x + (to.x - from.x) * eased;
      walkerY = from.y + (to.y - from.y) * eased;
      // Add a slight arc so the walker "hops"
      walkerY -= Math.sin(Math.PI * t) * 30;
    } else {
      walkerX = positions[currentState].x;
      walkerY = positions[currentState].y - nodeR - 26;
      // Small idle bounce
      walkerY += Math.sin(now / 300) * 2;
    }
    ctx.font = '30px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText(preset.walker, walkerX, walkerY);
    ctx.restore();

    // Draw the empirical-mix panel on the right
    const barsX = graphW + 20;
    const barsW = W - barsX - 20;
    const barsY = 24;
    const barsH = H - 48;
    drawEmpiricalPanel(ctx, barsX, barsY, barsW, barsH, visitCounts, pi, preset.states);

    // Metrics
    setMetric(mTime, String(timeSteps));
    setMetric(mHere, preset.states[currentState]);
    // Show the total-variation distance between empirical and π
    const total = visitCounts.reduce((a, b) => a + b, 0);
    const emp = visitCounts.map(c => c / total);
    let dist = 0;
    for (let i = 0; i < n; i++) dist += Math.abs(emp[i] - pi[i]);
    setMetric(mMix, `${(dist / 2).toFixed(3)}`, dist < 0.05 ? '≈ matches π 🎯' : 'give it more steps');
  }

  function drawEmpiricalPanel(ctx, x, y, w, h, counts, piArr, labels) {
    const n = counts.length;
    const total = counts.reduce((a, b) => a + b, 0);
    const emp = counts.map(c => c / total);
    // Title
    ctx.fillStyle = P.ink;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Time-in-state so far', x, y);
    ctx.fillStyle = P.muted;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('bars = empirical  ·  ◆ = π (theoretical)', x, y + 18);
    // Bars
    const rowH = (h - 42) / n;
    for (let i = 0; i < n; i++) {
      const cy = y + 42 + i * rowH;
      // State label
      ctx.fillStyle = P.ink;
      ctx.font = 'bold 12px Inter, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, cy + rowH * 0.3);
      // Bar
      const barY = cy + rowH * 0.55;
      const barH = rowH * 0.35;
      const maxW = w;
      // Grey background pill (always visible).
      ctx.fillStyle = P.line;
      roundRectPath(ctx, x, barY, maxW, barH, barH / 2);
      ctx.fill();
      // Coloured fill — only if the walker has actually spent time here.
      // Skip drawing entirely at 0 %, so we don't get a tiny leftover sliver
      // that clamps into a weird narrow rectangle.
      if (emp[i] > 0) {
        const fillW = Math.max(barH, emp[i] * maxW);
        ctx.fillStyle = STATE_COLORS[i % STATE_COLORS.length];
        roundRectPath(ctx, x, barY, fillW, barH, barH / 2);
        ctx.fill();
      }
      // π diamond
      const piX = x + piArr[i] * maxW;
      const piY = barY + barH / 2;
      ctx.fillStyle = P.danger;
      ctx.beginPath();
      ctx.moveTo(piX, piY - 6);
      ctx.lineTo(piX + 5, piY);
      ctx.lineTo(piX, piY + 6);
      ctx.lineTo(piX - 5, piY);
      ctx.closePath();
      ctx.fill();
      // Empirical value at end of bar
      ctx.fillStyle = P.ink;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(100 * emp[i]).toFixed(0)}%`, x + maxW - 4, barY + barH / 2);
    }
  }

  const loop = makeLoop(() => {
    render();
    if (!auto && !hopping) return false;
  });
  onResize(canvas, CANVAS_H, render);

  playBtn.addEventListener('click', () => {
    if (auto) {
      auto = false;
      playBtn.textContent = '▶ Auto-walk';
    } else {
      auto = true;
      lastStepAt = performance.now() - STEP_MS;
      playBtn.textContent = '⏸ Pause';
      loop.start();
    }
  });
  stepBtn.addEventListener('click', () => {
    if (!hopping) {
      beginHop(performance.now());
      loop.start();
    }
  });
  resetBtn.addEventListener('click', reset);
  for (const btn of tabsRoot.querySelectorAll('button')) {
    btn.addEventListener('click', () => setPreset(btn.dataset.preset));
  }

  setPreset('students');
}

// ============================================================================
// SIM 2 · Convergence race — 3 worlds, same P, different starts
// ============================================================================

function initConvergenceRace() {
  const canvas = document.getElementById('mkv-race');
  if (!canvas) return;
  const playBtn = document.getElementById('mkv-race-play');
  const resetBtn = document.getElementById('mkv-race-reset');

  const CANVAS_H = 420;
  const preset = PRESETS.weather;   // Use weather as the demo chain (3 states)
  const mat = preset.matrix;
  const pi = stationary(mat);
  const N_STEPS = 60;

  const scenarios = [
    { label: `All start ${preset.states[0]}`, init: [1, 0, 0] },
    { label: `All start ${preset.states[preset.states.length - 1]}`, init: [0, 0, 1] },
    { label: 'Uniform start (⅓ each)', init: [1 / 3, 1 / 3, 1 / 3] },
  ];

  let history = null;
  let currentStep = 0;
  let auto = false;
  let lastStepAt = 0;

  function reset() {
    history = scenarios.map(s => [s.init.slice()]);
    currentStep = 0;
    auto = false;
    playBtn.textContent = '▶ Race them';
  }
  reset();

  function step() {
    for (let i = 0; i < scenarios.length; i++) {
      const cur = history[i][history[i].length - 1];
      history[i].push(advanceDistribution(cur, mat));
    }
    currentStep++;
  }

  function drawPanel(ctx, x, y, w, h, scenario, hist) {
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.fillStyle = P.bgSoft;
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.fill();

    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(scenario.label, x + w / 2, y + 8);

    const pad = { l: 12, r: 12, t: 30, b: 30 };
    const plotX = x + pad.l, plotY = y + pad.t;
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

    // Stacked area chart
    const T = hist.length;
    if (T > 1) {
      const n = preset.states.length;
      for (let s = 0; s < n; s++) {
        ctx.beginPath();
        for (let t = 0; t < T; t++) {
          const xNorm = t / (N_STEPS - 1);
          let yBase = 0;
          for (let k = 0; k < s; k++) yBase += hist[t][k];
          const yTop = yBase + hist[t][s];
          const px = plotX + xNorm * plotW;
          const py = plotY + (1 - yTop) * plotH;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        for (let t = T - 1; t >= 0; t--) {
          const xNorm = t / (N_STEPS - 1);
          let yBase = 0;
          for (let k = 0; k < s; k++) yBase += hist[t][k];
          const px = plotX + xNorm * plotW;
          const py = plotY + (1 - yBase) * plotH;
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = STATE_COLORS[s % STATE_COLORS.length];
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // Baseline
    ctx.strokeStyle = P.line;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Final-fraction annotations (rightmost tick per state)
    const last = hist[hist.length - 1];
    let yBase = 0;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    for (let s = 0; s < preset.states.length; s++) {
      const mid = yBase + last[s] / 2;
      const py = plotY + (1 - mid) * plotH;
      if (last[s] > 0.06) {
        ctx.fillStyle = 'white';
        ctx.fillText(`${(100 * last[s]).toFixed(0)}%`, plotX + plotW - 4, py);
      }
      yBase += last[s];
    }

    // Step counter
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = P.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`step ${currentStep} / ${N_STEPS}`, x + w / 2, y + h - 4);
  }

  function drawLegend(ctx, x, y, w) {
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x;
    for (let i = 0; i < preset.states.length; i++) {
      ctx.fillStyle = STATE_COLORS[i % STATE_COLORS.length];
      ctx.beginPath();
      ctx.arc(cx, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.fillText(`${preset.states[i]} · π=${(100 * pi[i]).toFixed(0)}%`, cx + 12, y);
      cx += 160;
      if (cx > x + w - 100) { cx = x; y += 18; }
    }
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    // Legend up top
    drawLegend(ctx, 16, 16, W - 32);
    // Three panels
    const panelY = 40;
    const panelH = H - 60;
    const gap = 12;
    const panelW = (W - 24 - 2 * gap) / 3;
    for (let i = 0; i < scenarios.length; i++) {
      const px = 12 + i * (panelW + gap);
      drawPanel(ctx, px, panelY, panelW, panelH, scenarios[i], history[i]);
    }
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    const now = performance.now();
    if (auto && currentStep < N_STEPS && now - lastStepAt >= 120) {
      step();
      lastStepAt = now;
    }
    render();
    if (currentStep >= N_STEPS) {
      auto = false;
      playBtn.textContent = '▶ Race them';
    }
    if (!auto && currentStep >= N_STEPS) return false;
  });

  playBtn.addEventListener('click', () => {
    if (auto) {
      auto = false;
      playBtn.textContent = '▶ Race them';
    } else {
      if (currentStep >= N_STEPS) reset();
      auto = true;
      lastStepAt = 0;
      playBtn.textContent = '⏸ Pause';
      loop.start();
    }
  });
  resetBtn.addEventListener('click', () => { reset(); render(); });

  render();
}

// ============================================================================
// SIM 3 · Intervention vs rule change
// ============================================================================

function initInterventionSim() {
  const canvas = document.getElementById('mkv-int');
  if (!canvas) return;
  const intBtn = document.getElementById('mkv-int-intervene');
  const changeBtn = document.getElementById('mkv-int-change');
  const resetBtn = document.getElementById('mkv-int-reset');

  const CANVAS_H = 440;
  const preset = PRESETS.drug;
  const originalP = preset.matrix.map(row => row.slice());
  // Rule-change: reduce Sober → Using by 8pp, add that mass to Sober self-loop.
  const alteredP = preset.matrix.map(row => row.slice());
  alteredP[0][1] -= 0.08;
  alteredP[0][0] += 0.08;

  const N_STEPS = 240;

  const piOriginal = stationary(originalP);
  const piAltered = stationary(alteredP);

  // Precompute the "baseline" (steady state under originalP, no intervention).
  function computeBaseline() {
    const arr = [piOriginal.slice()];
    for (let t = 1; t < N_STEPS; t++) arr.push(advanceDistribution(arr[t - 1], originalP));
    return arr;
  }

  let baseline = computeBaseline();
  let currentDist = piOriginal.slice();
  let history = [currentDist.slice()];
  let matInUse = originalP;
  let stepIdx = 0;
  let events = [];   // {step, kind:'intervene'|'change'}
  let auto = true;

  function reset() {
    matInUse = originalP;
    currentDist = piOriginal.slice();
    history = [currentDist.slice()];
    stepIdx = 0;
    events = [];
    auto = true;
    // Don't start the loop here — `loop` is declared after this function.
    // Callers (button handlers and the boot code at the bottom) start it.
  }
  reset();

  function step() {
    currentDist = advanceDistribution(currentDist, matInUse);
    history.push(currentDist.slice());
    stepIdx++;
  }

  function drawChart(ctx, x, y, w, h) {
    // Chart is a stacked-line: one line per state. Show all 4 states.
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // Grid lines + labels
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const py = y + h - v * h;
      ctx.strokeStyle = P.line;
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
      ctx.fillText(`${(100 * v).toFixed(0)}%`, x - 4, py);
    }

    // π reference lines
    for (let s = 0; s < preset.states.length; s++) {
      const colour = STATE_COLORS[s % STATE_COLORS.length];
      // Original π
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      const py = y + h - piOriginal[s] * h;
      ctx.moveTo(x, py); ctx.lineTo(x + w, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Trajectories
    const T = history.length;
    for (let s = 0; s < preset.states.length; s++) {
      const colour = STATE_COLORS[s % STATE_COLORS.length];
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let t = 0; t < T; t++) {
        const px = x + (t / (N_STEPS - 1)) * w;
        const py = y + h - history[t][s] * h;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // End dot with label
      const last = history[history.length - 1];
      const px = x + ((T - 1) / (N_STEPS - 1)) * w;
      const py = y + h - last[s] * h;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Event markers
    for (const ev of events) {
      const px = x + (ev.step / (N_STEPS - 1)) * w;
      ctx.strokeStyle = ev.kind === 'intervene' ? P.danger : P.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, y); ctx.lineTo(px, y + h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ev.kind === 'intervene' ? P.danger : P.accent;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(ev.kind === 'intervene' ? '🚨' : '🔧', px, y - 2);
    }

    // Legend
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let ly = y + 6;
    for (let s = 0; s < preset.states.length; s++) {
      const colour = STATE_COLORS[s % STATE_COLORS.length];
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x + w - 118, ly + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.font = 'bold 11px Inter, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.fillText(preset.states[s], x + w - 106, ly);
      ly += 16;
    }
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const pad = { l: 42, r: 12, t: 24, b: 40 };
    drawChart(ctx, pad.l, pad.t, W - pad.l - pad.r, H - pad.t - pad.b);
    // Axis labels
    ctx.fillStyle = P.muted;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`step   (of ${N_STEPS})`, W / 2, H - 8);
    ctx.save();
    ctx.translate(14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('fraction of population', 0, 0);
    ctx.restore();
    // Status
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = matInUse === originalP ? P.ink : P.accent;
    ctx.fillText(matInUse === originalP ? 'Rules: original' : 'Rules: changed', pad.l, 4);
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    if (auto && stepIdx < N_STEPS - 1) step();
    render();
    if (stepIdx >= N_STEPS - 1) auto = false;
    if (!auto) return false;
  });

  intBtn.addEventListener('click', () => {
    // Dump 100% into Sober (state 0).
    currentDist = [1, 0, 0, 0];
    history.push(currentDist.slice());
    stepIdx++;
    events.push({ step: stepIdx, kind: 'intervene' });
    auto = true;
    loop.start();
  });
  changeBtn.addEventListener('click', () => {
    matInUse = alteredP;
    events.push({ step: stepIdx, kind: 'change' });
    auto = true;
    loop.start();
  });
  resetBtn.addEventListener('click', () => { reset(); loop.start(); });

  // Boot: draw the initial frame and kick the loop off so the chart starts
  // playing immediately (baseline dynamics from t = 0 to t = N_STEPS).
  render();
  loop.start();
}

// ============================================================================

initStateGraph();
initConvergenceRace();
initInterventionSim();
