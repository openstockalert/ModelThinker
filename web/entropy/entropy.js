// Entropy story · three sims:
//   1. Surprise Machine  — draggable bars + live sample stream (Shannon entropy)
//   2. Four Fates        — auto-playing zoo, one rule per class
//   3. Rule Builder      — click the 8 outputs to design your own rule + gallery
// Plus one small animated diagram explaining how a 3-cell rule works.

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

function shannonEntropy(p) {
  let h = 0;
  for (const pi of p) if (pi > 0) h -= pi * Math.log2(pi);
  return h;
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

function drawSample(p, rng) {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < p.length; i++) {
    acc += p[i];
    if (r < acc) return i;
  }
  return p.length - 1;
}

// ---- CA primitives ---------------------------------------------------------

function ruleTable(rule) {
  const t = new Uint8Array(8);
  for (let i = 0; i < 8; i++) t[i] = (rule >> i) & 1;
  return t;
}

function tableToRule(table) {
  let rule = 0;
  for (let i = 0; i < 8; i++) rule |= (table[i] & 1) << i;
  return rule;
}

function caStep(row, table) {
  const w = row.length;
  const out = new Uint8Array(w);
  for (let i = 0; i < w; i++) {
    const l = row[(i - 1 + w) % w];
    const c = row[i];
    const r = row[(i + 1) % w];
    out[i] = table[(l << 2) | (c << 1) | r];
  }
  return out;
}

function singleSeed(width) {
  const r = new Uint8Array(width);
  r[width >> 1] = 1;
  return r;
}

function randomSeed(width, density, rng) {
  const r = new Uint8Array(width);
  for (let i = 0; i < width; i++) r[i] = rng() < density ? 1 : 0;
  return r;
}

function rowEntropy(row) {
  let ones = 0;
  for (let i = 0; i < row.length; i++) ones += row[i];
  const p1 = ones / row.length;
  const p0 = 1 - p1;
  let h = 0;
  if (p0 > 0) h -= p0 * Math.log2(p0);
  if (p1 > 0) h -= p1 * Math.log2(p1);
  return h;
}

function blockEntropy(rows, k = 4) {
  if (rows.length === 0) return 0;
  const w = rows[0].length;
  if (w < k) return 0;
  const counts = new Uint32Array(1 << k);
  for (const row of rows) {
    for (let i = 0; i <= w - k; i++) {
      let key = 0;
      for (let j = 0; j < k; j++) key = (key << 1) | row[i + j];
      counts[key]++;
    }
  }
  const total = rows.length * (w - k + 1);
  let h = 0;
  for (let i = 0; i < counts.length; i++) {
    const p = counts[i] / total;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

function classifyCA(rows) {
  if (rows.length < 4) return 4;
  const cols = rows[0].length;
  const tailStart = Math.floor(rows.length / 2);
  const tail = rows.slice(tailStart);
  let sum = 0;
  for (const row of tail) for (const c of row) sum += c;
  if (sum === 0 || sum === tail.length * cols) return 1;
  const maxPeriod = Math.min(32, Math.floor(tail.length / 2) - 1);
  outer:
  for (let period = 1; period <= maxPeriod; period++) {
    const cmp1 = tail[tail.length - 1 - period];
    const cmp2 = tail[tail.length - 2 - period];
    const l1  = tail[tail.length - 1];
    const l2  = tail[tail.length - 2];
    for (let i = 0; i < cols; i++) {
      if (l1[i] !== cmp1[i] || l2[i] !== cmp2[i]) continue outer;
    }
    return 2;
  }
  const bh = blockEntropy(tail, 4);
  return bh / 4 > 0.85 ? 3 : 4;
}

const WOLFRAM_CLASSES = {
  0: 1,   8: 1,  32: 1,  40: 1, 128: 1, 136: 1, 160: 1, 168: 1,
  1: 2,   2: 2,   4: 2,   5: 2,  10: 2,  12: 2,  15: 2,  24: 2,
  36: 2,  50: 2,  51: 2, 108: 2, 132: 2, 156: 2, 184: 2, 232: 2,
  250: 2,
  18: 3,  22: 3,  30: 3,  45: 3,  60: 3,  75: 3,  90: 3, 105: 3,
  122: 3, 126: 3, 129: 3, 137: 3, 146: 3, 150: 3, 165: 3,
  54: 4, 110: 4,
};

const CLASS_META = {
  1: { name: 'silent',   fullName: 'equilibrium', color: '#868E96', emoji: '🏁' },
  2: { name: 'ticking',  fullName: 'periodic',    color: '#37B24D', emoji: '🔁' },
  3: { name: 'wild',     fullName: 'random',      color: '#F76707', emoji: '🎲' },
  4: { name: 'weird',    fullName: 'complex',     color: '#7048E8', emoji: '🧠' },
};

// ============================================================================
// Concept diagram · what does a 3-cell rule even do?
// ============================================================================

function initConceptDiagram() {
  const canvas = document.getElementById('concept-diagram');
  if (!canvas) return;

  // Use rule 90 for the diagram — its output is symmetric and visually pleasing.
  const DEMO_RULE = 90;
  const table = ruleTable(DEMO_RULE);
  const N = 21;
  // A hand-picked initial row so the demo isn't monochrome
  const initial = new Uint8Array(N);
  initial[Math.floor(N * 0.2)] = 1;
  initial[Math.floor(N * 0.5)] = 1;
  initial[Math.floor(N * 0.75)] = 1;
  const nextRow = caStep(initial, table);
  const CANVAS_H = 170;

  const STEP_MS = 700;
  let phase = 0; // Which position the "spotlight" is on (0 .. N-1)
  let lastAdvance = 0;

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = '#060811';
    ctx.fillRect(0, 0, W, H);
    const now = performance.now();
    if (now - lastAdvance >= STEP_MS) {
      phase = (phase + 1) % N;
      lastAdvance = now;
    }

    // Layout
    const margin = 12;
    const usableW = W - 2 * margin;
    const cellW = usableW / N;
    const cellH = 24;
    const rowY1 = 22;
    const rowY2 = 130;

    // Draw row t (top)
    for (let i = 0; i < N; i++) {
      const cx = margin + i * cellW;
      ctx.fillStyle = initial[i] ? '#F1F3F5' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(cx + 1, rowY1, cellW - 2, cellH);
    }

    // Draw row t+1 (bottom) — only cells up to and including phase are revealed
    for (let i = 0; i < N; i++) {
      const cx = margin + i * cellW;
      if (i <= phase) {
        ctx.fillStyle = nextRow[i] ? '#F1F3F5' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(cx + 1, rowY2, cellW - 2, cellH);
      } else {
        // Not-yet-computed placeholder
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 1.5, rowY2 + 0.5, cellW - 3, cellH - 1);
      }
    }

    // Spotlight rectangle around 3 input cells for the current phase
    const center = phase;
    const l = (center - 1 + N) % N;
    const r = (center + 1) % N;
    const idx = ((initial[l] << 2) | (initial[center] << 1) | initial[r]);
    const outBit = table[idx];

    // Draw the 3-cell spotlight bracket (only if all 3 cells are contiguous — skip wrap edges)
    if (center >= 1 && center <= N - 2) {
      const boxX = margin + (center - 1) * cellW - 3;
      const boxY = rowY1 - 3;
      const boxW = cellW * 3 + 6;
      const boxH = cellH + 6;
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, boxX, boxY, boxW, boxH, 6);
      ctx.stroke();

      // Arrow down to the output cell
      const arrowX = margin + center * cellW + cellW / 2;
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(arrowX, boxY + boxH + 3);
      ctx.lineTo(arrowX, rowY2 - 8);
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(arrowX - 5, rowY2 - 12);
      ctx.lineTo(arrowX, rowY2 - 5);
      ctx.lineTo(arrowX + 5, rowY2 - 12);
      ctx.stroke();

      // Output cell highlight
      const outX = margin + center * cellW;
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, outX - 2, rowY2 - 2, cellW + 4, cellH + 4, 4);
      ctx.stroke();

      // Rule reading — small chip showing "pattern → output"
      const chipY = 82;
      const CELL = 12;
      const cw = 3 * CELL + 20 + CELL;   // 3 cells + arrow + 1 cell
      const cx0 = W / 2 - cw / 2;
      // Input pattern
      for (let b = 0; b < 3; b++) {
        const bit = (idx >> (2 - b)) & 1;
        ctx.fillStyle = bit ? '#F1F3F5' : 'rgba(255,255,255,0.15)';
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.fillRect(cx0 + b * CELL, chipY, CELL - 1, CELL - 1);
        if (!bit) ctx.strokeRect(cx0 + b * CELL + 0.5, chipY + 0.5, CELL - 2, CELL - 2);
      }
      // Arrow
      ctx.fillStyle = P.accent;
      ctx.font = 'bold 14px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('→', cx0 + 3 * CELL + 10, chipY + CELL / 2);
      // Output
      const outCX = cx0 + 3 * CELL + 20;
      ctx.fillStyle = outBit ? '#F1F3F5' : 'rgba(255,255,255,0.15)';
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 1.5;
      ctx.fillRect(outCX, chipY, CELL - 1, CELL - 1);
      ctx.strokeRect(outCX + 0.5, chipY + 0.5, CELL - 2, CELL - 2);
    }

    // Labels on the far left
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = 'rgba(241,243,245,0.6)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('row t', 4, rowY1 + cellH / 2);
    ctx.fillText('row t+1', 4, rowY2 + cellH / 2);
  }
  onResize(canvas, CANVAS_H, render);
  const loop = makeLoop(() => { render(); return true; });
  loop.start();
}

// ============================================================================
// Sim 1 · The Surprise Machine
// ============================================================================

function initSurpriseMachine() {
  const canvas = document.getElementById('sim-machine');
  if (!canvas) return;

  const K = 4;
  const COLORS = [P.primary, P.accent, P.success, P.purple];
  const LABELS = ['A', 'B', 'C', 'D'];
  const CANVAS_H = 520;

  const weights = [1, 1, 1, 1];
  let dragging = -1;
  let paused = false;

  const rng = makeRng(Math.floor(Math.random() * 1e6));
  const samples = [];
  const MAX_SAMPLES = 30;
  const SAMPLE_INTERVAL = 380;
  const STREAM_SPAN_MS = MAX_SAMPLES * SAMPLE_INTERVAL;
  let lastSpawn = 0;
  let cumSurprise = 0;
  let cumCount = 0;
  const pulseTimes = new Array(K).fill(0);

  const barBounds = new Array(K);

  const mH   = document.getElementById('mach-h');
  const mMax = document.getElementById('mach-hmax');
  const mEmp = document.getElementById('mach-empirical');

  function resetRunning() { cumSurprise = 0; cumCount = 0; }

  function pointerCanvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (e.clientX - rect.left) * canvas.width / rect.width / dpr;
    const py = (e.clientY - rect.top)  * canvas.height / rect.height / dpr;
    return { px, py };
  }

  function updateWeightFromDrag(i, py) {
    const b = barBounds[i];
    if (!b) return;
    const clampedY = Math.max(b.y, Math.min(b.y + b.h, py));
    weights[i] = 1 - (clampedY - b.y) / b.h;
    resetRunning();
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { px, py } = pointerCanvasXY(e);
    for (let i = 0; i < K; i++) {
      const b = barBounds[i];
      if (b && px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 8 && py <= b.y + b.h + 14) {
        dragging = i;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        updateWeightFromDrag(i, py);
        e.preventDefault();
        return;
      }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging < 0) return;
    const { py } = pointerCanvasXY(e);
    updateWeightFromDrag(dragging, py);
  });
  const endDrag = () => { dragging = -1; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  function setPreset(ws) {
    const m = Math.max(...ws, 1e-9);
    for (let i = 0; i < K; i++) weights[i] = ws[i] / m;
    resetRunning();
  }
  document.getElementById('mach-fair'   ).onclick = () => setPreset([1, 1, 1, 1]);
  document.getElementById('mach-certain').onclick = () => setPreset([1, 0.02, 0.02, 0.02]);
  document.getElementById('mach-skew'   ).onclick = () => setPreset([8, 4, 2, 1]);
  document.getElementById('mach-bimodal').onclick = () => setPreset([1, 0.05, 0.05, 1]);

  const pauseBtn = document.getElementById('mach-pause');
  pauseBtn.onclick = () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ Resume stream' : '⏸ Pause stream';
  };

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    const total = weights.reduce((a, b) => a + b, 0);
    const p = total > 0 ? weights.map(w => w / total) : new Array(K).fill(1 / K);
    const h = shannonEntropy(p);
    const hMax = Math.log2(K);

    // Instruction line
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = dragging >= 0 ? COLORS[dragging] : P.muted;
    ctx.fillText(
      dragging >= 0 ? `⇅ dragging ${LABELS[dragging]} — release to drop`
                    : '⇅ grab any bar to change the odds',
      W / 2, 12,
    );

    // Bars
    const barsY = 40;
    const barsH = 190;
    const barGap = 20;
    const barW = Math.min(96, (W - 40 - (K - 1) * barGap) / K);
    const totalBarW = K * barW + (K - 1) * barGap;
    const barsX0 = (W - totalBarW) / 2;

    for (let i = 0; i < K; i++) {
      const bx = barsX0 + i * (barW + barGap);
      barBounds[i] = { x: bx, y: barsY, w: barW, h: barsH };

      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      roundRectPath(ctx, bx, barsY, barW, barsH, 12);
      ctx.fill();

      const wFrac = Math.max(0, Math.min(1, weights[i]));
      const fillH = Math.max(3, wFrac * barsH);
      const fillY = barsY + barsH - fillH;
      const grad = ctx.createLinearGradient(0, fillY, 0, barsY + barsH);
      grad.addColorStop(0, COLORS[i]);
      grad.addColorStop(1, COLORS[i] + 'CC');
      ctx.fillStyle = grad;
      roundRectPath(ctx, bx, fillY, barW, fillH, 12);
      ctx.fill();

      // Pulse ring
      const age = now - pulseTimes[i];
      if (age < 380) {
        const t = age / 380;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = COLORS[i];
        ctx.lineWidth = 3;
        const grow = 1 + easeOut(t) * 0.35;
        const rw = barW * grow;
        const rh = fillH * grow;
        const rx = bx + (barW - rw) / 2;
        const ry = fillY + (fillH - rh) / 2;
        roundRectPath(ctx, rx, ry, rw, rh, 14);
        ctx.stroke();
        ctx.restore();
      }

      // Handle line
      ctx.fillStyle = 'white';
      roundRectPath(ctx, bx + 6, fillY - 2, barW - 12, 4, 2);
      ctx.fill();

      // Probability label
      const pctText = `${(p[i] * 100).toFixed(0)}%`;
      ctx.font = 'bold 15px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center';
      if (fillY - barsY > 22) {
        ctx.fillStyle = P.ink;
        ctx.textBaseline = 'bottom';
        ctx.fillText(pctText, bx + barW / 2, fillY - 6);
      } else {
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top';
        ctx.fillText(pctText, bx + barW / 2, fillY + 6);
      }

      // Letter label
      ctx.font = 'bold 20px Inter,system-ui,sans-serif';
      ctx.fillStyle = COLORS[i];
      ctx.textBaseline = 'top';
      ctx.fillText(LABELS[i], bx + barW / 2, barsY + barsH + 8);
    }

    // Entropy gauge
    const gaugeY = barsY + barsH + 58;
    const gaugeH = 34;
    const gaugeX = 20;
    const gaugeW = W - 40;
    ctx.fillStyle = P.line;
    roundRectPath(ctx, gaugeX, gaugeY, gaugeW, gaugeH, gaugeH / 2);
    ctx.fill();
    const fw = Math.max(gaugeH, (h / hMax) * gaugeW);
    const gg = ctx.createLinearGradient(gaugeX, 0, gaugeX + fw, 0);
    gg.addColorStop(0, P.primary);
    gg.addColorStop(1, P.accent);
    ctx.fillStyle = gg;
    roundRectPath(ctx, gaugeX, gaugeY, fw, gaugeH, gaugeH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    for (let t = 0.5; t < hMax; t += 0.5) {
      const tx = gaugeX + (t / hMax) * gaugeW;
      ctx.beginPath();
      ctx.moveTo(tx, gaugeY + 6); ctx.lineTo(tx, gaugeY + gaugeH - 6);
      ctx.stroke();
    }
    ctx.font = 'bold 16px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(`H = ${h.toFixed(3)} bits`, gaugeX + 14, gaugeY + gaugeH / 2 + 1);
    ctx.textAlign = 'right'; ctx.fillStyle = P.ink;
    ctx.fillText(`ceiling ${hMax.toFixed(2)}`, gaugeX + gaugeW - 12, gaugeY + gaugeH / 2 + 1);

    // Sample stream
    const streamY = gaugeY + gaugeH + 36;
    const streamH = H - streamY - 22;
    const streamL = 30;
    const streamR = W - 30;
    const streamMid = streamY + streamH / 2 + 6;

    if (!paused && now - lastSpawn >= SAMPLE_INTERVAL) {
      const kind = drawSample(p, rng);
      const surprise = -Math.log2(Math.max(1e-12, p[kind]));
      samples.push({ kind, spawnTime: now, surprise });
      cumSurprise += surprise;
      cumCount++;
      pulseTimes[kind] = now;
      if (samples.length > MAX_SAMPLES + 4) samples.shift();
      lastSpawn = now;
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    ctx.moveTo(streamL, streamMid); ctx.lineTo(streamR, streamMid);
    ctx.stroke();

    for (const s of samples) {
      const age = now - s.spawnTime;
      const t = Math.min(1, age / STREAM_SPAN_MS);
      const x = streamR - t * (streamR - streamL);
      if (x < streamL - 20) continue;
      const alpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
      const growIn = age < 220 ? easeOut(age / 220) : 1;
      const radius = 13 * growIn;

      if (age < 900) {
        const chipAlpha = age < 100 ? age / 100 : Math.max(0, 1 - (age - 500) / 400);
        ctx.save();
        ctx.globalAlpha = chipAlpha;
        ctx.font = 'bold 12px Inter,system-ui,sans-serif';
        const chip = `+${s.surprise.toFixed(2)} bits`;
        const cw = ctx.measureText(chip).width + 14;
        const chH = 22;
        const chX = x - cw / 2;
        const chY = streamMid - radius - 10 - chH;
        ctx.fillStyle = COLORS[s.kind];
        roundRectPath(ctx, chX, chY, cw, chH, chH / 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(chip, x, chY + chH / 2 + 1);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[s.kind];
      ctx.shadowColor = COLORS[s.kind];
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, streamMid, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.font = 'bold 12px Inter,system-ui,sans-serif';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(LABELS[s.kind], x, streamMid + 1);
      ctx.restore();
    }

    const avg = cumCount > 0 ? cumSurprise / cumCount : 0;
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(
      cumCount === 0
        ? 'firing samples…'
        : `${cumCount} samples · running mean ${avg.toFixed(3)} bits ${cumCount >= 30 ? '  ≈  H' : '(keep sampling…)'}`,
      W / 2, streamY + streamH - 10,
    );

    setMetric(mH,   h.toFixed(3), `${(100 * h / hMax).toFixed(0)}% of ceiling`);
    setMetric(mMax, hMax.toFixed(2), '= log₂ K');
    setMetric(mEmp, avg.toFixed(3),
              cumCount < 30 ? `sampling (n=${cumCount})` : 'converges to H');
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => { render(); return true; });
  loop.start();
}

// ============================================================================
// Sim 2 · Meet the Four Fates (auto-playing zoo, personality first)
// ============================================================================

const FATES = [
  { rule: 0,   cls: 1, personality: 'The Silent One',
    caption: 'Whatever starts here fades to nothing. Predictable, low-entropy, boring.' },
  { rule: 184, cls: 2, personality: 'The Ticker',
    caption: 'Locks into a repeating rhythm you could set your clock to. (This is the classic "traffic" rule.)' },
  { rule: 30,  cls: 3, personality: 'The Wild One',
    caption: 'Never repeats, never settles. So random-looking that Mathematica used this as its default PRNG for years.' },
  { rule: 110, cls: 4, personality: 'The Weird One',
    caption: 'Structured particles glide across a fixed background — never twice the same. Provably powerful enough to run any computer program.' },
];

function initFourFates() {
  const gridEl = document.getElementById('fates-grid');
  if (!gridEl) return;
  const toggleBtn = document.getElementById('fates-toggle');
  const randBtn   = document.getElementById('fates-random');
  const resetBtn  = document.getElementById('fates-reset');

  const WIDTH = 141;
  const MAX_ROWS = 130;
  const STEP_MS = 100;
  const CANVAS_H = 220;
  const WARMUP = 40;

  let playing = true;
  let useRandom = false;
  let seed = Math.floor(Math.random() * 1e6);

  const panels = FATES.map(fate => {
    const meta = CLASS_META[fate.cls];
    const wrap = document.createElement('div');
    wrap.className = 'fate-card';
    wrap.innerHTML = `
      <p class="fate-title">
        <span style="color:${meta.color};">${meta.emoji}&nbsp; ${fate.personality}</span>
        <span class="fate-title-sub">rule ${fate.rule} · ${meta.fullName}</span>
      </p>
      <canvas></canvas>
      <div class="fate-meter"><div class="fate-meter-fill" style="width:0%;"></div></div>
      <p class="fate-caption">${fate.caption}</p>
    `;
    gridEl.appendChild(wrap);
    return {
      spec: fate,
      color: meta.color,
      canvas: wrap.querySelector('canvas'),
      meter: wrap.querySelector('.fate-meter-fill'),
      rows: [],
    };
  });

  function reset() {
    for (const p of panels) {
      const table = ruleTable(p.spec.rule);
      const localRng = makeRng(seed + p.spec.rule);
      let row = useRandom ? randomSeed(WIDTH, 0.5, localRng) : singleSeed(WIDTH);
      p.rows = [row];
      for (let t = 0; t < WARMUP; t++) {
        row = caStep(row, table);
        p.rows.push(row);
      }
      p.meter.style.width = '0%';
    }
    renderAll();
  }

  function stepAll() {
    for (const p of panels) {
      const table = ruleTable(p.spec.rule);
      p.rows.push(caStep(p.rows[p.rows.length - 1], table));
      if (p.rows.length > MAX_ROWS + 20) {
        p.rows.splice(0, p.rows.length - MAX_ROWS - 5);
      }
    }
    renderAll();
  }

  function renderPanel(panel) {
    const { ctx, width: W, height: H } = fitCanvas(panel.canvas, CANVAS_H);
    ctx.fillStyle = '#060811';
    ctx.fillRect(0, 0, W, H);
    const rows = panel.rows;
    if (rows.length === 0) return;
    const cellW = W / WIDTH;
    const cellH = H / MAX_ROWS;
    const shown = Math.min(rows.length, MAX_ROWS);
    const start = Math.max(0, rows.length - MAX_ROWS);
    ctx.fillStyle = panel.color;
    for (let r = 0; r < shown; r++) {
      const row = rows[start + r];
      const y = r * cellH;
      for (let c = 0; c < WIDTH; c++) {
        if (row[c]) ctx.fillRect(c * cellW, y, cellW + 0.5, cellH + 0.5);
      }
    }
    const h = rowEntropy(rows[rows.length - 1]);
    panel.meter.style.width = (100 * h).toFixed(1) + '%';
  }
  function renderAll() { for (const p of panels) renderPanel(p); }

  let lastStep = 0;
  const loop = makeLoop(() => {
    if (!playing) return false;
    const now = performance.now();
    if (now - lastStep >= STEP_MS) {
      stepAll();
      lastStep = now;
    }
    return true;
  });

  toggleBtn.onclick = () => {
    playing = !playing;
    toggleBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
    if (playing) { lastStep = 0; loop.start(); }
  };
  randBtn.onclick = () => {
    useRandom = !useRandom;
    randBtn.classList.toggle('btn-primary', useRandom);
    seed = Math.floor(Math.random() * 1e6);
    reset();
    if (playing) { lastStep = 0; loop.start(); }
  };
  resetBtn.onclick = () => {
    seed = Math.floor(Math.random() * 1e6);
    reset();
    if (playing) { lastStep = 0; loop.start(); }
  };

  for (const p of panels) onResize(p.canvas, CANVAS_H, () => renderPanel(p));

  reset();
  loop.start();
}

// ============================================================================
// Sim 3 · The Rule Builder — click the 8 outputs to design your own rule
// ============================================================================

const GALLERY_RULES = [
  0, 184, 250, 232,
  30, 90, 60, 45,
  126, 150, 105, 165,
  54, 110, 22, 137,
];

function initRuleBuilder() {
  const canvas = document.getElementById('sim-builder');
  if (!canvas) return;
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  const randomToggle = document.getElementById('rule-random');
  const diceBtn = document.getElementById('rule-dice');
  const galleryEl = document.getElementById('rule-gallery');
  const mDetected = document.getElementById('rule-detected');
  const mKnown    = document.getElementById('rule-known');
  const mH        = document.getElementById('rule-h');

  const WIDTH = 201;
  const STEPS = 220;
  const CANVAS_H = 640;

  let rule = 30;
  let table = ruleTable(rule);
  let useRandom = false;
  let seed = Math.floor(Math.random() * 1e6);
  let grid = [];
  const chipBounds = new Array(8);          // for hit-testing
  const flipTimes = new Array(8).fill(0);   // for flip animation

  // ---- Build gallery ---------------------------------------------
  for (const r of GALLERY_RULES) {
    const btn = document.createElement('button');
    btn.className = 'rule-thumb';
    btn.setAttribute('data-rule', r);
    const cls = WOLFRAM_CLASSES[r];
    const meta = cls ? CLASS_META[cls] : null;
    btn.innerHTML = `
      <canvas></canvas>
      <div class="rule-thumb-label">
        <span>rule ${r}</span>
        ${meta ? `<span class="rule-thumb-class" style="background:${meta.color};">${cls}</span>` : ''}
      </div>
    `;
    btn.onclick = () => loadRule(r);
    galleryEl.appendChild(btn);
    renderThumbnail(btn.querySelector('canvas'), r);
  }

  function renderThumbnail(cvs, ruleNum) {
    const T_ROWS = 50, T_COLS = 60;
    const cssW = cvs.getBoundingClientRect().width || 84;
    const { ctx } = fitCanvas(cvs, T_ROWS);
    ctx.fillStyle = '#060811';
    ctx.fillRect(0, 0, cssW, T_ROWS);
    const t = ruleTable(ruleNum);
    let row = singleSeed(T_COLS);
    const cellW = cssW / T_COLS;
    const cls = WOLFRAM_CLASSES[ruleNum];
    const color = cls ? CLASS_META[cls].color : '#F9FBFF';
    ctx.fillStyle = color;
    for (let step = 0; step < T_ROWS; step++) {
      for (let c = 0; c < T_COLS; c++) {
        if (row[c]) ctx.fillRect(c * cellW, step, cellW + 0.5, 1.6);
      }
      row = caStep(row, t);
    }
  }

  function loadRule(newRule) {
    rule = newRule;
    table = ruleTable(rule);
    const inp = sliderRoot.querySelector('input[type="range"]');
    inp.value = rule;
    sliderRoot.querySelector('.value').textContent = rule;
    galleryEl.querySelectorAll('.rule-thumb').forEach(el => {
      el.classList.toggle('active', Number(el.getAttribute('data-rule')) === rule);
    });
    build();
    render();
  }

  function build() {
    const rng = makeRng(seed);
    grid = new Array(STEPS + 1);
    grid[0] = useRandom ? randomSeed(WIDTH, 0.5, rng) : singleSeed(WIDTH);
    for (let t = 1; t <= STEPS; t++) grid[t] = caStep(grid[t - 1], table);
  }

  // ---- Chip hit-testing -----------------------------------------
  function pointerCanvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (e.clientX - rect.left) * canvas.width / rect.width / dpr;
    const py = (e.clientY - rect.top)  * canvas.height / rect.height / dpr;
    return { px, py };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { px, py } = pointerCanvasXY(e);
    for (let i = 0; i < 8; i++) {
      const b = chipBounds[i];
      if (b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        // Toggle bit i of rule
        rule ^= (1 << i);
        table = ruleTable(rule);
        flipTimes[i] = performance.now();
        // Update slider + gallery highlight + rebuild
        const inp = sliderRoot.querySelector('input[type="range"]');
        inp.value = rule;
        sliderRoot.querySelector('.value').textContent = rule;
        galleryEl.querySelectorAll('.rule-thumb').forEach(el => {
          el.classList.toggle('active', Number(el.getAttribute('data-rule')) === rule);
        });
        build();
        render();
        e.preventDefault();
        return;
      }
    }
  });

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    // ---- Header: big rule number + class badge --------------------
    ctx.font = 'bold 30px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = P.ink;
    ctx.fillText(`Rule ${rule}`, 20, 28);
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(`binary ${rule.toString(2).padStart(8, '0')}`, 20, 46);

    const cls = classifyCA(grid);
    const meta = CLASS_META[cls];
    const badge = `${meta.emoji}  ${meta.name}`;
    ctx.font = 'bold 15px Inter,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const bw = ctx.measureText(badge).width + 24;
    const bh = 32;
    const bx = W - 20 - bw;
    const by = 28 - bh / 2;
    ctx.fillStyle = meta.color + '22';
    roundRectPath(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.fillText(badge, W - 32, 28);

    // ---- 8 clickable pattern chips -------------------------------
    // Chip layout: 8 chips in a row. Show patterns from 111 (i=7) → 000 (i=0).
    // Each chip: 3 input cells (top row) + big output cell (bottom, clickable).
    const chipsTopY = 74;
    const chipW = 62;
    const chipH = 96;
    const chipsAvail = W - 30;
    const totalW = Math.min(8 * chipW + 7 * 6, chipsAvail);
    const actualChipW = Math.min(chipW, (chipsAvail - 7 * 6) / 8);
    const actualChipH = chipH;
    const totalChipsW = 8 * actualChipW + 7 * 6;
    const chipsX0 = (W - totalChipsW) / 2;

    for (let i = 7; i >= 0; i--) {
      const pos = 7 - i;   // display position, 0 (leftmost) to 7 (rightmost)
      const cx = chipsX0 + pos * (actualChipW + 6);
      const cy = chipsTopY;
      chipBounds[i] = { x: cx, y: cy, w: actualChipW, h: actualChipH };

      // Chip background — subtle highlight if this output = 1
      const outBit = (rule >> i) & 1;
      ctx.fillStyle = outBit ? P.accent + '14' : '#F9FAFC';
      roundRectPath(ctx, cx, cy, actualChipW, actualChipH, 10);
      ctx.fill();
      ctx.strokeStyle = outBit ? P.accent + '55' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, cx, cy, actualChipW, actualChipH, 10);
      ctx.stroke();

      // Input pattern — 3 small cells
      const inCellSize = Math.min(14, (actualChipW - 12) / 3.4);
      const inGap = 2;
      const inTotalW = 3 * inCellSize + 2 * inGap;
      const inX0 = cx + (actualChipW - inTotalW) / 2;
      const inY  = cy + 12;
      for (let b = 0; b < 3; b++) {
        const bit = (i >> (2 - b)) & 1;
        const cx1 = inX0 + b * (inCellSize + inGap);
        ctx.fillStyle = bit ? P.ink : 'white';
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.fillRect(cx1, inY, inCellSize, inCellSize);
        ctx.strokeRect(cx1 + 0.5, inY + 0.5, inCellSize - 1, inCellSize - 1);
      }

      // Arrow ↓
      ctx.fillStyle = P.muted;
      ctx.font = '12px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↓', cx + actualChipW / 2, cy + 40);

      // Output cell — larger, clickable
      const outCellSize = Math.min(26, actualChipW - 20);
      const outX = cx + (actualChipW - outCellSize) / 2;
      const outY = cy + 52;

      // Flip animation: scale + colour flash
      const flipAge = now - flipTimes[i];
      const flipScale = flipAge < 260 ? 1 + easeOut(flipAge / 260) * 0.15 : 1;
      const drawSize = outCellSize * flipScale;
      const drawX = outX + (outCellSize - drawSize) / 2;
      const drawY = outY + (outCellSize - drawSize) / 2;

      if (outBit) {
        ctx.fillStyle = P.accent;
        ctx.strokeStyle = P.accent;
      } else {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      }
      ctx.lineWidth = 2;
      roundRectPath(ctx, drawX, drawY, drawSize, drawSize, 4);
      ctx.fill();
      if (!outBit) {
        roundRectPath(ctx, drawX + 0.5, drawY + 0.5, drawSize - 1, drawSize - 1, 4);
        ctx.stroke();
      }

      // Flip pulse ring
      if (flipAge < 300) {
        const t = flipAge / 300;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 2;
        const grow = 1 + easeOut(t) * 0.6;
        const gw = outCellSize * grow;
        const gx = outX + (outCellSize - gw) / 2;
        const gy = outY + (outCellSize - gw) / 2;
        roundRectPath(ctx, gx, gy, gw, gw, 6);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Instruction below chips
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('click any orange square to flip that output ↑', W / 2, chipsTopY + actualChipH + 8);

    // ---- Space-time diagram ---------------------------------------
    const stY = chipsTopY + actualChipH + 32;
    const stX = 20;
    const stW = W - 40;
    const stH = 320;
    ctx.fillStyle = '#060811';
    ctx.fillRect(stX, stY, stW, stH);
    const cellW = stW / WIDTH;
    const cellH = stH / (STEPS + 1);
    ctx.fillStyle = meta.color;
    for (let t = 0; t <= STEPS; t++) {
      const y = stY + t * cellH;
      const row = grid[t];
      for (let c = 0; c < WIDTH; c++) {
        if (row[c]) ctx.fillRect(stX + c * cellW, y, cellW + 0.5, cellH + 0.5);
      }
    }

    // Axis labels
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('space →', stX, stY + stH + 4);
    ctx.save();
    ctx.translate(12, stY + stH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('time ↓', 0, 0);
    ctx.restore();

    // ---- Row entropy trace ---------------------------------------
    let hSum = 0;
    const tail = grid.slice(Math.floor(grid.length / 2));
    for (const row of tail) hSum += rowEntropy(row);
    const meanTailH = hSum / tail.length;

    const traceY = stY + stH + 26;
    const traceH = H - traceY - 8;
    if (traceH > 20) {
      ctx.strokeStyle = P.line;
      ctx.beginPath();
      ctx.moveTo(stX, traceY + traceH); ctx.lineTo(stX + stW, traceY + traceH);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(stX, traceY + 2); ctx.lineTo(stX + stW, traceY + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t <= STEPS; t++) {
        const h = rowEntropy(grid[t]);
        const px = stX + (t / STEPS) * stW;
        const py = traceY + (traceH - 2) - h * (traceH - 4);
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.font = '11px Inter,system-ui,sans-serif';
      ctx.fillStyle = P.muted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('row entropy over time (dashed = 1 bit ceiling)', stX, traceY - 4);
    }

    // Metrics
    setMetric(mDetected, `${meta.emoji} ${meta.name}`, meta.fullName);
    const known = WOLFRAM_CLASSES[rule];
    if (known) {
      const kMeta = CLASS_META[known];
      setMetric(mKnown, `${kMeta.emoji} ${kMeta.name}`, kMeta.fullName);
    } else {
      setMetric(mKnown, '—', 'not in the famous list');
    }
    setMetric(mH, meanTailH.toFixed(3), '1.0 = 50/50 max');
  }
  onResize(canvas, CANVAS_H, render);

  // Redraw once a click-flip animation is active
  const loop = makeLoop(() => {
    const now = performance.now();
    let active = false;
    for (const t of flipTimes) if (now - t < 320) { active = true; break; }
    render();
    return active;
  });

  bindSlider(sliderRoot, v => {
    rule = v;
    table = ruleTable(rule);
    galleryEl.querySelectorAll('.rule-thumb').forEach(el => {
      el.classList.toggle('active', Number(el.getAttribute('data-rule')) === rule);
    });
    build();
    render();
  });

  randomToggle.addEventListener('change', () => {
    useRandom = randomToggle.checked;
    seed = Math.floor(Math.random() * 1e6);
    build(); render();
  });

  diceBtn.onclick = () => loadRule(Math.floor(Math.random() * 256));

  // Preset buttons (data-preset)
  document.querySelectorAll('button[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => loadRule(Number(btn.getAttribute('data-preset'))));
  });

  loadRule(30);

  // Also start the loop briefly to catch initial paint via onResize
  loop.start();
}

// ============================================================================
// Bootstrap
// ============================================================================

initConceptDiagram();
initSurpriseMachine();
initFourFates();
initRuleBuilder();
