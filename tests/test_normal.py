"""Invariants of the Ch 5 Normal / CLT simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.distributions.normal import META, simulate, sqrt_n_scan


def test_meta_is_ch5_normal():
    assert META.chapter == 5
    assert META.slug == "normal"
    assert "Explain" in META.redcape


def test_seed_is_deterministic():
    a = simulate(source="uniform", n=30, num_samples=1000, seed=123)
    b = simulate(source="uniform", n=30, num_samples=1000, seed=123)
    np.testing.assert_array_equal(a.sample_means, b.sample_means)


@pytest.mark.parametrize("source", ["uniform", "exponential", "bernoulli", "chi_squared", "lognormal"])
def test_sample_mean_converges_to_true_mean(source):
    """Empirical mean of sample means should be within a few standard errors of μ."""
    r = simulate(source=source, n=100, num_samples=5000, seed=7)
    tol = 5 * r.theoretical_std_mean / np.sqrt(r.num_samples)  # SE of the mean-of-means
    assert abs(r.sample_means.mean() - r.theoretical_mean) < tol


@pytest.mark.parametrize("source", ["uniform", "exponential", "bernoulli", "chi_squared", "lognormal"])
def test_std_of_sample_means_matches_sigma_over_sqrt_n(source):
    """Empirical std of sample means should be close to σ/√n (within 5%)."""
    r = simulate(source=source, n=200, num_samples=10_000, seed=11)
    ratio = r.sample_means.std(ddof=1) / r.theoretical_std_mean
    assert 0.95 < ratio < 1.05, ratio


def test_sqrt_n_rule():
    """Doubling n should shrink the empirical std by ≈ √2."""
    scan = sqrt_n_scan(source="uniform", ns=(25, 100, 400), num_samples=5000, seed=3)
    ratio_100_25  = scan[25]  / scan[100]
    ratio_400_100 = scan[100] / scan[400]
    # Each step multiplies n by 4, so std should shrink by ≈ 2×.
    assert 1.8 < ratio_100_25  < 2.2, scan
    assert 1.8 < ratio_400_100 < 2.2, scan


def test_shape_and_range():
    r = simulate(source="uniform", n=10, num_samples=500, seed=1)
    assert r.sample_means.shape == (500,)
    assert r.source_draws.shape == (500,)
    # Sample means of U(0,1) draws must lie in [0, 1].
    assert r.sample_means.min() >= 0.0 and r.sample_means.max() <= 1.0


def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        simulate(source="uniform", n=0, num_samples=100)
    with pytest.raises(ValueError):
        simulate(source="uniform", n=10, num_samples=0)
    with pytest.raises(ValueError):
        simulate(source="not_a_dist", n=10, num_samples=100)  # type: ignore[arg-type]
