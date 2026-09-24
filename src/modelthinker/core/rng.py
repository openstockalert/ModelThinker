"""Seed-controlled RNG so every stochastic simulation is reproducible."""

from __future__ import annotations

import numpy as np


def get_rng(seed: int | None = None) -> np.random.Generator:
    """Return a NumPy ``Generator`` seeded with ``seed`` (or entropy if ``None``).

    Using this helper — rather than the legacy ``np.random.*`` global state —
    means passing the same ``seed`` to any model reproduces its output exactly.
    """
    return np.random.default_rng(seed)
