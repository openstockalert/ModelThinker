// Life & Local Majority story — two cellular automata on the same grid.

import { fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric } from '../shared/ui.js';

const P = {
  primary: '#4C6EF5', accent: '#F76707', success: '#37B24D',
  danger: '#E03131', muted: '#868E96', ink: '#212529',
  bg: '#FBFCFF', line: '#E9ECEF',
};

// ============================================================================
// Pattern registry — for the Life sandbox
// ============================================================================

const _ = (rows) => rows.map(r => r.split('').map(c => (c === 'X' ? 1 : 0)));

const PATTERNS = {
  glider: {
    label: '✈ Glider',
    kind: 'Spaceship',
    fact: '5 cells. Moves diagonally at c/4 (one diagonal step every 4 generations). ' +
          'The first "spaceship" discovered — and the classic emblem of Life.',
    cells: _(['.X.',
              '..X',
              'XXX']),
  },
  blinker: {
    label: '🚦 Blinker',
    kind: 'Oscillator · period 2',
    fact: 'The simplest oscillator. Three cells that swap between horizontal and vertical every step.',
    cells: _(['XXX']),
  },
  block: {
    label: '🟩 Block',
    kind: 'Still life',
    fact: 'Four cells in a 2×2 square. Does absolutely nothing forever. The simplest still life.',
    cells: _(['XX',
              'XX']),
  },
  beacon: {
    label: '🔦 Beacon',
    kind: 'Oscillator · period 2',
    fact: 'Two touching blocks that appear and disappear alternately.',
    cells: _(['XX..',
              'XX..',
              '..XX',
              '..XX']),
  },
  toad: {
    label: '🐸 Toad',
    kind: 'Oscillator · period 2',
    fact: '6 cells that toggle between two overlapping arrangements.',
    cells: _(['.XXX',
              'XXX.']),
  },
  pulsar: {
    label: '💓 Pulsar',
    kind: 'Oscillator · period 3',
    fact: '48 cells. Cycles through 3 distinct configurations. The most common period-3 oscillator.',
    cells: _(['..XXX...XXX..',
              '.............',
              'X....X.X....X',
              'X....X.X....X',
              'X....X.X....X',
              '..XXX...XXX..',
              '.............',
              '..XXX...XXX..',
              'X....X.X....X',
              'X....X.X....X',
              'X....X.X....X',
              '.............',
              '..XXX...XXX..']),
  },
  lwss: {
    label: '🚀 Lightweight ship',
    kind: 'Spaceship',
    fact: 'Moves horizontally at c/2 (twice a glider\'s speed). One of the few spaceships found within a decade of Life\'s discovery.',
    cells: _(['.XXXX',
              'X...X',
              '....X',
              'X..X.']),
  },
  r_pentomino: {
    label: '💥 R-pentomino',
    kind: 'Methuselah · settles at gen 1103',
    fact: 'Just 5 cells. Runs chaotic for 1103 generations before settling into 25 still lifes, 8 blinkers, and 6 escaping gliders. This little pattern is what convinced Conway to keep working on Life.',
    cells: _(['.XX',
              'XX.',
              '.X.']),
  },
  acorn: {
    label: '🌰 Acorn',
    kind: 'Methuselah · settles at gen 5206',
    fact: '7 cells. Runs for 5206 generations before stabilising into 633 cells plus 13 escaping gliders. Discovered by Charles Corderman in 1971.',
    cells: _(['.X.....',
              '...X...',
              'XX..XXX']),
  },
  glider_gun: {
    label: '🔫 Gosper glider gun',
    kind: 'Gun · unbounded growth',
    fact: 'Discovered by Bill Gosper in November 1970. Emits a new glider every 30 generations, forever. Conway had bet $50 that no unbounded pattern could exist in Life — Gosper collected.',
    cells: _(['........................X...........',
              '......................X.X...........',
              '............XX......XX............XX',
              '...........X...X....XX............XX',
              'XX........X.....X...XX..............',
              'XX........X...X.XX....X.X...........',
              '..........X.....X.......X...........',
              '...........X...X....................',
              '............XX......................']),
  },
};

// ============================================================================
// Shared grid helpers
// ============================================================================

function makeGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Int16Array(cols));
}

function neighbourCount(grid, r, c, wrap = true) {
  const rows = grid.length, cols = grid[0].length;
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      let rr = r + dr, cc = c + dc;
      if (wrap) {
        rr = (rr + rows) % rows;
        cc = (cc + cols) % cols;
      } else if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) {
        continue;
      }
      if (grid[rr][cc] > 0) n++;
    }
  }
  return n;
}

// ============================================================================
// SIM 1 · Conway's Game of Life
// ============================================================================

function initLifeSim() {
  const canvas = document.getElementById('life-canvas');
  if (!canvas) return;
  const patternRoot = document.getElementById('life-patterns');
  const infoEl = document.getElementById('life-info');
  const playBtn = document.getElementById('life-play');
  const stepBtn = document.getElementById('life-step');
  const clearBtn = document.getElementById('life-clear');
  const randBtn = document.getElementById('life-random');
  const mGen = document.getElementById('life-gen');
  const mPop = document.getElementById('life-pop');
  const mPeak = document.getElementById('life-peak');
  const mMode = document.getElementById('life-mode');
  const speedRoot = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 480;
  const ROWS = 60;
  const COLS = 100;

  // grid[r][c] stores age: 0 = dead, k>0 = alive for k steps.
  let grid = makeGrid(ROWS, COLS);
  let generation = 0;
  let population = 0;
  let peak = 0;
  let auto = false;
  let stepsPerSecond = 10;
  let lastAdvance = 0;

  // Pointer painting state
  let painting = false;
  let paintValue = 1;   // when starting drag, set to opposite of clicked cell

  function countPopulation() {
    let p = 0;
    for (let r = 0; r < ROWS; r++) {
      const row = grid[r];
      for (let c = 0; c < COLS; c++) if (row[c] > 0) p++;
    }
    return p;
  }

  function updateStats() {
    population = countPopulation();
    if (population > peak) peak = population;
    setMetric(mGen, String(generation));
    setMetric(mPop, String(population));
    setMetric(mPeak, String(peak));
    setMetric(mMode, auto ? '▶ Running' : '🎨 Draw mode');
  }

  function step() {
    const next = makeGrid(ROWS, COLS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const n = neighbourCount(grid, r, c, /*wrap*/ true);
        const alive = grid[r][c] > 0;
        if (alive && (n === 2 || n === 3)) {
          next[r][c] = Math.min(30, grid[r][c] + 1);   // ages up
        } else if (!alive && n === 3) {
          next[r][c] = 1;   // born
        }
        // else: dies (or stays dead)
      }
    }
    grid = next;
    generation++;
    updateStats();
  }

  function clear() {
    grid = makeGrid(ROWS, COLS);
    generation = 0;
    peak = 0;
    updateStats();
  }

  function randomise(density = 0.28) {
    const rng = makeRng(Math.floor(Math.random() * 1e6));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = rng() < density ? 1 : 0;
      }
    }
    generation = 0;
    peak = 0;
    updateStats();
  }

  function loadPattern(patternKey) {
    clear();
    const pat = PATTERNS[patternKey];
    if (!pat) return;
    const rows = pat.cells.length, cols = pat.cells[0].length;
    const r0 = Math.floor((ROWS - rows) / 2);
    const c0 = Math.floor((COLS - cols) / 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid[r0 + r][c0 + c] = pat.cells[r][c];
      }
    }
    generation = 0;
    peak = 0;
    updateStats();
    // Info panel
    infoEl.innerHTML = `<strong>${pat.label}</strong> · <em style="color:var(--muted);">${pat.kind}</em><br>${pat.fact}`;
  }

  // Colour scheme: age determines colour, from hot orange (just born) to cool blue (old).
  const COL_BORN = { r: 247, g: 103, b: 7 };    // orange
  const COL_OLD  = { r: 76,  g: 110, b: 245 };  // blue
  function ageColor(age) {
    // Map age 1..30 to lerp t = (age-1)/29
    const t = Math.min(1, Math.max(0, (age - 1) / 29));
    const r = Math.round(COL_BORN.r + (COL_OLD.r - COL_BORN.r) * t);
    const g = Math.round(COL_BORN.g + (COL_OLD.g - COL_BORN.g) * t);
    const b = Math.round(COL_BORN.b + (COL_OLD.b - COL_BORN.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);
    const cellW = W / COLS;
    const cellH = H / ROWS;
    const cell = Math.min(cellW, cellH);
    const offX = (W - cell * COLS) / 2;
    const offY = (H - cell * ROWS) / 2;
    // Grid background
    ctx.fillStyle = '#F5F7FC';
    ctx.fillRect(offX, offY, cell * COLS, cell * ROWS);
    // Cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const age = grid[r][c];
        if (age === 0) continue;
        ctx.fillStyle = ageColor(age);
        ctx.fillRect(offX + c * cell + 0.5, offY + r * cell + 0.5, cell - 1, cell - 1);
      }
    }
    // Faint grid lines when zoomed
    if (cell > 6) {
      ctx.strokeStyle = 'rgba(200,205,215,0.35)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let r = 0; r <= ROWS; r++) {
        ctx.moveTo(offX, offY + r * cell); ctx.lineTo(offX + cell * COLS, offY + r * cell);
      }
      for (let c = 0; c <= COLS; c++) {
        ctx.moveTo(offX + c * cell, offY); ctx.lineTo(offX + c * cell, offY + cell * ROWS);
      }
      ctx.stroke();
    }
  }
  onResize(canvas, CANVAS_H, render);

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Same cell-size math as render
    const cellW = rect.width / COLS;
    const cellH = rect.height / ROWS;
    const cell = Math.min(cellW, cellH);
    const offX = (rect.width - cell * COLS) / 2;
    const offY = (rect.height - cell * ROWS) / 2;
    const col = Math.floor((x - offX) / cell);
    const row = Math.floor((y - offY) / cell);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { row, col };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    painting = true;
    paintValue = grid[cell.row][cell.col] > 0 ? 0 : 1;
    grid[cell.row][cell.col] = paintValue;
    updateStats();
    render();
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (grid[cell.row][cell.col] !== paintValue) {
      grid[cell.row][cell.col] = paintValue;
      updateStats();
      render();
    }
  });
  canvas.addEventListener('pointerup', () => { painting = false; });
  canvas.addEventListener('pointercancel', () => { painting = false; });

  // Pattern buttons
  for (const [key, spec] of Object.entries(PATTERNS)) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = spec.label;
    btn.style.fontSize = '13px';
    btn.style.padding = '6px 12px';
    btn.addEventListener('click', () => {
      loadPattern(key);
      auto = false;
      playBtn.textContent = '▶ Play';
      render();
    });
    patternRoot.appendChild(btn);
  }

  playBtn.addEventListener('click', () => {
    auto = !auto;
    playBtn.textContent = auto ? '⏸ Pause' : '▶ Play';
    updateStats();
    if (auto) { lastAdvance = 0; loop.start(); }
  });
  stepBtn.addEventListener('click', () => {
    step(); render();
  });
  clearBtn.addEventListener('click', () => {
    auto = false; playBtn.textContent = '▶ Play';
    clear(); infoEl.innerHTML = ''; render();
  });
  randBtn.addEventListener('click', () => {
    auto = false; playBtn.textContent = '▶ Play';
    randomise(); infoEl.innerHTML = '<strong>🎲 Random start.</strong> ~28% density. Hit play and see what emerges — most random starts settle into a mix of still lifes and blinkers within ~200 generations.';
    render();
  });

  bindSlider(speedRoot, v => { stepsPerSecond = v; }, v => `${v} /s`);

  const loop = makeLoop(() => {
    const now = performance.now();
    if (auto && now - lastAdvance >= 1000 / stepsPerSecond) {
      step();
      lastAdvance = now;
      render();
    }
    if (!auto) return false;
  });

  // Boot with a glider
  loadPattern('glider');
  render();
}

// ============================================================================
// SIM 2 · Local Majority
// ============================================================================

function initMajoritySim() {
  const canvas = document.getElementById('maj-canvas');
  if (!canvas) return;
  const playBtn = document.getElementById('maj-play');
  const resetBtn = document.getElementById('maj-reset');
  const mStep = document.getElementById('maj-step');
  const mShare = document.getElementById('maj-share');
  const mClusters = document.getElementById('maj-clusters');
  const mFlips = document.getElementById('maj-flips');
  const densitySlider = canvas.parentElement.querySelector('.slider-block');

  const CANVAS_H = 380;
  const ROWS = 48;
  const COLS = 80;

  let grid = makeGrid(ROWS, COLS);
  let step_count = 0;
  let auto = false;
  let lastAdvance = 0;
  let density = 0.5;
  let flipsThisStep = 0;

  bindSlider(densitySlider, v => { density = v / 100; }, v => `${v}%`);

  function randomFill() {
    const rng = makeRng(Math.floor(Math.random() * 1e6));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = rng() < density ? 1 : 0;
      }
    }
    step_count = 0;
    flipsThisStep = 0;
    updateStats();
  }

  function stepMajority() {
    const next = makeGrid(ROWS, COLS);
    let flips = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const n = neighbourCount(grid, r, c, true);
        // 8 neighbours: >4 → become 1, <4 → become 0, tied → keep current
        let newVal = grid[r][c];
        if (n > 4) newVal = 1;
        else if (n < 4) newVal = 0;
        next[r][c] = newVal;
        if (newVal !== grid[r][c]) flips++;
      }
    }
    grid = next;
    step_count++;
    flipsThisStep = flips;
    updateStats();
    return flips;
  }

  function countClusters(target) {
    // 4-connected connected-components count.
    const visited = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (visited[r][c] || grid[r][c] !== target) continue;
        count++;
        // DFS via stack
        const stack = [[r, c]];
        while (stack.length) {
          const [rr, cc] = stack.pop();
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
          if (visited[rr][cc] || grid[rr][cc] !== target) continue;
          visited[rr][cc] = 1;
          stack.push([rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]);
        }
      }
    }
    return count;
  }

  function updateStats() {
    let ones = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) ones++;
    setMetric(mStep, String(step_count));
    setMetric(mShare, `${(100 * ones / (ROWS * COLS)).toFixed(1)}%`);
    setMetric(mClusters, String(countClusters(1)));
    setMetric(mFlips, String(flipsThisStep));
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    const cell = Math.min(W / COLS, H / ROWS);
    const offX = (W - cell * COLS) / 2;
    const offY = (H - cell * ROWS) / 2;
    // Two colours for the two values
    const blue = P.primary;      // 1
    const orange = P.accent;     // 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = grid[r][c] > 0 ? blue : orange;
        ctx.fillRect(offX + c * cell + 0.4, offY + r * cell + 0.4, cell - 0.8, cell - 0.8);
      }
    }
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    const now = performance.now();
    if (auto && now - lastAdvance >= 200) {
      const flips = stepMajority();
      lastAdvance = now;
      render();
      if (flips === 0) {
        // Reached fixed point
        auto = false;
        playBtn.textContent = '▶ Play';
      }
    }
    if (!auto) return false;
  });

  playBtn.addEventListener('click', () => {
    auto = !auto;
    playBtn.textContent = auto ? '⏸ Pause' : '▶ Play';
    if (auto) { lastAdvance = 0; loop.start(); }
  });
  resetBtn.addEventListener('click', () => {
    auto = false; playBtn.textContent = '▶ Play';
    randomFill(); render();
  });

  randomFill();
  render();
}

// ============================================================================

initLifeSim();
initMajoritySim();
