// Schelling segregation — pure-JS reimplementation for the web story.
// Same rule as src/modelthinker/dynamics/schelling.py, redrawn for the browser.

import { easeOut, fitCanvas, makeLoop, onResize, pointerCell } from '../shared/canvas.js';
import { bindSlider, makeRng, setMeter, setMetric, shuffle } from '../shared/ui.js';

const EMPTY = 0, A = 1, B = 2;
const OFFSETS = [
  [-1,-1],[-1,0],[-1,1],
  [ 0,-1],       [ 0,1],
  [ 1,-1],[ 1,0],[ 1,1],
];
const COLORS = { [A]: '#4C6EF5', [B]: '#F76707' };
const COLORS_SAD = { [A]: '#3B5BDB', [B]: '#DC5A00' };  // slightly darker when unhappy

// ---------- Model -----------------------------------------------------------

function makeGrid({ size, density, seed, biasA = 0.5 }) {
  const rng = makeRng(seed);
  const n = size * size;
  const nAgents = Math.round(n * density);
  const nA = Math.round(nAgents * biasA);
  const nB = nAgents - nA;
  const cells = new Int8Array(n);
  for (let i = 0; i < nA; i++) cells[i] = A;
  for (let i = 0; i < nB; i++) cells[nA + i] = B;
  const idx = Array.from({ length: n }, (_, i) => i);
  shuffle(idx, rng);
  const shuffled = new Int8Array(n);
  for (let i = 0; i < n; i++) shuffled[i] = cells[idx[i]];
  return { cells: shuffled, size, rng };
}

function neighbourCounts(grid, r, c) {
  const { cells, size } = grid;
  const me = cells[r * size + c];
  let same = 0, other = 0;
  for (const [dr, dc] of OFFSETS) {
    const rr = (r + dr + size) % size;
    const cc = (c + dc + size) % size;
    const v = cells[rr * size + cc];
    if (v === EMPTY) continue;
    if (v === me) same++; else other++;
  }
  return { same, other };
}

function isHappy(grid, r, c, tau) {
  const { same, other } = neighbourCounts(grid, r, c);
  const total = same + other;
  if (total === 0) return true;
  return same / total >= tau;
}

function findUnhappy(grid, tau) {
  const out = [];
  const { size, cells } = grid;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r * size + c] === EMPTY) continue;
      if (!isHappy(grid, r, c, tau)) out.push([r, c]);
    }
  }
  return out;
}

function findEmpties(grid) {
  const out = [];
  const { cells } = grid;
  for (let i = 0; i < cells.length; i++) if (cells[i] === EMPTY) out.push(i);
  return out;
}

/** Move ONE random unhappy shape to a random empty cell. Returns true if a move happened. */
function stepOne(grid, tau) {
  const unhappy = findUnhappy(grid, tau);
  if (unhappy.length === 0) return false;
  const empties = findEmpties(grid);
  if (empties.length === 0) return false;
  const [r, c] = unhappy[Math.floor(grid.rng() * unhappy.length)];
  const target = empties[Math.floor(grid.rng() * empties.length)];
  const from = r * grid.size + c;
  grid.cells[target] = grid.cells[from];
  grid.cells[from] = EMPTY;
  return true;
}

function segregationIndex(grid) {
  let same = 0, total = 0;
  const { size, cells } = grid;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r * size + c] === EMPTY) continue;
      const { same: s, other: o } = neighbourCounts(grid, r, c);
      same += s;
      total += s + o;
    }
  }
  return total === 0 ? 0 : same / total;
}

// ---------- Drawing ---------------------------------------------------------

/**
 * Draw a Schelling grid.
 *
 * opts:
 *   tau        — tolerance threshold used to compute face expressions.
 *   highlight  — index of a cell to draw a solid ring + dashed neighbour rings around.
 *   overlay    — { x, y, colour, happy, scale } — an extra shape to draw floating
 *                at pixel coordinates (x, y). Used for drag-and-drop and for
 *                animated fly-to-new-cell transitions.
 *   showFaces  — default true; set false to draw solid dots (for miniature previews).
 *
 * Also returns the layout metadata (s, offX, offY, radius) so callers can
 * compute pixel positions of specific cells without re-doing the math.
 */
function draw(ctx, width, height, grid, opts = {}) {
  const { size, cells } = grid;
  ctx.clearRect(0, 0, width, height);
  const s = Math.min(width, height) / size;
  const offX = (width - s * size) / 2;
  const offY = (height - s * size) / 2;
  const pad = Math.max(1, s * 0.08);
  const radius = (s - 2 * pad) / 2;

  const highlightIdx = opts.highlight ?? -1;
  const tau = opts.tau ?? null;
  const showFaces = opts.showFaces !== false;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      const v = cells[i];
      if (v === EMPTY) continue;
      const cx = offX + col * s + s / 2;
      const cy = offY + row * s + s / 2;

      let happy = true;
      if (tau !== null) happy = isHappy(grid, row, col, tau);

      ctx.fillStyle = happy ? COLORS[v] : COLORS_SAD[v];
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      if (showFaces && s > 14 && tau !== null) {
        drawFace(ctx, cx, cy, radius, happy);
      }
    }
  }

  if (highlightIdx >= 0) {
    const row = Math.floor(highlightIdx / size);
    const col = highlightIdx % size;
    const cx = offX + col * s + s / 2;
    const cy = offY + row * s + s / 2;
    for (const [dr, dc] of OFFSETS) {
      const nr = (row + dr + size) % size;
      const nc = (col + dc + size) % size;
      const nx = offX + nc * s + s / 2;
      const ny = offY + nr * s + s / 2;
      ctx.strokeStyle = 'rgba(33,37,41,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(nx, ny, radius + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#1A1D29';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2); ctx.stroke();
  }

  // Overlay — a floating shape at arbitrary pixel coords.
  if (opts.overlay) {
    const { x, y, colour, happy = true, scale = 1.1 } = opts.overlay;
    const r = radius * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = happy ? COLORS[colour] : COLORS_SAD[colour];
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (showFaces && r > 12) drawFace(ctx, x, y, r, happy);
  }

  return { s, offX, offY, radius };
}

/** Given pixel (x, y), figure out which grid cell it's over. Null if out of grid. */
function pixelToCell(x, y, layout, gridSize) {
  const { s, offX, offY } = layout;
  const col = Math.floor((x - offX) / s);
  const row = Math.floor((y - offY) / s);
  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return null;
  return { row, col };
}

function drawFace(ctx, cx, cy, r, happy) {
  // Face fits inside the circle. Eyes + mouth in white so they read on any colour.
  const eyeR = Math.max(1.3, r * 0.13);
  const eyeOffset = r * 0.32;
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(cx - eyeOffset, cy - r * 0.20, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + eyeOffset, cy - r * 0.20, eyeR, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (happy) {
    // Upturned smile
    ctx.arc(cx, cy + r * 0.05, r * 0.42, Math.PI * 0.15, Math.PI - Math.PI * 0.15, false);
  } else {
    // Downturned frown
    ctx.arc(cx, cy + r * 0.55, r * 0.42, Math.PI + Math.PI * 0.15, 2 * Math.PI - Math.PI * 0.15, false);
  }
  ctx.stroke();
}

// ---------- Sim 1 · Meet the neighbourhood ----------------------------------

function initSim1() {
  const canvas = document.getElementById('sim1');
  const segMetric = document.getElementById('sim1-seg');
  const unhappyMetric = document.getElementById('sim1-unhappy');
  const inspector = document.getElementById('sim1-inspector');

  const GRID_SIZE = 10;   // 10×10 = 100 cells — big faces, easy to grab
  const TAU_DEMO = 0.30;
  const CANVAS_H = 360;
  const DRAG_THRESHOLD = 5;

  let grid = makeGrid({ size: GRID_SIZE, density: 0.9, seed: 7 });
  let highlight = -1;
  let pending = null;    // { idx, downX, downY } — pointer is down but not yet dragging
  let dragging = null;   // { origIdx, colour, x, y, targetIdx | null }
  let lastLayout = null; // { s, offX, offY, radius } from last draw

  function canvasXY(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function render() {
    const { ctx, width, height } = fitCanvas(canvas, CANVAS_H);
    let overlay = null;
    if (dragging) {
      // Preview: if the cursor is over an empty cell, temporarily place the shape
      // there so isHappy computes correctly for the whole neighbourhood.
      let previewIdx = null;
      let happyAtCursor = true;
      if (lastLayout) {
        const cell = pixelToCell(dragging.x, dragging.y, lastLayout, grid.size);
        if (cell) {
          const idx = cell.row * grid.size + cell.col;
          if (grid.cells[idx] === EMPTY) {
            grid.cells[idx] = dragging.colour;
            happyAtCursor = isHappy(grid, cell.row, cell.col, TAU_DEMO);
            previewIdx = idx;
          }
        }
      }
      // Draw grid (all other cells' faces reflect current state)
      lastLayout = draw(ctx, width, height, grid, { tau: TAU_DEMO, highlight });
      // Put the previewed cell back to empty and draw the dragged shape as an overlay
      if (previewIdx !== null) grid.cells[previewIdx] = EMPTY;
      overlay = { x: dragging.x, y: dragging.y, colour: dragging.colour, happy: happyAtCursor, scale: 1.18 };
      // Re-issue the overlay draw — we already drew the base grid; append the floating shape
      draw(ctx, width, height, grid, { tau: TAU_DEMO, highlight, overlay, showFaces: true });
    } else {
      lastLayout = draw(ctx, width, height, grid, { highlight, tau: TAU_DEMO });
    }
    setMetric(segMetric, segregationIndex(grid).toFixed(2));
    setMetric(unhappyMetric, String(findUnhappy(grid, TAU_DEMO).length));
    renderInspector();
  }

  function renderInspector() {
    if (!inspector) return;
    if (dragging) {
      inspector.innerHTML =
        '<strong>Drop over an empty cell</strong> to move the shape there. ' +
        'The face you\'re holding shows how it would feel <em>at that new spot</em>. ' +
        'Drop back on itself (or off the grid) to cancel.';
      return;
    }
    if (highlight < 0) {
      inspector.innerHTML =
        '<strong>Click any face</strong> to inspect its neighbourhood, or ' +
        '<strong>drag it</strong> to any empty cell to see what changes.' +
        '<br><span style="color:var(--muted);font-size:13px;">Everyone wants at least ' +
        '<strong>30 %</strong> same-colour neighbours to feel happy.</span>';
      return;
    }
    const row = Math.floor(highlight / GRID_SIZE);
    const col = highlight % GRID_SIZE;
    const meVal = grid.cells[highlight];
    if (meVal === EMPTY) { highlight = -1; return renderInspector(); }
    const meName = meVal === A ? 'blue 🟦' : 'orange 🟧';
    const { same, other } = neighbourCounts(grid, row, col);
    const total = same + other;
    const ratio = total > 0 ? same / total : 1;
    const happy = ratio >= TAU_DEMO;
    inspector.innerHTML = `
      This <strong>${meName}</strong> shape has
      <strong>${same}</strong> same-colour and <strong>${other}</strong> other-colour neighbour${total === 1 ? '' : 's'}
      (of ${total} non-empty).<br>
      Same-colour fraction: <strong>${(100 * ratio).toFixed(0)}%</strong>.
      At τ = 30 %, it's ${happy
        ? '<strong style="color:#37B24D;">happy 🙂 — stays put</strong>'
        : '<strong style="color:#E03131;">unhappy 🙁 — wants to move</strong>'}.
      <br><span style="color:var(--muted);font-size:13px;">Try dragging it to a different empty spot to see the neighbourhood re-shape.</span>
    `;
  }
  onResize(canvas, CANVAS_H, render);
  render();

  canvas.style.touchAction = 'none';   // stop mobile scrolling while dragging

  canvas.addEventListener('pointerdown', (e) => {
    if (!lastLayout) return;
    const { x, y } = canvasXY(e);
    const cell = pixelToCell(x, y, lastLayout, grid.size);
    if (!cell) return;
    const idx = cell.row * grid.size + cell.col;
    if (grid.cells[idx] === EMPTY) return;   // empty cell — nothing to drag
    pending = { idx, downX: x, downY: y };
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = canvasXY(e);
    if (pending && !dragging) {
      if (Math.hypot(x - pending.downX, y - pending.downY) > DRAG_THRESHOLD) {
        // Promote pending → drag
        dragging = {
          origIdx: pending.idx,
          colour: grid.cells[pending.idx],
          x, y,
        };
        grid.cells[pending.idx] = EMPTY;
        pending = null;
        highlight = -1;
        canvas.style.cursor = 'grabbing';
        render();
      }
    } else if (dragging) {
      dragging.x = x;
      dragging.y = y;
      render();
    }
  });

  function endGesture(e) {
    const { x, y } = canvasXY(e);
    if (dragging) {
      const cell = lastLayout ? pixelToCell(x, y, lastLayout, grid.size) : null;
      if (cell) {
        const targetIdx = cell.row * grid.size + cell.col;
        if (grid.cells[targetIdx] === EMPTY && targetIdx !== dragging.origIdx) {
          grid.cells[targetIdx] = dragging.colour;
          highlight = targetIdx;
          dragging = null;
          canvas.style.cursor = '';
          render();
          return;
        }
      }
      // snap back
      grid.cells[dragging.origIdx] = dragging.colour;
      highlight = dragging.origIdx;
      dragging = null;
      canvas.style.cursor = '';
      render();
      return;
    }
    if (pending) {
      // pure click — inspect
      const idx = pending.idx;
      highlight = grid.cells[idx] === EMPTY ? -1 : idx;
      pending = null;
      render();
    }
  }
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', endGesture);
  canvas.style.cursor = 'grab';
}

// ---------- Sim 2 · The tolerance dial --------------------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const playBtn = document.getElementById('sim2-play');
  const stepBtn = document.getElementById('sim2-step');
  const skipBtn = document.getElementById('sim2-skip');
  const resetBtn = document.getElementById('sim2-reset');
  const segText = document.getElementById('sim2-seg-text');
  const segFill = document.getElementById('sim2-seg-fill').parentElement;
  const stepsMetric = document.getElementById('sim2-steps');
  const unhappyMetric = document.getElementById('sim2-unhappy2');
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 420;
  const FLY_DURATION = 700;   // ms per animated move — deliberately slow so you can follow
  const MAX_SKIP_STEPS = 30_000;

  let grid = makeGrid({ size: 12, density: 0.9, seed: 1 });
  let tau = 0.3;
  let steps = 0;
  let flying = null;     // { fromIdx, toIdx, colour, startTime }
  let auto = false;      // is the loop advancing on its own?

  bindSlider(sliderRoot, (v) => { tau = v / 100; render(); });

  function pickNextMove(now) {
    const unhappy = findUnhappy(grid, tau);
    if (unhappy.length === 0) return false;
    const empties = findEmpties(grid);
    if (empties.length === 0) return false;
    const [fr, fc] = unhappy[Math.floor(grid.rng() * unhappy.length)];
    const targetIdx = empties[Math.floor(grid.rng() * empties.length)];
    const fromIdx = fr * grid.size + fc;
    flying = {
      fromIdx, toIdx: targetIdx,
      colour: grid.cells[fromIdx],
      startTime: now,
    };
    grid.cells[fromIdx] = EMPTY;
    return true;
  }
  function commitFlight() {
    grid.cells[flying.toIdx] = flying.colour;
    steps++;
    flying = null;
  }

  function render() {
    const { ctx, width, height } = fitCanvas(canvas, CANVAS_H);
    let overlay = null;
    if (flying) {
      const now = performance.now();
      const t = Math.min(1, (now - flying.startTime) / FLY_DURATION);
      const eased = easeOut(t);
      const s = Math.min(width, height) / grid.size;
      const offX = (width - s * grid.size) / 2;
      const offY = (height - s * grid.size) / 2;
      const fromRow = Math.floor(flying.fromIdx / grid.size);
      const fromCol = flying.fromIdx % grid.size;
      const toRow = Math.floor(flying.toIdx / grid.size);
      const toCol = flying.toIdx % grid.size;
      const x = offX + (fromCol + (toCol - fromCol) * eased + 0.5) * s;
      const y = offY + (fromRow + (toRow - fromRow) * eased + 0.5) * s;
      // Preview target happiness — temporarily place there so drawFace is right.
      grid.cells[flying.toIdx] = flying.colour;
      const happyAtTarget = isHappy(grid, toRow, toCol, tau);
      grid.cells[flying.toIdx] = EMPTY;
      overlay = { x, y, colour: flying.colour, happy: happyAtTarget, scale: 1.12 };
    }
    draw(ctx, width, height, grid, { tau, overlay });
    const seg = segregationIndex(grid);
    setMeter(segFill, seg);
    segText.textContent = seg.toFixed(2);
    setMetric(stepsMetric, String(steps));
    setMetric(unhappyMetric, String(findUnhappy(grid, tau).length));
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    const now = performance.now();
    if (flying) {
      if (now - flying.startTime >= FLY_DURATION) commitFlight();
    }
    if (!flying) {
      if (!auto) { render(); return false; }
      if (!pickNextMove(now)) {
        auto = false;
        playBtn.textContent = '▶ Let them move';
        render();
        return false;
      }
    }
    render();
  });

  playBtn.addEventListener('click', () => {
    if (auto) {
      auto = false; playBtn.textContent = '▶ Let them move';
    } else {
      auto = true; playBtn.textContent = '⏸ Pause';
      loop.start();
    }
  });
  stepBtn.addEventListener('click', () => {
    if (auto || flying) return;
    if (pickNextMove(performance.now())) {
      loop.start();   // will animate one move, then stop (auto is false)
    }
  });
  skipBtn?.addEventListener('click', () => {
    // Fast-forward: keep running the plain (non-animated) step until settled.
    if (flying) { commitFlight(); }
    auto = false;
    loop.stop();
    playBtn.textContent = '▶ Let them move';
    let n = 0;
    while (n < MAX_SKIP_STEPS && stepOne(grid, tau)) { steps++; n++; }
    render();
  });
  resetBtn.addEventListener('click', () => {
    auto = false;
    loop.stop();
    playBtn.textContent = '▶ Let them move';
    flying = null;
    steps = 0;
    grid = makeGrid({ size: 12, density: 0.9, seed: Math.floor(Math.random() * 10000) });
    render();
  });

  render();
}

// ---------- Sim 3 · Three tolerances side-by-side ---------------------------

function initSim3() {
  const configs = [
    { key: 'a', tau: 0.10, canvas: 'sim3a', seg: 'sim3a-seg' },
    { key: 'b', tau: 0.30, canvas: 'sim3b', seg: 'sim3b-seg' },
    { key: 'c', tau: 0.50, canvas: 'sim3c', seg: 'sim3c-seg' },
  ];
  const state = configs.map(cfg => ({
    ...cfg,
    grid: makeGrid({ size: 10, density: 0.9, seed: 42 }),
    steps: 0,
    canvasEl: document.getElementById(cfg.canvas),
    segEl: document.getElementById(cfg.seg),
  }));
  const runBtn = document.getElementById('sim3-run');
  const resetBtn = document.getElementById('sim3-reset');

  function renderAll() {
    for (const s of state) {
      const { ctx, width, height } = fitCanvas(s.canvasEl, 220);
      draw(ctx, width, height, s.grid, { tau: s.tau });
      s.segEl.textContent = `seg ${segregationIndex(s.grid).toFixed(2)}`;
    }
  }
  for (const s of state) onResize(s.canvasEl, 220, renderAll);
  renderAll();

  const loop = makeLoop(() => {
    let anyMoved = false;
    for (const s of state) {
      for (let i = 0; i < 15; i++) {
        if (stepOne(s.grid, s.tau)) { s.steps++; anyMoved = true; }
      }
    }
    renderAll();
    if (!anyMoved) { runBtn.textContent = '▶ Run all three'; return false; }
    if (state[0].steps > 4000) { runBtn.textContent = '▶ Run all three'; return false; }
  });
  runBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); runBtn.textContent = '▶ Run all three'; }
    else { loop.start(); runBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', () => {
    loop.stop();
    runBtn.textContent = '▶ Run all three';
    const seed = Math.floor(Math.random() * 10000);
    for (const s of state) { s.grid = makeGrid({ size: 10, density: 0.9, seed }); s.steps = 0; }
    renderAll();
  });
}

// ---------- Sim 4 · Full sandbox --------------------------------------------

function initSim4() {
  const canvas = document.getElementById('sim4');
  const playBtn = document.getElementById('sim4-play');
  const resetBtn = document.getElementById('sim4-reset');
  const segText = document.getElementById('sim4-seg-text');
  const segFill = document.getElementById('sim4-seg-fill').parentElement;
  const stepsMetric = document.getElementById('sim4-steps');
  const unhappyMetric = document.getElementById('sim4-unhappy');
  const statusMetric = document.getElementById('sim4-status');

  // Declare ALL state first — the slider callbacks below invoke render() at init,
  // and render() needs grid/steps/loop to already exist.
  let tau = 0.30, size = 14, density = 0.90, seed = 42;
  let grid = makeGrid({ size, density, seed });
  let steps = 0;

  function rebuild() {
    loop.stop();
    playBtn.textContent = '▶ Play';
    steps = 0;
    grid = makeGrid({ size, density, seed });
    render();
  }
  function render() {
    const { ctx, width, height } = fitCanvas(canvas, 460);
    draw(ctx, width, height, grid, { tau });
    const seg = segregationIndex(grid);
    setMeter(segFill, seg);
    segText.textContent = seg.toFixed(2);
    setMetric(stepsMetric, String(steps));
    const unhappy = findUnhappy(grid, tau).length;
    setMetric(unhappyMetric, String(unhappy));
    if (unhappy === 0) setMetric(statusMetric, 'settled ✓');
    else setMetric(statusMetric, loop.running() ? 'running…' : 'idle');
  }

  const loop = makeLoop(() => {
    for (let i = 0; i < 60; i++) {
      if (!stepOne(grid, tau)) { render(); playBtn.textContent = '▶ Play'; return false; }
      steps++;
    }
    render();
  });

  // Now safe to bind sliders — grid/loop/render all exist.
  const controls = canvas.parentElement.querySelectorAll('.slider-block');
  bindSlider(controls[0], v => { tau = v / 100; render(); });
  bindSlider(controls[1], v => { size = v; rebuild(); });
  bindSlider(controls[2], v => { density = v / 100; rebuild(); });

  onResize(canvas, 460, render);

  // Single toggle button — Play <-> Pause.
  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Play'; render(); }
    else { loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', () => { seed = Math.floor(Math.random() * 100000); rebuild(); });

  render();
}

// ---------- Boot ------------------------------------------------------------

initSim1();
initSim2();
initSim3();
initSim4();
