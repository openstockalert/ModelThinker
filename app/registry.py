"""Registry of all models in the book — used by the Home page's model index.

Each entry describes one chapter's model, its status (``available`` if implemented
in v1, ``planned`` if not yet), and the Streamlit page it lives on. Adding a new
model means dropping in the module + page + doc + notebook and flipping ``status``
to ``available`` here.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IndexEntry:
    chapter: int
    name: str
    part: str
    status: str  # "available" or "planned"
    page: str | None = None  # e.g. "05_Normal_Distribution" (page filename without .py)


PARTS = [
    ("Distributions",        "Ch 5–6",   "distributions"),
    ("Functional forms",     "Ch 7–9",   "functional"),
    ("Networks and spread",  "Ch 10–11", "networks"),
    ("Uncertainty & dynamics","Ch 12–19","dynamics"),
    ("Choice and strategy",  "Ch 20–25", "strategy"),
    ("Learning and search",  "Ch 26–28", "learning"),
]

MODELS: list[IndexEntry] = [
    # Distributions
    IndexEntry(5,  "Normal distributions",      "distributions", "available", "05_Normal_Distribution"),
    IndexEntry(6,  "Power laws / long tails",   "distributions", "available", "06_Power_Laws"),
    # Functional forms
    IndexEntry(7,  "Linear models",             "functional",    "planned"),
    IndexEntry(8,  "Concavity and convexity",   "functional",    "planned"),
    IndexEntry(9,  "Value and power (Shapley)", "functional",    "planned"),
    # Networks and spread
    IndexEntry(10, "Network models",            "networks",      "planned"),
    IndexEntry(11, "SIR epidemic (contagion)",  "networks",      "available", "11_SIR_Epidemic"),
    # Uncertainty & dynamics
    IndexEntry(12, "Entropy",                   "dynamics",      "planned"),
    IndexEntry(13, "Random walks",              "dynamics",      "available", "13_Random_Walks"),
    IndexEntry(14, "Path dependence (Pólya)",   "dynamics",      "planned"),
    IndexEntry(15, "Schelling segregation",     "dynamics",      "available", "15_Schelling_Segregation"),
    IndexEntry(16, "Lyapunov & equilibria",     "dynamics",      "planned"),
    IndexEntry(17, "Markov models",             "dynamics",      "planned"),
    IndexEntry(18, "Systems dynamics",          "dynamics",      "planned"),
    IndexEntry(19, "Threshold models (feedback)","dynamics",     "planned"),
    # Choice and strategy
    IndexEntry(20, "Spatial & hedonic choice",  "strategy",      "planned"),
    IndexEntry(21, "Game theory",               "strategy",      "planned"),
    IndexEntry(22, "Cooperation (repeated PD)", "strategy",      "planned"),
    IndexEntry(23, "Collective action",         "strategy",      "planned"),
    IndexEntry(24, "Mechanism design",          "strategy",      "planned"),
    IndexEntry(25, "Signaling",                 "strategy",      "planned"),
    # Learning and search
    IndexEntry(26, "Models of learning",        "learning",      "planned"),
    IndexEntry(27, "Multi-armed bandits",       "learning",      "planned"),
    IndexEntry(28, "NK rugged landscapes",      "learning",      "available", "28_NK_Landscape"),
]
