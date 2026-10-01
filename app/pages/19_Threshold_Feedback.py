"""Streamlit page — Ch 19: Threshold models with feedback.

Three tabs:
  1. Granovetter cascade    — positive feedback, bimodal outcomes
  2. El Farol bar           — negative feedback, diversity stabilises
  3. Tipping-point signature — outcome entropy peaks at the tip
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
from modelthinker.dynamics.threshold_feedback import (  # noqa: E402
    META,
    cascade_variance_sweep,
    network_cascade,
    sample_normal_thresholds,
    simulate_cascade,
    simulate_el_farol,
)

render_header(META)
render_doc_link(META)

st.caption(
    "Chapter 19 shows how two systems that look identical from the outside — "
    "*I watch what others do, then decide* — behave in opposite ways depending on "
    "the sign of the feedback. Positive feedback (riots) runs to extremes; "
    "negative feedback (El Farol) stabilises the average. Same rule shape. Opposite worlds."
)

tabs = st.tabs([
    "🔥 Granovetter cascade",
    "🍺 El Farol bar",
    "📈 Tipping-point signature",
])


# ============================================================================
# Tab 1 · Granovetter cascade
# ============================================================================

with tabs[0]:
    st.subheader("Positive feedback — join if enough others act")
    st.markdown(
        r"""
        Every person $i$ has a threshold $t_i$ — the number of others they'd need to
        see acting before they'd join in themselves. Iterate: whoever's threshold is
        met joins, that changes the count, more people join. Repeat until the process
        settles at a **fixed point** where nobody new is willing to join.

        Below you pick a threshold distribution (mean and SD) and one *instigator*
        gets things started. The plot shows the cumulative threshold curve and the
        45° line — **the cascade climbs until the curve first drops below the line,
        and stops there.**
        """
    )

    c1, c2, c3 = st.columns(3)
    n_agents  = c1.slider("Population size", 20, 300, 100, step=10, key="_g_n")
    mean_th   = c2.slider("Mean threshold", 0.0, 100.0, 25.0, step=1.0, key="_g_m")
    sd_th     = c3.slider("SD of thresholds", 0.5, 60.0, 15.0, step=0.5, key="_g_sd")

    c4, c5 = st.columns(2)
    instigators = c4.slider("Instigators (start acting)", 0, 10, 1, step=1, key="_g_ins")
    seed        = c5.number_input("Seed", 0, 100_000, 42, step=1, key="_g_seed")

    thresholds = sample_normal_thresholds(
        mean=float(mean_th), sd=float(sd_th),
        n=int(n_agents), seed=int(seed),
    )
    result = simulate_cascade(thresholds, instigators=int(instigators))

    m1, m2, m3 = st.columns(3)
    m1.metric("Final cascade size", f"{result.final_size} / {result.n}",
              f"{100 * result.final_size / result.n:.0f}% of population")
    m2.metric("Iterations", f"{len(result.history) - 1}")
    m3.metric("Grew from", f"{instigators} instigator{'s' if instigators != 1 else ''}",
              "the initial spark of the cascade")

    # Cumulative-threshold curve + 45° line
    sorted_thr = np.sort(thresholds)
    # F(x) = number of people whose threshold is ≤ x
    xs = np.linspace(0, n_agents, 400)
    Fx = np.searchsorted(sorted_thr, xs, side="right")
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=xs, y=Fx, mode="lines",
        line=dict(color=PALETTE["primary"], width=3),
        name="cumulative threshold F(x)",
    ))
    fig.add_trace(go.Scatter(
        x=xs, y=xs, mode="lines",
        line=dict(color=PALETTE["muted"], width=1.5, dash="dot"),
        name="y = x (fixed-point line)",
    ))
    # Mark the actual final size as a dot
    fig.add_trace(go.Scatter(
        x=[result.final_size + instigators], y=[result.final_size + instigators],
        mode="markers", marker=dict(size=14, color=PALETTE["accent"],
                                     line=dict(color="white", width=2)),
        name=f"cascade stops here ({result.final_size} joined)",
    ))
    apply_theme(fig)
    fig.update_layout(
        height=420,
        xaxis_title="number of people currently acting",
        yaxis_title="number of people whose threshold has been met",
        yaxis=dict(range=[0, n_agents]),
        xaxis=dict(range=[0, n_agents]),
    )
    st.plotly_chart(fig, width="stretch")

    # Threshold histogram below
    fig2 = go.Figure()
    fig2.add_trace(go.Histogram(x=thresholds, nbinsx=30, marker_color=PALETTE["accent"]))
    apply_theme(fig2)
    fig2.update_layout(
        height=220, xaxis_title="threshold", yaxis_title="number of people",
        showlegend=False,
    )
    st.plotly_chart(fig2, width="stretch")

    st.info(
        "🎯 **Play with the SD slider at fixed mean = 25.** Below SD ≈ 10 nothing "
        "happens — everyone's waiting for others. Between SD ≈ 15 and SD ≈ 40 you "
        "get frequent full-population cascades. Above SD ≈ 60 you start hitting "
        "stubborn plateaus and only some people join. The window of 'reliably full "
        "cascade' is a middle band of diversity — Page's general point that diversity "
        "changes outcomes qualitatively."
    )

    # Bonus: fractional-threshold cascade on a network (Watts)
    with st.expander("Bonus · Watts fractional-threshold cascade on a network"):
        st.markdown(
            r"""
            A refinement that matters: real thresholds are usually *fractions* of the
            people you can see, not counts of the whole population. On a graph, node
            $v$ acts once at least $\phi$ of its neighbours have. Duncan Watts (2002)
            showed this has a **cascade window**: too-sparse networks can't propagate,
            *too-dense* networks are also cascade-proof because each neighbour dilutes
            the others' influence.
            """
        )
        c1, c2, c3 = st.columns(3)
        net_n     = c1.slider("Network size", 100, 2000, 500, step=100, key="_g_n_net")
        net_deg   = c2.slider("Mean degree", 1.0, 20.0, 3.0, step=0.5, key="_g_deg")
        net_phi   = c3.slider("Threshold fraction φ", 0.05, 0.5, 0.18, step=0.01, key="_g_phi")
        net_runs  = st.slider("Runs (with different seeds)", 20, 200, 60, step=10, key="_g_runs")

        rng = np.random.default_rng(0)
        p = net_deg / max(1, net_n - 1)
        cascade_sizes = []
        for r in range(int(net_runs)):
            G = nx.erdos_renyi_graph(int(net_n), p, seed=int(r))
            res = network_cascade(G, threshold_frac=float(net_phi), seed=int(r))
            cascade_sizes.append(res.final_size / net_n)
        cascade_sizes = np.array(cascade_sizes)

        m1, m2 = st.columns(2)
        m1.metric("Mean cascade fraction", f"{100 * cascade_sizes.mean():.1f}%")
        m2.metric("Global cascades (>50%)", f"{100 * (cascade_sizes > 0.5).mean():.0f}%",
                  f"out of {net_runs} runs")

        fig3 = go.Figure()
        fig3.add_trace(go.Histogram(x=cascade_sizes * 100, nbinsx=25,
                                     marker_color=PALETTE["primary"]))
        apply_theme(fig3)
        fig3.update_layout(
            height=260, xaxis_title="cascade size (% of network)",
            yaxis_title="runs", showlegend=False,
        )
        st.plotly_chart(fig3, width="stretch")


# ============================================================================
# Tab 2 · El Farol bar
# ============================================================================

with tabs[1]:
    st.subheader("Negative feedback — act if few others do")
    st.markdown(
        r"""
        100 people, one bar, capacity 60. Going is fun if fewer than 60 show up and
        miserable otherwise. **Any shared forecast destroys itself:** if everyone
        expects a quiet night, everyone goes, it's packed. If everyone expects a
        packed night, nobody goes, it's empty. Brian Arthur's insight: this is a
        domain where rational expectations *cannot even be defined*, so people must
        rely on **diverse rules of thumb**.

        Below, watch attendance settle just under capacity with almost no one thinking
        hard, while the *individual* week stays completely unpredictable. Toggle
        "everyone uses the same predictor" to see the catastrophic oscillation Arthur
        warned about.
        """
    )

    c1, c2, c3 = st.columns(3)
    n_agents = c1.slider("Population", 20, 200, 100, step=10, key="_ef_n")
    capacity = c2.slider("Capacity", 10, 100, 60, step=5, key="_ef_c")
    n_weeks  = c3.slider("Weeks to simulate", 40, 300, 120, step=10, key="_ef_w")

    c4, c5 = st.columns(2)
    homogeneous = c4.checkbox("Everyone uses the same predictor",
                              value=False, key="_ef_hom",
                              help="Force every agent to use the exact same forecasting rule. "
                                   "Arthur's cautionary case — the room oscillates violently.")
    n_preds     = c5.slider("Predictors per agent (diverse mode)",
                            1, 6, 3, step=1, key="_ef_np",
                            disabled=homogeneous)

    seed = st.number_input("Seed", 0, 100_000, 42, step=1, key="_ef_seed")

    r_div = simulate_el_farol(
        n_agents=int(n_agents), capacity=int(capacity), n_weeks=int(n_weeks),
        homogeneous=bool(homogeneous),
        predictors_per_agent=int(n_preds), seed=int(seed),
    )

    m1, m2, m3 = st.columns(3)
    m1.metric("Mean attendance", f"{r_div.mean:.1f}",
              f"capacity was {capacity}")
    m2.metric("SD of attendance", f"{r_div.std:.1f}",
              "week-to-week variability")
    m3.metric("% weeks over capacity", f"{100 * r_div.frac_over_capacity:.0f}%")

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=np.arange(1, n_weeks + 1), y=r_div.attendance,
        mode="lines+markers",
        line=dict(color=PALETTE["primary"], width=2),
        marker=dict(size=5),
        name="attendance",
    ))
    fig.add_hline(y=capacity, line=dict(color=PALETTE["danger"], dash="dash", width=2),
                  annotation_text=f"capacity = {capacity}",
                  annotation_position="top right")
    apply_theme(fig)
    fig.update_layout(
        height=360, xaxis_title="week", yaxis_title="people attending",
        yaxis=dict(range=[0, n_agents]),
    )
    st.plotly_chart(fig, width="stretch")

    # Comparison run: side-by-side with the opposite setting so users can see the gap.
    st.markdown("---")
    st.markdown(
        "**The comparison.** Below: the same simulation with the opposite predictor setting, "
        "same seed. Diverse predictors self-organise near capacity; a single shared predictor "
        "produces a two-cycle catastrophe."
    )
    r_opp = simulate_el_farol(
        n_agents=int(n_agents), capacity=int(capacity), n_weeks=int(n_weeks),
        homogeneous=not homogeneous,
        predictors_per_agent=int(n_preds), seed=int(seed),
    )
    fig_cmp = go.Figure()
    fig_cmp.add_trace(go.Scatter(
        x=np.arange(1, n_weeks + 1), y=r_div.attendance,
        mode="lines", line=dict(color=PALETTE["primary"], width=2.5),
        name=f"current setting (SD = {r_div.std:.1f})",
    ))
    fig_cmp.add_trace(go.Scatter(
        x=np.arange(1, n_weeks + 1), y=r_opp.attendance,
        mode="lines", line=dict(color=PALETTE["accent"], width=2.5, dash="dot"),
        name=f"opposite setting (SD = {r_opp.std:.1f})",
    ))
    fig_cmp.add_hline(y=capacity, line=dict(color=PALETTE["danger"], dash="dash", width=1))
    apply_theme(fig_cmp)
    fig_cmp.update_layout(
        height=320, xaxis_title="week", yaxis_title="people attending",
        yaxis=dict(range=[0, n_agents]),
    )
    st.plotly_chart(fig_cmp, width="stretch")

    st.info(
        "🎯 **Two lessons.** (a) Negative feedback stabilises the *average* and randomises the "
        "*individual case* — the exact opposite of Granovetter's positive-feedback riots. "
        "(b) Diversity of beliefs is what does the stabilising: correlated beliefs (same "
        "predictor) produce oscillation. Same mechanism as the Diversity Prediction Theorem "
        "(Ch 3) and the flash-crash worry about everyone running the same trading model."
    )


# ============================================================================
# Tab 3 · Tipping-point signature
# ============================================================================

with tabs[2]:
    st.subheader("Where does the tipping point live?")
    st.markdown(
        r"""
        Page's careful definition: a **tipping point** is where a small change in a
        parameter flips the qualitative outcome. To spot one from data, don't
        eyeball the mean-outcome curve — measure the **entropy of the outcome
        distribution** instead. Away from the tip, outcomes are certain (one
        answer). At the tip, the outcome is maximally uncertain: the same setup
        gives full cascades half the time and nothing the other half.

        Below is the tipping-point signature for the Granovetter cascade. We hold
        the mean threshold fixed and sweep the SD. Watch the entropy spike where
        the outcome switches from "always fizzle" to "always full cascade."
        """
    )

    c1, c2, c3 = st.columns(3)
    tp_mean   = c1.slider("Mean threshold", 5.0, 50.0, 25.0, step=1.0, key="_tp_mean")
    tp_n      = c2.slider("Population", 50, 300, 100, step=10, key="_tp_n")
    tp_runs   = c3.slider("Runs per SD", 50, 400, 150, step=25, key="_tp_runs")

    sds = np.linspace(1.0, 60.0, 30)
    sweep = cascade_variance_sweep(
        mean_threshold=float(tp_mean),
        sds=sds,
        n_agents=int(tp_n),
        n_runs=int(tp_runs),
        instigators=1,
        seed=42,
    )

    m1, m2 = st.columns(2)
    peak_idx = int(np.argmax(sweep.entropy_bits))
    m1.metric("Peak outcome entropy", f"{sweep.entropy_bits[peak_idx]:.2f} bits",
              f"at SD ≈ {sweep.parameter_values[peak_idx]:.1f}")
    m2.metric("Max log₂(bins)", f"{np.log2(10):.2f} bits",
              "the ceiling — maximally spread outcomes")

    # Two-panel figure: mean outcome + entropy
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=sweep.parameter_values, y=sweep.mean_outcome,
        mode="lines+markers",
        line=dict(color=PALETTE["primary"], width=3),
        marker=dict(size=6),
        name="mean cascade size",
    ))
    fig.add_trace(go.Scatter(
        x=sweep.parameter_values, y=sweep.fraction_full * tp_n,
        mode="lines", line=dict(color=PALETTE["success"], width=2, dash="dot"),
        name="% runs with full cascade (×N)",
    ))
    apply_theme(fig)
    fig.update_layout(
        height=280, xaxis_title="SD of threshold distribution",
        yaxis_title="cascade size (out of population)",
    )
    st.plotly_chart(fig, width="stretch")

    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=sweep.parameter_values, y=sweep.entropy_bits,
        mode="lines+markers",
        line=dict(color=PALETTE["accent"], width=3),
        marker=dict(size=6),
    ))
    # Mark the peak
    fig2.add_vline(x=sweep.parameter_values[peak_idx],
                   line=dict(color=PALETTE["muted"], dash="dash"),
                   annotation_text="tipping point",
                   annotation_position="top right")
    apply_theme(fig2)
    fig2.update_layout(
        height=280, xaxis_title="SD of threshold distribution",
        yaxis_title="outcome entropy (bits)",
        showlegend=False,
    )
    st.plotly_chart(fig2, width="stretch")

    st.info(
        "🎯 **Read the two plots together.** The mean-cascade-size line rises "
        "smoothly, obscuring what's really happening. The entropy plot exposes it: "
        "there's a narrow window of SD where the *same* threshold distribution "
        "produces both outcomes half the time, and outside that window one outcome "
        "dominates. That entropy peak *is* the tipping point. Page's suggestion: "
        "use this signature to distinguish genuine tips from smooth transitions."
    )

# ---- Full documentation ----------------------------------------------------
render_full_doc(META)
