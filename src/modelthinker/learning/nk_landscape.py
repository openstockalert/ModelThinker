"""Chapter 28 — Kauffman's NK rugged-landscape model.

Build a random fitness landscape on ``{0,1}^N`` where each bit interacts with
``K`` others, then compare search strategies: hill climbing, random restart,
and long jumps.

Full write-up: ``docs/models/ch28_nk_landscape.md``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..core.base import ModelMeta
from ..core.rng import get_rng

META = ModelMeta(
    chapter=28,
    name="NK rugged landscape",
    slug="nk_landscape",
    part="learning",
    redcape=("Explore", "Explain", "Design"),
    summary=(
        "Kauffman's NK model: interacting decisions create rugged fitness "
        "landscapes where local hill climbing gets stuck on suboptimal peaks."
    ),
    tags=("rugged landscape", "search", "exploration/exploitation"),
)


class NKLandscape:
    """A random NK fitness landscape.

    Each of ``N`` bits has ``K`` random neighbour bits. Its contribution to fitness
    depends on the pattern of the ``K+1`` bits it touches; each such pattern is
    assigned a random fitness in ``[0, 1)``. Total fitness is the mean contribution.
    """

    def __init__(self, N: int, K: int, seed: int | None = 42) -> None:
        if not 2 <= N <= 24:
            raise ValueError("N must be in [2, 24] (2^N table sizes explode)")
        if not 0 <= K <= N - 1:
            raise ValueError("K must satisfy 0 ≤ K ≤ N - 1")
        self.N = N
        self.K = K
        rng = get_rng(seed)
        # For each bit i, pick K distinct neighbours from {0..N-1} \ {i}
        self.neighbours = np.empty((N, K), dtype=np.int32)
        for i in range(N):
            others = np.array([j for j in range(N) if j != i])
            self.neighbours[i] = rng.choice(others, size=K, replace=False)
        # For each bit, a lookup table of size 2^(K+1)
        self.tables = rng.random(size=(N, 1 << (K + 1)))

    def fitness(self, x: np.ndarray) -> float:
        """Fitness of a bit-string ``x`` (shape ``(N,)``)."""
        acc = 0.0
        for i in range(self.N):
            bits = np.concatenate(([x[i]], x[self.neighbours[i]]))
            idx = 0
            for b in bits:
                idx = (idx << 1) | int(b)
            acc += self.tables[i, idx]
        return acc / self.N

    def all_fitnesses(self) -> np.ndarray:
        """Return fitness of every solution — only feasible for small N."""
        if self.N > 20:
            raise ValueError("all_fitnesses only feasible for N ≤ 20")
        out = np.empty(1 << self.N, dtype=float)
        for i in range(1 << self.N):
            bits = np.array([(i >> b) & 1 for b in range(self.N - 1, -1, -1)], dtype=np.int8)
            out[i] = self.fitness(bits)
        return out


@dataclass(frozen=True)
class SearchResult:
    strategy: str
    best_fitness: float
    best_solution: np.ndarray
    trajectory: np.ndarray  # best-so-far at each evaluation (length = budget)


def _hill_climb(
    land: NKLandscape,
    x: np.ndarray,
    budget: int,
    trajectory_start: int = 0,
    best_so_far: np.ndarray | None = None,
) -> tuple[np.ndarray, float, np.ndarray]:
    """One-bit-flip greedy hill climbing from ``x`` for at most ``budget`` evaluations."""
    if best_so_far is None:
        best_so_far = np.zeros(budget)
    f = land.fitness(x)
    idx = trajectory_start
    if idx < budget:
        best_so_far[idx] = f
        idx += 1
    while idx < budget:
        neighbours = []
        for j in range(land.N):
            y = x.copy(); y[j] = 1 - y[j]
            neighbours.append((land.fitness(y), y))
            idx += 1
            if idx >= budget:
                break
        # find best neighbour among evaluations
        best_neighbour_f, best_neighbour = max(neighbours, key=lambda t: t[0])
        # record best-so-far for the evaluations we just made
        window_start = idx - len(neighbours)
        for k, (nf, _) in enumerate(neighbours):
            f = max(f, nf)
            if window_start + k < budget:
                best_so_far[window_start + k] = f
        if best_neighbour_f <= f - 1e-12 or best_neighbour_f < land.fitness(x) + 1e-12:
            # no strict improvement — at a local peak
            break
        x = best_neighbour
    # Fill the rest of best_so_far with the final value (in case we stopped early)
    if idx < budget:
        best_so_far[idx:budget] = f
    return x, f, best_so_far


def hill_climb(land: NKLandscape, *, budget: int = 500, seed: int | None = 0) -> SearchResult:
    """Greedy 1-bit-flip hill climbing from a single random start."""
    rng = get_rng(seed)
    x0 = rng.integers(0, 2, size=land.N, dtype=np.int8)
    traj = np.zeros(budget)
    x_best, f_best, traj = _hill_climb(land, x0, budget, best_so_far=traj)
    return SearchResult("hill_climb", f_best, x_best, traj)


def random_restart(
    land: NKLandscape, *, budget: int = 500, n_restarts: int = 10, seed: int | None = 0
) -> SearchResult:
    """Random-restart hill climbing: split the budget across ``n_restarts`` starts."""
    rng = get_rng(seed)
    per_restart = max(1, budget // n_restarts)
    traj = np.zeros(budget)
    best_f = -np.inf
    best_x = None
    global_idx = 0
    for _ in range(n_restarts):
        if global_idx >= budget:
            break
        x0 = rng.integers(0, 2, size=land.N, dtype=np.int8)
        window = min(per_restart, budget - global_idx)
        local_traj = np.zeros(window)
        x, f, local_traj = _hill_climb(land, x0, window, best_so_far=local_traj)
        if f > best_f:
            best_f, best_x = f, x
        # Splice local best-so-far into the global trajectory (running max)
        for k in range(window):
            traj[global_idx + k] = max(local_traj[k], traj[global_idx + k - 1] if global_idx + k > 0 else 0)
            traj[global_idx + k] = max(traj[global_idx + k], best_f)
        global_idx += window
    if global_idx < budget:
        traj[global_idx:] = best_f
    return SearchResult("random_restart", float(best_f), best_x, traj)


def long_jump(
    land: NKLandscape, *, budget: int = 500, flip_p: float = 0.2, seed: int | None = 0
) -> SearchResult:
    """Random search with per-bit mutation probability ``flip_p`` around the incumbent."""
    rng = get_rng(seed)
    x = rng.integers(0, 2, size=land.N, dtype=np.int8)
    f = land.fitness(x)
    traj = np.zeros(budget)
    traj[0] = f
    for i in range(1, budget):
        mutate = rng.random(land.N) < flip_p
        y = x.copy()
        y[mutate] = 1 - y[mutate]
        fy = land.fitness(y)
        if fy > f:
            x, f = y, fy
        traj[i] = f
    return SearchResult("long_jump", float(f), x, traj)


def compare_strategies(
    *,
    N: int = 12,
    K: int = 2,
    budget: int = 500,
    n_restarts: int = 10,
    long_jump_p: float = 0.2,
    seed: int | None = 42,
) -> dict[str, SearchResult]:
    """Build a landscape and run all three search strategies from the same seed."""
    land = NKLandscape(N=N, K=K, seed=seed)
    return {
        "hill_climb":     hill_climb(land, budget=budget, seed=seed + 1),
        "random_restart": random_restart(land, budget=budget, n_restarts=n_restarts, seed=seed + 2),
        "long_jump":      long_jump(land, budget=budget, flip_p=long_jump_p, seed=seed + 3),
    }


def count_local_peaks(land: NKLandscape) -> int:
    """Enumerate all 2^N solutions and count strict local peaks (only feasible for small N)."""
    fitnesses = land.all_fitnesses()
    N = land.N
    peaks = 0
    for i in range(1 << N):
        f = fitnesses[i]
        is_peak = True
        for b in range(N):
            neigh = i ^ (1 << (N - 1 - b))
            if fitnesses[neigh] > f:
                is_peak = False
                break
        if is_peak:
            peaks += 1
    return peaks
