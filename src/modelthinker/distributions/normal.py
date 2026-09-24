"""Chapter 5 — Normal distributions and the Central Limit Theorem.

Sample repeatedly from any well-behaved source distribution and average the draws
into sample means — the CLT guarantees the distribution of those means converges
to a normal, regardless of the underlying source.

See ``docs/models/ch05_normal.md`` for the full write-up.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=5,
    name="Normal distributions",
    slug="normal",
    part="distributions",
    redcape=("Explain", "Predict", "Communicate"),
    summary=(
        "Averaging many independent draws gives the bell curve — the Central Limit "
        "Theorem in action, and the basis of six-sigma quality."
    ),
    tags=("CLT", "six sigma", "√n rule"),
)

Source = Literal["uniform", "exponential", "bernoulli", "chi_squared", "lognormal"]
_SOURCES: tuple[Source, ...] = ("uniform", "exponential", "bernoulli", "chi_squared", "lognormal")


@dataclass(frozen=True)
class NormalResult:
    """Output of a CLT simulation.

    Attributes
    ----------
    source:
        Name of the underlying distribution.
    n:
        Number of draws averaged into each sample mean.
    num_samples:
        Number of sample means drawn.
    sample_means:
        Array of shape ``(num_samples,)`` — the sample means.
    source_draws:
        Array of ``num_samples`` single draws from the underlying distribution,
        useful for plotting the source distribution alongside the sample means.
    theoretical_mean:
        Mean of the underlying distribution (μ).
    theoretical_std_mean:
        Predicted standard deviation of the sample mean, ``σ / √n``.
    """

    source: Source
    n: int
    num_samples: int
    sample_means: np.ndarray
    source_draws: np.ndarray
    theoretical_mean: float
    theoretical_std_mean: float


def _draw(rng: np.random.Generator, source: Source, size: int | tuple[int, ...]) -> np.ndarray:
    if source == "uniform":       # U(0, 1): μ = 0.5, σ² = 1/12
        return rng.uniform(0.0, 1.0, size=size)
    if source == "exponential":   # Exp(1): μ = 1, σ² = 1
        return rng.exponential(scale=1.0, size=size)
    if source == "bernoulli":     # Bern(0.5): μ = 0.5, σ² = 0.25
        return rng.binomial(n=1, p=0.5, size=size).astype(float)
    if source == "chi_squared":   # χ²(4): μ = 4, σ² = 8
        return rng.chisquare(df=4, size=size)
    if source == "lognormal":     # LogN(0, 1): heavy right tail — a contrast with the others.
        # μ = exp(0.5) ≈ 1.6487; σ² = (e − 1)·e ≈ 4.6708
        return rng.lognormal(mean=0.0, sigma=1.0, size=size)
    raise ValueError(f"Unknown source {source!r}; must be one of {_SOURCES}.")


def _theoretical(source: Source) -> tuple[float, float]:
    """Return (mean, std) of the underlying distribution."""
    if source == "uniform":     return 0.5, np.sqrt(1.0 / 12.0)
    if source == "exponential": return 1.0, 1.0
    if source == "bernoulli":   return 0.5, 0.5
    if source == "chi_squared": return 4.0, np.sqrt(8.0)
    if source == "lognormal":
        # μ = exp(m + s²/2), σ² = (exp(s²) − 1) · exp(2m + s²)  with m=0, s=1
        m, s = 0.0, 1.0
        mean = np.exp(m + s * s / 2)
        var = (np.exp(s * s) - 1) * np.exp(2 * m + s * s)
        return float(mean), float(np.sqrt(var))
    raise ValueError(source)


def simulate(
    *,
    source: Source = "uniform",
    n: int = 30,
    num_samples: int = 10_000,
    seed: int | None = 42,
) -> NormalResult:
    """Run the CLT simulation.

    Draws ``num_samples`` sample means, each the average of ``n`` independent
    draws from ``source``. Deterministic given ``seed``.

    Parameters
    ----------
    source:
        One of ``"uniform"``, ``"exponential"``, ``"bernoulli"``, ``"chi_squared"``,
        ``"lognormal"``. Lognormal is the interesting outlier: it is heavily right-skewed
        (its log is normal, not the value itself) and its sample means need very large
        ``n`` before they look Gaussian.
    n:
        Draws per sample mean. ``n = 1`` recovers the source distribution.
    num_samples:
        Number of sample means to compute (histogram resolution).
    seed:
        RNG seed for reproducibility. Pass ``None`` for entropy.
    """
    if n < 1:
        raise ValueError("n must be ≥ 1")
    if num_samples < 1:
        raise ValueError("num_samples must be ≥ 1")

    rng = get_rng(seed)
    draws = _draw(rng, source, size=(num_samples, n))
    sample_means = draws.mean(axis=1)
    source_draws = draws[:, 0]  # one representative column
    mu, sigma = _theoretical(source)
    return NormalResult(
        source=source,
        n=n,
        num_samples=num_samples,
        sample_means=sample_means,
        source_draws=source_draws,
        theoretical_mean=mu,
        theoretical_std_mean=sigma / np.sqrt(n),
    )


def sqrt_n_scan(
    *,
    source: Source = "uniform",
    ns: tuple[int, ...] = (1, 4, 16, 64, 256, 1024),
    num_samples: int = 5_000,
    seed: int | None = 42,
) -> dict[int, float]:
    """Return ``{n: empirical std of the sample mean}`` for a scan over ``ns``.

    Used to visualise the √n rule: doubling *n* only shrinks the std by √2.
    """
    return {
        n: float(simulate(source=source, n=n, num_samples=num_samples, seed=seed).sample_means.std())
        for n in ns
    }
