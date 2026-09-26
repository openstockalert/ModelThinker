"""Chapter 17 — Markov chains on finite state spaces.

A system moves between a finite set of states with fixed transition
probabilities. If the chain is irreducible (every state reachable from
every other) and aperiodic, the state distribution converges to a
**unique stationary distribution** regardless of where it started.

Full write-up: ``docs/models/ch17_markov.md``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=17,
    name="Markov chains",
    slug="markov",
    part="dynamics",
    redcape=("Explain", "Predict", "Explore"),
    summary=(
        "History doesn't matter in the long run: any starting distribution "
        "converges to the same stationary equilibrium — provided you don't "
        "change the transition rules."
    ),
    tags=("Markov", "stationary distribution", "convergence"),
)


# ---------------------------------------------------------------------------
# Named presets — small, story-driven chains
# ---------------------------------------------------------------------------

PRESETS: dict[str, dict] = {
    "students": {
        "name": "Alert vs. bored students",
        "states": ["🙂 Alert", "😴 Bored"],
        # P[i, j] = P(next=j | now=i)
        "P": np.array([
            [0.90, 0.10],
            [0.70, 0.30],
        ]),
        "description": (
            "Page's classic classroom toy. An alert student stays alert with high probability. "
            "A bored student usually snaps back to alert within a step or two. Long-run share "
            "of alert students is what the chain settles at."
        ),
    },
    "weather": {
        "name": "Weather: sunny · cloudy · rainy",
        "states": ["☀ Sunny", "☁ Cloudy", "🌧 Rainy"],
        "P": np.array([
            [0.70, 0.20, 0.10],
            [0.30, 0.40, 0.30],
            [0.20, 0.30, 0.50],
        ]),
        "description": (
            "A three-state weather chain. Sunny is sticky, rainy is stickier still, but everything "
            "eventually mixes to a stationary distribution over the three moods."
        ),
    },
    "democracy": {
        "name": "Freedom House democratization",
        "states": ["🏛 Free", "⚖ Partly Free", "🔒 Not Free"],
        "P": np.array([
            [0.94, 0.05, 0.01],
            [0.10, 0.80, 0.10],
            [0.03, 0.10, 0.87],
        ]),
        "description": (
            "Countries transition among Freedom House's three categories year over year. "
            "Page uses this to show that decade-long shares converge — the stationary "
            "distribution predicts how many countries end up in each category."
        ),
    },
    "brands": {
        "name": "Brand loyalty: A · B · C",
        "states": ["🅰 Brand A", "🅱 Brand B", "🅲 Brand C"],
        "P": np.array([
            [0.80, 0.10, 0.10],
            [0.15, 0.75, 0.10],
            [0.20, 0.15, 0.65],
        ]),
        "description": (
            "Each period a customer either stays with their brand (loyalty) or switches. "
            "The stationary distribution is the long-run market share."
        ),
    },
    "drug": {
        "name": "Drug addiction cycle",
        "states": ["✅ Sober", "🌀 Using", "⚠ Addicted", "🌱 Recovering"],
        "P": np.array([
            [0.85, 0.13, 0.00, 0.02],
            [0.30, 0.50, 0.20, 0.00],
            [0.02, 0.20, 0.75, 0.03],
            [0.60, 0.05, 0.05, 0.30],
        ]),
        "description": (
            "Four states in a substance-use cycle. Page's headline point about interventions "
            "lands here: a one-off program that moves everyone to Recovering only shifts the "
            "current state — the transition probabilities pull them back to the same stationary "
            "mix. Real change requires changing the rates themselves."
        ),
    },
    "pagerank": {
        "name": "PageRank on a tiny web",
        "states": ["A", "B", "C", "D", "E"],
        # Small directed graph → row-normalised transition matrix
        "P": np.array([
            [0.05, 0.85, 0.05, 0.00, 0.05],   # A links to B mostly
            [0.05, 0.05, 0.60, 0.25, 0.05],   # B links to C and D
            [0.20, 0.05, 0.05, 0.65, 0.05],   # C links to D
            [0.55, 0.05, 0.05, 0.05, 0.30],   # D links back to A + E
            [0.10, 0.10, 0.60, 0.05, 0.15],   # E links to C
        ]),
        "description": (
            "A random surfer clicking links. The stationary distribution is Google's original "
            "PageRank — the long-run share of time the surfer spends on each page."
        ),
    },
}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_transition_matrix(P: np.ndarray, tol: float = 1e-6) -> None:
    """Raise ``ValueError`` if ``P`` is not a valid stochastic matrix."""
    P = np.asarray(P, dtype=float)
    if P.ndim != 2 or P.shape[0] != P.shape[1]:
        raise ValueError(f"P must be a square 2-D matrix; got shape {P.shape}")
    if (-tol > P).any():
        raise ValueError("all entries of P must be non-negative")
    row_sums = P.sum(axis=1)
    if not np.allclose(row_sums, 1.0, atol=tol):
        raise ValueError(f"each row of P must sum to 1; row sums = {row_sums}")


# ---------------------------------------------------------------------------
# Deterministic distribution dynamics
# ---------------------------------------------------------------------------

def distribution_over_time(
    P: np.ndarray,
    *,
    initial_distribution: np.ndarray | None = None,
    initial_state: int | None = None,
    steps: int = 100,
) -> np.ndarray:
    """Marginal state distribution ``x_t = x_0 · P^t`` for ``t = 0..steps``.

    Provide EITHER ``initial_distribution`` (a probability vector summing to 1)
    OR ``initial_state`` (a state index — treated as a point mass).

    Returns
    -------
    Array of shape ``(steps + 1, n_states)`` — row *t* is the distribution at time *t*.
    """
    validate_transition_matrix(P)
    n = P.shape[0]
    if initial_distribution is None and initial_state is None:
        raise ValueError("provide either initial_distribution or initial_state")
    if initial_distribution is not None:
        x = np.asarray(initial_distribution, dtype=float).ravel()
        if x.size != n:
            raise ValueError(f"initial_distribution must have length {n}")
        if not np.isclose(x.sum(), 1.0, atol=1e-6):
            raise ValueError("initial_distribution must sum to 1")
    else:
        if not 0 <= initial_state < n:
            raise ValueError(f"initial_state must be in [0, {n})")
        x = np.zeros(n)
        x[initial_state] = 1.0

    dist = np.zeros((steps + 1, n))
    dist[0] = x
    for t in range(steps):
        dist[t + 1] = dist[t] @ P
    return dist


def stationary_distribution(P: np.ndarray) -> np.ndarray:
    """Left eigenvector of ``P`` for eigenvalue 1, normalised to sum to 1.

    For an irreducible, aperiodic chain this is the unique stationary
    distribution: ``π · P = π``.
    """
    validate_transition_matrix(P)
    eigenvalues, eigenvectors = np.linalg.eig(P.T)
    # Pick the eigenvector whose eigenvalue is closest to 1.
    idx = int(np.argmin(np.abs(eigenvalues - 1.0)))
    pi = np.real(eigenvectors[:, idx])
    # Handle sign ambiguity — the eigenvector can come back all-negative.
    if pi.sum() < 0:
        pi = -pi
    # Clip tiny negatives from numerical noise.
    pi = np.maximum(pi, 0.0)
    total = pi.sum()
    if total == 0:
        raise ValueError("stationary distribution is degenerate")
    return pi / total


# ---------------------------------------------------------------------------
# Monte Carlo simulation
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MarkovChainResult:
    """Monte Carlo simulation of a Markov chain.

    Attributes
    ----------
    trajectories:
        Shape ``(n_walks, steps + 1)`` of dtype int. ``trajectories[w, t]`` is
        the state of walker *w* at time *t*.
    P:
        The transition matrix used.
    n_states, steps, n_walks:
        Sim shape.
    """

    trajectories: np.ndarray
    P: np.ndarray
    n_states: int
    steps: int
    n_walks: int


def simulate(
    *,
    P: np.ndarray,
    initial_state: int | np.ndarray = 0,
    steps: int = 200,
    n_walks: int = 1,
    seed: int | None = 42,
) -> MarkovChainResult:
    """Simulate ``n_walks`` independent Markov trajectories.

    Parameters
    ----------
    P:
        Transition matrix of shape ``(n, n)`` with rows summing to 1.
    initial_state:
        Either an int (all walks start there) or an array-like of length
        ``n_walks`` (per-walk starting state).
    steps:
        Number of transitions per walk. Each trajectory therefore has
        ``steps + 1`` recorded states.
    n_walks:
        Number of independent trajectories to simulate.
    seed:
        RNG seed for reproducibility.
    """
    validate_transition_matrix(P)
    n = P.shape[0]
    if steps < 1:
        raise ValueError("steps must be ≥ 1")
    if n_walks < 1:
        raise ValueError("n_walks must be ≥ 1")

    rng = get_rng(seed)
    trajectories = np.zeros((n_walks, steps + 1), dtype=np.int32)
    if isinstance(initial_state, (int, np.integer)):
        if not 0 <= int(initial_state) < n:
            raise ValueError(f"initial_state must be in [0, {n})")
        trajectories[:, 0] = int(initial_state)
    else:
        init = np.asarray(initial_state, dtype=np.int32).ravel()
        if init.size != n_walks:
            raise ValueError("initial_state array must have length n_walks")
        if not ((init >= 0) & (init < n)).all():
            raise ValueError(f"all initial_state entries must be in [0, {n})")
        trajectories[:, 0] = init

    # Pre-compute cumulative row probabilities for np.searchsorted.
    cum = np.cumsum(P, axis=1)
    # Force the last column to exactly 1 to avoid tiny floating-point overshoot.
    cum[:, -1] = 1.0

    for t in range(steps):
        cur = trajectories[:, t]
        u = rng.random(n_walks)
        # For each walker w: next state = np.searchsorted(cum[cur[w]], u[w])
        # Vectorise by indexing rows of cum with cur, then compare u per walk.
        row_cum = cum[cur]                  # (n_walks, n_states)
        # For each row, find the first column where row_cum > u.
        trajectories[:, t + 1] = (u[:, None] > row_cum).sum(axis=1)

    return MarkovChainResult(
        trajectories=trajectories, P=np.asarray(P, dtype=float),
        n_states=n, steps=steps, n_walks=n_walks,
    )


def population_distribution(result: MarkovChainResult) -> np.ndarray:
    """Empirical fraction of walkers in each state at each time step.

    Returns
    -------
    Array of shape ``(steps + 1, n_states)`` — the empirical distribution
    across walkers at each time.
    """
    out = np.zeros((result.steps + 1, result.n_states), dtype=float)
    for t in range(result.steps + 1):
        counts = np.bincount(result.trajectories[:, t], minlength=result.n_states)
        out[t] = counts / result.n_walks
    return out


# ---------------------------------------------------------------------------
# Intervention experiment — the pedagogical highlight
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class InterventionResult:
    """Outcome of a mid-simulation intervention.

    Attributes
    ----------
    time_axis:
        Length ``steps + 1``.
    baseline:
        The distribution over time with no intervention — a reference trajectory.
    intervention:
        Distribution after moving everyone to ``intervention_state`` at
        ``intervention_step``.
    rule_change:
        Distribution after replacing ``P`` with ``P_after`` at
        ``intervention_step`` (only computed if ``P_after`` is provided).
    """

    time_axis: np.ndarray
    baseline: np.ndarray
    intervention: np.ndarray
    rule_change: np.ndarray | None = field(default=None)


def intervention_experiment(
    *,
    P: np.ndarray,
    steps: int = 200,
    intervention_step: int = 60,
    intervention_state: int = 0,
    P_after: np.ndarray | None = None,
) -> InterventionResult:
    """Compare a one-off state intervention with a rule-change intervention.

    Both scenarios run the chain from its stationary distribution up to
    ``intervention_step``. Then:

    - The **intervention** scenario dumps everyone into ``intervention_state`` and
      continues under the *same* ``P``. The distribution should decay back to the
      original stationary — history doesn't matter.
    - The **rule change** scenario, if ``P_after`` is provided, switches the
      transition matrix at ``intervention_step``. The distribution should
      settle into the *new* stationary of ``P_after``.
    """
    validate_transition_matrix(P)
    n = P.shape[0]
    if intervention_step < 1 or intervention_step >= steps:
        raise ValueError("intervention_step must be in [1, steps)")
    if not 0 <= intervention_state < n:
        raise ValueError(f"intervention_state must be in [0, {n})")
    if P_after is not None:
        validate_transition_matrix(P_after)
        if P_after.shape != P.shape:
            raise ValueError("P_after must have the same shape as P")

    pi0 = stationary_distribution(P)

    baseline = np.zeros((steps + 1, n))
    baseline[0] = pi0
    for t in range(steps):
        baseline[t + 1] = baseline[t] @ P

    intervention = baseline.copy()
    intervention[intervention_step] = 0.0
    intervention[intervention_step, intervention_state] = 1.0
    for t in range(intervention_step, steps):
        intervention[t + 1] = intervention[t] @ P

    rule_change = None
    if P_after is not None:
        rule_change = baseline.copy()
        for t in range(intervention_step, steps):
            rule_change[t + 1] = rule_change[t] @ P_after

    return InterventionResult(
        time_axis=np.arange(steps + 1),
        baseline=baseline,
        intervention=intervention,
        rule_change=rule_change,
    )
