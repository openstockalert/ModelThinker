// SIR story — three sims: agent grid outbreak, herd-immunity, ODE curves.

import { fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, setMetric, shuffle } from '../shared/ui.js';

const P = { S: '#4C6EF5', I: '#E03131', R: '#37B24D', muted: '#868E96', line: '#E9ECEF', ink: '#212529' };

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
  // Transition each infected: recover with prob gamma per day, else transmit to a random peer
  const { arr, rng } = state;
  const N = arr.length;
  const nextRecover = [];
  const nextInfect = [];
  const contactsPerDay = R0;  // in a fully mixed pop with tau=1/gamma days, R0 ≈ β*duration ≈ contactsPerDay * (I/N) * duration
  const pInfect = 1 - Math.exp(-contactsPerDay * gamma);  // per-day per-infected contact prob calibrated by R0
  for (let i = 0; i < N; i++) {
    if (arr[i] !== 1) continue;
    if (rng() < gamma) nextRecover.push(i);
    else if (rng() < pInfect) {
      // pick a random other person
      const target = Math.floor(rng() * N);
      if (arr[target] === 0) nextInfect.push(target);
    }
  }
  for (const i of nextRecover) arr[i] = 2;
  for (const i of nextInfect) arr[i] = 1;
  return { S: countState(arr, 0), I: countState(arr, 1), R: countState(arr, 2) };
}
function countState(arr, s) { let c = 0; for (let i = 0; i < arr.length; i++) if (arr[i] === s) c++; return c; }

function drawAgents(canvas, state, cssH = 280) {
  const { ctx, width: W, height: H } = fitCanvas(canvas, cssH);
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
  const N = state.arr.length;
  const cols = Math.ceil(Math.sqrt(N * W / H));
  const rows = Math.ceil(N / cols);
  const s = Math.min(W / cols, H / rows);
  const offX = (W - s * cols) / 2, offY = (H - s * rows) / 2;
  const r = s * 0.28;
  for (let i = 0; i < N; i++) {
    const c = i % cols, row = Math.floor(i / cols);
    const cx = offX + (c + 0.5) * s;
    const cy = offY + (row + 0.5) * s;
    const v = state.arr[i];
    ctx.fillStyle = v === 0 ? P.S : v === 1 ? P.I : P.R;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
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

  const N = 400;
  let R0 = 2.5;
  let state = makeAgents({ N, seed: 1 });
  let day = 0, peakI = 0, peakDay = 0;

  function render() {
    drawAgents(canvas, state, 280);
    const counts = { S: countState(state.arr, 0), I: countState(state.arr, 1), R: countState(state.arr, 2) };
    setMetric(mDay, String(day));
    setMetric(mInf, `${(100 * counts.I / N).toFixed(1)}%`);
    setMetric(mRec, `${(100 * counts.R / N).toFixed(1)}%`);
    if (counts.I > peakI) { peakI = counts.I; peakDay = day; }
    setMetric(mPeak, peakDay > 0 ? `day ${peakDay}` : '—');
  }

  const loop = makeLoop(() => {
    stepAgents(state, { R0, gamma: 0.1 });
    day++;
    render();
    if (countState(state.arr, 1) === 0) { playBtn.textContent = '▶ Release patient zero'; return false; }
    if (day > 400) return false;
  });

  // Slider value IS R0 directly (min=0.5, max=6, step=0.1).
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  bindSlider(sliderRoot, v => { R0 = v; render(); }, v => v.toFixed(1));

  onResize(canvas, 280, render);
  render();

  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Release patient zero'; }
    else { loop.start(); playBtn.textContent = '⏸ Pause'; }
  });
  resetBtn.addEventListener('click', () => {
    loop.stop(); playBtn.textContent = '▶ Release patient zero';
    state = makeAgents({ N, seed: Math.floor(Math.random() * 100000) });
    day = 0; peakI = 0; peakDay = 0; render();
  });
}

// ---------- Sim 2: Pre-vaccination + herd immunity --------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const playBtn = document.getElementById('sim2-play');
  const resetBtn = document.getElementById('sim2-reset');
  const mThresh = document.getElementById('sim2-thresh');
  const mFinal = document.getElementById('sim2-final');

  const N = 400;
  let R0 = 3.0, vFrac = 0.5;
  let state = makeAgents({ N, seed: 3, immuneFrac: vFrac });
  let day = 0;

  function updateThresh() {
    const t = Math.max(0, 1 - 1 / R0);
    setMetric(mThresh, `${(100 * t).toFixed(0)}%`);
  }
  function render() {
    drawAgents(canvas, state, 260);
    const counts = { S: countState(state.arr, 0), I: countState(state.arr, 1), R: countState(state.arr, 2) };
    const initialS = N - Math.round(N * vFrac) - 1;
    const infected = counts.R - Math.round(N * vFrac);
    setMetric(mFinal, initialS > 0 ? `${(100 * infected / initialS).toFixed(1)}%` : '—');
    updateThresh();
  }

  const loop = makeLoop(() => {
    stepAgents(state, { R0, gamma: 0.1 });
    day++;
    render();
    if (countState(state.arr, 1) === 0) { playBtn.textContent = '▶ Start outbreak'; return false; }
    if (day > 400) return false;
  });

  function resetPopulation() {
    loop.stop(); playBtn.textContent = '▶ Start outbreak';
    state = makeAgents({ N, seed: Math.floor(Math.random() * 100000), immuneFrac: vFrac });
    day = 0; render();
  }

  const controls = canvas.parentElement.querySelectorAll('.slider-block');
  bindSlider(controls[0], v => { R0 = v; updateThresh(); }, v => v.toFixed(1));
  // vFrac must re-seed the population — pre-vaccinated agents are baked into state.
  bindSlider(controls[1], v => { vFrac = v / 100; resetPopulation(); });

  onResize(canvas, 260, render);
  render();

  playBtn.addEventListener('click', () => {
    if (loop.running()) { loop.stop(); playBtn.textContent = '▶ Start outbreak'; }
    else { loop.start(); playBtn.textContent = '⏸ Pause'; }
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
