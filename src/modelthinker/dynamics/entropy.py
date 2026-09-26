"""Chapter 12 — Entropy: modeling uncertainty.

Three threads from the book chapter, all pinned to the same one-number
concept — Shannon entropy $H = -\\sum p_i \\log_2 p_i$:

1. **Shannon entropy** — measures uncertainty and, equivalently, diversity.
2. **Maximum-entropy distributions** — the least-structured distribution
   consistent with a constraint. Range → uniform; mean → exponential;
   mean + variance → normal.
3. **Wolfram's four classes of outcomes** — equilibrium, periodic, random,
   complex — illustrated with 1-D elementary cellular automata (rules 0–255).

Full write-up: ``docs/models/ch12_entropy.md``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=12,
    name="Entropy",
    slug="entropy",
    part="dynamics",
    redcape=("Reason", "Explain", "Communicate", "Explore"),
    summary=(
        "Shannon entropy scores uncertainty (and diversity) with one number, "
        "and the same one number sorts systems into four classes: "
        "equilibrium, periodic, random, complex."
    ),
    tags=("information theory", "cellular automata", "diversity", "Wolfram"),
)


# ---------------------------------------------------------------------------
# 1. Shannon-entropy primitives
# ---------------------------------------------------------------------------

def shannon_entropy(p: np.ndarray | list[float], base: float = 2.0) -> float:
    r"""Shannon entropy $H(p) = -\sum_i p_i \log_{\text{base}} p_i$.

    Uses the convention $0 \log 0 = 0$. ``p`` is renormalised to sum to 1 if
    it doesn't already.
    """
    p = np.asarray(p, dtype=float).flatten()
    if p.size == 0:
        return 0.0
    if np.any(p < 0):
        raise ValueError("probabilities must be non-negative")
    total = float(p.sum())
    if total <= 0:
        raise ValueError("probabilities must sum to > 0")
    p = p / total
    p = p[p > 0]
    return float(-(p * np.log(p)).sum() / math.log(base))


def normalised_entropy(p: np.ndarray | list[float], base: float = 2.0) -> float:
    """Entropy divided by :math:`\\log_{\\text{base}} K`; always in :math:`[0, 1]`.

    Useful for comparing distributions with different support sizes.
    """
    p = np.asarray(p, dtype=float).flatten()
    p_pos = p[p > 0]
    if p_pos.size <= 1:
        return 0.0
    return shannon_entropy(p, base) / math.log(p_pos.size, base) \
        if p_pos.size < p.size else shannon_entropy(p, base) / math.log(p.size, base)


def empirical_distribution(
    samples: np.ndarray | list[int],
    n_outcomes: int | None = None,
) -> np.ndarray:
    """Turn a categorical sample into a probability vector via bincount."""
    samples = np.asarray(samples, dtype=int).flatten()
    if samples.size == 0:
        return np.array([])
    if n_outcomes is None:
        n_outcomes = int(samples.max()) + 1
    counts = np.bincount(samples, minlength=n_outcomes).astype(float)
    return counts / counts.sum()


def kl_divergence(p: np.ndarray, q: np.ndarray, base: float = 2.0) -> float:
    r"""$D_{\text{KL}}(p \| q) = \sum_i p_i \log(p_i / q_i)$.

    Non-negative and zero iff $p = q$. Undefined (returns ``inf``) if any
    $q_i = 0$ where $p_i > 0$.
    """
    p = np.asarray(p, dtype=float).flatten()
    q = np.asarray(q, dtype=float).flatten()
    if p.shape != q.shape:
        raise ValueError("p and q must have the same shape")
    p = p / p.sum()
    q = q / q.sum()
    mask = p > 0
    if np.any(q[mask] == 0):
        return math.inf
    return float((p[mask] * np.log(p[mask] / q[mask])).sum() / math.log(base))


# ---------------------------------------------------------------------------
# 2. Maximum-entropy distributions
# ---------------------------------------------------------------------------
# The one-line summaries: the least-structured distribution given the constraint.
#   - Known range $[a, b]$          → Uniform,     $H = \log(b - a)$
#   - Known mean $\mu > 0$          → Exponential, $H = 1 + \ln \mu$
#   - Known mean & variance $\sigma$→ Normal,      $H = \tfrac12 \ln(2\pi e \sigma^2)$
# The formulas below give the *differential* entropy (continuous-support version).

def uniform_entropy(a: float, b: float, base: float = 2.0) -> float:
    r"""Differential entropy of Uniform(a, b): $\log(b - a)$."""
    if b <= a:
        raise ValueError("need b > a")
    return math.log(b - a) / math.log(base)


def exponential_entropy(mean: float, base: float = 2.0) -> float:
    r"""Differential entropy of Exponential(mean $\mu$): $1 + \ln \mu$ in nats."""
    if mean <= 0:
        raise ValueError("need mean > 0")
    return (1.0 + math.log(mean)) / math.log(base)


def normal_entropy(sigma: float, base: float = 2.0) -> float:
    r"""Differential entropy of Normal($\sigma$): $\tfrac12 \ln(2\pi e \sigma^2)$ in nats."""
    if sigma <= 0:
        raise ValueError("need sigma > 0")
    return 0.5 * math.log(2.0 * math.pi * math.e * sigma * sigma) / math.log(base)


# ---------------------------------------------------------------------------
# 3. Elementary cellular automata (Wolfram rules 0–255)
# ---------------------------------------------------------------------------

def _rule_table(rule: int) -> np.ndarray:
    """8-entry lookup indexed by 3-bit pattern ``(left << 2) | (centre << 1) | right``."""
    if not (0 <= rule <= 255):
        raise ValueError("rule must be in [0, 255]")
    return np.array([(rule >> i) & 1 for i in range(8)], dtype=np.int8)


def elementary_ca_step(row: np.ndarray, rule: int, wrap: bool = True) -> np.ndarray:
    """One step of a 1-D elementary cellular automaton."""
    row = np.asarray(row, dtype=np.int8)
    table = _rule_table(rule)
    if wrap:
        left = np.roll(row, 1)
        right = np.roll(row, -1)
    else:
        left = np.concatenate([[np.int8(0)], row[:-1]])
        right = np.concatenate([row[1:], [np.int8(0)]])
    idx = (left.astype(np.int32) << 2) | (row.astype(np.int32) << 1) | right.astype(np.int32)
    return table[idx]


InitialKind = Literal["single", "random"]


def make_initial_row(
    width: int,
    kind: InitialKind = "single",
    density: float = 0.5,
    seed: int | None = 42,
) -> np.ndarray:
    """Starting row for a CA run.

    - ``kind="single"``: a single 1 at the centre, zeros elsewhere (Wolfram's
      canonical setup that reveals a rule's "signature").
    - ``kind="random"``: each cell independently 1 with probability ``density``.
    """
    if width < 3:
        raise ValueError("width must be ≥ 3")
    if kind == "single":
        row = np.zeros(width, dtype=np.int8)
        row[width // 2] = 1
        return row
    if kind == "random":
        if not 0.0 <= density <= 1.0:
            raise ValueError("density must be in [0, 1]")
        rng = get_rng(seed)
        return (rng.random(width) < density).astype(np.int8)
    raise ValueError(f"unknown kind {kind!r}; expected 'single' or 'random'")


@dataclass(frozen=True)
class CAResult:
    """A run of a 1-D elementary cellular automaton.

    Attributes
    ----------
    grid:
        2-D ``int8`` array of shape ``(steps + 1, width)``. Row 0 is the initial
        row; row t is the state after t applications of the rule.
    rule:
        The Wolfram rule number 0–255 that was used.
    wrap:
        Whether the row wraps toroidally (True) or has zero-padded boundaries.
    row_entropies:
        Length ``steps + 1`` array. For each time-step, the Shannon entropy in
        bits of the row's 0/1 distribution. A monochrome row has 0; a 50/50
        mix has 1.
    block_entropy_final:
        Empirical entropy in bits of length-``block_k`` horizontal windows over
        the *tail* of the run (transients removed). A signature of ruggedness.
    block_k:
        The window length used for ``block_entropy_final``.
    wolfram_class:
        Heuristic Wolfram class (1 = equilibrium, 2 = periodic, 3 = random,
        4 = complex). See :func:`classify_ca` for the rules.
    """

    grid: np.ndarray
    rule: int
    wrap: bool
    row_entropies: np.ndarray
    block_entropy_final: float
    block_k: int
    wolfram_class: int


def row_entropies(grid: np.ndarray) -> np.ndarray:
    """1-bit entropy of each row's 0/1 distribution."""
    grid = np.asarray(grid, dtype=int)
    if grid.ndim == 1:
        grid = grid[None, :]
    p1 = grid.mean(axis=1)
    p0 = 1.0 - p1
    out = np.zeros_like(p1, dtype=float)
    # H = -p log2 p ; contributions are 0 when the probability is 0
    mask0 = p0 > 0
    mask1 = p1 > 0
    out[mask0] -= p0[mask0] * np.log2(p0[mask0])
    out[mask1] -= p1[mask1] * np.log2(p1[mask1])
    return out


def block_entropy(grid: np.ndarray, k: int = 4, base: float = 2.0) -> float:
    """Empirical entropy of length-*k* horizontal blocks aggregated over the grid.

    A random binary grid gives entropy close to ``k`` bits. A frozen or
    monochrome grid gives 0. Middling values are the signature of complex
    (class 4) rules.
    """
    grid = np.asarray(grid, dtype=int)
    if grid.ndim == 1:
        grid = grid[None, :]
    rows, cols = grid.shape
    if cols < k or k < 1:
        return 0.0
    windows = sliding_window_view(grid, k, axis=1)   # (rows, cols-k+1, k)
    powers = 1 << np.arange(k - 1, -1, -1)
    keys = (windows * powers).sum(axis=-1)           # (rows, cols-k+1)
    counts = np.bincount(keys.ravel(), minlength=1 << k).astype(float)
    return shannon_entropy(counts / counts.sum(), base)


def classify_ca(grid: np.ndarray, block_k: int = 4, tail_frac: float = 0.5) -> int:
    """Heuristic Wolfram class (1/2/3/4) from a run's space-time diagram.

    - **1 (equilibrium)**: the tail is all-0 or all-1.
    - **2 (periodic)**: the last two rows of the tail also appear ``period`` rows
      earlier, for some small period ≤ 32.
    - **3 (random)**: normalised block entropy > 0.85.
    - **4 (complex)**: none of the above — structured but non-periodic.
    """
    grid = np.asarray(grid, dtype=int)
    if grid.ndim != 2 or grid.size == 0:
        return 1
    tail_start = int(grid.shape[0] * (1.0 - tail_frac))
    tail = grid[tail_start:]

    total = tail.sum()
    if total == 0 or total == tail.size:
        return 1

    max_period = min(32, tail.shape[0] // 2 - 1)
    if max_period >= 1:
        for period in range(1, max_period + 1):
            if (np.array_equal(tail[-1], tail[-1 - period])
                    and np.array_equal(tail[-2], tail[-2 - period])):
                return 2

    h = block_entropy(tail, k=block_k)
    if block_k > 0 and h / block_k > 0.85:
        return 3
    return 4


# Well-known Wolfram-class assignments for a handful of famous rules.
# From Wolfram, *A New Kind of Science* (2002) and the traditional CA literature.
WOLFRAM_CLASSES: dict[int, int] = {
    # Class 1 — die out or lock to a fixed state
    0:   1,   8: 1,  32: 1,  40: 1,
    128: 1, 136: 1, 160: 1, 168: 1,
    # Class 2 — simple periodic / nested structures
    1: 2,   2: 2,   4: 2,   5: 2,  10: 2,  12: 2,  15: 2,
    24: 2,  36: 2,  50: 2,  51: 2, 108: 2, 132: 2, 156: 2, 184: 2,
    # Class 3 — chaotic / statistically random-looking
    18: 3,  22: 3,  30: 3,  45: 3,  60: 3,  75: 3,  90: 3,
    105: 3, 122: 3, 126: 3, 129: 3, 146: 3, 150: 3, 165: 3,
    # Class 4 — complex / edge of chaos (rare; only two universally accepted)
    54: 4, 110: 4,
}

CLASS_NAMES: dict[int, str] = {
    1: "equilibrium",
    2: "periodic",
    3: "random",
    4: "complex",
}


def run_elementary_ca(
    *,
    rule: int,
    width: int = 121,
    steps: int = 200,
    initial: np.ndarray | None = None,
    initial_kind: InitialKind = "single",
    initial_density: float = 0.5,
    wrap: bool = True,
    seed: int | None = 42,
    block_k: int = 4,
) -> CAResult:
    """Run Wolfram rule ``rule`` for ``steps`` steps.

    Parameters
    ----------
    rule:
        Wolfram rule number in [0, 255].
    width:
        Cells per row.
    steps:
        Number of transitions to apply. The returned grid has ``steps + 1``
        rows (initial state plus one per step).
    initial:
        Optional starting row; if given, ``initial_kind`` / ``initial_density``
        are ignored.
    initial_kind:
        ``"single"`` (a single 1 at the centre) or ``"random"``.
    initial_density:
        Only used when ``initial_kind == "random"``.
    wrap:
        Toroidal edges if True (standard), zero-padded otherwise.
    seed:
        RNG seed for random initial rows.
    block_k:
        Window length for the final block-entropy readout.
    """
    if steps < 1:
        raise ValueError("steps must be ≥ 1")
    if initial is None:
        row = make_initial_row(width, kind=initial_kind,
                               density=initial_density, seed=seed)
    else:
        row = np.asarray(initial, dtype=np.int8).copy()
        if row.ndim != 1:
            raise ValueError("initial must be 1-D")
        width = row.size

    grid = np.zeros((steps + 1, width), dtype=np.int8)
    grid[0] = row
    for t in range(1, steps + 1):
        grid[t] = elementary_ca_step(grid[t - 1], rule=rule, wrap=wrap)

    return CAResult(
        grid=grid,
        rule=rule,
        wrap=wrap,
        row_entropies=row_entropies(grid),
        block_entropy_final=block_entropy(grid[grid.shape[0] // 2:], k=block_k),
        block_k=block_k,
        wolfram_class=classify_ca(grid, block_k=block_k),
    )
