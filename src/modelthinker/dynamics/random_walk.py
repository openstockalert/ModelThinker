"""Chapter 13 — Random walks.

A simple ±1 step process that produces the √t scaling law, the return-time paradox
(certain return in 1-D with infinite expected wait), Pólya's dimension-dependent
recurrence, and the arcsine law for time-in-the-lead.

Full write-up: ``docs/models/ch13_random_walk.md``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=13,
    name="Random walks",
    slug="random_walk",
    part="dynamics",
    redcape=("Explain", "Explore", "Predict", "Communicate"),
    summary=(
        "A directionless ±1 process gives the √t rule, return-time power laws, "
        "Pólya's dimension-dependent recurrence, and the arcsine law — the null "
        "model against which markets, sports streaks, and firm lifetimes should be judged."
    ),
    tags=("stochastic", "Pólya's theorem", "arcsine law", "√t"),
)

StepType = Literal["bernoulli", "normal"]


@dataclass(frozen=True)
class WalksResult:
    """One or many 1-D walks."""

    positions: np.ndarray   # shape (n_walks, steps + 1); each row starts at 0
    step_type: StepType
    drift: float
    steps: int
    n_walks: int


@dataclass(frozen=True)
class ReturnTimeResult:
    """First-return times for a batch of 1-D walks."""

    times: np.ndarray       # shape (n_walks,) — int; 0 means "did not return within max_steps"
    max_steps: int
    n_walks: int

    @property
    def n_returned(self) -> int:
        return int((self.times > 0).sum())

    @property
    def return_fraction(self) -> float:
        return self.n_returned / self.n_walks if self.n_walks else 0.0

    @property
    def returned_times(self) -> np.ndarray:
        """Only the walks that actually returned (drops the truncated ones)."""
        return self.times[self.times > 0]


@dataclass(frozen=True)
class DimensionResult:
    """Pólya-recurrence experiment for a chosen dimension."""

    dim: int
    n_walks: int
    max_steps: int
    n_returned: int
    return_fraction: float
    first_return_times: np.ndarray   # 0 for walks that never returned


# ---------------------------------------------------------------------------
# 1-D walks
# ---------------------------------------------------------------------------

def many_walks(
    *,
    n_walks: int = 500,
    steps: int = 1000,
    step_type: StepType = "bernoulli",
    drift: float = 0.0,
    sigma: float = 1.0,
    seed: int | None = 42,
) -> WalksResult:
    """Simulate ``n_walks`` independent 1-D walks of length ``steps``.

    Parameters
    ----------
    n_walks:
        Number of independent walks.
    steps:
        Number of steps per walk. Each returned trajectory has length ``steps + 1``
        (the leading 0 is included).
    step_type:
        ``"bernoulli"`` — ±1 with equal probability (mean 0, var 1).
        ``"normal"``    — draws from N(drift, sigma²).
    drift:
        Mean of each step. For ``"bernoulli"`` a nonzero drift biases the sign
        probability (``p_up = 0.5 + drift/2``, clipped to [0, 1]).
    sigma:
        Standard deviation for the normal step (ignored for Bernoulli).
    seed:
        RNG seed.
    """
    if n_walks < 1 or steps < 1:
        raise ValueError("n_walks and steps must be ≥ 1")
    rng = get_rng(seed)
    if step_type == "bernoulli":
        p_up = 0.5 + drift / 2.0
        if not 0.0 <= p_up <= 1.0:
            raise ValueError("drift out of range: implied P(step=+1) must be in [0, 1]")
        raw = rng.choice([-1, 1], size=(n_walks, steps), p=[1 - p_up, p_up]).astype(np.int64)
    elif step_type == "normal":
        raw = rng.normal(loc=drift, scale=sigma, size=(n_walks, steps))
    else:
        raise ValueError(f"unknown step_type {step_type!r}")
    trajectories = np.concatenate([np.zeros((n_walks, 1)), np.cumsum(raw, axis=1)], axis=1)
    return WalksResult(
        positions=trajectories, step_type=step_type, drift=drift,
        steps=steps, n_walks=n_walks,
    )


def simulate(
    *,
    steps: int = 1000,
    step_type: StepType = "bernoulli",
    drift: float = 0.0,
    sigma: float = 1.0,
    seed: int | None = 42,
) -> np.ndarray:
    """Convenience wrapper — one walk, returned as a length ``steps + 1`` array."""
    return many_walks(
        n_walks=1, steps=steps, step_type=step_type,
        drift=drift, sigma=sigma, seed=seed,
    ).positions[0]


def rms_displacement(result: WalksResult) -> np.ndarray:
    """Root-mean-square displacement at each time step: shape ``(steps + 1,)``."""
    return np.sqrt(np.mean(result.positions ** 2, axis=0))


# ---------------------------------------------------------------------------
# First-return times (1-D, Bernoulli)
# ---------------------------------------------------------------------------

def return_times(
    *,
    n_walks: int = 5_000,
    max_steps: int = 10_000,
    seed: int | None = 42,
) -> ReturnTimeResult:
    """First-return times of ``n_walks`` independent 1-D Bernoulli walks.

    Returns time = 0 for walks that did *not* return within ``max_steps`` (truncated).
    Note that returns can only happen at even times.
    """
    if n_walks < 1 or max_steps < 1:
        raise ValueError("n_walks and max_steps must be ≥ 1")
    rng = get_rng(seed)
    # We simulate step-by-step in batch, tracking who hasn't returned yet.
    times = np.zeros(n_walks, dtype=np.int64)
    positions = np.zeros(n_walks, dtype=np.int64)
    alive = np.ones(n_walks, dtype=bool)
    # First step: guaranteed nonzero (can't return at t=1 from position 0).
    positions[alive] += rng.choice([-1, 1], size=alive.sum())
    for t in range(2, max_steps + 1):
        if not alive.any():
            break
        idx = np.where(alive)[0]
        steps_now = rng.choice([-1, 1], size=idx.size)
        positions[idx] += steps_now
        just_returned = positions[idx] == 0
        if just_returned.any():
            returned_idx = idx[just_returned]
            times[returned_idx] = t
            alive[returned_idx] = False
    return ReturnTimeResult(times=times, max_steps=max_steps, n_walks=n_walks)


def theoretical_return_survival(t: np.ndarray) -> np.ndarray:
    """P(T > t) for 1-D Bernoulli walk; asymptotic form ``sqrt(2/(π t))``."""
    t = np.asarray(t, dtype=float)
    return np.where(t > 0, np.sqrt(2.0 / (np.pi * np.maximum(t, 1.0))), 1.0)


# ---------------------------------------------------------------------------
# Pólya-recurrence in arbitrary dimension
# ---------------------------------------------------------------------------

def dimension_recurrence(
    *,
    dim: int = 2,
    n_walks: int = 500,
    max_steps: int = 5_000,
    seed: int | None = 42,
) -> DimensionResult:
    """Simulate ``n_walks`` walks on Z^dim and count how many return to origin.

    Each step picks an axis uniformly at random and moves ±1 in it.
    A "return" is any time ``t > 0`` where the position equals ``(0, ..., 0)``.
    """
    if dim < 1:
        raise ValueError("dim must be ≥ 1")
    if n_walks < 1 or max_steps < 1:
        raise ValueError("n_walks and max_steps must be ≥ 1")
    rng = get_rng(seed)
    positions = np.zeros((n_walks, dim), dtype=np.int64)
    first_return = np.zeros(n_walks, dtype=np.int64)
    alive = np.ones(n_walks, dtype=bool)
    for t in range(1, max_steps + 1):
        if not alive.any():
            break
        idx = np.where(alive)[0]
        axes = rng.integers(0, dim, size=idx.size)
        signs = rng.choice([-1, 1], size=idx.size)
        positions[idx, axes] += signs
        at_origin = np.all(positions[idx] == 0, axis=1)
        if at_origin.any():
            returned_idx = idx[at_origin]
            first_return[returned_idx] = t
            alive[returned_idx] = False
    n_ret = int((first_return > 0).sum())
    return DimensionResult(
        dim=dim, n_walks=n_walks, max_steps=max_steps,
        n_returned=n_ret, return_fraction=n_ret / n_walks,
        first_return_times=first_return,
    )


# ---------------------------------------------------------------------------
# Arcsine law: fraction of time positive
# ---------------------------------------------------------------------------

def arcsine_fractions(
    *,
    n_walks: int = 5_000,
    steps: int = 500,
    seed: int | None = 42,
) -> np.ndarray:
    """For each of ``n_walks`` 1-D Bernoulli walks of length ``steps``, return
    the fraction of steps where the position is > 0 (a leading walker).
    """
    if n_walks < 1 or steps < 1:
        raise ValueError("n_walks and steps must be ≥ 1")
    result = many_walks(n_walks=n_walks, steps=steps, step_type="bernoulli",
                        drift=0.0, seed=seed)
    # positions has shape (n_walks, steps+1); drop the initial 0 to avoid a tie point.
    positive = (result.positions[:, 1:] > 0).astype(float)
    return positive.mean(axis=1)


def arcsine_theoretical_cdf(x: np.ndarray) -> np.ndarray:
    """CDF ``2/π · arcsin(√x)`` for x in [0, 1]."""
    x = np.clip(np.asarray(x, dtype=float), 0.0, 1.0)
    return (2.0 / np.pi) * np.arcsin(np.sqrt(x))
