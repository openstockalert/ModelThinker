"""Chapter 14 — Path dependence via urn models.

Three urn variants sharing one core mechanic — draw a ball, then update the
urn — decide whether history matters.

- **Bernoulli urn**: urn unchanged. Draws are IID. No path dependence.
- **Pólya urn**: add another of the same colour. Positive feedback →
  the long-run share is *random* (Beta(R₀, B₀)-distributed) and history
  gets fully locked in.
- **Balancing urn**: add one of the *opposite* colour. Negative feedback →
  fraction converges deterministically to ½ regardless of history.

Full write-up: ``docs/models/ch14_path_dependence.md``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=14,
    name="Path dependence (urn models)",
    slug="path_dependence",
    part="dynamics",
    redcape=("Explain", "Predict", "Explore"),
    summary=(
        "Three urns — no memory, positive feedback, negative feedback — decide "
        "whether history locks in, gets ignored, or gets erased."
    ),
    tags=("path dependence", "positive feedback", "Pólya urn"),
)

UrnType = Literal["bernoulli", "polya", "balancing"]
_URN_TYPES: tuple[UrnType, ...] = ("bernoulli", "polya", "balancing")


@dataclass(frozen=True)
class UrnResult:
    """Multiple independent trajectories of an urn simulation.

    Attributes
    ----------
    urn_type:
        Which update rule was used.
    initial_red, initial_blue:
        Starting composition.
    steps:
        Number of draws per trajectory.
    n_walks:
        Number of independent trajectories.
    urn_fraction:
        Shape ``(n_walks, steps + 1)``. Row *i* is the fraction of red *balls in
        the urn* after each step of trajectory *i*. Constant for Bernoulli
        (urn never updates); random-drift for Pólya; converges to ½ for
        Balancing.
    draw_fraction:
        Shape ``(n_walks, steps + 1)``. Row *i* is the cumulative fraction of
        *red draws* in the first ``t`` steps. Starts undefined at ``t = 0`` — we
        fill it with the initial urn fraction as a sensible placeholder.
    """

    urn_type: UrnType
    initial_red: int
    initial_blue: int
    steps: int
    n_walks: int
    urn_fraction: np.ndarray
    draw_fraction: np.ndarray


def simulate(
    *,
    urn_type: UrnType = "polya",
    steps: int = 500,
    initial_red: int = 1,
    initial_blue: int = 1,
    n_walks: int = 1,
    seed: int | None = 42,
) -> UrnResult:
    """Simulate ``n_walks`` independent urn trajectories.

    Parameters
    ----------
    urn_type:
        One of ``"bernoulli"``, ``"polya"``, ``"balancing"``.
    steps:
        Number of draws per trajectory.
    initial_red, initial_blue:
        Starting counts; both must be ≥ 1.
    n_walks:
        Number of independent trajectories to simulate (vectorised).
    seed:
        RNG seed for reproducibility.
    """
    if urn_type not in _URN_TYPES:
        raise ValueError(f"unknown urn_type {urn_type!r}; must be one of {_URN_TYPES}")
    if steps < 1:
        raise ValueError("steps must be ≥ 1")
    if initial_red < 1 or initial_blue < 1:
        raise ValueError("initial_red and initial_blue must both be ≥ 1")
    if n_walks < 1:
        raise ValueError("n_walks must be ≥ 1")

    rng = get_rng(seed)
    initial_frac = initial_red / (initial_red + initial_blue)

    urn_frac = np.zeros((n_walks, steps + 1), dtype=float)
    draw_frac = np.zeros((n_walks, steps + 1), dtype=float)
    urn_frac[:, 0] = initial_frac
    draw_frac[:, 0] = initial_frac  # placeholder — no draws yet

    R = np.full(n_walks, initial_red, dtype=np.int64)
    B = np.full(n_walks, initial_blue, dtype=np.int64)
    cum_red_draws = np.zeros(n_walks, dtype=np.int64)

    if urn_type == "bernoulli":
        # Urn is fixed. Draws are IID Bernoulli(p).
        p = float(initial_frac)
        # Pre-generate all draws for speed — a matrix (n_walks, steps) of 0/1.
        draws = (rng.random((n_walks, steps)) < p).astype(np.int64)
        cum = np.cumsum(draws, axis=1)
        # urn_frac stays constant at initial_frac
        urn_frac[:, 1:] = initial_frac
        # draw_frac[t] = cum[t-1] / t  for t ≥ 1
        for t in range(1, steps + 1):
            draw_frac[:, t] = cum[:, t - 1] / t
        return UrnResult(
            urn_type=urn_type,
            initial_red=initial_red, initial_blue=initial_blue,
            steps=steps, n_walks=n_walks,
            urn_fraction=urn_frac, draw_fraction=draw_frac,
        )

    for t in range(steps):
        total = R + B
        p = R / total
        drew_red = rng.random(n_walks) < p
        cum_red_draws += drew_red.astype(np.int64)
        if urn_type == "polya":
            R += drew_red.astype(np.int64)
            B += (~drew_red).astype(np.int64)
        else:  # balancing
            R += (~drew_red).astype(np.int64)
            B += drew_red.astype(np.int64)
        urn_frac[:, t + 1] = R / (R + B)
        draw_frac[:, t + 1] = cum_red_draws / (t + 1)

    return UrnResult(
        urn_type=urn_type,
        initial_red=initial_red, initial_blue=initial_blue,
        steps=steps, n_walks=n_walks,
        urn_fraction=urn_frac, draw_fraction=draw_frac,
    )


def final_share_entropy(finals: np.ndarray, n_bins: int = 20) -> float:
    """Shannon entropy (in bits) of a final-share distribution on [0, 1].

    High entropy → outcomes spread out → path dependence.
    Low entropy → outcomes concentrated → no (equilibrium) path dependence.

    Bounded above by ``log2(n_bins)``.
    """
    finals = np.asarray(finals, dtype=float).ravel()
    counts, _ = np.histogram(finals, bins=n_bins, range=(0.0, 1.0))
    p = counts[counts > 0] / counts.sum()
    return float(-np.sum(p * np.log2(p))) if p.size else 0.0


def theoretical_polya_pdf(
    x: np.ndarray, initial_red: int = 1, initial_blue: int = 1
) -> np.ndarray:
    """PDF of the long-run Pólya-urn fraction.

    Starting with (``initial_red``, ``initial_blue``) the limit distribution is
    ``Beta(initial_red, initial_blue)``. For the classic symmetric start
    (1, 1) this is the uniform distribution on [0, 1].
    """
    from scipy.stats import beta as _beta

    return _beta.pdf(np.asarray(x, dtype=float), initial_red, initial_blue)
