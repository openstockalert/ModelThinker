"""Chapter 6 — Power laws via Barabási–Albert preferential attachment.

Grow a network one node at a time; each new node attaches to ``m`` existing nodes
with probability proportional to their current degree. The resulting degree
distribution follows a power law with exponent ≈ 3.

Full write-up: ``docs/models/ch06_power_law.md``.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=6,
    name="Power laws (long tails)",
    slug="power_law",
    part="distributions",
    redcape=("Explain", "Predict", "Explore"),
    summary=(
        "Preferential attachment (rich-get-richer) produces power-law degree "
        "distributions — a straight line on log-log, dominated by a few hubs."
    ),
    tags=("scale-free", "Barabási-Albert", "80/20"),
)


@dataclass(frozen=True)
class PowerLawResult:
    n: int
    m: int
    degrees: np.ndarray          # degree of each of the n nodes
    edges: list[tuple[int, int]]
    top_degrees: list[tuple[int, int]]  # [(node_id, degree)] sorted desc
    estimated_exponent: float    # MLE on the empirical tail
    lorenz_x: np.ndarray         # cumulative fraction of nodes
    lorenz_y: np.ndarray         # cumulative fraction of total degree
    gini: float


def _mle_exponent(degrees: np.ndarray, k_min: int = 1) -> float:
    """Clauset MLE for the discrete power-law exponent on ``degrees >= k_min``."""
    x = degrees[degrees >= k_min].astype(float)
    if len(x) < 10:
        return float("nan")
    return 1.0 + len(x) / np.sum(np.log(x / (k_min - 0.5)))


def _lorenz(values: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """Return (x, y, gini) for the Lorenz curve of a nonnegative array."""
    v = np.sort(values.astype(float))
    n = len(v)
    total = v.sum()
    if total <= 0:
        xs = np.linspace(0, 1, n + 1)
        return xs, xs, 0.0
    x = np.arange(0, n + 1) / n
    cum = np.concatenate([[0.0], np.cumsum(v) / total])
    # Gini via 1 - 2 * area under Lorenz
    gini = 1.0 - 2.0 * np.trapezoid(cum, x)
    return x, cum, float(gini)


def simulate(
    *,
    n: int = 2000,
    m: int = 2,
    seed: int | None = 42,
    top_k: int = 10,
) -> PowerLawResult:
    """Grow a Barabási–Albert graph and summarise its degree distribution.

    Parameters
    ----------
    n:
        Final number of nodes. Must be > m.
    m:
        Edges added per new node.
    seed:
        RNG seed.
    top_k:
        How many top-degree nodes to include in ``top_degrees``.
    """
    if n <= m:
        raise ValueError("n must be greater than m")
    if m < 1:
        raise ValueError("m must be ≥ 1")

    rng = get_rng(seed)

    # Seed: complete graph on m + 1 nodes (each has degree m)
    n_seed = m + 1
    edges: list[tuple[int, int]] = []
    degrees = np.zeros(n, dtype=np.int64)
    for i in range(n_seed):
        for j in range(i + 1, n_seed):
            edges.append((i, j))
            degrees[i] += 1
            degrees[j] += 1

    # Preferential attachment: repeated proportional-to-degree sampling
    for new in range(n_seed, n):
        existing = np.arange(new)
        probs = degrees[:new] / degrees[:new].sum()
        # Without-replacement sample of size m
        targets = rng.choice(existing, size=m, replace=False, p=probs)
        for t in targets:
            edges.append((int(t), new))
            degrees[t] += 1
            degrees[new] += 1

    # Analytics
    est_gamma = _mle_exponent(degrees, k_min=m)
    lorenz_x, lorenz_y, gini = _lorenz(degrees)
    top_ix = np.argsort(-degrees)[:top_k]
    top = [(int(i), int(degrees[i])) for i in top_ix]

    return PowerLawResult(
        n=n, m=m, degrees=degrees, edges=edges,
        top_degrees=top, estimated_exponent=est_gamma,
        lorenz_x=lorenz_x, lorenz_y=lorenz_y, gini=gini,
    )


def degree_pmf(degrees: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return (ks, p_k) — empirical degree probability mass function."""
    counts = Counter(int(x) for x in degrees)
    ks = np.array(sorted(counts))
    total = sum(counts.values())
    p = np.array([counts[k] / total for k in ks])
    return ks, p
