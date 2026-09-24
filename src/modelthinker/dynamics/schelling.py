"""Chapter 15 — Schelling segregation.

Individually mild same-type preferences on a grid produce sharp collective
segregation. Full write-up: ``docs/models/ch15_schelling.md``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=15,
    name="Schelling segregation",
    slug="schelling",
    part="dynamics",
    redcape=("Explain", "Explore", "Communicate"),
    summary=(
        "Individually mild same-type preferences on a grid produce dramatic "
        "collective segregation — micro-motives don't equal macro-behaviour."
    ),
    tags=("agent-based", "emergence", "phase transition"),
)

EMPTY = 0
TYPE_A = 1
TYPE_B = 2

# Moore neighbourhood offsets (8 neighbours)
_OFFSETS = np.array(
    [(-1, -1), (-1, 0), (-1, 1),
     ( 0, -1),          ( 0, 1),
     ( 1, -1), ( 1, 0), ( 1, 1)],
    dtype=int,
)


@dataclass(frozen=True)
class SchellingResult:
    grid_history: list[np.ndarray]  # snapshots every ``snapshot_every`` steps, including step 0
    seg_index_history: list[float]  # segregation index at each snapshot
    unhappy_history: list[int]      # unhappy count at each snapshot
    steps_taken: int
    converged: bool                 # True if everyone became happy
    grid_size: int
    tolerance: float
    density: float


def _initial_grid(rng: np.random.Generator, L: int, density: float) -> np.ndarray:
    n_cells = L * L
    n_agents = int(round(density * n_cells))
    n_a = n_agents // 2
    n_b = n_agents - n_a
    cells = np.array([TYPE_A] * n_a + [TYPE_B] * n_b + [EMPTY] * (n_cells - n_agents))
    rng.shuffle(cells)
    return cells.reshape(L, L)


def _neighbour_counts(grid: np.ndarray, r: int, c: int) -> tuple[int, int]:
    """Return (same_type, other_type) counts among the Moore-neighbours (with wrap-around)."""
    L = grid.shape[0]
    me = grid[r, c]
    same = other = 0
    for dr, dc in _OFFSETS:
        nb = grid[(r + dr) % L, (c + dc) % L]
        if nb == EMPTY:
            continue
        if nb == me:
            same += 1
        else:
            other += 1
    return same, other


def _is_happy(grid: np.ndarray, r: int, c: int, tolerance: float) -> bool:
    same, other = _neighbour_counts(grid, r, c)
    total = same + other
    if total == 0:
        return True  # isolated agents are happy (edge case)
    return (same / total) >= tolerance


def _segregation_index(grid: np.ndarray) -> float:
    """Average fraction of same-type non-empty neighbours across all agents."""
    L = grid.shape[0]
    same_total = 0
    all_total = 0
    for r in range(L):
        for c in range(L):
            if grid[r, c] == EMPTY:
                continue
            s, o = _neighbour_counts(grid, r, c)
            if s + o == 0:
                continue
            same_total += s
            all_total += s + o
    return same_total / all_total if all_total else 0.0


def _find_unhappy(grid: np.ndarray, tolerance: float) -> list[tuple[int, int]]:
    L = grid.shape[0]
    out: list[tuple[int, int]] = []
    for r in range(L):
        for c in range(L):
            if grid[r, c] == EMPTY:
                continue
            if not _is_happy(grid, r, c, tolerance):
                out.append((r, c))
    return out


def _find_empties(grid: np.ndarray) -> list[tuple[int, int]]:
    rs, cs = np.where(grid == EMPTY)
    return list(zip(rs.tolist(), cs.tolist(), strict=True))


def simulate(
    *,
    grid_size: int = 40,
    density: float = 0.9,
    tolerance: float = 0.3,
    max_steps: int = 5_000,
    snapshot_every: int = 200,
    seed: int | None = 42,
) -> SchellingResult:
    """Run Schelling's segregation dynamics on a square grid.

    Parameters
    ----------
    grid_size:
        Side length of the square grid.
    density:
        Fraction of cells occupied (rest are empty).
    tolerance:
        Minimum fraction of same-type Moore-neighbours needed to be happy.
    max_steps:
        Maximum number of individual moves (one unhappy agent per step).
    snapshot_every:
        Store a grid snapshot every this-many steps for animation. Step 0 and
        the final state are always included.
    seed:
        RNG seed for reproducibility.

    Returns
    -------
    SchellingResult with grid snapshots and segregation-index history.
    """
    if not 0.0 < density <= 1.0:
        raise ValueError("density must be in (0, 1]")
    if not 0.0 <= tolerance <= 1.0:
        raise ValueError("tolerance must be in [0, 1]")
    if grid_size < 3:
        raise ValueError("grid_size must be ≥ 3")

    rng = get_rng(seed)
    grid = _initial_grid(rng, grid_size, density)

    snapshots = [grid.copy()]
    seg = [_segregation_index(grid)]
    unhappy_hist = [len(_find_unhappy(grid, tolerance))]
    converged = False
    step = 0

    for step in range(1, max_steps + 1):
        unhappy = _find_unhappy(grid, tolerance)
        if not unhappy:
            converged = True
            break
        empties = _find_empties(grid)
        if not empties:
            break
        r_from, c_from = unhappy[rng.integers(len(unhappy))]
        r_to, c_to = empties[rng.integers(len(empties))]
        grid[r_to, c_to] = grid[r_from, c_from]
        grid[r_from, c_from] = EMPTY

        if step % snapshot_every == 0:
            snapshots.append(grid.copy())
            seg.append(_segregation_index(grid))
            unhappy_hist.append(len(_find_unhappy(grid, tolerance)))

    # Always include final state
    if snapshots[-1] is not grid:
        snapshots.append(grid.copy())
        seg.append(_segregation_index(grid))
        unhappy_hist.append(len(_find_unhappy(grid, tolerance)))

    return SchellingResult(
        grid_history=snapshots,
        seg_index_history=seg,
        unhappy_history=unhappy_hist,
        steps_taken=step,
        converged=converged,
        grid_size=grid_size,
        tolerance=tolerance,
        density=density,
    )
