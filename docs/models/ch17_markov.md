# Ch 17 — Markov chains

**Tagline:** _History doesn't matter. Only the rules do._

**REDCAPE:** Explain · Predict · Explore

---

## 1. Intuition

A system moves between a finite set of states — sunny/cloudy/rainy, alert/bored, sober/using/addicted/recovered — and each step the next state depends only on the current one (not on how it got there). This "memoryless" property is what makes it *Markov*.

The magic of Markov chains is a theorem, not a mechanic. If four mild conditions hold — finitely many states, fixed transition probabilities, a path from any state to any other, and no simple cycles — then **the state distribution converges to a unique stationary distribution regardless of where it started**. Every possible starting condition ends up at the same long-run mix.

Three practical implications Page hammers home:
1. **History doesn't matter in the long run.** The system forgets. Which state you woke up in this morning has no bearing on the long-run share of time you'll spend in each mood.
2. **One-time interventions decay.** Force everyone into a preferred state today and the transition probabilities pull them back to π by tomorrow. If you subsidise recovering addicts en masse and the rates that produce addiction are unchanged, the population reverts.
3. **Lasting change requires changing the rules.** Alter the transition probabilities themselves — teach people new coping strategies, change tax code, redesign a website's navigation — and the equilibrium shifts to a new π.

This makes the Markov model *the* diagnostic for whether an intervention will stick.

## 2. The model

A finite state space $\{1, \ldots, n\}$ and a transition matrix $P \in \mathbb{R}^{n \times n}$ where

$$P_{ij} = \Pr(X_{t+1} = j \mid X_t = i), \qquad \sum_j P_{ij} = 1 \;\;\forall\, i.$$

The distribution over states at time $t$, written as a row vector $x_t$, evolves as

$$x_{t+1} = x_t P.$$

**Markov Convergence Theorem.** If $P$ is *irreducible* (every state is reachable from every other) and *aperiodic* (the gcd of return times is 1) then there is a unique **stationary distribution** $\pi$ satisfying

$$\pi P = \pi, \quad \pi_i \ge 0, \quad \sum_i \pi_i = 1,$$

and $x_t \to \pi$ from any starting $x_0$.

Computationally, $\pi$ is the left eigenvector of $P$ for eigenvalue 1, normalised to sum to 1.

## 3. Parameters

| Name              | Symbol | Meaning                                | Range              | Default | Effect of increasing                     |
|-------------------|--------|----------------------------------------|--------------------|---------|------------------------------------------|
| `P`               | $P$    | Transition matrix (row-stochastic)      | $n \times n$        | preset  | Different rules → different stationary   |
| `initial_state`   | —      | Where each walker starts               | $\{0, ..., n-1\}$   | `0`     | Only affects transient — long run is π   |
| `steps`           | $T$    | Number of transitions to simulate      | $[10, 10^4]$        | `200`   | Sharper convergence to π                 |
| `n_walks`         | $N$    | Independent trajectories               | $[1, 10^4]$         | `500`   | Empirical distribution closer to π       |
| `seed`            | —      | RNG seed                               | any int             | `42`    | —                                        |

## 4. Key results

1. **Convergence to π.** For any starting $x_0$, $x_t \to \pi$ as $t \to \infty$. In practice, geometric convergence — the sub-dominant eigenvalue of $P$ controls the rate.
2. **π is the left eigenvector for eigenvalue 1.** Solve directly rather than iterating.
3. **History dies.** Two chains started from wildly different points look identical after enough steps.
4. **Interventions decay.** Moving mass into a chosen state at time $t^*$ is a shift to a non-stationary distribution; it decays exponentially back to π.
5. **Rule changes stick.** Replacing $P$ with $P'$ moves the equilibrium to a new $\pi'$.

## 5. What to try

- **Recipe A — The three-worlds convergence.** Pick the weather chain. Start three populations at 100 % sunny, 100 % rainy, and uniform. Watch the "% sunny" curves cross the same value within ~50 steps. That's the theorem.
- **Recipe B — The eigenvector shortcut.** Compare `stationary_distribution(P)` against the final row of `distribution_over_time(P, initial_state=0, steps=500)`. They should match to five decimals. π isn't just an approximation — it's exactly the eigenvector.
- **Recipe C — The intervention trap.** Take the drug preset. At step 100, force everyone into "Sober" (one-off intervention). By step ~250 the "Addicted" share is back at its baseline value. A rescue that doesn't change the rules produces zero long-run effect.
- **Recipe D — The rule change.** Same preset, but at step 100 modify $P$ so `P[Sober, Using] = P[Sober, Using] − 0.08` (with the mass returned to `P[Sober, Sober]`). Now the new $\pi'$ has a permanently lower Addicted share. That's what real drug policy is aiming for.
- **Recipe E — PageRank.** Compute the stationary of the `pagerank` preset — the highest-π page is what Google would rank first.

## 6. Limits and pitfalls

- **Time-homogeneity required.** The model assumes $P$ is fixed. Real transition rates change with the economy, season, learning curve — you often need a *series* of Markov chains, one per regime.
- **State design matters.** The Markov property depends on your chosen states capturing everything relevant about the past. If you've mis-carved the state space (e.g., ignoring "duration since last relapse" for a recovery chain), the "memoryless" assumption fails.
- **Convergence can be slow.** If $P$ has an eigenvalue close to 1, the chain mixes slowly. "Long run" can mean centuries for very sticky states.
- **Reducibility is a real problem.** If some states can't reach others, there's no unique π — you get one stationary per closed class. Always check irreducibility.

## 7. Connections

- **Ch 6 — Power laws.** Preferential attachment on a growing network is a (non-time-homogeneous) Markov chain over graphs. PageRank is the stationary distribution of a random-surfer chain.
- **Ch 13 — Random walks.** A random walk on a finite lattice is a Markov chain; the stationary distribution corresponds to the equilibrium visit frequencies. Random walks with drift *break* the return-recurrence and hence the stationary result.
- **Ch 14 — Path dependence.** Pólya urns are *non-ergodic* Markov chains — no unique stationary; long-run outcomes remember history. Bernoulli and Balancing urns are ergodic and have a unique stationary. Markov chains are the *ergodic* counterpoint to Pólya-style path dependence.
- **Ch 18 — Systems dynamics.** A stock-and-flow model with linear rates is a continuous-time Markov chain in disguise.
- **Ch 26 — Learning.** Reinforcement learners can be analysed as Markov chains on augmented state-action spaces.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 17.
- Kemeny, J. G. & Snell, J. L. (1976). *Finite Markov Chains*. Springer.
- Brin, S. & Page, L. (1998). "The anatomy of a large-scale hypertextual Web search engine." *Computer Networks*, 30 — the original PageRank paper.
- Freedom House. *Freedom in the World* annual reports — the data behind the democratization chain.
- Norris, J. R. (1997). *Markov Chains*. Cambridge University Press — the theory reference.
