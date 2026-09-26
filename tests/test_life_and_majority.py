"""Invariants of the Ch 15 Life + Local Majority simulators."""

from __future__ import annotations

import numpy as np
import pytest

from modelthinker.dynamics.life_and_majority import (
    META,
    PATTERNS,
    count_clusters,
    neighbour_counts,
    place_pattern,
    random_life_grid,
    simulate_life,
    simulate_majority,
)


def test_meta_is_ch15_local_interaction():
    assert META.chapter == 15
    assert META.slug == "life_and_majority"
    assert "Explain" in META.redcape


# ---------- Neighbour counts -----------------------------------------------

def test_neighbour_count_center_cell():
    g = np.array([[1, 1, 1], [1, 0, 1], [1, 1, 1]], dtype=np.int8)
    counts = neighbour_counts(g, wrap=False)
    # Centre cell has 8 live neighbours.
    assert counts[1, 1] == 8


def test_neighbour_count_wrap_gives_different_result_at_edges():
    g = np.zeros((5, 5), dtype=np.int8)
    g[0, 0] = 1
    g[0, 4] = 1
    g[4, 0] = 1
    g[4, 4] = 1
    # With wrap, the corners are all neighbours of each other.
    counts_wrap = neighbour_counts(g, wrap=True)
    counts_no = neighbour_counts(g, wrap=False)
    # Corner (0,0) sees itself's neighbourhood — with wrap that includes 3 other corners.
    assert counts_wrap[0, 0] == 3
    assert counts_no[0, 0] == 0


# ---------- Game of Life: known patterns -----------------------------------

def test_block_is_still_life():
    grid = place_pattern("block", grid_size=10)
    r = simulate_life(initial_grid=grid, steps=10)
    for g in r.grid_history:
        np.testing.assert_array_equal(g, grid)
    assert r.stable


def test_blinker_oscillates_period_2():
    grid = place_pattern("blinker", grid_size=10)
    r = simulate_life(initial_grid=grid, steps=6, stop_when_stable=False)
    # Positions 0, 2, 4, 6 should equal the horizontal blinker (or its vertical form)
    assert np.array_equal(r.grid_history[0], r.grid_history[2])
    assert np.array_equal(r.grid_history[2], r.grid_history[4])
    # Position 1 differs (the rotated form).
    assert not np.array_equal(r.grid_history[0], r.grid_history[1])


def test_glider_moves():
    """The glider translates by (1, 1) every 4 generations."""
    grid = place_pattern("glider", grid_size=30, offset_r=5, offset_c=5)
    r = simulate_life(initial_grid=grid, steps=8, stop_when_stable=False)
    # Non-toroidal: pattern shouldn't wrap around at these offsets.
    # After 4 steps the glider has moved 1 cell right and 1 cell down.
    initial_positions = np.argwhere(r.grid_history[0])
    later_positions = np.argwhere(r.grid_history[4])
    assert initial_positions.shape == later_positions.shape
    # Centre of mass shifts by ~1 in both axes.
    initial_com = initial_positions.mean(axis=0)
    later_com = later_positions.mean(axis=0)
    diff = later_com - initial_com
    assert 0.7 < diff[0] < 1.3
    assert 0.7 < diff[1] < 1.3


def test_pulsar_returns_after_3_steps():
    grid = place_pattern("pulsar", grid_size=20)
    r = simulate_life(initial_grid=grid, steps=6, stop_when_stable=False)
    # Pulsar is period 3.
    np.testing.assert_array_equal(r.grid_history[0], r.grid_history[3])
    np.testing.assert_array_equal(r.grid_history[3], r.grid_history[6])


def test_empty_grid_stays_empty():
    grid = np.zeros((10, 10), dtype=np.int8)
    r = simulate_life(initial_grid=grid, steps=5)
    for g in r.grid_history:
        assert g.sum() == 0
    assert r.stable


def test_simulate_life_records_populations():
    grid = place_pattern("glider", grid_size=20)
    r = simulate_life(initial_grid=grid, steps=20, stop_when_stable=False)
    assert len(r.populations) == len(r.grid_history)
    # Glider has 5 cells at all times.
    assert all(p == 5 for p in r.populations)


def test_life_stop_when_stable_shortens_history():
    grid = place_pattern("block", grid_size=10)
    r = simulate_life(initial_grid=grid, steps=100, stop_when_stable=True)
    assert r.stable
    assert r.steps_taken < 100
    # History has steps_taken + 1 snapshots
    assert len(r.grid_history) == r.steps_taken + 1


def test_life_rejects_bad_steps():
    with pytest.raises(ValueError):
        simulate_life(initial_grid=np.zeros((5, 5)), steps=0)


# ---------- Local Majority Model -------------------------------------------

def test_majority_converges_to_all_zero_from_below_threshold():
    """Below-threshold density → 0-majority everywhere → grid goes to all zeros."""
    rng = np.random.default_rng(0)
    grid = (rng.random((30, 30)) < 0.2).astype(np.int8)  # sparse 1s
    r = simulate_majority(initial_grid=grid, steps=200, grid_size=30, wrap=True)
    # Should stabilise, and the stable state should be mostly 0s.
    assert r.stable
    assert r.grid_history[-1].sum() < 0.10 * 30 * 30


def test_majority_converges_to_clusters():
    """Random start with density ~ 0.5 converges to a stable, clustered pattern."""
    r = simulate_majority(grid_size=40, initial_density=0.5, steps=500,
                          wrap=True, seed=5)
    # Should stabilise within 500 steps for these parameters.
    assert r.stable
    # A "clustered" outcome has few connected components — much fewer than the initial
    # count from random noise.
    final = r.grid_history[-1]
    # Cluster count should be small (definitely < 30 for a 40x40 grid).
    n_clust_1 = count_clusters(final, value=1)
    assert n_clust_1 < 30


def test_majority_seed_deterministic():
    a = simulate_majority(grid_size=20, initial_density=0.5, steps=50, seed=1)
    b = simulate_majority(grid_size=20, initial_density=0.5, steps=50, seed=1)
    np.testing.assert_array_equal(a.grid_history[-1], b.grid_history[-1])


def test_majority_changes_decrease_over_time():
    """As the grid stabilises, the number of flips per step should drop toward 0."""
    r = simulate_majority(grid_size=30, initial_density=0.5, steps=100, seed=3)
    # First non-initial step should have many changes; later ones should be smaller.
    early = r.changes[1] if len(r.changes) > 1 else 0
    late = r.changes[-1]
    assert late < early


def test_majority_all_ones_stays_all_ones():
    grid = np.ones((10, 10), dtype=np.int8)
    r = simulate_majority(initial_grid=grid, steps=5, grid_size=10)
    for g in r.grid_history:
        assert g.sum() == 100


def test_majority_all_zeros_stays_all_zeros():
    grid = np.zeros((10, 10), dtype=np.int8)
    r = simulate_majority(initial_grid=grid, steps=5, grid_size=10)
    for g in r.grid_history:
        assert g.sum() == 0


def test_majority_rejects_bad_inputs():
    with pytest.raises(ValueError):
        simulate_majority(grid_size=40, steps=0)
    with pytest.raises(ValueError):
        simulate_majority(grid_size=40, initial_density=1.5, steps=10)
    with pytest.raises(ValueError):
        simulate_majority(grid_size=2, steps=10)


# ---------- Pattern registry -----------------------------------------------

def test_all_patterns_have_grid():
    for key, spec in PATTERNS.items():
        assert spec["grid"].ndim == 2
        assert "name" in spec
        assert "kind" in spec


def test_place_pattern_centers_pattern():
    grid = place_pattern("block", grid_size=10)
    # The 2x2 block should be centred at (4:6, 4:6) or so.
    coords = np.argwhere(grid)
    center = coords.mean(axis=0)
    assert 4.0 <= center[0] <= 5.0
    assert 4.0 <= center[1] <= 5.0


def test_place_pattern_rejects_too_small_grid():
    with pytest.raises(ValueError):
        place_pattern("pulsar", grid_size=5)  # pulsar is 13x13
    with pytest.raises(ValueError):
        place_pattern("nonexistent", grid_size=20)


def test_random_life_grid_respects_density():
    g = random_life_grid(grid_size=100, density=0.3, seed=42)
    frac = g.sum() / g.size
    assert 0.27 < frac < 0.33


# ---------- Cluster counter ------------------------------------------------

def test_count_clusters_single_block():
    g = np.zeros((5, 5), dtype=np.int8)
    g[1:3, 1:3] = 1
    assert count_clusters(g, value=1) == 1


def test_count_clusters_two_separated_blocks():
    g = np.zeros((5, 5), dtype=np.int8)
    g[0, 0] = 1
    g[4, 4] = 1
    assert count_clusters(g, value=1) == 2


def test_count_clusters_empty():
    g = np.zeros((5, 5), dtype=np.int8)
    assert count_clusters(g, value=1) == 0
