// Small canvas helpers shared across every story.
// Everything is a plain function — no build step, no framework.

/**
 * Prepare a canvas for crisp rendering on HiDPI displays.
 * Sets width/height in device pixels while keeping CSS size intact.
 * @param {HTMLCanvasElement} canvas
 * @param {number} cssHeight - target CSS height in pixels
 * @returns {{ctx: CanvasRenderingContext2D, width: number, height: number}}
 */
export function fitCanvas(canvas, cssHeight = 420) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.getBoundingClientRect().width;
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight, dpr };
}

/** Re-fit whenever the container resizes. */
export function onResize(canvas, cssHeight, redraw) {
  const observer = new ResizeObserver(() => {
    fitCanvas(canvas, cssHeight);
    redraw();
  });
  observer.observe(canvas);
  return () => observer.disconnect();
}

/**
 * Find which grid cell the pointer is over, given a pointer event.
 * Returns null if outside the grid.
 */
export function pointerCell(evt, canvas, cols, rows) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) / rect.width;
  const y = (evt.clientY - rect.top) / rect.height;
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
  return { col: Math.floor(x * cols), row: Math.floor(y * rows) };
}

/** A tiny requestAnimationFrame loop with pause/resume. */
export function makeLoop(step) {
  let raf = null;
  let last = 0;
  function frame(now) {
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (step(dt) !== false) raf = requestAnimationFrame(frame);
    else raf = null;
  }
  return {
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; last = 0; } },
    running() { return raf !== null; },
  };
}

/** Ease-out cubic — for smooth widget transitions. */
export const easeOut = t => 1 - Math.pow(1 - t, 3);
