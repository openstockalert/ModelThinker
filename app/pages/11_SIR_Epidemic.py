"""Streamlit page — Ch 11: SIR compartmental epidemic."""

from __future__ import annotations

import sys
from pathlib import Path

import plotly.graph_objects as go
import streamlit as st

_REPO = Path(__file__).resolve().parents[2]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.components.layout import render_doc_link, render_full_doc, render_header  # noqa: E402
from modelthinker.core.plotting import PALETTE, apply_theme  # noqa: E402
from modelthinker.networks.sir import META, simulate  # noqa: E402

render_header(META)
render_doc_link(META)

# ---------- Sidebar ----------
with st.sidebar:
    st.subheader("Parameters")
    beta = st.slider("β — transmission rate (per day)", 0.01, 2.0, 0.30, step=0.01,
                     help="Contacts per day × infection probability per contact.")
    gamma = st.slider("γ — recovery rate (per day)", 0.01, 1.0, 0.10, step=0.01,
                      help="1 / average infectious duration.")
    N = st.number_input("N — total population", min_value=100, max_value=100_000_000,
                        value=100_000, step=1000)
    I0 = st.number_input("I₀ — initial infectious", min_value=1, max_value=int(N // 2),
                         value=10, step=1)
    days = st.slider("Simulation horizon (days)", 30, 730, 180, step=10)

    st.markdown("---")
    R0 = beta / gamma
    st.metric("R₀ (derived)", f"{R0:.2f}",
              delta="epidemic likely" if R0 > 1 else "will fade",
              delta_color="inverse" if R0 > 1 else "normal")

# ---------- Simulate ----------
result = simulate(beta=float(beta), gamma=float(gamma), N=float(N),
                  I0=float(I0), days=int(days), n_points=800)

# ---------- Metrics ----------
c1, c2, c3, c4 = st.columns(4)
c1.metric("Peak infections", f"{result.peak_I:,.0f}", delta=f"day {result.peak_day:.0f}")
c2.metric("Total infected", f"{result.final_R:,.0f}",
          delta=f"{100 * result.final_R / result.N:.1f}% of pop")
c3.metric("Never infected", f"{result.S[-1]:,.0f}",
          delta=f"{100 * result.S[-1] / result.N:.1f}% of pop")
c4.metric("Herd immunity thresh.", f"{100 * result.herd_immunity_threshold:.1f}%",
          delta="1 − 1/R₀")

# ---------- SIR curves ----------
st.subheader("S / I / R over time")
fig = go.Figure()
fig.add_trace(go.Scatter(x=result.t, y=result.S, mode="lines", name="Susceptible",
                         line=dict(color=PALETTE["primary"], width=3)))
fig.add_trace(go.Scatter(x=result.t, y=result.I, mode="lines", name="Infectious",
                         line=dict(color=PALETTE["danger"], width=3), fill="tozeroy",
                         fillcolor="rgba(224,49,49,0.15)"))
fig.add_trace(go.Scatter(x=result.t, y=result.R, mode="lines", name="Recovered",
                         line=dict(color=PALETTE["success"], width=3)))

# Mark the peak
fig.add_vline(x=result.peak_day, line=dict(color=PALETTE["danger"], dash="dot"),
              annotation_text=f"peak day {result.peak_day:.0f}",
              annotation_position="top right")

apply_theme(fig)
fig.update_layout(xaxis_title="day", yaxis_title="people", height=560,
                  hovermode="x unified")
st.plotly_chart(fig, width="stretch")

# ---------- Effective R ----------
st.subheader("Effective reproduction number R_e(t) = R₀ · S/N")
Re = result.R0 * result.S / result.N
fig2 = go.Figure()
fig2.add_trace(go.Scatter(x=result.t, y=Re, mode="lines", name="R_e(t)",
                          line=dict(color=PALETTE["accent"], width=3)))
fig2.add_hline(y=1.0, line=dict(color=PALETTE["muted"], dash="dot"),
               annotation_text="threshold R = 1", annotation_position="top right")
apply_theme(fig2)
fig2.update_layout(xaxis_title="day", yaxis_title="R_e(t)", height=280)
st.plotly_chart(fig2, width="stretch")

st.caption(
    "When R_e crosses below 1, each infectious person produces less than one successor on average — "
    "new cases start to decline. Note that infections continue past this point (overshoot)."
)

# ---------- Full documentation ----------
render_full_doc(META)
