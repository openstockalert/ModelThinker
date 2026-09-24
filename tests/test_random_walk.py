"""Invariants of the Ch 13 Random Walk simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.dynamics.random_walk import (
    META,
    arcsine_fractions,
    arcsine_theoretical_cdf,
    dimension_recurrence,
    many_walks,
    return_times,
    rms_displacement,
    simulate,
    theoretical_return_survival,
)


def test_meta_is_ch13_random_walk():
    assert META.chapter == 13
    assert META.slug == "random_walk"
    assert "Explain" in META.redcape


def test_seed_is_deterministic():
    a = many_walks(n_walks=50, steps=200, seed=1).positions
    b = many_walks(n_walks=50, steps=200, seed=1).positions
    np.testing.assert_array_equal(a, b)


def test_walks_start_at_zero():
    r = many_walks(n_walks=50, steps=200, seed=2)
    np.testing.assert_array_equal(r.positions[:, 0], 0)


def test_bernoulli_steps_are_pm_one():
    r = many_walks(n_walks=20, steps=500, step_type="bernoulli", seed=3)
    diffs = np.diff(r.positions, axis=1)
    assert set(np.unique(diffs).tolist()) <= {-1.0, 1.0}


def test_normal_walk_variance_grows_linearly():
    """Var(S_t) ≈ t·σ² for the normal-step walk."""
    r = many_walks(n_walks=5000, steps=400, step_type="normal", sigma=1.0, seed=4)
    var_final = float(r.positions[:, -1].var(ddof=1))
    # Expect ≈ steps = 400, within 5 %.
    assert 380 < var_final < 420, var_final


def test_bernoulli_variance_grows_linearly():
    """Var(S_t) ≈ t for the Bernoulli walk."""
    r = many_walks(n_walks=5000, steps=400, step_type="bernoulli", seed=5)
    var_final = float(r.positions[:, -1].var(ddof=1))
    assert 380 < var_final < 420, var_final


def test_rms_displacement_matches_sqrt_t():
    """RMS displacement at time t should track √t within 5 %."""
    r = many_walks(n_walks=8000, steps=400, step_type="bernoulli", seed=6)
    rms = rms_displacement(r)
    t = np.arange(len(rms))
    # Skip t = 0 to avoid division by zero
    ratio = rms[100:] / np.sqrt(t[100:])
    assert 0.95 < ratio.mean() < 1.05, ratio.mean()


def test_simulate_matches_many_walks_first_row():
    a = simulate(steps=200, seed=7)
    b = many_walks(n_walks=1, steps=200, seed=7).positions[0]
    np.testing.assert_array_equal(a, b)


def test_positive_drift_makes_walks_transient_upward():
    r = many_walks(n_walks=500, steps=1000, step_type="normal", drift=0.05, seed=8)
    # With drift 0.05, expected position at t=1000 is 50 with SE ≈ √1000 ≈ 31.6
    mean_final = float(r.positions[:, -1].mean())
    assert mean_final > 20, mean_final


# ---------------------------------------------------------------------------
# Return times
# ---------------------------------------------------------------------------

def test_return_times_half_at_step_two():
    """Theory: P(T = 2) = 1/2 for the first-return time of a 1-D Bernoulli walk.

    (We check the fraction directly instead of np.median: with ~50 % of samples
    at exactly 2 and rest at ≥ 4, numpy's median lands on 4 by tie-breaking.)
    """
    r = return_times(n_walks=2000, max_steps=10_000, seed=10)
    returned = r.returned_times
    frac_two = (returned == 2).sum() / len(returned)
    assert 0.45 < frac_two < 0.55, frac_two
    # P(T ≤ 4) = 5/8 = 0.625
    frac_le_four = (returned <= 4).sum() / len(returned)
    assert 0.58 < frac_le_four < 0.68, frac_le_four


def test_return_times_are_all_even():
    r = return_times(n_walks=500, max_steps=5_000, seed=11)
    assert np.all(r.returned_times % 2 == 0)


def test_survival_tail_matches_sqrt_law():
    """P(T > t) should track √(2/(π t)) for large t."""
    r = return_times(n_walks=10_000, max_steps=5_000, seed=12)
    # Fraction still out at t = 100:
    surv_100 = (r.times == 0).sum() / r.n_walks + (r.returned_times > 100).sum() / r.n_walks
    theory_100 = float(theoretical_return_survival(np.array([100.0]))[0])
    assert abs(surv_100 - theory_100) < 0.02, (surv_100, theory_100)


# ---------------------------------------------------------------------------
# Pólya dimension recurrence
# ---------------------------------------------------------------------------

def test_dimension_recurrence_seed_is_deterministic():
    a = dimension_recurrence(dim=2, n_walks=100, max_steps=1000, seed=20)
    b = dimension_recurrence(dim=2, n_walks=100, max_steps=1000, seed=20)
    np.testing.assert_array_equal(a.first_return_times, b.first_return_times)


def test_1d_returns_more_than_3d():
    """Pólya's theorem in miniature: 1-D recurrent, 3-D transient."""
    r1 = dimension_recurrence(dim=1, n_walks=500, max_steps=5000, seed=21)
    r3 = dimension_recurrence(dim=3, n_walks=500, max_steps=5000, seed=21)
    # 1D: > 95 % should have returned by 5000 steps
    assert r1.return_fraction > 0.95
    # 3D: theoretical limit ~ 0.34; empirical fraction should be well below 1-D
    assert r3.return_fraction < 0.5
    assert r3.return_fraction < r1.return_fraction - 0.4


def test_3d_return_fraction_near_theory():
    """3-D return probability should be around 0.34 (Pólya's constant)."""
    r = dimension_recurrence(dim=3, n_walks=2000, max_steps=20_000, seed=22)
    assert 0.25 < r.return_fraction < 0.45, r.return_fraction


# ---------------------------------------------------------------------------
# Arcsine law
# ---------------------------------------------------------------------------

def test_arcsine_fractions_in_unit_interval():
    fracs = arcsine_fractions(n_walks=200, steps=200, seed=30)
    assert (fracs >= 0.0).all() and (fracs <= 1.0).all()


def test_arcsine_distribution_is_u_shaped():
    """The extremes (near 0 and 1) should be more common than the middle."""
    fracs = arcsine_fractions(n_walks=5000, steps=400, seed=31)
    near_edges = ((fracs < 0.1) | (fracs > 0.9)).mean()
    near_middle = ((fracs > 0.4) & (fracs < 0.6)).mean()
    assert near_edges > 1.5 * near_middle, (near_edges, near_middle)


def test_arcsine_theoretical_cdf_endpoints():
    assert float(arcsine_theoretical_cdf(np.array([0.0]))[0]) == pytest.approx(0.0)
    assert float(arcsine_theoretical_cdf(np.array([1.0]))[0]) == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        many_walks(n_walks=0, steps=10)
    with pytest.raises(ValueError):
        many_walks(n_walks=10, steps=0)
    with pytest.raises(ValueError):
        many_walks(n_walks=10, steps=10, step_type="mystery")  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        many_walks(n_walks=10, steps=10, step_type="bernoulli", drift=5.0)
    with pytest.raises(ValueError):
        dimension_recurrence(dim=0, n_walks=10, max_steps=10)
