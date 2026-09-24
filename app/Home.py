"""Landing page for the ModelThinker Streamlit app.

Run with:

    uv run streamlit run app/Home.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

# Make `src/` and the repo root importable when Streamlit runs this file directly.
_REPO = Path(__file__).resolve().parents[1]
for p in (_REPO, _REPO / "src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.registry import MODELS, PARTS  # noqa: E402

st.set_page_config(page_title="ModelThinker", page_icon="🧠", layout="wide")

# ------ Hero -----------------------------------------------------------------
st.title("🧠 ModelThinker")
st.markdown(
    "**Interactive implementations of the models in Scott E. Page's "
    "*[The Model Thinker](https://www.basicbooks.com/titles/scott-e-page/the-model-thinker/9780465094639/)* (2018).** "
    "Pick a model from the left sidebar, or from the index below."
)
st.info(
    "> *No single model is enough to understand a complex world. Applying several different "
    "models to the same problem — whose blind spots partly cancel — leads to better understanding.* "
    "— paraphrasing Page's central thesis."
)
c_left, c_right = st.columns([1, 3])
with c_left:
    st.page_link("pages/00_Book_Guide.py", label="📘 Open the Book Guide", icon=None)
with c_right:
    st.caption(
        "The Book Guide is a chapter-by-chapter companion to the book covering all 29 chapters, "
        "including models not yet interactive here."
    )

# ------ REDCAPE --------------------------------------------------------------
st.header("Why model? The REDCAPE framework")
st.markdown(
    "Page lists seven uses of models, spelling **REDCAPE**. Every model page in this app "
    "is tagged with the subset of REDCAPE uses it supports well."
)

_REDCAPE_CARDS = [
    ("Reason",      "Find the conditions and logic behind a result."),
    ("Explain",     "Give reasons for things we have observed."),
    ("Design",      "Choose features of institutions, policies, and rules."),
    ("Communicate", "Share understanding in precise terms."),
    ("Act",         "Guide policy and strategic choices."),
    ("Predict",     "Forecast numbers or events."),
    ("Explore",     "Examine possibilities and hypotheticals."),
]
cols = st.columns(4)
for i, (name, desc) in enumerate(_REDCAPE_CARDS):
    with cols[i % 4]:
        st.markdown(f"**{name}**")
        st.caption(desc)

st.divider()

# ------ Model index ----------------------------------------------------------
st.header("Model index")
st.markdown(
    "Grouped by book part. **Available** models have a live interactive page; "
    "**planned** models are placeholders — the package structure is ready, just add "
    "a module, doc, test, page, and notebook to light them up."
)

for part_name, part_range, part_key in PARTS:
    with st.container():
        st.subheader(f"{part_name}  ·  *{part_range}*")
        rows = [m for m in MODELS if m.part == part_key]
        for m in rows:
            c1, c2, c3, c4 = st.columns([1, 5, 2, 3])
            c1.markdown(f"**Ch {m.chapter}**")
            c2.markdown(m.name)
            if m.status == "available":
                c3.markdown(
                    '<span style="color:#37B24D;font-weight:600;">● available</span>',
                    unsafe_allow_html=True,
                )
                if m.page:
                    c4.page_link(f"pages/{m.page}.py", label="Open →")
            else:
                c3.markdown(
                    '<span style="color:#868E96;font-weight:600;">○ planned</span>',
                    unsafe_allow_html=True,
                )
                c4.caption("—")

st.divider()
st.caption(
    "Page, S. E. (2018). *The Model Thinker: What You Need to Know to Make Data Work for You.* "
    "Basic Books."
)
