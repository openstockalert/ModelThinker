"""Streamlit page — Ch 14: Path Dependence via urn models.

Three tabs — one per urn variant — plus a fourth "compare all three" tab
where the same run parameters are applied to Bernoulli, Pólya, and
Balancing urns side by side. Path dependence emerges as a *shape* of the
final-share distribution.
"""

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
from modelthinker.dynamics.path_dependence import (  # noqa: E402
    META,
    final_share_entropy,
    simulate,
    theoretical_polya_pdf,
)

render_header(META)
render_doc_link(META)

# ---- Sidebar ----------------------------------------------------------------

PRESETS = {
    "🎲 Pólya's uniform limit":         dict(urn_type="polya",     steps=2000, n_walks=800, initial_red=1, initial_blue=1),
    "🔒 Locked-in Pólya (biased)":       dict(urn_type="polya",     steps=1500, n_walks=800, initial_red=5, initial_blue=1),
    "⚖ Balancing pulls back":           dict(urn_type="balancing", steps=2000, n_walks=200, initial_red=90, initial_blue=10),
    "🧊 Bernoulli — history irrelevant": dict(urn_type="bernoulli", steps=2000, n_walks=200, initial_red=3,  initial_blue=7),
}

_DEFAULTS = dict(
    _pd_urn="polya",
    _pd_steps=1000,
    _pd_n_walks=400,
    _pd_ir=1,
    _pd_ib=1,
)
for _k, _v in _DEFAULTS.items():
    st.session_state.setdefault(_k, _v)

with st.sidebar:
    st.subheader("Try a preset")
    preset_choice = st.selectbox("Load parameters from…", options=list(PRESETS.keys()), index=0)
    if st.button("↩ Apply preset", width="stretch"):
        p = PRESETS[preset_choice]
        st.session_state["_pd_urn"] = p["urn_type"]
        st.session_state["_pd_steps"] = p["steps"]
        st.session_state["_pd_n_walks"] = p["n_walks"]
        st.session_state["_pd_ir"] = p["initial_red"]
        st.session_state["_pd_ib"] = p["initial_blue"]
        st.rerun()

    st.divider()
    st.subheader("Parameters")
    urn = st.radio(
        "Urn update rule",
        options=["bernoulli", "polya", "balancing"],
        format_func=lambda v: {"bernoulli": "🧊 Bernoulli (no update)",
                               "polya":     "🌊 Pólya (positive feedback)",
                               "balancing": "⚖ Balancing (negative feedback)"}[v],
        key="_pd_urn",
        help="Bernoulli: urn unchanged. Pólya: add another of same colour. "
             "Balancing: add one of opposite colour.",
    )
    steps = st.slider("Steps per trajectory", 100, 20_000, step=100, key="_pd_steps")
    n_walks = st.slider("Number of trajectories", 20, 5_000, step=20, key="_pd_n_walks")
    initial_red  = st.number_input("Initial red balls",  min_value=1, max_value=100, key="_pd_ir")
    initial_blue = st.number_input("Initial blue balls", min_value=1, max_value=100, key="_pd_ib")
    seed = st.number_input("Seed", 0, 1_000_000, 42, step=1, key="_pd_seed")

# ---- Simulate ---------------------------------------------------------------

result = simulate(
    urn_type=urn, steps=int(steps), n_walks=int(n_walks),
    initial_red=int(initial_red), initial_blue=int(initial_blue), seed=int(seed),
)

# ---- Metrics ---------------------------------------------------------------

finals_urn  = result.urn_fraction[:, -1]
finals_draw = result.draw_fraction[:, -1]
entropy_urn = final_share_entropy(finals_urn, n_bins=20)
initial_frac = result.initial_red / (result.initial_red + result.initial_blue)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Starting red fraction", f"{initial_frac:.3f}")
c2.metric("Mean final urn share", f"{finals_urn.mean():.3f}")
c3.metric("Std of final urn share", f"{finals_urn.std():.3f}",
          delta="0 = all trajectories converged to same point")
c4.metric("Entropy of finals", f"{entropy_urn:.2f} bits",
          delta="high = path-dependent · 0 = concentrated")

tabs = st.tabs([
    "🎨 Sample trajectories",
    "📊 Final-share distribution",
    "🔬 Compare all three urns",
])

# ---- Tab 1 · Sample trajectories -------------------------------------------
with tabs[0]:
    st.subheader("How does the urn's red share evolve?")
    st.caption(
        "Each line is one independent trajectory of the fraction of red balls "
        "in the urn. Watch how differently the three rules shape the futures."
    )

    n_show = min(result.n_walks, 40)
    t_axis = np.arange(result.steps + 1)
    fig = go.Figure()
    for i in range(n_show):
        fig.add_trace(go.Scatter(
            x=t_axis, y=result.urn_fraction[i], mode="lines",
            line=dict(color=PALETTE["primary"], width=0.9),
            opacity=0.55, hoverinfo="skip", showlegend=False,
        ))
    # Reference line at initial fraction
    fig.add_hline(y=initial_frac, line=dict(color=PALETTE["muted"], dash="dot"),
                  annotation_text=f"start = {initial_frac:.2f}",
                  annotation_position="top right")
    # Reference line at 0.5
    if abs(initial_frac - 0.5) > 0.05:
        fig.add_hline(y=0.5, line=dict(color=PALETTE["muted"], dash="dot"),
                      annotation_text="0.5", annotation_position="bottom right")
    apply_theme(fig)
    fig.update_layout(
        xaxis_title="step t", yaxis_title="fraction of red in urn",
        yaxis_range=[0.0, 1.0], height=440,
    )
    st.plotly_chart(fig, width="stretch")

    if urn == "bernoulli":
        st.info(
            "🧊 **Bernoulli.** The urn never updates, so the red fraction is a flat line. "
            "Boring — and that's the point. No feedback ⇒ no memory ⇒ no path dependence."
        )
    elif urn == "polya":
        st.success(
            "🌊 **Pólya.** Each trajectory drifts to a *different* long-run share — some "
            "high, some low, most somewhere in between. Which one depends on early draws. "
            "Small events lock in the equilibrium."
        )
    else:
        st.warning(
            "⚖ **Balancing.** Whatever the starting composition, trajectories are pulled "
            "back to 0.5. The negative feedback loop erases history."
        )

# ---- Tab 2 · Distribution of final shares ----------------------------------
with tabs[1]:
    st.subheader("What are the long-run outcomes?")
    st.caption(
        "Histogram of the final fraction of red across all trajectories. "
        "Spread = path dependence. Concentrated at one value = no memory."
    )

    fig2 = go.Figure()
    fig2.add_trace(go.Histogram(
        x=finals_urn, xbins=dict(start=0.0, end=1.0, size=0.025),
        histnorm="probability density",
        marker_color=PALETTE["primary"], opacity=0.75, name="empirical",
    ))
    # Theoretical overlay for Pólya (Beta density)
    if urn == "polya":
        xs = np.linspace(0.001, 0.999, 400)
        pdf = theoretical_polya_pdf(xs, initial_red=result.initial_red,
                                    initial_blue=result.initial_blue)
        fig2.add_trace(go.Scatter(
            x=xs, y=pdf, mode="lines",
            name=f"theory: Beta({result.initial_red}, {result.initial_blue})",
            line=dict(color=PALETTE["danger"], width=3),
        ))
    elif urn == "bernoulli":
        # Point mass at initial fraction — just draw a vertical line
        fig2.add_vline(x=initial_frac, line=dict(color=PALETTE["danger"], dash="dash"),
                       annotation_text=f"theory: constant at {initial_frac:.3f}",
                       annotation_position="top right")
    else:  # balancing
        fig2.add_vline(x=0.5, line=dict(color=PALETTE["danger"], dash="dash"),
                       annotation_text="theory: converges to 0.5",
                       annotation_position="top right")
    apply_theme(fig2)
    fig2.update_layout(
        xaxis_title="final fraction of red", yaxis_title="density",
        xaxis_range=[0.0, 1.0], height=420, barmode="overlay",
    )
    st.plotly_chart(fig2, width="stretch")

    st.caption(
        "**Reading the shape**: a flat histogram spanning [0, 1] is the fingerprint of "
        "maximum path dependence — Pólya(1, 1). A sharp spike at one value is the fingerprint "
        "of memoryless dynamics."
    )

# ---- Tab 3 · Side-by-side comparison ---------------------------------------
with tabs[2]:
    st.subheader("Same run parameters, three different urn rules")
    st.caption(
        "The clearest way to see path dependence: run all three urns from the *same* "
        "starting composition with the *same* random seed budget. Only the update "
        "rule differs. Watch the shape of the final-share distribution change completely."
    )

    with st.spinner("Simulating all three urns..."):
        results3 = {
            u: simulate(urn_type=u, steps=int(steps), n_walks=int(n_walks),
                        initial_red=int(initial_red), initial_blue=int(initial_blue),
                        seed=int(seed))
            for u in ("bernoulli", "polya", "balancing")
        }

    label = {"bernoulli": "🧊 Bernoulli", "polya": "🌊 Pólya", "balancing": "⚖ Balancing"}
    color = {"bernoulli": PALETTE["muted"], "polya": PALETTE["primary"],
             "balancing": PALETTE["success"]}

    # -- Overlaid final-share histograms
    fig3 = go.Figure()
    for u, r in results3.items():
        fig3.add_trace(go.Histogram(
            x=r.urn_fraction[:, -1], xbins=dict(start=0.0, end=1.0, size=0.025),
            histnorm="probability density",
            name=label[u], marker_color=color[u], opacity=0.55,
        ))
    apply_theme(fig3)
    fig3.update_layout(
        xaxis_title="final red fraction", yaxis_title="density",
        xaxis_range=[0.0, 1.0], height=380, barmode="overlay",
    )
    st.plotly_chart(fig3, width="stretch")

    # -- Metrics table
    st.subheader("Path-dependence signature")
    import pandas as pd
    rows = []
    for u, r in results3.items():
        f = r.urn_fraction[:, -1]
        rows.append({
            "Urn": label[u],
            "Mean final share": f"{f.mean():.3f}",
            "Std of final share": f"{f.std():.3f}",
            "Entropy of finals (bits)": f"{final_share_entropy(f, n_bins=20):.2f}",
        })
    st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")
    st.caption(
        "**Entropy** is the direct measure of path dependence: high (≥ 4 for a 20-bin "
        "histogram) means the final share could be anything, low means it's pinned to a "
        "specific value. Pólya wins; Bernoulli and Balancing tie at ~0."
    )

# ---- Full documentation ----------------------------------------------------
render_full_doc(META)
