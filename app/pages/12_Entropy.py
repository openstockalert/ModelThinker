"""Streamlit page — Ch 12: Entropy.

Three tabs covering the chapter's three threads:
  1. Shannon entropy — a live calculator + diversity gauge
  2. Maximum-entropy distributions given constraints
  3. Cellular-automata explorer — the four Wolfram classes on rules 0–255
"""

from __future__ import annotations

import math
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
from modelthinker.dynamics.entropy import (  # noqa: E402
    CLASS_NAMES,
    META,
    WOLFRAM_CLASSES,
    exponential_entropy,
    normal_entropy,
    run_elementary_ca,
    shannon_entropy,
    uniform_entropy,
)

render_header(META)
render_doc_link(META)

st.caption(
    "Chapter 12 gives entropy two jobs: measure **uncertainty** in a distribution, and "
    "**classify systems** by how their output looks over time. This page walks through both, "
    "plus the max-entropy distributions that are the workhorse of applied information theory."
)

tabs = st.tabs([
    "📊 Shannon entropy",
    "📏 Max-entropy distributions",
    "🌀 Cellular automata · the four classes",
])

# ============================================================================
# Tab 1 · Shannon entropy calculator
# ============================================================================

with tabs[0]:
    st.subheader("Shannon entropy — one number for uncertainty (and diversity)")
    st.markdown(
        r"""
        Shannon defined entropy as $H = -\sum_i p_i \log_2 p_i$ bits. A **certain**
        outcome ($p = 1$) has $H = 0$: no surprise. A **uniform** distribution over
        $K$ outcomes has $H = \log_2 K$: maximum surprise. Everything else lies in
        between, and the number tells you *how* peaked the distribution is.

        Slide the bars below to see how quickly entropy falls as a distribution
        concentrates.
        """
    )

    n_outcomes = st.slider("Number of outcomes K", 2, 10, 4, key="_ent_k")
    st.markdown("**Set the (unnormalised) weight of each outcome:**")
    presets = st.columns(4)
    if presets[0].button("🎲 Uniform",  key="_ent_pre_unif"):
        for i in range(n_outcomes):
            st.session_state[f"_ent_w{i}"] = 1.0
    if presets[1].button("🎯 Certain",  key="_ent_pre_cert"):
        for i in range(n_outcomes):
            st.session_state[f"_ent_w{i}"] = 1.0 if i == 0 else 0.0
    if presets[2].button("📉 Skewed",   key="_ent_pre_skew"):
        for i in range(n_outcomes):
            st.session_state[f"_ent_w{i}"] = float(2 ** (n_outcomes - i - 1))
    if presets[3].button("🎪 Bimodal",  key="_ent_pre_bim"):
        for i in range(n_outcomes):
            st.session_state[f"_ent_w{i}"] = 1.0 if i in (0, n_outcomes - 1) else 0.05

    cols = st.columns(n_outcomes)
    weights = []
    for i, col in enumerate(cols):
        key = f"_ent_w{i}"
        if key not in st.session_state:
            st.session_state[key] = 1.0
        w = col.slider(
            f"p{i}", 0.0, 1.0, float(st.session_state[key]), step=0.01, key=key,
        )
        weights.append(w)
    weights = np.array(weights, dtype=float)
    total = float(weights.sum())
    if total <= 0:
        st.warning("At least one weight must be positive — defaulting to uniform.")
        weights = np.ones(n_outcomes)
        total = float(n_outcomes)
    p = weights / total

    H = shannon_entropy(p)
    H_max = math.log2(n_outcomes)
    H_frac = H / H_max if H_max > 0 else 0.0

    m1, m2, m3 = st.columns(3)
    m1.metric("Entropy H", f"{H:.3f} bits")
    m2.metric("Maximum log₂ K", f"{H_max:.3f} bits", delta=f"K = {n_outcomes}")
    m3.metric("Normalised H", f"{100 * H_frac:.1f}%",
              delta="0 = certain · 100 = uniform")

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=[f"outcome {i}" for i in range(n_outcomes)],
        y=p,
        marker_color=PALETTE["primary"],
        text=[f"{pi:.3f}" for pi in p],
        textposition="outside",
    ))
    apply_theme(fig)
    fig.update_layout(
        yaxis=dict(title="probability", range=[0, max(0.05, max(p) * 1.2)]),
        height=340, showlegend=False,
    )
    st.plotly_chart(fig, width="stretch")

    # An entropy gauge that spans 0 -> log2 K
    fig_gauge = go.Figure(go.Indicator(
        mode="gauge+number",
        value=H,
        number=dict(suffix=" bits", font=dict(size=32)),
        gauge=dict(
            axis=dict(range=[0, H_max], tickwidth=1),
            bar=dict(color=PALETTE["accent"]),
            steps=[
                dict(range=[0, H_max / 3],       color="#E7F5FF"),
                dict(range=[H_max / 3, 2 * H_max / 3], color="#DBE4FF"),
                dict(range=[2 * H_max / 3, H_max],     color="#BAC8FF"),
            ],
            threshold=dict(
                line=dict(color=PALETTE["muted"], width=3),
                thickness=0.9, value=H_max,
            ),
        ),
        title=dict(text="Shannon H"),
    ))
    fig_gauge.update_layout(height=260, margin=dict(l=20, r=20, t=30, b=20))
    st.plotly_chart(fig_gauge, width="stretch")

    st.info(
        "🎯 **Try this.** Push one weight to (near) 1 and the others to 0 — the entropy "
        "collapses toward 0 bits: you're nearly certain. Now equalise the weights: entropy "
        "climbs to log₂ K, its ceiling. Any middle ground is between certainty and total ignorance."
    )

# ============================================================================
# Tab 2 · Maximum-entropy distributions
# ============================================================================

with tabs[1]:
    st.subheader("Max-entropy distributions — the honest guess given a constraint")
    st.markdown(
        r"""
        **Given what you know, assume the least-structured distribution.** That's the
        maximum-entropy (max-ent) principle. Different constraints give different answers:

        | Constraint | Max-entropy distribution | Entropy (nats) |
        |------------|--------------------------|----------------|
        | Known range $[a, b]$ | **Uniform** on $[a, b]$ | $\ln(b - a)$ |
        | Known mean $\mu > 0$ (support $[0, \infty)$) | **Exponential**($\mu$) | $1 + \ln \mu$ |
        | Known mean & variance $\sigma^2$ | **Normal**($\mu$, $\sigma^2$) | $\tfrac12 \ln(2\pi e \sigma^2)$ |

        Any other distribution meeting the same constraint has *less* entropy — it's
        smuggling in extra assumptions.
        """
    )

    which = st.radio(
        "Constraint you have",
        options=["Range [a, b]", "Mean μ > 0", "Mean μ and variance σ²"],
        horizontal=True, key="_ent_maxent_which",
    )

    xs = np.linspace(-4, 8, 400)

    if which == "Range [a, b]":
        a = st.slider("a", -3.0, 3.0, 0.0, step=0.1, key="_ent_a")
        b = st.slider("b", -2.0, 6.0, 3.0, step=0.1, key="_ent_b")
        if b <= a:
            st.warning("Need b > a — nudging b up.")
            b = a + 0.1
        pdf = np.where((xs >= a) & (xs <= b), 1.0 / (b - a), 0.0)
        H_bits = uniform_entropy(a, b, base=2)
        H_nats = uniform_entropy(a, b, base=math.e)
        name = f"Uniform({a:.2f}, {b:.2f})"
    elif which == "Mean μ > 0":
        mu = st.slider("Mean μ", 0.1, 5.0, 1.0, step=0.05, key="_ent_mu_exp")
        pdf = np.where(xs >= 0, (1 / mu) * np.exp(-xs / mu), 0.0)
        H_bits = exponential_entropy(mu, base=2)
        H_nats = exponential_entropy(mu, base=math.e)
        name = f"Exponential(μ = {mu:.2f})"
    else:
        mu = st.slider("Mean μ", -2.0, 4.0, 1.0, step=0.1, key="_ent_mu_n")
        sigma = st.slider("SD σ", 0.1, 3.0, 1.0, step=0.05, key="_ent_sd_n")
        pdf = (1 / (sigma * math.sqrt(2 * math.pi))) * np.exp(-((xs - mu) ** 2) / (2 * sigma ** 2))
        H_bits = normal_entropy(sigma, base=2)
        H_nats = normal_entropy(sigma, base=math.e)
        name = f"Normal(μ = {mu:.2f}, σ = {sigma:.2f})"

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=xs, y=pdf, mode="lines",
        line=dict(color=PALETTE["primary"], width=3), name=name,
        fill="tozeroy", fillcolor="rgba(76, 110, 245, 0.15)",
    ))
    apply_theme(fig)
    fig.update_layout(xaxis_title="x", yaxis_title="density", height=340,
                      title=f"Max-entropy answer: {name}")
    st.plotly_chart(fig, width="stretch")

    m1, m2 = st.columns(2)
    m1.metric("Differential entropy (nats)", f"{H_nats:.3f}")
    m2.metric("… in bits", f"{H_bits:.3f}")

    st.info(
        "🎯 **Why does this matter?** In risk-modelling, physics, and Bayesian statistics, "
        "the max-entropy answer is the *least presumptuous* one — it doesn't invent structure "
        "you didn't declare. If you actually know more (a mode, quantiles, higher moments) you "
        "get a different, tighter distribution."
    )

    # Bonus: show how a shifted distribution with the same variance has less entropy
    if which == "Mean μ and variance σ²":
        # A mixture of two normals with the same mean & variance has lower entropy than the normal.
        # Use two normals at ±d with sd s such that s² + d² = σ² so the total variance matches.
        mu_ref = st.session_state.get("_ent_mu_n", 1.0)
        s_ref  = st.session_state.get("_ent_sd_n", 1.0)
        d = min(s_ref * 0.75, 1.5)
        s_inner = math.sqrt(max(1e-6, s_ref * s_ref - d * d))
        mix = 0.5 * ((1 / (s_inner * math.sqrt(2 * math.pi))) * np.exp(-((xs - mu_ref - d) ** 2) / (2 * s_inner ** 2))
                     + (1 / (s_inner * math.sqrt(2 * math.pi))) * np.exp(-((xs - mu_ref + d) ** 2) / (2 * s_inner ** 2)))
        # Bin the two curves onto the same discrete grid and compute entropies for comparison
        dx = xs[1] - xs[0]
        # Discrete entropies of the binned pdfs, in bits
        H_normal_disc  = shannon_entropy(pdf * dx + 1e-30)
        H_mixture_disc = shannon_entropy(mix * dx + 1e-30)
        st.caption(
            f"Bimodal check — a mixture of two normals with the same total variance has "
            f"discrete H ≈ {H_mixture_disc:.3f} bits, compared with the max-ent normal's "
            f"{H_normal_disc:.3f} bits. Any structure you add costs entropy."
        )

# ============================================================================
# Tab 3 · Cellular automata — the four classes
# ============================================================================

with tabs[2]:
    st.subheader("The four Wolfram classes on 1-D cellular automata")
    st.markdown(
        r"""
        Wolfram noticed that elementary 1-D cellular automata (256 possible rules,
        each with a 3-cell neighbourhood) produce exactly **four kinds** of long-run
        behaviour. Page uses these as concrete instances of the four classes any
        system's output can fall into:

        1. **Equilibrium** — settles to a fixed pattern (low entropy).
        2. **Periodic** — cycles.
        3. **Random** — no discernible pattern (high entropy).
        4. **Complex** — structured, but never quite the same twice.

        Slide the rule number below (0–255) or click a preset. Watch the space-time
        diagram and the entropy trajectory.
        """
    )

    quickpicks = st.columns(6)
    if quickpicks[0].button("Rule 0 (class 1)", key="_ca_r0"):
        st.session_state["_ca_rule"] = 0
    if quickpicks[1].button("Rule 184 (class 2)", key="_ca_r184"):
        st.session_state["_ca_rule"] = 184
    if quickpicks[2].button("Rule 30 (class 3)", key="_ca_r30"):
        st.session_state["_ca_rule"] = 30
    if quickpicks[3].button("Rule 90 (class 3, Sierpinski)", key="_ca_r90"):
        st.session_state["_ca_rule"] = 90
    if quickpicks[4].button("Rule 110 (class 4, Turing)", key="_ca_r110"):
        st.session_state["_ca_rule"] = 110
    if quickpicks[5].button("Rule 54 (class 4)", key="_ca_r54"):
        st.session_state["_ca_rule"] = 54

    c1, c2, c3 = st.columns(3)
    rule = c1.slider("Wolfram rule", 0, 255, 30, step=1, key="_ca_rule")
    width = c2.slider("Row width", 41, 401, 201, step=20, key="_ca_width")
    steps = c3.slider("Steps", 40, 500, 200, step=20, key="_ca_steps")

    c4, c5, c6 = st.columns(3)
    initial_kind = c4.selectbox(
        "Initial row", options=["single", "random"],
        format_func=lambda k: "🎯 Single 1 at centre" if k == "single" else "🎲 Random row",
        key="_ca_init",
    )
    initial_density = c5.slider("Random density", 0.05, 0.95, 0.5, step=0.05,
                                key="_ca_dens", disabled=(initial_kind != "random"))
    seed = c6.number_input("Seed", 0, 100_000, 42, step=1, key="_ca_seed")

    result = run_elementary_ca(
        rule=int(rule), width=int(width), steps=int(steps),
        initial_kind=initial_kind, initial_density=float(initial_density),
        seed=int(seed),
    )

    known_class = WOLFRAM_CLASSES.get(int(rule))
    detected_class = result.wolfram_class

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Rule", f"{rule}",
              delta=f"binary {rule:08b}")
    m2.metric("Detected class", f"{detected_class} · {CLASS_NAMES[detected_class]}")
    m3.metric("Known class", f"{known_class}" if known_class else "—",
              delta=("Wolfram's list" if known_class else "not in the famous list"))
    m4.metric("Block entropy (bits, k=4)", f"{result.block_entropy_final:.3f}",
              delta=f"max {result.block_k}")

    # Space-time diagram
    fig = go.Figure(data=go.Heatmap(
        z=result.grid,
        colorscale=[[0.0, "#FBFCFF"], [1.0, "#212529"]],
        showscale=False, xgap=0, ygap=0,
    ))
    apply_theme(fig)
    fig.update_layout(
        height=460, margin=dict(l=6, r=6, t=6, b=6),
        xaxis=dict(showticklabels=False, zeroline=False, title="space →"),
        yaxis=dict(showticklabels=False, zeroline=False,
                   scaleanchor=None, autorange="reversed", title="time ↓"),
    )
    st.plotly_chart(fig, width="stretch")

    # Row-entropy over time
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=np.arange(result.row_entropies.size),
        y=result.row_entropies,
        mode="lines",
        line=dict(color=PALETTE["accent"], width=2),
        name="row H",
    ))
    fig2.add_hline(y=1.0, line=dict(color=PALETTE["muted"], dash="dot"),
                   annotation_text="max = 1 bit (50/50)")
    apply_theme(fig2)
    fig2.update_layout(
        height=240, xaxis_title="time step", yaxis_title="row H (bits)",
        yaxis=dict(range=[0, 1.08]),
    )
    st.plotly_chart(fig2, width="stretch")

    # Contextual explanation
    if detected_class == 1:
        st.info(
            "🏁 **Class 1 · equilibrium.** The pattern collapses to a monochrome fixed "
            "point. Entropy → 0. Very few surprises left — this is the tidiest kind of "
            "system, but usually not the interesting kind."
        )
    elif detected_class == 2:
        st.info(
            "🔁 **Class 2 · periodic.** The pattern locks into a stable cycle. Entropy "
            "stays flat at some middle value. Predictable once you know the period. "
            "Rule 184 (the traffic model) is a beautiful example."
        )
    elif detected_class == 3:
        st.info(
            "🎲 **Class 3 · random.** Block entropy sits near its ceiling — the row could "
            "be the output of a good PRNG. Rule 30 is so good at this that Mathematica used "
            "it as its default random-number generator for years. But: totally random doesn't "
            "mean *interesting*."
        )
    else:
        st.info(
            "🧠 **Class 4 · complex.** Structured, but never repeats. You can see local "
            "'particles' (gliders) traversing a fixed background. Rule 110 was proven "
            "Turing complete — this narrow band between order and chaos is where "
            "computation lives, and Page argues, so do markets, ecosystems and cities."
        )

    st.caption(
        "⚠️ **Classifier caveat.** The class is inferred from a simple block-entropy "
        "heuristic; distinguishing rule 30 (random) from rule 110 (complex) by statistics "
        "alone is genuinely hard. The 'known class' column reflects Wolfram's hand-classification. "
        "When they disagree, that mismatch *is* the lesson."
    )

# ---- Full documentation ----------------------------------------------------
render_full_doc(META)
