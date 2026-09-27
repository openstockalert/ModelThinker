"""Chapter 10 — Network models: structure shapes outcomes.

Four canonical network-formation families and a small set of measures that let
you tell them apart:

- **Erdős–Rényi (ER)** — each pair linked with independent probability $p$.
- **Watts–Strogatz (WS)** — small-world: a clustered ring lattice with a few
  random rewirings.
- **Barabási–Albert (BA)** — preferential attachment produces a scale-free
  degree distribution.
- **Geographic (RGG)** — nodes placed in the unit square; link two nodes if
  they're closer than a radius $r$.

Plus three signature results:

- The **friendship paradox** — on average, your friends have more friends
  than you do.
- The **degree distribution** — power-law tails in BA, sharply peaked in ER,
  narrow in WS, roughly Poisson-ish in RGG.
- **Robustness** — hub-heavy networks survive random failures well but
  collapse fast under targeted attacks on hubs.

Full write-up: ``docs/models/ch10_network.md``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import networkx as nx
import numpy as np

from ..core.base import ModelMeta

META = ModelMeta(
    chapter=10,
    name="Network models",
    slug="network",
    part="networks",
    redcape=("Explain", "Predict", "Communicate", "Explore"),
    summary=(
        "Random, small-world, scale-free, and geographic networks — the four "
        "families that show how structure alone (not the people in it) shapes "
        "path lengths, clustering, robustness, and the friendship paradox."
    ),
    tags=("networks", "small-world", "scale-free", "friendship paradox", "robustness"),
)


# ---------------------------------------------------------------------------
# Builders — one thin wrapper per network family
# ---------------------------------------------------------------------------

def build_erdos_renyi(*, n: int = 100, p: float = 0.05,
                      seed: int | None = 42) -> nx.Graph:
    """G(n, p): each of the $\\binom{n}{2}$ possible edges present independently
    with probability $p$."""
    if n < 2:
        raise ValueError("n must be ≥ 2")
    if not 0.0 <= p <= 1.0:
        raise ValueError("p must be in [0, 1]")
    return nx.gnp_random_graph(n, p, seed=seed)


def build_watts_strogatz(*, n: int = 100, k: int = 6, p: float = 0.1,
                         seed: int | None = 42) -> nx.Graph:
    """Small-world network: start with a ring lattice where each node is
    connected to ``k`` neighbours, then rewire each edge with probability ``p``.
    """
    if n < 3:
        raise ValueError("n must be ≥ 3")
    if k < 2 or k >= n:
        raise ValueError("k must be in [2, n - 1]")
    if not 0.0 <= p <= 1.0:
        raise ValueError("p must be in [0, 1]")
    if k % 2 != 0:
        # networkx requires even k for the ring lattice
        k -= 1
        if k < 2:
            k = 2
    return nx.watts_strogatz_graph(n, k, p, seed=seed)


def build_barabasi_albert(*, n: int = 100, m: int = 2,
                          seed: int | None = 42) -> nx.Graph:
    """Scale-free preferential-attachment graph: start with a seed clique of
    ``m`` nodes, then each new node attaches to ``m`` existing nodes with
    probability proportional to their degree."""
    if n < 2:
        raise ValueError("n must be ≥ 2")
    if not 1 <= m < n:
        raise ValueError("m must be in [1, n - 1]")
    return nx.barabasi_albert_graph(n, m, seed=seed)


def build_geographic(*, n: int = 100, radius: float = 0.15,
                     seed: int | None = 42) -> nx.Graph:
    """Random geometric graph: place ``n`` nodes uniformly in the unit square,
    connect any pair whose Euclidean distance is at most ``radius``."""
    if n < 2:
        raise ValueError("n must be ≥ 2")
    if not 0.0 < radius <= np.sqrt(2):
        raise ValueError("radius must be in (0, √2]")
    return nx.random_geometric_graph(n, radius, seed=seed)


NetworkKind = Literal["erdos_renyi", "watts_strogatz", "barabasi_albert", "geographic"]

_BUILDERS: dict[NetworkKind, callable] = {
    "erdos_renyi":     build_erdos_renyi,
    "watts_strogatz":  build_watts_strogatz,
    "barabasi_albert": build_barabasi_albert,
    "geographic":      build_geographic,
}

KIND_LABELS: dict[NetworkKind, str] = {
    "erdos_renyi":     "Erdős–Rényi (random)",
    "watts_strogatz":  "Watts–Strogatz (small-world)",
    "barabasi_albert": "Barabási–Albert (scale-free)",
    "geographic":      "Random geometric",
}


def build(kind: NetworkKind, **params) -> nx.Graph:
    """Dispatch to the right builder by name — useful in Streamlit / notebook."""
    if kind not in _BUILDERS:
        raise ValueError(f"unknown network kind {kind!r}; choose from {list(_BUILDERS)}")
    return _BUILDERS[kind](**params)


# ---------------------------------------------------------------------------
# Structural measures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class NetworkStats:
    """Summary structural measures of a network."""

    n_nodes: int
    n_edges: int
    mean_degree: float
    max_degree: int
    mean_clustering: float          # average local clustering coefficient
    mean_shortest_path: float       # over the largest connected component
    diameter: int                   # over the largest connected component
    density: float                  # 2 E / (N (N-1))
    n_components: int
    largest_component_frac: float


def network_stats(G: nx.Graph) -> NetworkStats:
    """Compute a bundle of standard summary statistics for a graph."""
    n = G.number_of_nodes()
    m = G.number_of_edges()
    degrees = np.array([d for _, d in G.degree()], dtype=int)

    # Path / diameter measured over the largest connected component so
    # disconnected networks don't crash the calculation.
    components = list(nx.connected_components(G))
    components.sort(key=len, reverse=True)
    lcc_nodes = components[0] if components else set()
    lcc = G.subgraph(lcc_nodes).copy() if lcc_nodes else nx.Graph()

    if lcc.number_of_nodes() >= 2:
        mean_sp = nx.average_shortest_path_length(lcc)
        diam = nx.diameter(lcc)
    else:
        mean_sp = 0.0
        diam = 0

    return NetworkStats(
        n_nodes=n,
        n_edges=m,
        mean_degree=float(degrees.mean()) if n else 0.0,
        max_degree=int(degrees.max()) if n else 0,
        mean_clustering=float(nx.average_clustering(G)) if n else 0.0,
        mean_shortest_path=float(mean_sp),
        diameter=int(diam),
        density=float(nx.density(G)),
        n_components=len(components),
        largest_component_frac=len(lcc_nodes) / n if n else 0.0,
    )


# ---------------------------------------------------------------------------
# Friendship paradox
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FriendshipParadoxResult:
    """Comparison of a node's degree to the mean degree of its neighbours."""

    mean_degree: float
    mean_neighbour_degree: float                # <k>_neighbours averaged over nodes
    fraction_beaten: float                      # share of nodes whose friends have more friends
    per_node_degree: np.ndarray                 # length n; ignores isolated nodes for neighbour mean
    per_node_neighbour_mean: np.ndarray


def friendship_paradox(G: nx.Graph) -> FriendshipParadoxResult:
    """The classic result: <k>_neighbours ≥ <k>, with equality iff G is regular.

    We return the two summary means, the share of nodes whose neighbours have
    strictly higher mean degree, and the per-node vectors for plotting.
    """
    if G.number_of_nodes() == 0:
        empty = np.array([])
        return FriendshipParadoxResult(0.0, 0.0, 0.0, empty, empty)

    n = G.number_of_nodes()
    per_deg = np.zeros(n)
    per_nb  = np.zeros(n)
    nodes = list(G.nodes())
    node_ix = {v: i for i, v in enumerate(nodes)}
    for v in nodes:
        i = node_ix[v]
        d = G.degree(v)
        per_deg[i] = d
        nbrs = list(G.neighbors(v))
        if nbrs:
            per_nb[i] = float(np.mean([G.degree(u) for u in nbrs]))
        else:
            per_nb[i] = np.nan

    valid = ~np.isnan(per_nb)
    if not valid.any():
        return FriendshipParadoxResult(
            mean_degree=float(per_deg.mean()),
            mean_neighbour_degree=0.0,
            fraction_beaten=0.0,
            per_node_degree=per_deg,
            per_node_neighbour_mean=per_nb,
        )
    return FriendshipParadoxResult(
        mean_degree=float(per_deg.mean()),
        mean_neighbour_degree=float(per_nb[valid].mean()),
        fraction_beaten=float((per_nb[valid] > per_deg[valid]).mean()),
        per_node_degree=per_deg,
        per_node_neighbour_mean=per_nb,
    )


# ---------------------------------------------------------------------------
# Robustness
# ---------------------------------------------------------------------------

AttackStrategy = Literal["random", "targeted"]


@dataclass(frozen=True)
class RobustnessResult:
    """How the largest connected component shrinks under successive node removal."""

    strategy: AttackStrategy
    fractions_removed: np.ndarray       # x-axis: fraction of nodes removed
    largest_component_frac: np.ndarray  # y-axis: size of the LCC / original N
    critical_removal_frac: float        # fraction removed when LCC size first < 0.5 * N


def robustness_curve(
    G: nx.Graph,
    *,
    strategy: AttackStrategy = "random",
    n_steps: int = 40,
    seed: int | None = 42,
) -> RobustnessResult:
    """Remove nodes one batch at a time; track the largest-connected-component size.

    ``strategy="random"``: remove uniformly at random.
    ``strategy="targeted"``: remove nodes in decreasing order of current degree
    (recomputed at each step).
    """
    n_original = G.number_of_nodes()
    if n_original == 0:
        empty = np.zeros(1)
        return RobustnessResult(strategy, empty, empty, 0.0)

    working = G.copy()
    fractions = [0.0]
    lcc_fracs = [_largest_cc_frac(working, n_original)]

    step_size = max(1, n_original // n_steps)
    rng = np.random.default_rng(seed)

    while working.number_of_nodes() > 0:
        remove_this_step = min(step_size, working.number_of_nodes())
        if strategy == "targeted":
            # Sort by current degree, break ties deterministically by node id.
            degs = sorted(working.degree, key=lambda x: (-x[1], x[0]))
            victims = [v for v, _ in degs[:remove_this_step]]
        elif strategy == "random":
            nodes = list(working.nodes())
            victims = list(rng.choice(nodes, size=remove_this_step, replace=False))
        else:
            raise ValueError(f"unknown strategy {strategy!r}")
        working.remove_nodes_from(victims)
        removed = n_original - working.number_of_nodes()
        fractions.append(removed / n_original)
        lcc_fracs.append(_largest_cc_frac(working, n_original))

    fractions_arr = np.array(fractions)
    lcc_arr = np.array(lcc_fracs)

    # First point where the LCC drops below half the ORIGINAL network size.
    below = np.where(lcc_arr < 0.5)[0]
    critical = float(fractions_arr[below[0]]) if len(below) else 1.0

    return RobustnessResult(
        strategy=strategy,
        fractions_removed=fractions_arr,
        largest_component_frac=lcc_arr,
        critical_removal_frac=critical,
    )


def _largest_cc_frac(G: nx.Graph, n_original: int) -> float:
    if G.number_of_nodes() == 0 or n_original == 0:
        return 0.0
    largest = max((len(c) for c in nx.connected_components(G)), default=0)
    return largest / n_original


# ---------------------------------------------------------------------------
# Convenience — degrees + layout for plotting
# ---------------------------------------------------------------------------

def degree_sequence(G: nx.Graph) -> np.ndarray:
    """Sorted (descending) array of node degrees. Handy for plotting histograms."""
    return np.array(sorted((d for _, d in G.degree()), reverse=True), dtype=int)


def layout_positions(G: nx.Graph, kind: NetworkKind,
                     seed: int | None = 42) -> dict[int, tuple[float, float]]:
    """Best-fit 2-D layout for each network family.

    - Geographic graphs already carry ``pos`` attributes from `random_geometric_graph`.
    - Small-world / random / scale-free look best with spring layout.
    """
    if kind == "geographic" and G.number_of_nodes() > 0:
        # nx assigns 'pos' as a numpy array or tuple depending on version.
        raw = nx.get_node_attributes(G, "pos")
        if raw:
            return {v: (float(p[0]), float(p[1])) for v, p in raw.items()}
    if kind == "watts_strogatz":
        return {v: (float(x), float(y)) for v, (x, y) in nx.circular_layout(G).items()}
    return {v: (float(x), float(y)) for v, (x, y) in nx.spring_layout(G, seed=seed).items()}
