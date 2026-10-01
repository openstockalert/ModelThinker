"""Chapter 19 — Threshold models with feedback.

Two dynamics on the same "I watch what everyone else is doing, then decide"
skeleton, plus the tipping-point language that ties them together.

- **Positive feedback (Granovetter cascades)** — join if enough others act.
  Runs away from the middle. Outcomes are bimodal (full riot or fizzle);
  variance across cases; **the average outcome is never a typical outcome**.
- **Negative feedback (El Farol)** — act if few others do. Returns to the
  middle. Aggregate is predictable; individual week is not.
- **Tipping points** — a small parameter change flips the qualitative outcome.
  Signature: a spike in outcome entropy at the tip.

Full write-up: ``docs/models/ch19_threshold_feedback.md``.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

import networkx as nx
import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=19,
    name="Threshold models with feedback",
    slug="threshold_feedback",
    part="dynamics",
    redcape=("Explain", "Reason", "Communicate", "Explore"),
    summary=(
        "Positive feedback (riots) makes outcomes bimodal and unpredictable; "
        "negative feedback (El Farol) stabilises the average and randomises "
        "the individual case. The tipping point is where outcome entropy peaks."
    ),
    tags=("cascade", "feedback", "El Farol", "tipping point"),
)


# =====================================================================
# 19.1 Granovetter cascade (positive feedback)
# =====================================================================

@dataclass(frozen=True)
class CascadeResult:
    """One run of the count-based Granovetter cascade.

    Attributes
    ----------
    history:
        Cumulative count of active agents at each iteration (including the
        seed instigators).
    final_size:
        Number of population agents (not counting external instigators) who
        eventually joined.
    n:
        Population size.
    instigators:
        External instigators seeded outside the population.
    """

    history: list[int]
    final_size: int
    n: int
    instigators: int


def simulate_cascade(
    thresholds: np.ndarray | list[float],
    *,
    instigators: int = 0,
) -> CascadeResult:
    """Run Granovetter's count-based threshold cascade to its fixed point.

    Each person $i$ has a threshold $t_i$. Person $i$ joins iff the number of
    others currently acting is at least $t_i$. Population thresholds with
    $t_i = 0$ are natural instigators; ``instigators`` seeds any *external*
    actors on top of them (Page's "add one radical" experiment).

    Iteration is monotone in the acting set, so it always converges in at most
    ``len(thresholds)`` steps.
    """
    thresholds = np.asarray(thresholds, dtype=float)
    n = thresholds.size
    if n == 0:
        return CascadeResult([instigators], 0, 0, instigators)
    acted = np.zeros(n, dtype=bool)
    total = instigators
    history = [total]
    while True:
        # Person i (not yet acting) joins if their threshold ≤ (others acting)
        # Since i is not acting, "others acting" = total.
        new_actors = (~acted) & (thresholds <= total)
        if not new_actors.any():
            break
        acted |= new_actors
        total = instigators + int(acted.sum())
        history.append(total)
    return CascadeResult(
        history=history,
        final_size=int(acted.sum()),
        n=n,
        instigators=instigators,
    )


def sample_normal_thresholds(
    *,
    mean: float,
    sd: float,
    n: int,
    seed: int | None = 42,
    clip: bool = True,
) -> np.ndarray:
    """Draw ``n`` thresholds from ``Normal(mean, sd)``, clipped to ``[0, n]``.

    Clipping keeps thresholds in the meaningful range: a threshold above ``n``
    can never fire, and a negative one is treated as an instigator.
    """
    rng = get_rng(seed)
    values = rng.normal(loc=mean, scale=sd, size=n)
    if clip:
        values = np.clip(values, 0, n)
    return values


def sample_uniform_thresholds(*, n: int) -> np.ndarray:
    """The canonical Granovetter setup: thresholds 0, 1, 2, …, n-1.

    Every rung of the ladder present. One instigator triggers a full cascade.
    """
    return np.arange(n, dtype=float)


@dataclass(frozen=True)
class CascadeSweepResult:
    """Sweep of cascade sizes across a parameter, for the tipping-point
    signature."""

    parameter_values: np.ndarray            # (P,) — swept parameter
    outcome_matrix: np.ndarray              # (P, R) — final size per run
    mean_outcome: np.ndarray                # (P,)
    entropy_bits: np.ndarray                # (P,) — Shannon H of the outcome dist
    fraction_full: np.ndarray               # (P,) — share landing in top 10 %
    fraction_fizzle: np.ndarray             # (P,) — share landing in bottom 10 %


def cascade_variance_sweep(
    *,
    mean_threshold: float,
    sds: np.ndarray | list[float],
    n_agents: int = 100,
    n_runs: int = 400,
    instigators: int = 1,
    seed: int | None = 42,
) -> CascadeSweepResult:
    """Sweep the SD of a normal threshold distribution at fixed mean, running
    many cascades per SD. Returns per-SD summary statistics and the outcome
    entropy — the tipping-point signature.
    """
    rng = get_rng(seed)
    sds = np.asarray(sds, dtype=float)
    P = sds.size
    outcomes = np.zeros((P, n_runs), dtype=int)
    for pi, sd in enumerate(sds):
        for ri in range(n_runs):
            th = np.clip(rng.normal(mean_threshold, sd, size=n_agents), 0, n_agents)
            r = simulate_cascade(th, instigators=instigators)
            outcomes[pi, ri] = r.final_size
    mean_out = outcomes.mean(axis=1)
    entropy = np.zeros(P)
    for pi in range(P):
        entropy[pi] = _shannon_from_samples(outcomes[pi], n_bins=10, lo=0, hi=n_agents)
    fraction_full = (outcomes >= 0.9 * n_agents).mean(axis=1)
    fraction_fizzle = (outcomes <= 0.1 * n_agents).mean(axis=1)
    return CascadeSweepResult(
        parameter_values=sds,
        outcome_matrix=outcomes,
        mean_outcome=mean_out,
        entropy_bits=entropy,
        fraction_full=fraction_full,
        fraction_fizzle=fraction_fizzle,
    )


def _shannon_from_samples(
    samples: np.ndarray, *, n_bins: int, lo: float, hi: float,
) -> float:
    """Discretise ``samples`` into ``n_bins`` equal bins over ``[lo, hi]`` and
    return the Shannon entropy of the binned distribution in bits.

    This is the tipping-point signature: near a tip the outcome distribution
    spreads across the possible outcomes (high entropy); away from the tip it
    concentrates (low entropy)."""
    if samples.size == 0:
        return 0.0
    counts, _ = np.histogram(samples, bins=n_bins, range=(lo, hi))
    total = counts.sum()
    if total <= 0:
        return 0.0
    p = counts / total
    p_pos = p[p > 0]
    return float(-(p_pos * np.log2(p_pos)).sum())


# =====================================================================
# Fractional-threshold cascade on a network (Watts 2002)
# =====================================================================

@dataclass(frozen=True)
class NetworkCascadeResult:
    """Result of a fractional-threshold cascade on a graph."""

    acted: set[int]
    final_size: int
    n: int
    threshold_frac: float
    global_cascade: bool         # True if ≥ 50 % of the network joined


def network_cascade(
    G: nx.Graph,
    *,
    threshold_frac: float,
    seed: int | None = 42,
    initial_seeds: set[int] | list[int] | None = None,
) -> NetworkCascadeResult:
    """Watts (2002) fractional-threshold cascade on a network.

    Each node acts once the *fraction* of its neighbours currently acting
    reaches ``threshold_frac``. Isolated nodes never activate. Seed defaults
    to a single random node — the setup for Watts' famous "cascade window"
    result where the network density has both a floor and a ceiling.
    """
    rng = get_rng(seed)
    n = G.number_of_nodes()
    if n == 0:
        return NetworkCascadeResult(set(), 0, 0, threshold_frac, False)
    if initial_seeds is None:
        seed_node = int(rng.integers(n))
        acted = {seed_node}
    else:
        acted = set(int(v) for v in initial_seeds)
    while True:
        new_actors = set()
        for v in G.nodes():
            if v in acted:
                continue
            nbrs = list(G.neighbors(v))
            if not nbrs:
                continue
            frac = sum(1 for u in nbrs if u in acted) / len(nbrs)
            if frac >= threshold_frac:
                new_actors.add(v)
        if not new_actors:
            break
        acted |= new_actors
    return NetworkCascadeResult(
        acted=acted,
        final_size=len(acted),
        n=n,
        threshold_frac=threshold_frac,
        global_cascade=len(acted) >= 0.5 * n,
    )


# =====================================================================
# 19.2 El Farol bar (negative feedback)
# =====================================================================

# A small stock of predictor rules. Each takes the attendance history (a list
# of past attendances, most recent last) and returns a forecast for next week.

def _pred_last_week(history: list[int]) -> float:
    return history[-1] if history else 50


def _pred_avg_last_4(history: list[int]) -> float:
    if not history:
        return 50
    return float(np.mean(history[-4:]))


def _pred_mirror(history: list[int]) -> float:
    return 100 - history[-1] if history else 50


def _pred_constant_60(history: list[int]) -> float:
    return 60


def _pred_trend(history: list[int]) -> float:
    if len(history) < 2:
        return history[-1] if history else 50
    return max(0, min(100, 2 * history[-1] - history[-2]))


def _pred_avg_last_8(history: list[int]) -> float:
    if not history:
        return 50
    return float(np.mean(history[-8:]))


PREDICTORS: list[tuple[str, Callable[[list[int]], float]]] = [
    ("last week",   _pred_last_week),
    ("avg last 4",  _pred_avg_last_4),
    ("mirror",      _pred_mirror),
    ("constant 60", _pred_constant_60),
    ("trend",       _pred_trend),
    ("avg last 8",  _pred_avg_last_8),
]


@dataclass(frozen=True)
class ElFarolResult:
    """One El Farol simulation."""

    attendance: np.ndarray            # attendance each week
    capacity: int
    n_agents: int
    mean: float
    std: float
    frac_over_capacity: float


def simulate_el_farol(
    *,
    n_agents: int = 100,
    capacity: int = 60,
    n_weeks: int = 100,
    predictors_per_agent: int = 3,
    homogeneous: bool = False,
    warmup_weeks: int = 12,
    seed: int | None = 42,
) -> ElFarolResult:
    """Brian Arthur's El Farol bar problem with rule-based agents.

    Each agent draws ``predictors_per_agent`` predictors from :data:`PREDICTORS`.
    Each week the agent uses whichever of *their* predictors would have been
    most accurate over the previous ``warmup_weeks`` weeks, forecasts next
    week's attendance, and attends iff the forecast is below capacity.

    Setting ``homogeneous=True`` forces every agent to use the SAME predictor
    (``_pred_avg_last_4``) — Arthur's cautionary case where the room oscillates
    catastrophically between packed and empty.
    """
    rng = get_rng(seed)
    n_pred = len(PREDICTORS)
    if homogeneous:
        agents_preds = [[1] for _ in range(n_agents)]      # everyone uses "avg last 4"
    else:
        agents_preds = [
            list(rng.choice(n_pred, size=min(predictors_per_agent, n_pred), replace=False))
            for _ in range(n_agents)
        ]
    # Bootstrap the history with random attendance
    history: list[int] = list(rng.integers(0, n_agents + 1, size=warmup_weeks).tolist())

    weekly = np.zeros(n_weeks, dtype=int)
    for week in range(n_weeks):
        n_going = 0
        for i in range(n_agents):
            preds = agents_preds[i]
            # Best-of-my-own predictors over the last warmup_weeks
            best = preds[0]
            best_err = math.inf
            for pi in preds:
                fn = PREDICTORS[pi][1]
                err = 0.0
                for k in range(1, min(len(history), warmup_weeks) + 1):
                    forecast = fn(history[: -k] if k < len(history) else history[:1])
                    err += (forecast - history[-k]) ** 2
                if err < best_err:
                    best_err = err
                    best = pi
            fn = PREDICTORS[best][1]
            forecast = fn(history)
            if forecast < capacity:
                n_going += 1
        weekly[week] = n_going
        history.append(int(n_going))

    return ElFarolResult(
        attendance=weekly,
        capacity=capacity,
        n_agents=n_agents,
        mean=float(weekly.mean()),
        std=float(weekly.std()),
        frac_over_capacity=float((weekly > capacity).mean()),
    )
