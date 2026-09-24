"""Streamlit page — Ch 6: Power laws via preferential attachment."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

_REPO = Path(__file__).resolve().parents[2]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.components.layout import render_doc_link, render_full_doc, render_header  # noqa: E402
from modelthinker.core.plotting import PALETTE, apply_theme  # noqa: E402
from modelthinker.distributions.power_law import META, degree_pmf, simulate  # noqa: E402

render_header(META)
render_doc_link(META)

# ---------- Sidebar ----------
with st.sidebar:
    st.subheader("Parameters")
    n = st.slider("n — final number of nodes", 100, 10_000, 2000, step=100,
                  help="Larger n gives a cleaner power-law tail but takes longer.")
    m = st.slider("m — edges per new node", 1, 10, 2, step=1,
                  help="Each new node attaches to m existing nodes with probability ∝ degree.")
    seed = st.number_input("Seed", 0, 1_000_000, 42, step=1)

# ---------- Simulate ----------
with st.spinner("Growing Barabási–Albert network..."):
    result = simulate(n=int(n), m=int(m), seed=int(seed), top_k=15)

# ---------- Metrics ----------
c1, c2, c3, c4 = st.columns(4)
c1.metric("Nodes", f"{result.n:,}")
c2.metric("Edges", f"{len(result.edges):,}")
c3.metric("MLE exponent γ̂", f"{result.estimated_exponent:.2f}",
          delta="theory ≈ 3.0")
c4.metric("Gini of degrees", f"{result.gini:.3f}",
          delta="1.0 = one hub only")

# ---------- Log-log degree distribution ----------
st.subheader("Degree distribution on log-log — a power law is a straight line")
ks, pk = degree_pmf(result.degrees)
# Fit line for overlay
k_min = result.m
mask = ks >= k_min
ks_fit = ks[mask]
gamma_hat = result.estimated_exponent
if np.isfinite(gamma_hat):
    # normalise the fit to match p(k_min)
    p_kmin_emp = pk[mask][0]
    fit_y = p_kmin_emp * (ks_fit / ks_fit[0]) ** (-gamma_hat)
else:
    fit_y = None

fig = go.Figure()
fig.add_trace(go.Scatter(x=ks, y=pk, mode="markers", name="empirical P(k)",
                         marker=dict(color=PALETTE["primary"], size=8)))
if fit_y is not None:
    fig.add_trace(go.Scatter(x=ks_fit, y=fit_y, mode="lines",
                             name=f"MLE fit: k^(-{gamma_hat:.2f})",
                             line=dict(color=PALETTE["danger"], width=2, dash="dash")))
apply_theme(fig)
fig.update_layout(xaxis_type="log", yaxis_type="log",
                  xaxis_title="degree k (log)", yaxis_title="P(k) (log)", height=380)
st.plotly_chart(fig, width="stretch")

# ---------- Lorenz curve + top hubs table ----------
col_a, col_b = st.columns([3, 2])
with col_a:
    st.subheader("Lorenz curve — how concentrated is degree?")
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=result.lorenz_x, y=result.lorenz_y, mode="lines",
                              name="Lorenz curve", line=dict(color=PALETTE["primary"], width=3),
                              fill="tozeroy", fillcolor="rgba(76,110,245,0.15)"))
    fig2.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines", name="perfect equality",
                              line=dict(color=PALETTE["muted"], dash="dot")))
    apply_theme(fig2)
    fig2.update_layout(
        xaxis_title="cumulative fraction of nodes (poorest → richest)",
        yaxis_title="cumulative fraction of total degree",
        height=380,
    )
    st.plotly_chart(fig2, width="stretch")
    st.caption(f"Gini = {result.gini:.3f}. Distance below the diagonal = inequality.")

with col_b:
    st.subheader("Top hubs")
    df = pd.DataFrame(result.top_degrees, columns=["node id", "degree"])
    df["% of edges"] = 100 * df["degree"] / result.degrees.sum() * 2
    df["% of edges"] = df["% of edges"].map(lambda x: f"{x:.2f}%")
    st.dataframe(df, hide_index=True, width="stretch", height=380)

# ---------- Full documentation ----------
render_full_doc(META)
