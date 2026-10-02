// Systems dynamics story · three sims:
//   1. The Bathtub      — stock keeps rising while inflow drops
//   2. The Shower       — delay turns a controller into an oscillator
//   3. Volterra's Spray — kill the pest and its predator, raise the pest average

import { fitCanvas, makeLoop, onResize } from '../shared/canvas.js';
import { bindSlider, setMetric } from '../shared/ui.js';

// ============================================================================
// Shared palette & tiny helpers
// ============================================================================

const P = {
  primary: '#4C6EF5', accent: '#F76707', muted: '#868E96',
  danger:  '#E03131', success:'#37B24D', warn:  '#F59F00',
  purple:  '#7048E8', ink:    '#212529', line:  '#E9ECEF',
};

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

function temperatureColor(temp) {
  // 40° → cold blue, 70° → cyan sweet-spot, 100°+ → scalding red
  const t = Math.max(0, Math.min(1, (temp - 40) / 70));
  if (t < 0.4) {
    const u = t / 0.4;
    return `rgb(${Math.round(80 + u * 100)},${Math.round(160 + u * 80)},${Math.round(230 - u * 40)})`;
  } else if (t < 0.6) {
    const u = (t - 0.4) / 0.2;
    return `rgb(${Math.round(180 - u * 80)},${Math.round(240 - u * 40)},${Math.round(190 - u * 50)})`;
  } else {
    const u = (t - 0.6) / 0.4;
    return `rgb(${Math.round(100 + u * 180)},${Math.round(200 - u * 150)},${Math.round(140 - u * 120)})`;
  }
}

// ============================================================================
// Sim 1 · The Bathtub
// ============================================================================

function initBathtubSim() {
  const canvas = document.getElementById('sim-bathtub');
  if (!canvas) return;
  const presetBtns = document.querySelectorAll('button[data-tub]');
  const mPeak     = document.getElementById('b-peak');
  const mPeakYear = document.getElementById('b-peakyear');
  const mFinal    = document.getElementById('b-final');

  const CANVAS_H = 480;
  const START_STOCK = 1000;
  const START_INFLOW = 100;
  const OUTFLOW = 40;
  const YEARS = 50;
  const STEP_MS = 160;                 // one simulated year per 160 ms animation

  // scenario -> cut rate per year
  const CUT_RATES = { hold: 0, gentle: 2, aggressive: 8, match: null };
  // "match" is special — instantly jumps inflow to OUTFLOW.

  let scenario = 'hold';
  let data = null;                      // {year[], stock[], inflow[]}
  let currentYear = 0;
  let animStart = 0;
  let playing = false;

  function recompute() {
    const year = [], stock = [], inflow = [];
    let s = START_STOCK;
    let inf = START_INFLOW;
    if (scenario === 'match') inf = OUTFLOW;
    const cut = CUT_RATES[scenario];
    for (let y = 0; y <= YEARS; y++) {
      year.push(y);
      stock.push(s);
      inflow.push(inf);
      s = Math.max(0, s + inf - OUTFLOW);
      if (cut != null) inf = Math.max(0, inf - cut);
    }
    data = { year, stock, inflow };
  }

  function restart() {
    recompute();
    currentYear = 0;
    animStart = performance.now();
    playing = true;
    loop.start();
  }

  // Draw a cute cartoon bathtub with water level proportional to `fillFrac`
  function drawBathtub(ctx, x, y, w, h, fillFrac, inflowRate, outflowRate) {
    // Tub body (trapezoid, narrower at the bottom)
    const bottomW = w * 0.78;
    const bottomX = x + (w - bottomW) / 2;
    ctx.fillStyle = '#E9ECEF';
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 20);
    ctx.quadraticCurveTo(x, y + 20, x, y + 30);
    ctx.lineTo(bottomX, y + h);
    ctx.quadraticCurveTo(bottomX - 6, y + h + 6, bottomX + 10, y + h + 6);
    ctx.lineTo(bottomX + bottomW - 10, y + h + 6);
    ctx.quadraticCurveTo(bottomX + bottomW + 6, y + h + 6, bottomX + bottomW, y + h);
    ctx.lineTo(x + w, y + 30);
    ctx.quadraticCurveTo(x + w, y + 20, x + w - 8, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Water fill (polygon shaped like the inside of the tub, up to fillFrac)
    const waterTopY = y + 25 + (h - 30) * (1 - fillFrac);
    // Taper: top side of water
    const tFrac = (waterTopY - (y + 25)) / (h - 25);     // 0 at surface=tub-top, 1 at bottom
    const waterTopW = w - 20 - tFrac * (w - bottomW);
    const waterTopX = x + 10 + tFrac * ((w - bottomW) / 2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(waterTopX, waterTopY);
    ctx.lineTo(waterTopX + waterTopW, waterTopY);
    ctx.lineTo(bottomX + bottomW - 4, y + h - 2);
    ctx.lineTo(bottomX + 4, y + h - 2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, waterTopY, 0, y + h);
    grad.addColorStop(0, 'rgba(76,110,245,0.75)');
    grad.addColorStop(1, 'rgba(29,56,160,0.85)');
    ctx.fillStyle = grad;
    ctx.fill();
    // Subtle wave at the surface
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    const now = performance.now();
    ctx.beginPath();
    for (let px = waterTopX; px <= waterTopX + waterTopW; px += 4) {
      const wobble = Math.sin((px + now / 150) * 0.08) * 1.5;
      if (px === waterTopX) ctx.moveTo(px, waterTopY + wobble);
      else ctx.lineTo(px, waterTopY + wobble);
    }
    ctx.stroke();
    ctx.restore();

    // Faucet on top-left — a short L-shaped spigot
    const faucetX = x + 28, faucetY = y - 15;
    ctx.fillStyle = '#868E96';
    ctx.fillRect(faucetX, faucetY, 10, 24);
    ctx.fillRect(faucetX + 10, faucetY + 14, 14, 8);
    // Faucet number
    ctx.font = 'bold 13px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.primary;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`in: ${Math.round(inflowRate)}/yr`, faucetX + 30, faucetY + 18);

    // Falling water drops from faucet (only if inflow > 0)
    if (inflowRate > 0) {
      ctx.fillStyle = 'rgba(76,110,245,0.65)';
      for (let d = 0; d < 3; d++) {
        const t = ((now / 300) + d * 0.33) % 1;
        const dropY = faucetY + 22 + t * (waterTopY - faucetY - 25);
        if (dropY < waterTopY) {
          ctx.beginPath();
          ctx.arc(faucetX + 17, dropY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Drain hole visible inside the tub water (dark oval at bottom-right of the water area)
    const drainCX = bottomX + bottomW - 24;
    if (fillFrac > 0.03) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(drainCX, y + h - 3, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight on the drain hole lip
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(drainCX, y + h - 3, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drain pipe going straight down out of the bottom of the tub
    const drainPipeX = drainCX - 7;
    const drainPipeY = y + h + 2;
    const drainPipeW = 14;
    const drainPipeH = 20;
    ctx.fillStyle = '#868E96';
    ctx.fillRect(drainPipeX, drainPipeY, drainPipeW, drainPipeH);
    // Pipe opening (darker rectangle at the bottom)
    ctx.fillStyle = '#343A40';
    ctx.fillRect(drainPipeX + 2, drainPipeY + drainPipeH - 3, drainPipeW - 4, 3);

    // Animated water drops falling out of the drain
    if (outflowRate > 0 && fillFrac > 0.03) {
      ctx.fillStyle = 'rgba(76,110,245,0.75)';
      const dropMaxY = drainPipeY + drainPipeH + 30;
      for (let d = 0; d < 3; d++) {
        const t = ((now / 500) + d * 0.33) % 1;
        const dropY = drainPipeY + drainPipeH + t * 30;
        if (dropY <= dropMaxY) {
          // Elongated teardrop
          ctx.beginPath();
          ctx.ellipse(drainCX, dropY, 2.5, 3.5 + t * 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Small splash puddle at the bottom
      ctx.fillStyle = 'rgba(76,110,245,0.35)';
      ctx.beginPath();
      ctx.ellipse(drainCX, dropMaxY + 2, 10, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outflow label beside the drain
    ctx.fillStyle = '#495057';
    ctx.font = 'bold 13px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`out: ${Math.round(outflowRate)}/yr`, drainPipeX + drainPipeW + 10, drainPipeY + drainPipeH / 2 + 6);
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    if (!data) recompute();
    const now = performance.now();

    // Advance animation
    if (playing) {
      currentYear = Math.min(YEARS, (now - animStart) / STEP_MS);
      if (currentYear >= YEARS) playing = false;
    }
    const yi = Math.min(YEARS, Math.floor(currentYear));
    const yFrac = currentYear - yi;
    // Interpolated stock / inflow
    const stock = (yi < YEARS)
      ? data.stock[yi] + (data.stock[yi + 1] - data.stock[yi]) * yFrac
      : data.stock[YEARS];
    const inflow = (yi < YEARS)
      ? data.inflow[yi] + (data.inflow[yi + 1] - data.inflow[yi]) * yFrac
      : data.inflow[YEARS];

    // ---- Layout: bathtub on left, chart on right ----
    const tubX = 24, tubY = 48, tubW = 260, tubH = 180;
    const chartX = tubX + tubW + 56;
    const chartY = 48;
    const chartW = W - chartX - 24;
    const chartH = H - 100;

    // ---- Draw bathtub ----
    const maxStock = Math.max(...data.stock, START_STOCK * 2);
    const fillFrac = Math.max(0.05, Math.min(1, stock / maxStock));
    drawBathtub(ctx, tubX, tubY, tubW, tubH, fillFrac, inflow, OUTFLOW);
    // Stock readout above the tub
    ctx.font = 'bold 22px Inter,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.ink;
    ctx.fillText(`${Math.round(stock)} L in the tub`, tubX + tubW / 2, 10);
    ctx.font = '12px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.fillText(`year ${yi} of ${YEARS}`, tubX + tubW / 2, 34);

    // ---- Draw chart ----
    // Axes
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY); ctx.lineTo(chartX, chartY + chartH);
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.stroke();

    const chartMaxStock = Math.ceil(maxStock / 200) * 200;
    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let s = 500; s <= chartMaxStock; s += 500) {
      const gy = chartY + chartH - (s / chartMaxStock) * chartH;
      ctx.beginPath();
      ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy);
      ctx.stroke();
    }

    // Plot stock line (primary blue)
    ctx.strokeStyle = P.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const maxDraw = Math.min(YEARS, Math.ceil(currentYear));
    for (let y = 0; y <= maxDraw; y++) {
      const px = chartX + (y / YEARS) * chartW;
      const py = chartY + chartH - (data.stock[y] / chartMaxStock) * chartH;
      if (y === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Current dot on stock line
    {
      const px = chartX + (currentYear / YEARS) * chartW;
      const py = chartY + chartH - (stock / chartMaxStock) * chartH;
      ctx.save();
      ctx.shadowColor = P.primary;
      ctx.shadowBlur = 10;
      ctx.fillStyle = P.primary;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Plot inflow and outflow (scaled to chart — put them on a 0..200 scale on secondary axis)
    const flowMax = 200;
    const flowChartTop = chartY + chartH * 0.55;         // bottom half of chart for flows
    const flowChartH   = chartY + chartH - flowChartTop - 2;
    // Light background shading for flow sub-chart
    ctx.fillStyle = 'rgba(0,0,0,0.025)';
    ctx.fillRect(chartX, flowChartTop, chartW, flowChartH);
    // Outflow (constant line)
    ctx.strokeStyle = P.muted;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    const outY = flowChartTop + flowChartH - (OUTFLOW / flowMax) * flowChartH;
    ctx.beginPath();
    ctx.moveTo(chartX, outY); ctx.lineTo(chartX + chartW, outY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Inflow curve (accent orange)
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let y = 0; y <= maxDraw; y++) {
      const px = chartX + (y / YEARS) * chartW;
      const py = flowChartTop + flowChartH - (data.inflow[y] / flowMax) * flowChartH;
      if (y === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Chart labels
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`stock = water in the tub (max ${chartMaxStock} L)`, chartX + 4, chartY + 4);
    ctx.fillText(`inflow (orange)   ·   outflow = 40 (dashed grey)`, chartX + 4, flowChartTop + 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('year 0',    chartX + 2,          chartY + chartH + 12);
    ctx.textAlign = 'right';
    ctx.fillText(`year ${YEARS}`, chartX + chartW - 2, chartY + chartH + 12);

    // ---- Update metrics ----
    const peak = Math.max(...data.stock);
    const peakYear = data.stock.indexOf(peak);
    setMetric(mPeak, `${peak} L`, peak > START_STOCK ? `+${peak - START_STOCK} vs start` : 'no net gain');
    setMetric(mPeakYear, `year ${peakYear}`, peakYear === YEARS ? 'still climbing' : 'then starts falling');
    setMetric(mFinal, `${data.stock[YEARS]} L`,
              data.stock[YEARS] < START_STOCK ? 'below start ✓' :
              data.stock[YEARS] > START_STOCK ? 'above start ⚠' : '= start');
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => {
    render();
    return playing || true;  // keep running for the water wave animation
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scenario = btn.getAttribute('data-tub');
      presetBtns.forEach(b => b.classList.toggle('active',
        b.getAttribute('data-tub') === scenario));
      restart();
    });
  });

  restart();
}

// ============================================================================
// Sim 2 · The Shower
// ============================================================================

function initShowerSim() {
  const canvas = document.getElementById('sim-shower');
  if (!canvas) return;
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  const quickBtns = document.querySelectorAll('button[data-shower-delay]');
  const mSwing   = document.getElementById('s-swing');
  const mComfort = document.getElementById('s-comfort');
  const mVibe    = document.getElementById('s-vibe');

  const CANVAS_H = 480;
  const TARGET = 70;                   // target temperature °F
  const K_GAIN = 2.5;                  // how aggressively the auto-pilot corrects
  const SIM_DT = 0.1;                  // seconds per step
  const SIM_SECONDS = 60;              // total simulated time
  const SIM_STEPS = Math.floor(SIM_SECONDS / SIM_DT);

  let delaySec = 8;
  let temps = null;
  let taps  = null;

  // Simulate the delayed-feedback shower.
  // tap = correction = K * (target - perceived_temp)
  // actual_temp evolves: 1st-order toward (ambient + tap)
  // perceived_temp = actual from (now - delay)
  function simulate(delay) {
    const delaySteps = Math.round(delay / SIM_DT);
    const T = new Float32Array(SIM_STEPS);
    const tap = new Float32Array(SIM_STEPS);
    T[0] = 50;         // cold start
    for (let i = 1; i < SIM_STEPS; i++) {
      const perceivedIdx = Math.max(0, i - delaySteps);
      const perceived = T[perceivedIdx];
      // Auto-pilot sets tap based on perceived temp
      tap[i] = K_GAIN * (TARGET - perceived);
      // Clamp tap for realism
      tap[i] = Math.max(-80, Math.min(80, tap[i]));
      // Actual temp drifts toward (50 + tap) with time constant ~1 s
      const target_t = 50 + tap[i];
      T[i] = T[i - 1] + (target_t - T[i - 1]) * SIM_DT;
    }
    return { T, tap };
  }

  function recompute() {
    const r = simulate(delaySec);
    temps = r.T;
    taps = r.tap;
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    // Live playback — loop every SIM_SECONDS
    const loopTime = (now / 1000) % SIM_SECONDS;
    const stepIx = Math.min(SIM_STEPS - 1, Math.floor(loopTime / SIM_DT));
    const currentTemp = temps[stepIx];

    // ---- Top row: shower graphic + current readout ----
    const topY = 20;
    const topH = 160;
    const showerX = 60;
    const showerY = topY + 10;

    // Showerhead — a filled rectangle with holes
    ctx.fillStyle = '#868E96';
    roundRectPath(ctx, showerX, showerY, 80, 20, 6);
    ctx.fill();
    // Pipe going up to top of canvas
    ctx.fillRect(showerX + 36, 0, 8, showerY);

    // Water stream — colored by current temperature
    const streamColor = temperatureColor(currentTemp);
    for (let dropI = 0; dropI < 14; dropI++) {
      const t = ((now / 400) + dropI * 0.08) % 1;
      const yy = showerY + 20 + t * (topH - 20);
      const xx = showerX + 10 + (dropI * 60) / 14 + ((dropI % 2) * 2 - 1) * 2;
      ctx.fillStyle = streamColor;
      ctx.globalAlpha = 1 - t * 0.5;
      ctx.beginPath();
      ctx.ellipse(xx, yy, 2.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Current temperature readout on the right
    const roX = showerX + 160;
    const roY = topY + 40;
    ctx.font = 'bold 44px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = streamColor;
    ctx.fillText(`${currentTemp.toFixed(1)}°F`, roX, roY);
    // Mood emoji
    let mood;
    if (currentTemp < 55) mood = '🥶';
    else if (currentTemp > 85) mood = '🥵';
    else if (Math.abs(currentTemp - TARGET) < 3) mood = '😊';
    else mood = '😐';
    ctx.font = '44px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
    ctx.fillText(mood, roX + 160, roY);
    // Target label
    ctx.font = '13px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(`target: ${TARGET}°F · delay: ${delaySec} s`, roX, roY + 32);
    // Time counter
    ctx.textAlign = 'right';
    ctx.fillText(`time: ${loopTime.toFixed(1)} s`, W - 24, roY + 32);

    // ---- Chart (bottom) ----
    const chartX = 24;
    const chartY = topY + topH + 24;
    const chartW = W - 48;
    const chartH = H - chartY - 20;

    // Y range
    const yMin = 30, yMax = 110;
    const toY = v => chartY + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

    // Comfort band
    ctx.fillStyle = 'rgba(55,178,77,0.08)';
    const bandY1 = toY(TARGET + 3);
    const bandY2 = toY(TARGET - 3);
    ctx.fillRect(chartX, bandY1, chartW, bandY2 - bandY1);
    // Band label
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.success;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('comfort band (±3°F)', chartX + chartW - 4, bandY1 + 2);

    // Axes
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY); ctx.lineTo(chartX, chartY + chartH);
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.stroke();

    // Gridlines + y-axis labels
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '10px Inter,system-ui,sans-serif';
    for (let v = 40; v <= 100; v += 20) {
      const gy = toY(v);
      ctx.beginPath();
      ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy);
      ctx.stroke();
      ctx.fillText(`${v}°`, chartX - 4, gy);
    }

    // Target line
    ctx.strokeStyle = P.success;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const targetY = toY(TARGET);
    ctx.moveTo(chartX, targetY); ctx.lineTo(chartX + chartW, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Temperature curve
    ctx.strokeStyle = P.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < SIM_STEPS; i++) {
      const px = chartX + (i / SIM_STEPS) * chartW;
      const py = toY(temps[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current time marker
    const curX = chartX + (stepIx / SIM_STEPS) * chartW;
    const curY = toY(currentTemp);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, chartY); ctx.lineTo(curX, chartY + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = streamColor;
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- Metrics ----
    let maxT = -Infinity, minT = Infinity;
    let inBand = 0;
    for (let i = 0; i < SIM_STEPS; i++) {
      if (temps[i] > maxT) maxT = temps[i];
      if (temps[i] < minT) minT = temps[i];
      if (Math.abs(temps[i] - TARGET) <= 3) inBand++;
    }
    const swing = maxT - minT;
    const comfortPct = Math.round(100 * inBand / SIM_STEPS);
    setMetric(mSwing, `${swing.toFixed(1)}°F`, `max ${maxT.toFixed(0)} / min ${minT.toFixed(0)}`);
    setMetric(mComfort, `${comfortPct}%`, 'higher is better');
    let vibe, vibeHint;
    if (swing < 10) { vibe = '🎵 smooth'; vibeHint = 'the controller works perfectly'; }
    else if (swing < 40) { vibe = '🌊 wavy'; vibeHint = 'noticeable overshoot'; }
    else if (swing < 80) { vibe = '🎢 oscillating'; vibeHint = 'violent swings — pipe is too long'; }
    else { vibe = '💥 lethal'; vibeHint = 'scalding then freezing — unusable'; }
    setMetric(mVibe, vibe, vibeHint);
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => { render(); return true; });

  bindSlider(sliderRoot, v => {
    delaySec = v;
    recompute();
  }, v => `${v} s`);

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const d = Number(btn.getAttribute('data-shower-delay'));
      const inp = sliderRoot.querySelector('input[type="range"]');
      inp.value = d;
      sliderRoot.querySelector('.value').textContent = `${d} s`;
      delaySec = d;
      recompute();
    });
  });

  recompute();
  loop.start();
}

// ============================================================================
// Sim 3 · Volterra's Spray  (predator-prey with broad-spectrum spray)
// ============================================================================

function initSpraySim() {
  const canvas = document.getElementById('sim-spray');
  if (!canvas) return;
  const sliderRoot = canvas.parentElement.querySelector('.slider-block');
  const quickBtns = document.querySelectorAll('button[data-spray]');
  const mRabbit = document.getElementById('v-rabbit');
  const mFox    = document.getElementById('v-fox');
  const mChange = document.getElementById('v-change');

  const CANVAS_H = 500;
  // Lotka-Volterra params
  const A = 1.0;    // prey growth
  const B = 0.02;   // predation rate
  const C = 0.01;   // predator reproduction per rabbit eaten
  const D = 0.6;    // predator death
  const SIM_T_MAX = 100;    // simulated time units
  const SIM_DT = 0.02;      // RK4 step
  const SIM_STEPS = Math.floor(SIM_T_MAX / SIM_DT);
  const BASELINE_RABBIT_EQ = D / C;      // 60 at spray=0

  let sprayPct = 0;    // 0-40 %, converted to m = sprayPct/100 (so slider 0..40 → 0.0..0.4)
  let history = null;  // { R: Float32Array, F: Float32Array, Rmean, Fmean }

  function simulate(m) {
    // RK4 on dR/dt = aR - bRF - mR; dF/dt = cRF - dF - mF
    const dR = (R, F) => A * R - B * R * F - m * R;
    const dF = (R, F) => C * R * F - D * F - m * F;
    const Rhist = new Float32Array(SIM_STEPS);
    const Fhist = new Float32Array(SIM_STEPS);
    let R = 40, F = 9;
    Rhist[0] = R; Fhist[0] = F;
    for (let i = 1; i < SIM_STEPS; i++) {
      const k1R = dR(R, F), k1F = dF(R, F);
      const k2R = dR(R + 0.5 * SIM_DT * k1R, F + 0.5 * SIM_DT * k1F);
      const k2F = dF(R + 0.5 * SIM_DT * k1R, F + 0.5 * SIM_DT * k1F);
      const k3R = dR(R + 0.5 * SIM_DT * k2R, F + 0.5 * SIM_DT * k2F);
      const k3F = dF(R + 0.5 * SIM_DT * k2R, F + 0.5 * SIM_DT * k2F);
      const k4R = dR(R + SIM_DT * k3R, F + SIM_DT * k3F);
      const k4F = dF(R + SIM_DT * k3R, F + SIM_DT * k3F);
      R = Math.max(0, R + (SIM_DT / 6) * (k1R + 2 * k2R + 2 * k3R + k4R));
      F = Math.max(0, F + (SIM_DT / 6) * (k1F + 2 * k2F + 2 * k3F + k4F));
      Rhist[i] = R;
      Fhist[i] = F;
    }
    // Compute long-run averages over the second half (skip transient)
    const start = Math.floor(SIM_STEPS * 0.5);
    let Rsum = 0, Fsum = 0;
    for (let i = start; i < SIM_STEPS; i++) { Rsum += Rhist[i]; Fsum += Fhist[i]; }
    const n = SIM_STEPS - start;
    return {
      R: Rhist, F: Fhist,
      Rmean: Rsum / n,
      Fmean: Fsum / n,
    };
  }

  function recompute() {
    const m = sprayPct / 100;
    history = simulate(m);
  }

  function render() {
    const { ctx, width: W, height: H } = fitCanvas(canvas, CANVAS_H);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
    const now = performance.now();

    // Live playback — scroll through the simulation
    const loopPeriodMs = 15000;    // 15 seconds to play through the simulation
    const t = (now % loopPeriodMs) / loopPeriodMs;
    const stepIx = Math.min(SIM_STEPS - 1, Math.floor(t * SIM_STEPS));
    const curR = history.R[stepIx];
    const curF = history.F[stepIx];

    // ---- Top row: live counts as emoji grids ----
    const topY = 10;
    const topH = 150;
    const sideW = (W - 36) / 2;
    const leftX = 12;
    const rightX = leftX + sideW + 12;

    // Panel A: rabbits (green bg)
    ctx.fillStyle = 'rgba(55,178,77,0.07)';
    roundRectPath(ctx, leftX, topY, sideW, topH, 12);
    ctx.fill();
    // Panel B: foxes (orange bg)
    ctx.fillStyle = 'rgba(247,103,7,0.07)';
    roundRectPath(ctx, rightX, topY, sideW, topH, 12);
    ctx.fill();

    // Rabbit emoji grid (scale: 1 emoji = 3 rabbits, cap at 50 emojis)
    const rabbitEmojis = Math.min(50, Math.round(curR / 3));
    const foxEmojis = Math.min(50, Math.round(curF / 3));

    const drawEmojiGrid = (x0, y0, w, h, count, emoji) => {
      const cols = 10, rows = 5;
      const cellW = (w - 20) / cols;
      const cellH = (h - 40) / rows;
      const size = Math.min(cellW, cellH) * 0.85;
      ctx.font = `${Math.floor(size)}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = x0 + 10 + col * cellW + cellW / 2;
        const cy = y0 + 30 + row * cellH + cellH / 2;
        ctx.fillText(emoji, cx, cy);
      }
    };
    drawEmojiGrid(leftX, topY, sideW, topH, rabbitEmojis, '🐰');
    drawEmojiGrid(rightX, topY, sideW, topH, foxEmojis, '🦊');

    // Headers
    ctx.font = 'bold 14px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = P.success;
    ctx.fillText(`🐰 ${Math.round(curR)} rabbits`, leftX + 14, topY + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = P.muted;
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillText(`avg = ${history.Rmean.toFixed(1)}`, leftX + sideW - 14, topY + 12);

    ctx.font = 'bold 14px Inter,system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = P.accent;
    ctx.fillText(`🦊 ${Math.round(curF)} foxes`, rightX + 14, topY + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = P.muted;
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillText(`avg = ${history.Fmean.toFixed(1)}`, rightX + sideW - 14, topY + 12);

    // Spray cloud icon when spraying
    if (sprayPct > 0) {
      ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(now / 400);
      // A few random spray cloud emojis sprinkled over both panels
      const clouds = Math.max(1, Math.round(sprayPct / 10));
      for (let i = 0; i < clouds; i++) {
        const px = leftX + ((i * 1273) % (W - 24)) + 12;
        const py = topY + 30 + ((i * 53 + Math.floor(now / 100)) % (topH - 40));
        ctx.fillText('☁️', px, py);
      }
      ctx.globalAlpha = 1;
    }

    // ---- Bottom: time chart with averages ----
    const chartX = 30;
    const chartY = topY + topH + 36;
    const chartW = W - 60;
    const chartH = H - chartY - 20;

    // Y range: max of max rabbit + 10
    const maxR = Math.max(...history.R, 10);
    const maxF = Math.max(...history.F, 10);
    const yMax = Math.ceil(Math.max(maxR, maxF) / 20) * 20 + 10;

    // Axes
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY); ctx.lineTo(chartX, chartY + chartH);
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.stroke();
    // Gridlines
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.fillStyle = P.muted;
    ctx.font = '10px Inter,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yStep = yMax <= 80 ? 20 : 50;
    for (let v = yStep; v <= yMax; v += yStep) {
      const gy = chartY + chartH - (v / yMax) * chartH;
      ctx.beginPath();
      ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy);
      ctx.stroke();
      ctx.fillText(`${v}`, chartX - 4, gy);
    }

    // Rabbit average line (green dashed)
    const rMeanY = chartY + chartH - (history.Rmean / yMax) * chartH;
    ctx.strokeStyle = P.success;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartX, rMeanY); ctx.lineTo(chartX + chartW, rMeanY);
    ctx.stroke();
    // Fox average line (orange dashed)
    const fMeanY = chartY + chartH - (history.Fmean / yMax) * chartH;
    ctx.strokeStyle = P.accent;
    ctx.beginPath();
    ctx.moveTo(chartX, fMeanY); ctx.lineTo(chartX + chartW, fMeanY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Baseline (no-spray) rabbit average — thick blue reference line
    const baselineY = chartY + chartH - (BASELINE_RABBIT_EQ / yMax) * chartH;
    ctx.strokeStyle = 'rgba(76,110,245,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(chartX, baselineY); ctx.lineTo(chartX + chartW, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px Inter,system-ui,sans-serif';
    ctx.fillStyle = 'rgba(76,110,245,0.7)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`no-spray baseline: 60 rabbits`, chartX + 4, baselineY - 2);

    // Rabbit population line
    ctx.strokeStyle = P.success;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < SIM_STEPS; i += 3) {
      const px = chartX + (i / SIM_STEPS) * chartW;
      const py = chartY + chartH - (history.R[i] / yMax) * chartH;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Fox population line
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < SIM_STEPS; i += 3) {
      const px = chartX + (i / SIM_STEPS) * chartW;
      const py = chartY + chartH - (history.F[i] / yMax) * chartH;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current time marker
    const curX = chartX + (stepIx / SIM_STEPS) * chartW;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, chartY); ctx.lineTo(curX, chartY + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('populations over time · dashed lines = long-run averages',
                 chartX + 4, chartY + 4);

    // ---- Metrics ----
    setMetric(mRabbit, history.Rmean.toFixed(1),
              sprayPct === 0 ? 'equilibrium with no spray' : `with spray = ${(sprayPct / 100).toFixed(2)}`);
    setMetric(mFox, history.Fmean.toFixed(1),
              sprayPct === 0 ? 'equilibrium with no spray' : 'foxes always lose');
    const delta = history.Rmean - BASELINE_RABBIT_EQ;
    const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    setMetric(mChange, deltaStr,
              Math.abs(delta) < 0.5 ? 'no change' :
              delta > 0 ? '😱 MORE pests from spraying!' :
              'fewer pests');
  }
  onResize(canvas, CANVAS_H, render);

  const loop = makeLoop(() => { render(); return true; });

  bindSlider(sliderRoot, v => {
    sprayPct = v;
    recompute();
  }, v => (v / 100).toFixed(2));

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = Number(btn.getAttribute('data-spray'));
      const inp = sliderRoot.querySelector('input[type="range"]');
      inp.value = v;
      sliderRoot.querySelector('.value').textContent = (v / 100).toFixed(2);
      sprayPct = v;
      recompute();
    });
  });

  recompute();
  loop.start();
}

// ============================================================================
// Bootstrap
// ============================================================================

initBathtubSim();
initShowerSim();
initSpraySim();
