"""Invariants of the Ch 15 Schelling simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.dynamics.schelling import EMPTY, META, TYPE_A, TYPE_B, simulate


def test_meta_is_ch15_schelling():
    assert META.chapter == 15
    assert META.slug == "schelling"


def test_seed_is_deterministic():
    a = simulate(grid_size=20, density=0.8, tolerance=0.3, max_steps=500, seed=1)
    b = simulate(grid_size=20, density=0.8, tolerance=0.3, max_steps=500, seed=1)
    np.testing.assert_array_equal(a.grid_history[-1], b.grid_history[-1])
    assert a.seg_index_history == b.seg_index_history


def test_population_conserved():
    """Number of agents of each type is preserved across every snapshot."""
    r = simulate(grid_size=20, density=0.85, tolerance=0.3, max_steps=1000, seed=2)
    initial = r.grid_history[0]
    n_a = int((initial == TYPE_A).sum())
    n_b = int((initial == TYPE_B).sum())
    n_empty = int((initial == EMPTY).sum())
    for g in r.grid_history:
        assert (g == TYPE_A).sum() == n_a
        assert (g == TYPE_B).sum() == n_b
        assert (g == EMPTY).sum() == n_empty


def test_segregation_increases_from_random():
    """The classic Schelling result: segregation rises from ~0.5 to ≥ 0.7 by convergence."""
    r = simulate(grid_size=30, density=0.9, tolerance=0.3, max_steps=8000, seed=3)
    assert r.seg_index_history[0] < 0.6, r.seg_index_history[0]
    assert r.seg_index_history[-1] > 0.7, r.seg_index_history[-1]


def test_low_tolerance_converges_quickly():
    """At τ = 0.1 everyone is easily happy — the model should converge fast."""
    r = simulate(grid_size=20, density=0.8, tolerance=0.1, max_steps=3000, seed=4)
    assert r.converged
    # Almost no unhappy agents even at start.
    assert r.unhappy_history[-1] == 0


def test_final_segregation_bounds():
    """Segregation index is always in [0, 1]."""
    r = simulate(grid_size=15, density=0.85, tolerance=0.4, max_steps=1000, seed=5)
    for s in r.seg_index_history:
        assert 0.0 <= s <= 1.0


def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        simulate(grid_size=2, density=0.5, tolerance=0.3)
    with pytest.raises(ValueError):
        simulate(grid_size=10, density=1.5, tolerance=0.3)
    with pytest.raises(ValueError):
        simulate(grid_size=10, density=0.5, tolerance=-0.1)
