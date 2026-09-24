"""Invariants of the Ch 11 SIR simulator."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.networks.sir import META, simulate


def test_meta_is_ch11_sir():
    assert META.chapter == 11
    assert META.slug == "sir"


def test_population_conservation():
    r = simulate(beta=0.3, gamma=0.1, N=100_000, I0=10, days=200)
    totals = r.S + r.I + r.R
    np.testing.assert_allclose(totals, r.N, rtol=1e-4)


def test_S_monotone_nonincreasing():
    r = simulate(beta=0.3, gamma=0.1, N=100_000, I0=10, days=200)
    diffs = np.diff(r.S)
    # tiny positive numerical wobble is OK
    assert diffs.max() < 1e-4


def test_R_monotone_nondecreasing():
    r = simulate(beta=0.3, gamma=0.1, N=100_000, I0=10, days=200)
    diffs = np.diff(r.R)
    assert diffs.min() > -1e-4


def test_I_is_unimodal_when_R0_above_1():
    """When R0 > 1, I has a single interior maximum."""
    r = simulate(beta=0.3, gamma=0.1, N=100_000, I0=10, days=300)
    assert pytest.approx(3.0, rel=1e-9) == r.R0
    peak = int(np.argmax(r.I))
    # peak should not be at the boundary
    assert 0 < peak < len(r.I) - 1
    # I increases before peak and decreases after
    assert (np.diff(r.I[:peak + 1]) >= -1e-3).all()
    assert (np.diff(r.I[peak:]) <= 1e-3).all()


def test_outbreak_fizzles_when_R0_below_1():
    r = simulate(beta=0.05, gamma=0.10, N=100_000, I0=100, days=300)
    assert r.R0 < 1
    assert r.I.max() <= r.I[0] + 1e-3  # never grows above the seed
    assert r.final_R < 500  # very few total infections


def test_herd_threshold_at_peak():
    """At the peak of I, S/N should be ≈ 1/R0 (dI/dt = 0 there).

    Uses a fine time grid so the discrete argmax lands close to the true continuous peak.
    """
    r = simulate(beta=0.4, gamma=0.1, N=100_000, I0=10, days=200, n_points=4000)
    peak = int(np.argmax(r.I))
    assert r.S[peak] / r.N == pytest.approx(1.0 / r.R0, rel=0.05)


def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        simulate(beta=-0.1, gamma=0.1, N=1000, I0=1)
    with pytest.raises(ValueError):
        simulate(beta=0.1, gamma=0.0, N=1000, I0=1)
    with pytest.raises(ValueError):
        simulate(beta=0.1, gamma=0.1, N=100, I0=50, R0_init=100)
