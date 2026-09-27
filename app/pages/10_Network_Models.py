"""Streamlit page — Ch 10: Network models.

Three tabs:
  1. Network zoo         — pick a family, see the graph and its summary stats
  2. Friendship paradox  — <k>_neighbours ≥ <k>, by inspection
  3. Robustness          — random vs targeted attacks across families
"""

from __future__ import annotations

import sys
from pathlib import Path

import networkx as nx
import numpy as np
import plotly.graph_objects as go
import streamlit as st

_REPO = Path(__file__).resolve().parents[2]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.components.layout import render_doc_link, render_full_doc, render_header  # noqa: E402
from modelthinker.core.plotting import PALETTE, apply_theme  # noqa: E402
from modelthinker.networks.network import (  # noqa: E402
    KIND_LABELS,
    META,
    build,
    degree_sequence,
    friendship_paradox,
    layout_positions,
    network_stats,
    robustness_curve,
)

render_header(META)
render_doc_link(META)

st.caption(
    "Chapter 10 in *The Model Thinker* argues that outcomes often depend on the **structure** of a "
    "network more than on the individuals inside it. This page walks through the four canonical "
    "network families (random, small-world, scale-free, geographic) and three signature results: "
    "the friendship paradox, degree-distribution shape, and robustness under attack."
)

tabs = st.tabs([
    "🕸️ Network zoo",
    "👥 Friendship paradox",
    "💥 Robustness",
])


# ============================================================================
# Shared: layout builders
# ============================================================================

def _graph_figure(G: nx.Graph, kind: str, colour_by: str = "degree",
                  seed: int = 42, height: int = 460) -> go.Figure:
    """Draw a network as a Plotly figure. Nodes coloured by degree by default."""
    pos = layout_positions(G, kind, seed=seed)
    degrees = dict(G.degree())

    edge_x, edge_y = [], []
    for u, v in G.edges():
        edge_x.extend([pos[u][0], pos[v][0], None])
        edge_y.extend([pos[u][1], pos[v][1], None])

    node_x = [pos[v][0] for v in G.nodes()]
    node_y = [pos[v][1] for v in G.nodes()]
    node_deg = [degrees[v] for v in G.nodes()]
    # Marker size scales with degree (with a floor)
    max_deg = max(node_deg) if node_deg else 1
    node_size = [8 + 22 * (d / max(1, max_deg)) for d in node_deg]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=edge_x, y=edge_y, mode="lines",
        line=dict(color="rgba(60, 65, 80, 0.35)", width=1),
        hoverinfo="skip", showlegend=False,
    ))
    fig.add_trace(go.Scatter(
        x=node_x, y=node_y, mode="markers",
        marker=dict(
            size=node_size, color=node_deg, colorscale="Viridis",
            showscale=True, colorbar=dict(title="degree", thickness=12, len=0.7),
            line=dict(color="white", width=1.5),
        ),
        text=[f"node {v} · degree {degrees[v]}" for v in G.nodes()],
        hoverinfo="text", showlegend=False,
    ))
    apply_theme(fig)
    fig.update_layout(
        height=height,
        xaxis=dict(showgrid=False, showticklabels=False, zeroline=False, visible=False),
        yaxis=dict(showgrid=False, showticklabels=False, zeroline=False, visible=False,
                   scaleanchor="x"),
        margin=dict(l=8, r=8, t=8, b=8),
    )
    return fig


# ============================================================================
# Tab 1 · Network zoo
# ============================================================================

with tabs[0]:
    st.subheader("Four networks, four personalities")
    st.markdown(
        "Pick a family and dial its parameters. Watch how the shape of the graph, its average "
        "path length, its clustering, and its degree distribution all shift together."
    )

    c1, c2, c3 = st.columns([1.4, 1, 1])
    kind = c1.selectbox(
        "Network family",
        options=list(KIND_LABELS.keys()),
        format_func=lambda k: KIND_LABELS[k],
        key="_nz_kind",
    )
    n_nodes = c2.slider("Number of nodes", 20, 400, 100, step=10, key="_nz_n")
    seed = c3.number_input("Seed", 0, 100_000, 42, step=1, key="_nz_seed")

    c4, c5 = st.columns(2)
    if kind == "erdos_renyi":
        p = c4.slider("Edge probability p", 0.005, 0.5, 0.05, step=0.005, key="_nz_p")
        params = dict(n=int(n_nodes), p=float(p), seed=int(seed))
        c5.metric("Expected mean degree", f"{p * (n_nodes - 1):.2f}", "= p (n − 1)")
    elif kind == "watts_strogatz":
        k = c4.slider("Neighbours per node k", 2, 16, 6, step=2, key="_nz_k")
        pr = c5.slider("Rewiring probability p", 0.0, 1.0, 0.10, step=0.02, key="_nz_pr")
        params = dict(n=int(n_nodes), k=int(k), p=float(pr), seed=int(seed))
    elif kind == "barabasi_albert":
        m = c4.slider("New edges per arrival m", 1, 8, 2, step=1, key="_nz_m")
        params = dict(n=int(n_nodes), m=int(m), seed=int(seed))
        c5.metric("Total edges", f"{m * (n_nodes - m)}", "= m (n − m)")
    else:  # geographic
        radius = c4.slider("Connection radius", 0.05, 0.5, 0.15, step=0.01, key="_nz_r")
        params = dict(n=int(n_nodes), radius=float(radius), seed=int(seed))
        c5.metric("Expected mean degree", f"{np.pi * radius**2 * (n_nodes - 1):.2f}",
                  "≈ π r² (n − 1)")

    G = build(kind, **params)
    stats = network_stats(G)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Mean degree", f"{stats.mean_degree:.2f}", f"max {stats.max_degree}")
    m2.metric("Clustering", f"{stats.mean_clustering:.3f}",
              "avg local coefficient")
    m3.metric("Mean shortest path", f"{stats.mean_shortest_path:.2f}",
              f"diameter {stats.diameter}")
    m4.metric("Connected", f"{100 * stats.largest_component_frac:.0f}%",
              f"{stats.n_components} components")

    st.plotly_chart(_graph_figure(G, kind, seed=int(seed)), width="stretch")

    # Degree distribution
    degs = degree_sequence(G)
    fig_d = go.Figure()
    fig_d.add_trace(go.Histogram(
        x=degs, marker_color=PALETTE["primary"], nbinsx=min(30, max(3, degs.max() + 1)),
    ))
    apply_theme(fig_d)
    fig_d.update_layout(
        height=260, xaxis_title="degree", yaxis_title="node count",
        showlegend=False,
    )
    st.plotly_chart(fig_d, width="stretch")

    # A small "which family are you looking at" cheat-sheet
    if kind == "erdos_renyi":
        st.info(
            "🎲 **Erdős–Rényi** is the *null model* — no structure, just coin flips. Degree "
            "distribution is roughly Poisson (narrow bell around p·(n−1)). Clustering ≈ p. Short "
            "average paths but no small-world shortcut magic."
        )
    elif kind == "watts_strogatz":
        st.info(
            "🕸️ **Watts–Strogatz** starts as a ring lattice (high clustering, long paths) and "
            "adds a few random rewirings that dramatically drop the average path length while "
            "preserving clustering. Try p = 0 → all cliques and no shortcuts. Push p up to 0.1 → "
            "path length collapses. That gap is the *small-world* regime."
        )
    elif kind == "barabasi_albert":
        st.info(
            "📈 **Barabási–Albert** grows by preferential attachment — the rich get richer. The "
            "degree distribution has a heavy tail (power law with exponent ≈ 3). A few *hubs* "
            "dominate. This is the structure that produces the friendship paradox in extremis."
        )
    else:
        st.info(
            "🗺️ **Random geometric** graphs place nodes in space and only link nearby pairs. "
            "The result feels like a real-world spatial network — think Wi-Fi mesh or a village. "
            "Clustering is naturally high; paths through the graph tend to be long."
        )


# ============================================================================
# Tab 2 · Friendship paradox
# ============================================================================

with tabs[1]:
    st.subheader("Your friends really do have more friends than you do")
    st.markdown(
        r"""
        **Feld (1991).** For any non-regular network, the *average number of friends of a friend* is
        strictly greater than the average number of friends. The reason isn't sociological — it's
        combinatorial. Popular people appear in more people's friend lists, so they get sampled
        disproportionately when you look at "friends of friends."

        Below: for each node we compute its own degree $d$ and the mean degree of its neighbours
        $\bar d_{\text{nbrs}}$. If nature were fair, these two would match on average. They don't.
        """
    )

    c1, c2, c3 = st.columns(3)
    fp_kind = c1.selectbox(
        "Network family",
        options=list(KIND_LABELS.keys()),
        format_func=lambda k: KIND_LABELS[k],
        index=2,  # BA — the paradox is strongest here
        key="_fp_kind",
    )
    fp_n = c2.slider("Number of nodes", 50, 500, 200, step=25, key="_fp_n")
    fp_seed = c3.number_input("Seed", 0, 100_000, 42, step=1, key="_fp_seed")

    # Kind-specific extra param row (with sensible defaults)
    c4 = st.container()
    if fp_kind == "erdos_renyi":
        p = c4.slider("Edge probability p", 0.01, 0.3, 0.05, step=0.01, key="_fp_p")
        G = build(fp_kind, n=int(fp_n), p=float(p), seed=int(fp_seed))
    elif fp_kind == "watts_strogatz":
        c4a, c4b = c4.columns(2)
        k = c4a.slider("k", 2, 10, 6, step=2, key="_fp_k")
        pr = c4b.slider("rewiring p", 0.0, 1.0, 0.1, step=0.05, key="_fp_pr")
        G = build(fp_kind, n=int(fp_n), k=int(k), p=float(pr), seed=int(fp_seed))
    elif fp_kind == "barabasi_albert":
        m = c4.slider("m (new edges per node)", 1, 6, 2, step=1, key="_fp_m")
        G = build(fp_kind, n=int(fp_n), m=int(m), seed=int(fp_seed))
    else:
        r = c4.slider("radius", 0.05, 0.4, 0.15, step=0.01, key="_fp_r")
        G = build(fp_kind, n=int(fp_n), radius=float(r), seed=int(fp_seed))

    fp = friendship_paradox(G)

    m1, m2, m3 = st.columns(3)
    m1.metric("⟨degree⟩", f"{fp.mean_degree:.2f}",
              "average number of friends")
    m2.metric("⟨degree of neighbours⟩", f"{fp.mean_neighbour_degree:.2f}",
              "average friend's number of friends",
              delta_color="off")
    m3.metric("Nodes beaten by their friends", f"{100 * fp.fraction_beaten:.0f}%",
              "share of nodes whose friends have strictly more friends")

    # Scatter: own degree vs neighbour-mean degree, with y=x diagonal
    valid = ~np.isnan(fp.per_node_neighbour_mean)
    fig = go.Figure()
    hi = max(fp.per_node_degree[valid].max(), fp.per_node_neighbour_mean[valid].max())
    fig.add_trace(go.Scatter(
        x=[0, hi], y=[0, hi], mode="lines",
        line=dict(color=PALETTE["muted"], dash="dot", width=1.5),
        name="parity (y = x)",
    ))
    fig.add_trace(go.Scatter(
        x=fp.per_node_degree[valid],
        y=fp.per_node_neighbour_mean[valid],
        mode="markers",
        marker=dict(color=PALETTE["primary"], size=8,
                    line=dict(color="white", width=1), opacity=0.75),
        name="nodes",
        hovertemplate="own degree = %{x}<br>mean friend degree = %{y:.2f}",
    ))
    apply_theme(fig)
    fig.update_layout(
        height=420,
        xaxis_title="your degree",
        yaxis_title="mean degree of your friends",
    )
    st.plotly_chart(fig, width="stretch")

    st.info(
        "🎯 **Read the plot.** Every point above the dotted diagonal is a person whose friends, "
        "on average, have more friends than they do. Notice how the cloud sits above the line "
        "for scale-free networks (BA) — the hubs push everyone's average up."
    )

    st.markdown(
        "**Practical use.** [Book] To spot a flu outbreak early, don't monitor random people — "
        "monitor *the friends of* random people. That simple sampling shift picks up more "
        "central nodes and detects contagion days sooner. Christakis & Fowler used this to "
        "catch a Harvard flu wave two weeks ahead of population surveillance."
    )


# ============================================================================
# Tab 3 · Robustness
# ============================================================================

with tabs[2]:
    st.subheader("Random failures vs targeted attacks")
    st.markdown(
        "Remove nodes from the network and watch the **largest connected component** shrink. "
        "Random removal is a stand-in for random failures (hardware breaks, individuals "
        "drop out). Targeted removal always takes out the highest-degree node next — the "
        "hub-killer strategy an adversary would use. The gap between the two curves is the "
        "network's *robustness signature*."
    )

    c1, c2, c3 = st.columns(3)
    rb_kind = c1.selectbox(
        "Network family",
        options=list(KIND_LABELS.keys()),
        format_func=lambda k: KIND_LABELS[k],
        index=2,
        key="_rb_kind",
    )
    rb_n = c2.slider("Number of nodes", 50, 500, 200, step=25, key="_rb_n")
    rb_seed = c3.number_input("Seed", 0, 100_000, 42, step=1, key="_rb_seed")

    if rb_kind == "erdos_renyi":
        p = st.slider("Edge probability p", 0.01, 0.3, 0.04, step=0.01, key="_rb_p")
        G = build(rb_kind, n=int(rb_n), p=float(p), seed=int(rb_seed))
    elif rb_kind == "watts_strogatz":
        c4a, c4b = st.columns(2)
        k = c4a.slider("k", 2, 10, 6, step=2, key="_rb_k")
        pr = c4b.slider("rewiring p", 0.0, 1.0, 0.1, step=0.05, key="_rb_pr")
        G = build(rb_kind, n=int(rb_n), k=int(k), p=float(pr), seed=int(rb_seed))
    elif rb_kind == "barabasi_albert":
        m = st.slider("m (new edges per node)", 1, 6, 2, step=1, key="_rb_m")
        G = build(rb_kind, n=int(rb_n), m=int(m), seed=int(rb_seed))
    else:
        r = st.slider("radius", 0.05, 0.4, 0.15, step=0.01, key="_rb_r")
        G = build(rb_kind, n=int(rb_n), radius=float(r), seed=int(rb_seed))

    rand = robustness_curve(G, strategy="random", n_steps=40, seed=int(rb_seed))
    targ = robustness_curve(G, strategy="targeted", n_steps=40)

    m1, m2, m3 = st.columns(3)
    m1.metric("Mean degree", f"{2 * G.number_of_edges() / G.number_of_nodes():.2f}")
    m2.metric("Critical @ random failure",
              f"{100 * rand.critical_removal_frac:.0f}%",
              "removal at which LCC < 50 %")
    m3.metric("Critical @ hub attack",
              f"{100 * targ.critical_removal_frac:.0f}%",
              "removal at which LCC < 50 %")

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=100 * rand.fractions_removed, y=100 * rand.largest_component_frac,
        mode="lines", line=dict(color=PALETTE["primary"], width=3),
        name="random failure",
    ))
    fig.add_trace(go.Scatter(
        x=100 * targ.fractions_removed, y=100 * targ.largest_component_frac,
        mode="lines", line=dict(color=PALETTE["danger"], width=3),
        name="targeted attack (hubs first)",
    ))
    fig.add_hline(y=50, line=dict(color=PALETTE["muted"], dash="dot", width=1))
    apply_theme(fig)
    fig.update_layout(
        height=360,
        xaxis_title="fraction of nodes removed (%)",
        yaxis_title="largest connected component (% of original)",
    )
    st.plotly_chart(fig, width="stretch")

    st.info(
        "🎯 **Read the gap.** For **scale-free** networks (BA) the gap is huge: they laugh off "
        "random failures but collapse under a hub attack. This is the design lesson from the "
        "internet — you get resilience *for free* against random hardware faults, and fragility "
        "against a smart adversary who knows to hit the routers, not the endpoints. **Random** "
        "and **geographic** networks have a much smaller gap: neither attack is decisive quickly."
    )

# ---- Full documentation ----------------------------------------------------
render_full_doc(META)
