"""Chapter 15 — Local interaction models: Conway's Game of Life + Local Majority.

Two cellular automata on 2-D grids that share the same "update from Moore-
neighbourhood" mechanic but produce completely different long-run behaviour:

- **Local Majority** (15.1) — each cell adopts the state most of its 8 Moore
  neighbours are in. The grid *freezes* into stable clusters. A model for how
  local consensus forms in dialects, customs, or political opinions.
- **Game of Life** (15.2, Conway 1970) — a live cell survives with 2 or 3
  live neighbours; a dead cell is born with exactly 3. Simple rules produce
  emergence: gliders, oscillators, chaos, Turing-complete computation.

Full write-up: ``docs/models/ch15b_life_and_majority.md``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=15,
    name="Life & Local Majority",
    slug="life_and_majority",
    part="dynamics",
    redcape=("Explain", "Explore", "Communicate"),
    summary=(
        "Two cellular automata on a grid — Conway's Game of Life and the "
        "Local Majority model — show how simple local update rules produce "
        "wildly different global patterns: emergence vs. clustering."
    ),
    tags=("cellular automaton", "emergence", "Conway"),
)

# ---------- Moore-neighbourhood helpers ------------------------------------

_OFFSETS_8 = [
    (-1, -1), (-1, 0), (-1, 1),
    ( 0, -1),          ( 0, 1),
    ( 1, -1), ( 1, 0), ( 1, 1),
]


def neighbour_counts(grid: np.ndarray, wrap: bool = True) -> np.ndarray:
    """Count live Moore-neighbours for each cell. Vectorised via slice sums.

    Parameters
    ----------
    grid:
        2-D array of 0/1 values.
    wrap:
        If True, edges wrap around torus-style. If False, off-grid cells are 0.
    """
    grid = np.asarray(grid, dtype=np.int8)
    if wrap:
        padded = np.pad(grid, 1, mode="wrap")
    else:
        padded = np.pad(grid, 1, mode="constant", constant_values=0)
    counts = np.zeros_like(grid, dtype=np.int16)
    for dr, dc in _OFFSETS_8:
        counts += padded[1 + dr : 1 + dr + grid.shape[0],
                         1 + dc : 1 + dc + grid.shape[1]].astype(np.int16)
    return counts


# ---------- Game of Life ---------------------------------------------------

@dataclass(frozen=True)
class LifeResult:
    """A run of Conway's Game of Life.

    Attributes
    ----------
    grid_history:
        List of ``steps + 1`` grid snapshots (each is an int8 2-D array).
    populations:
        Live-cell count at each recorded step.
    steps_taken:
        How many transitions actually happened (may be < requested if the
        grid became stable early).
    stable:
        True if the grid stopped changing before the step budget ran out.
    """

    grid_history: list[np.ndarray]
    populations: list[int]
    steps_taken: int
    stable: bool


def step_life(grid: np.ndarray, wrap: bool = True) -> np.ndarray:
    """Apply Conway's rule once."""
    counts = neighbour_counts(grid, wrap=wrap)
    live = grid > 0
    survives = live & ((counts == 2) | (counts == 3))
    born = (~live) & (counts == 3)
    return (survives | born).astype(np.int8)


def simulate_life(
    *,
    initial_grid: np.ndarray,
    steps: int = 200,
    wrap: bool = True,
    stop_when_stable: bool = True,
) -> LifeResult:
    """Run Conway's Game of Life from ``initial_grid`` for ``steps`` steps.

    Parameters
    ----------
    initial_grid:
        Starting configuration — a 2-D array of 0/1 values.
    steps:
        Maximum number of transitions to simulate.
    wrap:
        Toroidal edges if True.
    stop_when_stable:
        If True and the grid stops changing (still life or empty), stop early.

    Notes
    -----
    Stable = grid unchanged from previous step. Period-2 or higher oscillators
    are *not* detected as stable (they'd need history comparison).
    """
    if steps < 1:
        raise ValueError("steps must be ≥ 1")
    grid = np.asarray(initial_grid, dtype=np.int8).copy()
    history = [grid.copy()]
    populations = [int(grid.sum())]
    stable = False
    steps_taken = 0
    for _ in range(steps):
        next_grid = step_life(grid, wrap=wrap)
        history.append(next_grid.copy())
        populations.append(int(next_grid.sum()))
        steps_taken += 1
        if stop_when_stable and np.array_equal(next_grid, grid):
            stable = True
            grid = next_grid
            break
        grid = next_grid
    return LifeResult(
        grid_history=history, populations=populations,
        steps_taken=steps_taken, stable=stable,
    )


# ---------- Local Majority Model -------------------------------------------

@dataclass(frozen=True)
class MajorityResult:
    """A run of the Local Majority Model."""

    grid_history: list[np.ndarray]
    changes: list[int]        # number of cells that flipped at each step
    steps_taken: int
    stable: bool


def step_majority(
    grid: np.ndarray,
    wrap: bool = True,
    tie_flip: bool = False,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Apply one Local Majority step.

    Each cell has 8 Moore neighbours. If >4 are 1s, cell becomes 1. If <4, cell
    becomes 0. If exactly 4, cell keeps its current value (or randomises if
    ``tie_flip`` is True).
    """
    counts = neighbour_counts(grid, wrap=wrap)
    if tie_flip:
        if rng is None:
            rng = get_rng(None)
        random_bits = (rng.random(grid.shape) > 0.5).astype(np.int8)
        return np.where(counts > 4, 1,
               np.where(counts < 4, 0,
               np.where(counts == 4, random_bits, grid))).astype(np.int8)
    return np.where(counts > 4, 1, np.where(counts < 4, 0, grid)).astype(np.int8)


def simulate_majority(
    *,
    grid_size: int = 40,
    initial_density: float = 0.5,
    steps: int = 100,
    wrap: bool = True,
    tie_flip: bool = False,
    seed: int | None = 42,
    initial_grid: np.ndarray | None = None,
) -> MajorityResult:
    """Run the Local Majority Model.

    Parameters
    ----------
    grid_size:
        Side length of the square grid.
    initial_density:
        Fraction of cells initialised to 1 (rest are 0).
    steps:
        Maximum number of update rounds.
    wrap:
        Toroidal edges.
    tie_flip:
        Randomise on 4-4 ties instead of keeping current value.
    seed:
        RNG seed.
    initial_grid:
        If provided, overrides ``grid_size`` and ``initial_density``.
    """
    if steps < 1:
        raise ValueError("steps must be ≥ 1")
    if not 0.0 <= initial_density <= 1.0:
        raise ValueError("initial_density must be in [0, 1]")
    rng = get_rng(seed)
    if initial_grid is None:
        if grid_size < 3:
            raise ValueError("grid_size must be ≥ 3")
        grid = (rng.random((grid_size, grid_size)) < initial_density).astype(np.int8)
    else:
        grid = np.asarray(initial_grid, dtype=np.int8).copy()

    history = [grid.copy()]
    changes = [0]
    stable = False
    steps_taken = 0
    for _ in range(steps):
        next_grid = step_majority(grid, wrap=wrap, tie_flip=tie_flip, rng=rng)
        diff = int(np.count_nonzero(next_grid != grid))
        history.append(next_grid.copy())
        changes.append(diff)
        steps_taken += 1
        if diff == 0:
            stable = True
            grid = next_grid
            break
        grid = next_grid
    return MajorityResult(
        grid_history=history, changes=changes,
        steps_taken=steps_taken, stable=stable,
    )


# ---------- Named Life patterns --------------------------------------------

def _pat(rows: list[str]) -> np.ndarray:
    return np.array([[1 if c == "X" else 0 for c in row] for row in rows], dtype=np.int8)


PATTERNS: dict[str, dict] = {
    "block": {
        "name": "Block",
        "kind": "Still life",
        "grid": _pat(["XX", "XX"]),
    },
    "beehive": {
        "name": "Beehive",
        "kind": "Still life",
        "grid": _pat([".XX.",
                      "X..X",
                      ".XX."]),
    },
    "blinker": {
        "name": "Blinker",
        "kind": "Oscillator · period 2",
        "grid": _pat(["XXX"]),
    },
    "toad": {
        "name": "Toad",
        "kind": "Oscillator · period 2",
        "grid": _pat([".XXX",
                      "XXX."]),
    },
    "beacon": {
        "name": "Beacon",
        "kind": "Oscillator · period 2",
        "grid": _pat(["XX..",
                      "XX..",
                      "..XX",
                      "..XX"]),
    },
    "pulsar": {
        "name": "Pulsar",
        "kind": "Oscillator · period 3",
        "grid": _pat([
            "..XXX...XXX..",
            ".............",
            "X....X.X....X",
            "X....X.X....X",
            "X....X.X....X",
            "..XXX...XXX..",
            ".............",
            "..XXX...XXX..",
            "X....X.X....X",
            "X....X.X....X",
            "X....X.X....X",
            ".............",
            "..XXX...XXX..",
        ]),
    },
    "glider": {
        "name": "Glider",
        "kind": "Spaceship · moves diagonally",
        "grid": _pat([".X.",
                      "..X",
                      "XXX"]),
    },
    "lwss": {
        "name": "Lightweight spaceship (LWSS)",
        "kind": "Spaceship · moves horizontally",
        "grid": _pat([".XXXX",
                      "X...X",
                      "....X",
                      "X..X."]),
    },
    "r_pentomino": {
        "name": "R-pentomino",
        "kind": "Methuselah · chaotic evolution over 1000+ steps",
        "grid": _pat([".XX",
                      "XX.",
                      ".X."]),
    },
    "acorn": {
        "name": "Acorn",
        "kind": "Methuselah · takes 5206 steps to stabilise",
        "grid": _pat([".X.....",
                      "...X...",
                      "XX..XXX"]),
    },
    "glider_gun": {
        "name": "Gosper glider gun",
        "kind": "Emits gliders forever",
        "grid": _pat([
            "........................X...........",
            "......................X.X...........",
            "............XX......XX............XX",
            "...........X...X....XX............XX",
            "XX........X.....X...XX..............",
            "XX........X...X.XX....X.X...........",
            "..........X.....X.......X...........",
            "...........X...X....................",
            "............XX......................",
        ]),
    },
}


def place_pattern(
    pattern_name: str,
    *,
    grid_size: int = 40,
    offset_r: int | None = None,
    offset_c: int | None = None,
) -> np.ndarray:
    """Return an ``grid_size × grid_size`` grid with the named pattern placed inside.

    Pattern is centred if ``offset_r`` / ``offset_c`` are not given.
    """
    if pattern_name not in PATTERNS:
        raise ValueError(f"unknown pattern {pattern_name!r}; choose from {list(PATTERNS)}")
    pat = PATTERNS[pattern_name]["grid"]
    ph, pw = pat.shape
    if grid_size < max(ph, pw) + 2:
        raise ValueError(f"grid_size {grid_size} too small for pattern of size {ph}×{pw}")
    grid = np.zeros((grid_size, grid_size), dtype=np.int8)
    r0 = (grid_size - ph) // 2 if offset_r is None else offset_r
    c0 = (grid_size - pw) // 2 if offset_c is None else offset_c
    grid[r0 : r0 + ph, c0 : c0 + pw] = pat
    return grid


def random_life_grid(
    *,
    grid_size: int = 40,
    density: float = 0.3,
    seed: int | None = 42,
) -> np.ndarray:
    """Random initial grid for Life."""
    if not 0.0 <= density <= 1.0:
        raise ValueError("density must be in [0, 1]")
    rng = get_rng(seed)
    return (rng.random((grid_size, grid_size)) < density).astype(np.int8)


# ---------- Cluster statistics for Local Majority ---------------------------

def count_clusters(grid: np.ndarray, value: int = 1) -> int:
    """Count connected components of ``value`` cells (4-connectivity).

    Used to quantify the "clustering" outcome of the Local Majority model.
    """
    grid = np.asarray(grid)
    visited = np.zeros_like(grid, dtype=bool)
    n_rows, n_cols = grid.shape
    n_clusters = 0
    for r in range(n_rows):
        for c in range(n_cols):
            if grid[r, c] != value or visited[r, c]:
                continue
            n_clusters += 1
            # BFS
            stack = [(r, c)]
            while stack:
                rr, cc = stack.pop()
                if not (0 <= rr < n_rows and 0 <= cc < n_cols):
                    continue
                if visited[rr, cc] or grid[rr, cc] != value:
                    continue
                visited[rr, cc] = True
                stack.extend([(rr - 1, cc), (rr + 1, cc), (rr, cc - 1), (rr, cc + 1)])
    return n_clusters
