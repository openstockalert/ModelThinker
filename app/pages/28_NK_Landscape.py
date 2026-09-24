"""Streamlit page — Ch 28: NK rugged landscapes."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import streamlit as st

_REPO = Path(__file__).resolve().parents[2]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.components.layout import render_doc_link, render_full_doc, render_header  # noqa: E402
from modelthinker.core.plotting import PALETTE, apply_theme  # noqa: E402
from modelthinker.learning.nk_landscape import (  # noqa: E402
    META,
    NKLandscape,
    compare_strategies,
    count_local_peaks,
)

render_header(META)
render_doc_link(META)

# ---------- Sidebar ----------
with st.sidebar:
    st.subheader("Parameters")
    N = st.slider("N — number of bits", 4, 18, 12, step=1,
                  help="Search space has 2^N solutions. Larger N is exponentially harder.")
    K_max = max(N - 1, 0)
    K = st.slider("K — interacting neighbours per bit", 0, K_max, min(2, K_max), step=1,
                  help="K = 0 ⇒ smooth (single peak); K = N-1 ⇒ maximally rugged.")
    budget = st.slider("Search budget (evaluations)", 50, 3000, 500, step=50,
                       help="Total fitness evaluations each strategy may make.")
    n_restarts = st.slider("Random-restart hill climbs", 2, 30, 10, step=1)
    long_jump_p = st.slider("Long-jump per-bit flip probability", 0.05, 0.5, 0.20, step=0.05)
    seed = st.number_input("Seed", 0, 1_000_000, 42, step=1)

# ---------- Simulate ----------
with st.spinner("Building landscape and running searches..."):
    results = compare_strategies(
        N=int(N), K=int(K), budget=int(budget),
        n_restarts=int(n_restarts), long_jump_p=float(long_jump_p), seed=int(seed),
    )

# ---------- Metrics ----------
c1, c2, c3, c4 = st.columns(4)
c1.metric("Hill climb best", f"{results['hill_climb'].best_fitness:.4f}")
c2.metric("Random restart best", f"{results['random_restart'].best_fitness:.4f}",
          delta=f"{results['random_restart'].best_fitness - results['hill_climb'].best_fitness:+.4f}")
c3.metric("Long jump best", f"{results['long_jump'].best_fitness:.4f}",
          delta=f"{results['long_jump'].best_fitness - results['hill_climb'].best_fitness:+.4f}")
if N <= 16:
    land = NKLandscape(N=int(N), K=int(K), seed=int(seed))
    peaks = count_local_peaks(land)
    global_max = float(land.all_fitnesses().max())
    c4.metric("Local peaks (of 2^N)", f"{peaks:,}",
              delta=f"global max = {global_max:.4f}")
else:
    c4.metric("Local peaks", "n/a", delta="N > 16")

# ---------- Best-so-far curves ----------
st.subheader("Best-so-far fitness vs evaluations")
fig = go.Figure()
colors = {"hill_climb": PALETTE["primary"], "random_restart": PALETTE["success"],
          "long_jump": PALETTE["accent"]}
labels = {"hill_climb": "Hill climb", "random_restart": "Random restart",
          "long_jump": "Long jump"}
for name, r in results.items():
    xs = np.arange(1, len(r.trajectory) + 1)
    fig.add_trace(go.Scatter(x=xs, y=r.trajectory, mode="lines", name=labels[name],
                             line=dict(color=colors[name], width=3)))
if N <= 16:
    fig.add_hline(y=global_max, line=dict(color=PALETTE["muted"], dash="dot"),
                  annotation_text=f"global max = {global_max:.4f}",
                  annotation_position="bottom right")
apply_theme(fig)
fig.update_layout(xaxis_title="evaluations", yaxis_title="best fitness so far",
                  height=420, hovermode="x unified")
st.plotly_chart(fig, width="stretch")

st.caption(
    "On smooth landscapes (small K) all strategies converge fast. On rugged landscapes "
    "(large K), random restart and long jumps outperform pure greedy hill climbing."
)

# ---------- Landscape 1D projection ----------
if N <= 16:
    st.subheader("Fitness of every solution (1-D projection)")
    all_f = land.all_fitnesses()
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=np.arange(len(all_f)), y=all_f, mode="lines",
                              line=dict(color=PALETTE["primary"], width=1),
                              name="fitness"))
    fig2.add_hline(y=global_max, line=dict(color=PALETTE["danger"], dash="dash"),
                   annotation_text="global max", annotation_position="top right")
    apply_theme(fig2)
    fig2.update_layout(xaxis_title="solution index (0 to 2^N − 1)",
                       yaxis_title="fitness", height=320)
    st.plotly_chart(fig2, width="stretch")
    st.caption(
        "Each x-value is one of the 2^N bit-strings; y is its fitness. "
        "The number of local maxima in this curve is the number of local peaks — "
        "rises with K."
    )

# ---------- Full documentation ----------
render_full_doc(META)
