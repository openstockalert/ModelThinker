"""Invariants of the Ch 14 urn / path-dependence simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.dynamics.path_dependence import (
    META,
    final_share_entropy,
    simulate,
    theoretical_polya_pdf,
)


def test_meta_is_ch14_path_dependence():
    assert META.chapter == 14
    assert META.slug == "path_dependence"
    assert "Explain" in META.redcape


def test_seed_is_deterministic():
    a = simulate(urn_type="polya", steps=200, n_walks=50, seed=1)
    b = simulate(urn_type="polya", steps=200, n_walks=50, seed=1)
    np.testing.assert_array_equal(a.urn_fraction, b.urn_fraction)
    np.testing.assert_array_equal(a.draw_fraction, b.draw_fraction)


def test_initial_fraction_is_first_column():
    r = simulate(urn_type="polya", steps=100, initial_red=3, initial_blue=7, seed=1)
    expected = 3 / 10
    assert np.allclose(r.urn_fraction[:, 0], expected)


def test_fractions_are_bounded():
    for urn in ("bernoulli", "polya", "balancing"):
        r = simulate(urn_type=urn, steps=500, n_walks=200, seed=2)
        assert r.urn_fraction.min() >= 0.0 - 1e-12
        assert r.urn_fraction.max() <= 1.0 + 1e-12
        assert r.draw_fraction.min() >= 0.0 - 1e-12
        assert r.draw_fraction.max() <= 1.0 + 1e-12


# ---------- Bernoulli urn --------------------------------------------------

def test_bernoulli_urn_fraction_is_constant():
    """Urn composition never changes in the Bernoulli urn."""
    r = simulate(urn_type="bernoulli", steps=500, n_walks=100, seed=3,
                 initial_red=4, initial_blue=6)
    expected = 4 / 10
    assert np.allclose(r.urn_fraction, expected)


def test_bernoulli_draw_fraction_converges_by_lln():
    """Empirical draw fraction converges to R/(R+B) = p (LLN)."""
    r = simulate(urn_type="bernoulli", steps=5000, n_walks=200, seed=4,
                 initial_red=3, initial_blue=7)
    p = 3 / 10
    finals = r.draw_fraction[:, -1]
    # SE of empirical fraction ≈ sqrt(p(1-p)/T). For T=5000 that's ~0.006.
    assert abs(finals.mean() - p) < 0.02
    assert finals.std() < 0.02


# ---------- Pólya urn ------------------------------------------------------

def test_polya_urn_fraction_equals_draw_fraction_in_limit():
    """For Pólya, urn share and empirical draw share are the same random variable."""
    r = simulate(urn_type="polya", steps=1000, n_walks=200, seed=5)
    # In the limit they converge to the same value.
    diffs = r.urn_fraction[:, -1] - r.draw_fraction[:, -1]
    # Bounded and small at large t (both track the "true" share).
    assert np.mean(np.abs(diffs)) < 0.02


def test_polya_symmetric_start_is_uniform_on_finals():
    """Pólya(1,1) long-run fraction is Uniform(0,1). Mean ≈ 0.5, std ≈ 1/√12."""
    r = simulate(urn_type="polya", steps=2000, n_walks=5000, seed=6,
                 initial_red=1, initial_blue=1)
    finals = r.urn_fraction[:, -1]
    assert 0.47 < finals.mean() < 0.53
    # Uniform(0,1) has std = 1/√12 ≈ 0.2887
    assert 0.26 < finals.std() < 0.31


def test_polya_biased_start_favours_that_colour():
    """Starting (5, 1) makes red the favourite in the limit (Beta(5, 1) mean = 5/6)."""
    r = simulate(urn_type="polya", steps=1500, n_walks=1500, seed=7,
                 initial_red=5, initial_blue=1)
    finals = r.urn_fraction[:, -1]
    assert 0.80 < finals.mean() < 0.86  # Beta(5,1) mean = 5/6 ≈ 0.833


# ---------- Balancing urn --------------------------------------------------

def test_balancing_urn_pulls_toward_half():
    """Even from an extreme start, balancing pushes back to 0.5."""
    r = simulate(urn_type="balancing", steps=3000, n_walks=100, seed=8,
                 initial_red=90, initial_blue=10)
    finals = r.urn_fraction[:, -1]
    assert 0.45 < finals.mean() < 0.55
    # Small spread — all trajectories converge to the same point.
    assert finals.std() < 0.03


def test_balancing_reduces_variance_over_time():
    """Variance across trajectories should shrink as time goes on."""
    r = simulate(urn_type="balancing", steps=2000, n_walks=200, seed=9,
                 initial_red=8, initial_blue=2)
    early_std = r.urn_fraction[:, 100].std()
    late_std  = r.urn_fraction[:, -1].std()
    assert late_std < early_std


# ---------- Entropy diagnostic ---------------------------------------------

def test_entropy_polya_high_others_low():
    """Path dependence signature: Pólya finals fill [0,1], others concentrate."""
    r_polya = simulate(urn_type="polya",     steps=1500, n_walks=3000, seed=10)
    r_bern  = simulate(urn_type="bernoulli", steps=1500, n_walks=3000, seed=10)
    r_bal   = simulate(urn_type="balancing", steps=1500, n_walks=3000, seed=10)

    e_polya = final_share_entropy(r_polya.urn_fraction[:, -1], n_bins=20)
    e_bern  = final_share_entropy(r_bern.urn_fraction[:, -1],  n_bins=20)
    e_bal   = final_share_entropy(r_bal.urn_fraction[:, -1],   n_bins=20)

    # log2(20) ≈ 4.32 is the max entropy for a 20-bin histogram.
    assert e_polya > 4.0
    # Bernoulli's urn_fraction is a constant → all in one bin → entropy = 0.
    assert e_bern == 0.0
    # Balancing → concentrated near 0.5 → entropy well below Pólya.
    assert e_bal < 2.0


def test_theoretical_polya_pdf_symmetric_is_uniform():
    xs = np.linspace(0.05, 0.95, 10)
    pdf = theoretical_polya_pdf(xs, initial_red=1, initial_blue=1)
    # Uniform density is 1 everywhere on [0, 1].
    assert np.allclose(pdf, 1.0, atol=1e-9)


# ---------- Input validation -----------------------------------------------

def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        simulate(urn_type="unknown", steps=10)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        simulate(urn_type="polya", steps=0)
    with pytest.raises(ValueError):
        simulate(urn_type="polya", steps=10, initial_red=0)
    with pytest.raises(ValueError):
        simulate(urn_type="polya", steps=10, n_walks=0)
