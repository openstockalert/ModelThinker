// Boids · Craig Reynolds' three rules, running live.
//
// Engine ported from the Murmuration Lab reference HTML, with colours
// re-wired to ModelThinker's CSS variables so it fits the rest of the
// site. The physics is unchanged: spatial-hash grid, 2D/3D with a
// painter's-algorithm depth sort, metric or topological neighbours,
// predator pointer, trails.

(() => {
"use strict";

const cv  = document.getElementById('boids-canvas');
const ctx = cv.getContext('2d', { alpha: false });
const $   = id => document.getElementById(id);
const TAU = Math.PI * 2;
const MAX = 1600;
const CAM = 1250;   // focal length for the perspective projection in 3D

// ---------------------------------------------------------------------------
// Theme colours — read from ModelThinker CSS variables so a theme change
// (if we ever add dark mode) automatically propagates to the canvas.
// ---------------------------------------------------------------------------
let C = {};
function readTheme() {
  const s = getComputedStyle(document.documentElement);
  const get = (name, fb) => (s.getPropertyValue(name).trim() || fb);
  C = {
    field:   get('--bg-soft', '#F5F7FC'),
    ink:     get('--ink',     '#1A1D29'),
    muted:   get('--muted',   '#6C7382'),
    accent:  get('--accent',  '#F76707'),   // orange — the main boid colour
    accent2: get('--primary', '#4C6EF5'),   // blue — highlight / mill state
    line:    get('--line',    '#E4E7EE'),
    warn:    get('--warn',    '#F59F00'),
    success: get('--success', '#37B24D'),
    danger:  get('--danger',  '#E03131'),
  };
}
readTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);

// ---------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------
const P = {
  // rule weights
  ws: 1, wa: 0.25, wc: 0.03,
  sepOn: true, aliOn: true, cohOn: true,
  // perception
  R: 50, Rsep: 10, view: 300, topo: false, k: 7,
  // flight
  n: 260, vmax: 3, fmax: 0.6,
  // world
  dim: 3, shape: 'bird', depth: 1,
};

let W = 800, H = 600, D = 600, paused = false, dpr = 1;
const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
const ph = new Float32Array(MAX);   // wing/tail beat phase per boid

function depthOf() { return P.dim === 3 ? Math.min(W, H) * 1.15 * P.depth : 0; }

// Seed as a loose, roughly-aligned flock so the first frame already reads
// as a group — not a chaotic scatter of random vectors.
function reset(scatter) {
  D = depthOf();
  const cx = W / 2, cy = H / 2, dir = Math.random() * TAU, pitch = (Math.random() - 0.5) * 0.5;
  for (let i = 0; i < P.n; i++) {
    ph[i] = Math.random() * TAU;
    if (scatter) {
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
      pz[i] = (Math.random() - 0.5) * D;
      const a = Math.random() * TAU, b = P.dim === 3 ? (Math.random() - 0.5) * 1.4 : 0;
      vx[i] = Math.cos(a) * Math.cos(b) * P.vmax;
      vy[i] = Math.sin(a) * Math.cos(b) * P.vmax;
      vz[i] = Math.sin(b) * P.vmax * (P.dim === 3 ? 1 : 0);
    } else {
      const r = Math.min(W, H) * 0.2 * Math.cbrt(Math.random());
      const t = Math.random() * TAU, u = (Math.random() - 0.5) * Math.PI;
      px[i] = cx + Math.cos(t) * r;
      py[i] = cy + Math.sin(t) * r * 0.72;
      pz[i] = P.dim === 3 ? Math.sin(u) * r * 0.9 : 0;
      const a = dir + (Math.random() - 0.5) * 1.1;
      const b = P.dim === 3 ? pitch + (Math.random() - 0.5) * 0.5 : 0;
      vx[i] = Math.cos(a) * Math.cos(b) * P.vmax;
      vy[i] = Math.sin(a) * Math.cos(b) * P.vmax;
      vz[i] = Math.sin(b) * P.vmax;
    }
    if (P.dim === 2) { pz[i] = 0; vz[i] = 0; }
  }
}

// ---------------------------------------------------------------------------
// Spatial hash: one linked list per cell (2-D or 3-D), cell = vision radius
// ---------------------------------------------------------------------------
let head = new Int32Array(1), nxt = new Int32Array(MAX);
let cols = 1, rows = 1, lays = 1, cell = 50;
function grid() {
  cell = Math.max(8, P.topo ? P.R : Math.max(P.R, P.Rsep));
  cols = Math.max(1, Math.ceil(W / cell));
  rows = Math.max(1, Math.ceil(H / cell));
  lays = P.dim === 3 ? Math.max(1, Math.ceil(D / cell)) : 1;
  const need = cols * rows * lays;
  if (head.length !== need) head = new Int32Array(need);
  head.fill(-1);
  for (let i = 0; i < P.n; i++) {
    let a = (px[i] / cell) | 0, b = (py[i] / cell) | 0;
    let c = P.dim === 3 ? (((pz[i] + D / 2) / cell) | 0) : 0;
    if (a < 0) a = 0; else if (a >= cols) a = cols - 1;
    if (b < 0) b = 0; else if (b >= rows) b = rows - 1;
    if (c < 0) c = 0; else if (c >= lays) c = lays - 1;
    const idx = (c * rows + b) * cols + a;
    nxt[i] = head[idx]; head[idx] = i;
  }
}

// scratch buffers for the topological-k nearest-neighbour sort
const kd = new Float32Array(32), ki = new Int32Array(32);

let pointer = null, nbrAvg = 0, hiNbrs = [];

// ---------------------------------------------------------------------------
// One simulation step — the three rules, then clipping, then integration
// ---------------------------------------------------------------------------
function stepSim() {
  grid();
  const three = P.dim === 3;
  const cosFov = Math.cos(P.view * Math.PI / 360);
  const R2 = P.R * P.R, S2 = P.Rsep * P.Rsep;
  const margin = Math.min(W, H) * 0.14, zmargin = D * 0.16;
  const turn = P.fmax * 0.8;
  const links = $('showvis').checked;
  if (links) hiNbrs = [];
  let nbrSum = 0;

  for (let i = 0; i < P.n; i++) {
    const x = px[i], y = py[i], z = pz[i];
    const ux = vx[i], uy = vy[i], uz = vz[i];
    const sp = Math.hypot(ux, uy, uz) || 1e-6;
    const hx = ux / sp, hy = uy / sp, hz = uz / sp;

    let sx = 0, sy = 0, sz = 0;     // separation
    let ax = 0, ay = 0, az = 0;     // alignment accumulator
    let cx2 = 0, cy2 = 0, cz2 = 0;  // cohesion accumulator
    let cnt = 0, kn = 0;

    const ci = (x / cell) | 0, cj = (y / cell) | 0;
    const ck = three ? (((z + D / 2) / cell) | 0) : 0;

    for (let kk = ck - (three ? 1 : 0); kk <= ck + (three ? 1 : 0); kk++) {
      if (kk < 0 || kk >= lays) continue;
      for (let jj = cj - 1; jj <= cj + 1; jj++) {
        if (jj < 0 || jj >= rows) continue;
        const rowbase = (kk * rows + jj) * cols;
        for (let ii = ci - 1; ii <= ci + 1; ii++) {
          if (ii < 0 || ii >= cols) continue;
          for (let j = head[rowbase + ii]; j !== -1; j = nxt[j]) {
            if (j === i) continue;
            const dx = px[j] - x, dy = py[j] - y, dz = three ? pz[j] - z : 0;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > R2 || d2 === 0) continue;
            const d = Math.sqrt(d2);
            // Field of view: cos(angle to neighbour) must exceed cos(FOV/2)
            if (P.view < 360 && (hx * dx + hy * dy + hz * dz) / d < cosFov) continue;

            if (P.topo) {
              // Insert into the k nearest-neighbours min-heap by d²
              let pos = kn;
              while (pos > 0 && kd[pos - 1] > d2) {
                if (pos < P.k) { kd[pos] = kd[pos - 1]; ki[pos] = ki[pos - 1]; }
                pos--;
              }
              if (pos < P.k) { kd[pos] = d2; ki[pos] = j; if (kn < P.k) kn++; }
            } else {
              cnt++;
              cx2 += dx; cy2 += dy; cz2 += dz;
              ax += vx[j]; ay += vy[j]; az += vz[j];
              if (d2 < S2) { sx -= dx / d2; sy -= dy / d2; sz -= dz / d2; }
              if (links && i === 0) hiNbrs.push(j);
            }
          }
        }
      }
    }
    if (P.topo) {
      for (let m = 0; m < kn; m++) {
        const j = ki[m];
        const dx = px[j] - x, dy = py[j] - y, dz = three ? pz[j] - z : 0;
        const d2 = kd[m];
        cnt++;
        cx2 += dx; cy2 += dy; cz2 += dz;
        ax += vx[j]; ay += vy[j]; az += vz[j];
        if (d2 < S2) { sx -= dx / d2; sy -= dy / d2; sz -= dz / d2; }
        if (links && i === 0) hiNbrs.push(j);
      }
    }
    nbrSum += cnt;

    let fx = 0, fy = 0, fz = 0;
    if (cnt > 0) {
      if (P.cohOn) { fx += P.wc * (cx2 / cnt);         fy += P.wc * (cy2 / cnt);         fz += P.wc * (cz2 / cnt); }
      if (P.aliOn) { fx += P.wa * (ax / cnt - ux);     fy += P.wa * (ay / cnt - uy);     fz += P.wa * (az / cnt - uz); }
      if (P.sepOn) { fx += P.ws * sx * P.Rsep;         fy += P.ws * sy * P.Rsep;         fz += P.ws * sz * P.Rsep; }
    }

    // Edge turnaround: a soft push away from each wall
    if (x < margin)         fx += turn; else if (x > W - margin) fx -= turn;
    if (y < margin)         fy += turn; else if (y > H - margin) fy -= turn;
    if (three) {
      if (z < -D / 2 + zmargin) fz += turn;
      else if (z > D / 2 - zmargin) fz -= turn;
    }

    // Predator: a column of fear through the box
    if (pointer) {
      const dx = x - pointer.x, dy = y - pointer.y, d = Math.hypot(dx, dy);
      if (d < 150 && d > 0.001) {
        const g = (1 - d / 150) * P.fmax * 7;
        fx += dx / d * g; fy += dy / d * g;
      }
    }

    // Clip the steering force
    const fm = Math.hypot(fx, fy, fz);
    if (fm > P.fmax) { const s = P.fmax / fm; fx *= s; fy *= s; fz *= s; }

    // Integrate; clip the speed; integrate position
    let nvx = ux + fx, nvy = uy + fy, nvz = three ? uz + fz : 0;
    const ns = Math.hypot(nvx, nvy, nvz) || 1e-6, lo = P.vmax * 0.5;
    if (ns > P.vmax)      { const s = P.vmax / ns; nvx *= s; nvy *= s; nvz *= s; }
    else if (ns < lo)     { const s = lo / ns;    nvx *= s; nvy *= s; nvz *= s; }
    vx[i] = nvx; vy[i] = nvy; vz[i] = nvz;
    px[i] = x + nvx; py[i] = y + nvy; pz[i] = three ? z + nvz : 0;

    if (px[i] < 0) px[i] = 0; else if (px[i] > W) px[i] = W;
    if (py[i] < 0) py[i] = 0; else if (py[i] > H) py[i] = H;
    if (three) {
      const h = D / 2;
      if (pz[i] < -h) pz[i] = -h; else if (pz[i] > h) pz[i] = h;
    }

    // Wing/tail beat phase — faster when the boid is moving faster
    ph[i] = (ph[i] + 0.22 + 0.16 * (ns / P.vmax)) % TAU;
  }

  nbrAvg = nbrSum / P.n;
}

// ---------------------------------------------------------------------------
// Diagnostics — the four numbers that tell you which regime you're in
// ---------------------------------------------------------------------------
let pol = 0, rot = 0, nnd = 0, fps = 0;

function measure() {
  const three = P.dim === 3;
  // Polarization: how aligned the flock's unit-heading vectors are
  let mx = 0, my = 0, mz = 0, gx = 0, gy = 0, gz = 0;
  for (let i = 0; i < P.n; i++) {
    const s = Math.hypot(vx[i], vy[i], vz[i]) || 1e-6;
    mx += vx[i] / s; my += vy[i] / s; mz += vz[i] / s;
    gx += px[i]; gy += py[i]; gz += pz[i];
  }
  pol = Math.hypot(mx, my, mz) / P.n;
  gx /= P.n; gy /= P.n; gz /= P.n;

  // Rotation: average unit angular momentum around the group centre
  let lx = 0, ly = 0, lz = 0;
  for (let i = 0; i < P.n; i++) {
    const rx = px[i] - gx, ry = py[i] - gy, rz = three ? pz[i] - gz : 0;
    const rl = Math.hypot(rx, ry, rz) || 1e-6;
    const s = Math.hypot(vx[i], vy[i], vz[i]) || 1e-6;
    const ex = rx / rl, ey = ry / rl, ez = rz / rl;
    const wx = vx[i] / s, wy = vy[i] / s, wz = vz[i] / s;
    lx += ey * wz - ez * wy; ly += ez * wx - ex * wz; lz += ex * wy - ey * wx;
  }
  rot = Math.hypot(lx, ly, lz) / P.n;

  // Nearest-neighbour distance: subsampled for speed
  const stride = Math.max(1, (P.n / 140) | 0);
  let acc = 0, cnt = 0;
  for (let i = 0; i < P.n; i += stride) {
    let best = 1e9;
    const ci = (px[i] / cell) | 0, cj = (py[i] / cell) | 0;
    const ck = three ? (((pz[i] + D / 2) / cell) | 0) : 0;
    for (let kk = ck - (three ? 1 : 0); kk <= ck + (three ? 1 : 0); kk++) {
      if (kk < 0 || kk >= lays) continue;
      for (let jj = cj - 1; jj <= cj + 1; jj++) {
        if (jj < 0 || jj >= rows) continue;
        const rb = (kk * rows + jj) * cols;
        for (let ii = ci - 1; ii <= ci + 1; ii++) {
          if (ii < 0 || ii >= cols) continue;
          for (let j = head[rb + ii]; j !== -1; j = nxt[j]) {
            if (j === i) continue;
            const dx = px[j] - px[i], dy = py[j] - py[i];
            const dz = three ? pz[j] - pz[i] : 0;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < best) best = d2;
          }
        }
      }
    }
    if (best < 1e9) { acc += Math.sqrt(best); cnt++; }
  }
  nnd = cnt ? acc / cnt : 0;
}

function regime() {
  if (nnd > 0 && nnd < Math.max(1.4, P.Rsep * 0.18) && pol > 0.6) return ['collapsed to a point', C.danger];
  if (pol > 0.82) return ['polarized flock', C.accent];
  if (rot > 0.42) return ['mill / torus',    C.accent2];
  if (nbrAvg < 1.2) return ['fragmented',    C.warn];
  return ['disordered swarm', C.muted];
}

// ---------------------------------------------------------------------------
// Drawing — painter's algorithm in 3-D via a coarse depth bucket sort
// ---------------------------------------------------------------------------
const order = new Int32Array(MAX);
const NB = 96, bHead = new Int32Array(NB), bNext = new Int32Array(MAX);
function depthOrder() {
  bHead.fill(-1);
  const h = D / 2 || 1;
  for (let i = 0; i < P.n; i++) {
    let b = (((pz[i] + h) / (D || 1)) * NB) | 0;
    if (b < 0) b = 0; else if (b >= NB) b = NB - 1;
    bNext[i] = bHead[b]; bHead[b] = i;
  }
  let o = 0;
  for (let b = NB - 1; b >= 0; b--)
    for (let i = bHead[b]; i !== -1; i = bNext[i]) order[o++] = i;    // far first
  return o;
}

// Each creature is drawn in its own rotated frame: +x forward, +y across the body.
function wing(g, L, a, sgn) {
  g.beginPath();
  g.moveTo(-L * 0.05, 0);
  g.quadraticCurveTo(L * 0.22, sgn * a * 0.42, -L * 0.45, sgn * a);
  g.quadraticCurveTo(-L * 0.2, sgn * a * 0.34, -L * 0.1, 0);
  g.closePath(); g.fill();
}
function bird(g, L, span, beat) {
  const a = span * (0.26 + 0.74 * Math.abs(Math.sin(beat)));
  g.beginPath();                                   // body + tail
  g.moveTo(L * 1.0, 0);
  g.quadraticCurveTo(0,  span * 0.13, -L * 1.15, 0);
  g.quadraticCurveTo(0, -span * 0.13,  L * 1.0, 0);
  g.fill();
  wing(g, L, a, 1); wing(g, L, a, -1);
}
function fish(g, L, span, beat) {
  const w = span * 0.52, sway = Math.sin(beat) * span * 0.5;
  g.beginPath();                                   // body
  g.moveTo(L * 1.05, 0);
  g.quadraticCurveTo(L * 0.1,  w, -L * 0.75,  w * 0.42);
  g.quadraticCurveTo(-L * 0.9, 0, -L * 0.75, -w * 0.42);
  g.quadraticCurveTo(L * 0.1, -w,  L * 1.05, 0);
  g.fill();
  g.beginPath();                                   // tail fin, beating
  g.moveTo(-L * 0.7, 0);
  g.lineTo(-L * 1.5, sway + w * 0.95);
  g.lineTo(-L * 1.25, sway * 0.5);
  g.lineTo(-L * 1.5, sway - w * 0.95);
  g.closePath(); g.fill();
}

function draw() {
  if ($('trails').checked) {
    ctx.globalAlpha = 0.22; ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);
  }
  const three = P.dim === 3;
  const tint = $('speedtint').checked, showVis = $('showvis').checked;
  const cx = W / 2, cy = H / 2;
  const count = three ? depthOrder() : P.n;
  if (!three) for (let i = 0; i < P.n; i++) order[i] = i;
  const base = P.shape === 'bird' ? 5.4 : 4.6;
  const span = P.shape === 'bird' ? 7.6 : 5.2;

  if (showVis && P.n > 0) {
    const s0 = three ? CAM / (CAM + pz[0] + D / 2) : 1;
    const X0 = three ? cx + (px[0] - cx) * s0 : px[0];
    const Y0 = three ? cy + (py[0] - cy) * s0 : py[0];
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X0, Y0, P.R * s0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = C.accent2; ctx.globalAlpha = 0.5; ctx.beginPath();
    for (const j of hiNbrs) {
      const s = three ? CAM / (CAM + pz[j] + D / 2) : 1;
      ctx.moveTo(X0, Y0);
      ctx.lineTo(three ? cx + (px[j] - cx) * s : px[j], three ? cy + (py[j] - cy) * s : py[j]);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  for (let q = 0; q < count; q++) {
    const i = order[q];
    const s = three ? CAM / (CAM + pz[i] + D / 2) : 1;
    const X = three ? cx + (px[i] - cx) * s : px[i];
    const Y = three ? cy + (py[i] - cy) * s : py[i];
    const sp = Math.hypot(vx[i], vy[i], vz[i]) || 1e-6;
    const hx = vx[i] / sp, hy = vy[i] / sp, hz = three ? vz[i] / sp : 0;
    const fore = Math.max(0.3, Math.sqrt(Math.max(0.0001, 1 - hz * hz)));
    const L = base * s * fore, SPAN = span * s * (0.55 + 0.45 * fore);
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(Math.atan2(hy, hx));
    ctx.fillStyle = (i === 0 && showVis) ? C.accent2 : C.accent;
    const depthFade = three ? 1 - 0.62 * ((pz[i] + D / 2) / (D || 1)) : 1;
    ctx.globalAlpha = tint ? Math.min(1, (0.5 + 0.5 * Math.min(1, sp / P.vmax)) * (three ? depthFade : 1)) : 0.92;
    if (P.shape === 'bird') bird(ctx, L, SPAN, ph[i]);
    else fish(ctx, L, SPAN, ph[i] * 0.75);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (pointer) {
    ctx.strokeStyle = C.warn; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 13, 0, TAU); ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now(), accT = 0, fpsT = last, frames = 0, mTick = 0;
function frame(now) {
  const dt = Math.min(100, now - last); last = now; frames++;
  if (now - fpsT > 500) { fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  if (!paused) {
    accT += dt;
    let steps = 0;
    while (accT >= 16.667 && steps < 3) { stepSim(); accT -= 16.667; steps++; }
  }
  if ((mTick++ % 6) === 0) { measure(); paintMetrics(); }
  draw();
  requestAnimationFrame(frame);
}
function paintMetrics() {
  $('m-pol').textContent = pol.toFixed(2);
  $('m-rot').textContent = rot.toFixed(2);
  $('m-nnd').textContent = nnd.toFixed(1);
  $('m-fps').textContent = `${P.n} boids · ${fps} fps`;
  const [t, c] = regime();
  const el = $('m-state'); el.textContent = t; el.style.color = c;
}

// ---------------------------------------------------------------------------
// Canvas sizing — observe the canvas itself (its CSS gives it a fixed height)
// ---------------------------------------------------------------------------
function resize() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(200, Math.round(r.width));
  H = Math.max(200, Math.round(r.height));
  cv.width  = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  D = depthOf();
  for (let i = 0; i < P.n; i++) {
    px[i] = Math.min(px[i], W); py[i] = Math.min(py[i], H);
  }
  ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);
}
new ResizeObserver(resize).observe(cv);

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const link = (id, key, fmt, valId) => {
  const el = $(id), out = valId ? $(valId) : null;
  const apply = () => { P[key] = parseFloat(el.value); if (out) out.textContent = fmt(P[key]); };
  el.addEventListener('input', apply); apply();
};
link('w-sep',  'ws',   v => v.toFixed(2),         'v-sep');
link('w-ali',  'wa',   v => v.toFixed(2),         'v-ali');
link('w-coh',  'wc',   v => v.toFixed(3),         'v-coh');
link('r-vis',  'R',    v => v.toFixed(0),         'v-vis');
link('r-sep',  'Rsep', v => v.toFixed(0),         'v-rsep');
link('r-view', 'view', v => v.toFixed(0) + '°',   'v-view');
link('r-spd',  'vmax', v => v.toFixed(1),         'v-spd');
link('r-force','fmax', v => v.toFixed(2),         'v-force');
link('r-k',    'k',    v => v.toFixed(0),         'v-k');

$('r-depth').addEventListener('input', e => {
  P.depth = parseFloat(e.target.value);
  $('v-depth').textContent = P.depth.toFixed(1);
  D = depthOf();
});
$('r-n').addEventListener('input', e => {
  const old = P.n;
  P.n = parseInt(e.target.value, 10);
  $('v-n').textContent = P.n;
  // When growing the flock, seed new boids near existing ones so the flock
  // doesn't suddenly include birds flying in a wildly different direction.
  if (P.n > old) {
    for (let i = old; i < P.n; i++) {
      const j = (Math.random() * old) | 0;
      px[i] = px[j] + (Math.random() - 0.5) * 20;
      py[i] = py[j] + (Math.random() - 0.5) * 20;
      pz[i] = pz[j] + (Math.random() - 0.5) * 20;
      vx[i] = vx[j]; vy[i] = vy[j]; vz[i] = vz[j];
      ph[i] = Math.random() * TAU;
    }
  }
});
$('v-n').textContent = P.n;

for (const [id, key] of [['on-sep', 'sepOn'], ['on-ali', 'aliOn'], ['on-coh', 'cohOn']]) {
  $(id).addEventListener('change', e => { P[key] = e.target.checked; });
}
$('topo').addEventListener('change', e => {
  P.topo = e.target.checked;
  $('kwrap').hidden = !P.topo;
});
$('pause').addEventListener('click', e => {
  paused = !paused;
  e.target.setAttribute('aria-pressed', String(paused));
  e.target.textContent = paused ? '▶ Resume' : '⏸ Pause';
});
$('reset').addEventListener('click', () => reset(false));
$('scatter').addEventListener('click', () => reset(true));

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); $('pause').click(); }
  if (e.key === 'r' || e.key === 'R') reset(false);
});

const toPt = e => {
  const r = cv.getBoundingClientRect();
  pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
};
cv.addEventListener('pointerdown',  e => { cv.setPointerCapture(e.pointerId); toPt(e); });
cv.addEventListener('pointermove',  e => { if (pointer) toPt(e); });
cv.addEventListener('pointerup',    () => { pointer = null; });
cv.addEventListener('pointercancel',() => { pointer = null; });

// ---------------------------------------------------------------------------
// Chip groups (dim toggle, shape toggle, presets)
// ---------------------------------------------------------------------------
function chipGroup(host, items, active, onPick) {
  host.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'chip-btn';
    b.textContent = it.label;
    b.setAttribute('aria-pressed', String(it.id === active));
    b.addEventListener('click', () => {
      [...host.children].forEach(c => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      onPick(it.id);
    });
    host.appendChild(b);
  });
}
chipGroup($('dims'), [{id: 2, label: '2D'}, {id: 3, label: '3D'}], P.dim, id => {
  P.dim = id;
  $('depthwrap').hidden = id !== 3;
  D = depthOf();
  reset(false);
});
chipGroup($('shapes'), [{id: 'bird', label: 'Birds'}, {id: 'fish', label: 'Fish'}], P.shape, id => { P.shape = id; });
$('depthwrap').hidden = P.dim !== 3;

// ---------------------------------------------------------------------------
// Regimes — each a measured parameter set with a one-sentence lesson
// ---------------------------------------------------------------------------
const PRESETS = [
  { name: 'Flock',
    why: 'The canonical setting. Polarization settles near 1.0 and spacing stabilises at a few body lengths — even though nothing in the rules names a target spacing.',
    s: { ws:1, wa:0.25, wc:0.03,  R:50,  Rsep:10, view:300, vmax:3,   fmax:0.6,  topo:false, sepOn:1, aliOn:1, cohOn:1 } },
  { name: 'Swarm',
    why: 'Strong cohesion, weak alignment. A dense cloud that mills about and travels nowhere — polarization crashes to ~0.15 while the group stays tight.',
    s: { ws:1, wa:0.08, wc:0.09,  R:50,  Rsep:10, view:300, vmax:3,   fmax:0.6,  topo:false, sepOn:1, aliOn:1, cohOn:1 } },
  { name: 'Mill',
    why: 'Wide turning circle plus firm cohesion: the flock closes into a rotating torus around an empty centre. Watch the rotation number. Real fish and army ants do this.',
    s: { ws:0.8, wa:0.2, wc:0.02, R:70,  Rsep:8,  view:300, vmax:3.6, fmax:0.18, topo:false, sepOn:1, aliOn:1, cohOn:1 } },
  { name: 'No separation',
    why: 'Alignment + cohesion only. Every boid converges on the same point — perfectly aligned, zero spacing, utterly unphysical.',
    s: { ws:0, wa:0.25, wc:0.03,  R:50,  Rsep:10, view:300, vmax:3,   fmax:0.6,  topo:false, sepOn:0, aliOn:1, cohOn:1 } },
  { name: 'No alignment',
    why: 'Spacing stays reasonable but no shared heading ever appears, and the group fractures into drifting sub-flocks.',
    s: { ws:1, wa:0,    wc:0.03,  R:50,  Rsep:10, view:300, vmax:3,   fmax:0.6,  topo:false, sepOn:1, aliOn:0, cohOn:1 } },
  { name: 'No cohesion',
    why: 'Aligned but slowly inflating: nothing pulls the edges back, so the flock thins out until neighbours fall out of sight.',
    s: { ws:1, wa:0.25, wc:0,     R:50,  Rsep:10, view:300, vmax:3,   fmax:0.6,  topo:false, sepOn:1, aliOn:1, cohOn:0 } },
  { name: 'Starling',
    why: 'Each boid tracks its 7 nearest neighbours instead of a fixed radius — the 2008 Rome result. Cohesion survives changes in density.',
    s: { ws:1, wa:0.3,  wc:0.04,  R:140, Rsep:11, view:340, vmax:3.2, fmax:0.6,  topo:true,  k:7, sepOn:1, aliOn:1, cohOn:1 } },
  { name: 'Tunnel vision',
    why: 'A 100-degree field of view. Boids cannot see what is beside or behind them, so the flock stretches into restless lines and strings.',
    s: { ws:1, wa:0.3,  wc:0.04,  R:60,  Rsep:10, view:100, vmax:3,   fmax:0.6,  topo:false, sepOn:1, aliOn:1, cohOn:1 } },
];
const chips = $('boids-presets');
PRESETS.forEach((p, idx) => {
  const b = document.createElement('button');
  b.className = 'chip-btn';
  b.textContent = p.name;
  b.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
  b.addEventListener('click', () => {
    [...chips.children].forEach(c => c.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    $('boids-why').textContent = p.why;
    const s = p.s;
    $('w-sep').value = s.ws;  $('w-ali').value = s.wa;  $('w-coh').value = s.wc;
    $('r-vis').value = s.R;   $('r-sep').value = s.Rsep; $('r-view').value = s.view;
    $('r-spd').value = s.vmax; $('r-force').value = s.fmax;
    if (s.k) $('r-k').value = s.k;
    $('on-sep').checked = !!s.sepOn; $('on-ali').checked = !!s.aliOn; $('on-coh').checked = !!s.cohOn;
    $('topo').checked = !!s.topo;    $('kwrap').hidden = !s.topo;
    for (const el of ['w-sep','w-ali','w-coh','r-vis','r-sep','r-view','r-spd','r-force','r-k'])
      $(el).dispatchEvent(new Event('input'));
    P.sepOn = !!s.sepOn; P.aliOn = !!s.aliOn; P.cohOn = !!s.cohOn; P.topo = !!s.topo;
    reset(false);
  });
  chips.appendChild(b);
});
$('boids-why').textContent = PRESETS[0].why;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
resize(); reset(false); grid(); measure(); paintMetrics();
requestAnimationFrame(frame);

})();
