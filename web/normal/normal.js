// Normal / CLT story — two sims: source→sample-mean, and √n rule scan.

import { fitCanvas, onResize } from '../shared/canvas.js';
import { bindSlider, makeRng, randn, setMetric } from '../shared/ui.js';

const P = { primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
            danger: '#E03131', line: '#E9ECEF', ink: '#212529' };

// Theoretical (mean, std) for each source.
const SOURCES = {
  uniform:   { theory: () => [0.5, Math.sqrt(1/12)], draw: r => r() },
  exp:       { theory: () => [1.0, 1.0],              draw: r => -Math.log(1 - r()) },
  bern:      { theory: () => [0.5, 0.5],              draw: r => r() < 0.5 ? 0 : 1 },
  lognormal: { theory: () => {
                 const m = 0, s = 1;
                 const mean = Math.exp(m + s*s/2);
                 const varz = (Math.exp(s*s) - 1) * Math.exp(2*m + s*s);
                 return [mean, Math.sqrt(varz)];
               },
               draw: r => Math.exp(randn(r)) },
};

// ---------- Sim 1 -----------------------------------------------------------

function initSim1() {
  const canvas = document.getElementById('sim1');
  const srcEl = document.getElementById('sim1-src');
  const mMu = document.getElementById('sim1-mu');
  const mStd = document.getElementById('sim1-std');
  const sliderRoot = canvas.parentElement.querySelectorAll('.slider-block')[1];

  let source = 'exp';
  let n = 30;
  bindSlider(sliderRoot, v => { n = v; render(); });
  srcEl.addEventListener('change', () => { source = srcEl.value; render(); });

  function sample() {
    const rng = makeRng(42);
    const NUM = 4000;
    const src = SOURCES[source];
    const raw = new Float64Array(NUM);      // one raw draw for reference histogram
    const means = new Float64Array(NUM);    // sample means
    for (let i = 0; i < NUM; i++) {
      let acc = 0;
      let first = 0;
      for (let j = 0; j < n; j++) {
        const x = src.draw(rng);
        if (j === 0) first = x;
        acc += x;
      }
      raw[i] = first;
      means[i] = acc / n;
    }
    return { raw, means };
  }

  function render() {
    const src = SOURCES[source];
    const [mu, sigma] = src.theory();
    const { raw, means } = sample();
    const mean = means.reduce((a, b) => a + b, 0) / means.length;
    let v = 0; for (let i = 0; i < means.length; i++) v += (means[i] - mean) ** 2;
    const std = Math.sqrt(v / (means.length - 1));
    setMetric(mMu, mean.toFixed(3));
    setMetric(mStd, std.toFixed(3), `theory ${(sigma / Math.sqrt(n)).toFixed(3)}`);

    const { ctx, width: W, height: H } = fitCanvas(canvas, 340);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 40, r: 12, t: 12, b: 30 };

    // choose x range: cover raw AND means
    let xMin = Infinity, xMax = -Infinity;
    for (const arr of [raw, means]) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] < xMin) xMin = arr[i];
        if (arr[i] > xMax) xMax = arr[i];
      }
    }
    const pad = (xMax - xMin) * 0.05;
    xMin -= pad; xMax += pad;
    const nBins = 40;
    function hist(arr) {
      const counts = new Array(nBins).fill(0);
      for (let i = 0; i < arr.length; i++) {
        const b = Math.min(nBins - 1, Math.max(0, Math.floor((arr[i] - xMin) / (xMax - xMin) * nBins)));
        counts[b]++;
      }
      const bw = (xMax - xMin) / nBins;
      return counts.map(c => c / arr.length / bw);   // density
    }
    const rawH = hist(raw);
    const meanH = hist(means);
    // find max density; also compute peak of normal for scaling
    const normalPeak = 1 / (Math.sqrt(2 * Math.PI) * sigma / Math.sqrt(n));
    const yMax = Math.max(...rawH, ...meanH, normalPeak) * 1.1;

    // axes
    ctx.strokeStyle = P.line;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();

    // bars — raw (blue, low opacity) and means (orange, higher)
    const bw = (W - M.l - M.r) / nBins;
    for (let i = 0; i < nBins; i++) {
      const x = M.l + i * bw;
      const hR = rawH[i] / yMax * (H - M.b - M.t);
      const hM = meanH[i] / yMax * (H - M.b - M.t);
      ctx.fillStyle = 'rgba(76,110,245,0.30)';
      ctx.fillRect(x + 1, H - M.b - hR, bw - 2, hR);
      ctx.fillStyle = 'rgba(247,103,7,0.75)';
      ctx.fillRect(x + 1, H - M.b - hM, bw - 2, hM);
    }

    // theoretical normal curve for the mean distribution
    ctx.strokeStyle = P.danger; ctx.lineWidth = 3;
    ctx.beginPath();
    const s = sigma / Math.sqrt(n);
    for (let i = 0; i <= 200; i++) {
      const x = xMin + (xMax - xMin) * i / 200;
      const y = Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
      const px = M.l + (x - xMin) / (xMax - xMin) * (W - M.l - M.r);
      const py = H - M.b - y / yMax * (H - M.b - M.t);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // x tick labels
    ctx.fillStyle = P.muted; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    for (let t = 0; t <= 4; t++) {
      const val = xMin + (xMax - xMin) * t / 4;
      const px = M.l + t / 4 * (W - M.l - M.r);
      ctx.fillText(val.toFixed(2), px, H - M.b + 16);
    }
    // Legend
    ctx.textAlign = 'right'; ctx.font = 'bold 12px Inter';
    ctx.fillStyle = P.primary; ctx.fillText(`source (n=1)`, W - M.r - 8, M.t + 16);
    ctx.fillStyle = P.accent;  ctx.fillText(`sample means (n=${n})`, W - M.r - 8, M.t + 34);
    ctx.fillStyle = P.danger;  ctx.fillText(`CLT normal`, W - M.r - 8, M.t + 52);
  }
  onResize(canvas, 340, render);
  render();
}

// ---------- Sim 2: √n rule scan --------------------------------------------

function initSim2() {
  const canvas = document.getElementById('sim2');
  const runBtn = document.getElementById('sim2-run');
  let data = null;

  function run() {
    const rng = makeRng(Math.floor(Math.random() * 100000));
    const ns = [1, 4, 16, 64, 256, 1024, 4096];
    const NUM = 2000;
    const stds = ns.map(n => {
      const means = new Float64Array(NUM);
      for (let i = 0; i < NUM; i++) {
        let acc = 0;
        for (let j = 0; j < n; j++) acc += rng();  // uniform 0-1
        means[i] = acc / n;
      }
      const mean = means.reduce((a, b) => a + b, 0) / NUM;
      let v = 0; for (let i = 0; i < NUM; i++) v += (means[i] - mean) ** 2;
      return Math.sqrt(v / (NUM - 1));
    });
    data = { ns, stds };
    render();
  }
  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, 300);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const M = { l: 50, r: 12, t: 12, b: 30 };
    ctx.strokeStyle = P.line;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b); ctx.stroke();
    if (!data) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'center'; ctx.font = '13px Inter';
      ctx.fillText('Click "Run the scan" — takes about a second.', W / 2, H / 2);
      return;
    }
    const sigma = Math.sqrt(1/12);   // Uniform(0,1) theoretical σ
    const logX = data.ns.map(n => Math.log10(n));
    const logY = data.stds.map(s => Math.log10(s));
    const xMin = 0, xMax = Math.log10(data.ns[data.ns.length - 1]) + 0.2;
    const yMax = Math.log10(sigma) + 0.1, yMin = Math.log10(sigma / Math.sqrt(data.ns[data.ns.length - 1])) - 0.3;
    function px(x) { return M.l + (x - xMin) / (xMax - xMin) * (W - M.l - M.r); }
    function py(y) { return H - M.b - (y - yMin) / (yMax - yMin) * (H - M.b - M.t); }
    // grid lines
    ctx.strokeStyle = P.line; ctx.textAlign = 'right'; ctx.fillStyle = P.muted; ctx.font = '11px Inter';
    for (let e = Math.ceil(yMin); e <= yMax; e++) {
      ctx.beginPath(); ctx.moveTo(M.l, py(e)); ctx.lineTo(W - M.r, py(e)); ctx.stroke();
      ctx.fillText(`10^${e}`, M.l - 6, py(e) + 3);
    }
    ctx.textAlign = 'center';
    for (const n of data.ns) ctx.fillText(String(n), px(Math.log10(n)), H - M.b + 16);
    // theory line
    ctx.strokeStyle = P.danger; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(0), py(Math.log10(sigma)));
    ctx.lineTo(px(xMax), py(Math.log10(sigma / Math.sqrt(Math.pow(10, xMax)))));
    ctx.stroke(); ctx.setLineDash([]);
    // empirical
    ctx.strokeStyle = P.primary; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < data.ns.length; i++) {
      const x = px(logX[i]), y = py(logY[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // dots
    ctx.fillStyle = P.primary;
    for (let i = 0; i < data.ns.length; i++) {
      ctx.beginPath(); ctx.arc(px(logX[i]), py(logY[i]), 5, 0, Math.PI * 2); ctx.fill();
    }
    // Legend
    ctx.textAlign = 'right'; ctx.font = 'bold 12px Inter';
    ctx.fillStyle = P.primary; ctx.fillText('empirical std of sample mean', W - M.r - 8, M.t + 16);
    ctx.fillStyle = P.danger;  ctx.fillText('theory σ/√n', W - M.r - 8, M.t + 34);
    ctx.fillStyle = P.muted;   ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText('n (log)', (M.l + W - M.r) / 2, H - 8);
  }
  onResize(canvas, 300, render);
  runBtn.addEventListener('click', run);
  render();
}

initSim1();
initSim2();
