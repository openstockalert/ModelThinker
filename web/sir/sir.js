// SIR story — three sims: agent grid outbreak, herd-immunity, ODE curves.

import { easeOut, fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric, shuffle } from '../shared/ui.js';

const P = { S: '#4C6EF5', I: '#E03131', R: '#37B24D', muted: '#868E96', line: '#E9ECEF', ink: '#212529' };

// Each agent state has a distinctive face + a soft coloured halo.
//   🙂  Susceptible — calm, healthy, hasn't met it yet
//   🤢  Infectious  — the classic *green* nauseated face; reads as "sick" instantly
//   😎  Recovered   — immune, "beat it", visually a world apart from the other two
const EMOJI = { 0: '🙂', 1: '🤢', 2: '😎' };
const HALO  = { 0: '#DBE4FF', 1: '#FFE0E0', 2: '#D3F9D8' };

// Sim 1 & 2 dynamics knobs.
const N_AGENTS    = 144;   // smaller crowd → bigger, personal faces
const DAY_INTERVAL = 260;  // ms per day tick; ~4 days per second, easy to follow
const PULSE_MS    = 480;   // how long the "just changed state" glow lasts

// ---------- Agent grid outbreak ---------------------------------------------
// Discrete agent-based SIR on a small grid, mostly for visual fun.
// Each infected agent transmits to a random susceptible with probability
// p_tx per day (calibrated so mean-field ≈ chosen R0).

function makeAgents({ N, seed, immuneFrac = 0 }) {
  const rng = makeRng(seed);
  const arr = new Int8Array(N).fill(0);  // 0 = S
  const nImmune = Math.round(N * immuneFrac);
  for (let i = 0; i < nImmune; i++) arr[i] = 2;  // R (pre-vaccinated)
  arr[N - 1] = 1;  // one infectious (patient zero) at the end so shuffle spreads it
  const idx = Array.from({ length: N }, (_, i) => i);
  shuffle(idx, rng);
  const shuffled = new Int8Array(N);
  for (let i = 0; i < N; i++) shuffled[i] = arr[idx[i]];
  return { arr: shuffled, rng };
}

function stepAgents(state, { R0, gamma = 0.1 }) {
  // Advance one day. Returns the set of indices whose state just changed,
  // so the renderer can animate a soft pulse on them.
  const { arr, rng } = state;
  const N = arr.length;
  const nextRecover = [];
  const nextInfect  = [];
  const contactsPerDay = R0;
  const pInfect = 1 - Math.exp(-contactsPerDay * gamma);
  for (let i = 0; i < N; i++) {
    if (arr[i] !== 1) continue;
    if (rng() < gamma) nextRecover.push(i);
    else if (rng() < pInfect) {
      const target = Math.floor(rng() * N);
      if (arr[target] === 0) nextInfect.push(target);
    }
  }
  for (const i of nextRecover) arr[i] = 2;
  for (const i of nextInfect)  arr[i] = 1;
  return {
    S: countState(arr, 0), I: countState(arr, 1), R: countState(arr, 2),
    newlyInfected: nextInfect, newlyRecovered: nextRecover,
  };
}
function countState(arr, s) { let c = 0; for (let i = 0; i < arr.length; i++) if (arr[i] === s) c++; return c; }

/**
 * Compute the grid layout for a given N and canvas size.
 * Returned so callers can identify which cell an index lives in for animations.
 */
function agentLayout(N, W, H) {
  const cols = Math.ceil(Math.sqrt(N * W / H));
  const rows = Math.ceil(N / cols);
  const s = Math.min(W / cols, H / rows);
  const offX = (W - s * cols) / 2;
  const offY = (H - s * rows) / 2;
  return { cols, rows, s, offX, offY };
}

/**
 * Draw the crowd. `pulses` is a Map of agentIdx → { kind: 'infect'|'recover', startTime }
 * for cells that just changed state; we animate a growing/fading halo on them.
 */
function drawAgents(canvas, state, cssH = 340, pulses = null) {
  const { ctx, width: W, height: H } = fitCanvas(canvas, cssH);
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
  const N = state.arr.length;
  const { cols, s, offX, offY } = agentLayout(N, W, H);
  const halo = s * 0.44;
  const fontPx = Math.max(10, s * 0.72);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;

  const now = performance.now();
  for (let i = 0; i < N; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = offX + (col + 0.5) * s;
    const cy = offY + (row + 0.5) * s;
    const v = state.arr[i];

    // Soft coloured background halo — the state colour bleeds through even at a glance.
    ctx.fillStyle = HALO[v];
    ctx.beginPath(); ctx.arc(cx, cy, halo, 0, Math.PI * 2); ctx.fill();

    // Just-changed pulse: ring expands from the halo and fades.
    if (pulses) {
      const p = pulses.get(i);
      if (p && now - p.startTime < PULSE_MS) {
        const t = (now - p.startTime) / PULSE_MS;
        const eased = easeOut(t);
        const radius = halo + eased * halo * 0.65;
        ctx.save();
        ctx.globalAlpha = 1 - eased;
        ctx.strokeStyle = p.kind === 'infect' ? P.I : P.R;
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    // Emoji face on top.
    ctx.fillText(EMOJI[v], cx, cy + fontPx * 0.03);
  }
}

// ---------- Sim 1: R₀ dial + outbreak animation -----------------------------

function initSim1() {
  const canvas = document.getElementById('sim1');
  const playBtn = document.getElementById('sim1-play');
  const resetBtn = document.getElementById('sim1-reset');
  const mDay = document.getElementById('sim1-day');
  const mInf = document.getElementById('sim1-inf');
  const mRec = document.getElementById('sim1-rec');
  const mPeak = document.getElementById('sim1-peak');

  const CANVAS_H = 340;
  const N = N_AGENTS;
  let R0 = 2.5;
  // Random seed so the first click doesn't hit a deterministic dud where
  // patient zero happens to recover on day 1 without infecting anyone.
  let state = makeAgents({ N, seed: Math.floor(Math.random() * 100000) });
  let day = 0, peakI = 0, peakDay = 0;
  let pulses = new Map();       // idx → { kind, startTime }
  let lastTick = 0;             // ms timestamp of last "day advance"

  function render() {
    drawAgents(canvas, state, CANVAS_H, pulses);
    const counts = { S: countState(state.arr, 0), I: countState(state.arr, 1), R: countState(state.arr, 2) };
    setMetric(mDay, String(day));
    setMetric(mInf, `${(100 * counts.I / N).toFixed(1)}%`);
    setMetric(mRec, `${(100 * counts.R / N).toFixed(1)}%`);
    if (counts.I > peakI) { peakI = counts.I; peakDay = day; }
    setMetric(mPeak, peakDay > 0 ? `day ${peakDay}` : '—');
  }

  function advanceDay(now) {
    const t = stepAgents(state, { R0, gamma: 0.1 });
    day++;
    for (const i of t.newlyInfected)  pulses.set(i, { kind: 'infect',  startTime: now });
    for (const i of t.newlyRecovered) pulses.set(i, { kind: 'recover', startTime: now });
  }

  const loop = makeLoop(() => {
    const now = performance.now();
    if (now - lastTick >= DAY_INTERVAL) {
      advanceDay(now);
      lastTick = now;
    }
    // prune expired pulses
    for (const [idx, p] of pulses) if (now - p.startTime > PULSE_MS) pulses.delete(idx);
    render();
    if (countState(state.arr, 1) === 0) {
      // Fizzle guard: if patient zero recovered within a day or two without
      // infecting anyone, silently reroll and keep running. This is a real
      // stochastic outcome (~10% at R0=2.5) but a terrible first-click UX,
      // and the reset button is right there for anyone who wants a rerun.
      if (day <= 2 && countState(state.arr, 2) === 1) {
        state = makeAgents({ N, seed: Math.floor(Math.random() * 100000) });
        day = 0; peakI = 0; peakDay = 0; pulses.clear();
        lastTick = now;
        return true;
      }
      playBtn.textContent = '▶ Release patient zero';
      return false;
    }
    if (day > 500) return false;
  });

  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  bindSlider(sliderRoot, v => { R0 = v; render(); }, v => v.toFixed(1));

  onResize(canvas, CANVAS_H, render);
  render();

  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Release patient zero'; }
    else { lastTick = performance.now() - DAY_INTERVAL; loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', () => {
    loop.stop(); playBtn.textContent = '▶ Release patient zero';
    state = makeAgents({ N, seed: Math.floor(Math.random() * 100000) });
    day = 0; peakI = 0; peakDay = 0; pulses.clear(); render();
  });
}

// ---------- Sim 2: Pre-vaccination + herd immunity --------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const playBtn = document.getElementById('sim2-play');
  const resetBtn = document.getElementById('sim2-reset');
  const mThresh = document.getElementById('sim2-thresh');
  const mFinal = document.getElementById('sim2-final');

  const CANVAS_H = 320;
  const N = N_AGENTS;
  let R0 = 3.0, vFrac = 0.5;
  let state = makeAgents({ N, seed: Math.floor(Math.random() * 100000), immuneFrac: vFrac });
  let day = 0;
  let pulses = new Map();
  let lastTick = 0;

  function updateThresh() {
    const t = Math.max(0, 1 - 1 / R0);
    setMetric(mThresh, `${(100 * t).toFixed(0)}%`);
  }
  function render() {
    drawAgents(canvas, state, CANVAS_H, pulses);
    const counts = { S: countState(state.arr, 0), I: countState(state.arr, 1), R: countState(state.arr, 2) };
    const initialS = N - Math.round(N * vFrac) - 1;
    const infected = counts.R - Math.round(N * vFrac);
    setMetric(mFinal, initialS > 0 ? `${(100 * infected / initialS).toFixed(1)}%` : '—');
    updateThresh();
  }

  function advanceDay(now) {
    const t = stepAgents(state, { R0, gamma: 0.1 });
    day++;
    for (const i of t.newlyInfected)  pulses.set(i, { kind: 'infect',  startTime: now });
    for (const i of t.newlyRecovered) pulses.set(i, { kind: 'recover', startTime: now });
  }

  const loop = makeLoop(() => {
    const now = performance.now();
    if (now - lastTick >= DAY_INTERVAL) {
      advanceDay(now);
      lastTick = now;
    }
    for (const [idx, p] of pulses) if (now - p.startTime > PULSE_MS) pulses.delete(idx);
    render();
    if (countState(state.arr, 1) === 0) {
      // Fizzle guard (see sim1) — reroll only if the outbreak died before
      // spreading beyond patient zero. Existing pre-vaccinated recoveries
      // don't count against the "only patient zero recovered" test.
      const preVax = Math.round(N * vFrac);
      if (day <= 2 && countState(state.arr, 2) - preVax === 1) {
        state = makeAgents({ N, seed: Math.floor(Math.random() * 100000), immuneFrac: vFrac });
        day = 0; pulses.clear();
        lastTick = now;
        return true;
      }
      playBtn.textContent = '▶ Start outbreak';
      return false;
    }
    if (day > 500) return false;
  });

  function resetPopulation() {
    loop.stop(); playBtn.textContent = '▶ Start outbreak';
    state = makeAgents({ N, seed: Math.floor(Math.random() * 100000), immuneFrac: vFrac });
    day = 0; pulses.clear(); render();
  }

  const controls = canvas.parentElement.querySelectorAll('.slider-block');
  bindSlider(controls[0], v => { R0 = v; updateThresh(); }, v => v.toFixed(1));
  bindSlider(controls[1], v => { vFrac = v / 100; resetPopulation(); });

  onResize(canvas, CANVAS_H, render);
  render();

  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Start outbreak'; }
    else { lastTick = performance.now() - DAY_INTERVAL; loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', resetPopulation);
}

// ---------- Sim 3: ODE integration + curves ---------------------------------

function initSim3() {
  const canvas = document.getElementById('sim3');
  const mR0 = document.getElementById('sim3-r0');
  const mPeak = document.getElementById('sim3-peak');
  const mFinal = document.getElementById('sim3-final');
  const controls = canvas.parentElement.querySelectorAll('.slider-block');

  let beta = 0.30, gamma = 0.10;
  bindSlider(controls[0], v => { beta = v; render(); }, v => v.toFixed(2));
  bindSlider(controls[1], v => { gamma = v; render(); }, v => v.toFixed(2));

  function integrate() {
    // RK4 on S,I,R normalized (S+I+R=1)
    const days = 180;
    const dt = 0.5;
    let S = 0.9999, I = 0.0001, R = 0;
    const ts = [0], Ss = [S], Is = [I], Rs = [R];
    for (let step = 1; step * dt <= days; step++) {
      const f = (S, I) => [-beta * S * I, beta * S * I - gamma * I, gamma * I];
      const k1 = f(S, I);
      const k2 = f(S + 0.5 * dt * k1[0], I + 0.5 * dt * k1[1]);
      const k3 = f(S + 0.5 * dt * k2[0], I + 0.5 * dt * k2[1]);
      const k4 = f(S + dt * k3[0], I + dt * k3[1]);
      S += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      I += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      R += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      ts.push(step * dt); Ss.push(S); Is.push(I); Rs.push(R);
    }
    return { ts, Ss, Is, Rs };
  }

  function render() {
    const R0 = beta / gamma;
    setMetric(mR0, R0.toFixed(2), 'β / γ');
    const { ts, Ss, Is, Rs } = integrate();
    const peakIdx = Is.indexOf(Math.max(...Is));
    setMetric(mPeak, `${(100 * Is[peakIdx]).toFixed(1)}% (day ${ts[peakIdx].toFixed(0)})`);
    setMetric(mFinal, `${(100 * Rs[Rs.length - 1]).toFixed(1)}%`);

    const { ctx, width: W, height: H } = fitCanvas(canvas, 300);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 40, r: 12, t: 12, b: 30 };
    // axes
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();
    // y ticks
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'right';
    for (const y of [0, 0.25, 0.5, 0.75, 1.0]) {
      const py = H - M.b - y * (H - M.b - M.t);
      ctx.fillText(`${(100 * y).toFixed(0)}%`, M.l - 4, py + 3);
      ctx.strokeStyle = P.line;
      ctx.beginPath(); ctx.moveTo(M.l, py); ctx.lineTo(W - M.r, py); ctx.stroke();
    }
    // x ticks
    ctx.textAlign = 'center';
    for (const d of [0, 30, 60, 90, 120, 150, 180]) {
      const px = M.l + (d / 180) * (W - M.r - M.l);
      ctx.fillText(String(d), px, H - M.b + 16);
    }

    function plot(vals, color, name) {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < ts.length; i++) {
        const x = M.l + (ts[i] / 180) * (W - M.r - M.l);
        const y = H - M.b - vals[i] * (H - M.b - M.t);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    plot(Ss, P.S, 'S');
    plot(Is, P.I, 'I');
    plot(Rs, P.R, 'R');

    // Peak marker
    const px = M.l + (ts[peakIdx] / 180) * (W - M.r - M.l);
    ctx.strokeStyle = P.I; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, M.t); ctx.lineTo(px, H - M.b); ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = 'bold 12px Inter';
    ctx.fillStyle = P.S; ctx.fillText('Susceptible', W - M.r - 100, M.t + 20);
    ctx.fillStyle = P.I; ctx.fillText('Infectious',  W - M.r - 100, M.t + 36);
    ctx.fillStyle = P.R; ctx.fillText('Recovered',   W - M.r - 100, M.t + 52);
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText('day', (M.l + W - M.r) / 2, H - 8);
  }
  onResize(canvas, 300, render);
  render();
}

initSim1();
initSim2();
initSim3();
