// Tiny UI helpers: sliders that show their current value, seeded RNG, meters.

/**
 * A seeded, deterministic RNG — Mulberry32.
 * Same seed → same sequence, across browsers and reloads.
 */
export function makeRng(seed = 42) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample via Box–Muller. */
export function randn(rng) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Bind a slider to a callback and keep its label in sync.
 * The HTML pattern:
 *   <label class="slider-block">
 *     <span class="slider-label"><span>Tolerance</span><span class="value">30%</span></span>
 *     <input type="range" min="0" max="100" value="30" data-fmt="{v}%">
 *   </label>
 *
 * @param root       the .slider-block element
 * @param onChange   called with the raw numeric slider value on every change
 * @param formatter  optional (v) => string; if provided, wins over data-fmt
 */
export function bindSlider(root, onChange, formatter) {
  const input = root.querySelector('input[type="range"]');
  const label = root.querySelector('.slider-label .value');
  const fmt = input.dataset.fmt || '{v}';
  function update() {
    const v = Number(input.value);
    if (label) {
      label.textContent = formatter ? formatter(v) : fmt.replace('{v}', v);
    }
    onChange && onChange(v);
  }
  input.addEventListener('input', update);
  update();
  return { setValue: v => { input.value = v; update(); }, get value() { return Number(input.value); } };
}

/** Update a .metric block created in HTML. */
export function setMetric(block, value, delta) {
  const v = block.querySelector('.value');
  if (v) v.textContent = value;
  const d = block.querySelector('.delta');
  if (d && delta !== undefined) d.textContent = delta;
}

/** Update a meter's fill. `pct` in [0, 1]. */
export function setMeter(el, pct) {
  const fill = el.querySelector('.meter-fill');
  if (fill) fill.style.width = (100 * Math.max(0, Math.min(1, pct))) + '%';
}

/** Fisher–Yates shuffle in place, using the given RNG. */
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Format a number with a fixed number of significant digits. */
export function fmt(n, digits = 2) {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  return n.toPrecision(digits);
}
