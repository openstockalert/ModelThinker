"""Streamlit page — Ch 15: Schelling segregation."""

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
from modelthinker.dynamics.schelling import META, simulate  # noqa: E402

render_header(META)
render_doc_link(META)

# ---------- Sidebar ----------
with st.sidebar:
    st.subheader("Parameters")
    grid_size = st.slider("Grid size (L × L)", 10, 80, 40, step=5,
                          help="Side length of the square grid.")
    density = st.slider("Density — fraction occupied", 0.1, 0.98, 0.9, step=0.01,
                        help="Higher density leaves fewer empty cells for unhappy agents to move into.")
    tolerance = st.slider("Tolerance τ — min same-type neighbour fraction", 0.0, 1.0, 0.30, step=0.05,
                          help="An agent is happy when at least τ of its non-empty neighbours share its type.")
    max_steps = st.slider("Max steps", 500, 20_000, 5000, step=500,
                          help="One unhappy-agent move per step. Simulation stops early once everyone is happy.")
    snapshot_every = st.slider("Snapshot every N steps", 50, 1000, 200, step=50,
                               help="How often to store a grid snapshot for the animation.")
    seed = st.number_input("Seed", 0, 1_000_000, 42, step=1)

# ---------- Simulate ----------
with st.spinner("Simulating segregation dynamics..."):
    result = simulate(
        grid_size=int(grid_size), density=float(density), tolerance=float(tolerance),
        max_steps=int(max_steps), snapshot_every=int(snapshot_every), seed=int(seed),
    )

# ---------- Metrics ----------
c1, c2, c3, c4 = st.columns(4)
c1.metric("Steps taken", f"{result.steps_taken:,}")
c2.metric("Converged?", "yes ✓" if result.converged else "no")
c3.metric("Initial segregation", f"{result.seg_index_history[0]:.3f}")
c4.metric("Final segregation", f"{result.seg_index_history[-1]:.3f}",
          delta=f"{result.seg_index_history[-1] - result.seg_index_history[0]:+.3f}")

# ---------- Grid animation ----------
st.subheader("The grid over time")
snap_ix = st.slider(
    "Snapshot", 0, len(result.grid_history) - 1, len(result.grid_history) - 1,
    help="Slide from step 0 (random start) to the final state.",
)
snap = result.grid_history[snap_ix]

fig = go.Figure(data=go.Heatmap(
    z=snap,
    colorscale=[
        [0.0,  "#FFFFFF"],  # empty
        [0.5,  PALETTE["primary"]],   # type A
        [1.0,  PALETTE["accent"]],    # type B
    ],
    zmin=0, zmax=2,
    showscale=False,
    xgap=1, ygap=1,
))
apply_theme(fig)
fig.update_layout(
    height=520,
    xaxis=dict(showticklabels=False, zeroline=False),
    yaxis=dict(showticklabels=False, zeroline=False, scaleanchor="x", autorange="reversed"),
    margin=dict(l=10, r=10, t=10, b=10),
)
st.plotly_chart(fig, width="stretch")

# ---------- Segregation index history ----------
st.subheader("Segregation index over time")
xs = np.arange(len(result.seg_index_history)) * snapshot_every
xs[0] = 0
fig2 = go.Figure()
fig2.add_trace(go.Scatter(x=xs, y=result.seg_index_history, mode="lines+markers",
                          name="segregation index", line=dict(color=PALETTE["primary"], width=3)))
fig2.add_hline(y=0.5, line=dict(color=PALETTE["muted"], dash="dot"),
               annotation_text="≈ random baseline", annotation_position="bottom right")
apply_theme(fig2)
fig2.update_layout(xaxis_title="step", yaxis_title="segregation index", yaxis_range=[0, 1], height=320)
st.plotly_chart(fig2, width="stretch")

st.caption(
    "The average fraction of same-type neighbours across all agents. Starts near 0.5 "
    "(random placement) and typically rises to 0.7–0.9 even for modest tolerances."
)

# ---------- Full documentation ----------
render_full_doc(META)
