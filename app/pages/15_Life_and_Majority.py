"""Streamlit page — Ch 15: Local interaction models (Game of Life + Local Majority).

Two tabs covering two very different local-rule cellular automata:
  1. Conway's Game of Life — pattern presets, evolution animation
  2. Local Majority Model — freezing into stable clusters
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
from modelthinker.dynamics.life_and_majority import (  # noqa: E402
    META,
    PATTERNS,
    count_clusters,
    place_pattern,
    random_life_grid,
    simulate_life,
    simulate_majority,
)

render_header(META)
render_doc_link(META)

st.caption(
    "Chapter 15 in *The Model Thinker* covers multiple local-rule cellular automata. This page "
    "hosts **Game of Life** (§15.2) and **Local Majority** (§15.1). For the segregation model "
    "(§15.3) see the [Schelling page](/Schelling_Segregation)."
)

tabs = st.tabs(["🎮 Game of Life (Conway)", "🗳️ Local Majority Model"])

# ---- Tab 1 · Game of Life -------------------------------------------------

with tabs[0]:
    st.subheader("Conway's Game of Life — emergence from three rules")
    st.markdown(
        "A cell survives with **2 or 3** live neighbours. A dead cell is born with **exactly 3**. "
        "That's the whole rulebook. Yet these three lines produce oscillators, spaceships, "
        "chaotic methuselahs, and even patterns that emit new patterns forever. This is *the* "
        "canonical demonstration of emergence."
    )

    c1, c2 = st.columns([3, 2])
    with c1:
        pattern_options = list(PATTERNS.keys()) + ["random"]
        default_ix = pattern_options.index("glider")
        pattern_key = st.selectbox(
            "Starting pattern",
            options=pattern_options,
            index=default_ix,
            format_func=lambda k: "🎲 Random start" if k == "random" else f"{PATTERNS[k]['name']} — {PATTERNS[k]['kind']}",
            key="_lm_life_pattern",
        )
    with c2:
        grid_size = st.slider("Grid size", 10, 80, 40, step=5, key="_lm_life_size")

    c3, c4, c5 = st.columns(3)
    steps = c3.slider("Steps", 10, 500, 80, step=10, key="_lm_life_steps")
    wrap = c4.checkbox("Toroidal (wrap edges)", value=True, key="_lm_life_wrap")
    stop_when_stable = c5.checkbox("Stop when stable", value=True, key="_lm_life_stop")

    if pattern_key == "random":
        density = st.slider("Random-start density", 0.05, 0.6, 0.3, step=0.05, key="_lm_life_density")
        seed = st.number_input("Seed", 0, 1_000_000, 42, step=1, key="_lm_life_seed")
        initial_grid = random_life_grid(grid_size=int(grid_size), density=float(density), seed=int(seed))
    else:
        pat = PATTERNS[pattern_key]["grid"]
        min_needed = max(pat.shape) + 4
        if grid_size < min_needed:
            grid_size = min_needed
            st.warning(f"Grid size auto-bumped to {grid_size} to fit this pattern.")
        initial_grid = place_pattern(pattern_key, grid_size=int(grid_size))

    life_result = simulate_life(
        initial_grid=initial_grid, steps=int(steps),
        wrap=bool(wrap), stop_when_stable=bool(stop_when_stable),
    )

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Recorded steps", f"{life_result.steps_taken}")
    m2.metric("Initial live cells", f"{life_result.populations[0]}")
    m3.metric("Final live cells", f"{life_result.populations[-1]}")
    m4.metric("Ended stable?", "yes ✓" if life_result.stable else "no")

    # Snapshot slider
    snap_ix = st.slider(
        "Snapshot", 0, len(life_result.grid_history) - 1, len(life_result.grid_history) - 1,
        key="_lm_life_snap",
    )
    snap = life_result.grid_history[snap_ix]

    fig = go.Figure(data=go.Heatmap(
        z=snap,
        # Dead cells nearly white, live cells near-black. Standard Life aesthetic.
        colorscale=[[0.0, "#FBFCFF"], [1.0, "#212529"]],
        showscale=False,
        xgap=1, ygap=1,
    ))
    apply_theme(fig)
    fig.update_layout(
        height=500,
        xaxis=dict(showticklabels=False, zeroline=False),
        yaxis=dict(showticklabels=False, zeroline=False, scaleanchor="x", autorange="reversed"),
        margin=dict(l=10, r=10, t=10, b=10),
    )
    st.plotly_chart(fig, width="stretch")

    # Population over time
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=np.arange(len(life_result.populations)), y=life_result.populations,
        mode="lines", line=dict(color=PALETTE["primary"], width=3), name="live cells",
    ))
    apply_theme(fig2)
    fig2.update_layout(
        xaxis_title="step", yaxis_title="live cell count", height=260,
    )
    st.plotly_chart(fig2, width="stretch")

    # Try-this callouts
    if pattern_key == "block":
        st.info("🟩 **Block** — the simplest still life. Two cells wide, two tall, does nothing forever. "
                "A boring but foundational demo: some patterns are their own eigenvectors under Conway's rule.")
    elif pattern_key == "blinker":
        st.info("🚦 **Blinker** — a 3-cell row flips between horizontal and vertical. The simplest oscillator.")
    elif pattern_key == "glider":
        st.info("✈ **Glider** — moves diagonally by one cell every 4 generations. Life's postal service.")
    elif pattern_key == "r_pentomino":
        st.info("💥 **R-pentomino** — five cells that produce over 1000 steps of chaotic evolution before "
                "settling into a mix of still lifes, blinkers, and 6 escaping gliders.")
    elif pattern_key == "acorn":
        st.info("🌰 **Acorn** — seven cells that take **5206 generations** to settle. Set steps = 500 (too "
                "few); it hasn't stabilised yet.")
    elif pattern_key == "glider_gun":
        st.info("🔫 **Gosper glider gun** — the first pattern proven to grow forever, discovered in 1970. "
                "It emits a new glider every 30 generations, indefinitely.")
    elif pattern_key == "pulsar":
        st.info("💓 **Pulsar** — a period-3 oscillator with 48 cells. Feels almost alive.")

# ---- Tab 2 · Local Majority ------------------------------------------------

with tabs[1]:
    st.subheader("Local Majority Model — how consensus forms in clusters")
    st.markdown(
        "Every cell adopts the state most of its 8 Moore neighbours are in. Whichever side is "
        "**locally in the majority** takes over — but only locally, so the grid doesn't tip fully "
        "either way. Instead, it freezes into stable **clusters** of like-minded regions. Page "
        "uses this to model dialects, local customs, and political leanings."
    )

    c1, c2, c3 = st.columns(3)
    maj_grid_size = c1.slider("Grid size", 10, 80, 40, step=5, key="_lm_maj_size")
    maj_density = c2.slider("Initial density of 1s", 0.1, 0.9, 0.5, step=0.05, key="_lm_maj_density")
    maj_seed = c3.number_input("Seed", 0, 1_000_000, 42, step=1, key="_lm_maj_seed")

    c4, c5, c6 = st.columns(3)
    maj_steps = c4.slider("Max steps", 20, 500, 200, step=20, key="_lm_maj_steps")
    maj_wrap = c5.checkbox("Toroidal", value=True, key="_lm_maj_wrap")
    maj_tie = c6.checkbox("Randomise on ties", value=False,
                          help="If half of your neighbours are 1s (a 4-4 tie), flip a coin.",
                          key="_lm_maj_tie")

    with st.spinner("Simulating local majority dynamics..."):
        maj_result = simulate_majority(
            grid_size=int(maj_grid_size), initial_density=float(maj_density),
            steps=int(maj_steps), wrap=bool(maj_wrap), tie_flip=bool(maj_tie),
            seed=int(maj_seed),
        )

    initial = maj_result.grid_history[0]
    final = maj_result.grid_history[-1]
    n_clusters_1 = count_clusters(final, value=1)
    n_clusters_0 = count_clusters(final, value=0)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Steps taken", f"{maj_result.steps_taken}")
    m2.metric("Stabilised?", "yes ✓" if maj_result.stable else "no")
    m3.metric("Final 1-clusters", f"{n_clusters_1}")
    m4.metric("Final 1-share", f"{100 * final.sum() / final.size:.1f}%",
              delta=f"start {100 * initial.sum() / initial.size:.1f}%")

    # Show initial and final side by side
    left, right = st.columns(2)
    for col, g, title in [(left, initial, "Step 0 (random start)"),
                          (right, final, f"Step {maj_result.steps_taken} (final)")]:
        with col:
            st.markdown(f"**{title}**")
            fig = go.Figure(data=go.Heatmap(
                z=g,
                colorscale=[[0.0, "#DBE4FF"], [1.0, "#4C6EF5"]],
                showscale=False,
                xgap=0.5, ygap=0.5,
            ))
            apply_theme(fig)
            fig.update_layout(
                height=340,
                xaxis=dict(showticklabels=False, zeroline=False),
                yaxis=dict(showticklabels=False, zeroline=False, scaleanchor="x", autorange="reversed"),
                margin=dict(l=6, r=6, t=6, b=6),
            )
            st.plotly_chart(fig, width="stretch")

    # Snapshot slider for intermediate steps
    snap_ix = st.slider(
        "Watch it stabilise · pick a step", 0, len(maj_result.grid_history) - 1,
        len(maj_result.grid_history) - 1, key="_lm_maj_snap",
    )
    snap = maj_result.grid_history[snap_ix]
    fig = go.Figure(data=go.Heatmap(
        z=snap, colorscale=[[0.0, "#DBE4FF"], [1.0, "#4C6EF5"]],
        showscale=False, xgap=0.5, ygap=0.5,
    ))
    apply_theme(fig)
    fig.update_layout(
        height=450,
        xaxis=dict(showticklabels=False, zeroline=False),
        yaxis=dict(showticklabels=False, zeroline=False, scaleanchor="x", autorange="reversed"),
        margin=dict(l=6, r=6, t=6, b=6),
    )
    st.plotly_chart(fig, width="stretch")

    # Changes over time
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=np.arange(len(maj_result.changes)), y=maj_result.changes,
        mode="lines", line=dict(color=PALETTE["accent"], width=3),
        name="cells flipped this step",
    ))
    apply_theme(fig2)
    fig2.update_layout(
        xaxis_title="step", yaxis_title="cells flipped", height=260,
    )
    st.plotly_chart(fig2, width="stretch")

    st.info(
        "🎯 **Notice.** After a burst of changes early on, the grid rapidly settles into large "
        "monochrome regions. That's clustering by pure local majority — no globally-imposed rule "
        "created those clusters, but they always emerge. Rerun with a fresh seed a few times: "
        "the *shapes* differ but the *presence* of clustering is universal."
    )

# ---- Full documentation ----------------------------------------------------
render_full_doc(META)
