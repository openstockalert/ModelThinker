"""Shared Plotly theme so every page looks like part of one product."""

from __future__ import annotations

import plotly.graph_objects as go

PALETTE = {
    "primary": "#4C6EF5",
    "accent":  "#F76707",
    "muted":   "#868E96",
    "success": "#37B24D",
    "warn":    "#F59F00",
    "danger":  "#E03131",
    "grid":    "#E9ECEF",
    "bg":      "#FFFFFF",
}

_SEQ = [PALETTE["primary"], PALETTE["accent"], PALETTE["success"],
        PALETTE["warn"], PALETTE["danger"], PALETTE["muted"]]


def apply_theme(fig: go.Figure, *, title: str | None = None) -> go.Figure:
    """Apply the ModelThinker Plotly theme in-place and return the figure."""
    fig.update_layout(
        title=title,
        template="simple_white",
        colorway=_SEQ,
        margin=dict(l=40, r=20, t=50 if title else 20, b=40),
        font=dict(family="Inter, -apple-system, Segoe UI, sans-serif", size=14, color="#212529"),
        legend=dict(
            bgcolor="rgba(255,255,255,0)",
            bordercolor=PALETTE["grid"],
            borderwidth=1,
            font=dict(size=15, color="#212529"),
        ),
    )
    fig.update_xaxes(gridcolor=PALETTE["grid"], zerolinecolor=PALETTE["grid"])
    fig.update_yaxes(gridcolor=PALETTE["grid"], zerolinecolor=PALETTE["grid"])
    return fig
