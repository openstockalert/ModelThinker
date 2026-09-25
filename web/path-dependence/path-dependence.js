// Path dependence story — three sims: interactive urn, three worlds race, fingerprint histograms.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { makeRng, setMetric } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', success: '#37B24D', warn: '#F59F00',
            red: '#E03131', blue: '#4C6EF5',
            ink: '#212529', line: '#E9ECEF', bgSoft: '#F5F7FC' };

const RULES = {
  bernoulli: {
    label: '🧊 Bernoulli',
    tag: 'No update',
    hint:
      '<strong>🧊 Bernoulli — the urn never changes.</strong> ' +
      'Draw a ball, look at it, put it back. The urn stays exactly (1 red, 1 blue) forever. ' +
      'Draws are independent coin flips. There\'s no way for early events to matter — this is what ' +
      '"no path dependence" looks like.',
  },
  polya: {
    label: '🌊 Pólya',
    tag: 'Positive feedback',
    hint:
      '<strong>🌊 Pólya — rich get richer.</strong> ' +
      'Draw a ball, put it back <em>plus one more of the same colour</em>. If you draw red, the urn ' +
      'now has more red — so next time you\'re more likely to draw red again. Small early events ' +
      'compound into massive long-run effects. This is the classic engine of path dependence.',
  },
  balancing: {
    label: '⚖ Balancing',
    tag: 'Negative feedback',
    hint:
      '<strong>⚖ Balancing — self-correcting.</strong> ' +
      'Draw a ball, put it back <em>plus one of the OPPOSITE colour</em>. Whichever colour is behind ' +
      'gets a boost. The urn is pulled back toward 50/50 no matter what happened earlier. History gets ' +
      'erased.',
  },
};

// ============================================================================
// SIM 1 · Interactive urn
// ============================================================================

function initUrnSim() {
  const canvas = document.getElementById('urn-canvas');
  if (!canvas) return;
  const drawBtn = document.getElementById('urn-draw');
  const autoBtn = document.getElementById('urn-auto');
  const resetBtn = document.getElementById('urn-reset');
  const mRed = document.getElementById('urn-red');
  const mBlue = document.getElementById('urn-blue');
  const mFrac = document.getElementById('urn-frac');
  const mDraws = document.getElementById('urn-draws');
  const tabsRoot = document.getElementById('urn-rule-tabs');
  const hintEl = document.getElementById('urn-rule-hint');

  const CANVAS_H = 400;
  // Animation timings (ms)
  const DRAW_UP_MS   = 420;
  const HOLD_MS      = 520;
  const RETURN_MS    = 380;
  const AUTO_INTERVAL_MS = 950;

  let rule = 'polya';
  let phase = 'idle';         // 'idle' | 'drawing' | 'showing' | 'applying'
  let phaseStart = 0;
  let drawnColor = null;      // color pulled this step
  let drawnFromXY = null;     // where in the urn it came from
  let newBallColor = null;    // color being added (Pólya/Balancing) or null (Bernoulli)
  let auto = 0;               // remaining auto-draws
  let lastAutoDrawnAt = 0;

  // Composition — as counts + a fixed array of ball objects with jittered positions
  // so redraws are visually stable
  let balls = [];   // { color, jx, jy }  jitter in [-0.5, 0.5]
  let draws = 0;
  let drawHistory = [];   // sequence of drawn colors — most-recent-first

  const rng = makeRng(Math.floor(Math.random() * 1e6));
  function jitter() { return (rng() - 0.5) * 0.4; }

  function reset() {
    balls = [
      { color: 'red',  jx: jitter(), jy: jitter() },
      { color: 'blue', jx: jitter(), jy: jitter() },
    ];
    draws = 0;
    drawHistory = [];
    phase = 'idle';
    drawnColor = drawnFromXY = newBallColor = null;
    auto = 0;
    updateMetrics();
    startLoop();
  }

  function startLoop() { if (!loop.running()) loop.start(); }

  function setRule(newRule) {
    if (!(newRule in RULES)) return;
    rule = newRule;
    // Update tab appearance
    for (const btn of tabsRoot.querySelectorAll('button')) {
      btn.classList.toggle('btn-primary', btn.dataset.rule === newRule);
    }
    hintEl.innerHTML = RULES[newRule].hint;
    reset();
  }

  function counts() {
    let r = 0, b = 0;
    for (const ball of balls) if (ball.color === 'red') r++; else b++;
    return { r, b };
  }
  function updateMetrics() {
    const { r, b } = counts();
    setMetric(mRed, String(r));
    setMetric(mBlue, String(b));
    const frac = r + b > 0 ? (100 * r / (r + b)).toFixed(1) : '—';
    setMetric(mFrac, `${frac}%`);
    setMetric(mDraws, String(draws));
    drawBtn.disabled = phase !== 'idle';
    autoBtn.disabled = phase !== 'idle' && auto === 0;
  }

  function drawOne() {
    if (phase !== 'idle') return;
    const total = balls.length;
    if (total === 0) return;
    const { r } = counts();
    const wantRed = rng() < r / total;
    const candidates = balls.map((_, i) => i).filter(i => balls[i].color === (wantRed ? 'red' : 'blue'));
    const pickedIdx = candidates[Math.floor(rng() * candidates.length)];
    const picked = balls[pickedIdx];
    // Compute pixel position of that ball (approximate — recomputed in render too)
    const { s, offX, offY, cols } = urnLayout(canvas.getBoundingClientRect().width, CANVAS_H, total);
    const row = Math.floor(pickedIdx / cols);
    const col = pickedIdx % cols;
    drawnFromXY = {
      x: offX + (col + 0.5 + picked.jx * 0.3) * s,
      y: offY + (row + 0.5 + picked.jy * 0.3) * s,
    };
    drawnColor = picked.color;
    balls.splice(pickedIdx, 1);
    draws++;
    drawHistory.unshift(picked.color);
    if (drawHistory.length > 40) drawHistory.length = 40;

    // Decide what to add
    if (rule === 'bernoulli') newBallColor = null;
    else if (rule === 'polya') newBallColor = picked.color;
    else newBallColor = picked.color === 'red' ? 'blue' : 'red';

    phase = 'drawing';
    phaseStart = performance.now();
    updateMetrics();
    startLoop();
  }

  function applyStep() {
    // Return the drawn ball to the urn
    balls.push({ color: drawnColor, jx: jitter(), jy: jitter() });
    // For Pólya & Balancing, add another ball
    if (newBallColor) {
      balls.push({ color: newBallColor, jx: jitter(), jy: jitter() });
    }
    drawnColor = drawnFromXY = newBallColor = null;
    phase = 'idle';
    phaseStart = performance.now();
    updateMetrics();
  }

  // Layout helper — returns cell size and grid geometry for `n` balls
  function urnLayout(canvasW, canvasH, n) {
    // Urn area: centered box occupying ~50% of width and ~55% of height
    const urnW = Math.min(canvasW * 0.5, canvasH * 1.3);
    const urnH = canvasH * 0.55;
    const urnX = canvasW / 2 - urnW / 2;
    const urnY = canvasH * 0.28;
    // Ball grid inside urn
    const target = Math.max(n, 4);
    const cols = Math.max(2, Math.ceil(Math.sqrt(target * urnW / urnH)));
    const rows = Math.max(2, Math.ceil(target / cols));
    const s = Math.min(urnW / cols, urnH / rows);
    const gridW = s * cols, gridH = s * rows;
    return {
      urnX, urnY, urnW, urnH,
      s, cols, rows,
      offX: urnX + (urnW - gridW) / 2,
      offY: urnY + (urnH - gridH),
    };
  }

  function drawUrnShape(ctx, x, y, w, h) {
    // A simple rounded-rectangle container with a slight opening at top.
    const r = 20;
    ctx.beginPath();
    // Neck opening — narrower at top
    const neck = 14;
    ctx.moveTo(x + r, y + neck);
    ctx.arcTo(x, y + neck, x, y + h - r, r);
    ctx.arcTo(x, y + h, x + r, y + h, r);
    ctx.lineTo(x + w - r, y + h);
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
    ctx.arcTo(x + w, y + neck, x + w - r, y + neck, r);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Fill with subtle background
    ctx.fillStyle = 'rgba(76,110,245,0.04)';
    ctx.fill();
    // Highlight — a curved line at the top-left
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r + 4, y + neck + 6);
    ctx.lineTo(x + r + 30, y + neck + 6);
    ctx.stroke();
    // Label above urn
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('The urn', x + w / 2, y - 4);
  }

  function drawBall(ctx, cx, cy, r, color, opts = {}) {
    // Circle with subtle gradient shading
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
    if (color === 'red') {
      grad.addColorStop(0, '#FFA5A5');
      grad.addColorStop(1, '#B02323');
    } else {
      grad.addColorStop(0, '#A5B8FF');
      grad.addColorStop(1, '#2942B8');
    }
    ctx.fillStyle = grad;
    if (opts.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (opts.shadow) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    // Small highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHistoryStrip(ctx, x, y, w, colors) {
    // Right-to-left oldest→newest strip of small circles showing recent draws
    ctx.fillStyle = P.muted;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Recent draws →', x, y);
    const r = 8;
    const gap = 4;
    const startX = x + 105;
    for (let i = 0; i < colors.length; i++) {
      const cx = startX + i * (r * 2 + gap);
      if (cx > x + w - 20) break;
      drawBall(ctx, cx, y, r, colors[i]);
    }
    if (colors.length === 0) {
      ctx.fillStyle = P.muted;
      ctx.font = 'italic 12px Inter, sans-serif';
      ctx.fillText('(none yet — click 🎯 Draw a ball)', startX, y);
    }
  }

  function drawStatusLine(ctx, W, H, phaseStr) {
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const y = 12;
    if (phaseStr === 'idle') {
      ctx.fillStyle = P.muted;
      ctx.fillText(`Rule: ${RULES[rule].label} · ${RULES[rule].tag}`, W / 2, y);
    } else if (phaseStr === 'drawing') {
      ctx.fillStyle = drawnColor === 'red' ? P.red : P.blue;
      ctx.fillText(`Drew a ${drawnColor} ball!`, W / 2, y);
    } else if (phaseStr === 'showing' || phaseStr === 'applying') {
      const c = drawnColor === 'red' ? P.red : P.blue;
      ctx.fillStyle = c;
      let msg = `Drew ${drawnColor}. `;
      if (rule === 'bernoulli') msg += 'Put it back. Urn unchanged.';
      else if (rule === 'polya') msg += `Rule adds another ${drawnColor}.`;
      else msg += `Rule adds a ${newBallColor}.`;
      ctx.fillText(msg, W / 2, y);
    }
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    drawStatusLine(ctx, W, H, phase);

    const totalNow = balls.length + (phase !== 'idle' ? 1 + (newBallColor ? 1 : 0) : 0);
    const layout = urnLayout(W, H, totalNow);
    drawUrnShape(ctx, layout.urnX, layout.urnY, layout.urnW, layout.urnH);

    // Draw balls currently in urn (grid layout)
    const rBall = layout.s * 0.42;
    for (let i = 0; i < balls.length; i++) {
      const row = Math.floor(i / layout.cols);
      const col = i % layout.cols;
      const cx = layout.offX + (col + 0.5 + balls[i].jx * 0.25) * layout.s;
      const cy = layout.offY + (row + 0.5 + balls[i].jy * 0.25) * layout.s;
      drawBall(ctx, cx, cy, rBall, balls[i].color);
    }

    // Animated drawn ball (leaving urn). Cache the colours up-front so a
    // mid-frame call to applyStep() (which nulls drawnColor / newBallColor)
    // doesn't wipe out the colours we're about to paint.
    if (phase === 'drawing' || phase === 'showing' || phase === 'applying') {
      const holdY = layout.urnY - 60;
      const drawnColorCached = drawnColor;
      const newBallColorCached = newBallColor;
      let x, y;
      if (phase === 'drawing') {
        const t = Math.min(1, (now - phaseStart) / DRAW_UP_MS);
        const eased = easeOut(t);
        x = drawnFromXY.x + (W / 2 - drawnFromXY.x) * eased;
        y = drawnFromXY.y + (holdY - drawnFromXY.y) * eased;
        if (t >= 1) { phase = 'showing'; phaseStart = now; }
      } else if (phase === 'showing') {
        x = W / 2; y = holdY;
        if (now - phaseStart >= HOLD_MS) { phase = 'applying'; phaseStart = now; }
      } else {
        // 'applying' — return the drawn ball to the urn
        const targetCol = balls.length % layout.cols;
        const targetRow = Math.floor(balls.length / layout.cols);
        const tx = layout.offX + (targetCol + 0.5) * layout.s;
        const ty = layout.offY + (targetRow + 0.5) * layout.s;
        const t = Math.min(1, (now - phaseStart) / RETURN_MS);
        const eased = easeOut(t);
        x = W / 2 + (tx - W / 2) * eased;
        y = holdY + (ty - holdY) * (eased * eased);
        // New ball drops in in parallel
        if (newBallColorCached) {
          const nCol = (balls.length + 1) % layout.cols;
          const nRow = Math.floor((balls.length + 1) / layout.cols);
          const nx = layout.offX + (nCol + 0.5) * layout.s;
          const ny = layout.offY + (nRow + 0.5) * layout.s;
          const nStartX = W / 2 + 44;
          const nStartY = layout.urnY - 40;
          const nx0 = nStartX + (nx - nStartX) * eased;
          const ny0 = nStartY + (ny - nStartY) * (eased * eased);
          drawBall(ctx, nx0, ny0, rBall, newBallColorCached, { shadow: true });
        }
        if (t >= 1) applyStep();
      }
      drawBall(ctx, x, y, rBall * 1.15, drawnColorCached, { shadow: true });
    }

    // Draw history strip at bottom
    drawHistoryStrip(ctx, 24, H - 22, W - 48, drawHistory.slice(0, 30));

    // Handle auto-draw scheduling
    if (auto > 0 && phase === 'idle' && now - lastAutoDrawnAt >= AUTO_INTERVAL_MS) {
      lastAutoDrawnAt = now;
      auto--;
      drawOne();
      updateMetrics();
    }
  }

  // Animation loop — kept running while there's animation or auto-draws.
  const loop = makeLoop(() => {
    render();
    if (phase === 'idle' && auto === 0) return false;
  });

  onResize(canvas, CANVAS_H, () => render());
  render();

  // Wire up controls
  drawBtn.addEventListener('click', () => { drawOne(); });
  autoBtn.addEventListener('click', () => {
    auto = 20;
    lastAutoDrawnAt = 0;
    if (phase === 'idle') drawOne();
    startLoop();
  });
  resetBtn.addEventListener('click', () => { reset(); render(); });
  for (const btn of tabsRoot.querySelectorAll('button')) {
    btn.addEventListener('click', () => setRule(btn.dataset.rule));
  }

  // Initial state
  setRule('polya');
}

// ============================================================================
// SIM 2 · Three worlds racing
// ============================================================================

function initThreeWorlds() {
  const canvas = document.getElementById('worlds-canvas');
  if (!canvas) return;
  const playBtn = document.getElementById('worlds-play');
  const resetBtn = document.getElementById('worlds-reset');

  const CANVAS_H = 460;
  const N_WALKS = 40;
  const N_STEPS = 800;
  const STEP_PER_FRAME = 4;   // walks advance this many steps per animation frame

  // State: three parallel simulations. Each keeps R, B counts per walk plus
  // history of fractions.
  const rules = ['bernoulli', 'polya', 'balancing'];
  let state = null;
  let auto = false;
  let stepIdx = 0;
  const seed = 42;

  function reset() {
    state = {};
    for (const r of rules) {
      state[r] = {
        R: new Int32Array(N_WALKS).fill(1),
        B: new Int32Array(N_WALKS).fill(1),
        history: [Array(N_WALKS).fill(0.5)],   // fractions at each step
      };
    }
    stepIdx = 0;
    auto = false;
    playBtn.textContent = '▶ Run all three';
  }
  reset();

  // Use a seeded RNG so the three worlds see the "same randomness".
  let rng = makeRng(seed);

  function advanceStep() {
    // For each of the N_WALKS, draw one random uniform, then apply to each rule.
    const uRand = new Float64Array(N_WALKS);
    for (let i = 0; i < N_WALKS; i++) uRand[i] = rng();

    for (const rule of rules) {
      const s = state[rule];
      const fracs = new Array(N_WALKS);
      for (let i = 0; i < N_WALKS; i++) {
        const p = s.R[i] / (s.R[i] + s.B[i]);
        const drewRed = uRand[i] < p;
        if (rule === 'polya') {
          if (drewRed) s.R[i]++; else s.B[i]++;
        } else if (rule === 'balancing') {
          if (drewRed) s.B[i]++; else s.R[i]++;
        }
        // bernoulli: no update
        fracs[i] = s.R[i] / (s.R[i] + s.B[i]);
      }
      s.history.push(fracs);
    }
    stepIdx++;
  }

  function drawPanel(ctx, x, y, w, h, rule, history) {
    // Panel background + title
    ctx.fillStyle = '#FBFCFF';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();

    // Title
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(RULES[rule].label + '  ·  ' + RULES[rule].tag, x + 12, y + 8);

    // Plot area
    const pad = { l: 44, r: 12, t: 30, b: 24 };
    const plotX = x + pad.l, plotY = y + pad.t;
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

    // Y-axis grid + labels
    ctx.strokeStyle = P.line;
    ctx.fillStyle = P.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const yy of [0, 0.25, 0.5, 0.75, 1]) {
      const py = plotY + plotH - yy * plotH;
      ctx.beginPath(); ctx.moveTo(plotX, py); ctx.lineTo(plotX + plotW, py); ctx.stroke();
      ctx.fillText(yy.toFixed(2), plotX - 4, py);
    }

    // Trajectories
    const T = history.length;
    ctx.strokeStyle = 'rgba(76,110,245,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < N_WALKS; i++) {
      ctx.beginPath();
      for (let t = 0; t < T; t++) {
        const px = plotX + (t / (N_STEPS - 1)) * plotW;
        const py = plotY + plotH - history[t][i] * plotH;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Baseline at 0.5
    ctx.strokeStyle = P.muted;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const halfY = plotY + plotH * 0.5;
    ctx.moveTo(plotX, halfY); ctx.lineTo(plotX + plotW, halfY);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis label
    ctx.fillStyle = P.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`step (0 → ${N_STEPS})`, plotX + plotW / 2, y + h - 4);

    // Y-axis label
    ctx.save();
    ctx.translate(x + 12, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('red share', 0, 0);
    ctx.restore();

    // Progress counter
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = P.muted;
    ctx.fillText(`t = ${stepIdx}`, x + w - 12, y + 10);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const gap = 10;
    const panelH = (H - 2 * gap) / 3;
    const panelW = W - 24;
    for (let i = 0; i < rules.length; i++) {
      const py = i * (panelH + gap);
      drawPanel(ctx, 12, py, panelW, panelH, rules[i], state[rules[i]].history);
    }
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    if (auto && stepIdx < N_STEPS) {
      for (let s = 0; s < STEP_PER_FRAME && stepIdx < N_STEPS; s++) advanceStep();
    }
    render();
    if (stepIdx >= N_STEPS) {
      auto = false;
      playBtn.textContent = '▶ Run all three';
      return false;
    }
    if (!auto) return false;
  });

  playBtn.addEventListener('click', () => {
    if (auto) {
      auto = false;
      playBtn.textContent = '▶ Run all three';
    } else {
      auto = true;
      playBtn.textContent = '⏸ Pause';
      loop.start();
    }
  });
  resetBtn.addEventListener('click', () => {
    rng = makeRng(seed + Math.floor(Math.random() * 1e4));
    reset();
    render();
  });
  render();
}

// ============================================================================
// SIM 3 · Final-share fingerprint (three histograms)
// ============================================================================

function initFingerprint() {
  const canvas = document.getElementById('fp-canvas');
  if (!canvas) return;
  const runBtn = document.getElementById('fp-run');
  const resetBtn = document.getElementById('fp-reset');

  const CANVAS_H = 420;
  const N_WALKS = 1500;
  const N_STEPS = 800;
  const N_BINS = 25;

  let data = null;   // { bernoulli: [], polya: [], balancing: [] } — final shares per rule

  function entropy(finals) {
    const counts = new Array(N_BINS).fill(0);
    for (const f of finals) {
      const bin = Math.max(0, Math.min(N_BINS - 1, Math.floor(f * N_BINS)));
      counts[bin]++;
    }
    let H = 0;
    const total = finals.length;
    for (const c of counts) if (c > 0) {
      const p = c / total;
      H -= p * Math.log2(p);
    }
    return H;
  }

  function runOne(rule) {
    const rng = makeRng(Math.floor(Math.random() * 1e6));
    const finals = new Float64Array(N_WALKS);
    for (let w = 0; w < N_WALKS; w++) {
      let R = 1, B = 1;
      for (let t = 0; t < N_STEPS; t++) {
        const p = R / (R + B);
        const drewRed = rng() < p;
        if (rule === 'polya') { if (drewRed) R++; else B++; }
        else if (rule === 'balancing') { if (drewRed) B++; else R++; }
      }
      // For Bernoulli, the "final share" of the URN is always 0.5. Instead
      // report the running empirical fraction of draws — that's the interesting
      // quantity showing the LLN-convergence spike.
      if (rule === 'bernoulli') {
        // Re-simulate to record the empirical draw fraction
        let rDraws = 0;
        for (let t = 0; t < N_STEPS; t++) if (rng() < 0.5) rDraws++;
        finals[w] = rDraws / N_STEPS;
      } else {
        finals[w] = R / (R + B);
      }
    }
    return finals;
  }

  function run() {
    data = {};
    for (const rule of ['bernoulli', 'polya', 'balancing']) {
      data[rule] = runOne(rule);
    }
    render();
  }

  function drawHist(ctx, x, y, w, h, rule, finals) {
    // Panel + title
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(RULES[rule].label + '  ·  ' + RULES[rule].tag, x + 12, y + 8);

    const pad = { l: 44, r: 12, t: 30, b: 26 };
    const plotX = x + pad.l, plotY = y + pad.t;
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

    if (!finals) {
      ctx.fillStyle = P.muted;
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Click "🎲 Simulate all three" to fill.', x + w / 2, y + h / 2);
      return;
    }

    // Bin counts
    const counts = new Array(N_BINS).fill(0);
    for (const f of finals) {
      const bin = Math.max(0, Math.min(N_BINS - 1, Math.floor(f * N_BINS)));
      counts[bin]++;
    }
    const maxCount = Math.max(...counts, 1);

    // Y-axis label
    ctx.save();
    ctx.translate(x + 12, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillStyle = P.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('density', 0, 0);
    ctx.restore();

    // Baseline
    ctx.strokeStyle = P.line;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Bars
    const barW = plotW / N_BINS;
    // Color per rule for visual distinction
    const colour = { bernoulli: P.muted, polya: P.primary, balancing: P.success }[rule];
    ctx.fillStyle = colour;
    for (let i = 0; i < N_BINS; i++) {
      const bh = (counts[i] / maxCount) * plotH;
      ctx.fillRect(plotX + i * barW + 1, plotY + plotH - bh, barW - 2, bh);
    }

    // x-axis ticks
    ctx.fillStyle = P.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of [0, 0.25, 0.5, 0.75, 1.0]) {
      const px = plotX + v * plotW;
      ctx.fillText(v.toFixed(2), px, plotY + plotH + 4);
    }
    ctx.fillText('final red share', plotX + plotW / 2, y + h - 12);

    // Entropy readout
    const H_ent = entropy(finals);
    const maxH = Math.log2(N_BINS);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = P.warn;
    ctx.fillText(`Entropy: ${H_ent.toFixed(2)} / ${maxH.toFixed(2)} bits`, x + w - 12, y + 10);
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const gap = 10;
    const panelH = (H - 2 * gap) / 3;
    const panelW = W - 24;
    const rules = ['bernoulli', 'polya', 'balancing'];
    for (let i = 0; i < rules.length; i++) {
      const py = i * (panelH + gap);
      drawHist(ctx, 12, py, panelW, panelH, rules[i], data ? data[rules[i]] : null);
    }
  }
  onResize(canvas, CANVAS_H, render);

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Simulating…';
    // Give the UI a beat to update the button state before the blocking sim.
    setTimeout(() => {
      run();
      runBtn.disabled = false;
      runBtn.textContent = '🎲 Simulate all three';
    }, 30);
  });
  resetBtn.addEventListener('click', () => { data = null; render(); });
  render();
}

// ============================================================================

initUrnSim();
initThreeWorlds();
initFingerprint();
