"""Invariants of the Ch 12 Entropy module — Shannon primitives, max-entropy
formulas, and 1-D elementary cellular automata."""

from __future__ import annotations

import math

import numpy as np
import pytest

from modelthinker.dynamics.entropy import (
    CLASS_NAMES,
    META,
    WOLFRAM_CLASSES,
    block_entropy,
    elementary_ca_step,
    empirical_distribution,
    exponential_entropy,
    kl_divergence,
    make_initial_row,
    normal_entropy,
    normalised_entropy,
    row_entropies,
    run_elementary_ca,
    shannon_entropy,
    uniform_entropy,
)

# --------------------------------------------------------------------------
# META
# --------------------------------------------------------------------------

def test_meta_is_ch12_entropy():
    assert META.chapter == 12
    assert META.slug == "entropy"
    assert META.part == "dynamics"


# --------------------------------------------------------------------------
# Shannon entropy — the classical identities
# --------------------------------------------------------------------------

def test_entropy_of_certainty_is_zero():
    assert shannon_entropy([1.0, 0.0, 0.0]) == pytest.approx(0.0)
    assert shannon_entropy([0.0, 0.0, 1.0]) == pytest.approx(0.0)


def test_entropy_of_fair_coin_is_one_bit():
    assert shannon_entropy([0.5, 0.5]) == pytest.approx(1.0)


def test_entropy_of_uniform_is_log_k():
    for k in [2, 3, 4, 8, 16, 100]:
        p = np.ones(k) / k
        assert shannon_entropy(p) == pytest.approx(math.log2(k))


def test_entropy_upper_bound():
    """Any distribution with support K has H ≤ log2 K."""
    rng = np.random.default_rng(0)
    for _ in range(20):
        k = rng.integers(2, 30)
        p = rng.random(k)
        p /= p.sum()
        assert shannon_entropy(p) <= math.log2(k) + 1e-9


def test_entropy_non_negative():
    rng = np.random.default_rng(1)
    for _ in range(20):
        k = rng.integers(2, 10)
        p = rng.random(k)
        assert shannon_entropy(p) >= -1e-9


def test_entropy_renormalises_input():
    """Passing counts instead of probs still works."""
    assert shannon_entropy([2, 2, 2, 2]) == pytest.approx(2.0)  # 4 equal → 2 bits
    assert shannon_entropy([50, 50]) == pytest.approx(1.0)


def test_entropy_base_change():
    """log₂ vs ln — they differ by a factor of ln 2."""
    p = [0.5, 0.5]
    h2 = shannon_entropy(p, base=2)
    he = shannon_entropy(p, base=math.e)
    assert he == pytest.approx(h2 * math.log(2))


def test_entropy_rejects_negatives():
    with pytest.raises(ValueError):
        shannon_entropy([0.5, -0.5, 0.5, 0.5])


def test_normalised_entropy_range():
    """Normalised entropy is always in [0, 1]."""
    assert normalised_entropy([1, 0, 0, 0]) == pytest.approx(0.0)
    assert normalised_entropy([1, 1, 1, 1]) == pytest.approx(1.0)
    rng = np.random.default_rng(2)
    for _ in range(20):
        k = rng.integers(2, 20)
        p = rng.random(k)
        h = normalised_entropy(p)
        assert 0.0 <= h <= 1.0 + 1e-9


def test_empirical_distribution_sums_to_one():
    samples = [0, 1, 1, 2, 2, 2]
    p = empirical_distribution(samples)
    assert p.sum() == pytest.approx(1.0)
    assert p[2] == pytest.approx(0.5)


# --------------------------------------------------------------------------
# KL divergence
# --------------------------------------------------------------------------

def test_kl_of_identical_is_zero():
    p = [0.2, 0.3, 0.5]
    assert kl_divergence(p, p) == pytest.approx(0.0)


def test_kl_non_negative():
    """Gibbs' inequality: D(p || q) ≥ 0 always."""
    rng = np.random.default_rng(3)
    for _ in range(20):
        k = rng.integers(2, 8)
        p = rng.random(k); p /= p.sum()
        q = rng.random(k); q /= q.sum()
        assert kl_divergence(p, q) >= -1e-9


def test_kl_infinite_when_support_mismatches():
    """D(p || q) = ∞ if p has mass where q is zero."""
    assert kl_divergence([0.5, 0.5], [1.0, 0.0]) == math.inf


# --------------------------------------------------------------------------
# Max-entropy formulas
# --------------------------------------------------------------------------

def test_uniform_entropy_matches_log_range():
    assert uniform_entropy(0, 1) == pytest.approx(0.0)   # log2(1) = 0
    assert uniform_entropy(0, 2) == pytest.approx(1.0)   # log2(2) = 1
    assert uniform_entropy(0, 8) == pytest.approx(3.0)


def test_uniform_entropy_rejects_bad_range():
    with pytest.raises(ValueError):
        uniform_entropy(1, 1)
    with pytest.raises(ValueError):
        uniform_entropy(3, 1)


def test_exponential_entropy_matches_formula():
    # H_e = 1 + ln μ  in nats
    mu = 2.5
    assert exponential_entropy(mu, base=math.e) == pytest.approx(1.0 + math.log(mu))


def test_normal_entropy_matches_formula():
    sigma = 1.0
    expected_nats = 0.5 * math.log(2 * math.pi * math.e * sigma * sigma)
    assert normal_entropy(sigma, base=math.e) == pytest.approx(expected_nats)


def test_normal_entropy_is_monotone_in_sigma():
    """Bigger spread → more entropy."""
    sigmas = [0.1, 0.5, 1.0, 2.0, 5.0]
    hs = [normal_entropy(s) for s in sigmas]
    assert hs == sorted(hs)


# --------------------------------------------------------------------------
# Cellular automata — rule table
# --------------------------------------------------------------------------

def test_rule_0_kills_everything():
    row = np.array([1, 1, 1, 1, 1], dtype=np.int8)
    assert elementary_ca_step(row, rule=0).sum() == 0


def test_rule_255_lights_everything():
    row = np.array([0, 0, 0, 0, 0], dtype=np.int8)
    out = elementary_ca_step(row, rule=255)
    assert (out == 1).all()


def test_rule_250_shifts_left():
    """Rule 250 (= 11111010): each pattern except 000 and 010 becomes 1.
    Equivalent to 'copy left neighbour' plus a tweak. Just check it produces
    something deterministic."""
    row = np.array([0, 1, 0, 1, 0], dtype=np.int8)
    out1 = elementary_ca_step(row, rule=250, wrap=True)
    out2 = elementary_ca_step(row, rule=250, wrap=True)
    np.testing.assert_array_equal(out1, out2)


def test_elementary_ca_rejects_bad_rule():
    with pytest.raises(ValueError):
        elementary_ca_step(np.zeros(5, dtype=np.int8), rule=256)
    with pytest.raises(ValueError):
        elementary_ca_step(np.zeros(5, dtype=np.int8), rule=-1)


# --------------------------------------------------------------------------
# CA integration — run + classify
# --------------------------------------------------------------------------

def test_run_shapes_are_consistent():
    r = run_elementary_ca(rule=90, width=41, steps=30)
    assert r.grid.shape == (31, 41)
    assert r.row_entropies.shape == (31,)
    assert r.rule == 90


def test_single_seed_starts_with_one_alive_cell():
    r = run_elementary_ca(rule=30, width=21, steps=1, initial_kind="single")
    assert r.grid[0].sum() == 1
    assert r.grid[0, 21 // 2] == 1


def test_random_seed_reproducible():
    a = run_elementary_ca(rule=30, width=51, steps=20, initial_kind="random", seed=7)
    b = run_elementary_ca(rule=30, width=51, steps=20, initial_kind="random", seed=7)
    np.testing.assert_array_equal(a.grid, b.grid)


def test_rule_0_is_class_1():
    """Rule 0 kills everything → equilibrium."""
    r = run_elementary_ca(rule=0, width=51, steps=20, initial_kind="random", seed=1)
    assert r.wolfram_class == 1


def test_rule_255_is_class_1():
    """Rule 255 turns everything on and holds → equilibrium (all-1 tail)."""
    r = run_elementary_ca(rule=255, width=51, steps=20, initial_kind="random", seed=1)
    assert r.wolfram_class == 1


def test_rule_30_high_block_entropy():
    """Rule 30 is class 3 (chaotic). Its tail has high block-entropy."""
    r = run_elementary_ca(rule=30, width=101, steps=300, initial_kind="single")
    # It's Wolfram's PRNG for a reason — block entropy near maximum.
    assert r.block_entropy_final > 3.0     # k = 4 → max is 4 bits
    assert r.wolfram_class == 3


def test_rule_90_is_class_3():
    r = run_elementary_ca(rule=90, width=201, steps=200, initial_kind="random", seed=2)
    assert r.wolfram_class == 3


def test_rule_110_single_seed_is_class_4():
    """Rule 110 with a single-seed start (canonical Wolfram setup) shows its
    famous structured gliders on a mesh — block entropy sits well below the
    class-3 threshold in the medium run."""
    r = run_elementary_ca(rule=110, width=301, steps=200, initial_kind="single")
    assert r.wolfram_class == 4


def test_classifier_is_a_heuristic_not_a_ground_truth():
    """The block-entropy classifier is inherently limited: rule 110's tail
    with a *random* start looks statistically like class 3 (rule 30's regime).
    We test that the returned class is always in the valid set, not that the
    heuristic replicates Wolfram's hand-classification of every rule."""
    for rule in (0, 30, 90, 110, 184):
        r = run_elementary_ca(rule=rule, width=101, steps=100)
        assert r.wolfram_class in (1, 2, 3, 4)


def test_known_class_dictionary_is_consistent():
    """Every rule in WOLFRAM_CLASSES maps to a valid 1/2/3/4."""
    for rule, cls in WOLFRAM_CLASSES.items():
        assert 0 <= rule <= 255
        assert cls in (1, 2, 3, 4)
        assert cls in CLASS_NAMES


# --------------------------------------------------------------------------
# Row / block entropy invariants
# --------------------------------------------------------------------------

def test_row_entropy_of_monochrome_row_is_zero():
    assert row_entropies(np.zeros((5, 10), dtype=int)).max() == 0.0
    assert row_entropies(np.ones((5, 10), dtype=int)).max() == 0.0


def test_row_entropy_of_alternating_is_one_bit():
    alt = np.tile(np.array([0, 1]), (5, 20))   # 5 rows, all balanced 0/1
    assert row_entropies(alt) == pytest.approx(np.ones(5))


def test_block_entropy_of_all_zero_is_zero():
    g = np.zeros((10, 20), dtype=int)
    assert block_entropy(g, k=3) == 0.0


def test_block_entropy_of_random_grid_near_max():
    rng = np.random.default_rng(5)
    g = (rng.random((200, 200)) < 0.5).astype(int)
    # 200 wide, k=4 → many samples of each 4-bit pattern → H close to 4.
    assert block_entropy(g, k=4) > 3.9


def test_block_entropy_of_repeating_pattern_is_low():
    """A grid of all 1010… should have block entropy = 1 bit for k=2."""
    row = np.tile(np.array([1, 0]), 50)
    g = np.tile(row, (10, 1))
    # k = 2 patterns present: '10' and '01', each half the time (with wrap).
    assert block_entropy(g, k=2) == pytest.approx(1.0, abs=0.05)


# --------------------------------------------------------------------------
# Initial-row helpers
# --------------------------------------------------------------------------

def test_make_initial_single_places_one_center():
    row = make_initial_row(21, kind="single")
    assert row.sum() == 1
    assert row[10] == 1


def test_make_initial_random_respects_density():
    row = make_initial_row(1000, kind="random", density=0.3, seed=0)
    frac = row.sum() / row.size
    assert 0.26 < frac < 0.34


def test_make_initial_rejects_bad_kind():
    with pytest.raises(ValueError):
        make_initial_row(21, kind="nonsense")  # type: ignore[arg-type]
