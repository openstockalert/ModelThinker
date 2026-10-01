"""Invariants for the Ch 19 Threshold-with-feedback module — Granovetter
cascades, the Watts network cascade, and Arthur's El Farol bar."""

from __future__ import annotations

import networkx as nx
import numpy as np
import pytest

from modelthinker.dynamics.threshold_feedback import (
    META,
    PREDICTORS,
    _shannon_from_samples,
    cascade_variance_sweep,
    network_cascade,
    sample_normal_thresholds,
    sample_uniform_thresholds,
    simulate_cascade,
    simulate_el_farol,
)

# --------------------------------------------------------------------------
# META
# --------------------------------------------------------------------------

def test_meta_is_ch19_threshold_feedback():
    assert META.chapter == 19
    assert META.slug == "threshold_feedback"
    assert META.part == "dynamics"


# --------------------------------------------------------------------------
# Granovetter cascade — the canonical pair
# --------------------------------------------------------------------------

def test_uniform_thresholds_cascade_fully():
    """Thresholds 0, 1, 2, …, 99 with one instigator → everyone joins."""
    thr = sample_uniform_thresholds(n=100)
    r = simulate_cascade(thr, instigators=0)
    # threshold[0] = 0 joins unconditionally; then threshold[1] = 1 joins, etc.
    assert r.final_size == 100


def test_missing_rung_stops_cascade():
    """Canonical Page counter-example: move threshold 1 → 2 and the cascade
    dies after the single instigator."""
    thr = np.array([0, 2, 2, 3, 4, 5, 6, 7, 8, 9], dtype=float)
    r = simulate_cascade(thr, instigators=0)
    # threshold=0 joins alone; nobody has threshold=1, so the cascade stalls
    assert r.final_size == 1


def test_cascade_is_monotone():
    """Cumulative acting count never decreases."""
    thr = np.array([2, 3, 3, 4, 5, 6, 7, 8, 9, 10], dtype=float)
    r = simulate_cascade(thr, instigators=3)
    # History should be non-decreasing
    assert all(r.history[i] <= r.history[i + 1] for i in range(len(r.history) - 1))


def test_cascade_is_deterministic_given_thresholds():
    thr = np.array([0.0, 1, 2, 5, 10])
    a = simulate_cascade(thr, instigators=1)
    b = simulate_cascade(thr, instigators=1)
    assert a.final_size == b.final_size
    assert a.history == b.history


def test_cascade_size_bounded_by_population():
    thr = np.random.default_rng(0).uniform(0, 100, size=100)
    r = simulate_cascade(thr)
    assert 0 <= r.final_size <= 100


def test_empty_population():
    r = simulate_cascade(np.array([]))
    assert r.final_size == 0


def test_instigators_can_start_the_cascade():
    """Ten cautious people (threshold 3 each). One instigator → dead. Three
    instigators → all cascade."""
    thr = np.full(10, 3.0)
    assert simulate_cascade(thr, instigators=1).final_size == 0
    assert simulate_cascade(thr, instigators=3).final_size == 10


# --------------------------------------------------------------------------
# Threshold samplers
# --------------------------------------------------------------------------

def test_sample_normal_thresholds_shape_and_clip():
    t = sample_normal_thresholds(mean=25, sd=10, n=1000, seed=0)
    assert t.shape == (1000,)
    assert t.min() >= 0
    assert t.max() <= 1000


def test_sample_normal_deterministic_given_seed():
    a = sample_normal_thresholds(mean=25, sd=10, n=50, seed=7)
    b = sample_normal_thresholds(mean=25, sd=10, n=50, seed=7)
    np.testing.assert_array_equal(a, b)


# --------------------------------------------------------------------------
# Variance sweep — bimodality and the tipping-point signature
# --------------------------------------------------------------------------

def test_variance_sweep_shape():
    r = cascade_variance_sweep(mean_threshold=25, sds=[2, 15, 25],
                               n_agents=50, n_runs=20, seed=1)
    assert r.outcome_matrix.shape == (3, 20)
    assert r.mean_outcome.shape == (3,)
    assert r.entropy_bits.shape == (3,)


def test_low_variance_produces_no_cascades():
    """When SD is tiny (very homogeneous), nobody starts, and outcomes cluster
    near 0 → high fraction fizzled, near-zero mean."""
    r = cascade_variance_sweep(mean_threshold=25, sds=[1.0],
                               n_agents=100, n_runs=100, instigators=0, seed=1)
    assert r.mean_outcome[0] < 5
    assert r.fraction_fizzle[0] > 0.9


def test_wide_variance_narrow_bimodality():
    """At moderate SD the outcome distribution is bimodal: mostly full riots
    or mostly fizzles, very little in between."""
    r = cascade_variance_sweep(mean_threshold=25, sds=[20.0],
                               n_agents=100, n_runs=200, instigators=1, seed=3)
    frac_middle = ((r.outcome_matrix[0] > 10) & (r.outcome_matrix[0] < 90)).mean()
    # Bimodality → very few results in the middle band
    assert frac_middle < 0.20


def test_entropy_is_bounded_by_bins():
    """H can't exceed log2(n_bins)."""
    samples = np.random.default_rng(0).integers(0, 100, size=500)
    h = _shannon_from_samples(samples, n_bins=10, lo=0, hi=100)
    assert 0 <= h <= np.log2(10) + 1e-9


def test_entropy_zero_for_all_same():
    """Perfectly certain outcome → 0 entropy."""
    samples = np.array([50, 50, 50, 50])
    h = _shannon_from_samples(samples, n_bins=10, lo=0, hi=100)
    assert h == pytest.approx(0.0)


# --------------------------------------------------------------------------
# Network cascade (Watts)
# --------------------------------------------------------------------------

def test_network_cascade_returns_seed_when_threshold_high():
    G = nx.erdos_renyi_graph(20, 0.2, seed=0)
    r = network_cascade(G, threshold_frac=0.99, seed=0)
    assert 1 <= r.final_size <= 2   # seed alone, or maybe one triggered by chance


def test_network_cascade_takes_everyone_when_threshold_zero():
    """Threshold 0 means "join if ANY neighbour has acted" → everything in the
    connected component of the seed joins."""
    G = nx.path_graph(10)   # single connected line of 10
    r = network_cascade(G, threshold_frac=0.0, seed=0)
    assert r.final_size == 10


def test_network_cascade_on_ring_deterministic():
    G = nx.cycle_graph(30)
    a = network_cascade(G, threshold_frac=0.4, seed=1)
    b = network_cascade(G, threshold_frac=0.4, seed=1)
    assert a.final_size == b.final_size


def test_network_cascade_global_flag():
    G = nx.path_graph(10)
    r = network_cascade(G, threshold_frac=0.0, seed=0)
    assert r.global_cascade
    G2 = nx.complete_graph(10)
    r2 = network_cascade(G2, threshold_frac=0.99, seed=0)
    assert not r2.global_cascade


def test_network_cascade_empty_graph():
    G = nx.empty_graph(0)
    r = network_cascade(G, threshold_frac=0.2, seed=0)
    assert r.final_size == 0


# --------------------------------------------------------------------------
# El Farol
# --------------------------------------------------------------------------

def test_el_farol_deterministic_given_seed():
    a = simulate_el_farol(n_agents=30, n_weeks=20, seed=4)
    b = simulate_el_farol(n_agents=30, n_weeks=20, seed=4)
    np.testing.assert_array_equal(a.attendance, b.attendance)


def test_el_farol_shape():
    r = simulate_el_farol(n_agents=40, capacity=25, n_weeks=30, seed=0)
    assert r.attendance.shape == (30,)
    assert r.capacity == 25
    assert r.n_agents == 40


def test_el_farol_attendance_within_bounds():
    r = simulate_el_farol(n_agents=50, n_weeks=40, seed=0)
    assert r.attendance.min() >= 0
    assert r.attendance.max() <= 50


def test_el_farol_diverse_lower_std_than_homogeneous():
    """Arthur's point: identical predictors → catastrophic oscillation;
    diverse predictors → self-organising near capacity with lower variance."""
    hom = simulate_el_farol(n_agents=100, capacity=60, n_weeks=80,
                            homogeneous=True, seed=1)
    div = simulate_el_farol(n_agents=100, capacity=60, n_weeks=80,
                            predictors_per_agent=3, seed=1)
    # Diverse should have noticeably smaller SD (typically ~15-20 vs ~40-50).
    assert div.std < hom.std * 0.6


def test_el_farol_predictor_registry_has_six_rules():
    """The predictor pool covers the standard heuristics from the chapter."""
    assert len(PREDICTORS) == 6
    for name, fn in PREDICTORS:
        assert isinstance(name, str)
        assert callable(fn)
