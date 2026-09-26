"""Invariants of the Ch 17 Markov-chain simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.dynamics.markov import (
    META,
    PRESETS,
    InterventionResult,
    distribution_over_time,
    intervention_experiment,
    population_distribution,
    simulate,
    stationary_distribution,
    validate_transition_matrix,
)


def test_meta_is_ch17_markov():
    assert META.chapter == 17
    assert META.slug == "markov"
    assert "Predict" in META.redcape


def test_all_presets_are_valid_transition_matrices():
    for key, spec in PRESETS.items():
        P = spec["P"]
        # Should not raise
        validate_transition_matrix(P)
        # And row sums are ~1 to numerical precision
        np.testing.assert_allclose(P.sum(axis=1), 1.0, atol=1e-9)
        assert P.shape[0] == P.shape[1] == len(spec["states"])


# ---------- Validation ----------------------------------------------------

def test_rejects_non_square_matrix():
    with pytest.raises(ValueError):
        validate_transition_matrix(np.array([[0.5, 0.5]]))


def test_rejects_negative_entries():
    with pytest.raises(ValueError):
        validate_transition_matrix(np.array([[1.5, -0.5], [0.5, 0.5]]))


def test_rejects_bad_row_sums():
    with pytest.raises(ValueError):
        validate_transition_matrix(np.array([[0.5, 0.4], [0.3, 0.7]]))


# ---------- Deterministic distribution dynamics ---------------------------

def test_distribution_over_time_starts_at_initial():
    P = PRESETS["students"]["P"]
    x0 = np.array([1.0, 0.0])
    dist = distribution_over_time(P, initial_distribution=x0, steps=10)
    np.testing.assert_allclose(dist[0], x0)


def test_distribution_stays_a_probability_distribution():
    for spec in PRESETS.values():
        dist = distribution_over_time(spec["P"], initial_state=0, steps=50)
        # Each row sums to 1 and is non-negative.
        assert (dist >= -1e-9).all()
        np.testing.assert_allclose(dist.sum(axis=1), 1.0, atol=1e-6)


def test_distribution_converges_to_stationary():
    for key, spec in PRESETS.items():
        P = spec["P"]
        pi = stationary_distribution(P)
        # Start from any point; after enough steps we should be close to pi.
        dist = distribution_over_time(P, initial_state=0, steps=500)
        np.testing.assert_allclose(dist[-1], pi, atol=1e-3, err_msg=f"preset {key}")


def test_different_starts_converge_to_same_stationary():
    P = PRESETS["weather"]["P"]
    pi = stationary_distribution(P)
    for i in range(P.shape[0]):
        dist = distribution_over_time(P, initial_state=i, steps=500)
        np.testing.assert_allclose(dist[-1], pi, atol=1e-3)


def test_stationary_satisfies_left_eigenvector_equation():
    for key, spec in PRESETS.items():
        pi = stationary_distribution(spec["P"])
        # π · P = π, and π sums to 1, and non-negative.
        np.testing.assert_allclose(pi @ spec["P"], pi, atol=1e-9, err_msg=key)
        assert abs(pi.sum() - 1.0) < 1e-9
        assert (pi >= -1e-9).all()


# ---------- Monte Carlo simulation ----------------------------------------

def test_seed_is_deterministic():
    P = PRESETS["students"]["P"]
    a = simulate(P=P, initial_state=0, steps=200, n_walks=50, seed=123)
    b = simulate(P=P, initial_state=0, steps=200, n_walks=50, seed=123)
    np.testing.assert_array_equal(a.trajectories, b.trajectories)


def test_trajectories_start_at_initial_state():
    P = PRESETS["weather"]["P"]
    r = simulate(P=P, initial_state=2, steps=50, n_walks=20, seed=1)
    assert (r.trajectories[:, 0] == 2).all()


def test_trajectory_states_are_valid():
    P = PRESETS["drug"]["P"]
    r = simulate(P=P, initial_state=0, steps=200, n_walks=100, seed=2)
    assert r.trajectories.min() >= 0
    assert r.trajectories.max() < P.shape[0]


def test_empirical_population_matches_theoretical_marginals():
    """After a while, the fraction of walkers in each state should match π."""
    P = PRESETS["weather"]["P"]
    pi = stationary_distribution(P)
    r = simulate(P=P, initial_state=0, steps=400, n_walks=3000, seed=3)
    pop = population_distribution(r)
    # Compare the last time step's empirical distribution to π.
    np.testing.assert_allclose(pop[-1], pi, atol=0.03)


def test_per_walk_initial_state_works():
    P = PRESETS["weather"]["P"]
    inits = np.array([0, 1, 2, 0, 1])
    r = simulate(P=P, initial_state=inits, steps=10, n_walks=5, seed=4)
    np.testing.assert_array_equal(r.trajectories[:, 0], inits)


def test_rejects_bad_simulate_inputs():
    P = PRESETS["students"]["P"]
    with pytest.raises(ValueError):
        simulate(P=P, initial_state=5, steps=10, n_walks=1)   # out of range
    with pytest.raises(ValueError):
        simulate(P=P, initial_state=0, steps=0, n_walks=1)
    with pytest.raises(ValueError):
        simulate(P=P, initial_state=0, steps=10, n_walks=0)


# ---------- Intervention experiment ---------------------------------------

def test_intervention_returns_to_stationary():
    """One-off intervention → distribution decays back to the same π."""
    P = PRESETS["students"]["P"]
    pi = stationary_distribution(P)
    r = intervention_experiment(
        P=P, steps=400, intervention_step=100, intervention_state=1,
    )
    assert isinstance(r, InterventionResult)
    # Just before the intervention, we're at π (started at π).
    np.testing.assert_allclose(r.intervention[99], pi, atol=1e-6)
    # Just after the intervention, we're a point mass at state 1.
    assert abs(r.intervention[100, 1] - 1.0) < 1e-9
    # By the end, we've drifted back to π.
    np.testing.assert_allclose(r.intervention[-1], pi, atol=1e-4)


def test_rule_change_settles_to_new_stationary():
    P = PRESETS["students"]["P"]
    # A different chain — swap the "sticky" states.
    P_after = np.array([
        [0.30, 0.70],
        [0.10, 0.90],
    ])
    pi_after = stationary_distribution(P_after)
    r = intervention_experiment(
        P=P, steps=600, intervention_step=100, intervention_state=0,
        P_after=P_after,
    )
    assert r.rule_change is not None
    np.testing.assert_allclose(r.rule_change[-1], pi_after, atol=1e-3)


def test_intervention_rejects_bad_inputs():
    P = PRESETS["students"]["P"]
    with pytest.raises(ValueError):
        intervention_experiment(P=P, steps=100, intervention_step=0, intervention_state=0)
    with pytest.raises(ValueError):
        intervention_experiment(P=P, steps=100, intervention_step=100, intervention_state=0)
    with pytest.raises(ValueError):
        intervention_experiment(P=P, steps=100, intervention_step=50, intervention_state=99)
