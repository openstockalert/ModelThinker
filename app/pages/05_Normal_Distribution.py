"""Streamlit page — Ch 5: Normal distributions / Central Limit Theorem."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import streamlit as st
from scipy.stats import norm

_REPO = Path(__file__).resolve().parents[2]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.components.layout import render_doc_link, render_full_doc, render_header  # noqa: E402
from modelthinker.core.plotting import PALETTE, apply_theme  # noqa: E402
from modelthinker.distributions.normal import META, simulate, sqrt_n_scan  # noqa: E402

render_header(META)
render_doc_link(META)

# ---------- Sidebar controls ----------
with st.sidebar:
    st.subheader("Parameters")
    source = st.selectbox(
        "Source distribution",
        options=["uniform", "exponential", "bernoulli", "chi_squared", "lognormal"],
        index=0,
        help="The underlying distribution each draw comes from. The CLT says the "
             "distribution of averages converges to a normal *regardless* of this choice — "
             "though heavily skewed sources like lognormal need much larger n.",
    )
    n = st.slider(
        "n — draws per sample mean", min_value=1, max_value=1000, value=30, step=1,
        help="Averaging n draws gives one sample mean. Larger n ⇒ tighter, more Gaussian.",
    )
    num_samples = st.slider(
        "Number of sample means", min_value=200, max_value=50_000, value=10_000, step=200,
        help="Histogram resolution — more samples ⇒ smoother curve.",
    )
    seed = st.number_input("Seed", min_value=0, max_value=1_000_000, value=42, step=1)

# ---------- Simulate ----------
result = simulate(source=source, n=int(n), num_samples=int(num_samples), seed=int(seed))

# ---------- Metrics ----------
c1, c2, c3, c4 = st.columns(4)
c1.metric("Theoretical μ", f"{result.theoretical_mean:.4f}")
c2.metric("Empirical mean-of-means", f"{result.sample_means.mean():.4f}")
c3.metric("Theoretical σ / √n", f"{result.theoretical_std_mean:.4f}")
c4.metric("Empirical std of means", f"{result.sample_means.std(ddof=1):.4f}")

# ---------- Main plot: source vs sample-mean histograms ----------
st.subheader("Sample-mean distribution vs the normal it converges to")

fig = go.Figure()

# Sample-mean histogram
fig.add_trace(go.Histogram(
    x=result.sample_means,
    histnorm="probability density",
    name=f"Sample means (n={result.n})",
    marker_color=PALETTE["primary"],
    opacity=0.75,
    nbinsx=60,
))

# Overlaid theoretical normal (μ, σ/√n)
mu, sd = result.theoretical_mean, result.theoretical_std_mean
xs = np.linspace(mu - 4 * sd, mu + 4 * sd, 400)
fig.add_trace(go.Scatter(
    x=xs, y=norm.pdf(xs, mu, sd),
    mode="lines", name="Normal(μ, σ/√n) — CLT prediction",
    line=dict(color=PALETTE["danger"], width=3),
))

# Also show the source distribution (raw draws) as a faint reference
fig.add_trace(go.Histogram(
    x=result.source_draws,
    histnorm="probability density",
    name="Source distribution (single draws)",
    marker_color=PALETTE["muted"],
    opacity=0.35,
    nbinsx=60,
    visible="legendonly",
))

apply_theme(fig)
fig.update_layout(barmode="overlay", xaxis_title="value", yaxis_title="density", height=420)
st.plotly_chart(fig, width="stretch")

st.caption(
    "Blue histogram: distribution of sample means. Red curve: the normal the CLT predicts. "
    "Toggle **Source distribution** in the legend to see how different (often un-Gaussian) the raw source can be."
)

# ---------- Secondary plot: √n rule scan ----------
st.subheader("The √n rule — empirical std of the mean vs n")
ns = (1, 4, 16, 64, 256, 1024)
scan = sqrt_n_scan(source=source, ns=ns, num_samples=3000, seed=int(seed))
xs_n = list(ns)
ys_emp = [scan[n_] for n_ in ns]
mu_src, sig_src = norm.fit(result.source_draws)  # rough — good enough for the overlay
# Use theoretical σ for the source when available:
from modelthinker.distributions.normal import _theoretical  # noqa: E402

_, true_sigma = _theoretical(source)
ys_theory = [true_sigma / np.sqrt(n_) for n_ in ns]

fig2 = go.Figure()
fig2.add_trace(go.Scatter(x=xs_n, y=ys_emp, mode="lines+markers",
                          name="Empirical std of sample mean",
                          line=dict(color=PALETTE["primary"], width=3)))
fig2.add_trace(go.Scatter(x=xs_n, y=ys_theory, mode="lines",
                          name="Theory: σ / √n",
                          line=dict(color=PALETTE["danger"], width=2, dash="dash")))
apply_theme(fig2)
fig2.update_layout(xaxis_type="log", yaxis_type="log",
                   xaxis_title="n (log)", yaxis_title="std of sample mean (log)", height=340)
st.plotly_chart(fig2, width="stretch")

st.caption(
    "On a log-log plot, σ/√n is a straight line with slope −½. If the empirical line matches, "
    "the √n rule holds — quadrupling n halves the standard error."
)

# ---------- Full documentation ----------
render_full_doc(META)
