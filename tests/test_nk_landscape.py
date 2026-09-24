"""Invariants of the Ch 28 NK landscape simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.learning.nk_landscape import (
    META,
    NKLandscape,
    compare_strategies,
    count_local_peaks,
    hill_climb,
    long_jump,
    random_restart,
)


def test_meta_is_ch28_nk():
    assert META.chapter == 28
    assert META.slug == "nk_landscape"


def test_fitness_in_unit_interval():
    land = NKLandscape(N=8, K=2, seed=1)
    for _ in range(20):
        x = np.random.default_rng(_).integers(0, 2, size=8, dtype=np.int8)
        f = land.fitness(x)
        assert 0.0 <= f <= 1.0


def test_hill_climb_ends_at_local_peak():
    """After hill climbing, no single-bit flip should strictly improve fitness."""
    land = NKLandscape(N=8, K=2, seed=2)
    result = hill_climb(land, budget=500, seed=0)
    x = result.best_solution
    f = land.fitness(x)
    for j in range(land.N):
        y = x.copy(); y[j] = 1 - y[j]
        assert land.fitness(y) <= f + 1e-9


def test_trajectory_is_monotone_nondecreasing():
    """Best-so-far must never go down."""
    land = NKLandscape(N=8, K=3, seed=3)
    for fn in [hill_climb, random_restart, long_jump]:
        r = fn(land, budget=300, seed=0)  # type: ignore[operator]
        diffs = np.diff(r.trajectory)
        assert diffs.min() >= -1e-9, (fn.__name__, diffs.min())


def test_seed_is_deterministic():
    a = compare_strategies(N=8, K=2, budget=200, seed=7)
    b = compare_strategies(N=8, K=2, budget=200, seed=7)
    for k in a:
        np.testing.assert_array_equal(a[k].best_solution, b[k].best_solution)
        assert a[k].best_fitness == b[k].best_fitness


def test_K0_has_single_peak():
    """K = 0 ⇒ decisions independent ⇒ unique global peak."""
    land = NKLandscape(N=6, K=0, seed=4)
    assert count_local_peaks(land) == 1


def test_rugged_has_many_peaks():
    """K = N - 1 gives many local peaks on average."""
    land = NKLandscape(N=8, K=7, seed=5)
    assert count_local_peaks(land) > 5


def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        NKLandscape(N=1, K=0)
    with pytest.raises(ValueError):
        NKLandscape(N=8, K=8)   # K must be ≤ N - 1
    with pytest.raises(ValueError):
        NKLandscape(N=8, K=-1)
