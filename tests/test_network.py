"""Invariants for the Ch 10 Network models module — builders, structural
measures, friendship paradox, and robustness curves."""

from __future__ import annotations

import networkx as nx
import numpy as np
import pytest

from modelthinker.networks.network import (
    KIND_LABELS,
    META,
    build,
    build_barabasi_albert,
    build_erdos_renyi,
    build_geographic,
    build_watts_strogatz,
    degree_sequence,
    friendship_paradox,
    layout_positions,
    network_stats,
    robustness_curve,
)

# --------------------------------------------------------------------------
# META
# --------------------------------------------------------------------------

def test_meta_is_ch10_network():
    assert META.chapter == 10
    assert META.slug == "network"
    assert META.part == "networks"


# --------------------------------------------------------------------------
# Builders — basic invariants
# --------------------------------------------------------------------------

def test_er_expected_mean_degree_approximately_pn():
    """Mean degree of G(n, p) is p * (n - 1) in expectation."""
    n, p = 500, 0.02
    G = build_erdos_renyi(n=n, p=p, seed=0)
    expected = p * (n - 1)
    observed = 2 * G.number_of_edges() / n
    # 500 nodes → mean degree ~ 10, SD roughly √(p(1-p)(n-1)) ≈ √9.8 ≈ 3.13 per node
    # sample mean SD ≈ 3.13 / √500 ≈ 0.14 → generous 4-sigma tolerance
    assert abs(observed - expected) < 1.0


def test_er_deterministic_given_seed():
    a = build_erdos_renyi(n=50, p=0.1, seed=7)
    b = build_erdos_renyi(n=50, p=0.1, seed=7)
    assert set(a.edges()) == set(b.edges())


def test_ws_has_k_regular_structure_before_rewiring():
    """With p=0, WS is exactly a k-regular ring lattice."""
    n, k = 20, 4
    G = build_watts_strogatz(n=n, k=k, p=0.0, seed=1)
    degs = [d for _, d in G.degree()]
    assert all(d == k for d in degs)


def test_ws_rewiring_preserves_edge_count():
    """Rewiring moves edges, doesn't create or destroy them."""
    n, k, p = 40, 4, 0.3
    ring = build_watts_strogatz(n=n, k=k, p=0.0, seed=1)
    rewired = build_watts_strogatz(n=n, k=k, p=p, seed=1)
    assert ring.number_of_edges() == rewired.number_of_edges()


def test_ws_odd_k_is_gracefully_rounded_down():
    """We silently bump odd k → k-1 (nx requires even k)."""
    G = build_watts_strogatz(n=20, k=5, p=0.1, seed=1)
    degs = [d for _, d in G.degree()]
    # After bumping to k=4 the mean should be 4, unless rewiring shifted things
    assert abs(np.mean(degs) - 4) < 1


def test_ba_produces_hubs():
    """BA has a small number of very high-degree nodes."""
    G = build_barabasi_albert(n=500, m=2, seed=0)
    degs = sorted((d for _, d in G.degree()), reverse=True)
    mean_deg = np.mean(degs)
    # The top node should dwarf the average in a scale-free network.
    assert degs[0] > 5 * mean_deg


def test_ba_has_correct_edge_count():
    """BA with m new edges per node: total edges = m * (n - m)."""
    n, m = 100, 3
    G = build_barabasi_albert(n=n, m=m, seed=0)
    # First m nodes are seed; each of the remaining n - m adds m edges.
    assert G.number_of_edges() == m * (n - m)


def test_geographic_graph_places_nodes():
    G = build_geographic(n=100, radius=0.15, seed=0)
    assert G.number_of_nodes() == 100
    # Every node should carry a 'pos' attribute in [0, 1]^2
    for _, data in G.nodes(data=True):
        assert "pos" in data
        p = data["pos"]
        assert 0 <= p[0] <= 1 and 0 <= p[1] <= 1


def test_build_dispatch_matches_direct_builder():
    a = build("erdos_renyi", n=30, p=0.1, seed=1)
    b = build_erdos_renyi(n=30, p=0.1, seed=1)
    assert set(a.edges()) == set(b.edges())


def test_build_rejects_unknown_kind():
    with pytest.raises(ValueError):
        build("nonsense", n=10)  # type: ignore[arg-type]


def test_kind_labels_covers_every_builder():
    for kind in ("erdos_renyi", "watts_strogatz", "barabasi_albert", "geographic"):
        assert kind in KIND_LABELS


# --------------------------------------------------------------------------
# Builders — parameter validation
# --------------------------------------------------------------------------

def test_er_rejects_bad_params():
    with pytest.raises(ValueError):
        build_erdos_renyi(n=1, p=0.1)
    with pytest.raises(ValueError):
        build_erdos_renyi(n=10, p=1.5)


def test_ws_rejects_bad_k():
    with pytest.raises(ValueError):
        build_watts_strogatz(n=10, k=1, p=0.1)   # k too small
    with pytest.raises(ValueError):
        build_watts_strogatz(n=10, k=10, p=0.1)  # k >= n


def test_ba_rejects_bad_m():
    with pytest.raises(ValueError):
        build_barabasi_albert(n=10, m=10)


def test_geographic_rejects_bad_radius():
    with pytest.raises(ValueError):
        build_geographic(n=10, radius=0.0)
    with pytest.raises(ValueError):
        build_geographic(n=10, radius=2.0)


# --------------------------------------------------------------------------
# Structural measures
# --------------------------------------------------------------------------

def test_network_stats_zero_edges_zero_clustering():
    G = nx.empty_graph(10)
    s = network_stats(G)
    assert s.n_edges == 0
    assert s.mean_degree == 0
    assert s.mean_clustering == 0
    # 10 isolated nodes → 10 components, LCC is one node
    assert s.n_components == 10
    assert s.largest_component_frac == pytest.approx(0.1)


def test_network_stats_complete_graph_has_full_clustering():
    G = nx.complete_graph(6)
    s = network_stats(G)
    assert s.mean_clustering == pytest.approx(1.0)
    assert s.density == pytest.approx(1.0)
    assert s.diameter == 1
    assert s.mean_shortest_path == pytest.approx(1.0)


def test_network_stats_densities_between_zero_and_one():
    for kind, params in [
        ("erdos_renyi",     dict(n=50, p=0.1)),
        ("watts_strogatz",  dict(n=50, k=4, p=0.2)),
        ("barabasi_albert", dict(n=50, m=2)),
        ("geographic",      dict(n=50, radius=0.2)),
    ]:
        G = build(kind, seed=0, **params)
        s = network_stats(G)
        assert 0 <= s.density <= 1
        assert 0 <= s.mean_clustering <= 1
        assert 0 <= s.largest_component_frac <= 1


def test_ws_has_higher_clustering_than_er_for_matched_edges():
    """Signature small-world result: WS retains high clustering after rewiring."""
    n = 200
    # WS with k=6 has each node connected to 6 nearest neighbours on the ring → high clustering
    ws = build_watts_strogatz(n=n, k=6, p=0.1, seed=0)
    # ER with matching mean degree (6) → clustering near p ≈ 6 / (n-1) ~ 0.03
    er = build_erdos_renyi(n=n, p=6 / (n - 1), seed=0)
    assert network_stats(ws).mean_clustering > network_stats(er).mean_clustering


# --------------------------------------------------------------------------
# Friendship paradox
# --------------------------------------------------------------------------

def test_friendship_paradox_holds_for_scale_free():
    """<k>_neighbours ≥ <k>. Signature result of Feld 1991."""
    G = build_barabasi_albert(n=300, m=2, seed=0)
    fp = friendship_paradox(G)
    assert fp.mean_neighbour_degree >= fp.mean_degree - 1e-9
    # BA is far from regular → the paradox should be strong, not just barely
    assert fp.mean_neighbour_degree > 1.5 * fp.mean_degree


def test_friendship_paradox_equality_for_regular_graph():
    """A k-regular graph has neighbour-degree = degree for every node."""
    G = nx.cycle_graph(10)   # 2-regular
    fp = friendship_paradox(G)
    assert fp.mean_degree == pytest.approx(fp.mean_neighbour_degree)
    assert fp.fraction_beaten == 0.0


def test_friendship_paradox_beats_majority_in_ba():
    G = build_barabasi_albert(n=200, m=2, seed=0)
    fp = friendship_paradox(G)
    # In a strongly scale-free network the great majority get beaten
    assert fp.fraction_beaten > 0.6


def test_friendship_paradox_isolated_node_is_nan_and_ignored():
    G = nx.Graph()
    G.add_nodes_from([0, 1, 2])
    G.add_edge(0, 1)
    fp = friendship_paradox(G)
    # Node 2 has no neighbours → NaN, should not crash and not contribute to means
    assert np.isnan(fp.per_node_neighbour_mean[-1])
    assert fp.mean_neighbour_degree == pytest.approx(1.0)  # 0 and 1 each see one 1-degree neighbour


# --------------------------------------------------------------------------
# Robustness
# --------------------------------------------------------------------------

def test_robustness_lcc_monotone_non_increasing():
    """Removing nodes can't grow the largest connected component."""
    G = build_erdos_renyi(n=100, p=0.05, seed=0)
    r = robustness_curve(G, strategy="random", n_steps=20, seed=0)
    diffs = np.diff(r.largest_component_frac)
    assert (diffs <= 1e-9).all()


def test_robustness_targeted_worse_than_random_on_scale_free():
    """Signature result: BA networks collapse fast under hub-targeted attacks."""
    G = build_barabasi_albert(n=200, m=2, seed=0)
    rand = robustness_curve(G, strategy="random", n_steps=20, seed=0)
    targ = robustness_curve(G, strategy="targeted", n_steps=20)
    # After removing ~20% of nodes, targeted attack should have caused
    # a much smaller LCC than random removal.
    idx_rand = np.searchsorted(rand.fractions_removed, 0.2)
    idx_targ = np.searchsorted(targ.fractions_removed, 0.2)
    assert targ.largest_component_frac[idx_targ] < rand.largest_component_frac[idx_rand]
    # And the critical removal fraction is much lower for targeted
    assert targ.critical_removal_frac < rand.critical_removal_frac


def test_robustness_random_deterministic_given_seed():
    G = build_erdos_renyi(n=80, p=0.1, seed=5)
    a = robustness_curve(G, strategy="random", n_steps=20, seed=99)
    b = robustness_curve(G, strategy="random", n_steps=20, seed=99)
    np.testing.assert_array_equal(a.largest_component_frac, b.largest_component_frac)


def test_robustness_removes_everything_eventually():
    G = build_erdos_renyi(n=30, p=0.2, seed=0)
    r = robustness_curve(G, strategy="targeted", n_steps=5)
    assert r.fractions_removed[-1] == pytest.approx(1.0)
    assert r.largest_component_frac[-1] == 0.0


def test_robustness_rejects_bad_strategy():
    G = build_erdos_renyi(n=20, p=0.2, seed=0)
    with pytest.raises(ValueError):
        robustness_curve(G, strategy="nonsense")  # type: ignore[arg-type]


# --------------------------------------------------------------------------
# Utilities
# --------------------------------------------------------------------------

def test_degree_sequence_is_sorted_descending():
    G = build_barabasi_albert(n=100, m=2, seed=0)
    d = degree_sequence(G)
    assert (d[:-1] >= d[1:]).all()


def test_layout_positions_has_one_per_node():
    G = build_watts_strogatz(n=30, k=4, p=0.2, seed=1)
    pos = layout_positions(G, "watts_strogatz")
    assert set(pos.keys()) == set(G.nodes())


def test_layout_positions_reuses_geographic_coords():
    """Random-geometric graphs already carry 'pos' — layout should reuse them."""
    G = build_geographic(n=20, radius=0.3, seed=0)
    pos = layout_positions(G, "geographic")
    for v in G.nodes():
        assert pos[v] == pytest.approx(tuple(G.nodes[v]["pos"]))
