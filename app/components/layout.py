"""Reusable Streamlit layout pieces so every model page has the same anatomy.

Every model page should call, in order:

    from app.components.layout import render_header, render_doc_link, render_full_doc

    render_header(META)
    render_doc_link(META)
    # ... sidebar widgets and main plot ...
    render_full_doc(META)
"""

from __future__ import annotations

from pathlib import Path

import streamlit as st

from modelthinker.core.base import ModelMeta
from modelthinker.core.plotting import PALETTE

_REDCAPE_COLORS = {
    "Reason":      "#4C6EF5",
    "Explain":     "#37B24D",
    "Design":      "#F76707",
    "Communicate": "#7048E8",
    "Act":         "#E03131",
    "Predict":     "#1098AD",
    "Explore":     "#F59F00",
}

_DOCS_ROOT = Path(__file__).resolve().parents[2] / "docs" / "models"


def redcape_chips(items: tuple[str, ...] | list[str]) -> str:
    """Return HTML for a row of coloured REDCAPE badges."""
    chips = []
    for label in items:
        color = _REDCAPE_COLORS.get(label, PALETTE["muted"])
        chips.append(
            f'<span style="display:inline-block;padding:2px 10px;margin:2px 4px 2px 0;'
            f'border-radius:12px;background:{color}22;color:{color};font-size:12px;'
            f'font-weight:600;letter-spacing:0.02em;">{label}</span>'
        )
    return "".join(chips)


def render_header(meta: ModelMeta) -> None:
    """Render the page title, chapter number, tagline, and REDCAPE badges."""
    st.set_page_config(
        page_title=f"Ch {meta.chapter} — {meta.name}",
        page_icon="📊",
        layout="wide",
    )
    st.markdown(
        f"### Chapter {meta.chapter} · *The Model Thinker*"
    )
    st.title(meta.name)
    st.markdown(f"*{meta.summary}*")
    st.markdown(redcape_chips(meta.redcape), unsafe_allow_html=True)
    st.divider()


def render_doc_link(meta: ModelMeta) -> None:
    """Show two prominent links at the top of a model page:

    1. an anchor to the full per-model documentation rendered inline below, and
    2. a link to the in-app **Book Guide** page (``app/pages/00_Book_Guide.py``)
       deep-linked to this model's chapter via ``?ch=NN#ch-NN``.
    """
    st.markdown(
        f"""
<div style="margin:-8px 0 12px 0;display:flex;gap:10px;flex-wrap:wrap;">
  <a href="#full-documentation"
     style="display:inline-block;padding:8px 14px;border-radius:8px;
            background:#F1F3F5;color:#212529;text-decoration:none;font-weight:600;">
     📖 Full model documentation ↓
  </a>
  <a href="/Book_Guide?ch={meta.chapter}#ch-{meta.chapter}" target="_self"
     style="display:inline-block;padding:8px 14px;border-radius:8px;
            background:#E7F5FF;color:#1971C2;text-decoration:none;font-weight:600;
            border:1px solid #A5D8FF;">
     📘 Book guide · Ch {meta.chapter} ↗
  </a>
</div>
""".strip(),
        unsafe_allow_html=True,
    )


def _load_doc(meta: ModelMeta) -> str:
    path = _DOCS_ROOT / meta.doc_filename
    if not path.exists():
        return f"*(Documentation not yet written: `{path.relative_to(_DOCS_ROOT.parents[1])}`.)*"
    return path.read_text(encoding="utf-8")


def render_full_doc(meta: ModelMeta) -> None:
    """Render the model's Markdown doc inline at the bottom of the page.

    Streamlit's ``st.markdown`` renders ``$...$`` and ``$$...$$`` as LaTeX natively,
    so the entire Markdown file can be passed through unchanged.
    """
    st.divider()
    st.markdown('<a id="full-documentation"></a>', unsafe_allow_html=True)
    st.header("📖 Full documentation")
    with st.expander("Show / hide", expanded=True):
        st.markdown(_load_doc(meta))
