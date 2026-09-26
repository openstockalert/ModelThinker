"""Streamlit page — Ch 17: Markov chains.

Four tabs covering the chapter's headline results:
  1. See the chain — transition matrix + stationary distribution + graph view
  2. Population dynamics — many walkers, stacked area to stationary
  3. Different starts, same end — the Markov convergence theorem, three initial states
  4. Interventions vs rule changes — the pedagogical highlight
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
from modelthinker.dynamics.markov import (  # noqa: E402
    META,
    PRESETS,
    distribution_over_time,
    intervention_experiment,
    population_distribution,
    simulate,
    stationary_distribution,
)

render_header(META)
render_doc_link(META)

# ---- Sidebar ----------------------------------------------------------------

with st.sidebar:
    st.subheader("Chain preset")
    preset_key = st.selectbox(
        "Story",
        options=list(PRESETS.keys()),
        format_func=lambda k: PRESETS[k]["name"],
        index=0,
        key="_mkv_preset",
    )
    st.divider()
    st.subheader("Parameters")
    n_walks = st.slider("Number of walkers", 20, 5_000, 500, step=20, key="_mkv_n_walks")
    steps = st.slider("Steps per walk", 20, 1000, 200, step=10, key="_mkv_steps")
    seed = st.number_input("Seed", 0, 1_000_000, 42, step=1, key="_mkv_seed")

preset = PRESETS[preset_key]
P = np.asarray(preset["P"], dtype=float)
states = preset["states"]
n_states = P.shape[0]

st.markdown(f"### {preset['name']}")
st.caption(preset["description"])

# ---- Chain overview — matrix + stationary ---------------------------------

pi = stationary_distribution(P)

col_left, col_right = st.columns([3, 2])

with col_left:
    st.markdown("#### Transition matrix P")
    # Heatmap with annotations
    fig_P = go.Figure(data=go.Heatmap(
        z=P, x=states, y=states, colorscale="Blues",
        text=[[f"{v:.2f}" for v in row] for row in P],
        texttemplate="%{text}", textfont={"size": 12},
        showscale=False,
    ))
    fig_P.update_layout(
        xaxis_title="→ next state", yaxis_title="current state",
        height=280, yaxis_autorange="reversed",
    )
    apply_theme(fig_P)
    st.plotly_chart(fig_P, width="stretch")
    st.caption("Row *i*, column *j* = probability of going from state *i* to state *j* next step.")

with col_right:
    st.markdown("#### Stationary distribution π")
    fig_pi = go.Figure(data=go.Bar(
        x=states, y=pi, marker_color=PALETTE["primary"],
        text=[f"{100*v:.1f}%" for v in pi], textposition="outside",
    ))
    fig_pi.update_layout(
        yaxis_title="long-run share", yaxis_range=[0, max(pi.max() * 1.2, 0.05)],
        height=280,
    )
    apply_theme(fig_pi)
    st.plotly_chart(fig_pi, width="stretch")
    st.caption("Computed as the left eigenvector of P for eigenvalue 1.")

tabs = st.tabs([
    "🚶 Sample walker",
    "📈 Population dynamics",
    "🎯 Different starts, same end",
    "🔧 Interventions vs rule changes",
])

# ---- Tab 1 · Sample walker -------------------------------------------------
with tabs[0]:
    st.subheader("One walker · watch history not matter")
    st.caption(
        "A single trajectory bounces between states following P. Zoom out and it doesn't "
        "matter where it started — the fraction of time spent in each state approaches π."
    )
    start = st.selectbox(
        "Starting state",
        options=list(range(n_states)),
        format_func=lambda i: states[i],
        index=0, key="_mkv_walker_start",
    )
    result = simulate(P=P, initial_state=int(start), steps=int(steps), n_walks=1, seed=int(seed))
    trace = result.trajectories[0]

    fig = go.Figure()
    # Step plot — a horizontal line at the state, then a vertical jump
    fig.add_trace(go.Scatter(
        x=np.arange(len(trace)), y=trace, mode="lines+markers",
        line=dict(color=PALETTE["primary"], width=2, shape="hv"),
        marker=dict(size=6, color=PALETTE["primary"]),
        name="state", hoverinfo="skip",
    ))
    apply_theme(fig)
    fig.update_layout(
        xaxis_title="step",
        yaxis=dict(
            tickvals=list(range(n_states)),
            ticktext=states,
            range=[-0.4, n_states - 0.6],
        ),
        height=380,
    )
    st.plotly_chart(fig, width="stretch")

    # Show empirical time-in-state vs theoretical π
    empirical = np.bincount(trace, minlength=n_states) / len(trace)
    st.markdown("#### Empirical time-in-state vs theoretical π")
    fig2 = go.Figure()
    fig2.add_trace(go.Bar(x=states, y=empirical, name="empirical (this walker)",
                          marker_color=PALETTE["primary"]))
    fig2.add_trace(go.Scatter(x=states, y=pi, mode="markers",
                              marker=dict(color=PALETTE["danger"], size=14, symbol="diamond"),
                              name="theoretical π"))
    apply_theme(fig2)
    fig2.update_layout(yaxis_title="fraction of time", height=280,
                        yaxis_range=[0, max(max(empirical.max(), pi.max()) * 1.2, 0.1)])
    st.plotly_chart(fig2, width="stretch")
    st.caption(
        f"After {len(trace) - 1} steps, one walker's time-in-state should already be close to π. "
        "Increase `steps` in the sidebar to tighten the match."
    )

# ---- Tab 2 · Population dynamics -------------------------------------------
with tabs[1]:
    st.subheader("Many walkers · watch the distribution stabilise")
    st.caption(
        f"Simulate {int(n_walks)} walkers from the same starting state. Below is the fraction of walkers "
        "in each state at each time step, stacked. The stacked bands should stop shifting once "
        "the population reaches π."
        
    )
    pop_start = st.selectbox(
        "All start in state",
        options=list(range(n_states)),
        format_func=lambda i: states[i],
        index=0, key="_mkv_pop_start",
    )
    with st.spinner("Simulating…"):
        pop_result = simulate(
            P=P, initial_state=int(pop_start),
            steps=int(steps), n_walks=int(n_walks), seed=int(seed),
        )
    pop = population_distribution(pop_result)

    colors = [PALETTE["primary"], PALETTE["accent"], PALETTE["success"],
              PALETTE["warn"], PALETTE["danger"], PALETTE["muted"]]
    fig = go.Figure()
    for j in range(n_states):
        fig.add_trace(go.Scatter(
            x=np.arange(len(pop)), y=pop[:, j],
            name=states[j], stackgroup="pop",
            mode="lines", line=dict(color=colors[j % len(colors)], width=0),
            fillcolor=colors[j % len(colors)],
            hovertemplate="step %{x}<br>" + states[j] + ": %{y:.2f}<extra></extra>",
        ))
    apply_theme(fig)
    fig.update_layout(
        xaxis_title="step", yaxis_title="fraction of walkers",
        yaxis_range=[0, 1], height=440,
    )
    st.plotly_chart(fig, width="stretch")
    # Show the final population vs π
    st.markdown("#### Final population vs stationary π")
    cols = st.columns(n_states)
    for i, c in enumerate(cols):
        c.metric(states[i], f"{100 * pop[-1, i]:.1f}%",
                  delta=f"π = {100 * pi[i]:.1f}%", delta_color="off")

# ---- Tab 3 · Convergence from different starts -----------------------------
with tabs[2]:
    st.subheader("Three different starts, one common end")
    st.caption(
        "Track the fraction of the population in each state over time, starting from three "
        "very different initial distributions. Watch all three lines meet at π."
    )
    focus_state = st.selectbox(
        "Show the % of walkers in",
        options=list(range(n_states)),
        format_func=lambda i: states[i],
        index=0, key="_mkv_focus",
    )

    starts = [
        ("100% start in " + states[0], np.eye(n_states)[0]),
        ("100% start in " + states[-1], np.eye(n_states)[-1]),
        ("Uniform start", np.ones(n_states) / n_states),
    ]
    fig = go.Figure()
    line_colors = [PALETTE["primary"], PALETTE["accent"], PALETTE["success"]]
    for (label, x0), col in zip(starts, line_colors, strict=True):
        dist = distribution_over_time(P, initial_distribution=x0, steps=int(steps))
        fig.add_trace(go.Scatter(
            x=np.arange(len(dist)), y=dist[:, focus_state], mode="lines",
            line=dict(color=col, width=3), name=label,
        ))
    # Add the theoretical π as a horizontal line
    fig.add_hline(
        y=pi[focus_state],
        line=dict(color=PALETTE["danger"], dash="dash"),
        annotation_text=f"π({states[focus_state]}) = {pi[focus_state]:.3f}",
        annotation_position="top right",
    )
    apply_theme(fig)
    fig.update_layout(
        xaxis_title="step", yaxis_title=f"fraction of population in {states[focus_state]}",
        yaxis_range=[0, 1], height=420,
    )
    st.plotly_chart(fig, width="stretch")
    st.info(
        "🎯 **This is the Markov Convergence Theorem in one picture.** All three lines end at "
        "the same π-value. The past is irrelevant to the long-run share — provided the chain is "
        "irreducible and aperiodic, which every preset here is."
    )

# ---- Tab 4 · Intervention vs rule change ----------------------------------
with tabs[3]:
    st.subheader("A one-time intervention vs a change in the rules")
    st.caption(
        "The chapter's most important operational insight: **one-time interventions decay.** "
        "The only way to move the equilibrium is to change the transition probabilities themselves."
    )

    intervention_step = st.slider(
        "Intervention time step", 10, int(steps) - 10, min(60, int(steps) - 10),
        key="_mkv_int_step",
    )
    intervention_state = st.selectbox(
        "One-time intervention: dump everyone into",
        options=list(range(n_states)),
        format_func=lambda i: states[i],
        index=0, key="_mkv_int_state",
    )

    # Build P_after by inflating self-loop of one state
    st.markdown("**Rule change:** Boost the 'stickiness' of one state by transferring "
                "10 % probability mass from each other row into its column.")
    boost_state = st.selectbox(
        "Boost self-loop of",
        options=list(range(n_states)),
        format_func=lambda i: states[i],
        index=0, key="_mkv_boost",
    )
    boost = 0.10
    P_after = P.copy()
    for i in range(n_states):
        if i == boost_state:
            continue
        # Transfer `boost` weight from other columns into boost_state column,
        # subject to non-negativity constraints.
        movable = min(boost, P_after[i].sum() - P_after[i, boost_state])
        if movable <= 0:
            continue
        # Take proportionally from all other columns
        others = [j for j in range(n_states) if j != boost_state]
        take_from = np.array([P_after[i, j] for j in others])
        share = take_from / max(take_from.sum(), 1e-9)
        for k, j in enumerate(others):
            P_after[i, j] -= movable * share[k]
        P_after[i, boost_state] += movable
    # Renormalise defensively
    P_after = P_after / P_after.sum(axis=1, keepdims=True)

    result = intervention_experiment(
        P=P, steps=int(steps),
        intervention_step=int(intervention_step),
        intervention_state=int(intervention_state),
        P_after=P_after,
    )
    pi_after = stationary_distribution(P_after)

    # Show the focus state's share over time in three lines
    st.markdown(f"#### Fraction in **{states[intervention_state]}** over time")
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=result.time_axis, y=result.baseline[:, intervention_state], mode="lines",
        line=dict(color=PALETTE["muted"], width=2, dash="dot"), name="No intervention (baseline)",
    ))
    fig.add_trace(go.Scatter(
        x=result.time_axis, y=result.intervention[:, intervention_state], mode="lines",
        line=dict(color=PALETTE["accent"], width=3),
        name=f"One-off intervention at t={intervention_step}",
    ))
    if result.rule_change is not None:
        fig.add_trace(go.Scatter(
            x=result.time_axis, y=result.rule_change[:, intervention_state], mode="lines",
            line=dict(color=PALETTE["success"], width=3),
            name=f"Rule change at t={intervention_step}",
        ))
    fig.add_hline(
        y=pi[intervention_state],
        line=dict(color=PALETTE["danger"], dash="dash"),
        annotation_text=f"π (original) = {pi[intervention_state]:.3f}",
        annotation_position="top right",
    )
    fig.add_hline(
        y=pi_after[intervention_state],
        line=dict(color=PALETTE["success"], dash="dash"),
        annotation_text=f"π (after rule change) = {pi_after[intervention_state]:.3f}",
        annotation_position="bottom right",
    )
    fig.add_vline(
        x=intervention_step, line=dict(color=PALETTE["muted"], dash="dot"),
        annotation_text=f"intervention at t={intervention_step}",
        annotation_position="top left",
    )
    apply_theme(fig)
    fig.update_layout(
        xaxis_title="step", yaxis_title=f"fraction in {states[intervention_state]}",
        yaxis_range=[0, 1], height=440,
    )
    st.plotly_chart(fig, width="stretch")

    st.warning(
        "🔧 **The pedagogical punchline.** The orange line (one-off intervention) spikes up then "
        "decays back to the original π. The green line (rule change) settles into a *different* "
        "π. If you want a lasting change to a system, changing what the current state is doesn't "
        "cut it — you have to change the rules governing transitions."
    )

# ---- Full documentation ----------------------------------------------------
render_full_doc(META)
