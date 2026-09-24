"""Invariants of the Ch 6 Barabási–Albert power-law simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.distributions.power_law import META, degree_pmf, simulate


def test_meta_is_ch6_power_law():
    assert META.chapter == 6
    assert META.slug == "power_law"


def test_seed_is_deterministic():
    a = simulate(n=500, m=2, seed=1)
    b = simulate(n=500, m=2, seed=1)
    np.testing.assert_array_equal(a.degrees, b.degrees)


def test_degree_sum_equals_twice_edges():
    """Handshake lemma: sum of degrees = 2 |E|."""
    r = simulate(n=500, m=3, seed=2)
    assert int(r.degrees.sum()) == 2 * len(r.edges)


def test_min_degree_equals_m():
    """Every node except possibly initial ones has at least degree m."""
    r = simulate(n=500, m=4, seed=3)
    assert r.degrees.min() >= r.m


def test_estimated_exponent_near_3():
    """BA large-network exponent is ≈ 3; MLE should recover it within tolerance."""
    r = simulate(n=8000, m=2, seed=4)
    assert 2.4 < r.estimated_exponent < 3.6, r.estimated_exponent


def test_top_hub_is_bigger_than_median():
    r = simulate(n=1000, m=2, seed=5)
    top_deg = r.top_degrees[0][1]
    median = int(np.median(r.degrees))
    assert top_deg > 5 * median


def test_lorenz_and_gini_bounds():
    r = simulate(n=1000, m=2, seed=6)
    assert 0.0 <= r.gini <= 1.0
    assert r.lorenz_x[0] == 0.0 and r.lorenz_x[-1] == 1.0
    assert r.lorenz_y[0] == 0.0 and r.lorenz_y[-1] == pytest.approx(1.0)


def test_degree_pmf_sums_to_one():
    r = simulate(n=500, m=2, seed=7)
    _, p = degree_pmf(r.degrees)
    assert p.sum() == pytest.approx(1.0)


def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        simulate(n=2, m=2)
    with pytest.raises(ValueError):
        simulate(n=100, m=0)
