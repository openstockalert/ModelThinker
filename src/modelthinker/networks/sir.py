"""Chapter 11 — SIR compartmental epidemic model.

Deterministic ODE integration of the classic Kermack–McKendrick SIR system.
See ``docs/models/ch11_sir.md`` for the full write-up.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.integrate import solve_ivp

from ..core.base import ModelMeta

META = ModelMeta(
    chapter=11,
    name="SIR epidemic (contagion)",
    slug="sir",
    part="networks",
    redcape=("Predict", "Explain", "Act", "Design"),
    summary=(
        "Three compartments (S, I, R), two rates (β, γ), and the R₀ threshold that "
        "decides whether an outbreak explodes or fizzles."
    ),
    tags=("compartmental", "R0", "ODE"),
)


@dataclass(frozen=True)
class SIRResult:
    t: np.ndarray            # (n_steps,) — days
    S: np.ndarray            # (n_steps,)
    I: np.ndarray            # (n_steps,)
    R: np.ndarray            # (n_steps,)
    N: float
    beta: float
    gamma: float
    R0: float                # β / γ
    peak_day: float          # day of maximum I
    peak_I: float            # peak infectious count
    final_R: float           # cumulative infections
    herd_immunity_threshold: float  # 1 - 1/R0  (0 if R0 ≤ 1)


def _rhs(t, y, beta, gamma, N):
    S, I, _R = y
    new_infections = beta * S * I / N
    recoveries = gamma * I
    return [-new_infections, new_infections - recoveries, recoveries]


def simulate(
    *,
    beta: float = 0.30,
    gamma: float = 0.10,
    N: float = 100_000,
    I0: float = 10.0,
    R0_init: float = 0.0,
    days: int = 180,
    n_points: int = 400,
) -> SIRResult:
    """Integrate the SIR ODE for ``days`` days.

    Parameters
    ----------
    beta:
        Transmission rate (contacts × infection prob per day).
    gamma:
        Recovery rate (1 / average infectious duration).
    N:
        Total population.
    I0:
        Initial number of infectious individuals.
    R0_init:
        Initial number recovered (default 0). The full ``R0`` reproduction
        number is derived from ``beta / gamma``, not this parameter.
    days:
        Simulation horizon in days.
    n_points:
        Number of time points to record (evenly spaced).
    """
    if beta < 0 or gamma <= 0:
        raise ValueError("beta must be ≥ 0 and gamma > 0")
    if N <= 0 or I0 < 0 or R0_init < 0:
        raise ValueError("N > 0, I0 ≥ 0, R0_init ≥ 0 required")
    if I0 + R0_init > N:
        raise ValueError("I0 + R0_init cannot exceed N")
    if days < 1:
        raise ValueError("days must be ≥ 1")

    S0 = N - I0 - R0_init
    t_eval = np.linspace(0.0, float(days), n_points)
    sol = solve_ivp(
        _rhs, (0.0, float(days)), [S0, I0, R0_init],
        args=(beta, gamma, N),
        t_eval=t_eval, method="RK45", rtol=1e-6, atol=1e-8,
    )
    S, I, R = sol.y
    peak_idx = int(np.argmax(I))
    R0_val = beta / gamma
    herd = max(0.0, 1.0 - 1.0 / R0_val) if R0_val > 0 else 0.0
    return SIRResult(
        t=sol.t, S=S, I=I, R=R, N=float(N),
        beta=float(beta), gamma=float(gamma), R0=float(R0_val),
        peak_day=float(sol.t[peak_idx]), peak_I=float(I[peak_idx]),
        final_R=float(R[-1]), herd_immunity_threshold=float(herd),
    )
