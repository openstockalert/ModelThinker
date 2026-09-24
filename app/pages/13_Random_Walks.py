"""Streamlit page — Ch 13: Random Walks.

Four playful tabs, one big idea per tab:
  1. Watch walks     — feel the √t rule and how drift becomes "trend"
  2. Return times    — certain return + infinite expected wait
  3. Dimensions      — Pólya's theorem (drunk man vs drunk bird)
  4. Arcsine law     — why fair contests look one-sided
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
from modelthinker.dynamics.random_walk import (  # noqa: E402
    META,
    arcsine_fractions,
    dimension_recurrence,
    many_walks,
    return_times,
    theoretical_return_survival,
)

render_header(META)
render_doc_link(META)

# ---- Preset "Try this" scenarios -------------------------------------------
PRESETS = {
    "🎯 Coin flipper (default)":        dict(n_walks=200,  steps=500,   step_type="bernoulli", drift=0.0),
    "📈 Stock market year (Brownian)":  dict(n_walks=50,   steps=252,   step_type="normal",    drift=0.0004),
    "🚶 Solo drunkard (single walk)":   dict(n_walks=1,    steps=2000,  step_type="bernoulli", drift=0.0),
    "🌊 Big swarm — feel the √t rule":  dict(n_walks=1000, steps=1000,  step_type="bernoulli", drift=0.0),
    "🏇 The 'obvious trend'":           dict(n_walks=10,   steps=5000,  step_type="bernoulli", drift=0.01),
}

# Initialise widget-backed session state ONCE, before the widgets render.
# Widgets with `key=` read from st.session_state[key], so this is the single
# source of truth. The "Apply preset" button writes to these same keys —
# because that write happens *before* the widgets are created on this run,
# the widgets pick up the new values.
_DEFAULTS = dict(_rw_n_walks=200, _rw_steps=500, _rw_step_type="bernoulli", _rw_drift=0.0)
for _k, _v in _DEFAULTS.items():
    st.session_state.setdefault(_k, _v)

with st.sidebar:
    st.subheader("Try a preset")
    preset_choice = st.selectbox("Load parameters from…", options=list(PRESETS.keys()), index=0)
    if st.button("↩ Apply preset", width="stretch"):
        p = PRESETS[preset_choice]
        st.session_state["_rw_n_walks"] = p["n_walks"]
        st.session_state["_rw_steps"] = p["steps"]
        st.session_state["_rw_step_type"] = p["step_type"]
        st.session_state["_rw_drift"] = p["drift"]
        # Force an immediate rerun so the widgets below re-read the new state.
        st.rerun()

    st.divider()
    st.subheader("Parameters")
    step_type = st.radio(
        "Step type", ["bernoulli", "normal"],
        key="_rw_step_type",
        help="Bernoulli = ±1 coin flip. Normal = Gaussian step (Brownian motion).",
    )
    steps = st.slider("Steps per walk", 50, 20_000, step=50, key="_rw_steps")
    n_walks = st.slider("Number of walks", 1, 5000, step=1, key="_rw_n_walks")
    drift = st.slider(
        "Drift μ per step", -0.05, 0.05, step=0.001, format="%.3f",
        key="_rw_drift",
        help="Non-zero drift makes the walk transient — it drifts off in one direction.",
    )
    seed = st.number_input("Seed", 0, 1_000_000, 42, step=1, key="_rw_seed")

# =============================================================================
tabs = st.tabs([
    "🚶 Watch walks",
    "⏳ Return-time paradox",
    "🌍 Dimensions (Pólya)",
    "⚖ Arcsine law",
])

# ============================================================================
# TAB 1 — Watch walks
# ============================================================================
with tabs[0]:
    st.subheader("Watch the walkers — and the √t envelope")
    st.caption(
        "Each thin line is one walk. The **shaded band** is the ±√t envelope — "
        "where you'd typically be after each many steps. Try doubling `steps` in the sidebar: the envelope only widens by √2."
    )

    result = many_walks(
        n_walks=int(n_walks), steps=int(steps),
        step_type=step_type, drift=float(drift), seed=int(seed),
    )
    t = np.arange(result.positions.shape[1])
    # Show up to 200 individual traces
    max_show = min(result.n_walks, 200)
    fig = go.Figure()
    for i in range(max_show):
        fig.add_trace(go.Scatter(
            x=t, y=result.positions[i], mode="lines",
            line=dict(color=PALETTE["primary"], width=0.7),
            opacity=0.35 if result.n_walks > 20 else 0.8,
            hoverinfo="skip", showlegend=False,
        ))
    # √t envelope (for driftless case) — sigma per step is 1 for Bernoulli.
    sigma_step = 1.0
    envelope = sigma_step * np.sqrt(t)
    fig.add_trace(go.Scatter(
        x=np.concatenate([t, t[::-1]]),
        y=np.concatenate([envelope, -envelope[::-1]]) + drift * t.astype(float).mean() * 0,
        fill="toself", fillcolor="rgba(247,103,7,0.15)",
        line=dict(color="rgba(0,0,0,0)"), name="±√t envelope",
        hoverinfo="skip",
    ))
    # Mean trajectory (drift × t)
    if abs(drift) > 1e-8:
        fig.add_trace(go.Scatter(
            x=t, y=drift * t, mode="lines", name=f"expected drift μ·t (μ={drift:.3f})",
            line=dict(color=PALETTE["danger"], width=2, dash="dash"),
        ))
    apply_theme(fig)
    fig.update_layout(
        xaxis_title="step t", yaxis_title="position S(t)",
        height=460, showlegend=True,
    )
    st.plotly_chart(fig, width="stretch")

    # Metrics
    final = result.positions[:, -1]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Final mean position", f"{final.mean():+.2f}")
    c2.metric("Final std of positions", f"{final.std(ddof=1):.2f}",
              delta=f"theory √t = {np.sqrt(steps):.2f}")
    c3.metric("Furthest walker reached", f"{np.abs(result.positions).max():.0f}")
    c4.metric("Walks shown", f"{max_show}/{result.n_walks}")

    if abs(drift) > 1e-8:
        st.info(
            f"💡 **The 'obvious trend' illusion.** You added a drift of μ = {drift:.3f} per step. "
            f"Over {steps} steps that's an *expected* drift of {drift*steps:+.1f} — but the ±√t noise band spans "
            f"±{np.sqrt(steps):.0f}. If someone showed you one of these paths without telling you μ, you'd probably "
            f"call it a trend. Real market analysts have this problem every day."
        )

# ============================================================================
# TAB 2 — Return-time paradox
# ============================================================================
with tabs[1]:
    st.subheader("The return-time paradox — certain, but with infinite expected wait")
    st.caption(
        "A 1-D walk returns to zero with probability 1. Yet the *average* time to return is infinite. "
        "Look at what half the walkers do vs what the slowest ones do."
    )

    c_a, c_b = st.columns([2, 3])
    with c_a:
        rt_n = st.slider("Walks to simulate", 200, 20_000, 5000, step=200,
                         key="_rw_rt_n")
        rt_max = st.slider("Give up after (max steps)", 500, 50_000, 10_000, step=500,
                           key="_rw_rt_max")
    with c_b:
        st.markdown(
            "*Theory:*\n"
            "- **P(T = 2) = ½** — half of walks return in the very first two steps.\n"
            "- **P(T > t) ≈ √(2/(π t))** — a power law with exponent ½.\n"
            "- **E[T] = ∞** — the tail is so slow that the mean is undefined."
        )

    with st.spinner("Simulating return times…"):
        rt = return_times(n_walks=int(rt_n), max_steps=int(rt_max), seed=int(seed))

    ret_only = rt.returned_times
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Returned within budget", f"{100 * rt.return_fraction:.1f}%")
    m2.metric("Median return time", f"{int(np.median(ret_only) if ret_only.size else 0)} steps")
    m3.metric("99th percentile", f"{int(np.percentile(ret_only, 99)) if ret_only.size else 0} steps")
    m4.metric("Empirical mean", f"{ret_only.mean():.1f} steps" if ret_only.size else "—",
              delta="theory: ∞", delta_color="off")

    # Two plots: distribution of return times (log-x), and survival curve on log-log
    left, right = st.columns(2)
    with left:
        st.markdown("**Distribution of return times** (log x-axis)")
        # bin log-uniformly
        max_val = max(int(ret_only.max()) if ret_only.size else 2, 4)
        bins = np.unique(np.round(np.geomspace(2, max_val, 40)).astype(int))
        counts, edges = np.histogram(ret_only, bins=bins)
        centers = 0.5 * (edges[:-1] + edges[1:])
        fig_a = go.Figure()
        fig_a.add_trace(go.Bar(x=centers, y=counts,
                               marker_color=PALETTE["primary"], name="counts"))
        apply_theme(fig_a)
        fig_a.update_layout(
            xaxis_type="log", xaxis_title="return time T (log)", yaxis_title="walks",
            height=350, showlegend=False,
        )
        st.plotly_chart(fig_a, width="stretch")
    with right:
        st.markdown("**Survival curve P(T > t)** — log-log, should be a straight line")
        ts = np.geomspace(2, rt.max_steps, 60)
        emp_surv = np.array([(ret_only > ti).sum() / rt.n_walks + (rt.times == 0).sum() / rt.n_walks
                             for ti in ts])
        theory = theoretical_return_survival(ts)
        fig_b = go.Figure()
        fig_b.add_trace(go.Scatter(x=ts, y=emp_surv, mode="lines+markers",
                                   name="empirical", line=dict(color=PALETTE["primary"], width=3)))
        fig_b.add_trace(go.Scatter(x=ts, y=theory, mode="lines", name="theory √(2/(π t))",
                                   line=dict(color=PALETTE["danger"], width=2, dash="dash")))
        apply_theme(fig_b)
        fig_b.update_layout(xaxis_type="log", yaxis_type="log",
                            xaxis_title="t (log)", yaxis_title="P(T > t) (log)", height=350)
        st.plotly_chart(fig_b, width="stretch")

    st.success(
        "🎲 **Try it yourself:** most walkers come home in ~2 steps. The slowest 1 % take *thousands* of steps. "
        "A gambler on a fair bet is guaranteed to break even eventually — but might go broke first (gambler's ruin)."
    )

# ============================================================================
# TAB 3 — Dimensions (Pólya)
# ============================================================================
with tabs[2]:
    st.subheader("Pólya's theorem — a drunk man vs a drunk bird")
    st.markdown(
        "> *A drunk man will find his way home, but a drunk bird may get lost forever.* — Shizuo Kakutani"
    )
    st.caption(
        "On a lattice, each step picks a random axis and moves ±1. In 1-D and 2-D, the walker returns to the "
        "start with probability 1. In 3-D and above, it might drift off forever."
    )

    c_a, c_b = st.columns([2, 3])
    with c_a:
        dim_n = st.slider("Walks per dimension", 200, 5000, 1000, step=100, key="_rw_dim_n")
        dim_max = st.slider("Max steps per walk", 500, 30_000, 5000, step=500, key="_rw_dim_max")

    dims = [1, 2, 3, 4]
    theory_map = {1: 1.0, 2: 1.0, 3: 0.3405, 4: 0.193}
    with c_b:
        st.markdown(
            "*Theoretical eventual-return probabilities:*\n"
            "- **1-D:** 1.00\n"
            "- **2-D:** 1.00 (but returns very slowly — barely recurrent)\n"
            "- **3-D:** 0.3405 (Pólya's constant)\n"
            "- **4-D:** 0.193"
        )

    with st.spinner("Running walks in 1D, 2D, 3D, 4D…"):
        results = {d: dimension_recurrence(dim=d, n_walks=int(dim_n),
                                           max_steps=int(dim_max), seed=int(seed) + d)
                   for d in dims}

    fig = go.Figure()
    empirical = [results[d].return_fraction for d in dims]
    theory = [theory_map[d] for d in dims]
    fig.add_trace(go.Bar(
        x=[f"{d}-D" for d in dims], y=empirical, name="empirical",
        marker_color=PALETTE["primary"],
        text=[f"{100*v:.1f}%" for v in empirical], textposition="auto",
    ))
    fig.add_trace(go.Scatter(
        x=[f"{d}-D" for d in dims], y=theory, mode="markers",
        marker=dict(color=PALETTE["danger"], size=16, symbol="diamond"),
        name="theoretical limit",
    ))
    apply_theme(fig)
    fig.update_layout(xaxis_title="lattice dimension",
                      yaxis_title=f"fraction returning within {dim_max:,} steps",
                      yaxis_range=[0, 1.05], height=400)
    st.plotly_chart(fig, width="stretch")

    st.info(
        "🔬 **Why it matters.** A protein diffusing in 3-D water rarely revisits the same spot. "
        "Confine it to a 2-D membrane and it sweeps its neighbourhood thoroughly — which is why "
        "many cellular processes reduce dimensionality (proteins slide along DNA, hormones bind to membranes)."
    )
    st.caption(
        "Note: 2-D returns are certain but *very slowly* — the fraction here climbs like 1/log t, "
        "so it looks lower than 3-D at short budgets. Increase the max steps and it will rise."
    )

# ============================================================================
# TAB 4 — Arcsine law
# ============================================================================
with tabs[3]:
    st.subheader("The arcsine law — why fair contests look one-sided")
    st.caption(
        "For each walk we measure: what fraction of the time is the walker *ahead of zero* "
        "(equivalently, one team leads the other)? Intuition says ½. Reality says the extremes."
    )

    c_a, c_b = st.columns([2, 3])
    with c_a:
        as_n = st.slider("Number of walks", 500, 20_000, 5000, step=500, key="_rw_as_n")
        as_steps = st.slider("Steps per walk", 100, 5000, 500, step=100, key="_rw_as_steps")
    with c_b:
        st.markdown(
            "*Theory:* the fraction of time positive follows the **arcsine distribution** with CDF "
            "$F(x) = \\tfrac{2}{\\pi}\\arcsin\\sqrt{x}$. Density peaks at 0 and 1 — leading exactly "
            "half the time is the *rarest* outcome."
        )

    fracs = arcsine_fractions(n_walks=int(as_n), steps=int(as_steps), seed=int(seed))

    fig = go.Figure()
    counts, edges = np.histogram(fracs, bins=25, range=(0, 1), density=True)
    centers = 0.5 * (edges[:-1] + edges[1:])
    fig.add_trace(go.Bar(x=centers, y=counts, width=(edges[1] - edges[0]) * 0.9,
                         marker_color=PALETTE["primary"], name="empirical density"))
    # Theoretical arcsine density: 1/(π √(x(1-x)))
    xs = np.linspace(0.01, 0.99, 200)
    pdf = 1.0 / (np.pi * np.sqrt(xs * (1 - xs)))
    fig.add_trace(go.Scatter(x=xs, y=pdf, mode="lines", name="arcsine density (theory)",
                             line=dict(color=PALETTE["danger"], width=3)))
    apply_theme(fig)
    fig.update_layout(xaxis_title="fraction of time position > 0",
                      yaxis_title="density", height=420)
    st.plotly_chart(fig, width="stretch")

    edges_frac = ((fracs < 0.1) | (fracs > 0.9)).mean()
    middle_frac = ((fracs > 0.4) & (fracs < 0.6)).mean()
    m1, m2, m3 = st.columns(3)
    m1.metric("Near the extremes (< 10% or > 90%)", f"{100*edges_frac:.1f}%")
    m2.metric("Near the middle (40–60%)", f"{100*middle_frac:.1f}%")
    m3.metric("Ratio extremes : middle", f"{edges_frac / max(middle_frac, 1e-9):.1f}×")

    st.success(
        "🏆 **The 'dominant team' illusion.** In a truly balanced game between two evenly-matched teams, "
        "one team will typically lead *almost the whole time*. So 'clearly the better team' is what a fair matchup "
        "usually looks like — not evidence that the matchup wasn't fair."
    )

# ---- Full documentation -----------------------------------------------------
render_full_doc(META)
