"""Streamlit page — the chapter-by-chapter book companion (`docs/model_guide.md`).

This page renders the full guide inside the app so every model page can link to
a specific chapter section via ``?ch=NN``. That gives users a single, always-in-app
place to read the theory alongside the interactive simulator.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import streamlit as st

_REPO = Path(__file__).resolve().parents[2]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

_GUIDE_PATH = _REPO / "docs" / "model_guide.md"

st.set_page_config(page_title="Book guide — Model Thinker", page_icon="📘", layout="wide")

st.title("📘 The Model Thinker — book guide")
st.caption(
    "Chapter-by-chapter companion notes to Scott E. Page's *The Model Thinker* (2018). "
    "Every model page in this app links here for context."
)

if not _GUIDE_PATH.exists():
    st.error(f"Guide not found at {_GUIDE_PATH.relative_to(_REPO)}")
    st.stop()

guide_text = _GUIDE_PATH.read_text(encoding="utf-8")

# ---- Table of contents ------------------------------------------------------
# Extract all "### Ch. N. Title" headings so the sidebar can jump to any chapter.
_CH_HEADING = re.compile(r"^###\s+Ch\.\s+(\d+(?:[–-]\d+)?)\.\s+(.+?)\s*$", re.MULTILINE)
chapter_headings: list[tuple[str, str]] = _CH_HEADING.findall(guide_text)

with st.sidebar:
    st.subheader("Jump to chapter")
    for ch_num, title in chapter_headings:
        # Streamlit's markdown heading anchor slug — lowercase, non-alnum → '-'
        slug = "ch-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        # Use only the "ch-N" prefix so partial-match anchors from other pages work too.
        st.markdown(f"- [Ch. {ch_num}. {title}](#ch-{ch_num.split('-')[0].split('–')[0]}-{slug.split('-', 1)[1] if '-' in slug else ''})")

# ---- Deep-link banner if arriving from a model page -------------------------
# We can't use query params reliably across Streamlit versions, so just note
# the pattern the model pages use.
target = st.query_params.get("ch") if hasattr(st, "query_params") else None
if target:
    st.info(f"Jumping to **Chapter {target}** — scroll down or use the sidebar.")

# ---- Full guide -------------------------------------------------------------
# Streamlit auto-slugs heading text. We prefix each chapter heading with an
# explicit anchor of the form ``ch-N`` so external links like ``?ch=5#ch-5``
# always land in the right place.
def _inject_chapter_anchors(md: str) -> str:
    def _sub(match: re.Match[str]) -> str:
        ch = match.group(1).split("–")[0].split("-")[0]  # take first number of range
        title = match.group(2)
        return f'<a id="ch-{ch}"></a>\n\n### Ch. {match.group(1)}. {title}'
    return _CH_HEADING.sub(_sub, md)

st.markdown(_inject_chapter_anchors(guide_text), unsafe_allow_html=True)
