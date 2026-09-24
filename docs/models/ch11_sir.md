# Ch 11 — SIR epidemic (contagion)

**Tagline:** _Three compartments, two rates, one number — R₀ — decide whether an outbreak fizzles or explodes._

**REDCAPE:** Predict · Explain · Act · Design

---

## 1. Intuition

The Susceptible–Infected–Recovered (SIR) model is the workhorse of epidemiology. A population is split into three tanks: **S**usceptible (can catch it), **I**nfectious (currently sick and spreading), and **R**ecovered (immune). Two knobs drive the whole story:

- **β** — the transmission rate: how many contacts an infectious person makes per day multiplied by the probability each contact spreads the pathogen.
- **γ** — the recovery rate: reciprocal of the average infectious period.

Their ratio is the famous **basic reproduction number** $R_0 = \beta / \gamma$: the expected number of new infections one sick person causes in a fully susceptible population. **When $R_0 > 1$, the outbreak grows.** When $R_0 < 1$, it dies. That single threshold is why interventions target either lowering β (masks, distancing) or shortening infectious duration (testing, isolation).

The simulator integrates the SIR ODE and shows the three curves over time. You can watch how the epidemic peaks, when it peaks, and how many people never got sick (the "final susceptible" size). Play with β and γ to feel the R₀ threshold directly.

## 2. The model

Let $S(t), I(t), R(t)$ be the fractions (or counts) of the population in each compartment, with $S + I + R = N$. The classic SIR ODE is:

$$
\begin{aligned}
\frac{dS}{dt} &= -\beta \, \frac{S I}{N} \\[2pt]
\frac{dI}{dt} &= \phantom{-}\beta \, \frac{S I}{N} - \gamma I \\[2pt]
\frac{dR}{dt} &= \phantom{-\beta S I / N +\ } \gamma I
\end{aligned}
$$

Key derived quantities:

- $R_0 = \beta / \gamma$ — basic reproduction number.
- $R_e(t) = R_0 \cdot S(t) / N$ — effective reproduction number as susceptibles are depleted.
- Peak infections occur when $R_e = 1$, i.e. $S / N = 1/R_0$.
- **Final size equation.** The fraction who avoid infection satisfies $S_\infty / N = e^{-R_0 (1 - S_\infty/N)}$.

## 3. Parameters

| Name         | Symbol   | Meaning                              | Range              | Default | Effect of increasing                          |
|--------------|----------|--------------------------------------|--------------------|---------|-----------------------------------------------|
| `beta`       | $\beta$  | Contacts per day × transmission prob | $[0.01, 2.0]$      | `0.30`  | Faster, taller epidemic peak; higher $R_0$    |
| `gamma`      | $\gamma$ | Recovery rate ($1/$duration)         | $[0.02, 1.0]$      | `0.10`  | Shorter infectious period; lower $R_0$        |
| `N`          | $N$      | Total population                     | $[100, 10{,}000{,}000]$ | `100000` | Scales absolute counts (dynamics unchanged) |
| `I0`         | $I_0$    | Initial infectious count             | $[1, N/2]$         | `10`    | Slightly earlier onset; final size ~unchanged |
| `days`       | —        | Simulation horizon (days)            | $[10, 730]$        | `180`   | Longer horizon shows the tail                 |

## 4. Key results

1. **The $R_0$ threshold.** $R_0 > 1$ ⇒ epidemic grows initially; $R_0 < 1$ ⇒ outbreak dies. This is the single most important number in outbreak analysis.
2. **Herd immunity threshold.** Once $S/N$ drops below $1/R_0$, each new infection produces less than one successor on average. This is why vaccinating a fraction $1 - 1/R_0$ of the population can stop transmission.
3. **Peak vs total.** Interventions can lower the *peak* (helpful for hospital capacity) without much changing the *total* attack rate. Flatten-the-curve buys time, not necessarily fewer cases.
4. **Overshoot.** Even after $R_e$ crosses 1, momentum keeps new infections coming — the epidemic overshoots the herd immunity threshold. This is why "let it burn to herd immunity" over-counts the deaths.

### R₀ and herd-immunity thresholds for common pathogens (Page, Ch 11)

| Disease | R₀ (approx.) | Herd threshold $1 - 1/R_0$ |
|---|---|---|
| Seasonal influenza | 1.3 | ~23 % |
| Ebola | 2 | 50 % |
| COVID-19 (ancestral) | 2.5 | 60 % |
| Smallpox | 5 | 80 % |
| Measles | 15 | ~93 % |

Measles is why the WHO target for MMR vaccination coverage sits around 95 % — anything less allows outbreaks to reignite in undervaccinated pockets. Try `β = 1.5, γ = 0.10` in the simulator (R₀ = 15) to see the shape of a measles-like outbreak in an unvaccinated population.

### Ch 11 in the book covers three related spread models

The book's Chapter 11 is titled *Broadcast, Diffusion, and Contagion*. SIR is the contagion model; two siblings sit next to it:

- **Broadcast model.** A central source (TV ad, government announcement) reaches a fixed share of the *uninformed* each period. Produces an **r-shaped** (concave) adoption curve: fast, then saturating.
- **Bass model.** Combines broadcast (coefficient $p$) with word-of-mouth diffusion (coefficient $q$). Adopters(t+1) − Adopters(t) $= (p + q F)(1 - F)$ where $F$ is the cumulative adopted fraction. Produces the classic **S-shaped** product-diffusion curve — used to forecast sales of consumer durables from early data.

SIR generalises the *diffusion* piece by adding recovery (removal). All three are candidates for future ModelThinker chapters.

## 5. What to try

- **Recipe A — Baseline outbreak.** `β = 0.30`, `γ = 0.10` (R₀ = 3), `days = 180`. _Expected: peak at ~day 45, ~94 % attack rate._
- **Recipe B — Threshold crossing.** Fix `γ = 0.10` and toggle `β` between 0.09 (R₀ = 0.9) and 0.11 (R₀ = 1.1). _Expected: below threshold the outbreak fades; barely above threshold, a slow-motion epidemic reaches a much smaller final size._
- **Recipe C — Shorter infectious period.** `β = 0.30`, `γ = 0.30` (R₀ = 1) — right at threshold. _Expected: nearly-flat I curve, no meaningful outbreak._
- **Recipe D — Big seed doesn't matter.** Compare `I0 = 1` vs `I0 = 1000` for R₀ = 2. _Expected: same shape, same peak height, just shifted earlier._

## 6. Limits and pitfalls

- **Homogeneous mixing.** Everyone contacts everyone equally — real contact networks are clustered, so SIR overestimates spread among strangers and underestimates within-cluster outbreaks (see Ch 10).
- **Constant β and γ.** Real interventions (lockdowns, seasonality, behaviour change) make β time-varying.
- **No demography.** No births, no deaths, no re-susceptibility. Fine for short outbreaks; wrong for endemic diseases (use SIRS or SEIR variants).
- **Deterministic.** Small outbreaks are stochastic — a single infectious person may or may not seed anything. This model averages that away.

## 7. Connections

- **Broadcast & Bass (same book chapter).** SIR is one of three spread models Page groups together. Broadcast has one-to-many spread; Bass has one-to-many + one-to-one; SIR has one-to-one only, and adds removal (recovery).
- **Ch 10 — Network models.** Contact structure changes the effective $R_0$ and the epidemic curve shape. SIR is the mean-field limit of network SIR on a random graph. Hubs (Ch 6) become super-spreaders.
- **Ch 5 — Normal distributions.** In the early phase, $\log I(t)$ grows linearly with variance ~$t$; long-run tail-sums look approximately normal.
- **Ch 19 — Threshold models.** Both feature a critical value that separates fadeout from cascade.
- **Ch 26 — Learning.** A behaving population lowers β over time as people learn to avoid contacts; combining SIR + learning gives more realistic curves.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 11.
- Kermack, W. O. & McKendrick, A. G. (1927). "A contribution to the mathematical theory of epidemics." *Proc. R. Soc. A.*
- Anderson, R. M. & May, R. M. (1991). *Infectious Diseases of Humans*. Oxford University Press.
