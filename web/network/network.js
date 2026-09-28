// Network story · three sims:
//   1. The rewiring switch  — ring lattice → small world with a slider
//   2. Friendship paradox   — random-person vs random-friend sampling game
//   3. Attack the network   — random-failure vs hub-targeted attack side-by-side
//
// Everything renders straight to canvas. Force-directed layouts are computed
// in-page (Fruchterman–Reingold with cooling) since we only ever handle
// networks with ~40–80 nodes.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric, shuffle } from '../shared/ui.js';

// ============================================================================
// Shared helpers
// ============================================================================

const P = {
  primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
  danger:  '#E03131', success:'#37B24D', warn:  '#F59F00',
  purple:  '#7048E8', ink:    '#212529', line:  '#E9ECEF',
};

// ---- Network construction --------------------------------------------------

/** Ring lattice: every node connected to its k nearest neighbours on a ring. */
function buildRingLattice(n, k) {
  const edges = [];
  const half = k >> 1;
  for (let i = 0; i < n; i++) {
    for (let d = 1; d <= half; d++) {
      const j = (i + d) % n;
      edges.push([i, j]);
    }
  }
  return edges;
}

/** Watts–Strogatz rewire: for each ring edge, with probability p replace it
 *  with a random long-distance edge. Returns { edges, rewiredIndices } where
 *  rewiredIndices marks which edges in the returned array were rewired. */
function watsStrogatzRewire(n, k, p, seed) {
  const rng = makeRng(seed);
  const edges = buildRingLattice(n, k);
  const rewiredSet = new Set();
  // Adjacency set for quick "already an edge?" lookup
  const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const adjSet = new Set(edges.map(([a, b]) => key(a, b)));

  for (let i = 0; i < edges.length; i++) {
    if (rng() >= p) continue;
    const [u, oldV] = edges[i];
    // Pick a new target v' ≠ u and not already connected
    let tries = 0;
    let vp = -1;
    while (tries++ < 50) {
      const cand = Math.floor(rng() * n);
      if (cand === u) continue;
      const k1 = key(u, cand);
      if (adjSet.has(k1)) continue;
      vp = cand;
      break;
    }
    if (vp < 0) continue;   // couldn't find a spot; leave as-is
    adjSet.delete(key(u, oldV));
    adjSet.add(key(u, vp));
    edges[i] = [u, vp];
    rewiredSet.add(i);
  }
  return { edges, rewired: rewiredSet };
}

/** Barabási–Albert scale-free: start with a small clique of m nodes; each new
 *  node attaches to m existing nodes with probability proportional to degree. */
function buildBA(n, m, seed) {
  const rng = makeRng(seed);
  const edges = [];
  // Seed: m fully-connected nodes so degree > 0 for the first arrival
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) edges.push([i, j]);
  }
  // "Repeated-nodes list" for O(1) preferential draws
  const bag = [];
  for (const [a, b] of edges) { bag.push(a); bag.push(b); }
  for (let i = m; i < n; i++) {
    const chosen = new Set();
    while (chosen.size < m) {
      const target = bag[Math.floor(rng() * bag.length)];
      if (target !== i && !chosen.has(target)) chosen.add(target);
    }
    for (const t of chosen) {
      edges.push([i, t]);
      bag.push(i); bag.push(t);
    }
  }
  return edges;
}

// ---- Graph analysis --------------------------------------------------------

/** Adjacency list. `alive` optionally filters removed nodes (Set of alive ids). */
function adjacencyList(n, edges, alive = null) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    if (alive && (!alive.has(a) || !alive.has(b))) continue;
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

/** BFS-based mean shortest path length across the largest connected component. */
function meanShortestPath(n, edges, alive = null) {
  const adj = adjacencyList(n, edges, alive);
  const nodes = alive ? [...alive] : Array.from({ length: n }, (_, i) => i);
  if (nodes.length < 2) return 0;
  let totalPaths = 0;
  let count = 0;
  // Only measure over the largest connected component
  const { largestComponent } = connectedComponents(n, edges, alive);
  const setLC = new Set(largestComponent);
  for (const s of largestComponent) {
    const dist = new Int32Array(n).fill(-1);
    dist[s] = 0;
    const queue = [s];
    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      for (const u of adj[v]) {
        if (dist[u] < 0 && setLC.has(u)) {
          dist[u] = dist[v] + 1;
          queue.push(u);
        }
      }
    }
    for (const t of largestComponent) {
      if (t !== s && dist[t] > 0) {
        totalPaths += dist[t];
        count++;
      }
    }
  }
  return count > 0 ? totalPaths / count : 0;
}

/** Mean local clustering coefficient. Ignores isolated nodes. */
function meanClustering(n, edges, alive = null) {
  const adj = adjacencyList(n, edges, alive);
  const nodes = alive ? [...alive] : Array.from({ length: n }, (_, i) => i);
  let sum = 0;
  let count = 0;
  for (const v of nodes) {
    const nbrs = adj[v];
    if (nbrs.length < 2) continue;
    // Count edges among neighbours
    const nbrSet = new Set(nbrs);
    let triangles = 0;
    for (let i = 0; i < nbrs.length; i++) {
      for (let j = i + 1; j < nbrs.length; j++) {
        if (adj[nbrs[i]].includes(nbrs[j])) triangles++;
      }
    }
    const possible = (nbrs.length * (nbrs.length - 1)) / 2;
    sum += triangles / possible;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** Return connected components. `alive` optional filter. */
function connectedComponents(n, edges, alive = null) {
  const adj = adjacencyList(n, edges, alive);
  const nodes = alive ? [...alive] : Array.from({ length: n }, (_, i) => i);
  const nodeSet = new Set(nodes);
  const visited = new Set();
  const components = [];
  for (const start of nodes) {
    if (visited.has(start)) continue;
    const comp = [];
    const queue = [start];
    visited.add(start);
    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      comp.push(v);
      for (const u of adj[v]) {
        if (!visited.has(u) && nodeSet.has(u)) {
          visited.add(u);
          queue.push(u);
        }
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);
  return {
    components,
    largestComponent: components[0] || [],
    lccSize: components.length ? components[0].length : 0,
  };
}

// ---- Force-directed layout (Fruchterman–Reingold) --------------------------

function forceLayout(n, edges, { iterations = 300, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const W = 1;
  const H = 1;
  const area = W * H;
  const k = Math.sqrt(area / n);
  // Initial random positions inside the unit square
  const pos = Array.from({ length: n }, () => ({
    x: rng() - 0.5,
    y: rng() - 0.5,
  }));
  const disp = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  let temperature = 0.15;
  const cooling = temperature / (iterations + 1);
  for (let it = 0; it < iterations; it++) {
    // Repulsion
    for (let i = 0; i < n; i++) disp[i].x = disp[i].y = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy + 1e-9;
        const d = Math.sqrt(d2);
        const f = (k * k) / d;
        const nx = dx / d;
        const ny = dy / d;
        disp[i].x += nx * f;
        disp[i].y += ny * f;
        disp[j].x -= nx * f;
        disp[j].y -= ny * f;
      }
    }
    // Attraction along edges
    for (const [a, b] of edges) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-9;
      const f = (d * d) / k;
      const nx = dx / d;
      const ny = dy / d;
      disp[a].x -= nx * f;
      disp[a].y -= ny * f;
      disp[b].x += nx * f;
      disp[b].y += ny * f;
    }
    // Apply with cooling and clamp
    for (let i = 0; i < n; i++) {
      const mag = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y);
      const step = Math.min(mag, temperature);
      if (mag > 0) {
        pos[i].x += (disp[i].x / mag) * step;
        pos[i].y += (disp[i].y / mag) * step;
      }
      // Clamp to unit square
      pos[i].x = Math.max(-0.5, Math.min(0.5, pos[i].x));
      pos[i].y = Math.max(-0.5, Math.min(0.5, pos[i].y));
    }
    temperature -= cooling;
  }
  return pos;
}

/** Fit a set of {x, y} in [-0.5, 0.5]^2 into a rectangular pixel region. */
function fitPositions(pos, x0, y0, w, h, margin = 20) {
  const availW = w - 2 * margin;
  const availH = h - 2 * margin;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  // Find current extent
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pos) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min(availW / spanX, availH / spanY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return pos.map(p => ({
    x: cx + (p.x - midX) * scale,
    y: cy + (p.y - midY) * scale,
  }));
}

// ---- Colour by degree ------------------------------------------------------

function heatColor(t) {
  // Deep purple → teal → gold. t in [0, 1].
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [0.00,  60,  40, 120],
    [0.35,  60, 130, 175],
    [0.70,  90, 190, 130],
    [1.00, 240, 190,  60],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, r0, g0, b0] = stops[i - 1];
      const [t1, r1, g1, b1] = stops[i];
      const u = (t - t0) / (t1 - t0);
      const r = Math.round(r0 + (r1 - r0) * u);
      const g = Math.round(g0 + (g1 - g0) * u);
      const b = Math.round(b0 + (b1 - b0) * u);
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(240,190,60)';
}

// ============================================================================
// Sim 1 · The rewiring switch
// ============================================================================

function initRewireSim() {
  const canvas = document.getElementById('sim-rewire');
  if (!canvas) return;
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  const mPath      = document.getElementById('rewire-path');
  const mClust     = document.getElementById('rewire-clust');
  const mShort     = document.getElementById('rewire-shortcuts');

  const N = 40;
  const K = 4;
  const CANVAS_H = 520;
  const SEED = 12345;   // Fixed seed so slider changes look deterministic

  // Precompute ring positions
  const ringPos = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return { x: Math.cos(a) * 0.4, y: Math.sin(a) * 0.4 };
  });

  let p = 0;
  let edges = [];
  let rewired = new Set();
  let stats = { path: 0, clust: 0 };
  let baselineStats = null;

  function recompute() {
    const r = watsStrogatzRewire(N, K, p, SEED);
    edges = r.edges;
    rewired = r.rewired;
    stats = {
      path:  meanShortestPath(N, edges),
      clust: meanClustering(N, edges),
    };
    if (!baselineStats) baselineStats = { ...stats };
  }
  recompute();

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);

    // Layout the ring inside the canvas
    const size = Math.min(W - 40, H - 40);
    const cx = W / 2;
    const cy = H / 2;
    const radius = size / 2 - 20;
    const nodePos = ringPos.map(p => ({
      x: cx + p.x * radius / 0.4,
      y: cy + p.y * radius / 0.4,
    }));

    // Draw edges — original (ring) first in muted, rewired in accent on top
    ctx.lineCap = 'round';
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      const isRewired = rewired.has(i);
      ctx.strokeStyle = isRewired ? P.accent : 'rgba(100,105,120,0.35)';
      ctx.lineWidth = isRewired ? 1.6 : 0.9;
      // For rewired edges (which cross the interior), draw as slightly curved
      if (isRewired) {
        ctx.beginPath();
        ctx.moveTo(nodePos[a].x, nodePos[a].y);
        // Curve through the interior
        const midX = (nodePos[a].x + nodePos[b].x) / 2 * 0.6 + cx * 0.4;
        const midY = (nodePos[a].y + nodePos[b].y) / 2 * 0.6 + cy * 0.4;
        ctx.quadraticCurveTo(midX, midY, nodePos[b].x, nodePos[b].y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(nodePos[a].x, nodePos[a].y);
        ctx.lineTo(nodePos[b].x, nodePos[b].y);
        ctx.stroke();
      }
    }

    // Draw nodes
    const nodeR = Math.max(5, size * 0.011);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = P.primary;
      ctx.beginPath();
      ctx.arc(nodePos[i].x, nodePos[i].y, nodeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Legend
    ctx.font = '12px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(100,105,120,0.9)';
    ctx.fillText('— neighbour edge', 20, H - 34);
    ctx.fillStyle = P.accent;
    ctx.fillText('— shortcut (rewired)', 20, H - 16);

    // Metrics
    setMetric(mPath, stats.path.toFixed(2),
              baselineStats && stats.path < 1e-9
                ? '—'
                : `baseline ${baselineStats.path.toFixed(2)}`);
    setMetric(mClust, stats.clust.toFixed(3),
              baselineStats
                ? `baseline ${baselineStats.clust.toFixed(3)}`
                : '—');
    setMetric(mShort, String(rewired.size),
              `${(100 * rewired.size / edges.length).toFixed(0)}% of edges`);
  }
  onResize(canvas, CANVAS_H, render);

  bindSlider(sliderRoot, v => {
    p = v / 100;
    recompute();
    render();
  }, v => (v / 100).toFixed(2));

  document.getElementById('rewire-preset-0').onclick = () => setSlider(0);
  document.getElementById('rewire-preset-small').onclick = () => setSlider(10);
  document.getElementById('rewire-preset-random').onclick = () => setSlider(100);

  function setSlider(v) {
    const inp = sliderRoot.querySelector('input[type="range"]');
    inp.value = v;
    p = v / 100;
    sliderRoot.querySelector('.value').textContent = (v / 100).toFixed(2);
    recompute();
    render();
  }

  render();
}

// ============================================================================
// Sim 2 · The friendship paradox
// ============================================================================

function initParadoxSim() {
  const canvas = document.getElementById('sim-paradox');
  if (!canvas) return;
  const btnPerson    = document.getElementById('fp-random-person');
  const btnFriend    = document.getElementById('fp-random-friend');
  const btnReset     = document.getElementById('fp-reset');
  const numPerson    = document.getElementById('fp-person-num');
  const hintPerson   = document.getElementById('fp-person-hint');
  const numFriend    = document.getElementById('fp-friend-num');
  const hintFriend   = document.getElementById('fp-friend-hint');

  const N = 60;
  const M = 2;
  const CANVAS_H = 520;

  // Build the BA network + layout once
  const edges = buildBA(N, M, 42);
  const adj = adjacencyList(N, edges);
  const degrees = adj.map(nbrs => nbrs.length);

  // Force layout — precompute
  let pos = forceLayout(N, edges, { iterations: 350, seed: 42 });

  // Sampling state
  const rng = makeRng(Math.floor(Math.random() * 1e6));
  const personSamples = [];
  const friendSamples = [];
  const highlight = { person: -1, friend: -1, kind: null, startTime: 0 };

  function samplePerson() {
    const v = Math.floor(rng() * N);
    personSamples.push(degrees[v]);
    highlight.person = v;
    highlight.friend = -1;
    highlight.kind = 'person';
    highlight.startTime = performance.now();
    updateReadouts();
  }
  function sampleFriend() {
    for (let tries = 0; tries < 50; tries++) {
      const p = Math.floor(rng() * N);
      if (degrees[p] === 0) continue;
      const f = adj[p][Math.floor(rng() * adj[p].length)];
      friendSamples.push(degrees[f]);
      highlight.person = p;
      highlight.friend = f;
      highlight.kind = 'friend';
      highlight.startTime = performance.now();
      break;
    }
    updateReadouts();
  }

  function updateReadouts() {
    if (personSamples.length === 0) {
      numPerson.textContent = '—';
      hintPerson.textContent = 'click "🎲 Random person" to sample';
    } else {
      const m = personSamples.reduce((a, b) => a + b, 0) / personSamples.length;
      numPerson.textContent = m.toFixed(2);
      hintPerson.textContent = `over ${personSamples.length} sample${personSamples.length === 1 ? '' : 's'}`;
    }
    if (friendSamples.length === 0) {
      numFriend.textContent = '—';
      hintFriend.textContent = 'click "👥 Random friend" to sample';
    } else {
      const m = friendSamples.reduce((a, b) => a + b, 0) / friendSamples.length;
      numFriend.textContent = m.toFixed(2);
      hintFriend.textContent = `over ${friendSamples.length} sample${friendSamples.length === 1 ? '' : 's'}`;
    }
  }

  btnPerson.onclick = samplePerson;
  btnFriend.onclick = sampleFriend;
  btnReset.onclick = () => {
    personSamples.length = 0;
    friendSamples.length = 0;
    highlight.person = -1; highlight.friend = -1; highlight.kind = null;
    updateReadouts();
  };

  let placed = null;
  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();
    if (!placed || placed.W !== W) {
      placed = { W, pos: fitPositions(pos, 0, 0, W, H, 30) };
    }
    const np = placed.pos;

    const maxDeg = Math.max(...degrees, 1);

    // Draw edges
    ctx.strokeStyle = 'rgba(100,105,120,0.25)';
    ctx.lineWidth = 0.8;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(np[a].x, np[a].y);
      ctx.lineTo(np[b].x, np[b].y);
      ctx.stroke();
    }

    // Highlight edges of the *sampled* node — the one whose degree was counted.
    // For "random person": that IS the person, so show their edges (blue).
    // For "random friend":  that's the FRIEND (a random neighbour of a random
    //   person), so show the friend's edges (orange). Draw a small dashed blue
    //   line from the person → friend to explain how we got there.
    if (highlight.person >= 0) {
      const age = now - highlight.startTime;
      const t = Math.min(1, age / 1600);
      const alpha = 1 - easeOut(t) * 0.7;

      if (highlight.kind === 'friend' && highlight.friend >= 0) {
        // Dashed "we started at the person and hopped to this friend" edge
        ctx.save();
        ctx.strokeStyle = `rgba(76,110,245,${alpha * 0.65})`;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(np[highlight.person].x, np[highlight.person].y);
        ctx.lineTo(np[highlight.friend].x, np[highlight.friend].y);
        ctx.stroke();
        ctx.restore();
        // The friend's actual neighbourhood — how many friends the sampled friend has
        ctx.strokeStyle = `rgba(247,103,7,${alpha})`;
        ctx.lineWidth = 2.5;
        for (const nb of adj[highlight.friend]) {
          ctx.beginPath();
          ctx.moveTo(np[highlight.friend].x, np[highlight.friend].y);
          ctx.lineTo(np[nb].x, np[nb].y);
          ctx.stroke();
        }
      } else {
        // "person" case — highlight the person's neighbourhood
        ctx.strokeStyle = `rgba(76,110,245,${alpha})`;
        ctx.lineWidth = 2.5;
        for (const nb of adj[highlight.person]) {
          ctx.beginPath();
          ctx.moveTo(np[highlight.person].x, np[highlight.person].y);
          ctx.lineTo(np[nb].x, np[nb].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (let i = 0; i < N; i++) {
      const d = degrees[i];
      const nr = 5 + 14 * (d / maxDeg);
      ctx.fillStyle = heatColor(d / maxDeg);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(np[i].x, np[i].y, nr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Highlight rings on the sampled nodes
    if (highlight.person >= 0) {
      const age = now - highlight.startTime;
      if (age < 1400) {
        const t = age / 1400;
        const grow = 1 + easeOut(t) * 1.2;
        const alpha = 1 - t;
        const ringR = (5 + 14 * (degrees[highlight.person] / maxDeg)) * grow;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = P.primary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(np[highlight.person].x, np[highlight.person].y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (highlight.friend >= 0) {
      const age = now - highlight.startTime;
      if (age < 1400) {
        const t = age / 1400;
        const grow = 1 + easeOut(t) * 1.5;
        const alpha = 1 - t;
        const ringR = (5 + 14 * (degrees[highlight.friend] / maxDeg)) * grow;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(np[highlight.friend].x, np[highlight.friend].y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Instruction / caption at the bottom
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    let caption = 'node size = degree · color = degree';
    if (highlight.person >= 0 && highlight.kind === 'person') {
      caption = `🎲 Person ${highlight.person} has ${degrees[highlight.person]} friend${degrees[highlight.person] === 1 ? '' : 's'}`;
    } else if (highlight.friend >= 0 && highlight.kind === 'friend') {
      caption = `👥 The sampled friend (person ${highlight.friend}) has ${degrees[highlight.friend]} friend${degrees[highlight.friend] === 1 ? '' : 's'}  ·  the random person was ${highlight.person}`;
    }
    ctx.fillText(caption, W / 2, H - 8);
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => { render(); return true; });
  loop.start();
  updateReadouts();
}

// ============================================================================
// Sim 3 · Attack the network
// ============================================================================

function initAttackSim() {
  const canvas = document.getElementById('sim-attack');
  if (!canvas) return;
  const playBtn  = document.getElementById('attack-play');
  const resetBtn = document.getElementById('attack-reset');
  const mNodes  = document.getElementById('attack-nodes');
  const mRandLcc = document.getElementById('attack-rand-lcc');
  const mTargLcc = document.getElementById('attack-targ-lcc');

  const N = 55;
  const M = 2;
  const CANVAS_H = 620;
  const STEP_MS = 220;

  let edges = [];
  let pos = [];
  let baselinePos = null;

  // Attack state — parallel for random & targeted
  let randRemoved = new Set();
  let targRemoved = new Set();
  let randSurvival = [];   // history of LCC / N (0..1)
  let targSurvival = [];
  let playing = false;
  let lastStep = 0;

  function newNetwork(seed = Math.floor(Math.random() * 1e6)) {
    edges = buildBA(N, M, seed);
    pos = forceLayout(N, edges, { iterations: 320, seed });
    baselinePos = null;   // force recompute on next render
    randRemoved = new Set();
    targRemoved = new Set();
    const alive = new Set(Array.from({ length: N }, (_, i) => i));
    randSurvival = [connectedComponents(N, edges, alive).lccSize / N];
    targSurvival = [connectedComponents(N, edges, alive).lccSize / N];
    playing = false;
    playBtn.textContent = '▶ Attack them both';
  }
  newNetwork(42);

  function stepRandom() {
    const alive = [];
    for (let i = 0; i < N; i++) if (!randRemoved.has(i)) alive.push(i);
    if (alive.length === 0) return false;
    const v = alive[Math.floor(Math.random() * alive.length)];
    randRemoved.add(v);
    const aliveSet = new Set(alive.filter(x => x !== v));
    randSurvival.push(connectedComponents(N, edges, aliveSet).lccSize / N);
    return true;
  }

  function stepTargeted() {
    const alive = [];
    for (let i = 0; i < N; i++) if (!targRemoved.has(i)) alive.push(i);
    if (alive.length === 0) return false;
    // Compute degrees in the surviving graph
    const aliveSet = new Set(alive);
    const adj = adjacencyList(N, edges, aliveSet);
    let best = alive[0];
    let bestDeg = -1;
    for (const v of alive) {
      if (adj[v].length > bestDeg) { bestDeg = adj[v].length; best = v; }
    }
    targRemoved.add(best);
    aliveSet.delete(best);
    targSurvival.push(connectedComponents(N, edges, aliveSet).lccSize / N);
    return true;
  }

  function stepBoth() {
    let done = true;
    if (randRemoved.size < N) { stepRandom(); done = false; }
    if (targRemoved.size < N) { stepTargeted(); done = false; }
    return !done;
  }

  playBtn.onclick = () => {
    if (playing) {
      playing = false;
      playBtn.textContent = '▶ Continue';
    } else if (randRemoved.size >= N && targRemoved.size >= N) {
      // Fully done — restart
      newNetwork();
      playing = true;
      playBtn.textContent = '⏸ Pause';
      lastStep = 0;
      loop.start();
    } else {
      playing = true;
      playBtn.textContent = '⏸ Pause';
      lastStep = 0;
      loop.start();
    }
  };
  resetBtn.onclick = () => {
    newNetwork();
  };

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);

    // Two side-by-side panels: top row for the networks
    const panelH = 380;
    const panelGap = 12;
    const panelW = (W - panelGap - 32) / 2;
    const leftX = 16;
    const rightX = 16 + panelW + panelGap;
    const panelY = 8;

    // Layout positions inside each panel
    if (!baselinePos || baselinePos.panelW !== panelW) {
      baselinePos = {
        panelW,
        left:  fitPositions(pos, leftX,  panelY, panelW, panelH, 24),
        right: fitPositions(pos, rightX, panelY, panelW, panelH, 24),
      };
    }

    // Panel backgrounds
    ctx.fillStyle = 'rgba(76,110,245,0.03)';
    ctx.fillRect(leftX,  panelY, panelW, panelH);
    ctx.fillStyle = 'rgba(224,49,49,0.03)';
    ctx.fillRect(rightX, panelY, panelW, panelH);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.strokeRect(leftX,  panelY + 0.5, panelW, panelH - 1);
    ctx.strokeRect(rightX, panelY + 0.5, panelW, panelH - 1);

    // Panel titles
    ctx.font = 'bold 14px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.primary;
    ctx.fillText(`🎲 Random failures`, leftX + 10, panelY + 8);
    ctx.fillStyle = P.danger;
    ctx.fillText(`🎯 Targeted attack`, rightX + 10, panelY + 8);

    const degrees = adjacencyList(N, edges).map(a => a.length);
    const maxDeg = Math.max(...degrees, 1);

    // Render each panel
    for (const panel of [
      { removed: randRemoved, positions: baselinePos.left,  liveColor: P.primary },
      { removed: targRemoved, positions: baselinePos.right, liveColor: P.danger },
    ]) {
      const np = panel.positions;
      // Edges — draw all in gray, but grayer if either endpoint removed
      for (const [a, b] of edges) {
        const removedEither = panel.removed.has(a) || panel.removed.has(b);
        ctx.strokeStyle = removedEither ? 'rgba(180,185,195,0.15)' : 'rgba(100,105,120,0.35)';
        ctx.lineWidth = removedEither ? 0.7 : 1;
        ctx.beginPath();
        ctx.moveTo(np[a].x, np[a].y);
        ctx.lineTo(np[b].x, np[b].y);
        ctx.stroke();
      }
      // Nodes
      for (let i = 0; i < N; i++) {
        const nr = 4 + 10 * (degrees[i] / maxDeg);
        if (panel.removed.has(i)) {
          ctx.fillStyle = 'rgba(180,185,195,0.35)';
        } else {
          ctx.fillStyle = heatColor(degrees[i] / maxDeg);
        }
        ctx.strokeStyle = panel.removed.has(i) ? 'rgba(255,255,255,0.5)' : 'white';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(np[i].x, np[i].y, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // LCC gauges under each panel
    const gY = panelY + panelH + 12;
    const gaugeH = 22;
    for (const [rec, name, isLeft, color] of [
      [randSurvival, 'largest cluster', true,  P.primary],
      [targSurvival, 'largest cluster', false, P.danger],
    ]) {
      const gx = isLeft ? leftX : rightX;
      const cur = rec.length > 0 ? rec[rec.length - 1] : 1;
      // Track
      ctx.fillStyle = P.line;
      const grx = gx;
      const gry = gY;
      const gw = panelW;
      // Rounded rect
      const r = gaugeH / 2;
      ctx.beginPath();
      ctx.moveTo(grx + r, gry);
      ctx.arcTo(grx + gw, gry, grx + gw, gry + gaugeH, r);
      ctx.arcTo(grx + gw, gry + gaugeH, grx, gry + gaugeH, r);
      ctx.arcTo(grx, gry + gaugeH, grx, gry, r);
      ctx.arcTo(grx, gry, grx + gw, gry, r);
      ctx.closePath();
      ctx.fill();
      // Fill
      ctx.fillStyle = color;
      const fw = Math.max(gaugeH, cur * gw);
      ctx.beginPath();
      ctx.moveTo(grx + r, gry);
      ctx.arcTo(grx + fw, gry, grx + fw, gry + gaugeH, r);
      ctx.arcTo(grx + fw, gry + gaugeH, grx, gry + gaugeH, r);
      ctx.arcTo(grx, gry + gaugeH, grx, gry, r);
      ctx.arcTo(grx, gry, grx + fw, gry, r);
      ctx.closePath();
      ctx.fill();
      // Label overlay
      ctx.font = 'bold 12px Inter,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(name, grx + 8, gry + gaugeH / 2 + 1);
      ctx.textAlign = 'right'; ctx.fillStyle = P.ink;
      ctx.fillText(`${(100 * cur).toFixed(0)}%`, grx + gw - 8, gry + gaugeH / 2 + 1);
    }

    // Overlay chart of LCC over time
    const chartY = gY + gaugeH + 20;
    const chartH = H - chartY - 12;
    const chartX = 32;
    const chartW = W - 48;
    if (chartH > 40) {
      // Axes
      ctx.strokeStyle = P.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX, chartY + chartH); ctx.lineTo(chartX + chartW, chartY + chartH);
      ctx.moveTo(chartX, chartY);          ctx.lineTo(chartX, chartY + chartH);
      ctx.stroke();
      // Grid — 50% mark
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.setLineDash([3, 3]);
      const halfY = chartY + chartH * 0.5;
      ctx.beginPath();
      ctx.moveTo(chartX, halfY); ctx.lineTo(chartX + chartW, halfY);
      ctx.stroke();
      ctx.setLineDash([]);
      // Curves
      function plot(series, color) {
        if (series.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < series.length; i++) {
          const px = chartX + (i / N) * chartW;
          const py = chartY + chartH - series[i] * chartH;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      plot(randSurvival, P.primary);
      plot(targSurvival, P.danger);
      // Labels
      ctx.font = '11px Inter,system-ui,sans-serif';
      ctx.fillStyle = P.muted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('largest cluster (% of original) vs nodes removed', chartX, chartY - 14);
      ctx.textAlign = 'right';
      ctx.fillText('50 %', chartX + chartW, halfY - 12);
      // Legend
      ctx.font = 'bold 12px Inter,system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = P.primary;
      ctx.fillText('— random', chartX + 10, chartY + chartH - 12);
      ctx.fillStyle = P.danger;
      ctx.fillText('— targeted', chartX + 90, chartY + chartH - 12);
    }

    // Update HTML metrics
    setMetric(mNodes, `${Math.max(randRemoved.size, targRemoved.size)} / ${N}`);
    setMetric(mRandLcc,
              `${(100 * (randSurvival[randSurvival.length - 1] ?? 1)).toFixed(0)}%`,
              `${randRemoved.size} removed`);
    setMetric(mTargLcc,
              `${(100 * (targSurvival[targSurvival.length - 1] ?? 1)).toFixed(0)}%`,
              `${targRemoved.size} removed`);
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    if (!playing) return false;
    const now = performance.now();
    if (now - lastStep >= STEP_MS) {
      const notDone = stepBoth();
      lastStep = now;
      if (!notDone) {
        playing = false;
        playBtn.textContent = '↺ Play again';
      }
    }
    render();
    return true;
  });

  render();
}

// ============================================================================
// Bootstrap
// ============================================================================

initRewireSim();
initParadoxSim();
initAttackSim();
